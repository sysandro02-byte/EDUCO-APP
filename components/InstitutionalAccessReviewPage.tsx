import React,{useEffect,useState} from 'react';
import {CheckCircle2,ClipboardCheck,Copy,ExternalLink,RefreshCw,ShieldCheck,XCircle} from 'lucide-react';
import {
  listInstitutionalAccessRequests,
  reviewInstitutionalAccessRequest
} from '../src/services/institutionalAccess';

export default function InstitutionalAccessReviewPage({currentUser}:{currentUser?:any}){
  const role=String(currentUser?.role||'').trim().toUpperCase().replace(/[ -]+/g,'_');
  const allowed=role==='ETAT_ADMIN';
  const [rows,setRows]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');
  const [temporaryPassword,setTemporaryPassword]=useState('');
  const [selectedId,setSelectedId]=useState('');
  const [checks,setChecks]=useState<Record<string,Record<string,boolean>>>({});

  const load=async()=>{
    if(!allowed)return;
    setBusy(true);setMsg('');
    try{setRows(await listInstitutionalAccessRequests(['PENDING','UNDER_REVIEW']));}
    catch(error:any){setMsg(error?.message||'Chargement impossible.')}
    finally{setBusy(false)}
  };
  useEffect(()=>{void load()},[allowed]);

  const setCheck=(id:string,key:string,value:boolean)=>{
    setChecks(prev=>({...prev,[id]:{...(prev[id]||{}),[key]:value}}));
  };

  const approve=async(row:any)=>{
    const checklist=checks[row.id]||{};
    setBusy(true);setMsg('');setTemporaryPassword('');
    try{
      const result=await reviewInstitutionalAccessRequest({
        action:'APPROVE',
        requestId:row.id,
        approvedRole:row.requested_role,
        checklist,
        note:'Contrôle institutionnel validé par ETAT_ADMIN.'
      });
      setSelectedId(row.id);
      setTemporaryPassword(result?.temporary_password||'');
      setMsg('Compte ministériel créé. Le mot de passe temporaire doit être transmis par un canal institutionnel sûr et sera changé au premier accès.');
      await load();
    }catch(error:any){setMsg(error?.message||'Approbation impossible.')}
    finally{setBusy(false)}
  };

  const reject=async(row:any)=>{
    const note=window.prompt('Motif obligatoire du rejet :')||'';
    if(!note.trim())return;
    setBusy(true);setMsg('');setTemporaryPassword('');
    try{
      await reviewInstitutionalAccessRequest({
        action:'REJECT',
        requestId:row.id,
        checklist:checks[row.id]||{},
        note
      });
      setMsg('Demande rejetée et motif enregistré pour le suivi du demandeur.');
      await load();
    }catch(error:any){setMsg(error?.message||'Rejet impossible.')}
    finally{setBusy(false)}
  };

  if(!allowed){
    return <div className="max-w-4xl mx-auto p-6"><div className="bg-white border rounded-2xl p-8 text-center"><ShieldCheck className="w-12 h-12 mx-auto text-slate-400"/><h1 className="text-xl font-black mt-3">Demandes institutionnelles</h1><p className="text-slate-500 mt-2">Seul ETAT_ADMIN peut vérifier l’identité institutionnelle et provisionner le premier compte d’un ministère.</p></div></div>;
  }

  return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
    <div className="rounded-3xl bg-[#173F4C] text-white p-6 flex flex-wrap justify-between gap-4">
      <div className="flex gap-3"><ClipboardCheck/><div><h1 className="text-2xl font-black">Demandes institutionnelles</h1><p className="text-sm text-slate-200">Vérification des autorités réelles avant création d’un compte ministériel privilégié.</p></div></div>
      <button onClick={load} disabled={busy} className="p-2 rounded-xl bg-white/10"><RefreshCw className="w-5"/></button>
    </div>

    {msg&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{msg}</div>}
    {temporaryPassword&&<div className="border-2 border-amber-300 bg-amber-50 rounded-2xl p-5">
      <div className="text-xs font-black text-amber-900 uppercase">Mot de passe temporaire — affichage unique</div>
      <div className="mt-2 flex gap-2"><code className="flex-1 bg-white border rounded-xl px-3 py-3 break-all">{temporaryPassword}</code><button onClick={()=>navigator.clipboard?.writeText(temporaryPassword)} className="border bg-white rounded-xl px-4"><Copy className="w-5"/></button></div>
      <p className="text-xs text-amber-800 mt-2">Demande concernée : {selectedId.slice(0,8)}. Transmettez ce mot de passe uniquement par un canal institutionnel approprié.</p>
    </div>}

    <div className="space-y-4">
      {rows.map(row=>{
        const c=checks[row.id]||{};
        const complete=Boolean(c.official_email_verified&&c.appointment_verified&&c.employee_number_verified&&c.assignment_verified);
        return <div key={row.id} className="bg-white border rounded-2xl p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <div className="text-xs font-black text-[#1F4A59]">{row.ministry} · {row.requested_role}</div>
              <div className="font-black mt-1">{row.full_name}</div>
              <div className="text-sm text-slate-500">{row.function_title} · {row.entity}</div>
              <div className="text-xs text-slate-400 mt-1">{row.official_email} · {row.phone}</div>
            </div>
            <span className="h-fit rounded-full bg-amber-50 text-amber-800 px-3 py-2 text-xs font-black">{row.status}</span>
          </div>

          <div className="grid md:grid-cols-2 gap-3 mt-4 text-sm">
            <p><b>Matricule :</b> {row.employee_number}</p>
            <p><b>Service :</b> {row.service_unit}</p>
            <p className="md:col-span-2"><b>Référence de nomination :</b> {row.appointment_reference}</p>
            <p className="md:col-span-2"><b>Justification :</b> {row.justification}</p>
          </div>

          {row.proof_url&&<a href={row.proof_url} target="_blank" rel="noreferrer" className="inline-flex mt-4 items-center gap-2 text-sm font-black text-[#1F4A59] underline"><ExternalLink className="w-4"/>Ouvrir le justificatif professionnel sécurisé</a>}

          <div className="mt-5 border rounded-2xl p-4 bg-slate-50">
            <div className="font-black text-sm">Contrôles obligatoires avant provisionnement</div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={Boolean(c.official_email_verified)} onChange={e=>setCheck(row.id,'official_email_verified',e.target.checked)}/><span>E-mail professionnel vérifié auprès de la structure</span></label>
              <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={Boolean(c.appointment_verified)} onChange={e=>setCheck(row.id,'appointment_verified',e.target.checked)}/><span>Acte/référence de nomination vérifié</span></label>
              <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={Boolean(c.employee_number_verified)} onChange={e=>setCheck(row.id,'employee_number_verified',e.target.checked)}/><span>Matricule administratif vérifié</span></label>
              <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={Boolean(c.assignment_verified)} onChange={e=>setCheck(row.id,'assignment_verified',e.target.checked)}/><span>Affectation et rôle demandé confirmés</span></label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button disabled={busy||!complete} onClick={()=>approve(row)} className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-black flex gap-2 disabled:opacity-40"><CheckCircle2 className="w-4"/>Approuver et créer le compte</button>
            <button disabled={busy} onClick={()=>reject(row)} className="px-4 py-3 rounded-xl bg-rose-50 text-rose-800 font-black flex gap-2"><XCircle className="w-4"/>Rejeter</button>
          </div>
        </div>;
      })}
      {!rows.length&&!busy&&<div className="bg-white border rounded-2xl p-10 text-center text-slate-500">Aucune demande institutionnelle en attente.</div>}
    </div>
  </div>;
}
