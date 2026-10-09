import React,{createContext,useContext,useState,useEffect,useRef} from 'react';
import {X,CheckCircle,AlertCircle} from 'lucide-react';
import {getToken,setToken as saveToken,clearToken,authMe,authLogin,authRegister} from './api';
const Context=createContext();
export function Provider({children}){
  const [user,setUser]=useState(null);
  const [loading,setLoading]=useState(true);
  const [theme,setTheme]=useState(()=>localStorage.getItem('kynaro-theme')||'light');
  const [toast,setToast]=useState(null);
  const timer=useRef();
  const notify=(message,error=false)=>{clearTimeout(timer.current);setToast({message,error});timer.current=setTimeout(()=>setToast(null),4000)};
  useEffect(()=>{const token=getToken();if(!token){setLoading(false);return}authMe().then(setUser).catch(()=>clearToken()).finally(()=>setLoading(false))},[]);
  useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem('kynaro-theme',theme)},[theme]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  async function login(email,password){const res=await authLogin(email,password);saveToken(res.token);setUser(res.user);return res.user}
  async function register(name,email,password){const res=await authRegister(name,email,password);saveToken(res.token);setUser(res.user);return res.user}
  function logout(){clearToken();setUser(null)}
  function refreshUser(){return authMe().then(u=>{setUser(u);return u}).catch(()=>{clearToken();setUser(null)})}
  return <Context.Provider value={{user,setUser,loading,login,register,logout,refreshUser,theme,setTheme,notify}}>{children}{toast&&<div className={`toast ${toast.error?'error-toast':''}`} role={toast.error?'alert':'status'}>{toast.error?<AlertCircle size={20}/>:<CheckCircle size={20}/>}<span>{toast.message}</span><button onClick={()=>setToast(null)} aria-label="Fechar aviso"><X size={18}/></button></div>}</Context.Provider>
}
export const useApp=()=>useContext(Context);
