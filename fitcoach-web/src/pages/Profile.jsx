import React,{useState,useEffect,useRef} from 'react';
import {useSearchParams,useNavigate} from 'react-router-dom';
import {Pencil,Save,FileText,ImagePlus,Scale,Ruler,HeartPulse,Share2,LogOut,Camera} from 'lucide-react';
import {useApp} from '../context';
import {getProfile,updateProfile,logWeight as apiLogWeight,uploadPhoto,uploadAvatar as apiUploadAvatar,getCheckins,jp} from '../api';
import {Button,Card,Field,Select,Textarea,Modal,Confirm,Empty,Loading,formatDate,today} from '../components/ui';
import WeightChart from '../components/WeightChart';
import DietExpenses from '../components/DietExpenses';
import profileBg from '../assets/profile-bg.webp';
import bodySvg from '../assets/body-silhouette.svg';

const genderOpts=[{value:'',label:'Selecione...'},{value:'masculino',label:'Masculino'},{value:'feminino',label:'Feminino'},{value:'outro',label:'Outro'},{value:'prefiro_nao_informar',label:'Prefiro não informar'}];
const goalOpts=[{value:'',label:'Selecione...'},{value:'emagrecimento',label:'Emagrecimento'},{value:'hipertrofia',label:'Hipertrofia'},{value:'definir',label:'Definição'},{value:'manutenção',label:'Manutenção'},{value:'saúde',label:'Saúde geral'},{value:'condicionamento',label:'Condicionamento físico'},{value:'performance',label:'Performance atlética'}];
const activityOpts=[{value:'',label:'Selecione...'},{value:'sedentário',label:'Sedentário'},{value:'leve',label:'Levemente ativo'},{value:'moderado',label:'Moderadamente ativo'},{value:'intenso',label:'Muito ativo'},{value:'extremo',label:'Extremamente ativo'}];
const limitOpts=['Dor lombar','Dor no joelho','Dor no ombro','Tendinite','Hérnia de disco','Problema no quadril','Problema no tornozelo','Escoliose','Fibromialgia','Artrite','Asma / Respiratório','Cardíaco','Pós-cirúrgico','Gestante','Nenhuma'];
const proteinOpts=['Frango','Carne vermelha','Peixe','Ovo','Whey','Caseína','Proteína vegetal (soja)','Proteína vegetal (ervilha)','Tofu','Grão-de-bico'];
const restrictOpts=[{value:'',label:'Selecione...'},{value:'nenhuma',label:'Sem restrições'},{value:'vegetariano',label:'Vegetariano'},{value:'vegano',label:'Vegano'},{value:'sem_lactose',label:'Sem lactose'},{value:'sem_gluten',label:'Sem glúten'},{value:'low_carb',label:'Low carb'},{value:'cetogenica',label:'Cetogênica'},{value:'personalizado',label:'Personalizado'}];
const bioLabels={body_fat_pct:'Gordura corporal (%)',muscle_mass_kg:'Massa muscular (kg)',water_pct:'Água corporal (%)',bone_mass_kg:'Massa óssea (kg)',bmr:'Taxa metabólica basal (kcal)',visceral_fat:'Gordura visceral'};
const measureKeys=['peito','cintura','quadril','braco_d','braco_e','coxa_d','coxa_e','panturrilha'];
const measureLabels={peito:'Peito',cintura:'Cintura',quadril:'Quadril',braco_d:'Braço D',braco_e:'Braço E',coxa_d:'Coxa D',coxa_e:'Coxa E',panturrilha:'Panturrilha'};
const TABS=['Dados','Bioimpedância','Medidas','Nutrição','Gastos','Exames','Progresso'];

export default function Profile(){
const {user,setUser,logout,notify,theme,setTheme}=useApp();
const [params,setParams]=useSearchParams();const tab=params.get('aba')||'Dados';const setTab=t=>setParams({aba:t});const nav=useNavigate();
const [profile,setProfile]=useState(null);const [loading,setLoading]=useState(true);
const [edit,setEdit]=useState(false);const [draft,setDraft]=useState({});
const [editBio,setEditBio]=useState(false);const [editMeasures,setEditMeasures]=useState(false);const [editNutrition,setEditNutrition]=useState(false);
const [bio,setBio]=useState({});const [measures,setMeasures]=useState({});
const [weight,setWeight]=useState('');const [showLogout,setShowLogout]=useState(false);
const [view,setView]=useState(null);const photoInput=useRef();const avatarInput=useRef();
const [avatarUrl,setAvatarUrl]=useState('');
const [checkinCount,setCheckinCount]=useState(0);const [avgRating,setAvgRating]=useState('—');
const [limitations,setLimitations]=useState([]);const [customLimitation,setCustomLimitation]=useState('');
const [proteins,setProteins]=useState([]);const [customProtein,setCustomProtein]=useState('');
const [restriction,setRestriction]=useState('');const [customRestriction,setCustomRestriction]=useState('');
const [mealTimes,setMealTimes]=useState({cafe:'07:00',lanche1:'10:00',almoco:'12:30',lanche2:'15:30',jantar:'19:00',ceia:'21:00'});

useEffect(()=>{
  Promise.all([getProfile(),getCheckins().catch(()=>[])]).then(([p,cks])=>{
    setProfile(p);setDraft({...p,name:user?.name||''});
    setBio({body_fat_pct:p.body_fat_pct||'',muscle_mass_kg:p.muscle_mass_kg||'',water_pct:p.water_pct||'',bone_mass_kg:p.bone_mass_kg||'',bmr:p.bmr||'',visceral_fat:p.visceral_fat||''});
    const m=jp(p.measurements,{});setMeasures(Object.fromEntries(measureKeys.map(k=>[k,m[k]||''])));
    const pr=p.protein_preference;setProteins(Array.isArray(pr)?pr:typeof pr==='string'&&pr.startsWith('[')?jp(pr,[]):pr?[pr]:[]);
    setRestriction(p.dietary_restrictions||'');setAvatarUrl(p.avatar_url||'');if(p.meal_times)setMealTimes(m=>({...m,...p.meal_times}));
    const lm=p.injuries;setLimitations(Array.isArray(lm)?lm:typeof lm==='string'&&lm.startsWith('[')?jp(lm,[]):lm?[lm]:[]);
    const arr=Array.isArray(cks)?cks:[];
    setCheckinCount(arr.length);
    if(arr.length){const rats=arr.map(c=>{const mt=(c.notes||'').match(/Avaliação:\s*(\d+)/);return mt?+mt[1]:null}).filter(Boolean);setAvgRating(rats.length?(rats.reduce((a,b)=>a+b,0)/rats.length).toFixed(1):'—')}
  }).catch(()=>notify('Erro ao carregar perfil.',true)).finally(()=>setLoading(false));
},[]);

if(loading)return <Loading label="Carregando perfil…"/>;
if(!profile)return <p>Erro ao carregar perfil.</p>;

const wh=jp(profile.weight_history,[]);
const photos=jp(profile.progress_photos,[]);
const initials=user?.name?.split(' ').map(x=>x[0]).slice(0,2).join('')||'?';
const scoreNum=checkinCount>0?Math.min(10,(checkinCount/10*3+(avgRating!=='—'?parseFloat(avgRating)*0.7:3.5))):null;
const score=scoreNum!==null?scoreNum.toFixed(1):'—';
const scoreColor=scoreNum===null?'var(--muted)':scoreNum>=7?'var(--green)':scoreNum>=4?'var(--primary)':'var(--danger)';

async function saveProfile(){try{
  const p={};
  if(draft.name)p.name=draft.name;
  if(draft.age!==''&&draft.age!=null)p.age=Number(draft.age);
  if(draft.gender)p.gender=draft.gender;
  if(draft.height_cm!==''&&draft.height_cm!=null)p.height_cm=Number(draft.height_cm);
  if(draft.weight_kg!==''&&draft.weight_kg!=null)p.weight_kg=Number(draft.weight_kg);
  if(draft.goal)p.goal=draft.goal;
  if(draft.activity_level)p.activity_level=draft.activity_level;
  p.injuries=JSON.stringify(limitations);
  const res=await updateProfile(p);setProfile(res);setEdit(false);
  if(draft.name&&draft.name!==user.name)setUser(u=>({...u,name:draft.name}));
  notify('Perfil atualizado.');
}catch(e){notify(e.message,true)}}

async function saveBio(){try{const nb=Object.fromEntries(Object.entries(bio).filter(([,v])=>v!=='').map(([k,v])=>[k,Number(v)]));await updateProfile(nb);setProfile(p=>({...p,...nb}));setEditBio(false);notify('Bioimpedância salva.')}catch(e){notify(e.message,true)}}
async function saveMeasures(){try{const m=Object.fromEntries(Object.entries(measures).filter(([,v])=>v!=='').map(([k,v])=>[k,Number(v)]));await updateProfile({measurements:m});setProfile(p=>({...p,measurements:m}));setEditMeasures(false);notify('Medidas salvas.')}catch(e){notify(e.message,true)}}
async function saveNutrition(){try{const fp=customProtein?[...proteins,customProtein]:proteins;const fr=restriction==='personalizado'?customRestriction:restriction;await updateProfile({protein_preference:JSON.stringify(fp),dietary_restrictions:fr,meal_times:mealTimes});setProfile(p=>({...p,protein_preference:fp,dietary_restrictions:fr,meal_times:mealTimes}));setEditNutrition(false);notify('Preferências nutricionais salvas.')}catch(e){notify(e.message,true)}}
async function addWeight(){const n=Number(weight);if(n<20||n>350||!n){notify('Informe um peso entre 20 e 350 kg.',true);return}try{await apiLogWeight(n);setProfile(p=>({...p,weight_kg:n,weight_history:[...(p.weight_history||[]),{date:today(),weight:n}]}));setWeight('');notify('Peso registrado.')}catch(e){notify(e.message,true)}}
async function addPhoto(e){const file=e.target.files[0];if(!file)return;try{const res=await uploadPhoto(file);setProfile(p=>({...p,progress_photos:[...(p.progress_photos||[]),{date:today(),url:res.url}]}));notify('Foto enviada.')}catch(e2){notify(e2.message,true)}e.target.value=''}
function toggleLim(item){if(item==='Nenhuma'){setLimitations(['Nenhuma']);return}setLimitations(p=>{const f=p.filter(x=>x!=='Nenhuma');return f.includes(item)?f.filter(x=>x!==item):[...f,item]})}
function toggleProt(item){setProteins(p=>p.includes(item)?p.filter(x=>x!==item):[...p,item])}
async function uploadAvatar(e){const file=e.target.files[0];if(!file)return;try{const res=await apiUploadAvatar(file);setAvatarUrl(res.url);notify('Foto de perfil atualizada.')}catch(e2){notify(e2.message,true)}e.target.value=''}
async function shareProfile(){const txt=`🏋️ ${user.name}\n📊 ${checkinCount} dias de disciplina\n⭐ Nota: ${score}\n🎯 Objetivo: ${profile.goal}`;if(navigator.share){try{await navigator.share({title:'Meu perfil Kynaro',text:txt})}catch{}}else{try{await navigator.clipboard.writeText(txt);notify('Perfil copiado!')}catch{notify('Não foi possível compartilhar.',true)}}}

return <>
<div className="profile-hero-wrap">
  <div className="profile-top-actions">
    <button className="profile-round-btn" onClick={()=>setShowLogout(true)} aria-label="Sair"><LogOut size={18}/></button>
  </div>
  <div className="profile-hero-card">
    <img src={profileBg} alt="" className="profile-hero-bg"/>
    <div className="profile-hero-fade"/>
    <div className="profile-hero-actions">
      <button className="profile-action-btn" onClick={()=>{setDraft({...profile,name:user?.name||''});setEdit(true);setTab('Dados')}} aria-label="Editar perfil"><Pencil size={18}/></button>
      <div className="profile-avatar-main">{avatarUrl?<img src={avatarUrl} alt={user.name} className="avatar large avatar-img"/>:<div className="avatar large">{initials}</div>}<button className="avatar-camera-btn" onClick={()=>avatarInput.current.click()} aria-label="Alterar foto"><Camera size={12}/></button><input hidden type="file" accept="image/jpeg,image/png,image/webp" ref={avatarInput} onChange={uploadAvatar}/></div>
      <button className="profile-action-btn" onClick={shareProfile} aria-label="Compartilhar"><Share2 size={18}/></button>
    </div>
  </div>
  <div className="profile-hero-info">
    <h2 className="profile-name">{user.name}</h2>
    <div className="profile-tags"><span className="profile-tag">{profile.goal||'Sem objetivo'}</span><span className="profile-tag">{profile.activity_level||'Sem nível'}</span></div>
  </div>
  <div className="profile-stats-bar">
    <div><strong>{checkinCount}</strong><span>Disciplina</span></div>
    <div className="profile-stat-divider"/>
    <div><strong style={{color:scoreColor}}>{score}</strong><span>Nota</span></div>
    <div className="profile-stat-divider"/>
    <div><strong>{profile.weight_kg||'—'}</strong><span>Peso</span></div>
  </div>
</div>

<div className="tabs-pills" role="tablist">{TABS.map(t=><button key={t} role="tab" aria-selected={tab===t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>

{tab==='Dados'&&<Card>
  <div className="section-heading"><h2>Sobre você</h2><Button variant={edit?'primary':'secondary'} onClick={edit?saveProfile:()=>{setDraft({...profile,name:user?.name||''});setEdit(true)}} className="btn-sm">{edit?<Save size={15}/>:<Pencil size={15}/>} {edit?'Salvar':'Editar'}</Button></div>
  {edit?<div className="form-grid">
    <Field label="Nome" value={draft.name||''} onChange={e=>setDraft({...draft,name:e.target.value})}/>
    <Field label="Idade" type="text" inputMode="numeric" value={draft.age==null||draft.age===0?'':draft.age} onChange={e=>setDraft({...draft,age:e.target.value})}/>
    <Select label="Gênero" options={genderOpts} value={draft.gender||''} onChange={e=>setDraft({...draft,gender:e.target.value})}/>
    <Field label="Altura (cm)" type="text" inputMode="decimal" value={draft.height_cm==null||draft.height_cm===0?'':draft.height_cm} onChange={e=>setDraft({...draft,height_cm:e.target.value})}/>
    <Field label="Peso (kg)" type="text" inputMode="decimal" value={draft.weight_kg==null||draft.weight_kg===0?'':draft.weight_kg} onChange={e=>setDraft({...draft,weight_kg:e.target.value})}/>
    <Select label="Objetivo" options={goalOpts} value={draft.goal||''} onChange={e=>setDraft({...draft,goal:e.target.value})}/>
    <Select label="Nível de atividade" options={activityOpts} value={draft.activity_level||''} onChange={e=>setDraft({...draft,activity_level:e.target.value})}/>
    <div style={{gridColumn:'1/-1'}}><label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:7}}>Limitações físicas</label>
      <div className="chips">{limitOpts.map(x=><button key={x} className={limitations.includes(x)?'selected':''} onClick={()=>toggleLim(x)}>{x}</button>)}</div>
      <div className="row" style={{gap:10}}><Field label="" placeholder="Outra limitação..." value={customLimitation} onChange={e=>setCustomLimitation(e.target.value)}/>{customLimitation&&<Button variant="secondary" onClick={()=>{setLimitations(p=>[...p.filter(x=>x!=='Nenhuma'),customLimitation]);setCustomLimitation('')}}>+</Button>}</div>
    </div>
    <Button variant="secondary" onClick={()=>setEdit(false)} style={{gridColumn:'1/-1'}}>Cancelar</Button>
  </div>:<div className="form-grid">
    {[['Nome',user.name],['Idade',profile.age],['Gênero',profile.gender],['Altura',profile.height_cm?profile.height_cm+' cm':''],['Peso',profile.weight_kg||''],['Objetivo',profile.goal],['Nível de atividade',profile.activity_level],['Limitações físicas',limitations.length?limitations.join(', '):jp(profile.injuries,'Nenhuma informada')]].map(([l,v])=><div key={l} className="data-pair"><span>{l}</span><strong>{v||'Não informado'}</strong></div>)}
  </div>}
</Card>}

{tab==='Bioimpedância'&&<Card><div className="section-heading"><div><h2>Composição corporal</h2>{!editBio&&<p>Dados do seu exame de bioimpedância.</p>}</div>{editBio?<Button onClick={saveBio} className="btn-sm"><Save size={15}/> Salvar</Button>:<Button variant="secondary" onClick={()=>setEditBio(true)} className="btn-sm"><Pencil size={15}/> Editar</Button>}</div>
  {editBio?<><div className="form-grid">{Object.entries(bioLabels).map(([k,l])=><Field key={k} label={l} type="text" inputMode="decimal" value={bio[k]} onChange={e=>setBio({...bio,[k]:e.target.value})}/>)}</div><Button variant="secondary" onClick={()=>setEditBio(false)}>Cancelar</Button></>
  :<div className="form-grid">{Object.entries(bioLabels).map(([k,l])=><div key={k} className="data-pair"><span>{l}</span><strong>{bio[k]||'—'}</strong></div>)}</div>}
</Card>}

{tab==='Medidas'&&<Card><div className="section-heading"><div><h2>Medidas corporais</h2>{!editMeasures&&<p>Todas as medidas em centímetros.</p>}</div>{editMeasures?<Button onClick={saveMeasures} className="btn-sm"><Save size={15}/> Salvar</Button>:<Button variant="secondary" onClick={()=>setEditMeasures(true)} className="btn-sm"><Pencil size={15}/> Editar</Button>}</div>
  <div className="measures-layout">
    <div className="body-silhouette"><img src={bodySvg} alt="Silhueta corporal com pontos de medida"/></div>
    <div className="measures-form">{editMeasures?<><div className="form-grid">{measureKeys.map(k=><Field key={k} label={measureLabels[k]+' (cm)'} type="text" inputMode="decimal" value={measures[k]} onChange={e=>setMeasures({...measures,[k]:e.target.value})}/>)}</div><Button variant="secondary" onClick={()=>setEditMeasures(false)}>Cancelar</Button></>
    :<div className="form-grid">{measureKeys.map(k=><div key={k} className="data-pair"><span>{measureLabels[k]}</span><strong>{measures[k]?measures[k]+' cm':'—'}</strong></div>)}</div>}</div>
  </div>
</Card>}

{tab==='Nutrição'&&<Card>
  <div className="section-heading"><div><h2>Preferências nutricionais</h2>{!editNutrition&&<p>Suas preferências para planos alimentares.</p>}</div>{editNutrition?<Button onClick={saveNutrition} className="btn-sm"><Save size={15}/> Salvar</Button>:<Button variant="secondary" onClick={()=>setEditNutrition(true)} className="btn-sm"><Pencil size={15}/> Editar</Button>}</div>
  {editNutrition?<>
  <div style={{marginBottom:24}}><label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:10}}>Fontes de proteína preferidas</label>
    <div className="chips">{proteinOpts.map(x=><button key={x} className={proteins.includes(x)?'selected':''} onClick={()=>toggleProt(x)}>{x}</button>)}</div>
    <div className="row" style={{gap:10,marginTop:8}}><Field label="" placeholder="Outra fonte..." value={customProtein} onChange={e=>setCustomProtein(e.target.value)}/>{customProtein&&<Button variant="secondary" onClick={()=>{setProteins(p=>[...p,customProtein]);setCustomProtein('')}}>+</Button>}</div>
    {proteins.filter(p=>!proteinOpts.includes(p)).length>0&&<div className="chips" style={{marginTop:10}}>{proteins.filter(p=>!proteinOpts.includes(p)).map(p=><button key={p} className="selected" onClick={()=>setProteins(prev=>prev.filter(x=>x!==p))}>{p} ×</button>)}</div>}
  </div>
  <Select label="Restrições alimentares" options={restrictOpts} value={restriction} onChange={e=>setRestriction(e.target.value)}/>
  {restriction==='personalizado'&&<Field label="Descreva suas restrições" value={customRestriction} onChange={e=>setCustomRestriction(e.target.value)} placeholder="Ex: Alergia a frutos do mar"/>}
  <div style={{marginTop:24}}><label style={{display:'block',fontSize:13,fontWeight:700,marginBottom:10}}>Horários das refeições</label>
    <div className="form-grid">{[['cafe','Café da manhã'],['lanche1','Lanche da manhã'],['almoco','Almoço'],['lanche2','Lanche da tarde'],['jantar','Jantar'],['ceia','Ceia']].map(([k,l])=><Field key={k} label={l} type="time" value={mealTimes[k]} onChange={e=>setMealTimes({...mealTimes,[k]:e.target.value})}/>)}</div>
  </div>
  <Button variant="secondary" onClick={()=>setEditNutrition(false)} style={{marginTop:16}}>Cancelar</Button>
  </>:<div className="form-grid">
    <div className="data-pair"><span>Fontes de proteína</span><strong>{proteins.length?proteins.join(', '):'—'}</strong></div>
    <div className="data-pair"><span>Restrições alimentares</span><strong>{restriction||'—'}</strong></div>
    {Object.entries(mealTimes).map(([k,v])=><div key={k} className="data-pair"><span>{{cafe:'Café da manhã',lanche1:'Lanche manhã',almoco:'Almoço',lanche2:'Lanche tarde',jantar:'Jantar',ceia:'Ceia'}[k]}</span><strong>{v}</strong></div>)}
  </div>}
</Card>}

{tab==='Gastos'&&<DietExpenses/>}

{tab==='Exames'&&<Card><div className="section-heading"><h2>Exames e laudos</h2></div><Empty icon={FileText} title="Em breve">Upload de exames será integrado em uma próxima versão.</Empty></Card>}

{tab==='Progresso'&&<><Card>
  <div className="section-heading"><h2>Evolução do peso</h2><Scale size={23}/></div>
  <WeightChart data={wh}/>
  {wh.length>0&&<div className="progress-numbers"><span>Inicial <b>{wh[0]?.weight} kg</b></span><span>Atual <b>{profile.weight_kg} kg</b></span><span>Variação <b>{(profile.weight_kg-wh[0]?.weight).toFixed(1)} kg</b></span></div>}
  <div className="inline-form"><Field label="Novo peso (kg)" type="text" inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)}/><Button onClick={addWeight}>Registrar peso</Button></div>
  {wh.length>0&&<details><summary>Ver últimos registros</summary>{wh.slice(-8).reverse().map((x,i)=><p key={i}>{formatDate(x.date)} · {x.weight} kg</p>)}</details>}
</Card><Card>
  <div className="section-heading"><div><h2>Fotos de progresso</h2></div><Button variant="secondary" onClick={()=>photoInput.current.click()}><ImagePlus size={18}/>Adicionar foto</Button><input hidden type="file" accept="image/jpeg,image/png,image/webp" ref={photoInput} onChange={addPhoto}/></div>
  {photos.length?<div className="photos">{photos.map((p,i)=><div key={i}><img src={p.url} alt={'Foto '+formatDate(p.date)}/><span>{formatDate(p.date)}</span></div>)}</div>:<Empty icon={ImagePlus} title="Veja o quanto você evoluiu">Adicione sua primeira foto para acompanhar sua evolução.</Empty>}
</Card></>}

{view&&<Modal title="Visualizar" onClose={()=>setView(null)}><img className="preview-image" src={view} alt="Preview"/></Modal>}
{showLogout&&<Confirm title="Deseja sair?" action="Sair" onClose={()=>setShowLogout(false)} onConfirm={()=>{logout();nav('/login')}}>Você será redirecionado para a tela de login.</Confirm>}
</>}
