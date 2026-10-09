import React,{useEffect,useRef,useState} from 'react';
import {useParams,useNavigate} from 'react-router-dom';
import {Camera as CameraIcon,Play,Pause,Square,RotateCcw,SwitchCamera,CheckCircle,ArrowLeft,Activity,Film,Server,LoaderCircle,Upload} from 'lucide-react';
import {useApp} from '../context';
import {getExercise,getExerciseDefinition,analyzeExerciseVideo,getAnalysis,saveCameraSession} from '../api';
import {Button,Card,Badge,PageTitle,Loading} from '../components/ui';
import {getLandmarker,createCounter,drawPose} from '../poseEngine';

const CAM_ERR={Insecure:'A câmera só funciona em conexão segura (HTTPS ou localhost). Pelo IP da rede local o navegador bloqueia o acesso.',Unsupported:'Este navegador não oferece acesso à câmera.',NotAllowedError:'Permissão da câmera negada. Libere o acesso nas configurações do navegador e tente de novo.',NotFoundError:'Nenhuma câmera encontrada neste dispositivo.',NotReadableError:'A câmera está em uso por outro aplicativo. Feche-o e tente de novo.',OverconstrainedError:'Esta câmera não suporta o modo selecionado. Tente trocar de câmera.'};
const STATE_PT={down:'Posição inicial',up:'Subindo',curl:'Em movimento',flex:'Contração',hold:'Segurando',setup:'Ajustando',rest:'Pausa',bottom:'Embaixo',top:'Em cima',start:'Início',middle:'Meio'};
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;

export default function Camera(){
  const {id}=useParams();const nav=useNavigate();const {notify}=useApp();
  const [ex,setEx]=useState(null);const [def,setDef]=useState(null);const [loadErr,setLoadErr]=useState('');
  const [source,setSource]=useState(null);const [status,setStatus]=useState('idle');const [front,setFront]=useState(true);
  const [boot,setBoot]=useState('');const [err,setErr]=useState('');const [stats,setStats]=useState(null);const [elapsed,setElapsed]=useState(0);
  const [result,setResult]=useState(null);const [videoFile,setVideoFile]=useState(null);const [server,setServer]=useState(null);
  const video=useRef();const canvas=useRef();const stream=useRef();const counter=useRef();const raf=useRef();const statusRef=useRef('idle');
  const landmarker=useRef();const lastFrame=useRef(-1);const lastUi=useRef(0);const fileInput=useRef();const startedAt=useRef(0);const activeMs=useRef(0);const srcRef=useRef(null);const statsRef=useRef(null);

  useEffect(()=>{
    Promise.all([getExercise(id).catch(()=>({})),getExerciseDefinition(id)]).then(([i,d])=>{setEx(i);setDef(d);counter.current=createCounter(d)}).catch(e=>setLoadErr(e.message));
    return()=>{cancelAnimationFrame(raf.current);stream.current?.getTracks().forEach(t=>t.stop())};
  },[id]);
  useEffect(()=>{statusRef.current=status},[status]);
  useEffect(()=>{if(status!=='running'||source!=='camera')return;const t=setInterval(()=>setElapsed(e=>e+1),1000);return()=>clearInterval(t)},[status,source]);

  async function ensureModel(){if(landmarker.current)return;setBoot('Carregando motor de análise…');landmarker.current=await getLandmarker();setBoot('')}
  function loop(){
    const v=video.current,c=canvas.current;
    if(v&&c&&v.readyState>=2){
      if(c.width!==v.videoWidth){c.width=v.videoWidth;c.height=v.videoHeight}
      const g=c.getContext('2d');g.drawImage(v,0,0,c.width,c.height);
      const isVideo=srcRef.current==='video';
      if(v.currentTime!==lastFrame.current||!isVideo){
        lastFrame.current=v.currentTime;
        const res=landmarker.current.detectForVideo(v,performance.now());const lms=res.landmarks?.[0];
        if(lms){
          drawPose(g,lms,c.width,c.height);
          if(statusRef.current==='running'){
            const t=isVideo?v.currentTime*1000:performance.now();const s=counter.current.step(lms,c.width,c.height,t);statsRef.current=s;
            if(s.counted&&navigator.vibrate)navigator.vibrate(40);
            if(s.counted||performance.now()-lastUi.current>200){lastUi.current=performance.now();setStats(s)}
          }
        }
      }
    }
    raf.current=requestAnimationFrame(loop);
  }

  async function startCamera(nextFront=front){
    setErr('');stream.current?.getTracks().forEach(t=>t.stop());
    try{
      if(!window.isSecureContext)throw {name:'Insecure'};if(!navigator.mediaDevices?.getUserMedia)throw {name:'Unsupported'};
      await ensureModel();
      const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:nextFront?'user':'environment',width:{ideal:1280},height:{ideal:720}},audio:false});
      stream.current=s;const v=video.current;v.srcObject=s;v.removeAttribute('src');v.loop=false;await v.play();
      srcRef.current='camera';setSource('camera');cancelAnimationFrame(raf.current);raf.current=requestAnimationFrame(loop);
    }catch(e){setBoot('');setErr(CAM_ERR[e?.name]||('Não foi possível iniciar a câmera. '+(e?.message||'')))}
  }
  async function pickVideo(e){
    const f=e.target.files[0];e.target.value='';if(!f)return;
    setErr('');stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
    try{
      await ensureModel();
      const v=video.current;v.srcObject=null;v.src=URL.createObjectURL(f);v.loop=false;v.muted=true;
      await new Promise((ok,no)=>{v.onloadeddata=ok;v.onerror=()=>no(new Error('Formato de vídeo não suportado pelo navegador.'))});
      srcRef.current='video';setVideoFile(f);setServer(null);setSource('video');reset();setFront(false);
      v.onended=()=>{if(statusRef.current==='running')finish()};
      cancelAnimationFrame(raf.current);raf.current=requestAnimationFrame(loop);
    }catch(e2){setBoot('');setErr(e2.message)}
  }
  function reset(){counter.current=createCounter(def);statsRef.current=null;setStats(null);setResult(null);setElapsed(0);activeMs.current=0;setStatus('idle')}
  function toggle(){
    const v=video.current;
    if(status==='running'){setStatus('paused');activeMs.current+=performance.now()-startedAt.current;if(source==='video')v.pause();return}
    if(source==='video'&&(status==='idle'||status==='stopped')){reset();v.currentTime=0}
    startedAt.current=performance.now();statusRef.current='running';setStatus('running');if(source==='video')v.play();
  }
  async function finish(){
    if(statusRef.current==='running')activeMs.current+=performance.now()-startedAt.current;
    statusRef.current='stopped';setStatus('stopped');const src=srcRef.current;if(src==='video')video.current.pause();
    const final=statsRef.current;setStats(final);
    const r={reps:final?.count||0,left:final?.left,right:final?.right,score:final?.score??null,grade:final?.grade,best:final?.best||0,secs:Math.round(activeMs.current/1000)};
    r.saving=r.reps>0||r.best>0;setResult({...r});r.saving=false;
    if(r.reps>0||r.best>0){
      try{await saveCameraSession(id,{source:src,reps:r.reps,left_reps:def.bilateral?r.left:null,right_reps:def.bilateral?r.right:null,hold_seconds:def.type==='duration'?Math.round(r.best):null,form_score:r.score,duration_sec:r.secs});r.saved=true;setResult({...r})}
      catch(e){setResult({...r});notify('Sessão não foi salva: '+e.message,true)}
    }
  }
  async function serverAnalyze(){
    if(!videoFile)return;setServer({status:'uploading',progress:0});
    try{
      const {job}=await analyzeExerciseVideo(id,videoFile);
      const poll=async()=>{const r=await getAnalysis(job);setServer(r);
        if(r.status==='completed'){await saveCameraSession(id,{source:'servidor',reps:r.reps||0,form_score:r.avg_form_score??null}).catch(()=>{});notify(`Análise concluída: ${r.reps} repetições.`)}
        else if(r.status==='error')notify(r.error||'Falha na análise.',true);
        else setTimeout(poll,1500)};
      poll();
    }catch(e){setServer(null);notify(e.message,true)}
  }

  if(loadErr)return <><button className="text-link" onClick={()=>nav('/treinos')}><ArrowLeft size={17}/>Voltar aos treinos</button><p className="error">{loadErr}</p></>;
  if(!def||!ex)return <Loading label="Carregando exercício…"/>;
  const name=ex.name||def.display_name||id;const target=ex.reps||def.default_reps||10;const isHold=def.type==='duration';
  const st=stats||{count:0,left:0,right:0,score:null,feedback:[],duration:0};
  const tip=st.feedback?.find(f=>f.severity!=='info')||st.feedback?.[0];

  return <>
    <button className="text-link" onClick={()=>nav(-1)}><ArrowLeft size={17}/>Voltar</button>
    <PageTitle title={name} subtitle={`${(ex.target_muscles||[]).join(', ')||'Exercício'} · ${isHold?`${def.target_duration||30}s por série`:`${ex.sets||3} séries de ${target} repetições`}`} action={<Badge>Análise de pose</Badge>}/>
    <div className="camera-layout"><div>
      <div className="camera-stage">
        <video ref={video} playsInline muted className="cam-source"/>
        <canvas ref={canvas} className="cam-canvas" style={{transform:source==='camera'&&front?'scaleX(-1)':'none',visibility:source?'visible':'hidden'}}/>
        {!source&&<div className="camera-placeholder">
          {boot?<><LoaderCircle className="spin" size={44}/><h2>{boot}</h2><p>Na primeira vez pode levar alguns segundos.</p></>
          :<><CameraIcon size={54}/><h2>Encontre seu enquadramento.</h2><p>Deixe o corpo inteiro visível e a câmera estável.</p>
            <div className="cam-start"><Button variant="light" onClick={()=>startCamera()}><CameraIcon size={17}/>Usar câmera</Button><Button variant="secondary" onClick={()=>fileInput.current.click()}><Film size={17}/>Usar um vídeo</Button></div></>}
        </div>}
        {source&&<div className="camera-metrics">
          <div><small>{isHold?'TEMPO':'REPETIÇÕES'}</small><strong>{isHold?Math.floor(st.duration):st.count}<small>/{isHold?(def.target_duration||30)+'s':target}</small></strong>{def.bilateral&&<span className="cam-sides">E {st.left} · D {st.right}</span>}</div>
          <div><small>FORMA</small><strong>{st.score??'—'}<small>{st.grade?' '+st.grade:''}</small></strong></div>
        </div>}
        {source&&tip&&status==='running'&&<div className={'cam-tip is-'+tip.severity}>{tip.message}</div>}
        {source&&<div className="camera-bottom"><span><Activity size={16}/>{status==='running'?(STATE_PT[st.state]||st.state||'Procurando você…'):status==='paused'?'Pausado':status==='stopped'?'Encerrado':'Pronto para começar'}</span><b>{source==='camera'?fmt(elapsed):fmt(video.current?.currentTime||0)}</b></div>}
      </div>
      <input ref={fileInput} hidden type="file" accept="video/*" onChange={pickVideo}/>
      {err&&<p className="error" role="alert">{err}</p>}
      {source&&<div className="camera-controls">
        <Button onClick={toggle} disabled={status==='stopped'&&source==='camera'}>{status==='running'?<Pause size={18}/>:<Play size={18}/>} {status==='running'?'Pausar':status==='paused'?'Continuar':source==='video'?'Analisar vídeo':'Iniciar'}</Button>
        <Button variant="danger" disabled={status==='idle'||status==='stopped'} onClick={finish}><Square size={17}/>Parar</Button>
        {source==='camera'&&<button className="icon-button" aria-label="Trocar câmera" onClick={()=>{setFront(!front);startCamera(!front)}}><SwitchCamera size={22}/></button>}
        <button className="icon-button" aria-label="Zerar sessão" onClick={()=>{reset();if(source==='video')video.current.currentTime=0}}><RotateCcw size={21}/></button>
        <button className="icon-button" aria-label={source==='camera'?'Usar um vídeo':'Trocar vídeo'} onClick={()=>fileInput.current.click()}><Upload size={20}/></button>
      </div>}
      {result&&<Card className="session-result">
        <h2><CheckCircle/> Sessão encerrada</h2>
        <div className="stats-grid">
          <div><strong>{isHold?Math.round(result.best)+'s':result.reps}</strong><p>{isHold?'Melhor tempo':'Repetições'}{def.bilateral?` (E ${result.left} · D ${result.right})`:''}</p></div>
          <div><strong>{result.score??'—'}{result.grade?' '+result.grade:''}</strong><p>Forma</p></div>
          <div><strong>{fmt(result.secs)}</strong><p>Tempo ativo</p></div>
        </div>
        <p className="small muted" style={{margin:0}}>{result.saving?'Salvando sessão…':result.saved?'✓ Sessão salva no seu histórico.':result.reps>0||result.best>0?'A sessão não foi salva.':'Nenhuma repetição detectada, então nada foi salvo.'}</p>
      </Card>}
      {source==='video'&&<Card className="server-analysis">
        <div className="section-heading"><div><h2>Vídeo analisado</h2><p>Gere no servidor um vídeo com o esqueleto desenhado, para guardar ou compartilhar.</p></div><Server size={22}/></div>
        {!server?<Button variant="secondary" className="full" onClick={serverAnalyze}><Server size={17}/>Gerar vídeo analisado</Button>
        :server.status==='completed'?<><video className="server-video" src={server.output_video} controls playsInline/><p className="small"><b>{server.reps} repetições</b> detectadas · forma {server.avg_form_score??'—'}</p></>
        :server.status==='error'?<p className="error">{server.error||'Falha na análise.'}</p>
        :<><div className="row between small"><span>{server.status==='uploading'?'Enviando vídeo…':'Analisando quadro a quadro…'}</span><span>{server.progress||0}%</span></div><progress max="100" value={server.progress||0}/></>}
      </Card>}
    </div><aside>
      <Card><h2>Sobre o exercício</h2><p>{ex.description||def.description||`Acompanhamento de ${name.toLowerCase()}.`}</p>
        {(ex.target_muscles||[]).length>0&&<><h3>Músculos em foco</h3><div className="chips">{ex.target_muscles.map(m=><Badge key={m}>{m}</Badge>)}</div></>}
        <h3>Como funciona</h3><p>A análise roda no seu aparelho: a imagem da câmera não é enviada para nenhum servidor. Só o vídeo que você mandar para "Gerar vídeo analisado" sai do aparelho.</p></Card>
      <Card className="orange-card"><CameraIcon size={30}/><h3>Espaço para se mover.</h3><p>Câmera estável, de lado ou de frente, com todo o corpo visível e boa luz.</p></Card>
    </aside></div>
  </>;
}
