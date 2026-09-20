import React,{useEffect,useMemo,useState} from 'react';
import {ShieldCheck,UserPlus,UserX,UserCheck,RefreshCw} from 'lucide-react';
import {
  ADMIN_MINISTRIES,MINISTRY_SERVICE_CODES,canManageAuthorizedSigners,inferGovernmentMinistry,
  listAuthorizedSignerCandidates,listAuthorizedSigners,manageAuthorizedSigner
} from '../src/services/authorizedSigners';

export default function AuthorizedSignersPage({currentUser}:{currentUser?:any}){
 const role=String(currentUser?.role||'');
 const inferred=inferGovernmentMinistry(role);
 const isEtatAdmin=role.trim().toUpperCase().replace(/[ -]+/g,'_')==='ETAT_ADMIN';
 const [ministry,setMinistry]=useState(inferred||'MEPSA');
 const [rows,setRows]=useState<any[]>([]);
 const [candidates,setCandidates]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 const [userUid,setUserUid]=useState('');
 const [signerName,setSignerName]=useState('');
 const [signerTitle,setSignerTitle]=useState('');
 const [serviceCode,setServiceCode]=useState('');
 const [validUntil,setValidUntil]=useState('');

 const allowed=useMemo(()=>canManageAuthorizedSigners(role),[role]);
 const services=MINISTRY_SERVICE_CODES[ministry]||[];

 const load=async()=>{
  if(!allowed)return;
  setBusy(true); setMsg('');
  try{
   const [signers,users]=await Promise.all([
    listAuthorizedSigners(ministry),
    listAuthorizedSignerCandidates(ministry)
   ]);
   setRows(signers); setCandidates(users);
  }catch(error:any){
   setMsg(error?.message||'Chargement impossible.');
  }finally{setBusy(false)}
 };

 useEffect(()=>{void load()},[ministry,allowed]);

 const onCandidate=(uid:string)=>{
  setUserUid(uid);
  const c=candidates.find(x=>x.user_uid===uid);
  if(c?.user_name)setSignerName(c.user_name);
 };

 const createSigner=async()=>{
  if(!userUid||!signerName.trim()||!signerTitle.trim()){setMsg('Sélectionnez un compte et renseignez le nom ainsi que la qualité du signataire.');return}
  setBusy(true); setMsg('');
  try{
   await manageAuthorizedSigner({
    action:'CREATE',ministry,userUid,serviceCode:serviceCode||null,
    signerName:signerName.trim(),signerTitle:signerTitle.trim(),
    validUntil:validUntil?new Date(validUntil+'T23:59:59').toISOString():null
   });
   setUserUid('');setSignerName('');setSignerTitle('');setServiceCode('');setValidUntil('');
   setMsg('Habilitation créée et journalisée.');
   await load();
  }catch(error:any){setMsg(error?.message||'Création impossible.')}
  finally{setBusy(false)}
 };

 const toggle=async(row:any)=>{
  setBusy(true);setMsg('');
  try{
   await manageAuthorizedSigner({
    action:row.active?'DEACTIVATE':'REACTIVATE',
    ministry,signerId:row.id
   });
   setMsg(row.active?'Habilitation désactivée.':'Habilitation réactivée.');
   await load();
  }catch(error:any){setMsg(error?.message||'Action impossible.')}
  finally{setBusy(false)}
 };

 if(!allowed){
  return <div className="max-w-4xl mx-auto p-6"><div className="bg-white border rounded-2xl p-8 text-center"><ShieldCheck className="w-12 h-12 mx-auto text-slate-400"/><h1 className="text-xl font-black mt-3">Signataires habilités</h1><p className="text-slate-500 mt-2">Cette fonction est réservée aux autorités étatiques expressément habilitées.</p></div></div>;
 }

 return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
  <div className="rounded-3xl bg-[#173F4C] text-white p-6 flex flex-wrap items-start justify-between gap-4">
   <div className="flex gap-3"><ShieldCheck/><div><h1 className="text-2xl font-black">Signataires habilités</h1><p className="text-sm text-slate-200">Nomination, périmètre et validité des personnes autorisées à émettre des actes officiels.</p></div></div>
   <button onClick={load} disabled={busy} className="p-2 rounded-xl bg-white/10"><RefreshCw className="w-5"/></button>
  </div>

  {isEtatAdmin&&<div className="bg-white border rounded-2xl p-4"><label className="text-xs font-black text-slate-600">Ministère</label><select value={ministry} onChange={e=>setMinistry(e.target.value)} className="mt-2 w-full sm:w-64 border rounded-xl px-3 py-2">{ADMIN_MINISTRIES.map(m=><option key={m}>{m}</option>)}</select></div>}
  {msg&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{msg}</div>}

  <div className="bg-white border rounded-2xl p-5 space-y-4">
   <div><h2 className="font-black text-lg">Nouvelle habilitation · {ministry}</h2><p className="text-sm text-slate-500">Le compte cible doit déjà posséder un rôle étatique compatible avec ce ministère.</p></div>
   <div className="grid md:grid-cols-2 gap-3">
    <div><label className="text-xs font-black text-slate-600">Compte étatique</label><select value={userUid} onChange={e=>onCandidate(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2"><option value="">Sélectionner…</option>{candidates.map(c=><option key={c.user_uid} value={c.user_uid}>{c.user_name||c.user_email} · {c.user_role}</option>)}</select></div>
    <div><label className="text-xs font-black text-slate-600">Nom affiché du signataire</label><input value={signerName} onChange={e=>setSignerName(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" placeholder="Nom officiel"/></div>
    <div><label className="text-xs font-black text-slate-600">Qualité / fonction officielle</label><input value={signerTitle} onChange={e=>setSignerTitle(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" placeholder="Ex. Directeur général"/></div>
    <div><label className="text-xs font-black text-slate-600">Périmètre</label><select value={serviceCode} onChange={e=>setServiceCode(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2"><option value="">Toutes les démarches du ministère</option>{services.map(s=><option key={s.code} value={s.code}>{s.code} · {s.label}</option>)}</select></div>
    <div><label className="text-xs font-black text-slate-600">Valide jusqu’au</label><input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2"/></div>
   </div>
   <button disabled={busy||!candidates.length} onClick={createSigner} className="rounded-xl bg-[#1F4A59] disabled:opacity-50 text-white px-4 py-3 font-black flex items-center gap-2"><UserPlus className="w-4"/>Créer l’habilitation</button>
   {!candidates.length&&!busy&&<p className="text-xs text-amber-700">Aucun compte étatique compatible n’est actuellement disponible pour {ministry}.</p>}
  </div>

  <div className="space-y-3">
   {rows.map(r=><div key={r.id} className="bg-white border rounded-2xl p-5">
    <div className="flex flex-wrap justify-between gap-3">
     <div><div className="font-black">{r.signer_name}</div><div className="text-sm text-slate-500">{r.signer_title}</div><div className="text-xs text-slate-400 mt-1">{r.user_email||r.user_name||r.user_uid}</div></div>
     <span className={`h-fit text-xs font-black rounded-full px-3 py-2 ${r.active?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{r.active?'ACTIVE':'INACTIVE'}</span>
    </div>
    <div className="grid sm:grid-cols-3 gap-2 text-sm mt-4"><p><b>Périmètre :</b> {r.service_code||'Tout le ministère'}</p><p><b>Début :</b> {new Date(r.valid_from).toLocaleDateString('fr-FR')}</p><p><b>Fin :</b> {r.valid_until?new Date(r.valid_until).toLocaleDateString('fr-FR'):'Sans date de fin'}</p></div>
    <button disabled={busy} onClick={()=>toggle(r)} className={`mt-4 px-3 py-2 rounded-xl font-bold flex gap-2 ${r.active?'bg-rose-50 text-rose-800':'bg-emerald-50 text-emerald-800'}`}>{r.active?<UserX className="w-4"/>:<UserCheck className="w-4"/>}{r.active?'Désactiver':'Réactiver'}</button>
   </div>)}
   {!rows.length&&!busy&&<div className="bg-white border rounded-2xl p-8 text-center text-slate-500">Aucune habilitation enregistrée pour {ministry}.</div>}
  </div>
 </div>;
}
