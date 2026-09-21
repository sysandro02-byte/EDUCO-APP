import React,{useEffect,useMemo,useState} from 'react';
import {Building2,Copy,Link2,RefreshCw,Search,ShieldCheck,Unlink,UserPlus,UserCheck,UserX} from 'lucide-react';
import {MINISTRIES} from '../src/institutional/accessConfig';
import {
  GOVERNMENT_MINISTRIES,availableGovernmentRoles,canManageGovernmentAccounts,
  changeGovernmentAccountStatus,inferGovernmentMinistry,listGovernmentAccounts,
  listGovernmentJurisdictions,provisionGovernmentAccount,searchJurisdictionCandidateSchools,
  setGovernmentJurisdiction,getGovernmentRolloutReadiness
} from '../src/services/governmentAccounts';

const normalize=(value:string)=>String(value||'').trim().toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const entityScopedRole=(role:string)=>/(DIRECTEUR|CHEF_SERVICE|AGENT_INSTRUCTEUR|SIGNATAIRE_HABILITE|SIGNER_ADMIN|FINANCE)$/.test(normalize(role));

export default function GovernmentAccountsPage({currentUser}:{currentUser?:any}){
 const actorRole=String(currentUser?.role||'');
 const global=normalize(actorRole)==='ETAT_ADMIN';
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
 const [scopeEntity,setScopeEntity]=useState('');
 const [jurisdictions,setJurisdictions]=useState<any[]>([]);
 const [schoolSearch,setSchoolSearch]=useState('');
 const [schoolResults,setSchoolResults]=useState<any[]>([]);
 const [readiness,setReadiness]=useState<any>(null);

 const allowed=useMemo(()=>canManageGovernmentAccounts(actorRole),[actorRole]);
 const roles=useMemo(()=>availableGovernmentRoles(actorRole,ministry),[actorRole,ministry]);
 const ministryConfig=useMemo(()=>MINISTRIES.find(item=>item.code===ministry),[ministry]);
 const entityOptions=ministryConfig?.entities||[];
 const needsEntity=entityScopedRole(role);

 useEffect(()=>{
   const nextRole=roles[0]?.value||'';
   setRole(nextRole);
   setDirection('');
 },[ministry,actorRole]);

 useEffect(()=>{
   if(normalize(role).endsWith('_CABINET')) setDirection('CABINET');
   else if(direction && !entityOptions.some(entity=>entity.code===direction)) setDirection('');
 },[role,ministry]);

 useEffect(()=>{
   const first=entityOptions[0]?.code||'';
   setScopeEntity(first);
   setJurisdictions([]);
   setSchoolResults([]);
   setSchoolSearch('');
 },[ministry]);

 const load=async()=>{
  if(!allowed)return;
  setBusy(true);setMsg('');
  try{
    const [accounts,rollout]=await Promise.all([
      listGovernmentAccounts(ministry),
      getGovernmentRolloutReadiness(ministry)
    ]);
    setRows(accounts);setReadiness(rollout);
  }
  catch(error:any){setMsg(error?.message||'Chargement impossible.')}
  finally{setBusy(false)}
 };
 useEffect(()=>{void load()},[ministry,allowed]);

 const loadJurisdictions=async(entity=scopeEntity)=>{
   if(!allowed||!entity)return;
   setBusy(true);setMsg('');
   try{setJurisdictions(await listGovernmentJurisdictions(ministry,entity));}
   catch(error:any){setMsg(error?.message||'Chargement du périmètre impossible.')}
   finally{setBusy(false)}
 };
 useEffect(()=>{if(scopeEntity)void loadJurisdictions(scopeEntity)},[scopeEntity]);

 const create=async()=>{
  if(!name.trim()||!email.trim()||!role){setMsg('Nom, e-mail et rôle sont obligatoires.');return}
  if(needsEntity&&!direction){setMsg('Sélectionnez la direction/entité correspondant à ce rôle.');return}
  setBusy(true);setMsg('');setTemporaryPassword('');
  try{
   const result=await provisionGovernmentAccount({
    name:name.trim(),email:email.trim(),ministry,governmentRole:role,
    direction:direction||undefined,officialTitle:title.trim()
   });
   setTemporaryPassword(result?.temporary_password||'');
   setName('');setEmail('');setDirection('');setTitle('');
   setMsg('Compte ministériel créé et affectation sécurisée enregistrée.');
   await load();
  }catch(error:any){setMsg(error?.message||'Création impossible.')}
  finally{setBusy(false)}
 };

 const toggle=async(row:any)=>{
  setBusy(true);setMsg('');
  try{
   await changeGovernmentAccountStatus(row.user_uid,!row.active);
   setMsg(row.active?'Compte et affectation désactivés.':'Compte et affectation réactivés.');
   await load();
  }catch(error:any){setMsg(error?.message||'Action impossible.')}
  finally{setBusy(false)}
 };

 const searchSchools=async()=>{
   if(!scopeEntity||schoolSearch.trim().length<2){
     setMsg('Saisissez au moins 2 caractères pour rechercher un établissement.');
     return;
   }
   setBusy(true);setMsg('');
   try{setSchoolResults(await searchJurisdictionCandidateSchools(ministry,scopeEntity,schoolSearch));}
   catch(error:any){setMsg(error?.message||'Recherche impossible.')}
   finally{setBusy(false)}
 };

 const changeScope=async(schoolId:number,active:boolean)=>{
   if(!scopeEntity)return;
   setBusy(true);setMsg('');
   try{
     await setGovernmentJurisdiction(ministry,scopeEntity,schoolId,active);
     setMsg(active?'Établissement rattaché au périmètre.':'Rattachement désactivé.');
     await Promise.all([loadJurisdictions(scopeEntity),load()]);
   }catch(error:any){setMsg(error?.message||'Modification du périmètre impossible.')}
   finally{setBusy(false)}
 };

 if(!allowed){
  return <div className="max-w-4xl mx-auto p-6"><div className="bg-white border rounded-2xl p-8 text-center"><ShieldCheck className="w-12 h-12 mx-auto text-slate-400"/><h1 className="text-xl font-black mt-3">Comptes ministériels</h1><p className="text-slate-500 mt-2">Accès réservé à ETAT_ADMIN et aux autorités ministérielles habilitées.</p></div></div>;
 }

 return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
  <div className="rounded-3xl bg-[#173F4C] text-white p-6 flex flex-wrap justify-between gap-4">
   <div className="flex gap-3"><Building2/><div><h1 className="text-2xl font-black">Comptes ministériels</h1><p className="text-sm text-slate-200">Provisionnement, affectations et périmètres d’accès institutionnels.</p></div></div>
   <button onClick={load} disabled={busy} className="p-2 rounded-xl bg-white/10"><RefreshCw className="w-5"/></button>
  </div>

  {global&&<div className="bg-white border rounded-2xl p-4"><label className="text-xs font-black text-slate-600">Périmètre administratif</label><select value={ministry} onChange={e=>setMinistry(e.target.value)} className="mt-2 w-full sm:w-72 border rounded-xl px-3 py-2">{GOVERNMENT_MINISTRIES.filter(m=>m!=='ETAT').map(m=><option key={m}>{m}</option>)}</select></div>}
  {msg&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{msg}</div>}
  {readiness?.summary&&<div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
    {[
      ['Comptes / affectations',readiness.summary.activeAssignments],
      ['Périmètres écoles',readiness.summary.activeJurisdictions],
      ['Signataires actifs',readiness.summary.activeSigners],
      ['Démarches publiées',readiness.summary.publishedServices],
      ['En revue juridique',readiness.summary.legalReviewServices],
      ['Passerelles configurées',readiness.summary.readyPaymentProviders],
    ].map(([label,value])=><div key={String(label)} className="bg-white border rounded-2xl p-4">
      <div className="text-[11px] font-black text-slate-500 uppercase">{label}</div>
      <div className="text-2xl font-black text-[#173F4C] mt-1">{Number(value||0)}</div>
    </div>)}
  </div>}
  {temporaryPassword&&<div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5"><div className="text-xs font-black text-amber-800 uppercase">Mot de passe temporaire — affichage unique</div><div className="mt-2 flex gap-2"><code className="flex-1 bg-white border rounded-xl px-3 py-3 break-all font-black">{temporaryPassword}</code><button onClick={()=>navigator.clipboard?.writeText(temporaryPassword)} className="border bg-white rounded-xl px-4"><Copy className="w-5"/></button></div><p className="text-xs text-amber-800 mt-2">Le titulaire devra obligatoirement le remplacer à sa première connexion.</p></div>}

  <div className="bg-white border rounded-2xl p-5 space-y-4">
   <div><h2 className="font-black text-lg">Créer un compte · {ministry}</h2><p className="text-sm text-slate-500">Les rôles opérationnels sont obligatoirement liés à une entité EDUCO connue.</p></div>
   <div className="grid md:grid-cols-2 gap-3">
    <div><label className="text-xs font-black text-slate-600">Nom complet</label><input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2"/></div>
    <div><label className="text-xs font-black text-slate-600">E-mail professionnel</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2"/></div>
    <div><label className="text-xs font-black text-slate-600">Rôle</label><select value={role} onChange={e=>setRole(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2">{roles.map(r=><option key={r.value} value={r.value}>{r.label} · {r.value}</option>)}</select></div>
    <div><label className="text-xs font-black text-slate-600">Direction / entité {needsEntity?'*':''}</label><select value={direction} onChange={e=>setDirection(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2"><option value="">Périmètre ministériel</option>{entityOptions.map(entity=><option key={entity.code} value={entity.code}>{entity.shortLabel||entity.label} · {entity.code}</option>)}</select></div>
    <div className="md:col-span-2"><label className="text-xs font-black text-slate-600">Intitulé officiel</label><input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2" placeholder="Fonction affichée dans EDUCO"/></div>
   </div>
   <button disabled={busy||!roles.length} onClick={create} className="rounded-xl bg-[#1F4A59] disabled:opacity-50 text-white px-4 py-3 font-black flex items-center gap-2"><UserPlus className="w-4"/>Créer le compte</button>
  </div>

  {entityOptions.length>0&&<div className="bg-white border rounded-2xl p-5 space-y-4">
    <div><h2 className="font-black text-lg">Périmètre des données réelles</h2><p className="text-sm text-slate-500">Aucun établissement n’est inclus dans les statistiques d’une direction sans rattachement explicite.</p></div>
    <div className="grid md:grid-cols-2 gap-3">
      <div><label className="text-xs font-black text-slate-600">Direction / entité</label><select value={scopeEntity} onChange={e=>setScopeEntity(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2">{entityOptions.map(entity=><option key={entity.code} value={entity.code}>{entity.shortLabel||entity.label} · {entity.code}</option>)}</select></div>
      <div><label className="text-xs font-black text-slate-600">Rechercher un établissement</label><div className="mt-1 flex gap-2"><input value={schoolSearch} onChange={e=>setSchoolSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void searchSchools()}} className="flex-1 border rounded-xl px-3 py-2" placeholder="Nom ou identifiant"/><button disabled={busy} onClick={searchSchools} className="border rounded-xl px-3"><Search className="w-4"/></button></div></div>
    </div>
    {schoolResults.length>0&&<div className="border rounded-xl divide-y">{schoolResults.map(school=><div key={school.id} className="p-3 flex items-center justify-between gap-3"><div><div className="font-bold">{school.name}</div><div className="text-xs text-slate-500">{school.identifier||'Sans identifiant'} · {school.status||'—'}</div></div><button disabled={busy||jurisdictions.some(j=>j.school_id===school.id&&j.active)} onClick={()=>changeScope(school.id,true)} className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-800 font-bold disabled:opacity-40 flex gap-2 items-center"><Link2 className="w-4"/>Rattacher</button></div>)}</div>}
    <div><div className="text-xs font-black text-slate-600 mb-2">RATTACHEMENTS ENREGISTRÉS</div>{jurisdictions.length?<div className="border rounded-xl divide-y">{jurisdictions.map(j=><div key={j.jurisdiction_id} className="p-3 flex items-center justify-between gap-3"><div><div className="font-bold">{j.school_name}</div><div className="text-xs text-slate-500">{j.school_identifier||'Sans identifiant'} · {j.source}</div></div><button disabled={busy||!j.active} onClick={()=>changeScope(j.school_id,false)} className="px-3 py-2 rounded-lg bg-rose-50 text-rose-800 font-bold disabled:opacity-40 flex gap-2 items-center"><Unlink className="w-4"/>Détacher</button></div>)}</div>:<div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Aucun établissement rattaché à cette entité. Les indicateurs restent à zéro.</div>}</div>
  </div>}

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
