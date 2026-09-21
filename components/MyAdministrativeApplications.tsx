import React,{useEffect,useState} from 'react';
import {ClipboardList,RefreshCw,Clock3,CheckCircle2,AlertCircle,UploadCloud,Send,ReceiptText,Printer,ShieldCheck} from 'lucide-react';
import {listMyAdministrativeApplications,resubmitAdministrativeApplication,uploadAdministrativeFile} from '../src/services/administrativeServices';
import {initiateAdministrativePayment,listAdministrativePaymentProviders,listMyAdministrativePaymentReceipts} from '../src/services/administrativePayments';

const labels:any={
 DRAFT:'Brouillon',SUBMITTED:'Soumise',UNDER_REVIEW:'En instruction',
 MISSING_DOCUMENTS:'Complément demandé',APPROVED:'Validée',REJECTED:'Rejetée',
 PAYMENT_DUE:'Paiement requis',PAID:'Payée',DOCUMENT_ISSUED:'Document délivré'
};

const escapeHtml=(value:any)=>String(value??'').replace(/[&<>"']/g,ch=>({
 '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[ch]||ch));

export default function MyAdministrativeApplications(){
 const [rows,setRows]=useState<any[]>([]);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState('');
 const [files,setFiles]=useState<Record<string,File|null>>({});
 const [paymentProviders,setPaymentProviders]=useState<any[]>([]);
 const [selectedProvider,setSelectedProvider]=useState<Record<string,string>>({});
 const [receiptsByApplication,setReceiptsByApplication]=useState<Record<string,any>>({});

 const load=async()=>{
  setBusy(true);
  try{
   const [applications,providers,receipts]=await Promise.all([
    listMyAdministrativeApplications(),
    listAdministrativePaymentProviders().catch(()=>[]),
    listMyAdministrativePaymentReceipts().catch(()=>[])
   ]);
   setRows(applications);
   setPaymentProviders(providers);
   setReceiptsByApplication(Object.fromEntries(receipts.map((receipt:any)=>[receipt.application_id,receipt])));
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

 const printReceipt=(receipt:any,row:any)=>{
  const popup=window.open('','_blank','noopener,noreferrer,width=860,height=900');
  if(!popup){setMsg('Autorisez les fenêtres contextuelles pour imprimer le reçu.');return}
  const official=receipt.receipt_scope==='OFFICIAL_QUITTANCE';
  const title=official?'Quittance de paiement rattachée au canal habilité':'Confirmation de paiement EDUCO';
  const legalNote=official
   ?'Cette quittance est rattachée à la référence fiscale ou de perception fournie par le canal habilité.'
   :'Ce reçu confirme l’enregistrement technique du paiement dans EDUCO. Il ne remplace pas une quittance fiscale ou du Trésor lorsqu’une telle quittance est légalement requise.';
  popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(receipt.receipt_number)}</title>
   <style>body{font-family:Arial,sans-serif;color:#173f4c;padding:36px;max-width:760px;margin:auto}h1{margin:0 0 6px}.box{border:1px solid #dbe4e7;border-radius:16px;padding:18px;margin-top:20px}.row{display:flex;justify-content:space-between;gap:20px;padding:8px 0;border-bottom:1px solid #eef2f3}.row:last-child{border-bottom:0}.label{color:#64748b}.note{margin-top:22px;padding:14px;background:#f8fafc;border-radius:12px;font-size:12px;line-height:1.5}.token{word-break:break-all;font-family:monospace;font-size:11px}@media print{button{display:none}}</style>
   </head><body><h1>EDUCO</h1><div>${escapeHtml(title)}</div>
   <div class="box">
    <div class="row"><span class="label">N° reçu</span><b>${escapeHtml(receipt.receipt_number)}</b></div>
    <div class="row"><span class="label">Dossier</span><span>${escapeHtml(row.id)}</span></div>
    <div class="row"><span class="label">Démarche</span><span>${escapeHtml(row.ministry)} · ${escapeHtml(row.service_code)}</span></div>
    <div class="row"><span class="label">Montant</span><b>${Number(receipt.amount||0).toLocaleString('fr-FR')} ${escapeHtml(receipt.currency||'XAF')}</b></div>
    <div class="row"><span class="label">Canal</span><span>${escapeHtml(receipt.provider_name||receipt.provider_code)}</span></div>
    <div class="row"><span class="label">Référence EDUCO</span><span>${escapeHtml(receipt.internal_reference)}</span></div>
    ${receipt.provider_reference?`<div class="row"><span class="label">Référence fournisseur</span><span>${escapeHtml(receipt.provider_reference)}</span></div>`:''}
    ${receipt.fiscal_receipt_reference?`<div class="row"><span class="label">Référence fiscale/perception</span><b>${escapeHtml(receipt.fiscal_receipt_reference)}</b></div>`:''}
    <div class="row"><span class="label">Payé le</span><span>${escapeHtml(new Date(receipt.paid_at).toLocaleString('fr-FR'))}</span></div>
    <div class="row"><span class="label">Statut</span><b>${escapeHtml(receipt.status)}</b></div>
   </div>
   <div class="note">${escapeHtml(legalNote)}<br/><br/>Jeton de vérification : <span class="token">${escapeHtml(receipt.verification_token)}</span></div>
   <button onclick="window.print()" style="margin-top:20px;padding:12px 18px;border:0;border-radius:10px;background:#173f4c;color:white;font-weight:700">Imprimer</button>
   </body></html>`);
  popup.document.close();
  popup.focus();
 };

 return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
  <div className="rounded-3xl bg-[#173F4C] text-white p-6 flex justify-between">
   <div className="flex gap-3"><ClipboardList/><div><h1 className="text-2xl font-black">Mes démarches</h1><p className="text-sm text-slate-200">Suivi de vos demandes administratives, paiements et décisions.</p></div></div>
   <button onClick={load} className="p-2 h-fit bg-white/10 rounded-xl"><RefreshCw className="w-5"/></button>
  </div>

  {msg&&<div className="bg-white border rounded-xl p-3">{msg}</div>}

  <div className="space-y-3">
   {rows.map(r=>{
    const receipt=receiptsByApplication[r.id];
    return <div key={r.id} className="bg-white border rounded-2xl p-5">
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

    {receipt&&<div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
       <div className="flex gap-2">
        <ReceiptText className="w-5 h-5 text-emerald-700 mt-0.5"/>
        <div>
         <div className="font-black text-emerald-900">{receipt.receipt_scope==='OFFICIAL_QUITTANCE'?'Quittance de paiement':'Reçu de confirmation de paiement'}</div>
         <div className="text-xs text-emerald-800 mt-1">{receipt.receipt_number} · {Number(receipt.amount||0).toLocaleString('fr-FR')} {receipt.currency}</div>
         <div className="text-xs text-emerald-800 mt-1 flex gap-1 items-center"><ShieldCheck className="w-3.5"/>Jeton de vérification enregistré.</div>
        </div>
       </div>
       <button onClick={()=>printReceipt(receipt,r)} className="rounded-xl bg-white border border-emerald-300 text-emerald-900 px-3 py-2 text-sm font-black flex items-center gap-2"><Printer className="w-4"/>Imprimer</button>
      </div>
      {receipt.receipt_scope!=='OFFICIAL_QUITTANCE'&&<p className="text-xs text-emerald-900 mt-3">Confirmation technique EDUCO : elle ne remplace pas une quittance fiscale ou du Trésor lorsqu’elle est légalement requise.</p>}
      {receipt.fiscal_receipt_reference&&<p className="text-xs text-emerald-900 mt-2"><b>Référence fiscale/perception :</b> {receipt.fiscal_receipt_reference}</p>}
     </div>}

    {r.status==='DOCUMENT_ISSUED'&&<div className="mt-3 flex gap-2 text-emerald-700 text-sm font-bold"><CheckCircle2 className="w-4"/>Document disponible dans « Mes documents officiels ».</div>}
   </div>})}
  </div>

  {!busy&&!rows.length&&<div className="bg-white border rounded-2xl p-10 text-center text-slate-500"><Clock3 className="mx-auto mb-2"/>Aucune démarche enregistrée.</div>}
 </div>;
}
