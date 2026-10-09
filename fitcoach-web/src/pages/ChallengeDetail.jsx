import React,{useEffect,useRef,useState} from 'react';
import {useNavigate,useParams,useSearchParams} from 'react-router-dom';
import {ArrowLeft,UserPlus,Crown,Medal,Send,Dumbbell,Clock,Calendar,Trophy,LogOut,Trash2,MessageCircle} from 'lucide-react';
import {useApp} from '../context';
import {getChallenge,getChallengeFeed,getChallengeMessages,sendChallengeMessage,leaveChallenge,deleteChallenge} from '../api';
import {Button,Card,Badge,Loading,Empty,Confirm,formatDate} from '../components/ui';
import {SCORING,STATUS,timeInfo,shortDate,Person,InviteSheet} from '../components/challengeUi';

const TABS=['Ranking','Atividade','Chat'];
const ago=iso=>{if(!iso)return '';const m=Math.round((Date.now()-new Date(iso))/6e4);return m<1?'agora':m<60?`há ${m} min`:m<1440?`há ${Math.round(m/60)} h`:new Date(iso).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','')};

export default function ChallengeDetail(){
  const {id}=useParams();const [params,setParams]=useSearchParams();const nav=useNavigate();const {user,notify}=useApp();
  const [c,setC]=useState(null);const [tab,setTab]=useState('Ranking');const [invite,setInvite]=useState(params.get('novo')==='1');const [ask,setAsk]=useState(null);
  const load=()=>getChallenge(id).then(setC).catch(e=>{notify(e.message,true);nav('/desafios')});
  useEffect(()=>{load();const t=setInterval(()=>document.visibilityState==='visible'&&load(),15000);return()=>clearInterval(t)},[id]);
  async function exit(){try{await(ask==='delete'?deleteChallenge(id):leaveChallenge(id));notify(ask==='delete'?'Desafio excluído.':'Você saiu do desafio.');nav('/desafios')}catch(e){notify(e.message,true)}setAsk(null)}
  if(!c)return <Loading label="Carregando desafio…"/>;
  const t=timeInfo(c);const s=STATUS[c.status];const unit=SCORING[c.scoring].unit;const board=c.leaderboard;
  return <>
    <button className="text-link" onClick={()=>nav('/desafios')}><ArrowLeft size={17}/>Desafios</button>
    <Card className="challenge-hero">
      <div className="row between"><Badge tone={s.tone}>{s.label}</Badge><button className="invite-btn" onClick={()=>setInvite(true)}><UserPlus size={16}/>Convidar</button></div>
      <h1>{c.name}</h1>
      {c.description&&<p className="challenge-desc">{c.description}</p>}
      <div className="invite-facts"><span><Calendar size={14}/>{shortDate(c.start_date)} – {shortDate(c.end_date)}</span><span><Trophy size={14}/>{SCORING[c.scoring].label}</span></div>
      <div className="time-bar"><span style={{width:t.pct+'%'}}/></div>
      <div className="row between"><span className="small">{t.label}</span><div className="people-stack">{board.slice(0,5).map(p=><Person key={p.id} p={p} size={28}/>)}{board.length>5&&<span className="person more">+{board.length-5}</span>}</div></div>
    </Card>
    <div className="tabs-pills" role="tablist">{TABS.map(x=><button key={x} role="tab" aria-selected={tab===x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}</div>
    {tab==='Ranking'&&<Ranking board={board} me={user.id} unit={unit} status={c.status}/>}
    {tab==='Atividade'&&<Feed id={id}/>}
    {tab==='Chat'&&<Chat id={id} me={user.id}/>}
    <button className="challenge-exit" onClick={()=>setAsk(c.is_owner?'delete':'leave')}>{c.is_owner?<><Trash2 size={15}/>Excluir desafio</>:<><LogOut size={15}/>Sair do desafio</>}</button>
    {invite&&<InviteSheet challenge={c} onClose={()=>{setInvite(false);if(params.get('novo'))setParams({},{replace:true})}}/>}
    {ask&&<Confirm title={ask==='delete'?'Excluir desafio?':'Sair do desafio?'} action={ask==='delete'?'Excluir':'Sair'} onClose={()=>setAsk(null)} onConfirm={exit}>{ask==='delete'?'O desafio, o ranking e o chat serão apagados para todos os participantes.':'Você deixará de aparecer no ranking. Pode voltar depois com o código de convite.'}</Confirm>}
  </>;
}

function Ranking({board,me,unit,status}){
  if(!board.length)return <Empty icon={Trophy} title="Sem participantes"/>;
  const top=board.slice(0,3);const podium=[top[1],top[0],top[2]].filter(Boolean);const started=status!=='em_breve';
  return <>
    {started&&board.some(b=>b.points>0)&&<div className="podium">{podium.map(p=>{const place=p.rank;return <div key={p.id} className={'podium-col place-'+Math.min(place,3)+(p.id===me?' is-me':'')}>
      <div className="podium-avatar">{place===1&&<Crown className="podium-crown" size={22}/>}<Person p={p} size={place===1?68:54}/><span className="podium-badge">{place}</span></div>
      <strong>{p.id===me?'Você':p.name.split(' ')[0]}</strong><small>{p.points} {unit}</small>
      <div className="podium-block"/>
    </div>})}</div>}
    <Card className="ranking-list">
      {!started&&<p className="notice" style={{marginTop:0}}>O desafio ainda não começou. O ranking abre no primeiro dia.</p>}
      {board.map(p=><div key={p.id} className={'rank-row'+(p.id===me?' is-me':'')}>
        <span className={'rank-pos'+(p.rank<=3&&p.points>0?' top-'+p.rank:'')}>{p.rank<=3&&p.points>0?<Medal size={16}/>:p.rank}</span>
        <Person p={p} size={40}/>
        <div className="rank-info"><strong>{p.id===me?`${p.name} (você)`:p.name}</strong><small>{p.workouts} treinos · {p.minutes} min{p.last_checkin?` · último ${formatDate(p.last_checkin).slice(0,5)}`:''}</small></div>
        <div className="rank-points"><strong>{p.points}</strong><small>{unit}</small></div>
      </div>)}
    </Card>
  </>;
}

function Feed({id}){
  const [items,setItems]=useState(null);
  useEffect(()=>{const load=()=>getChallengeFeed(id).then(setItems).catch(()=>setItems([]));load();const t=setInterval(()=>document.visibilityState==='visible'&&load(),20000);return()=>clearInterval(t)},[id]);
  if(!items)return <Loading label="Carregando atividade…"/>;
  if(!items.length)return <Empty icon={Dumbbell} title="Nenhum treino ainda">Os check-ins dos participantes durante o desafio aparecem aqui.</Empty>;
  return <Card className="feed">{items.map(f=><div key={f.id} className="feed-row">
    <Person p={f.user} size={42}/>
    <div><p><strong>{f.user.name.split(' ')[0]}</strong> treinou <strong>{f.day_name}</strong></p>
      <small>{f.duration_min?<><Clock size={12}/>{f.duration_min} min · </>:null}{f.exercises} exercícios · {formatDate(f.date)}</small></div>
    <span className="feed-time">{ago(f.created_at)}</span>
  </div>)}</Card>;
}

function Chat({id,me}){
  const {notify}=useApp();const [msgs,setMsgs]=useState(null);const [text,setText]=useState('');const [sending,setSending]=useState(false);
  const last=useRef(0);const box=useRef();
  const add=list=>{if(!list.length)return;last.current=list[list.length-1].id;setMsgs(m=>[...(m||[]),...list.filter(x=>!(m||[]).some(y=>y.id===x.id))])};
  useEffect(()=>{
    let alive=true;
    const poll=()=>getChallengeMessages(id,last.current).then(l=>{if(!alive)return;setMsgs(m=>m||[]);add(l)}).catch(()=>{});
    poll();const t=setInterval(()=>document.visibilityState==='visible'&&poll(),4000);
    return()=>{alive=false;clearInterval(t)};
  },[id]);
  useEffect(()=>{box.current?.scrollTo({top:box.current.scrollHeight,behavior:'smooth'})},[msgs?.length]);
  async function send(){
    const v=text.trim();if(!v)return;setSending(true);
    try{add([await sendChallengeMessage(id,v)]);setText('')}catch(e){notify(e.message,true)}finally{setSending(false)}
  }
  return <Card className="chat">
    <div className="chat-box" ref={box}>
      {msgs===null?<Loading label="Carregando conversa…"/>:!msgs.length?<Empty icon={MessageCircle} title="Comece a conversa">Mande um incentivo (ou uma provocação) para o grupo.</Empty>
      :msgs.map((m,i)=>{const mine=m.user?.id===me;const showName=!mine&&msgs[i-1]?.user?.id!==m.user?.id;
        return <div key={m.id} className={'msg'+(mine?' mine':'')}>
          {!mine&&<span className="msg-avatar">{showName&&<Person p={m.user} size={30}/>}</span>}
          <div className="msg-bubble">{showName&&<small className="msg-name">{m.user?.name?.split(' ')[0]}</small>}<p>{m.text}</p><time>{new Date(m.created_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></div>
        </div>})}
    </div>
    <div className="chat-input"><input value={text} maxLength={500} placeholder="Escreva uma mensagem…" aria-label="Mensagem" onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!sending&&send()}/><button className="chat-send" disabled={sending||!text.trim()} onClick={send} aria-label="Enviar"><Send size={18}/></button></div>
  </Card>;
}
