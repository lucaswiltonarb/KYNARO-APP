import React from 'react';
import {BrowserRouter,Routes,Route,Navigate} from 'react-router-dom';
import {Provider,useApp} from './context';
import {Logo} from './components/ui';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Nutrition from './pages/Nutrition';
import Workouts from './pages/Workouts';
import Session from './pages/Session';
import Challenges,{ChallengeInvite} from './pages/Challenges';
import ChallengeDetail from './pages/ChallengeDetail';
import Camera from './pages/Camera';
import Admin from './pages/Admin';
function Guard({children,admin=false}){const {user}=useApp();if(!user)return <Navigate to="/login" replace/>;if(!user.onboarding_done)return <Navigate to="/onboarding" replace/>;if(admin&&!user.is_admin)return <Navigate to="/" replace/>;return children}
function Router(){const {loading}=useApp();if(loading)return <div className="splash"><Logo/><span className="loader-line"/><p>Seu próximo passo começa aqui.</p></div>;return <BrowserRouter><Routes><Route path="/login" element={<Auth/>}/><Route path="/cadastro" element={<Auth register/>}/><Route path="/onboarding" element={<Onboarding/>}/><Route element={<Guard><Layout/></Guard>}><Route index element={<Dashboard/>}/><Route path="treinos" element={<Workouts/>}/><Route path="treinos/hoje" element={<Session/>}/><Route path="desafios" element={<Challenges/>}/><Route path="desafios/entrar/:code" element={<ChallengeInvite/>}/><Route path="desafios/:id" element={<ChallengeDetail/>}/><Route path="nutricao" element={<Nutrition/>}/><Route path="perfil" element={<Profile/>}/><Route path="camera/:id" element={<Camera/>}/><Route path="admin" element={<Guard admin><Admin/></Guard>}/></Route><Route path="*" element={<Navigate to="/" replace/>}/></Routes></BrowserRouter>}
export default function App(){return <Provider><Router/></Provider>}
