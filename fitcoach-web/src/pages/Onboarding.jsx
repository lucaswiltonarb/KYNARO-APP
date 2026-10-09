import React,{useEffect,useRef,useState} from 'react';
import {Navigate,useNavigate} from 'react-router-dom';
import {ChevronLeft,ChevronRight,SkipForward,Leaf,Zap,Flame,Rocket,CalendarDays,Repeat,Ban,Building2,Dumbbell,House,PersonStanding,CircleCheck,TriangleAlert,Timer,Sparkles,Settings,RefreshCw,Pin,Minus,Plus,Search,Info,Target,TrendingDown,Activity,Weight,Layers,Cable,Cog,Bike,Salad,Check,Clock,Trophy} from 'lucide-react';
import {useApp} from '../context';
import {submitOnboarding,generateWorkout,generateNutrition,jp} from '../api';
import {Logo} from '../components/ui';
import figure from '../assets/body-figure.svg';
import hero from '../assets/training.webp';
import '../styles/onboarding.css';

const Mars=()=><span className="ob-sym">♂</span>;const Venus=()=><span className="ob-sym">♀</span>;
const GENDER=[['masculino','Masculino','',Mars],['feminino','Feminino','',Venus]];
const GOALS=[['emagrecimento','Perder peso','Queimar gordura com segurança',TrendingDown],['hipertrofia','Ganhar músculos','Mais massa e volume muscular',Dumbbell],['definir','Definir o corpo','Menos gordura, mais definição',Flame],['performance','Ficar mais forte','Aumentar suas cargas e potência',Zap],['condicionamento','Melhorar condicionamento','Mais fôlego e disposição',Activity]];
const EXP=[['iniciante','Iniciante','Menos de 1 ano',Leaf],['intermediario','Intermediário','1–2 anos',Zap],['avancado','Avançado','2–4 anos',Flame],['especialista','Especialista','4+ anos',Rocket]];
const FREQ=[['regular','Regularmente','Pelo menos 2 vezes por semana',CalendarDays],['inconsistente','Inconsistentemente','Algumas semanas sim e outras não',Repeat],['nunca','Nunca','Estou há mais de 6 meses sem treinar',Ban]];
const LOC=[['academia_grande','Academia grande','Totalmente equipada com máquinas, cabos e pesos',Building2],['academia_pequena','Academia pequena','Halteres, barras e equipamentos básicos',Dumbbell],['casa','Academia em casa','Halteres, faixa elástica e barra fixa',House],['peso_corporal','Peso corporal','Sem equipamentos, só o peso do corpo',PersonStanding]];
const EQUIP=[['Pesos livres',Dumbbell,['Halteres','Kettlebells','Anilhas']],['Barras',Weight,['Barra olímpica','Barra W','Barra reta','Barra hexagonal','Barra fixa']],['Bancos e racks',Layers,['Banco reto','Banco regulável','Banco Scott','Banco romano','Rack de agachamento','Máquina Smith','Paralelas']],['Máquinas de cabo',Cable,['Crossover','Polia regulável','Puxador alto','Remada baixa']],['Máquinas',Cog,['Leg press 45°','Cadeira extensora','Cadeira flexora','Mesa flexora','Cadeira abdutora','Cadeira adutora','Agachamento hack','Peck deck (voador)','Supino máquina','Desenvolvimento máquina','Remada máquina','Panturrilha máquina','Rosca Scott máquina','Tríceps máquina','Abdominal máquina','Barra fixa assistida']],['Cardio e outros',Bike,['Esteira','Bicicleta ergométrica','Elíptico','Escada','Remo','Faixa elástica','Bola de pilates','Bosu','Caixa (box)','Corda de pular','Rodinha abdominal','Step','Tapete de yoga']]];
const ALL_EQUIP=EQUIP.flatMap(c=>c[2]);
const PRESET={academia_grande:ALL_EQUIP,academia_pequena:['Halteres','Kettlebells','Anilhas','Barra olímpica','Barra W','Barra reta','Barra fixa','Banco reto','Banco regulável','Rack de agachamento','Polia regulável','Esteira','Bicicleta ergométrica','Faixa elástica','Tapete de yoga'],casa:['Halteres','Barra fixa','Banco regulável','Faixa elástica','Tapete de yoga'],peso_corporal:['Tapete de yoga']};
const AREAS=[['Ombros',100,100],['Costas',100,150],['Peito',100,125],['Joelhos',100,348],['Quadríceps',100,300],['Trapézio',100,82],['Lombar',100,205],['Panturrilhas',100,392],['Bíceps',46,150],['Punhos',28,240]];
const FOCUS=[['Corpo inteiro',[]],['Ombros',[[62,96],[138,96]]],['Braços',[[40,152],[160,152]]],['Peito',[[84,122],[116,122]]],['Abdômen',[[100,182]]],['Costas',[[70,150],[130,150]]],['Glúteos',[[88,246],[112,246]]],['Pernas',[[80,318],[120,318],[78,392],[122,392]]]];
const DIET=['Sem restrições','Vegetariano','Vegano','Sem lactose','Sem glúten','Low carb'];
const MODE=[['ia','Plano inteligente','Personalizado pela IA com base nas suas respostas',Sparkles,true],['manual','Montar depois','Comece sem plano e gere quando quiser na aba Treinos',Settings]];
const DUR=[['rapido','Rápido','Até 20 min',Timer],['curto','Curto','20–40 min',Timer],['medio','Médio','40–60 min',Timer,true],['longo','Longo','60+ min',Timer]];
const RENEW=[['equilibrado','Equilibrado','Exercícios renovados a cada 6 semanas',Pin,true],['variado','Variado','Exercícios renovados a cada 2 semanas',RefreshCw],['fixo','Fixo','Seu plano não muda e não expira',Pin]];
const FLOW=['gender','goal','experience','frequency','location','i_plan','equipment','injuries','focus','age','height','weight','target','i_forecast','diet','mode','duration','renew','days','i_potential','review','loading','ready'];
const NUMBERED=FLOW.filter(s=>!/^i_|review|loading|ready/.test(s));
const SKIPPABLE=['equipment','focus','target'];
const label=(list,v)=>list.find(x=>x[0]===v)?.[1];
const bmi=(w,h)=>w/((h/100)**2);
const bmiInfo=b=>b<18.5?['Abaixo do peso','#60a5fa']:b<25?['Peso saudável','#4ade80']:b<30?['Sobrepeso','#facc15']:['Obesidade','#f87171'];
const LB=2.20462;

export default function Onboarding(){
  const {user,refreshUser,notify}=useApp();const nav=useNavigate();
  const [i,setI]=useState(0);const [dir,setDir]=useState(1);
  const [a,setA]=useState({gender:null,goal:null,experience:null,frequency:null,location:null,equipment:[],equipTouched:false,hasInjury:null,injuries:[],focus:[],age:28,height:175,weight:80,target:null,diet:'Sem restrições',mode:null,duration:null,renew:null,days:null});
  const [units,setUnits]=useState({w:'kg',h:'cm'});const [result,setResult]=useState(null);
  if(!user)return <Navigate to="/login"/>;
  const step=FLOW[i];const set=(k,v)=>setA(x=>({...x,[k]:v}));
  const go=n=>{setDir(n>i?1:-1);setI(n);window.scrollTo(0,0)};
  const next=()=>go(Math.min(i+1,FLOW.length-1));
  const back=()=>{if(step==='injuries'&&a.hasInjury){set('hasInjury',null);return}go(Math.max(0,i-1))};
  const pick=(k,v,extra)=>{setA(x=>({...x,[k]:v,...(extra?extra(x,v):{})}));setTimeout(next,230)};
  const recDays=a.frequency==='nunca'||a.experience==='iniciante'?3:a.experience==='intermediario'?4:5;
  const target=a.target??defaultTarget(a);const curBmi=bmi(a.weight,a.height);
  const num=NUMBERED.indexOf(step);const pct=Math.min(1,i/(FLOW.indexOf('review')));
  const showHeader=!['loading','ready'].includes(step);

  return <div className="ob">
    {showHeader&&<header className="ob-top">
      <button className="ob-round" onClick={back} disabled={i===0} aria-label="Voltar"><ChevronLeft size={22}/></button>
      <span className="ob-count">{num>=0?`${num+1}/${NUMBERED.length}`:''}</span>
      {SKIPPABLE.includes(step)?<button className="ob-skip" onClick={()=>{if(step==='target')set('target',a.weight);next()}}>PULAR <SkipForward size={15} fill="currentColor"/></button>:<span className="ob-round-spacer"/>}
    </header>}
    {showHeader&&step!=='review'&&<div className="ob-progress" aria-hidden>{NUMBERED.map((_,k)=><span key={k} className={k<Math.round(pct*NUMBERED.length)?'on':''}/>)}</div>}
    <main key={step+(step==='injuries'?String(a.hasInjury):'')} className={'ob-body '+(dir>0?'in-r':'in-l')}>
      {step==='gender'&&<Choices title="Como você se identifica?" sub="Usamos isso para calcular suas calorias e cargas." items={GENDER} value={a.gender} onPick={v=>pick('gender',v)}/>}
      {step==='goal'&&<Choices title="Qual é o seu objetivo atual?" items={GOALS} value={a.goal} onPick={v=>pick('goal',v,(x,g)=>({target:null}))} big/>}
      {step==='experience'&&<Choices title="Qual é a sua experiência com treino de força?" items={EXP} value={a.experience} onPick={v=>pick('experience',v)}/>}
      {step==='frequency'&&<Choices title="Com que frequência você treina?" items={FREQ} value={a.frequency} onPick={v=>pick('frequency',v)}/>}
      {step==='location'&&<Choices title="Onde você treina atualmente?" items={LOC} value={a.location} onPick={v=>pick('location',v,(x,l)=>x.equipTouched?{}:{equipment:[...PRESET[l]]})}/>}
      {step==='i_plan'&&<PlanCompare onNext={next}/>}
      {step==='equipment'&&<Equipment value={a.equipment} onChange={v=>setA(x=>({...x,equipment:v,equipTouched:true}))} onNext={next}/>}
      {step==='injuries'&&(a.hasInjury?<InjuryGrid value={a.injuries} onChange={v=>set('injuries',v)} onNext={next}/>
        :<Choices title="Você tem alguma lesão ativa?" sub="Vamos adaptar seu plano para proteger as áreas sensíveis." items={[['nao','Sem lesões','Treinar sem restrições',CircleCheck],['sim','Sim, tenho algumas','Escolha as áreas a seguir',TriangleAlert]]} value={a.hasInjury===false?'nao':null} onPick={v=>v==='nao'?pick('hasInjury',false,()=>({injuries:[]})):set('hasInjury',true)}/>)}
      {step==='focus'&&<Focus value={a.focus} onChange={v=>set('focus',v)} onNext={next}/>}
      {step==='age'&&<Screen title="Qual a sua idade?" onNext={next}><Wheel min={14} max={90} value={a.age} onChange={v=>set('age',v)} unit="anos"/></Screen>}
      {step==='height'&&<Screen title="Qual a sua altura?" onNext={next}>
        <UnitToggle options={[['cm','CM'],['ft','FT/IN']]} value={units.h} onChange={h=>setUnits(u=>({...u,h}))}/>
        {units.h==='cm'?<><BigValue value={a.height} unit="cm"/><Ruler key="cm" min={120} max={230} step={1} labelEvery={10} value={a.height} onChange={v=>set('height',v)}/></>
          :<><BigValue value={`${Math.floor(a.height/2.54/12)}'${Math.round(a.height/2.54%12)}"`} unit=""/><Ruler key="in" min={48} max={90} step={1} labelEvery={12} fmt={v=>`${Math.floor(v/12)}'`} value={Math.round(a.height/2.54)} onChange={v=>set('height',Math.round(v*2.54))}/></>}
      </Screen>}
      {step==='weight'&&<Screen title="Qual o seu peso?" onNext={next}>
        <WeightPicker units={units} setUnits={setUnits} value={a.weight} onChange={v=>set('weight',v)}/>
        <InfoCard icon={<Trophy size={22}/>}>Seu IMC é de <b style={{color:bmiInfo(curBmi)[1]}}>{curBmi.toFixed(1).replace('.',',')}</b> ({bmiInfo(curBmi)[0].toLowerCase()}). Já deu o primeiro passo, agora é treinar com foco e constância.</InfoCard>
      </Screen>}
      {step==='target'&&<Screen title="Qual é a sua meta de peso?" onNext={()=>{set('target',target);next()}}>
        <WeightPicker units={units} setUnits={setUnits} value={target} onChange={v=>set('target',v)} band={a.weight}/>
        <TargetCard weight={a.weight} target={target}/>
      </Screen>}
      {step==='i_forecast'&&<Forecast weight={a.weight} target={target} onNext={next}/>}
      {step==='diet'&&<Choices title="Alguma restrição alimentar?" sub="Vamos considerar isso no seu cardápio." items={DIET.map(d=>[d,d,'',d==='Sem restrições'?CircleCheck:Salad])} value={a.diet} onPick={v=>pick('diet',v)}/>}
      {step==='mode'&&<Choices title="Como você deseja configurar seus treinos?" sub="Isso pode ser alterado a qualquer momento." items={MODE} value={a.mode} onPick={v=>pick('mode',v)}/>}
      {step==='duration'&&<Choices title="Qual é o tempo ideal de treino pra você?" items={DUR} value={a.duration} onPick={v=>pick('duration',v)}/>}
      {step==='renew'&&<Choices title="Com que frequência renovar seu plano?" sub="Defina a frequência ideal para renovar os exercícios do seu plano." items={RENEW} value={a.renew} onPick={v=>pick('renew',v)}/>}
      {step==='days'&&<Screen title="Com que frequência você gostaria de treinar?" onNext={()=>{if(a.days==null)set('days',recDays);next()}}>
        <div className="ob-stepper"><button onClick={()=>set('days',Math.max(1,(a.days??recDays)-1))} aria-label="Menos dias"><Minus size={24}/></button><strong>{a.days??recDays}</strong><button onClick={()=>set('days',Math.min(7,(a.days??recDays)+1))} aria-label="Mais dias"><Plus size={24}/></button></div>
        <p className="ob-stepper-unit">dias por semana</p>
        <div className="ob-info ob-rec"><p>Recomendamos <b>{recDays} dias de treino por semana</b> com base no seu objetivo, nível e frequência atual.</p><div className="ob-tags"><span><Flame size={14}/>{label(EXP,a.experience)||'Nível'}</span><span><Target size={14}/>{label(GOALS,a.goal)||'Objetivo'}</span><Sparkles size={18} className="ob-spark"/></div></div>
      </Screen>}
      {step==='i_potential'&&<div className="ob-hero"><img src={hero} alt=""/><div className="ob-hero-fade"/><h1>DESCUBRA TODO<br/>O SEU POTENCIAL.</h1><Cta onClick={next}>Próximo</Cta></div>}
      {step==='review'&&<Review a={{...a,days:a.days??recDays,target}} onEdit={k=>go(FLOW.indexOf(k))} onCreate={next}/>}
      {step==='loading'&&<Loader a={{...a,days:a.days??recDays,target}} user={user} onDone={r=>{setResult(r);next()}} notify={notify}/>}
      {step==='ready'&&<Ready result={result} a={{...a,days:a.days??recDays}} onStart={async()=>{await refreshUser();nav('/',{replace:true})}}/>}
    </main>
  </div>;
}

function defaultTarget(a){const w=a.weight;return a.goal==='emagrecimento'||a.goal==='definir'?Math.round(w*0.92):a.goal==='hipertrofia'?Math.round(w+3):w}

function Cta({children,onClick,disabled}){return <div className="ob-cta-wrap"><button className="ob-cta" disabled={disabled} onClick={onClick}>{children}</button></div>}
function Screen({title,sub,children,onNext,cta='Próximo',disabled}){return <><h1 className="ob-title">{title}</h1>{sub&&<p className="ob-sub">{sub}</p>}<div className="ob-screen">{children}</div><Cta onClick={onNext} disabled={disabled}>{cta}</Cta></>}

function Choices({title,sub,items,value,onPick,big}){
  return <><h1 className="ob-title">{title}</h1>{sub&&<p className="ob-sub">{sub}</p>}
    <div className="ob-choices">{items.map(([v,l,d,Icon,rec])=><button key={v} className={'ob-card'+(value===v?' selected':'')+(big?' big':'')} onClick={()=>onPick(v)} aria-pressed={value===v}>
      {rec&&<span className="ob-rec-badge">RECOMENDADO</span>}
      <span className="ob-icon">{Icon&&<Icon size={big?26:22}/>}</span>
      <span className="ob-card-text"><strong>{l}</strong>{d&&<small>{d}</small>}</span>
      <ChevronRight size={20} className="ob-chev"/>
    </button>)}</div></>;
}

function PlanCompare({onNext}){
  return <><div className="ob-center"><h2>Treinar com plano muda tudo.</h2><p>Com um plano feito para você, cada treino tem propósito, carga certa e progressão.</p></div>
    <div className="ob-bars"><div className="ob-bar off"><small>SEM PLANO</small><div><span>Treinos improvisados</span></div></div><div className="ob-bar on"><span className="ob-brand"><Logo/></span><div><span>Progressão planejada</span></div></div></div>
    <p className="ob-tagline">CONSTÂNCIA E EVOLUÇÃO EM CADA TREINO.</p><Cta onClick={onNext}>Próximo</Cta></>;
}

function Toggle({on,onClick,label}){return <button className={'ob-switch'+(on?' on':'')} role="switch" aria-checked={on} aria-label={label} onClick={onClick}><span/></button>}

function Equipment({value,onChange,onNext}){
  const [q,setQ]=useState('');const has=n=>value.includes(n);
  const flip=n=>onChange(has(n)?value.filter(x=>x!==n):[...value,n]);
  const norm=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  return <><h1 className="ob-title">Quais equipamentos você tem à disposição?</h1><p className="ob-sub">Isso pode ser alterado a qualquer momento.</p>
    <label className="ob-search"><Search size={20}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Pesquisar"/></label>
    {EQUIP.map(([cat,Icon,items])=>{const shown=items.filter(n=>norm(n).includes(norm(q)));if(!shown.length)return null;const count=items.filter(has).length;const all=count===items.length;
      return <section key={cat} className="ob-equip"><div className="ob-equip-head"><strong>{cat.toUpperCase()}</strong>{count>0&&<span className="ob-badge">{count}</span>}<button onClick={()=>onChange(all?value.filter(x=>!items.includes(x)):[...new Set([...value,...items])])}>{all?'Desmarcar todos':'Selecionar todos'}</button></div>
        {shown.map(n=><div key={n} className="ob-equip-row"><span className="ob-icon sm"><Icon size={20}/></span><span>{n}</span><Toggle on={has(n)} onClick={()=>flip(n)} label={n}/></div>)}
      </section>})}
    <Cta onClick={onNext}>Próximo</Cta></>;
}

function AreaThumb({x,y,size=60}){const s=.62;return <span className="ob-thumb" style={{width:size,height:size,backgroundImage:`url(${figure})`,backgroundSize:`${200*s}px ${450*s}px`,backgroundPosition:`${size/2-x*s}px ${size/2-y*s}px`}}/>}

function InjuryGrid({value,onChange,onNext}){
  return <><h1 className="ob-title">Você tem alguma lesão ativa?</h1><p className="ob-sub">Selecione as áreas com dor ou limitação. Vamos adaptar seu plano para evitar sobrecarga.</p>
    <div className="ob-grid">{AREAS.map(([n,x,y])=>{const on=value.includes(n);return <button key={n} className={'ob-area'+(on?' selected':'')} onClick={()=>onChange(on?value.filter(v=>v!==n):[...value,n])} aria-pressed={on}><span className="ob-check">{on&&<Check size={14}/>}</span><AreaThumb x={x} y={y}/><span>{n}</span></button>})}</div>
    <div className="ob-info ob-note"><Info size={20}/><p>As adaptações são preventivas e não substituem avaliação médica.</p></div>
    <Cta onClick={onNext} disabled={!value.length}>Próximo</Cta></>;
}

function Focus({value,onChange,onNext}){
  const parts=FOCUS.slice(1).map(f=>f[0]);const all=parts.every(p=>value.includes(p));
  const flip=n=>{if(n==='Corpo inteiro'){onChange(all?[]:parts);return}onChange(value.includes(n)?value.filter(v=>v!==n):[...value,n])};
  const dots=FOCUS.slice(1).filter(f=>value.includes(f[0])).flatMap(f=>f[1]);
  return <><h1 className="ob-title">Qual região do corpo você quer focar?</h1>
    <div className="ob-focus"><div className="ob-focus-list">{FOCUS.map(([n])=>{const on=n==='Corpo inteiro'?all:value.includes(n);return <button key={n} className={on?'selected':''} onClick={()=>flip(n)} aria-pressed={on}>{n}</button>})}</div>
      <div className={'ob-figure'+(value.length?' lit':'')+(all?' all':'')}><img src={figure} alt="Silhueta do corpo"/>{dots.map(([x,y],k)=><span key={k} className="ob-dot" style={{left:x/2+'%',top:y/4.5+'%'}}/>)}</div></div>
    <Cta onClick={onNext}>Próximo</Cta></>;
}

function Wheel({min,max,value,onChange,unit}){
  const ref=useRef();const H=60;const [cur,setCur]=useState(value);
  useEffect(()=>{ref.current.scrollTop=(value-min)*H},[]);
  return <div className="ob-wheel"><div className="ob-wheel-band"/><div className="ob-wheel-list" ref={ref} onScroll={e=>{const v=Math.min(max,Math.max(min,min+Math.round(e.currentTarget.scrollTop/H)));if(v!==cur){setCur(v);onChange(v)}}}>
    {Array.from({length:max-min+1},(_,k)=>min+k).map(n=>{const d=Math.abs(n-cur);return <div key={n} className="ob-wheel-item" style={{opacity:Math.max(.08,1-d*.27),transform:`scale(${Math.max(.55,1-d*.13)})`}} onClick={()=>ref.current.scrollTo({top:(n-min)*H,behavior:'smooth'})}>{n}{n===cur&&<small>{unit}</small>}</div>})}
  </div></div>;
}

function Ruler({min,max,step,value,onChange,labelEvery=10,fmt=v=>v,band}){
  const ref=useRef();const W=12;const n=Math.round((max-min)/step);const idx=v=>Math.round((v-min)/step);
  useEffect(()=>{ref.current.scrollLeft=idx(value)*W},[]);
  const lo=band!=null?Math.min(idx(band),idx(value)):-1,hi=band!=null?Math.max(idx(band),idx(value)):-1;
  return <div className="ob-ruler"><span className="ob-ruler-mark"/><div className="ob-ruler-track" ref={ref} onScroll={e=>{const v=+(min+Math.round(e.currentTarget.scrollLeft/W)*step).toFixed(2);if(v>=min&&v<=max&&v!==value)onChange(v)}}>
    <span className="ob-ruler-pad"/>{Array.from({length:n+1},(_,k)=>{const major=k%labelEvery===0,mid=k%(labelEvery/2)===0;return <span key={k} className={'ob-tick'+(major?' major':mid?' mid':'')+(k>=lo&&k<=hi&&band!=null?' band':'')}>{major&&<em>{fmt(+(min+k*step).toFixed(1))}</em>}</span>})}<span className="ob-ruler-pad"/>
  </div></div>;
}

function UnitToggle({options,value,onChange}){return <div className="ob-units">{options.map(([v,l])=><button key={v} className={value===v?'on':''} onClick={()=>onChange(v)}>{l}</button>)}</div>}
function BigValue({value,unit}){return <div className="ob-big"><strong>{value}</strong>{unit&&<span>{unit}</span>}</div>}
function InfoCard({icon,children}){return <div className="ob-info"><span className="ob-info-icon">{icon}</span><p>{children}</p></div>}

function WeightPicker({units,setUnits,value,onChange,band}){
  const lb=units.w==='lb';
  return <><UnitToggle options={[['kg','KG'],['lb','LB']]} value={units.w} onChange={w=>setUnits(u=>({...u,w}))}/>
    <BigValue value={lb?Math.round(value*LB):String(value).replace('.',',')} unit={lb?'lb':'kg'}/>
    {lb?<Ruler key="lb" min={66} max={550} step={1} labelEvery={10} value={Math.round(value*LB)} band={band!=null?Math.round(band*LB):undefined} onChange={v=>onChange(+(v/LB).toFixed(1))}/>
      :<Ruler key="kg" min={30} max={250} step={0.5} labelEvery={10} fmt={v=>Math.round(v)} value={value} band={band} onChange={onChange}/>}</>;
}

function TargetCard({weight,target}){
  const p=Math.round((target-weight)/weight*100);
  if(!p)return <InfoCard icon={<Target size={22}/>}>Manter o peso e melhorar a composição corporal: menos gordura, mais músculo.</InfoCard>;
  const lose=p<0;const msg=Math.abs(p)<=5?'Uma meta realista para começar com consistência.':Math.abs(p)<=10?'Uma jornada desafiadora que vai transformar seu corpo e sua confiança.':'Uma grande transformação. Vamos dividir em etapas para chegar lá.';
  return <InfoCard icon={<Flame size={22}/>}><span className="ob-info-title">Você vai {lose?'perder':'ganhar'} <b className="ob-hl">{lose?'':'+'}{p}%</b> do seu peso</span>{msg}</InfoCard>;
}

function weeksTo(weight,target){const d=target-weight;return d<0?Math.ceil(-d/0.5):d>0?Math.ceil(d/0.25):0}
function Forecast({weight,target,onNext}){
  const w=weeksTo(weight,target);const date=new Date(Date.now()+w*7*864e5);const ds=date.toLocaleDateString('pt-BR',{day:'2-digit',month:'long'});
  const lose=target<weight;const path=lose?'M10 20 C 80 110, 160 140, 290 150':'M10 150 C 80 60, 160 30, 290 20';
  return <><div className="ob-center"><h2>{w?<>Estimamos que você estará pesando <b className="ob-hl">{String(target).replace('.',',')}kg</b> até <b className="ob-hl">{ds}</b></>:<>Vamos manter seus <b className="ob-hl">{weight}kg</b> com mais músculo e menos gordura</>}</h2></div>
    <svg className="ob-chart" viewBox="0 0 300 190" role="img" aria-label="Projeção de peso">
      <defs><linearGradient id="obg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FF6A00" stopOpacity=".45"/><stop offset="1" stopColor="#FF6A00" stopOpacity="0"/></linearGradient></defs>
      <path d={(w?path:'M10 90 C 100 85, 200 95, 290 90')+' L290 180 L10 180 Z'} fill="url(#obg)"/><path d={w?path:'M10 90 C 100 85, 200 95, 290 90'} fill="none" stroke="#fff" strokeWidth="3"/>
      <circle cx="10" cy={w?(lose?20:150):90} r="6" fill="#fff"/><circle cx="290" cy={w?(lose?150:20):90} r="6" fill="#fff"/>
    </svg>
    <div className="ob-chart-axis"><span>Hoje</span><span>{w?date.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sempre'}</span></div>
    <InfoCard icon={<Target size={22}/>}>{lose?'Estimativa com um ritmo seguro de ~0,5 kg por semana.':w?'Estimativa com ganho limpo de ~0,25 kg por semana.':'O foco é recomposição corporal.'} O resultado real depende da sua constância.</InfoCard>
    <Cta onClick={onNext}>Próximo</Cta></>;
}

function Review({a,onEdit,onCreate}){
  const now=bmi(a.weight,a.height),then=bmi(a.target,a.height);const w=weeksTo(a.weight,a.target);
  const rows=[['experience',Flame,label(EXP,a.experience)||'—','Nível'],['goal',Target,label(GOALS,a.goal)||'—','Objetivo'],['location',Building2,label(LOC,a.location)||'—','Local'],['days',CalendarDays,`${a.days} dias por semana`,'Frequência de treino'],['duration',Clock,`${label(DUR,a.duration)||'—'} · ${DUR.find(d=>d[0]===a.duration)?.[2]||''}`,'Duração'],['focus',Activity,a.focus.length?a.focus.join(' · '):'Corpo inteiro','Foco muscular'],['injuries',TriangleAlert,a.injuries.length?a.injuries.join(' · '):'Nenhuma relatada','Lesões'],['equipment',Dumbbell,`${a.equipment.length} equipamentos`,'Equipamentos'],['diet',Salad,a.diet,'Alimentação']];
  const pos=b=>Math.min(100,Math.max(0,(b-15)/(40-15)*100));
  return <><h1 className="ob-title">Consistência é o que te separa do seu objetivo!</h1>
    <div className="ob-panel"><small className="ob-panel-label">IMC</small><div className="ob-arrow"><div><strong>{now.toFixed(1).replace('.',',')}</strong><span>Atual</span></div><ChevronRight size={22}/><div><strong>{then.toFixed(1).replace('.',',')}</strong><span>{w?`Na meta (~${Math.max(1,Math.round(w/4.3))} ${Math.round(w/4.3)>1?'meses':'mês'})`:'Na meta'}</span></div></div>
      <div className="ob-scale"><span className="ob-scale-dot goal" style={{left:pos(then)+'%'}}/><span className="ob-scale-dot now" style={{left:pos(now)+'%'}}/></div><div className="ob-scale-legend"><span>Abaixo</span><span>Saudável</span><span>Sobrepeso</span><span>Obesidade</span></div></div>
    <div className="ob-divider"><span>REVISE SEU PLANO</span></div>
    <div className="ob-review">{rows.map(([k,Icon,v,l])=><button key={k} onClick={()=>onEdit(k)}><span className="ob-icon sm"><Icon size={20}/></span><span><strong>{v}</strong><small>{l}</small></span><ChevronRight size={18}/></button>)}</div>
    <Cta onClick={onCreate}>Criar meu plano</Cta></>;
}

const LOAD_MSGS=[[0,'Analisando seu perfil e suas medidas'],[25,'Definindo sua meta'],[45,'Escolhendo exercícios para seus equipamentos'],[70,'Montando sua semana de treinos'],[88,'Preparando seu cardápio']];
function Loader({a,user,onDone,notify}){
  const [p,setP]=useState(0);const job=useRef(null);
  useEffect(()=>{
    const t=setInterval(()=>setP(x=>x<92?x+Math.max(.4,(92-x)/40):x),120);
    job.current??=(async()=>{
      const act=a.days<=2?'leve':a.days===3?'moderado':a.days<=5?'intenso':'extremo';
      const onboarding={gender:a.gender,goal:a.goal,experience:a.experience,experience_label:`${label(EXP,a.experience)} (${EXP.find(e=>e[0]===a.experience)?.[2]})`,frequency:label(FREQ,a.frequency),location:a.location,location_label:label(LOC,a.location),equipment:a.equipment,injuries:a.injuries,focus:a.focus,diet:a.diet,plan_mode:a.mode,duration:a.duration,duration_label:`${label(DUR,a.duration)} (${DUR.find(d=>d[0]===a.duration)?.[2]})`,renew:a.renew,days_per_week:a.days,target_weight:a.target};
      await submitOnboarding({name:user.name,age:a.age,gender:a.gender||'masculino',height_cm:a.height,weight_kg:a.weight,goal:a.goal||'condicionamento',activity_level:act,injuries:JSON.stringify(a.injuries.length?a.injuries:['Nenhuma']),dietary_restrictions:a.diet==='Sem restrições'?'nenhuma':a.diet,target_weight:a.target,onboarding});
      if(a.mode!=='ia')return {skipped:true};
      const [w,n]=await Promise.allSettled([generateWorkout(),generateNutrition()]);
      return {workout:w.value?.plan,nutrition:n.value?.plan,error:w.reason?.message||n.reason?.message};
    })();
    job.current.then(r=>{clearInterval(t);setP(100);setTimeout(()=>onDone(r),600)}).catch(e=>{clearInterval(t);notify(e.message,true);setP(0)});
    return()=>clearInterval(t);
  },[]);
  const msg=[...LOAD_MSGS].reverse().find(m=>p>=m[0])[1];
  return <div className="ob-loader"><div className="ob-orbit"><span/><span/><span/><div className="ob-orbit-core"><Logo/></div></div>
    <h2>Criando seu plano personalizado</h2>
    <div className="ob-load-foot"><strong>{Math.round(p)}%</strong><span>{msg}</span></div><div className="ob-load-bar"><span style={{width:p+'%'}}/></div></div>;
}

function Ready({result,a,onStart}){
  const days=jp(result?.workout?.data,{})?.days?.filter(d=>d.exercises?.length)||[];const first=days[0];
  const kcal=result?.nutrition?.total_calories;
  return <div className="ob-ready"><h1 className="ob-title ob-center-t">Seu plano personalizado está <span className="ob-hl">pronto</span>!</h1>
    {result?.skipped?<p className="ob-sub ob-center-t">Você escolheu montar depois. Quando quiser, gere seu plano na aba Treinos.</p>
    :result?.error&&!days.length?<p className="ob-sub ob-center-t">Seu perfil foi salvo, mas não foi possível gerar o plano agora ({result.error}). Você pode gerar depois na aba Treinos.</p>:null}
    <div className="ob-stats"><div><strong>{days.length||a.days}</strong><span>Treinos/semana</span></div><div><strong>{DUR.find(d=>d[0]===a.duration)?.[2]||'—'}</strong><span>Por treino</span></div><div><strong>{kcal?kcal.toLocaleString('pt-BR'):'—'}</strong><span>Meta kcal/dia</span></div></div>
    {first&&<><p className="ob-day">{(first.day||'DIA 1').toUpperCase()} · {first.name}</p>
      <div className="ob-ex">{first.exercises.map((e,k)=><div key={k} className="ob-ex-card"><span className="ob-ex-num">{String(k+1).padStart(2,'0')}</span><div><strong>{e.name}</strong><small>{e.sets} séries · {e.reps} reps · {e.rest_sec||60}s descanso</small></div></div>)}</div>
      {days.length>1&&<div className="ob-week">{days.slice(1).map((d,k)=><span key={k}><b>{d.day}</b>{d.name}</span>)}</div>}</>}
    <Cta onClick={onStart}>Começar</Cta></div>;
}
