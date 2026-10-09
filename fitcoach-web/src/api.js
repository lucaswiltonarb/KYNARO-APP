export function jp(v,fb){try{return typeof v==='string'?JSON.parse(v):v??fb}catch{return fb}}
const TOKEN_KEY='kynaro-token';
export function getToken(){return localStorage.getItem(TOKEN_KEY)}
export function setToken(t){localStorage.setItem(TOKEN_KEY,t)}
export function clearToken(){localStorage.removeItem(TOKEN_KEY)}

export async function api(path,opts={}){
  const token=getToken();
  const headers={...opts.headers};
  if(token)headers['Authorization']=`Bearer ${token}`;
  if(opts.body&&!(opts.body instanceof FormData)){headers['Content-Type']='application/json';opts={...opts,body:JSON.stringify(opts.body)}}
  const res=await fetch(path,{...opts,headers});
  if(res.status===401){clearToken();window.location.href='/login';throw new Error('Sessão expirada')}
  if(!res.ok){const err=await res.json().catch(()=>({}));throw new Error(err.detail||`Erro ${res.status}`)}
  return res.json();
}

export const authLogin=(email,password)=>api('/api/auth/login',{method:'POST',body:{email,password}});
export const authRegister=(name,email,password)=>api('/api/auth/register',{method:'POST',body:{email,password,name}});
export const authMe=()=>api('/api/auth/me');

export const getProfile=()=>api('/api/profile');
export const updateProfile=data=>api('/api/profile',{method:'PUT',body:data});
export const submitOnboarding=data=>api('/api/profile/onboarding',{method:'POST',body:data});
export const logWeight=weight=>api(`/api/profile/weight?weight=${weight}`,{method:'POST'});
export const uploadPhoto=file=>{const fd=new FormData();fd.append('file',file);return api('/api/profile/photo',{method:'POST',body:fd})};
export const uploadAvatar=file=>{const fd=new FormData();fd.append('file',file);return api('/api/profile/avatar',{method:'POST',body:fd})};
export const setWater=(date,liters)=>api('/api/profile/water',{method:'PUT',body:{date,liters}});
export const getMealLogs=(start,end)=>api(`/api/nutrition/logs?start=${start}&end=${end}`);
export const saveMealLog=data=>api('/api/nutrition/log',{method:'PUT',body:data});
export const deleteMealLog=(date,idx)=>api(`/api/nutrition/log?date=${date}&meal_idx=${idx}`,{method:'DELETE'});
export const estimateMeal=data=>api('/api/nutrition/estimate',{method:'POST',body:data});
export const analyzeMealPhoto=(file,meta)=>{const fd=new FormData();fd.append('file',file);Object.entries(meta).forEach(([k,v])=>fd.append(k,v));return api('/api/nutrition/analyze-photo',{method:'POST',body:fd})};
export const getDayRecipes=day=>api(`/api/nutrition/recipes/${encodeURIComponent(day)}`,{method:'POST'});
export const getExpenses=(start,end)=>api(`/api/nutrition/expenses${start?`?start=${start}&end=${end}`:''}`);
export const addExpense=data=>api('/api/nutrition/expenses',{method:'POST',body:data});
export const deleteExpense=id=>api(`/api/nutrition/expenses/${id}`,{method:'DELETE'});
export const setShopping=checked=>api('/api/nutrition/shopping',{method:'PUT',body:{checked}});

export const getNutritionPlan=()=>api('/api/nutrition/plan');
export const generateNutrition=()=>api('/api/nutrition/generate',{method:'POST'});

export const getWorkoutPlan=()=>api('/api/workout/plan');
export const generateWorkout=()=>api('/api/workout/generate',{method:'POST'});
export const postCheckin=data=>api('/api/workout/checkin',{method:'POST',body:data});
export const getCheckins=()=>api('/api/workout/checkins');
export const getSessions=date=>api(`/api/workout/sessions?date=${date}`);
export const saveSession=data=>api('/api/workout/session',{method:'PUT',body:data});

export const getChallenges=()=>api('/api/challenges');
export const createChallenge=data=>api('/api/challenges',{method:'POST',body:data});
export const previewChallenge=code=>api(`/api/challenges/preview/${encodeURIComponent(code)}`);
export const joinChallenge=code=>api('/api/challenges/join',{method:'POST',body:{code}});
export const getChallenge=id=>api(`/api/challenges/${id}`);
export const getChallengeFeed=id=>api(`/api/challenges/${id}/feed`);
export const getChallengeMessages=(id,after=0)=>api(`/api/challenges/${id}/messages?after=${after}`);
export const sendChallengeMessage=(id,text)=>api(`/api/challenges/${id}/messages`,{method:'POST',body:{text}});
export const leaveChallenge=id=>api(`/api/challenges/${id}/leave`,{method:'DELETE'});
export const deleteChallenge=id=>api(`/api/challenges/${id}`,{method:'DELETE'});

export const getUsers=()=>api('/api/admin/users');
export const toggleAdmin=(user_id,is_admin)=>api('/api/admin/users/toggle-admin',{method:'POST',body:{user_id,is_admin}});
export const deleteUser=user_id=>api(`/api/admin/users/${user_id}`,{method:'DELETE'});
export const getAdminSettings=()=>api('/api/admin/settings');
export const getModels=()=>api('/api/admin/models');
export const updateSettings=data=>api('/api/admin/settings',{method:'PUT',body:data});

export const getExercises=()=>api('/api/exercises');
export const getExercise=name=>api(`/api/exercises/${name}`);
export const getExerciseDefinition=name=>api(`/api/exercises/${name}/definition`);
export const analyzeExerciseVideo=(name,file)=>{const fd=new FormData();fd.append('file',file);return api(`/api/exercises/${name}/analyze`,{method:'POST',body:fd})};
export const getAnalysis=job=>api(`/api/exercises/analysis/${job}`);
export const saveCameraSession=(name,data)=>api(`/api/exercises/${name}/sessions`,{method:'POST',body:data});
