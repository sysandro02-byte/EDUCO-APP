import React,{useEffect,useState} from 'react';
import {Inbox,CheckCircle2,XCircle,FileWarning,UserCheck,FileText} from 'lucide-react';
import {getSupabaseClient} from '../src/lib/supabase';
import {generateOfficialAdministrativeDocument} from '../src/services/officialDocuments';

export default function MinistryAdministrativeBackoffice({currentUser}:{currentUser?:any}){
 const [rows,setRows]=useState<any[]>([]),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');

 const load=async()=>{
  const s=getSupabaseClient();
  if(!s)return;
  const {data,error}=await s.from('administrative_applications').select('*').neq('status','DRAFT').order('created_at',{ascending:false});
  if(error)setMsg(error.message);else setRows(data||[]);
 };

 useEffect(()=>{void load()},[]);

 const act=async(id:string,action:string)=>{
  const note=action==='ASSIGN'?'':window.prompt(action==='REQUEST_MISSING'?'Précisez les pièces ou informations manquantes :':'Note de décision :')||'';
  if(action!=='ASSIGN'&&!note)return;
  setBusy(true);
  try{
   const s=getSupabaseClient();
   if(!s)throw new Error('Supabase indisponible');
   const {error}=await s.rpc('process_administrative_application',{p_id:id,p_action:action,p_note:note,p_direction:null});
   if(error)throw error;
   setMsg('Action enregistrée et tracée.');
   await load();
  }catch(error:any){
   setMsg(error?.message||'Action impossible.');
  }finally{
   setBusy(false);
  }
 };

 const issueDocument=async(id:string)=>{
  setBusy(true);
  setMsg('');
  try{
   const result=await generateOfficialAdministrativeDocument(id);
   const number=result?.document?.document_number;
   setMsg(number?`Document officiel généré : ${number}`:'Document officiel généré et enregistré.');
   await load();
  }catch(error:any){
   setMsg(error?.message||'Génération du document impossible.');
  }finally{
   setBusy(false);
  }
 };

 return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
  <div className="rounded-3xl bg-[#173F4C] text-white p-6">
   <div className="flex gap-3"><Inbox/><div><h1 className="text-2xl font-black">Dossiers administratifs</h1><p className="text-sm text-slate-200">Réception, instruction, compléments, décisions et émission sécurisée des actes.</p></div></div>
  </div>
  {msg&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{msg}</div>}
  <div className="space-y-3">
   {rows.map(r=><div key={r.id} className="bg-white border rounded-2xl p-5">
    <div className="flex flex-wrap justify-between gap-3">
     <div><div className="text-xs font-black text-[#1F4A59]">{r.ministry} · {r.service_code}</div><div className="font-black mt-1">{r.applicant_name||'Demandeur'} <span className="text-slate-400 font-medium">#{r.id.slice(0,8)}</span></div></div>
     <span className="text-xs font-black bg-slate-100 rounded-full px-3 py-2">{r.status}</span>
    </div>
    <div className="flex flex-wrap gap-2 mt-4">
     <button disabled={busy} onClick={()=>act(r.id,'ASSIGN')} className="px-3 py-2 rounded-xl border font-bold flex gap-2"><UserCheck className="w-4"/>Prendre en charge</button>
     <button disabled={busy} onClick={()=>act(r.id,'REQUEST_MISSING')} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-900 font-bold flex gap-2"><FileWarning className="w-4"/>Complément</button>
     <button disabled={busy} onClick={()=>act(r.id,'APPROVE')} className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold flex gap-2"><CheckCircle2 className="w-4"/>Valider</button>
     <button disabled={busy} onClick={()=>act(r.id,'REJECT')} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-800 font-bold flex gap-2"><XCircle className="w-4"/>Rejeter</button>
     {(r.status==='APPROVED'||r.status==='PAID')&&<button disabled={busy} onClick={()=>issueDocument(r.id)} className="px-3 py-2 rounded-xl bg-[#1F4A59] text-white font-bold flex gap-2"><FileText className="w-4"/>Générer l'acte officiel</button>}
    </div>
   </div>)}
  </div>
 </div>;
}
