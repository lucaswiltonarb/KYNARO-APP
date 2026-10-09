import React,{useEffect,useRef,useState} from 'react';
import {Check,PencilLine,Camera,Sparkles,Plus,X,Undo2,LoaderCircle,Lock,RefreshCw,SkipForward,Images,Clock} from 'lucide-react';
import {useApp} from '../context';
import {saveMealLog,deleteMealLog,estimateMeal,analyzeMealPhoto} from '../api';
import {Button,Modal,Badge,Confirm} from './ui';

export const MODE={
  conforme:{label:'Feita conforme a dieta',short:'Feita',tone:'green',Icon:Check},
  ajustada:{label:'Feita com ajustes',short:'Ajustada',tone:'',Icon:PencilLine},
  foto:{label:'Registrada por foto',short:'Por foto',tone:'blue',Icon:Camera},
  pulada:{label:'Refeição pulada',short:'Pulada',tone:'red',Icon:SkipForward},
};
const hhmm=iso=>iso?new Date(iso).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Sao_Paulo'}):'';
const diffLabel=(v,p)=>{if(!p||!v)return '';const d=v-p;return d===0?'igual ao plano':`${d>0?'+':''}${d} kcal vs plano`};
const num=v=>v===''||v==null?null:Math.round(Number(String(v).replace(',','.')))||0;

async function compress(file){
  try{
    const bmp=await createImageBitmap(file);const s=Math.min(1,1280/Math.max(bmp.width,bmp.height));
    const c=document.createElement('canvas');c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);
    c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
    const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.82));
    return blob?new File([blob],'prato.jpg',{type:'image/jpeg'}):file;
  }catch{return file}
}

export function MealLogger({meal,idx,date,log,locked,blockedBy,canUndo,onChange}){
  const {notify}=useApp();const [busy,setBusy]=useState(false);const [sheet,setSheet]=useState(null);const [picker,setPicker]=useState(false);const [ask,setAsk]=useState(null);
  const camRef=useRef();const galRef=useRef();
  const base={date,meal_idx:idx,meal_name:meal.name,planned_calories:meal.calories??null};
  const open=s=>setSheet({...s,id:Date.now()});
  async function quick(mode='conforme'){
    setBusy(true);
    try{onChange(await saveMealLog(mode==='pulada'?{...base,mode,calories:0,macros:{p:0,c:0,g:0},foods:[]}:{...base,mode,calories:meal.calories??null,macros:meal.macros||null,foods:meal.foods||[]}));notify(mode==='pulada'?`${meal.name} marcado como pulado.`:`${meal.name} registrado. Mandou bem!`)}
    catch(e){notify(e.message,true)}finally{setBusy(false)}
  }
  async function undo(){setBusy(true);try{await deleteMealLog(date,idx);onChange(null);notify('Registro desfeito.')}catch(e){notify(e.message,true)}finally{setBusy(false)}}
  const choose=ref=>{setPicker(false);ref.current.value='';ref.current.click()};
  const onFile=e=>{const f=e.target.files[0];if(f)open({mode:'foto',file:f})};
  const m=log&&MODE[log.mode];const diff=log?.mode!=='pulada'&&diffLabel(log?.calories,log?.planned_calories);

  return <div className="meal-logger">
    <input ref={camRef} hidden type="file" accept="image/*" capture="environment" onChange={onFile}/>
    <input ref={galRef} hidden type="file" accept="image/*" onChange={onFile}/>
    {log?<div className={'meal-log is-'+log.mode}>
      {log.photo_url?<img className="meal-log-photo" src={log.photo_url} alt="Foto do prato"/>:<span className="meal-log-icon"><m.Icon size={18}/></span>}
      <div className="meal-log-info">
        <strong>{m.label}</strong>
        <span>{log.mode==='pulada'?'Não entra no consumo do dia':`${log.calories??'—'} kcal${diff?` · ${diff}`:''}`}</span>
        {log.eaten_at&&<small className="meal-log-time"><Clock size={11}/>Registrada às {hhmm(log.eaten_at)}</small>}
        {(log.mode==='ajustada'||log.mode==='foto')&&log.foods?.length>0&&<small>{log.foods.slice(0,4).join(' · ')}{log.foods.length>4?' …':''}</small>}
      </div>
      <div className="meal-log-actions">
        {log.mode!=='pulada'&&<button className="icon-button" aria-label="Editar registro" onClick={()=>open({mode:'ajustada',from:log})}><PencilLine size={17}/></button>}
        {canUndo&&<button className="icon-button" aria-label="Desfazer registro" disabled={busy} onClick={undo}>{busy?<LoaderCircle className="spin" size={17}/>:<Undo2 size={17}/>}</button>}
      </div>
    </div>
    :locked?<p className="meal-locked"><Lock size={14}/>Você poderá registrar esta refeição no dia.</p>
    :blockedBy?<p className="meal-locked"><Lock size={14}/>Registre primeiro: {blockedBy}.</p>
    :<>
      <p className="meal-options-label">Como foi esta refeição?</p>
      <div className="meal-options">
        <button className="meal-option is-primary" disabled={busy} onClick={()=>setAsk('conforme')}><span className="mo-icon">{busy?<LoaderCircle className="spin" size={18}/>:<Check size={18}/>}</span><strong>Conforme a dieta</strong><small>Com 1 toque</small></button>
        <button className="meal-option" disabled={busy} onClick={()=>open({mode:'ajustada'})}><span className="mo-icon"><PencilLine size={18}/></span><strong>Comi diferente</strong><small>Ajustar itens</small></button>
        <button className="meal-option" disabled={busy} onClick={()=>setPicker(true)}><span className="mo-icon"><Camera size={18}/></span><strong>Foto do prato</strong><small>A IA calcula</small></button>
      </div>
      <button className="meal-skip" disabled={busy} onClick={()=>setAsk('pulada')}><SkipForward size={13}/>Não fiz esta refeição</button>
    </>}
    {ask==='conforme'&&<Confirm title={`Registrar ${meal.name.toLowerCase()}?`} action="Sim, registrar" variant="primary" onClose={()=>setAsk(null)} onConfirm={()=>{setAsk(null);quick()}}>Você comeu exatamente o que estava no plano: {(meal.foods||[]).join(', ')} · {meal.calories} kcal.</Confirm>}
    {ask==='pulada'&&<Confirm title={`Pular ${meal.name.toLowerCase()}?`} action="Sim, não fiz" onClose={()=>setAsk(null)} onConfirm={()=>{setAsk(null);quick('pulada')}}>A refeição será registrada como não realizada e não entra no consumo do dia.</Confirm>}
    {picker&&<Modal title={'Foto do prato · '+meal.name} onClose={()=>setPicker(false)}>
      <div className="photo-picker">
        <button onClick={()=>choose(camRef)}><span className="mo-icon"><Camera size={20}/></span><span><strong>Tirar foto agora</strong><small>Abre a câmera do celular</small></span></button>
        <button onClick={()=>choose(galRef)}><span className="mo-icon"><Images size={20}/></span><span><strong>Escolher da galeria</strong><small>Envie uma foto que você já tirou</small></span></button>
      </div>
      <p className="small muted" style={{margin:'14px 0 0'}}>Dica: fotografe de cima, com o prato inteiro e boa luz, para uma estimativa mais precisa.</p>
    </Modal>}
    {sheet&&<LogSheet key={sheet.id} sheet={sheet} meal={meal} base={base} onClose={()=>setSheet(null)} onRetake={()=>{setSheet(null);setPicker(true)}} onManual={()=>open({mode:'ajustada'})} onSaved={l=>{onChange(l);setSheet(null)}}/>}
  </div>;
}

function LogSheet({sheet,meal,base,onClose,onSaved,onRetake,onManual}){
  const {notify}=useApp();const from=sheet.from;const isPhoto=sheet.mode==='foto';
  const [foods,setFoods]=useState(()=>[...(from?.foods||meal.foods||[])]);
  const [kcal,setKcal]=useState(()=>String(from?.calories??meal.calories??''));
  const [macros,setMacros]=useState(()=>({...(from?.macros||meal.macros||{})}));
  const [estimating,setEstimating]=useState(false);const [stale,setStale]=useState(false);const [aiFilled,setAiFilled]=useState(false);
  const [phase,setPhase]=useState(isPhoto?'analyzing':'form');const [preview,setPreview]=useState(null);const [analysis,setAnalysis]=useState(null);const [photoUrl,setPhotoUrl]=useState(null);const [err,setErr]=useState('');
  const [saving,setSaving]=useState(false);

  const job=useRef(null);
  useEffect(()=>{
    if(!isPhoto)return;let alive=true;
    // StrictMode monta o efeito duas vezes; a análise (paga) roda uma vez só
    job.current??=compress(sheet.file).then(file=>({url:URL.createObjectURL(file),res:analyzeMealPhoto(file,{meal_name:meal.name,planned:(meal.foods||[]).join(', ')})}));
    job.current.then(async({url,res})=>{
      if(alive)setPreview(url);
      try{
        const r=await res;if(!alive)return;const a=r.analysis;setAnalysis(a);setPhotoUrl(r.photo_url);
        setFoods((a.foods||[]).map(f=>[f.name,f.qty].filter(Boolean).join(' — ')));setKcal(String(a.calories||''));setMacros(a.macros||{});setPhase('review');
      }catch(e){if(alive){setErr(e.message);setPhase('error')}}
    });
    return()=>{alive=false};
  },[]);

  const editFood=(i,v)=>{setFoods(f=>f.map((x,j)=>j===i?v:x));if(aiFilled)setStale(true)};
  const removeFood=i=>{setFoods(f=>f.filter((_,j)=>j!==i));if(aiFilled)setStale(true)};
  async function estimate(){
    const list=foods.filter(f=>f.trim());if(!list.length){notify('Adicione ao menos um alimento.',true);return}
    setEstimating(true);
    try{const r=await estimateMeal({meal_name:meal.name,foods:list});setKcal(String(r.calories));setMacros(r.macros);setAiFilled(true);setStale(false)}
    catch(e){notify(e.message,true)}finally{setEstimating(false)}
  }
  async function save(){
    const cal=num(kcal);if(!cal){notify('Informe as calorias ou calcule com a IA.',true);return}
    const keepPhoto=isPhoto||from?.mode==='foto';
    setSaving(true);
    try{onSaved(await saveMealLog({...base,mode:keepPhoto?'foto':'ajustada',calories:cal,macros:{p:num(macros.p)??0,c:num(macros.c)??0,g:num(macros.g)??0},foods:foods.map(f=>f.trim()).filter(Boolean),photo_url:isPhoto?photoUrl:from?.photo_url??null,ai_analysis:isPhoto?analysis:from?.ai_analysis??null}));notify(`${meal.name} registrado.`)}
    catch(e){notify(e.message,true)}finally{setSaving(false)}
  }

  const cal=num(kcal);
  const fields=<div className="intake-fields">
    <label className="kcal-field"><small>Calorias consumidas</small><span><input inputMode="numeric" value={kcal} onChange={e=>setKcal(e.target.value)} aria-label="Calorias consumidas"/><b>kcal</b></span></label>
    <div className="macro-inputs">{[['p','Proteína'],['c','Carboidrato'],['g','Gordura']].map(([k,l])=><label key={k}><small>{l}</small><span><input inputMode="numeric" value={macros[k]??''} onChange={e=>setMacros(m=>({...m,[k]:e.target.value}))} aria-label={l+' em gramas'}/><b>g</b></span></label>)}</div>
    <p className="plan-compare">Plano: <b>{meal.calories??'—'} kcal</b>{cal&&meal.calories?<span className={cal>meal.calories?'over':'under'}>{diffLabel(cal,meal.calories)}</span>:null}</p>
  </div>;

  return <Modal title={(isPhoto?'Foto do prato · ':from?'Editar · ':'Comi diferente · ')+meal.name} onClose={()=>!saving&&onClose()}>
    {isPhoto&&<div className={'meal-photo is-'+phase}>
      {preview?<img src={preview} alt="Prato enviado" onLoad={()=>URL.revokeObjectURL(preview)}/>:<div className="meal-photo-empty"/>}
      {phase==='analyzing'&&<div className="meal-photo-scan"><span className="scan-line"/><p><Sparkles size={16}/>Analisando seu prato…</p></div>}
    </div>}
    {phase==='error'&&<div className="ai-error"><p>{err}</p><div className="actions-row"><Button variant="secondary" onClick={onRetake}><RefreshCw size={16}/>Outra foto</Button><Button variant="secondary" onClick={onManual}><PencilLine size={16}/>Manual</Button></div></div>}
    {phase==='review'&&analysis&&<>
      <div className="ai-result">
        <div className="row between"><span className="ai-tag"><Sparkles size={14}/>Estimativa da IA</span>{analysis.confidence&&<Badge tone={/alta/i.test(analysis.confidence)?'green':/baixa/i.test(analysis.confidence)?'red':''}>Confiança {analysis.confidence}</Badge>}</div>
        <ul className="ai-foods">{(analysis.foods||[]).map((f,i)=><li key={i}><span>{f.name}{f.qty&&<small>{f.qty}</small>}</span><b>{f.calories} kcal</b></li>)}</ul>
        {analysis.notes&&<p className="small muted" style={{margin:'8px 0 0'}}>{analysis.notes}</p>}
      </div>
      {fields}
      <div className="actions-row"><Button variant="secondary" disabled={saving} onClick={onRetake}><Camera size={16}/>Outra foto</Button><Button busy={saving} onClick={save}><Check size={17}/>Confirmar</Button></div>
    </>}
    {phase==='form'&&<>
      <p className="sheet-hint">Ajuste os itens e as quantidades do que você realmente comeu.</p>
      <div className="food-edit">{foods.map((f,i)=><div key={i} className="food-edit-row"><input value={f} placeholder="Ex.: 150 g de arroz" onChange={e=>editFood(i,e.target.value)} aria-label={'Alimento '+(i+1)}/><button className="icon-button" aria-label="Remover alimento" onClick={()=>removeFood(i)}><X size={16}/></button></div>)}</div>
      <button className="link-button" onClick={()=>{setFoods(f=>[...f,'']);if(aiFilled)setStale(true)}}><Plus size={16}/>Adicionar alimento</button>
      <button className={'ai-estimate'+(stale?' is-stale':'')} disabled={estimating} onClick={estimate}>{estimating?<LoaderCircle className="spin" size={17}/>:<Sparkles size={17}/>}<span><strong>{estimating?'Calculando…':stale?'Recalcular com IA':'Calcular calorias com IA'}</strong><small>{stale?'Você alterou os itens desde o último cálculo':'Estimativa automática a partir dos itens'}</small></span></button>
      {fields}
      <div className="actions-row"><Button variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button><Button busy={saving} onClick={save}><Check size={17}/>Salvar</Button></div>
    </>}
  </Modal>;
}
