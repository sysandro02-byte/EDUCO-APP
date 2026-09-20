import React,{useEffect,useMemo,useState} from 'react';
import {FileText,ShieldCheck,Clock,WalletCards,Search,UploadCloud,Send,FolderOpen,Save,AlertTriangle,CheckCircle2} from 'lucide-react';
import {
 createAdministrativeApplication,listAdministrativeServiceCatalog,submitAdministrativeApplication,
 updateAdministrativeApplicationDraft,uploadAdministrativeFile
} from '../src/services/administrativeServices';

type FormField={
 field_key:string;label:string;input_type:string;required:boolean;verified:boolean;
 options:any[];help_text?:string;sort_order:number;
};
type RequiredDocument={
 document_code:string;label:string;required:boolean;verified:boolean;conditional_note?:string;
 allowed_mime_types?:string[];max_size_bytes?:number;sort_order:number;
};
type Service={
 code:string;ministry:string;name:string;audience?:string;legal_status:string;legal_reference?:string;
 fee_amount?:number;fee_currency?:string;fee_status:string;payment_enabled:boolean;output_document?:string;
 publication_status:string;requirements_status:string;request_enabled:boolean;form_version:number;
 form_fields:FormField[];required_documents:RequiredDocument[];
};

const feeLabel=(s:Service)=>{
 if(s.fee_status==='VERIFIED_CURRENT'&&s.fee_amount!=null)return `${Number(s.fee_amount).toLocaleString('fr-FR')} ${s.fee_currency||'XAF'} — tarif vérifié`;
 if(s.fee_status==='FREE')return 'Gratuit';
 if(s.fee_status==='HISTORICAL')return 'Tarif historique — paiement bloqué';
 return 'Tarif à confirmer — paiement bloqué';
};

const requestState=(s:Service)=>{
 if(s.request_enabled)return {label:'Démarche ouverte',cls:'bg-emerald-50 text-emerald-800'};
 if(s.publication_status!=='PUBLISHED')return {label:'Validation juridique en cours',cls:'bg-amber-50 text-amber-800'};
 if(s.legal_status!=='VERIFIED')return {label:'Base juridique à confirmer',cls:'bg-amber-50 text-amber-800'};
 return {label:'Pièces/formulaire à valider',cls:'bg-amber-50 text-amber-800'};
};

export default function AdministrativeServicesPage({currentUser}:{currentUser?:any}){
 const [services,setServices]=useState<Service[]>([]);
 const [ministry,setMinistry]=useState('TOUS');
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState<Service|null>(null);
 const [draft,setDraft]=useState<any>(null);
 const [formData,setFormData]=useState<Record<string,any>>({});
 const [uploaded,setUploaded]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState('');

 const load=async()=>{
  setBusy(true);
  try{setServices(await listAdministrativeServiceCatalog());setNotice('')}
  catch(error:any){setNotice(error?.message||'Catalogue indisponible.')}
  finally{setBusy(false)}
 };
 useEffect(()=>{void load()},[]);

 const rows=useMemo(()=>services.filter(s=>
  (ministry==='TOUS'||s.ministry===ministry)&&
  (!query||[s.name,s.code,s.ministry].join(' ').toLowerCase().includes(query.toLowerCase()))
 ),[services,ministry,query]);

 const choose=(s:Service)=>{setSelected(s);setDraft(null);setFormData({});setUploaded({});setNotice('')};

 const start=async()=>{
  if(!selected)return;
  setBusy(true);
  try{
   const d=await createAdministrativeApplication(selected,currentUser,formData);
   setDraft(d);
   setNotice(selected.request_enabled
    ?'Brouillon créé. Complétez le formulaire et les pièces avant soumission.'
    :'Brouillon de préparation créé. La soumission officielle reste verrouillée jusqu’à validation ministérielle.');
  }catch(error:any){setNotice(error?.message||'Création impossible.')}
  finally{setBusy(false)}
 };

 const saveDraft=async()=>{
  if(!draft)return;
  setBusy(true);
  try{
   const d=await updateAdministrativeApplicationDraft(draft.id,formData);
   setDraft(d);
   setNotice('Brouillon enregistré.');
  }catch(error:any){setNotice(error?.message||'Enregistrement impossible.')}
  finally{setBusy(false)}
 };

 const addFile=async(doc:RequiredDocument|{document_code:string;label:string;allowed_mime_types?:string[];max_size_bytes?:number},file?:File)=>{
  if(!file||!draft)return;
  const allowed=doc.allowed_mime_types||['application/pdf','image/jpeg','image/png'];
  const max=Number(doc.max_size_bytes||10485760);
  if(file.type&&!allowed.includes(file.type)){setNotice('Format non autorisé pour cette pièce.');return}
  if(file.size>max){setNotice(`Fichier trop volumineux. Maximum : ${Math.round(max/1024/1024)} Mo.`);return}
  setBusy(true);
  try{
   await uploadAdministrativeFile(draft.id,file,doc.document_code);
   setUploaded(prev=>({...prev,[doc.document_code]:file.name}));
   setNotice(`${doc.label} enregistré dans le stockage privé.`);
  }catch(error:any){setNotice(error?.message||'Téléversement impossible.')}
  finally{setBusy(false)}
 };

 const submit=async()=>{
  if(!draft||!selected)return;
  if(!selected.request_enabled){
   setNotice('Cette démarche n’est pas encore juridiquement ouverte à la soumission dans EDUCO.');
   return;
  }
  setBusy(true);
  try{
   await updateAdministrativeApplicationDraft(draft.id,formData);
   const d=await submitAdministrativeApplication(draft.id);
   setDraft(d);
   setNotice('Demande soumise officiellement et transmise au ministère.');
  }catch(error:any){setNotice(error?.message||'Soumission impossible.')}
  finally{setBusy(false)}
 };

 const renderField=(field:FormField)=>{
  const common={value:formData[field.field_key]??'',onChange:(e:any)=>setFormData(prev=>({...prev,[field.field_key]:e.target.value})),className:'mt-1 w-full border rounded-xl px-3 py-2.5'};
  if(field.input_type==='textarea')return <textarea {...common} className={common.className+' min-h-24'}/>;
  if(field.input_type==='select')return <select {...common}><option value="">Sélectionner…</option>{(field.options||[]).map((o:any)=><option key={String(o.value??o)} value={String(o.value??o)}>{String(o.label??o)}</option>)}</select>;
  return <input {...common} type={field.input_type==='number'?'number':field.input_type==='date'?'date':field.input_type==='email'?'email':field.input_type==='tel'?'tel':'text'}/>;
 };

 return <div className="p-4 sm:p-6 lg:p-8 space-y-6">
  <div className="rounded-3xl bg-[#1F4A59] text-white p-6 shadow-lg"><div className="flex items-center gap-3"><ShieldCheck className="w-8 h-8 text-emerald-300"/><div><h1 className="text-2xl font-black">Démarches administratives</h1><p className="text-slate-200 text-sm">Catalogue piloté par les validations juridiques, formulaires et pièces officielles.</p></div></div></div>

  <div className="grid md:grid-cols-3 gap-3">
   <div className="bg-white rounded-2xl border p-4 flex gap-3 items-center"><FileText className="w-6 h-6 text-[#1F4A59]"/><div><div className="text-xs text-slate-500 font-bold">Démarches référencées</div><div className="font-black text-slate-800">{services.length}</div></div></div>
   <div className="bg-white rounded-2xl border p-4 flex gap-3 items-center"><WalletCards className="w-6 h-6 text-[#1F4A59]"/><div><div className="text-xs text-slate-500 font-bold">Paiements</div><div className="font-black text-slate-800">Tarif officiel vérifié requis</div></div></div>
   <div className="bg-white rounded-2xl border p-4 flex gap-3 items-center"><Clock className="w-6 h-6 text-[#1F4A59]"/><div><div className="text-xs text-slate-500 font-bold">Ouvertes à la soumission</div><div className="font-black text-slate-800">{services.filter(s=>s.request_enabled).length}</div></div></div>
  </div>

  {notice&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{notice}</div>}

  <div className="bg-white rounded-2xl border p-4 flex flex-col sm:flex-row gap-3">
   <div className="relative flex-1"><Search className="absolute left-3 top-3 w-4 h-4 text-slate-400"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une démarche..." className="w-full pl-10 pr-3 py-2.5 border rounded-xl"/></div>
   <select value={ministry} onChange={e=>setMinistry(e.target.value)} className="border rounded-xl px-3 py-2.5">{['TOUS','MEPSA','METP','MES','MFP'].map(x=><option key={x}>{x}</option>)}</select>
  </div>

  <div className="grid lg:grid-cols-2 gap-4">
   {rows.map(s=>{const state=requestState(s);return <button key={s.code} onClick={()=>choose(s)} className="text-left bg-white border rounded-2xl p-5 hover:shadow-md transition">
    <div className="flex justify-between gap-3"><span className="text-xs font-black text-[#1F4A59]">{s.ministry} · {s.code}</span><span className={`text-[10px] font-bold rounded-full px-2 py-1 ${state.cls}`}>{state.label}</span></div>
    <h2 className="font-black text-slate-900 mt-2">{s.name}</h2>
    <p className="text-sm text-slate-500 mt-1">{s.audience||'Public concerné'} · {s.output_document||'Acte administratif'}</p>
    <p className="text-xs text-slate-400 mt-3">Référence : {s.legal_reference||'À valider'}</p>
   </button>})}
  </div>

  {selected&&<div className="fixed inset-0 z-[100] bg-slate-950/60 overflow-y-auto p-4" onClick={()=>setSelected(null)}>
   <div className="bg-white rounded-3xl p-6 max-w-2xl w-full mx-auto my-8" onClick={e=>e.stopPropagation()}>
    <div className="text-xs font-black text-[#1F4A59]">{selected.ministry} · {selected.code}</div>
    <h2 className="text-xl font-black mt-2">{selected.name}</h2>
    <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm space-y-2">
     <p><b>Demandeur :</b> {selected.audience||'—'}</p>
     <p><b>Document final :</b> {selected.output_document||'—'}</p>
     <p><b>Tarif :</b> {feeLabel(selected)}</p>
     <p><b>Référence :</b> {selected.legal_reference||'À valider'}</p>
     <p><b>Publication :</b> {selected.publication_status} · <b>Exigences :</b> {selected.requirements_status}</p>
    </div>

    {!selected.request_enabled&&<div className="mt-4 p-3 rounded-xl bg-amber-50 text-amber-900 text-sm flex gap-2"><AlertTriangle className="w-5 h-5 shrink-0"/><span>Cette démarche peut être préparée en brouillon, mais EDUCO bloque sa soumission officielle tant que la base juridique, la publication et les exigences ne sont pas validées par l’autorité compétente.</span></div>}

    {!draft&&<div className="flex gap-2 mt-5"><button onClick={()=>setSelected(null)} className="px-4 py-2.5 rounded-xl border font-bold">Fermer</button><button onClick={start} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl bg-[#1F4A59] text-white font-black disabled:opacity-50">Préparer un brouillon</button></div>}

    {draft&&<div className="mt-5 border-t pt-5 space-y-5">
     <div className="flex items-center gap-2 font-black"><FolderOpen className="w-5 h-5"/>Dossier {draft.id.slice(0,8)}</div>

     {selected.form_fields.length>0&&<div className="space-y-3"><h3 className="font-black">Formulaire</h3>{selected.form_fields.map(field=><div key={field.field_key}><label className="text-xs font-black text-slate-600">{field.label}{field.required&&field.verified?' *':''}</label>{renderField(field)}{field.help_text&&<p className="text-[11px] text-slate-500 mt-1">{field.help_text}</p>}{field.required&&!field.verified&&<p className="text-[10px] text-amber-700 mt-1">Exigence proposée — validation ministérielle en attente.</p>}</div>)}</div>}

     <button onClick={saveDraft} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-xl border font-black py-3"><Save className="w-4"/>Enregistrer le brouillon</button>

     {selected.required_documents.length>0&&<div className="space-y-3"><h3 className="font-black">Pièces du dossier</h3>{selected.required_documents.map(doc=><label key={doc.document_code} className="block border rounded-xl p-4 cursor-pointer hover:bg-slate-50">
      <div className="flex justify-between gap-3"><div><div className="font-bold text-sm">{doc.label}{doc.required&&doc.verified?' *':''}</div><div className="text-[11px] text-slate-500 mt-1">{doc.conditional_note||(!doc.verified?'Exigence à valider par le ministère.':'')}</div></div>{uploaded[doc.document_code]?<CheckCircle2 className="w-5 h-5 text-emerald-600"/>:<UploadCloud className="w-5 h-5 text-slate-400"/>}</div>
      {uploaded[doc.document_code]&&<div className="text-xs text-emerald-700 mt-2">{uploaded[doc.document_code]}</div>}
      <input type="file" className="hidden" accept={(doc.allowed_mime_types||[]).join(',')} onChange={e=>void addFile(doc,e.target.files?.[0])}/>
     </label>)}</div>}

     <label className="flex items-center justify-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer"><UploadCloud className="w-5 h-5"/>Ajouter une autre pièce de préparation<input type="file" className="hidden" onChange={e=>void addFile({document_code:'OTHER',label:'Pièce complémentaire'},e.target.files?.[0])}/></label>

     <button onClick={submit} disabled={busy||draft.status!=='DRAFT'||!selected.request_enabled} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white font-black py-3 disabled:opacity-40"><Send className="w-4"/>Soumettre officiellement</button>
     {!selected.request_enabled&&<p className="text-xs text-center text-amber-800">Soumission verrouillée par le catalogue juridique du ministère.</p>}
    </div>}
   </div>
  </div>}
 </div>;
}
