import {today} from './components/ui';

const WD=['dom','seg','ter','qua','qui','sex','sab'];
const norm=s=>(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();

export const dayName=d=>d?.name||d?.day;
export const isClosed=s=>s.done||s.skipped;
export const exClosed=arr=>arr.every(isClosed);
export const started=st=>!!st?.begun||!!st?.sets?.some(a=>a.some(isClosed));
export const progress=st=>({done:st.sets.filter(exClosed).length,total:st.sets.length});

const activeOf=sessions=>sessions.filter(s=>s.status==='em_andamento'&&s.date===today());
export const sessionFor=(sessions,i)=>activeOf(sessions).find(s=>s.day_idx===i);

export function weekStart(){const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return d.toISOString().slice(0,10)}
export function isDayDone(days,i,checkins){
  const name=dayName(days[i]);const ws=weekStart();
  const n=checkins.filter(c=>c.day_name===name&&c.date>=ws).length;
  return n>=days.slice(0,i+1).filter(d=>dayName(d)===name).length;
}

const monIdx=d=>{const i=WD.findIndex(w=>norm(d?.day).startsWith(w));return i<0?-1:(i+6)%7};
const todayMon=()=>(new Date().getDay()+6)%7;
export const isToday=d=>monIdx(d)===todayMon();
export const isFuture=d=>monIdx(d)>todayMon();
export const onDay=d=>(/^(s[aá]b|dom)/i.test(d?.day||'')?'no ':'na ')+d?.day;

export function activeIdx(days,sessions){
  for(const s of activeOf(sessions)){
    const i=dayName(days[s.day_idx])===s.day_name?s.day_idx:days.findIndex(d=>dayName(d)===s.day_name);
    if(i>=0&&!isFuture(days[i]))return i;
  }
  return -1;
}

export function currentDayIdx(days,checkins,sessions){
  const a=activeIdx(days,sessions);if(a>=0)return a;
  const t=days.findIndex(isToday);
  return t>=0&&days[t].exercises?.length&&!isDayDone(days,t,checkins)?t:-1;
}

export const nextUpcoming=(days,checkins)=>days.findIndex((d,i)=>d.exercises?.length&&isFuture(d)&&!isDayDone(days,i,checkins));
