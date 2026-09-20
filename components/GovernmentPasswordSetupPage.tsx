import React,{useState} from 'react';
import {KeyRound,LogOut,ShieldCheck} from 'lucide-react';
import {getSupabaseClient} from '../src/lib/supabase';
import {completeGovernmentPasswordSetup} from '../src/services/governmentAccounts';

export default function GovernmentPasswordSetupPage({onComplete,onLogout}:{onComplete:()=>void;onLogout:()=>void}){
 const [password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');

 const save=async()=>{
  if(password.length<10){setMsg('Le nouveau mot de passe doit contenir au moins 10 caractères.');return}
  if(password!==confirm){setMsg('Les deux mots de passe ne correspondent pas.');return}
  setBusy(true);setMsg('');
  try{
   const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
   const {error}=await s.auth.updateUser({password});
   if(error) throw error;
   await completeGovernmentPasswordSetup();
   onComplete();
  }catch(error:any){setMsg(error?.message||'Modification impossible.')}
  finally{setBusy(false)}
 };

 return <div className="min-h-screen bg-[#EBF3F8] flex items-center justify-center p-4"><div className="w-full max-w-lg bg-white border rounded-3xl shadow-xl p-7 space-y-5">
  <div className="text-center"><ShieldCheck className="w-14 h-14 mx-auto text-[#1F4A59]"/><h1 className="text-2xl font-black mt-3">Sécuriser votre compte ministériel</h1><p className="text-sm text-slate-500 mt-2">Le mot de passe transmis lors du provisionnement est temporaire. Définissez votre mot de passe personnel avant d’accéder aux fonctions administratives.</p></div>
  {msg&&<div className="rounded-xl bg-amber-50 text-amber-900 p-3 text-sm">{msg}</div>}
  <div><label className="text-xs font-black text-slate-600">Nouveau mot de passe</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password" className="mt-1 w-full border rounded-xl px-3 py-3"/></div>
  <div><label className="text-xs font-black text-slate-600">Confirmer le mot de passe</label><input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="new-password" className="mt-1 w-full border rounded-xl px-3 py-3"/></div>
  <button disabled={busy} onClick={save} className="w-full bg-[#1F4A59] text-white rounded-xl py-3 font-black flex justify-center gap-2"><KeyRound className="w-5"/>{busy?'Sécurisation…':'Enregistrer mon mot de passe'}</button>
  <button onClick={onLogout} className="w-full border rounded-xl py-3 font-bold text-slate-600 flex justify-center gap-2"><LogOut className="w-5"/>Se déconnecter</button>
 </div></div>;
}
