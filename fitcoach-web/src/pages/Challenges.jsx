import React,{useEffect,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {Trophy,Plus,Users,ArrowRight,Calendar,Crown,Ticket,LoaderCircle} from 'lucide-react';
import {useApp} from '../context';
import {getChallenges,createChallenge,joinChallenge,previewChallenge} from '../api';
import {Button,Card,Badge,PageTitle,Loading,Empty,Modal,Field,Textarea,today} from '../components/ui';
import {SCORING,STATUS,timeInfo,shortDate,Person} from '../components/challengeUi';

const plusDays=n=>{const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};

export default function Challenges(){
  const {notify}=useApp();const nav=useNavigate();
  const [list,setList]=useState(null);const [creating,setCreating]=useState(false);const [code,setCode]=useState('');const [joining,setJoining]=useState(false);
  useEffect(()=>{getChallenges().then(setList).catch(e=>{setList([]);notify(e.message,true)})},[]);
  async function join(){
    const c=code.trim().toUpperCase();if(c.length<6){notify('O código tem 6 caracteres.',true);return}
    setJoining(true);try{const r=await joinChallenge(c);notify(`Você entrou em "${r.name}"!`);nav('/desafios/'+r.id)}catch(e){notify(e.message,true)}finally{setJoining(false)}
  }
  if(!list)return <Loading label="Carregando desafios…"/>;
  const groups=[['ativo','Em andamento'],['em_breve','Em breve'],['encerrado','Encerrados']].map(([k,l])=>[l,list.filter(c=>c.status===k)]).filter(([,v])=>v.length);
  return <>
    <PageTitle title="Desafios" subtitle="Constância fica mais fácil com companhia." action={<Button onClick={()=>setCreating(true)}><Plus size={18}/>Criar desafio</Button>}/>
    <Card className="join-card">
      <div className="join-head"><span className="join-icon"><Ticket size={20}/></span><div><strong>Recebeu um convite?</strong><small>Digite o código de 6 caracteres para entrar no desafio.</small></div></div>
      <div className="join-row">
        <label className="code-slots">
          {Array.from({length:6},(_,i)=><span key={i} className={code[i]?'filled':i===code.length?'next':''}>{code[i]||''}</span>)}
          <input value={code} maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} aria-label="Código de convite" onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6))} onKeyDown={e=>e.key==='Enter'&&join()}/>
        </label>
        <button className={'join-go'+(code.length===6?' ready':'')} disabled={joining||code.length<6} onClick={join} aria-label="Entrar no desafio">{joining?<LoaderCircle className="spin" size={20}/>:<ArrowRight size={20}/>}</button>
      </div>
    </Card>
    {!list.length?<Empty icon={Trophy} title="Nenhum desafio ainda" action={<Button onClick={()=>setCreating(true)}><Plus size={18}/>Criar meu primeiro desafio</Button>}>Crie um grupo com amigos, família ou colegas de trabalho e vejam quem mantém a constância.</Empty>
    :groups.map(([label,items])=><section key={label}><h2 className="group-title">{label}</h2><div className="challenge-grid">{items.map(c=><ChallengeCard key={c.id} c={c} onOpen={()=>nav('/desafios/'+c.id)}/>)}</div></section>)}
    {creating&&<CreateChallenge onClose={()=>setCreating(false)} onCreated={c=>nav(`/desafios/${c.id}?novo=1`)}/>}
  </>;
}

function ChallengeCard({c,onOpen}){
  const t=timeInfo(c);const s=STATUS[c.status];
  return <button className={'challenge-card is-'+c.status} onClick={onOpen}>
    <div className="row between"><Badge tone={s.tone}>{s.label}</Badge><span className="small muted"><Users size={13}/> {c.members_count}</span></div>
    <h3>{c.name}</h3>
    <p className="challenge-dates"><Calendar size={13}/>{shortDate(c.start_date)} – {shortDate(c.end_date)} · {SCORING[c.scoring].label}</p>
    <div className="time-bar"><span style={{width:t.pct+'%'}}/></div>
    <div className="row between challenge-foot">
      <span className="small muted">{t.label}</span>
      {c.status!=='em_breve'&&c.my_rank?<span className="my-rank">{c.my_rank===1?<Crown size={14}/>:null}{c.my_rank}º lugar · {c.my_points} {SCORING[c.scoring].unit}</span>:<ArrowRight size={16}/>}
    </div>
  </button>;
}

function CreateChallenge({onClose,onCreated}){
  const {notify}=useApp();
  const [f,setF]=useState({name:'',description:'',start_date:today(),end_date:plusDays(29),scoring:'dias'});const [saving,setSaving]=useState(false);
  const set=k=>e=>setF(x=>({...x,[k]:e.target.value}));
  const dur=Math.round((new Date(f.end_date)-new Date(f.start_date))/864e5)+1;
  async function save(){
    if(f.name.trim().length<2){notify('Dê um nome ao desafio.',true);return}
    setSaving(true);try{onCreated(await createChallenge(f))}catch(e){notify(e.message,true)}finally{setSaving(false)}
  }
  return <Modal title="Novo desafio" onClose={()=>!saving&&onClose()}>
    <Field label="Nome do desafio" placeholder="Ex.: Galera do escritório 💪" maxLength={60} value={f.name} onChange={set('name')} autoFocus/>
    <Textarea label="Descrição (opcional)" placeholder="Regras, prêmio para quem vencer…" value={f.description} onChange={set('description')}/>
    <p className="form-label">Duração</p>
    <div className="filter-pills">{[7,14,30,60,90].map(n=><button key={n} className={dur===n?'active':''} onClick={()=>setF(x=>({...x,end_date:(()=>{const d=new Date(x.start_date+'T12:00:00');d.setDate(d.getDate()+n-1);return d.toISOString().slice(0,10)})()}))}>{n} dias</button>)}</div>
    <div className="form-grid"><Field label="Início" type="date" value={f.start_date} onChange={set('start_date')}/><Field label="Fim" type="date" min={f.start_date} value={f.end_date} onChange={set('end_date')}/></div>
    <p className="form-label">Como pontua</p>
    <div className="scoring-options">{Object.entries(SCORING).map(([k,v])=><button key={k} className={f.scoring===k?'selected':''} onClick={()=>setF(x=>({...x,scoring:k}))} aria-pressed={f.scoring===k}><strong>{v.label}</strong><small>{v.hint}</small></button>)}</div>
    <div className="actions-row"><Button variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button><Button busy={saving} onClick={save}><Trophy size={16}/>Criar desafio</Button></div>
  </Modal>;
}

export function ChallengeInvite(){
  const {code}=useParams();const nav=useNavigate();const {notify}=useApp();const [c,setC]=useState(null);const [err,setErr]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{previewChallenge(code).then(r=>r.joined?nav('/desafios/'+r.id,{replace:true}):setC(r)).catch(e=>setErr(e.message))},[code]);
  async function join(){setBusy(true);try{const r=await joinChallenge(code);notify(`Você entrou em "${r.name}"!`);nav('/desafios/'+r.id,{replace:true})}catch(e){notify(e.message,true)}finally{setBusy(false)}}
  if(err)return <Empty icon={Trophy} title="Convite inválido" action={<Button onClick={()=>nav('/desafios')}>Ver meus desafios</Button>}>{err}</Empty>;
  if(!c)return <Loading label="Abrindo convite…"/>;
  return <Card className="invite-landing">
    <span className="invite-trophy"><Trophy size={34}/></span>
    <small className="muted">{c.owner_name} convidou você para</small>
    <h1>{c.name}</h1>
    {c.description&&<p>{c.description}</p>}
    <div className="invite-facts"><span><Calendar size={14}/>{shortDate(c.start_date)} – {shortDate(c.end_date)}</span><span><Users size={14}/>{c.members_count} participantes</span><span><Trophy size={14}/>{c.scoring_label}</span></div>
    {c.status==='encerrado'?<p className="error">Este desafio já foi encerrado.</p>:<Button className="full" busy={busy} onClick={join}>Entrar no desafio</Button>}
  </Card>;
}
