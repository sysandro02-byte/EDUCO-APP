import React,{useEffect,useState} from 'react';
import {ClipboardList,RefreshCw,Clock3,CheckCircle2,AlertCircle,UploadCloud,Send} from 'lucide-react';
import {listMyAdministrativeApplications,resubmitAdministrativeApplication,uploadAdministrativeFile} from '../src/services/administrativeServices';
import {initiateAdministrativePayment,listAdministrativePaymentProviders} from '../src/services/administrativePayments';

const labels:any={
 DRAFT:'Brouillon',SUBMITTED:'Soumise',UNDER_REVIEW:'En instruction',
 MISSING_DOCUMENTS:'Complément demandé',APPROVED:'Validée',REJECTED:'Rejetée',
 PAYMENT_DUE:'Paiement requis',PAID:'Payée',DOCUMENT_ISSUED:'Document délivré'
};

export default function MyAdministrativeApplications(){
 const [rows,setRows]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 const [files,setFiles]=useState<Record<string,File|null>>({});
 const [paymentProviders,setPaymentProviders]=useState<any[]>([]);
 const [selectedProvider,setSelectedProvider]=useState<Record<string,string>>({});

 const load=async()=>{
  setBusy(true);
  try{
   const [applications,providers]=await Promise.all([
    listMyAdministrativeApplications(),
    listAdministrativePaymentProviders().catch(()=>[])
   ]);
   setRows(applications);
   setPaymentProviders(providers);
   setSelectedProvider(prev=>{
    const next={...prev};
    for(const row of applications){
     if(row.status==='PAYMENT_DUE'&&!next[row.id]&&providers[0]?.code)next[row.id]=providers[0].code;
    }
    return next;
   });
   setMsg('');
  }
  catch(e:any){setMsg(e?.message||'Chargement impossible')}
  finally{setBusy(false)}
 };
 useEffect(()=>{void load()},[]);

 const startPayment=async(row:any)=>{
  const providerCode=selectedProvider[row.id];
  if(!providerCode){setMsg('Aucun canal officiel de paiement n’est disponible.');return}
  setBusy(true);setMsg('');
  try{
   const result=await initiateAdministrativePayment(row.id,providerCode);
   const checkoutUrl=String(result?.checkout_url||'');
   if(!/^https:\/\//i.test(checkoutUrl))throw new Error('Lien de paiement invalide.');
   window.location.assign(checkoutUrl);
  }catch(error:any){
   setMsg(error?.message||'Initialisation du paiement impossible.');
  }finally{setBusy(false)}
 };

 const sendComplement=async(row:any)=>{
  const file=files[row.id];
  if(!file){setMsg('Ajoutez d’abord le document complémentaire demandé.');return}
  setBusy(true);setMsg('');
  try{
   await uploadAdministrativeFile(row.id,file);
   await resubmitAdministrativeApplication(row.id);
   setFiles(prev=>({...prev,[row.id]:null}));
   setMsg('Complément transmis. Le dossier est revenu en instruction auprès du même responsable.');
   await load();
  }catch(error:any){
   setMsg(error?.message||'Transmission du complément impossible.');
  }finally{setBusy(false)}
 };

 return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
  <div className="rounded-3xl bg-[#173F4C] text-white p-6 flex justify-between">
   <div className="flex gap-3"><ClipboardList/><div><h1 className="text-2xl font-black">Mes démarches</h1><p className="text-sm text-slate-200">Suivi de vos demandes administratives et des décisions.</p></div></div>
   <button onClick={load} className="p-2 h-fit bg-white/10 rounded-xl"><RefreshCw className="w-5"/></button>
  </div>

  {msg&&<div className="bg-white border rounded-xl p-3">{msg}</div>}

  <div className="space-y-3">
   {rows.map(r=><div key={r.id} className="bg-white border rounded-2xl p-5">
    <div className="flex flex-wrap justify-between gap-3">
     <div>
      <div className="text-xs font-black text-[#1F4A59]">{r.ministry} · {r.service_code}</div>
      <div className="font-black mt-1">Dossier #{r.id.slice(0,8)}</div>
      <div className="text-xs text-slate-500 mt-1">{new Date(r.created_at).toLocaleString('fr-FR')}</div>
      {r.workflow_stage_code&&<div className="text-xs text-slate-500 mt-1">Étape interne : <b>{r.workflow_stage_code}</b></div>}
     </div>
     <span className="h-fit text-xs font-black bg-slate-100 rounded-full px-3 py-2">{labels[r.status]||r.status}</span>
    </div>

    {r.review_note&&<div className="mt-3 bg-amber-50 text-amber-900 rounded-xl p-3 text-sm"><b>Complément demandé :</b> {r.review_note}</div>}
    {r.decision_note&&<div className="mt-3 bg-slate-50 rounded-xl p-3 text-sm"><b>Décision :</b> {r.decision_note}</div>}

    {r.status==='MISSING_DOCUMENTS'&&<div className="mt-4 border rounded-2xl p-4 bg-slate-50">
     <div className="flex gap-2 items-start"><UploadCloud className="w-5 h-5 text-[#1F4A59] mt-0.5"/><div><div className="font-black text-sm">Transmettre le complément</div><p className="text-xs text-slate-500">Ajoutez le document demandé. Le dossier reviendra automatiquement à l’agent qui l’instruisait.</p></div></div>
     <input type="file" onChange={e=>setFiles(prev=>({...prev,[r.id]:e.target.files?.[0]||null}))} className="mt-3 block w-full text-sm"/>
     <button disabled={busy||!files[r.id]} onClick={()=>sendComplement(r)} className="mt-3 rounded-xl bg-[#1F4A59] text-white px-4 py-2.5 font-black flex items-center gap-2 disabled:opacity-50"><Send className="w-4"/>Envoyer le complément</button>
    </div>}

    {r.status==='PAYMENT_DUE'&&<div className="mt-4 rounded-2xl border bg-amber-50 p-4">
      <div className="flex gap-2 items-center text-sm text-amber-900"><AlertCircle className="w-4"/><b>{Number(r.payment_amount||0).toLocaleString('fr-FR')} {r.payment_currency||'XAF'}</b></div>
      {paymentProviders.length===0
       ?<p className="text-xs text-amber-800 mt-2">Paiement verrouillé : aucun canal officiel vérifié n’est actuellement configuré.</p>
       :<div className="mt-3 flex flex-col sm:flex-row gap-2">
         <select value={selectedProvider[r.id]||''} onChange={e=>setSelectedProvider(prev=>({...prev,[r.id]:e.target.value}))} className="flex-1 border rounded-xl px-3 py-2.5 bg-white">
          {paymentProviders.map((p:any)=><option key={p.code} value={p.code}>{p.display_name} · {p.currency}</option>)}
         </select>
         <button disabled={busy||!selectedProvider[r.id]} onClick={()=>startPayment(r)} className="rounded-xl bg-[#1F4A59] text-white px-4 py-2.5 font-black disabled:opacity-50">Payer via le canal officiel</button>
        </div>}
     </div>}
    {r.status==='DOCUMENT_ISSUED'&&<div className="mt-3 flex gap-2 text-emerald-700 text-sm font-bold"><CheckCircle2 className="w-4"/>Document disponible dans « Mes documents officiels ».</div>}
   </div>)}
  </div>

  {!busy&&!rows.length&&<div className="bg-white border rounded-2xl p-10 text-center text-slate-500"><Clock3 className="mx-auto mb-2"/>Aucune démarche enregistrée.</div>}
 </div>;
}
