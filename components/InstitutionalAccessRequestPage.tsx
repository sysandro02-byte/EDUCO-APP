import React,{useMemo,useState} from 'react';
import {ArrowLeft,Building2,CheckCircle2,ClipboardCheck,FileUp,Search,ShieldCheck} from 'lucide-react';
import {
  INSTITUTIONAL_MINISTRIES,institutionalRoleOptions,
  submitInstitutionalAccessRequest,trackInstitutionalAccessRequest
} from '../src/services/institutionalAccess';

export default function InstitutionalAccessRequestPage(){
  const [mode,setMode]=useState<'REQUEST'|'TRACK'>('REQUEST');
  const [ministry,setMinistry]=useState('MEPSA');
  const [entity,setEntity]=useState('');
  const [requestedRole,setRequestedRole]=useState('MEPSA_CABINET');
  const [fullName,setFullName]=useState('');
  const [officialEmail,setOfficialEmail]=useState('');
  const [phone,setPhone]=useState('');
  const [employeeNumber,setEmployeeNumber]=useState('');
  const [functionTitle,setFunctionTitle]=useState('');
  const [serviceUnit,setServiceUnit]=useState('');
  const [appointmentReference,setAppointmentReference]=useState('');
  const [justification,setJustification]=useState('');
  const [appointmentFile,setAppointmentFile]=useState<File|null>(null);
  const [requestId,setRequestId]=useState('');
  const [trackingToken,setTrackingToken]=useState('');
  const [trackingResult,setTrackingResult]=useState<any>(null);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');

  const roles=useMemo(()=>institutionalRoleOptions(ministry),[ministry]);

  const changeMinistry=(value:string)=>{
    setMinistry(value);
    setRequestedRole(institutionalRoleOptions(value)[0]?.value||'');
  };

  const submit=async()=>{
    if(!appointmentFile){setMsg('Ajoutez l’acte de nomination ou le justificatif professionnel.');return}
    setBusy(true);setMsg('');
    try{
      const data=await submitInstitutionalAccessRequest({
        ministry,entity,requestedRole,fullName,officialEmail,phone,employeeNumber,
        functionTitle,serviceUnit,appointmentReference,justification,appointmentFile
      });
      setRequestId(data.request_id||'');
      setTrackingToken(data.tracking_token||'');
      setMsg('Demande enregistrée. Conservez la référence et le code de suivi affichés ci-dessous.');
    }catch(error:any){setMsg(error?.message||'Envoi impossible.')}
    finally{setBusy(false)}
  };

  const track=async()=>{
    if(!requestId.trim()||!trackingToken.trim()){setMsg('Référence et code de suivi requis.');return}
    setBusy(true);setMsg('');
    try{
      setTrackingResult(await trackInstitutionalAccessRequest(requestId.trim(),trackingToken.trim()));
    }catch(error:any){setTrackingResult(null);setMsg(error?.message||'Suivi impossible.')}
    finally{setBusy(false)}
  };

  return <div className="min-h-screen bg-[#EBF3F8] p-4 sm:p-6">
    <div className="max-w-4xl mx-auto space-y-5">
      <button onClick={()=>{window.location.href='/'}} className="text-sm font-black text-[#1F4A59] flex gap-2 items-center"><ArrowLeft className="w-4"/>Retour à la connexion</button>

      <div className="bg-[#173F4C] text-white rounded-3xl p-6 sm:p-8">
        <div className="flex gap-3 items-start"><ShieldCheck className="w-8 h-8 text-emerald-300"/><div><h1 className="text-2xl sm:text-3xl font-black">Accès institutionnel EDUCO</h1><p className="text-sm text-slate-200 mt-2">Demande réservée aux autorités ministérielles réellement nommées. Une demande ne crée jamais directement un compte privilégié : elle doit être vérifiée par l’administration de l’État.</p></div></div>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-white border rounded-2xl p-2">
        <button onClick={()=>setMode('REQUEST')} className={`rounded-xl py-3 font-black ${mode==='REQUEST'?'bg-[#1F4A59] text-white':'text-slate-600'}`}>Déposer une demande</button>
        <button onClick={()=>setMode('TRACK')} className={`rounded-xl py-3 font-black ${mode==='TRACK'?'bg-[#1F4A59] text-white':'text-slate-600'}`}>Suivre une demande</button>
      </div>

      {msg&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{msg}</div>}

      {mode==='REQUEST'&&<div className="bg-white border rounded-3xl p-5 sm:p-7 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-xs font-black text-slate-600">Ministère<select value={ministry} onChange={e=>changeMinistry(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal">{INSTITUTIONAL_MINISTRIES.map(m=><option key={m}>{m}</option>)}</select></label>
          <label className="text-xs font-black text-slate-600">Rôle demandé<select value={requestedRole} onChange={e=>setRequestedRole(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal">{roles.map(r=><option key={r.value} value={r.value}>{r.label} · {r.value}</option>)}</select></label>
          <label className="text-xs font-black text-slate-600">Nom complet<input value={fullName} onChange={e=>setFullName(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal"/></label>
          <label className="text-xs font-black text-slate-600">E-mail professionnel<input type="email" value={officialEmail} onChange={e=>setOfficialEmail(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal"/></label>
          <label className="text-xs font-black text-slate-600">Téléphone professionnel<input value={phone} onChange={e=>setPhone(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal"/></label>
          <label className="text-xs font-black text-slate-600">Matricule / identifiant administratif<input value={employeeNumber} onChange={e=>setEmployeeNumber(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal"/></label>
          <label className="text-xs font-black text-slate-600">Fonction officielle<input value={functionTitle} onChange={e=>setFunctionTitle(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal"/></label>
          <label className="text-xs font-black text-slate-600">Direction / entité<input value={entity} onChange={e=>setEntity(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal"/></label>
          <label className="text-xs font-black text-slate-600">Service / unité<input value={serviceUnit} onChange={e=>setServiceUnit(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal"/></label>
          <label className="text-xs font-black text-slate-600">Référence de nomination<input value={appointmentReference} onChange={e=>setAppointmentReference(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 font-normal" placeholder="N° arrêté, décret, décision…"/></label>
        </div>

        <label className="block text-xs font-black text-slate-600">Justification de l’accès<textarea value={justification} onChange={e=>setJustification(e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-3 min-h-28 font-normal" placeholder="Expliquez les responsabilités nécessitant un accès EDUCO."/></label>

        <label className="block border-2 border-dashed rounded-2xl p-5 cursor-pointer hover:bg-slate-50">
          <div className="flex gap-3 items-start"><FileUp className="w-6 h-6 text-[#1F4A59]"/><div><div className="font-black">Acte de nomination / justificatif professionnel</div><p className="text-xs text-slate-500 mt-1">PDF, JPG ou PNG · 10 Mo maximum · stockage privé. N’envoyez pas de document personnel sans rapport avec votre fonction.</p>{appointmentFile&&<p className="text-xs text-emerald-700 mt-2 font-bold">{appointmentFile.name}</p>}</div></div>
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={e=>setAppointmentFile(e.target.files?.[0]||null)}/>
        </label>

        <div className="rounded-xl bg-amber-50 text-amber-900 p-4 text-sm"><b>Important :</b> EDUCO vérifie l’e-mail professionnel, la référence de nomination, le matricule administratif et l’affectation avant tout provisionnement. Aucun droit de publication ministérielle n’est accordé automatiquement.</div>

        <button disabled={busy} onClick={submit} className="w-full bg-[#1F4A59] text-white rounded-xl py-3 font-black disabled:opacity-50 flex justify-center gap-2"><ClipboardCheck className="w-5"/>{busy?'Envoi…':'Envoyer la demande'}</button>

        {requestId&&trackingToken&&<div className="border-2 border-emerald-300 bg-emerald-50 rounded-2xl p-5">
          <div className="flex gap-2 items-center text-emerald-900 font-black"><CheckCircle2 className="w-5"/>Référence de suivi créée</div>
          <div className="mt-3 text-xs text-emerald-900">Référence</div><code className="block bg-white border rounded-xl p-3 break-all">{requestId}</code>
          <div className="mt-3 text-xs text-emerald-900">Code secret de suivi — affiché une seule fois</div><code className="block bg-white border rounded-xl p-3 break-all">{trackingToken}</code>
        </div>}
      </div>}

      {mode==='TRACK'&&<div className="bg-white border rounded-3xl p-5 sm:p-7 space-y-4">
        <div className="flex gap-3 items-start"><Search className="w-6 h-6 text-[#1F4A59]"/><div><h2 className="text-xl font-black">Suivre une demande</h2><p className="text-sm text-slate-500">La référence seule ne suffit pas : le code secret remis lors du dépôt est également requis.</p></div></div>
        <input value={requestId} onChange={e=>setRequestId(e.target.value)} className="w-full border rounded-xl px-3 py-3" placeholder="Référence de demande"/>
        <input value={trackingToken} onChange={e=>setTrackingToken(e.target.value)} className="w-full border rounded-xl px-3 py-3" placeholder="Code secret de suivi"/>
        <button disabled={busy} onClick={track} className="w-full bg-[#1F4A59] text-white rounded-xl py-3 font-black disabled:opacity-50">Consulter le statut</button>

        {trackingResult&&<div className="border rounded-2xl p-5">
          <div className="flex justify-between gap-3"><div><div className="text-xs font-black text-[#1F4A59]">{trackingResult.ministry} · {trackingResult.requested_role}</div><div className="font-black mt-1">{trackingResult.entity}</div></div><span className="h-fit bg-slate-100 rounded-full px-3 py-2 text-xs font-black">{trackingResult.status}</span></div>
          {trackingResult.review_notes&&<div className="mt-4 bg-rose-50 text-rose-900 rounded-xl p-3 text-sm"><b>Motif :</b> {trackingResult.review_notes}</div>}
          <p className="text-xs text-slate-500 mt-4">Déposée le {new Date(trackingResult.created_at).toLocaleString('fr-FR')}</p>
        </div>}
      </div>}
    </div>
  </div>;
}
