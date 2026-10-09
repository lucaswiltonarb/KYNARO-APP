import React,{useState,useEffect} from 'react';
import {Sparkles,Utensils,ShoppingBag,ChefHat,Clock,Copy,Check,Coffee,CheckCheck,Wallet,Trash2,Lightbulb,RefreshCw} from 'lucide-react';
import {useApp} from '../context';
import {getNutritionPlan,generateNutrition,setShopping,getMealLogs,getDayRecipes,getExpenses,addExpense,deleteExpense,jp} from '../api';
import {Button,Card,Tabs,Badge,PageTitle,Accordion,Loading,Empty,Modal,Field,today,formatDate,brl,parseMoney} from '../components/ui';
import {MealLogger,MODE} from '../components/MealLogger';
import {weekStart} from '../session';
const dayNames=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
const fullDay=d=>/^S[aá]b|^Dom/.test(d)?d:d+'-feira';
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const recipeJobs={};
export default function Nutrition(){const {notify}=useApp();const [plan,setPlan]=useState(null);const [loading,setLoading]=useState(true);const [tab,setTab]=useState('Cardápio');const [day,setDay]=useState(dayNames[(new Date().getDay()+6)%7]);const [busy,setBusy]=useState(false);const [share,setShare]=useState(false);const [shopping,setShopList]=useState([]);const [logs,setLogs]=useState([]);const [expenses,setExpenses]=useState([]);
useEffect(()=>{const ws=weekStart();Promise.all([getNutritionPlan(),getMealLogs(ws,addDays(ws,6)).catch(()=>[]),getExpenses().catch(()=>[])]).then(([r,l,e])=>{setPlan(r.plan);setShopList(r.plan?.grocery_checked||[]);setLogs(Array.isArray(l)?l:[]);setExpenses(Array.isArray(e)?e:[])}).catch(()=>notify('Erro ao carregar plano nutricional.',true)).finally(()=>setLoading(false))},[]);
async function saveChecked(next){const prev=shopping;setShopList(next);try{await setShopping(next)}catch(e){setShopList(prev);notify('Não foi possível salvar a lista. '+e.message,true)}}
const toggleItem=name=>saveChecked(shopping.includes(name)?shopping.filter(v=>v!==name):[...shopping,name]);
async function generate(){setBusy(true);try{const r=await generateNutrition();setPlan(r.plan);setShopList([]);notify('Plano alimentar gerado com sucesso!')}catch(e){notify(e.message||'Erro ao gerar plano.',true)}finally{setBusy(false)}}
if(loading)return <Loading label="Carregando plano alimentar…"/>;
const days=jp(plan?.data,[]);const groceries=jp(plan?.grocery_list,[]);const totalCal=plan?.total_calories||0;
const dayData=days.find(d=>d.day===day)||days[0];const meals=dayData?.meals||[];
const date=addDays(weekStart(),dayNames.indexOf(day));const future=date>today();const isTodaySel=date===today();
const logFor=i=>logs.find(l=>l.date===date&&l.meal_idx===i);
const setLog=i=>l=>setLogs(ls=>[...ls.filter(x=>!(x.date===date&&x.meal_idx===i)),...(l?[l]:[])]);
const dayLogs=logs.filter(l=>l.date===date);const consumed=dayLogs.reduce((a,l)=>a+(l.calories||0),0);
const planned=meals.reduce((a,m)=>a+(m.calories||0),0)||totalCal;const pct=planned?Math.min(100,Math.round(consumed/planned*100)):0;
const pendingIdx=meals.findIndex((_,i)=>!logFor(i));const lastLogged=pendingIdx<0?meals.length-1:pendingIdx-1;
const firstOpen=future?0:Math.max(0,pendingIdx);
const macros=meals.reduce((a,m)=>({p:a.p+(m.macros?.p||0),c:a.c+(m.macros?.c||0),g:a.g+(m.macros?.g||0)}),{p:0,c:0,g:0});
const items=Array.isArray(groceries)?groceries:[];
const text=items.map(x=>`${shopping.includes(x.item)?'[x]':'[ ]'} ${x.item} ${x.qty||''}`).join('\n');
const daysBar=<div className="days">{dayNames.map(d=><button key={d} className={day===d?'selected':''} onClick={()=>setDay(d)} aria-pressed={day===d}><span>{d.slice(0,3)}</span></button>)}</div>;
const planExpenses=expenses.filter(e=>e.meal_plan_id===plan?.id);
return <><PageTitle title="Minha alimentação" subtitle="Mais equilíbrio, do café da manhã ao jantar." action={<Button busy={busy} onClick={generate}><Sparkles size={18}/>{plan?'Gerar novo plano':'Gerar meu plano'}</Button>}/><Tabs items={['Cardápio','Lista de compras','Receitas']} value={tab} onChange={setTab}/>{busy?<Loading label="Gerando cardápio com IA…"/>:!plan?<Empty icon={Utensils} title="Nenhum plano alimentar gerado" action={<Button onClick={generate}>Gerar minha dieta personalizada</Button>}>Complete seu perfil e gere seu primeiro plano.</Empty>:tab==='Cardápio'?<><Card className="nutrition-summary"><div className="ns-goal"><span className="ns-icon"><Utensils size={20}/></span><p>Meta calórica diária</p><strong>{totalCal.toLocaleString('pt-BR')}</strong><small>kcal por dia</small></div><div className="ns-macros">{(()=>{const kcal=macros.p*4+macros.c*4+macros.g*9||1;return [['Proteína',macros.p,4,'blue'],['Carboidrato',macros.c,4,'orange'],['Gordura',macros.g,9,'red']].map(([l,v,k,c])=>{const pct=Math.round(v*k/kcal*100);return <div key={l} className={'ns-macro is-'+c}><div className="ns-row"><span><i className={'macro-dot '+c}/>{l}</span><b>{v}<small>g</small></b></div><div className="ns-bar"><span style={{width:pct+'%'}}/></div><small className="ns-pct">{pct}% das calorias</small></div>})})()}</div></Card>{daysBar}{!future&&meals.length>0&&<Card className="intake-card"><div className="intake-ring" style={{'--pct':pct}}><strong>{pct}%</strong></div><div className="intake-info"><small>{isTodaySel?'Hoje você consumiu':`${fullDay(day)}: você consumiu`}</small><strong>{consumed.toLocaleString('pt-BR')} <span>de {planned.toLocaleString('pt-BR')} kcal</span></strong><div className="intake-dots" aria-label={`${dayLogs.length} de ${meals.length} refeições registradas`}>{meals.map((_,i)=>{const l=logFor(i);return <span key={i} className={l?'is-'+l.mode:''}/>})}</div><small>{dayLogs.length} de {meals.length} refeições registradas</small></div></Card>}
<div className="section-heading"><h2>{fullDay(day)} no seu prato</h2>{isTodaySel?<Badge tone="green">Hoje</Badge>:<Badge>{meals.length} refeições</Badge>}</div><div className="meal-list">{meals.map((r,i)=>{const l=logFor(i);const M=l&&MODE[l.mode];return <Accordion key={`${day}-${i}`} className={l?'meal-done':''} defaultOpen={i===firstOpen} title={<div className="row"><span className={'meal-icon color-'+i}>{l?<M.Icon/>:i===0?<Coffee/>:<Utensils/>}</span><span><strong className="block">{r.name}</strong>{r.time&&<small className="muted">{r.time}</small>}</span></div>} detail={l?<Badge tone={M.tone}>{M.short} · {l.calories} kcal</Badge>:<strong>{r.calories} <small>kcal</small></strong>}><ul className="food-list">{(r.foods||[]).map(a=><li key={a}><Check size={16}/>{a}</li>)}</ul>{r.macros&&<div className="chips"><Badge tone="blue">Proteína {r.macros.p}g</Badge><Badge>Carboidrato {r.macros.c}g</Badge><Badge tone="red">Gordura {r.macros.g}g</Badge></div>}<MealLogger meal={r} idx={i} date={date} log={l} locked={future} blockedBy={!l&&i>pendingIdx?meals[pendingIdx]?.name:null} canUndo={i===lastLogged} onChange={setLog(i)}/></Accordion>})}</div></>:tab==='Lista de compras'?<Card><div className="section-heading"><div><h2>Sua lista da semana</h2><p>{shopping.length} de {items.length} itens comprados</p></div><Button variant="secondary" onClick={()=>setShare(true)}><Copy size={17}/>Compartilhar lista</Button></div><progress max={items.length||1} value={shopping.length}/>{items.map(x=><label className={'shopping-item '+(shopping.includes(x.item)?'bought':'')} key={x.item}><input type="checkbox" checked={shopping.includes(x.item)} onChange={()=>toggleItem(x.item)}/><span>{x.item}</span><strong>{x.qty}</strong></label>)}{!items.length&&<Empty icon={ShoppingBag} title="Lista vazia">Gere um plano alimentar para ver sua lista de compras.</Empty>}
{items.length>0&&<Checkout total={items.length} checked={shopping.length} onCheckAll={()=>saveChecked(items.map(x=>x.item))} expenses={planExpenses} onAdded={e=>setExpenses(x=>[e,...x])} onRemoved={id=>setExpenses(x=>x.filter(e=>e.id!==id))}/>}</Card>
:<>{daysBar}<DayRecipes key={day} day={day} meals={meals} cached={plan?.day_recipes?.[day]} onLoaded={r=>setPlan(p=>({...p,day_recipes:{...(p.day_recipes||{}),[day]:r}}))}/></>}{share&&<Modal title="Compartilhar lista de compras" onClose={()=>setShare(false)}><textarea className="resize-none" readOnly rows={10} aria-label="Lista de compras" value={text}/><Button onClick={async()=>{try{await navigator.clipboard.writeText(text);notify('Lista copiada!');setShare(false)}catch{notify('Selecione o texto acima e copie manualmente.',true)}}}>Copiar lista</Button></Modal>}</>}

function DayRecipes({day,meals,cached,onLoaded}){
  const {notify}=useApp();const [err,setErr]=useState('');const [tries,setTries]=useState(0);
  useEffect(()=>{
    if(cached||!meals.length)return;let alive=true;setErr('');
    // StrictMode monta duas vezes; uma chamada de IA por dia
    recipeJobs[day]??=getDayRecipes(day).finally(()=>{delete recipeJobs[day]});
    recipeJobs[day].then(r=>alive&&onLoaded(r.recipes)).catch(e=>{if(alive){setErr(e.message);notify(e.message,true)}});
    return()=>{alive=false};
  },[tries]);
  if(!meals.length)return <Empty icon={ChefHat} title="Sem refeições neste dia">Não há refeições planejadas para {fullDay(day).toLowerCase()}.</Empty>;
  if(err)return <Empty icon={ChefHat} title="Não foi possível preparar as receitas" action={<Button onClick={()=>setTries(t=>t+1)}><RefreshCw size={17}/>Tentar novamente</Button>}>{err}</Empty>;
  if(!cached)return <Loading label={`Preparando as receitas de ${fullDay(day).toLowerCase()}…`}/>;
  return <><div className="section-heading"><div><h2>Receitas de {fullDay(day).toLowerCase()}</h2><p>Uma receita para cada refeição do seu plano.</p></div><Badge>{cached.length} receitas</Badge></div>
    <div className="meal-list">{cached.map((r,i)=>{const m=meals[r.meal_idx]||{};return <Accordion key={i} defaultOpen={i===0} title={<div className="row"><span className={'meal-icon color-'+(r.meal_idx??i)}><ChefHat/></span><span><small className="recipe-meal">{m.name||'Refeição'}</small><strong className="block">{r.name}</strong></span></div>} detail={<span className="recipe-meta">{r.prep_min?<Badge><Clock size={12}/>{r.prep_min} min</Badge>:null}</span>}>
      <h3 className="recipe-sub">Ingredientes</h3><ul className="food-list">{(r.ingredients||[]).map(x=><li key={x}><Check size={16}/>{x}</li>)}</ul>
      <h3 className="recipe-sub">Modo de preparo</h3><ol className="recipe-steps">{(r.steps||[]).map((x,k)=><li key={k}>{x}</li>)}</ol>
      {r.tip&&<p className="notice recipe-tip"><Lightbulb size={15}/>{r.tip}</p>}
      {m.calories&&<p className="small muted" style={{margin:'12px 0 0'}}>{m.calories} kcal previstas no plano</p>}
    </Accordion>})}</div></>;
}

function Checkout({total,checked,onCheckAll,expenses,onAdded,onRemoved}){
  const {notify}=useApp();const [amount,setAmount]=useState('');const [store,setStore]=useState('');const [date,setDate]=useState(today());const [saving,setSaving]=useState(false);
  const all=checked>=total;const spent=expenses.reduce((a,e)=>a+e.amount,0);
  async function save(){
    const v=parseMoney(amount);if(!v||v<=0){notify('Informe o valor gasto na compra.',true);return}
    setSaving(true);
    try{onAdded(await addExpense({date,amount:v,store:store||null,items_count:checked}));setAmount('');setStore('');notify(`Compra de ${brl(v)} registrada.`)}
    catch(e){notify(e.message,true)}finally{setSaving(false)}
  }
  async function remove(id){try{await deleteExpense(id);onRemoved(id);notify('Gasto removido.')}catch(e){notify(e.message,true)}}
  return <div className="checkout">
    <div className="checkout-head"><span className="mo-icon"><ShoppingBag size={18}/></span><div><strong>Finalizar compra</strong><small>{all?'Todos os itens foram comprados.':`${total-checked} ${total-checked===1?'item pendente':'itens pendentes'}`}</small></div></div>
    {!all&&<Button variant="secondary" className="full" onClick={onCheckAll}><CheckCheck size={17}/>Marcar todos como comprados</Button>}
    <div className="checkout-form">
      <label className="money-field"><small>Quanto você gastou?</small><span><b>R$</b><input inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} aria-label="Valor gasto em reais"/></span></label>
      <div className="form-grid"><Field label="Mercado (opcional)" placeholder="Ex.: Atacadão" value={store} onChange={e=>setStore(e.target.value)}/><Field label="Data da compra" type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)}/></div>
      <Button className="full" busy={saving} onClick={save}><Wallet size={17}/>Registrar gasto</Button>
    </div>
    {expenses.length>0&&<div className="checkout-list">
      <div className="row between"><small>Gastos desta lista</small><strong>{brl(spent)}</strong></div>
      {expenses.map(e=><div key={e.id} className="expense-row"><div><strong>{brl(e.amount)}</strong><small>{formatDate(e.date)}{e.store?` · ${e.store}`:''}</small></div><button className="icon-button" aria-label="Remover gasto" onClick={()=>remove(e.id)}><Trash2 size={16}/></button></div>)}
    </div>}
  </div>;
}
