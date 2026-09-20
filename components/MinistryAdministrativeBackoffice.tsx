import React,{useEffect,useState} from 'react';
import {Inbox,CheckCircle2,XCircle,FileWarning,UserCheck,FileText,ArrowRight,ArrowLeft,Users,Route} from 'lucide-react';
import {getSupabaseClient} from '../src/lib/supabase';
import {generateOfficialAdministrativeDocument} from '../src/services/officialDocuments';
import {
  canClaimAdministrativeApplication,
  canSuperviseAdministrativeApplications,
  listAdministrativeRoutingCandidates,
  routeAdministrativeApplication
} from '../src/services/administrativeWorkflow';

type RoutingState={
  row:any;
  action:'ASSIGN'|'FORWARD'|'RETURN'|'APPROVE';
  targetStageOrder:number;
  candidates:any[];
  targetUid:string;
  note:string;
}|null;

const stageLabels:Record<string,string>={
  INSTRUCTION:'Instruction',
  SERVICE_REVIEW:'Chef de service',
  DIRECTION_REVIEW:'Direction',
  DG_REVIEW:'Direction générale',
  CABINET_REVIEW:'Cabinet',
  SIGNATURE:'Signature / délivrance',
};

export default function MinistryAdministrativeBackoffice({currentUser}:{currentUser?:any}){
 const [rows,setRows]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 const [routing,setRouting]=useState<RoutingState>(null);
 const role=String(currentUser?.role||'');
 const currentUid=String(currentUser?.uid||'');
 const canClaim=canClaimAdministrativeApplication(role);
 const canSupervise=canSuperviseAdministrativeApplications(role);

 const load=async()=>{
  const s=getSupabaseClient();
  if(!s)return;
  const {data,error}=await s.from('administrative_applications').select('*').neq('status','DRAFT').order('created_at',{ascending:false});
  if(error)setMsg(error.message);else setRows(data||[]);
 };

 useEffect(()=>{void load()},[]);

 const simpleAction=async(row:any,action:'CLAIM'|'REQUEST_MISSING'|'REJECT')=>{
  let note:string|null=null;
  if(action==='REQUEST_MISSING'){
   note=window.prompt('Précisez les pièces ou informations manquantes :')||'';
   if(!note.trim())return;
  }
  if(action==='REJECT'){
   note=window.prompt('Motif du rejet :')||'';
   if(!note.trim())return;
  }
  setBusy(true);setMsg('');
  try{
   await routeAdministrativeApplication({id:row.id,action,note});
   setMsg('Action enregistrée et tracée dans le workflow.');
   await load();
  }catch(error:any){
   setMsg(error?.message||'Action impossible.');
  }finally{setBusy(false)}
 };

 const openRouting=async(row:any,action:'ASSIGN'|'FORWARD'|'RETURN'|'APPROVE',targetStageOrder:number)=>{
  setBusy(true);setMsg('');
  try{
   const candidates=await listAdministrativeRoutingCandidates(row.id,targetStageOrder);
   setRouting({row,action,targetStageOrder,candidates,targetUid:candidates[0]?.user_uid||'',note:''});
   if(!candidates.length)setMsg('Aucun compte actif ne correspond au rôle requis pour cette étape.');
  }catch(error:any){
   setMsg(error?.message||'Impossible de charger les destinataires.');
  }finally{setBusy(false)}
 };

 const confirmRouting=async()=>{
  if(!routing||!routing.targetUid)return;
  setBusy(true);setMsg('');
  try{
   await routeAdministrativeApplication({
    id:routing.row.id,
    action:routing.action,
    targetUid:routing.targetUid,
    note:routing.note||null,
   });
   setRouting(null);
   setMsg('Dossier transmis au niveau hiérarchique suivant.');
   await load();
  }catch(error:any){
   setMsg(error?.message||'Routage impossible.');
  }finally{setBusy(false)}
 };

 const issueDocument=async(id:string)=>{
  setBusy(true);setMsg('');
  try{
   const result=await generateOfficialAdministrativeDocument(id);
   const number=result?.document?.document_number;
   setMsg(number?`Document officiel généré : ${number}`:'Document officiel généré et enregistré.');
   await load();
  }catch(error:any){
   setMsg(error?.message||'Génération du document impossible.');
  }finally{setBusy(false)}
 };

 return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
  <div className="rounded-3xl bg-[#173F4C] text-white p-6">
   <div className="flex gap-3"><Inbox/><div><h1 className="text-2xl font-black">Dossiers administratifs</h1><p className="text-sm text-slate-200">Instruction hiérarchique, décisions, signature et émission sécurisée des actes.</p></div></div>
  </div>

  {msg&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{msg}</div>}

  <div className="space-y-3">
   {rows.map(r=>{
    const stage=Number(r.workflow_stage_order||0);
    const isMine=Boolean(currentUid)&&String(r.assigned_agent_uid||'')===currentUid;
    const isSignature=r.workflow_stage_code==='SIGNATURE';
    return <div key={r.id} className="bg-white border rounded-2xl p-5">
     <div className="flex flex-wrap justify-between gap-3">
      <div>
       <div className="text-xs font-black text-[#1F4A59]">{r.ministry} · {r.service_code}</div>
       <div className="font-black mt-1">{r.applicant_name||'Demandeur'} <span className="text-slate-400 font-medium">#{r.id.slice(0,8)}</span></div>
       <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
        <span>Étape : <b>{stageLabels[r.workflow_stage_code]||r.workflow_stage_code||'À affecter'}</b></span>
        {r.assigned_direction&&<span>Affectation : <b>{r.assigned_direction}</b></span>}
        {isMine&&<span className="text-emerald-700 font-black">Responsable actuel : vous</span>}
       </div>
      </div>
      <span className="text-xs font-black bg-slate-100 rounded-full px-3 py-2 h-fit">{r.status}</span>
     </div>

     {r.status==='MISSING_DOCUMENTS'&&<div className="mt-4 bg-amber-50 text-amber-900 rounded-xl p-3 text-sm"><b>En attente du demandeur.</b> {r.review_note||'Des pièces complémentaires ont été demandées.'}</div>}

     <div className="flex flex-wrap gap-2 mt-4">
      {r.status==='SUBMITTED'&&canClaim&&
       <button disabled={busy} onClick={()=>simpleAction(r,'CLAIM')} className="px-3 py-2 rounded-xl border font-bold flex gap-2"><UserCheck className="w-4"/>Prendre en charge</button>}

      {r.status==='SUBMITTED'&&canSupervise&&
       <button disabled={busy} onClick={()=>openRouting(r,'ASSIGN',1)} className="px-3 py-2 rounded-xl bg-sky-50 text-sky-900 font-bold flex gap-2"><Users className="w-4"/>Affecter à un instructeur</button>}

      {r.status==='UNDER_REVIEW'&&isMine&&stage>0&&stage<6&&
       <button disabled={busy} onClick={()=>simpleAction(r,'REQUEST_MISSING')} className="px-3 py-2 rounded-xl bg-amber-50 text-amber-900 font-bold flex gap-2"><FileWarning className="w-4"/>Demander un complément</button>}

      {r.status==='UNDER_REVIEW'&&isMine&&stage>0&&stage<5&&
       <button disabled={busy} onClick={()=>openRouting(r,'FORWARD',stage+1)} className="px-3 py-2 rounded-xl bg-sky-600 text-white font-bold flex gap-2"><ArrowRight className="w-4"/>Transmettre</button>}

      {r.status==='UNDER_REVIEW'&&isMine&&stage>1&&stage<=5&&
       <button disabled={busy} onClick={()=>openRouting(r,'RETURN',stage-1)} className="px-3 py-2 rounded-xl border font-bold flex gap-2"><ArrowLeft className="w-4"/>Retourner</button>}

      {r.status==='UNDER_REVIEW'&&isMine&&stage>=3&&stage<=5&&
       <button disabled={busy} onClick={()=>simpleAction(r,'REJECT')} className="px-3 py-2 rounded-xl bg-rose-50 text-rose-800 font-bold flex gap-2"><XCircle className="w-4"/>Rejeter</button>}

      {r.status==='UNDER_REVIEW'&&isMine&&stage===5&&
       <button disabled={busy} onClick={()=>openRouting(r,'APPROVE',6)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold flex gap-2"><CheckCircle2 className="w-4"/>Valider et transmettre à la signature</button>}

      {(r.status==='APPROVED'||r.status==='PAID')&&(!r.workflow_stage_code||isSignature)&&(!r.assigned_agent_uid||isMine)&&
       <button disabled={busy} onClick={()=>issueDocument(r.id)} className="px-3 py-2 rounded-xl bg-[#1F4A59] text-white font-bold flex gap-2"><FileText className="w-4"/>Générer l'acte officiel</button>}
     </div>
    </div>;
   })}
  </div>

  {routing&&<div className="fixed inset-0 z-[200] bg-slate-950/50 p-4 flex items-center justify-center">
   <div className="w-full max-w-xl bg-white rounded-3xl p-6 shadow-2xl">
    <div className="flex gap-3 items-start"><Route className="w-6 h-6 text-[#1F4A59]"/><div><h2 className="text-xl font-black">Routage hiérarchique</h2><p className="text-sm text-slate-500">{routing.action==='APPROVE'?'Choisissez le signataire cible.':'Choisissez le destinataire correspondant à l’étape requise.'}</p></div></div>
    <div className="mt-5">
     <label className="text-xs font-black text-slate-600">Destinataire</label>
     <select value={routing.targetUid} onChange={e=>setRouting({...routing,targetUid:e.target.value})} className="mt-1 w-full border rounded-xl px-3 py-3">
      <option value="">Sélectionner…</option>
      {routing.candidates.map(c=><option key={c.user_uid} value={c.user_uid}>{c.name||c.email} · {c.government_role}{c.direction?' · '+c.direction:''}</option>)}
     </select>
    </div>
    <div className="mt-4"><label className="text-xs font-black text-slate-600">Note de transmission</label><textarea value={routing.note} onChange={e=>setRouting({...routing,note:e.target.value})} className="mt-1 w-full border rounded-xl px-3 py-3 min-h-24" placeholder="Optionnel"/></div>
    <div className="flex gap-2 mt-5"><button onClick={()=>setRouting(null)} className="flex-1 border rounded-xl py-3 font-bold">Annuler</button><button disabled={busy||!routing.targetUid} onClick={confirmRouting} className="flex-1 bg-[#1F4A59] text-white rounded-xl py-3 font-black disabled:opacity-50">Confirmer</button></div>
   </div>
  </div>}
 </div>;
}
