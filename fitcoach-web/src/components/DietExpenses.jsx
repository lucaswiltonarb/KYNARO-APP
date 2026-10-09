import React,{useEffect,useMemo,useState} from 'react';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid} from 'recharts';
import {Wallet,Trash2,ShoppingBag,Plus} from 'lucide-react';
import {useApp} from '../context';
import {getExpenses,addExpense,deleteExpense} from '../api';
import {Button,Card,Field,Empty,Loading,Modal,brl,parseMoney,today,formatDate} from './ui';

const iso=d=>d.toISOString().slice(0,10);
const shift=(days)=>{const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()-days);return iso(d)};
const PRESETS={
  'Este mês':()=>[today().slice(0,8)+'01',today()],
  '30 dias':()=>[shift(29),today()],
  '3 meses':()=>[shift(89),today()],
  'Este ano':()=>[today().slice(0,4)+'-01-01',today()],
  'Tudo':()=>['0000-00-00',today()],
};
const MONTHS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

export default function DietExpenses(){
  const {notify}=useApp();const [all,setAll]=useState(null);const [preset,setPreset]=useState('Este mês');
  const [custom,setCustom]=useState({start:shift(29),end:today()});const [adding,setAdding]=useState(false);
  useEffect(()=>{getExpenses().then(setAll).catch(e=>{setAll([]);notify(e.message,true)})},[]);
  const [start,end]=preset==='Personalizado'?[custom.start,custom.end]:PRESETS[preset]();
  const rows=useMemo(()=>(all||[]).filter(e=>e.date>=start&&e.date<=end),[all,start,end]);
  const total=rows.reduce((a,e)=>a+e.amount,0);
  const spanDays=Math.max(1,Math.round((new Date(end)-new Date(rows.length&&preset==='Tudo'?rows[rows.length-1].date:start))/864e5)+1);
  const byMonth=spanDays>62;
  const chart=useMemo(()=>{
    const m=new Map();
    [...rows].reverse().forEach(e=>{
      let k,label;
      if(byMonth){k=e.date.slice(0,7);label=MONTHS[+e.date.slice(5,7)-1]+'/'+e.date.slice(2,4)}
      else{const d=new Date(e.date+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);k=iso(d);label=k.slice(8)+'/'+k.slice(5,7)}
      m.set(k,{label,valor:(m.get(k)?.valor||0)+e.amount});
    });
    return [...m.values()].map(x=>({...x,valor:Math.round(x.valor*100)/100}));
  },[rows,byMonth]);
  async function remove(id){try{await deleteExpense(id);setAll(a=>a.filter(e=>e.id!==id));notify('Gasto removido.')}catch(e){notify(e.message,true)}}

  if(!all)return <Loading label="Carregando gastos…"/>;
  return <>
    <Card>
      <div className="section-heading"><div><h2>Gastos com a dieta</h2><p>Acompanhe quanto você investe na sua alimentação.</p></div><Button variant="secondary" className="btn-sm" onClick={()=>setAdding(true)}><Plus size={15}/>Gasto</Button></div>
      <div className="filter-pills" role="tablist" aria-label="Período">{[...Object.keys(PRESETS),'Personalizado'].map(p=><button key={p} role="tab" aria-selected={preset===p} className={preset===p?'active':''} onClick={()=>setPreset(p)}>{p}</button>)}</div>
      {preset==='Personalizado'&&<div className="form-grid"><Field label="De" type="date" value={custom.start} max={custom.end} onChange={e=>setCustom(c=>({...c,start:e.target.value}))}/><Field label="Até" type="date" value={custom.end} min={custom.start} max={today()} onChange={e=>setCustom(c=>({...c,end:e.target.value}))}/></div>}
      <div className="expense-stats">
        <div className="is-main"><small>Total no período</small><strong>{brl(total)}</strong></div>
        <div><small>Compras</small><strong>{rows.length}</strong></div>
        <div><small>Média por compra</small><strong>{brl(rows.length?total/rows.length:0)}</strong></div>
        <div><small>Média por semana</small><strong>{brl(total/Math.max(1,spanDays/7))}</strong></div>
      </div>
      {chart.length>0&&<div className="chart" role="img" aria-label={'Gastos por '+(byMonth?'mês':'semana')+': '+chart.map(c=>`${c.label} ${brl(c.valor)}`).join(', ')}><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} margin={{top:12,right:6,bottom:0,left:-12}}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5"/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}}/><YAxis tickLine={false} axisLine={false} tick={{fill:'var(--muted)',fontSize:11}} tickFormatter={v=>'R$'+v}/><Tooltip cursor={{fill:'var(--input)'}} contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12}} formatter={v=>[brl(v),byMonth?'No mês':'Na semana']} labelFormatter={l=>(byMonth?'':'Semana de ')+l}/><Bar dataKey="valor" fill="var(--primary)" radius={[8,8,0,0]} maxBarSize={42}/></BarChart></ResponsiveContainer></div>}
    </Card>
    <Card>
      <div className="section-heading"><h2>Histórico de compras</h2><Wallet size={22}/></div>
      {rows.length?rows.map(e=><div key={e.id} className="expense-row"><span className="mo-icon"><ShoppingBag size={16}/></span><div><strong>{brl(e.amount)}</strong><small>{formatDate(e.date)}{e.store?` · ${e.store}`:''}{e.items_count?` · ${e.items_count} itens`:''}</small></div><button className="icon-button" aria-label="Remover gasto" onClick={()=>remove(e.id)}><Trash2 size={16}/></button></div>)
      :<Empty icon={Wallet} title="Nenhum gasto no período">Registre o valor da compra ao finalizar sua lista de compras na aba Nutrição.</Empty>}
    </Card>
    {adding&&<AddExpense onClose={()=>setAdding(false)} onAdded={e=>{setAll(a=>[e,...a]);setAdding(false)}}/>}
  </>;
}

function AddExpense({onClose,onAdded}){
  const {notify}=useApp();const [amount,setAmount]=useState('');const [store,setStore]=useState('');const [date,setDate]=useState(today());const [saving,setSaving]=useState(false);
  async function save(){const v=parseMoney(amount);if(!v||v<=0){notify('Informe o valor gasto.',true);return}setSaving(true);try{onAdded(await addExpense({date,amount:v,store:store||null}));notify(`Gasto de ${brl(v)} registrado.`)}catch(e){notify(e.message,true)}finally{setSaving(false)}}
  return <Modal title="Registrar gasto" onClose={()=>!saving&&onClose()}>
    <label className="money-field"><small>Valor</small><span><b>R$</b><input autoFocus inputMode="decimal" placeholder="0,00" value={amount} onChange={e=>setAmount(e.target.value)} aria-label="Valor em reais"/></span></label>
    <div className="form-grid"><Field label="Mercado (opcional)" value={store} onChange={e=>setStore(e.target.value)}/><Field label="Data" type="date" max={today()} value={date} onChange={e=>setDate(e.target.value)}/></div>
    <div className="actions-row"><Button variant="secondary" disabled={saving} onClick={onClose}>Cancelar</Button><Button busy={saving} onClick={save}>Registrar</Button></div>
  </Modal>;
}
