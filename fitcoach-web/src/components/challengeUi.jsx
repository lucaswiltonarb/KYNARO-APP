import React from 'react';
import {Copy,Share2} from 'lucide-react';
import {useApp} from '../context';
import {Button,Modal,today} from './ui';

export const SCORING={dias:{label:'Dias ativos',unit:'dias',hint:'1 ponto por dia com treino registrado'},treinos:{label:'Treinos',unit:'treinos',hint:'1 ponto por check-in de treino'},minutos:{label:'Minutos',unit:'min',hint:'1 ponto por minuto treinado'}};
const d0=s=>new Date(s+'T12:00:00');
export const daysBetween=(a,b)=>Math.round((d0(b)-d0(a))/864e5);
export const shortDate=s=>d0(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','');
export function timeInfo(c){
  const t=today();const total=daysBetween(c.start_date,c.end_date)+1;
  if(t<c.start_date){const n=daysBetween(t,c.start_date);return {label:n===1?'Começa amanhã':`Começa em ${n} dias`,pct:0}}
  if(t>c.end_date)return {label:'Encerrado',pct:100};
  const left=daysBetween(t,c.end_date);return {label:left===0?'Último dia!':left===1?'Termina amanhã':`${left} dias restantes`,pct:Math.round((daysBetween(c.start_date,t)+1)/total*100)};
}
export const STATUS={ativo:{label:'Em andamento',tone:'green'},em_breve:{label:'Em breve',tone:'blue'},encerrado:{label:'Encerrado',tone:''}};

export function Person({p,size=36,className=''}){
  const initials=(p?.name||'?').split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();
  return p?.avatar_url?<img className={'person '+className} src={p.avatar_url} alt={p.name} style={{width:size,height:size}}/>
    :<span className={'person '+className} style={{width:size,height:size,fontSize:size*.36}} aria-label={p?.name}>{initials}</span>;
}

export function InviteSheet({challenge,onClose}){
  const {notify}=useApp();const link=`${location.origin}/desafios/entrar/${challenge.invite_code}`;
  const copy=async(text,msg)=>{try{await navigator.clipboard.writeText(text);notify(msg)}catch{notify('Não foi possível copiar. Copie manualmente.',true)}};
  async function share(){
    const text=`Entra no meu desafio "${challenge.name}" no Kynaro! Código: ${challenge.invite_code}`;
    if(navigator.share){try{await navigator.share({title:challenge.name,text,url:link})}catch{}}else copy(`${text}\n${link}`,'Convite copiado!');
  }
  return <Modal title="Convidar para o desafio" onClose={onClose}>
    <p style={{marginTop:0}}>Compartilhe o código ou o link. Não há limite de participantes.</p>
    <button className="invite-code" onClick={()=>copy(challenge.invite_code,'Código copiado!')} aria-label="Copiar código">{challenge.invite_code.split('').map((ch,i)=><span key={i}>{ch}</span>)}</button>
    <div className="actions-row"><Button variant="secondary" onClick={()=>copy(link,'Link copiado!')}><Copy size={16}/>Copiar link</Button><Button onClick={share}><Share2 size={16}/>Compartilhar</Button></div>
  </Modal>;
}
