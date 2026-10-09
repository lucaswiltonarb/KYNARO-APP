import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {Camera,Check,CheckCircle,ChevronRight,Clock,Dumbbell,Flag,Lock,Play,SkipForward,Star,Timer,CalendarDays,Weight} from 'lucide-react';
import {useApp} from '../context';
import {getWorkoutPlan,getCheckins,getSessions,saveSession,postCheckin,jp} from '../api';
import {Button,Card,Badge,PageTitle,Textarea,Loading,Empty,Confirm,today} from '../components/ui';
import {dayName,sessionFor,isClosed,exClosed,started,progress,isDayDone,currentDayIdx,isFuture,isToday,nextUpcoming,onDay} from '../session';

const fmt=s=>`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const blank=day=>({begun:false,start:0,current:0,restUntil:0,sets:day.exercises.map(e=>Array.from({length:Number(e.sets)||3},()=>({done:false,skipped:false,reps:String(e.reps??''),kg:''})))});
const nextPending=(sets,from)=>{const a=sets.findIndex((x,i)=>i>from&&!exClosed(x));return a>=0?a:sets.findIndex((x,i)=>i!==from&&!exClosed(x))};

export default function Session(){
const {notify}=useApp();const nav=useNavigate();const [params]=useSearchParams();
const [days,setDays]=useState(null);const [checkins,setCheckins]=useState([]);
const [st,setSt]=useState(null);const [now,setNow]=useState(Date.now());
const [ask,setAsk]=useState(null);const [kgOpen,setKgOpen]=useState(null);
const [finishing,setFinishing]=useState(false);const [rating,setRating]=useState(4);const [notes,setNotes]=useState('');const [saving,setSaving]=useState(false);
const [sessions,setSessions]=useState([]);const [planId,setPlanId]=useState(null);
const sid=useRef(null);const events=useRef([]);const timer=useRef();const dirty=useRef(false);const latest=useRef(null);const persistRef=useRef();

useEffect(()=>{Promise.all([getWorkoutPlan().catch(()=>({plan:null})),getCheckins().catch(()=>[]),getSessions(today()).catch(()=>[])]).then(([w,c,s])=>{setPlanId(w.plan?.id??null);setCheckins(Array.isArray(c)?c:[]);setSessions(Array.isArray(s)?s:[]);setDays(jp(w.plan?.data,{})?.days||[])})},[]);

const idx=useMemo(()=>{
  if(!days)return -1;
  const p=params.get('dia');if(p!=null&&days[+p]?.exercises?.length)return +p;
  return currentDayIdx(days,checkins,sessions);
},[days,checkins,sessions,params]);
const day=days?.[idx];const exs=day?.exercises||[];

async function persist(state){
  clearTimeout(timer.current);dirty.current=false;
  const ev=events.current.splice(0);
  try{const r=await saveSession({id:sid.current,date:today(),day_idx:idx,day_name:dayName(day),workout_id:planId,state,events:ev});sid.current=r.id}
  catch(err){events.current.unshift(...ev);dirty.current=true;notify('Não foi possível salvar o progresso no servidor. '+err.message,true)}
}
persistRef.current=persist;
const log=(type,detail)=>events.current.push({type,detail});

useEffect(()=>{if(!day)return;const s=sessionFor(sessions,idx);sid.current=s?.id??null;const ns=s?.state?.sets?.length===exs.length?{restUntil:0,...s.state}:blank(day);setSt(ns);setAsk(started(ns)?null:{type:'begin'})},[days,idx]);
useEffect(()=>{latest.current=st;if(!st||!started(st))return;dirty.current=true;clearTimeout(timer.current);timer.current=setTimeout(()=>persistRef.current(st),400)},[st]);
useEffect(()=>()=>{if(dirty.current&&latest.current)persistRef.current(latest.current)},[]);
useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);

if(!days)return <Loading label="Carregando treino…"/>;
if(!days.some(d=>d.exercises?.length))return <Empty icon={Dumbbell} title="Nenhum treino disponível" action={<Button onClick={()=>nav('/treinos')}>Ver meus treinos</Button>}>Gere um plano de treino para começar.</Empty>;
if(!day){const up=days[nextUpcoming(days,checkins)];return <Empty icon={CheckCircle} title="Nenhum treino para hoje" action={<Button onClick={()=>nav('/treinos')}>Ver meus treinos</Button>}>O treino de hoje já foi concluído ou hoje é dia de descanso.{up?` Próximo: ${up.day} · ${up.name}.`:''}</Empty>}
if(!st)return <Loading label="Preparando sessão…"/>;
if(isFuture(day)&&!started(st))return <Empty icon={Lock} title={`Disponível ${onDay(day)}`} action={<Button onClick={()=>nav('/treinos')}>Ver meus treinos</Button>}>{day.name} só pode ser iniciado no dia dele.</Empty>;
if(!started(st)&&isDayDone(days,idx,checkins))return <Empty icon={CheckCircle} title="Treino já concluído" action={<Button onClick={()=>nav('/treinos')}>Ver meus treinos</Button>}>Você já registrou {dayName(day)} nesta semana.</Empty>;

const {done:doneCount,total}=progress(st);const allDone=doneCount===total;
const cur=st.current;const e=exs[cur];const curSets=st.sets[cur];
const nextSet=curSets.findIndex(x=>!isClosed(x));const pendingSets=curSets.filter(x=>!isClosed(x)).length;
const nIdx=nextPending(st.sets,cur);
const rest=Math.max(0,Math.ceil((st.restUntil-now)/1000));
const begun=started(st);const elapsed=begun?Math.floor((now-st.start)/1000):0;
let nextDay=null;for(let k=1;k<days.length;k++){const d=days[(idx+k)%days.length];if(d.exercises?.length){nextDay=d;break}}

const patchSet=(si,patch)=>setSt(s=>({...s,sets:s.sets.map((arr,i)=>i!==cur?arr:arr.map((x,j)=>j===si?{...x,...patch}:x))}));
function move(i){if(begun)log('troca_exercicio',exs[i].name);setSt(s=>({...s,current:i}));setKgOpen(null);window.scrollTo({top:0,behavior:'smooth'})}
function begin(){setAsk(null);log('iniciado',day.name);setSt(s=>({...s,begun:true,start:Date.now()}));notify('Treino iniciado. Bom treino!')}
function goTo(i){if(i===cur)return;if(begun&&pendingSets>0)setAsk({type:'skip',to:i});else move(i)}
function confirmSet(si){
  setAsk(null);log('serie_concluida',`${e.name} · série ${si+1} · ${curSets[si].reps} reps${curSets[si].kg?` · ${curSets[si].kg} kg`:''}`);
  setSt(s=>{
    const sets=s.sets.map((arr,i)=>i!==cur?arr:arr.map((x,j)=>j===si?{...x,done:true}:x));
    const exDone=exClosed(sets[cur]);const nxt=nextPending(sets,cur);const more=!exDone||nxt>=0;
    return {...s,sets,restUntil:more?Date.now()+(Number(e.rest_sec)||60)*1000:0,current:exDone&&nxt>=0?nxt:cur};
  });
  if(pendingSets===1){
    if(nIdx>=0)notify('Exercício concluído! Descanse antes do próximo.');
    else{notify('Todos os exercícios concluídos!');setFinishing(true);setTimeout(()=>document.getElementById('finish')?.scrollIntoView({behavior:'smooth'}),100)}
  }
}
function skipRest(to){
  setAsk(null);log('series_puladas',`${e.name} · ${pendingSets} série(s)`);
  setSt(s=>({...s,current:to,sets:s.sets.map((arr,i)=>i!==cur?arr:arr.map(x=>isClosed(x)?x:{...x,skipped:true}))}));
  setKgOpen(null);window.scrollTo({top:0,behavior:'smooth'});
}
async function finish(){
  const exercises_done=exs.map((x,i)=>{const d=st.sets[i].filter(s=>s.done);return d.length?{name:x.name,sets:d.length,reps:d.map(s=>s.reps).join('/'),kg:d.map(s=>s.kg).filter(Boolean).join('/')}:null}).filter(Boolean);
  if(!exercises_done.length){notify('Conclua ao menos uma série antes de finalizar.',true);return}
  setSaving(true);
  try{
    await persist(st);
    if(dirty.current)throw new Error('Progresso não salvo.');
    await postCheckin({session_id:sid.current,workout_id:planId,day_name:dayName(day),exercises_done,notes:`${notes} (Avaliação: ${rating}/5)`.trim(),duration_min:Math.max(1,Math.round(elapsed/60))});
    dirty.current=false;
    notify('Treino finalizado! Mais um na conta.');nav('/treinos');
  }catch(err){notify(err.message,true)}finally{setSaving(false)}
}

return <>
<PageTitle title={day.name||'Treino do dia'} subtitle={`${day.day} · ${exs.length} exercícios`} action={begun&&<Badge><Clock size={13}/>{fmt(elapsed)}</Badge>}/>
{!begun&&<Card className="today-card"><Badge>{isToday(day)?'TREINO DE HOJE':`TREINO DE ${day.day.toUpperCase()}`}</Badge><h2>Pronto para começar?</h2><p>O cronômetro e o registro das séries começam quando você confirmar o início.</p><Button className="full" onClick={()=>setAsk({type:'begin'})}><Play size={17} fill="currentColor"/>Iniciar treino</Button></Card>}
{rest>0&&<div className="rest-banner" role="timer"><Timer size={22}/><div><strong>Descanso</strong><span>{fmt(rest)}</span></div><button onClick={()=>{log('descanso_pulado',`${rest}s restantes`);setSt(s=>({...s,restUntil:0}))}}>Pular <SkipForward size={15}/></button></div>}
<div className="two-column"><div>
  <Card className="session-progress">
    <div className="row between"><strong>{doneCount} de {total} exercícios</strong><span className="muted small">{Math.round(doneCount/total*100)}%</span></div>
    <progress max={total} value={doneCount}/>
  </Card>
  <Card>
    <div className="section-heading"><div><span className="muted small">Exercício {cur+1} de {exs.length}</span><h2 className="session-ex-title">{e.name}</h2><p>{e.sets} séries × {e.reps} reps · {e.rest_sec||60}s descanso</p></div>{e.engine_id&&<button className="icon-button" aria-label={'Abrir câmera para '+e.name} onClick={()=>nav('/camera/'+e.engine_id)}><Camera size={20}/></button>}</div>
    <div className="set-list">{curSets.map((s,si)=>{
      const isNext=si===nextSet;const locked=isNext&&rest>0;const k=`${cur}-${si}`;
      return <div key={si} className={'set-row'+(s.done?' done':'')+(s.skipped?' skipped':'')+(isNext?' next':'')}>
        <span className="set-num">{si+1}</span>
        <label><small>Reps</small><input inputMode="numeric" disabled={s.skipped} value={s.reps} onChange={ev=>patchSet(si,{reps:ev.target.value})}/></label>
        {kgOpen===k?<label className="kg-field"><small>kg</small><input autoFocus inputMode="decimal" value={s.kg} onChange={ev=>patchSet(si,{kg:ev.target.value})} onBlur={()=>setKgOpen(null)} onKeyDown={ev=>ev.key==='Enter'&&setKgOpen(null)}/></label>
        :s.kg?<button className="kg-chip" onClick={()=>setKgOpen(k)} aria-label={`Editar carga da série ${si+1}`}>{s.kg} kg</button>
        :!s.skipped&&<button className="kg-btn" onClick={()=>setKgOpen(k)} aria-label={`Adicionar carga na série ${si+1}`} title="Adicionar carga"><Weight size={16}/></button>}
        {s.skipped?<span className="set-check" aria-label="Série pulada">—</span>
        :<button className="set-check" aria-pressed={s.done} disabled={!begun||!isNext||locked} aria-label={locked?'Aguarde o descanso':`Concluir série ${si+1}`} onClick={()=>setAsk({type:'set',si})}>{locked?<Lock size={17}/>:<Check size={20}/>}</button>}
      </div>})}
    </div>
    {rest>0&&nextSet>=0&&<p className="small muted" style={{margin:'12px 0 0'}}>A próxima série libera quando o descanso terminar.</p>}
  </Card>
  {nIdx>=0&&<button className="session-next" onClick={()=>goTo(nIdx)}><div><small>Próximo exercício</small><strong>{exs[nIdx].name}</strong><span>{begun&&pendingSets>0?`Termine as ${pendingSets} séries restantes ou pule`:`${exs[nIdx].sets} séries × ${exs[nIdx].reps} reps`}</span></div><ChevronRight size={20}/></button>}
</div><aside>
  <Card>
    <div className="section-heading"><h2>Exercícios</h2><Dumbbell size={20}/></div>
    {exs.map((x,i)=>{const sets=st.sets[i];const closed=exClosed(sets);const skipped=sets.some(s=>s.skipped);
      return <button key={i} className={'session-ex'+(i===cur?' current':'')+(closed?' done':'')} onClick={()=>goTo(i)}>
        <span className="exercise-count">{closed?<Check size={15}/>:String(i+1).padStart(2,'0')}</span>
        <span><strong>{x.name}</strong><small>{sets.filter(s=>s.done).length}/{sets.length} séries{skipped?' · pulado':''}</small></span>
      </button>})}
  </Card>
  {begun&&<Card id="finish">
    {finishing?<>
      <h2>Finalizar treino</h2>
      <p>{allDone?'Treino completo! Como você se sentiu?':`Você concluiu ${doneCount} de ${total} exercícios. Só as séries marcadas serão registradas.`}</p>
      <p className="small">Sua avaliação</p>
      <div className="stars">{[1,2,3,4,5].map(n=><button key={n} aria-label={'Avaliar com '+n+' estrelas'} aria-pressed={rating===n} onClick={()=>setRating(n)}><Star fill={n<=rating?'var(--primary)':'none'} color="var(--primary)"/></button>)}</div>
      <Textarea label="Como foi o treino?" placeholder="Alguma dificuldade ou conquista de hoje?" value={notes} onChange={ev=>setNotes(ev.target.value)}/>
      <div className="actions-row"><Button variant="secondary" disabled={saving} onClick={()=>setFinishing(false)}>Continuar</Button><Button busy={saving} onClick={finish}>Salvar check-in</Button></div>
    </>:<>
      {!allDone&&<p className="small muted" style={{marginTop:0}}>Esqueceu de marcar alguma série? Você pode finalizar mesmo assim.</p>}
      <Button className="full" variant={allDone?'primary':'secondary'} onClick={()=>setFinishing(true)}><Flag size={17}/>Finalizar treino</Button>
    </>}
  </Card>}
  {nextDay&&<Card>
    <div className="section-heading"><h2>Próximo treino</h2><CalendarDays size={20}/></div>
    <span className="muted small">{nextDay.day}</span><h3>{nextDay.name}</h3>
    <p className="small">{nextDay.exercises.length} exercícios{nextDay.muscle_groups?.length?' · '+nextDay.muscle_groups.join(', '):''}</p>
  </Card>}
</aside></div>
{ask?.type==='begin'&&<Confirm title="Iniciar treino?" action="Iniciar treino" variant="primary" onClose={()=>setAsk(null)} onConfirm={begin}>{day.name} · {exs.length} exercícios. O cronômetro começa assim que você confirmar.</Confirm>}
{ask?.type==='set'&&<Confirm title={`Concluiu a série ${ask.si+1}?`} action="Sim, concluí" variant="primary" onClose={()=>setAsk(null)} onConfirm={()=>confirmSet(ask.si)}>{e.name} · {curSets[ask.si].reps} reps{curSets[ask.si].kg?` · ${curSets[ask.si].kg} kg`:''}. {pendingSets>1||nIdx>=0?`O descanso de ${e.rest_sec||60}s começa em seguida.`:''}</Confirm>}
{ask?.type==='skip'&&<Confirm title="Pular séries restantes?" action="Pular séries" onClose={()=>setAsk(null)} onConfirm={()=>skipRest(ask.to)}>Ainda faltam {pendingSets} {pendingSets>1?'séries':'série'} de {e.name}. Elas não serão registradas no check-in.</Confirm>}
</>}
