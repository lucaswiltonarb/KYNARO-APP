// Espelho em JS das regras do motor Python (engine/exercises/base_exercise.py), lidas das definições YAML.
import {FilesetResolver,PoseLandmarker} from '@mediapipe/tasks-vision';

export const LM={nose:0,left_shoulder:11,right_shoulder:12,left_elbow:13,right_elbow:14,left_wrist:15,right_wrist:16,left_hip:23,right_hip:24,left_knee:25,right_knee:26,left_ankle:27,right_ankle:28};
const BONES=[[[11,12],[11,23],[12,24],[23,24],'#22d3ee'],[[11,13],[13,15],[12,14],[14,16],'#a3e635'],[[23,25],[25,27],[24,26],[26,28],'#a78bfa']];

let landmarkerJob=null;
export function getLandmarker(model='full'){
  const opts=delegate=>({baseOptions:{modelAssetPath:`/mediapipe/pose_landmarker_${model}.task`,delegate},runningMode:'VIDEO',numPoses:1,
    minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5});
  landmarkerJob??=FilesetResolver.forVisionTasks('/mediapipe/wasm')
    .then(fs=>PoseLandmarker.createFromOptions(fs,opts('GPU')).catch(()=>PoseLandmarker.createFromOptions(fs,opts('CPU'))))
    .catch(e=>{landmarkerJob=null;throw e});
  return landmarkerJob;
}

function angleBetween(a,b,c){
  const ba=[a.x-b.x,a.y-b.y],bc=[c.x-b.x,c.y-b.y];const m=Math.hypot(...ba)*Math.hypot(...bc);
  if(!m)return 0;return Math.acos(Math.max(-1,Math.min(1,(ba[0]*bc[0]+ba[1]*bc[1])/m)))*180/Math.PI;
}

// condições vêm das nossas definições YAML (sintaxe Python): só operadores, números e nomes conhecidos
function compile(expr){
  const js=String(expr).replace(/\band\b/g,'&&').replace(/\bor\b/g,'||').replace(/\bnot\b/g,'!').replace(/\bTrue\b/g,'true').replace(/\bFalse\b/g,'false');
  if(!/^[\w\s.<>=!()+\-*/,&|]*$/.test(js)||/__|constructor|prototype|window|document|globalThis|Function/.test(js))return()=>false;
  // eslint-disable-next-line no-new-func
  const fn=new Function('c',`with(c){return (${js})}`);
  return ctx=>{try{return !!fn(ctx)}catch{return false}};
}

const GRADE=s=>s>=90?'A':s>=80?'B':s>=70?'C':s>=60?'D':'F';

export function createCounter(def){
  const type=def.type||'repetition';const bilateral=!!def.bilateral;
  const order=def.state_order||Object.keys(def.states||{});
  const states=order.filter(n=>def.states?.[n]).map(n=>({name:n,test:compile(def.states[n].condition)}));
  const feedback=Object.entries(def.feedback||{}).map(([name,f])=>({name,message:f.message,severity:f.severity||'warning',test:compile(f.condition)}));
  const rule=def.counter||{};const minRep=(def.min_rep_duration??.5)*1000;
  // modelo "lite" do navegador oscila mais que o do Python: suaviza 3 quadros por padrão
  const smoothN=def.smoothing?.enabled?def.smoothing.window||5:3;
  const hist={};const smooth=(k,v)=>{const h=(hist[k]??=[]);h.push(v);if(h.length>smoothN)h.shift();return h.reduce((a,b)=>a+b,0)/h.length};
  const S={count:0,left:0,right:0,cur:null,prev:null,L:{cur:null,prev:null,armed:true,last:-1e9},R:{cur:null,prev:null,armed:true,last:-1e9},armed:true,last:-1e9,holdStart:null,duration:0,best:0,frames:0,goodFrames:0};
  const pick=ctx=>{for(const s of states)if(s.test(ctx))return s.name;return null};
  function countSide(side,t){
    const X=S[side];if(rule.reset_state&&X.cur===rule.reset_state)X.armed=true;
    if(X.prev!==X.cur&&X.cur===rule.trigger_state&&(!rule.reset_state||X.armed)&&t-X.last>=minRep){X.last=t;X.armed=false;return true}
    return false;
  }
  return {
    def,
    step(lms,w,h,t){
      const P=n=>({x:lms[LM[n]].x*w,y:lms[LM[n]].y*h});const ctx={abs:Math.abs,min:Math.min,max:Math.max};
      for(const [n,i] of Object.entries(LM)){ctx[n+'_x']=Math.round(lms[i].x*w);ctx[n+'_y']=Math.round(lms[i].y*h)}
      for(const [name,a] of Object.entries(def.angles||{})){
        const v=smooth(name,angleBetween(P(a.points[0]),P(a.points[1]),P(a.points[2])));ctx[name+'_angle']=v;if(name==='primary')ctx.angle=v;
      }
      let counted=false;
      if(bilateral){
        for(const [side,key] of [['L','left'],['R','right']]){const X=S[side];X.prev=X.cur;X.cur=pick({...ctx,angle:ctx[key+'_angle']??0})}
        if(countSide('L',t)){S.left++;counted=true}if(countSide('R',t)){S.right++;counted=true}
        S.count=S.left+S.right;S.cur=S.R.cur===rule.trigger_state||S.L.cur===rule.trigger_state?rule.trigger_state:(S.R.cur||S.L.cur);
      }else{
        S.prev=S.cur;S.cur=pick(ctx);
        if(type==='duration'){
          const hold=def.hold_state||'hold';
          if(S.cur===hold){S.holdStart??=t;S.duration=(t-S.holdStart)/1000;S.best=Math.max(S.best,S.duration)}
          else{if(S.holdStart!=null&&S.duration>=(def.target_duration||30)){S.count++;counted=true}S.holdStart=null;S.duration=0}
        }else{
          if(rule.reset_state&&S.cur===rule.reset_state)S.armed=true;
          if(S.prev!==S.cur&&S.cur===rule.trigger_state&&(!rule.from_state||S.prev===rule.from_state)&&(!rule.reset_state||S.armed)&&t-S.last>=minRep){S.count++;S.last=t;S.armed=false;counted=true}
        }
      }
      const msgs=feedback.filter(f=>f.test(ctx));
      S.frames++;if(!msgs.some(m=>m.severity!=='info'))S.goodFrames++;
      const score=Math.round(S.goodFrames/S.frames*100);
      return {count:S.count,left:S.left,right:S.right,state:S.cur,feedback:msgs,duration:S.duration,best:S.best,counted,score,grade:GRADE(score)};
    },
  };
}

export function drawPose(ctx,lms,w,h){
  const vis=i=>(lms[i].visibility??1)>.5;const pt=i=>[lms[i].x*w,lms[i].y*h];
  ctx.lineCap='round';const lw=Math.max(3,w/220);
  for(const group of BONES){const color=group[group.length-1];
    for(const [a,b] of group.slice(0,-1)){if(!vis(a)||!vis(b))continue;
      ctx.strokeStyle=color+'55';ctx.lineWidth=lw*2.4;ctx.beginPath();ctx.moveTo(...pt(a));ctx.lineTo(...pt(b));ctx.stroke();
      ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(...pt(a));ctx.lineTo(...pt(b));ctx.stroke();}}
  for(const i of Object.values(LM)){if(!vis(i))continue;const [x,y]=pt(i);ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(x,y,lw*1.2,0,7);ctx.fill();ctx.fillStyle='#FF6A00';ctx.beginPath();ctx.arc(x,y,lw*.7,0,7);ctx.fill()}
}
