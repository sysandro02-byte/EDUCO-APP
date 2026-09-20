import React,{useEffect,useMemo,useState} from 'react';
import {Building2,Copy,RefreshCw,ShieldCheck,UserPlus,UserCheck,UserX} from 'lucide-react';
import {
  GOVERNMENT_MINISTRIES,availableGovernmentRoles,canManageGovernmentAccounts,
  changeGovernmentAccountStatus,inferGovernmentMinistry,listGovernmentAccounts,
  provisionGovernmentAccount
} from '../src/services/governmentAccounts';

export default function GovernmentAccountsPage({currentUser}:{currentUser?:any}){
 const actorRole=String(currentUser?.role||'');
 const global=actorRole.trim().toUpperCase().replace(/[ -]+/g,'_')==='ETAT_ADMIN';
 const inferred=inferGovernmentMinistry(actorRole);
 const [ministry,setMinistry]=useState(global?'MEPSA':(inferred||'MEPSA'));
 const [rows,setRows]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 const [name,setName]=useState('');
 const [email,setEmail]=useState('');
 const [role,setRole]=useState('');
 const [direction,setDirection]=useState('');
 const [title,setTitle]=useState('');
 const [temporaryPassword,setTemporaryPassword]=useState('');

 const allowed=useMemo(()=>canManageGovernmentAccounts(actorRole),[actorRole]);
 const roles=useMemo(()=>availableGovernmentRoles(actorRole,ministry),[actorRole,ministry]);

 useEffect(()=>{setRole(roles[0]?.value||'')},[ministry,actorRole]);

 const load=async()=>{
  if(!allowed)return;
  setBusy(true);setMsg('');
  try{setRows(await listGovernmentAccounts(ministry));}
  catch(error:any){setMsg(error?.message||'Chargement impossible.')}
  finally{setBusy(false)}
 };
 useEffect(()=>{void load()},[ministry,allowed]);

 const create=async()=>{
  if(!name.trim()||!email.trim()||!role){setMsg('Nom, e-mail et rôle sont obligatoires.');return}
  setBusy(true);setMsg('');setTemporaryPassword('');
  try{
   const result=await provisionGovernmentAccount({
    name:name.trim(),email:email.trim(),ministry,governmentRole:role,
    direction:direction.trim(),officialTitle:title.trim()
   });
   setTemporaryPassword(result?.temporary_password||'');
   setName('');setEmail('');setDirection('');setTitle('');
   setMsg('Compte ministériel créé. Le mot de passe temporaire ne sera affiché qu’ici.');
   await load();
  }catch(error:any){setMsg(error?.message||'Création impossible.')}
  finally{setBusy(false)}
 };

 const toggle=async(row:any)=>{
  setBusy(true);setMsg('');
  try{
   await changeGovernmentAccountStatus(row.user_uid,!row.active);
   setMsg(row.active?'Compte désactivé.':'Compte réactivé.');
   await load();
  }catch(error:any){setMsg(error?.message||'Action impossible.')}
  finally{setBusy(false)}
 };

 if(!allowed){
  return <div className="max-w-4xl mx-auto p-6"><div className="bg-white border rounded-2xl p-8 text-center"><ShieldCheck className="w-12 h-12 mx-auto text-slate-400"/><h1 className="text-xl font-black mt-3">Comptes ministériels</h1><p className="text-slate-500 mt-2">Accès réservé à ETAT_ADMIN et aux autorités ministérielles habilitées.</p></div></div>;
 }

 return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
  <div className="rounded-3xl bg-[#173F4C] text-white p-6 flex flex-wrap justify-between gap-4">
   <div className="flex gap-3"><Building2/><div><h1 className="text-2xl font-black">Comptes ministériels</h1><p className="text-sm text-slate-200">Provisionnement sécurisé des autorités, directions et agents de l’État.</p></div></div>
   <button onClick={load} disabled={busy} className="p-2 rounded-xl bg-white/10"><RefreshCw className="w-5"/></button>
  </div>

  {global&&<div className="bg-white border rounded-2xl p-4"><label className="text-xs font-black text-slate-600">Périmètre administratif</label><select value={ministry} onChange={e=>setMinistry(e.target.value)} className="mt-2 w-full sm:w-72 border rounded-xl px-3 py-2">{GOVERNMENT_MINISTRIES.map(m=><option key={m}>{m}</option>)}</select></div>}
  {msg&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{msg}</div>}
  {temporaryPassword&&<div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5"><div className="text-xs font-black text-amber-800 uppercase">Mot de passe temporaire — affichage unique</div><div className="mt-2 flex gap-2"><code className="flex-1 bg-white border rounded-xl px-3 py-3 break-all font-black">{temporaryPassword}</code><button onClick={()=>navigator.clipboard?.writeText(temporaryPassword)} className="border bg-white rounded-xl px-4"><Copy className="w-5"/></button></div><p className="text-xs text-amber-800 mt-2">Le titulaire devra obligatoirement le remplacer à sa première connexion.</p></div>}

  <div className="bg-white border rounded-2xl p-5 space-y-4">
   <div><h2 className="font-black text-lg">Créer un compte · {ministry}</h2><p className="text-sm text-slate-500">Aucune création ne modifie les comptes scolaires existants.</p></div>
   <div className="grid md:grid-cols-2 gap-3">
    <div><label className="text-xs font-black text-slate-600">Nom complet</label><input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2"/></div>
    <div><label className="text-xs font-black text-slate-600">E-mail professionnel</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2"/></div>
    <div><label className="text-xs font-black text-slate-600">Rôle</label><select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2">{roles.map(r=><option key={r.value} value={r.value}>{r.label} · {r.value}</option>)}</select></div>
    <div><label className="text-xs font-black text-slate-600">Direction / entité</label><input value={direction} onChange={e=>setDirection(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" placeholder="Ex. Direction des examens"/></div>
    <div className="md:col-span-2"><label className="text-xs font-black text-slate-600">Intitulé officiel</label><input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" placeholder="Fonction affichée dans EDUCO"/></div>
   </div>
   <button disabled={busy||!roles.length} onClick={create} className="rounded-xl bg-[#1F4A59] disabled:opacity-50 text-white px-4 py-3 font-black flex items-center gap-2"><UserPlus className="w-4"/>Créer le compte</button>
  </div>

  <div className="space-y-3">
   {rows.map(r=><div key={r.user_uid} className="bg-white border rounded-2xl p-5">
    <div className="flex flex-wrap justify-between gap-3"><div><div className="font-black">{r.name}</div><div className="text-sm text-slate-500">{r.email}</div><div className="text-xs text-slate-400 mt-1">{r.government_role}{r.direction?' · '+r.direction:''}</div></div><span className={`h-fit text-xs font-black rounded-full px-3 py-2 ${r.active?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{r.active?'ACTIF':'INACTIF'}</span></div>
    <div className="grid sm:grid-cols-3 gap-2 text-sm mt-4"><p><b>Ministère :</b> {r.ministry}</p><p><b>Fonction :</b> {r.official_title||'—'}</p><p><b>Sécurité :</b> {r.must_change_password?'Mot de passe temporaire':'Mot de passe personnalisé'}</p></div>
    <button disabled={busy||r.user_uid===currentUser?.uid} onClick={()=>toggle(r)} className={`mt-4 px-3 py-2 rounded-xl font-bold flex gap-2 disabled:opacity-40 ${r.active?'bg-rose-50 text-rose-800':'bg-emerald-50 text-emerald-800'}`}>{r.active?<UserX className="w-4"/>:<UserCheck className="w-4"/>}{r.active?'Désactiver':'Réactiver'}</button>
   </div>)}
   {!rows.length&&!busy&&<div className="bg-white border rounded-2xl p-8 text-center text-slate-500">Aucun compte ministériel enregistré pour {ministry}.</div>}
  </div>
 </div>;
}
