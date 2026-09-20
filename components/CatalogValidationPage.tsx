import React,{useEffect,useMemo,useState} from 'react';
import {BookOpenCheck,CheckCircle2,Clock3,FilePlus2,History,Plus,RefreshCw,Save,Send,ShieldCheck,Trash2,XCircle} from 'lucide-react';
import {
  canUseCatalogWorkspace,catalogMinistryFromRole,cancelCatalogChangeRequest,
  finalizeCatalogChangeRequest,listCatalogChangeHistory,listCatalogValidationWorkspace,
  reviewCatalogChangeRequest,saveCatalogChangeRequest,submitCatalogChangeRequest
} from '../src/services/catalogValidation';

type WorkspaceRow={
  service_code:string; ministry:string; service_name:string; current_snapshot:any; active_request:any;
  can_edit:boolean; can_control:boolean; can_final_approve:boolean;
};

const serviceDefaults=(row:WorkspaceRow)=>{
  const active=row.active_request;
  const current=row.current_snapshot?.service||{};
  return active?.proposed_service||{
    name:current.name||row.service_name,
    audience:current.audience||'',
    competent_direction:current.competent_direction||'',
    competent_service:current.competent_service||'',
    legal_status:current.legal_status||'TO_VERIFY',
    legal_reference:current.legal_reference||'',
    legal_source_url:current.legal_source_url||'',
    fee_amount:current.fee_amount??'',
    fee_currency:current.fee_currency||'XAF',
    fee_status:current.fee_status||'TO_VERIFY',
    payment_enabled:Boolean(current.payment_enabled),
    output_document:current.output_document||'',
    publication_status:current.publication_status||'DRAFT',
    requirements_status:current.requirements_status||'TO_VERIFY',
  };
};

const fieldsDefaults=(row:WorkspaceRow)=>row.active_request?.proposed_form_fields||row.current_snapshot?.form_fields||[];
const docsDefaults=(row:WorkspaceRow)=>row.active_request?.proposed_required_documents||row.current_snapshot?.required_documents||[];

export default function CatalogValidationPage({currentUser}:{currentUser?:any}){
  const role=String(currentUser?.role||'');
  const ministry=catalogMinistryFromRole(role);
  const allowed=canUseCatalogWorkspace(role)&&Boolean(ministry);
  const uid=String(currentUser?.uid||'');

  const [rows,setRows]=useState<WorkspaceRow[]>([]);
  const [selectedCode,setSelectedCode]=useState('');
  const [proposal,setProposal]=useState<any>({});
  const [fields,setFields]=useState<any[]>([]);
  const [docs,setDocs]=useState<any[]>([]);
  const [history,setHistory]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');

  const selected=useMemo(()=>rows.find(r=>r.service_code===selectedCode)||rows[0]||null,[rows,selectedCode]);
  const active=selected?.active_request||null;
  const isOwnDraft=active?.status==='DRAFT'&&String(active.created_by||'')===uid;
  const editable=Boolean(selected?.can_edit)&&(!active||isOwnDraft);

  const hydrate=(row:WorkspaceRow|null)=>{
    if(!row)return;
    setSelectedCode(row.service_code);
    setProposal(serviceDefaults(row));
    setFields(fieldsDefaults(row).map((f:any)=>({...f,active:f.active!==false,options:Array.isArray(f.options)?f.options:[]})));
    setDocs(docsDefaults(row).map((d:any)=>({...d,active:d.active!==false,allowed_mime_types:Array.isArray(d.allowed_mime_types)?d.allowed_mime_types:['application/pdf','image/jpeg','image/png']})));
  };

  const load=async(preferred?:string)=>{
    if(!allowed||!ministry)return;
    setBusy(true);setMsg('');
    try{
      const data=await listCatalogValidationWorkspace(ministry);
      setRows(data);
      const row=data.find((x:any)=>x.service_code===(preferred||selectedCode))||data[0]||null;
      hydrate(row);
      if(row)setHistory(await listCatalogChangeHistory(row.service_code));
    }catch(error:any){setMsg(error?.message||'Chargement du catalogue impossible.')}
    finally{setBusy(false)}
  };

  useEffect(()=>{void load()},[ministry,allowed]);

  const selectRow=async(row:WorkspaceRow)=>{
    hydrate(row);
    setBusy(true);
    try{setHistory(await listCatalogChangeHistory(row.service_code));}
    catch(error:any){setMsg(error?.message||'Historique indisponible.')}
    finally{setBusy(false)}
  };

  const setService=(key:string,value:any)=>setProposal((p:any)=>({...p,[key]:value}));

  const save=async()=>{
    if(!selected)return;
    setBusy(true);setMsg('');
    try{
      const result=await saveCatalogChangeRequest({
        requestId:isOwnDraft?active.id:null,
        serviceCode:selected.service_code,
        proposedService:proposal,
        formFields:fields,
        requiredDocuments:docs,
      });
      setMsg('Brouillon de modification enregistré et journalisé.');
      await load(selected.service_code);
      return result;
    }catch(error:any){setMsg(error?.message||'Enregistrement impossible.');return null}
    finally{setBusy(false)}
  };

  const submit=async()=>{
    let requestId=isOwnDraft?active.id:null;
    if(!requestId){
      const saved=await save();
      requestId=saved?.id||null;
    }
    if(!requestId)return;
    setBusy(true);setMsg('');
    try{
      await submitCatalogChangeRequest(requestId);
      setMsg('Proposition transmise au premier contrôle. Le créateur ne peut plus la valider.');
      await load(selected?.service_code);
    }catch(error:any){setMsg(error?.message||'Soumission au contrôle impossible.')}
    finally{setBusy(false)}
  };

  const decision=async(stage:'CONTROL'|'FINAL',decisionValue:'APPROVE'|'REJECT')=>{
    if(!active)return;
    const note=decisionValue==='REJECT'
      ? window.prompt('Motif obligatoire du rejet :')||''
      : window.prompt('Note de validation (optionnelle) :')||'';
    if(decisionValue==='REJECT'&&!note.trim())return;
    setBusy(true);setMsg('');
    try{
      if(stage==='CONTROL')await reviewCatalogChangeRequest(active.id,decisionValue,note);
      else await finalizeCatalogChangeRequest(active.id,decisionValue,note);
      setMsg(decisionValue==='APPROVE'
        ? stage==='CONTROL'?'Premier contrôle validé. Une seconde autorité distincte doit maintenant approuver.':'Validation finale appliquée au catalogue.'
        :'Proposition rejetée et historisée.');
      await load(selected?.service_code);
    }catch(error:any){setMsg(error?.message||'Décision impossible.')}
    finally{setBusy(false)}
  };

  const cancelDraft=async()=>{
    if(!active||!isOwnDraft)return;
    setBusy(true);setMsg('');
    try{await cancelCatalogChangeRequest(active.id);setMsg('Brouillon annulé.');await load(selected?.service_code)}
    catch(error:any){setMsg(error?.message||'Annulation impossible.')}
    finally{setBusy(false)}
  };

  const addField=()=>setFields(v=>[...v,{
    field_key:`field_${v.length+1}`,label:'Nouveau champ',input_type:'text',
    required:false,verified:false,options:[],help_text:'',sort_order:(v.length+1)*10,active:true
  }]);
  const addDoc=()=>setDocs(v=>[...v,{
    document_code:`DOC_${v.length+1}`,label:'Nouvelle pièce',required:true,verified:false,
    conditional_note:'',allowed_mime_types:['application/pdf','image/jpeg','image/png'],
    max_size_bytes:10485760,sort_order:(v.length+1)*10,active:true
  }]);

  if(!allowed){
    return <div className="max-w-4xl mx-auto p-6"><div className="bg-white border rounded-2xl p-8 text-center"><ShieldCheck className="w-12 h-12 mx-auto text-slate-400"/><h1 className="text-xl font-black mt-3">Catalogue ministériel</h1><p className="text-slate-500 mt-2">Accès réservé aux autorités et responsables ministériels habilités. ETAT_ADMIN et les administrateurs EDUCO n’ont pas le droit de publier une procédure ministérielle.</p></div></div>;
  }

  return <div className="p-4 sm:p-6 lg:p-8 space-y-5">
    <div className="rounded-3xl bg-[#173F4C] text-white p-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex gap-3"><BookOpenCheck/><div><h1 className="text-2xl font-black">Catalogue ministériel · {ministry}</h1><p className="text-sm text-slate-200">Références juridiques, tarifs, formulaires, pièces et publication avec double validation.</p></div></div>
      <button onClick={()=>load()} disabled={busy} className="p-2 rounded-xl bg-white/10"><RefreshCw className="w-5"/></button>
    </div>

    {msg&&<div className="bg-white border rounded-xl p-3 text-sm font-semibold">{msg}</div>}

    <div className="grid xl:grid-cols-[300px_1fr] gap-5">
      <div className="space-y-2">
        {rows.map(row=>{
          const req=row.active_request;
          const current=row.current_snapshot?.service||{};
          return <button key={row.service_code} onClick={()=>void selectRow(row)} className={`w-full text-left border rounded-2xl p-4 transition ${selected?.service_code===row.service_code?'bg-[#173F4C] text-white':'bg-white hover:bg-slate-50'}`}>
            <div className="text-[11px] font-black opacity-70">{row.service_code}</div>
            <div className="font-black mt-1">{row.service_name}</div>
            <div className="text-xs mt-2 opacity-80">{req?`Proposition : ${req.status}`:`Catalogue : ${current.publication_status||'—'}`}</div>
          </button>;
        })}
      </div>

      {selected&&<div className="space-y-5">
        <div className="bg-white border rounded-2xl p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div><div className="text-xs font-black text-[#1F4A59]">{selected.service_code}</div><h2 className="text-xl font-black mt-1">{selected.service_name}</h2></div>
            {active?<span className="h-fit rounded-full bg-amber-50 text-amber-800 px-3 py-2 text-xs font-black">{active.status}</span>:<span className="h-fit rounded-full bg-slate-100 px-3 py-2 text-xs font-black">Aucune proposition ouverte</span>}
          </div>

          {active&&<div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
            <div><b>Créateur :</b> {String(active.created_by)===uid?'Vous':String(active.created_by).slice(0,8)}</div>
            {active.control_approved_by&&<div><b>Premier contrôle :</b> {String(active.control_approved_by)===uid?'Vous':String(active.control_approved_by).slice(0,8)}</div>}
            <p className="text-xs text-slate-500 mt-2">Le créateur, le premier contrôleur et l’approbateur final doivent être des personnes distinctes.</p>
          </div>}

          <div className="grid md:grid-cols-2 gap-3 mt-5">
            <label className="text-xs font-black text-slate-600">Nom<input disabled={!editable} value={proposal.name||''} onChange={e=>setService('name',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50"/></label>
            <label className="text-xs font-black text-slate-600">Public concerné<input disabled={!editable} value={proposal.audience||''} onChange={e=>setService('audience',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50"/></label>
            <label className="text-xs font-black text-slate-600">Direction compétente<input disabled={!editable} value={proposal.competent_direction||''} onChange={e=>setService('competent_direction',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50"/></label>
            <label className="text-xs font-black text-slate-600">Service compétent<input disabled={!editable} value={proposal.competent_service||''} onChange={e=>setService('competent_service',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50"/></label>
            <label className="text-xs font-black text-slate-600">Statut juridique<select disabled={!editable} value={proposal.legal_status||'TO_VERIFY'} onChange={e=>setService('legal_status',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50">{['TO_VERIFY','VERIFIED','OBSOLETE'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="text-xs font-black text-slate-600">Statut des exigences<select disabled={!editable} value={proposal.requirements_status||'TO_VERIFY'} onChange={e=>setService('requirements_status',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50">{['TO_VERIFY','VERIFIED','SUSPENDED'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="md:col-span-2 text-xs font-black text-slate-600">Référence juridique<textarea disabled={!editable} value={proposal.legal_reference||''} onChange={e=>setService('legal_reference',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 min-h-20 font-normal disabled:bg-slate-50"/></label>
            <label className="md:col-span-2 text-xs font-black text-slate-600">Source juridique officielle<input disabled={!editable} value={proposal.legal_source_url||''} onChange={e=>setService('legal_source_url',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50" placeholder="URL officielle / référence de publication"/></label>
            <label className="text-xs font-black text-slate-600">Statut tarifaire<select disabled={!editable} value={proposal.fee_status||'TO_VERIFY'} onChange={e=>setService('fee_status',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50">{['TO_VERIFY','VERIFIED_CURRENT','HISTORICAL','FREE'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="text-xs font-black text-slate-600">Montant<input disabled={!editable} type="number" min="0" value={proposal.fee_amount??''} onChange={e=>setService('fee_amount',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50"/></label>
            <label className="text-xs font-black text-slate-600">Devise<input disabled={!editable} value={proposal.fee_currency||'XAF'} onChange={e=>setService('fee_currency',e.target.value.toUpperCase())} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50"/></label>
            <label className="text-xs font-black text-slate-600">Document final<input disabled={!editable} value={proposal.output_document||''} onChange={e=>setService('output_document',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50"/></label>
            <label className="text-xs font-black text-slate-600">Publication<select disabled={!editable} value={proposal.publication_status||'DRAFT'} onChange={e=>setService('publication_status',e.target.value)} className="mt-1 w-full border rounded-xl px-3 py-2 font-normal disabled:bg-slate-50">{['DRAFT','LEGAL_REVIEW','MINISTRY_APPROVED','PUBLISHED','SUSPENDED'].map(x=><option key={x}>{x}</option>)}</select></label>
            <label className="flex items-center gap-2 text-sm font-bold mt-5"><input disabled={!editable} type="checkbox" checked={Boolean(proposal.payment_enabled)} onChange={e=>setService('payment_enabled',e.target.checked)}/>Activer le paiement officiel</label>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <div className="flex justify-between gap-3"><div><h3 className="font-black">Champs du formulaire</h3><p className="text-xs text-slate-500">Un champ obligatoire doit être marqué « vérifié » avant de pouvoir valider les exigences.</p></div>{editable&&<button onClick={addField} className="h-fit border rounded-xl px-3 py-2 font-bold text-sm flex gap-2"><Plus className="w-4"/>Champ</button>}</div>
          <div className="space-y-3 mt-4">{fields.map((f,i)=><div key={i} className="grid md:grid-cols-[1fr_1fr_150px_auto] gap-2 border rounded-xl p-3">
            <input disabled={!editable} value={f.field_key||''} onChange={e=>setFields(v=>v.map((x,j)=>j===i?{...x,field_key:e.target.value}:x))} className="border rounded-lg px-2 py-2 text-sm disabled:bg-slate-50" placeholder="field_key"/>
            <input disabled={!editable} value={f.label||''} onChange={e=>setFields(v=>v.map((x,j)=>j===i?{...x,label:e.target.value}:x))} className="border rounded-lg px-2 py-2 text-sm disabled:bg-slate-50" placeholder="Libellé"/>
            <select disabled={!editable} value={f.input_type||'text'} onChange={e=>setFields(v=>v.map((x,j)=>j===i?{...x,input_type:e.target.value}:x))} className="border rounded-lg px-2 py-2 text-sm disabled:bg-slate-50">{['text','email','tel','date','textarea','select','number'].map(x=><option key={x}>{x}</option>)}</select>
            <div className="flex items-center gap-2"><label className="text-xs"><input disabled={!editable} type="checkbox" checked={Boolean(f.required)} onChange={e=>setFields(v=>v.map((x,j)=>j===i?{...x,required:e.target.checked}:x))}/> requis</label><label className="text-xs"><input disabled={!editable} type="checkbox" checked={Boolean(f.verified)} onChange={e=>setFields(v=>v.map((x,j)=>j===i?{...x,verified:e.target.checked}:x))}/> vérifié</label>{editable&&<button onClick={()=>setFields(v=>v.filter((_,j)=>j!==i))} className="text-rose-700"><Trash2 className="w-4"/></button>}</div>
          </div>)}</div>
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <div className="flex justify-between gap-3"><div><h3 className="font-black">Pièces justificatives</h3><p className="text-xs text-slate-500">Chaque pièce possède un code stable utilisé lors du contrôle serveur de la soumission.</p></div>{editable&&<button onClick={addDoc} className="h-fit border rounded-xl px-3 py-2 font-bold text-sm flex gap-2"><FilePlus2 className="w-4"/>Pièce</button>}</div>
          <div className="space-y-3 mt-4">{docs.map((d,i)=><div key={i} className="grid md:grid-cols-[180px_1fr_auto] gap-2 border rounded-xl p-3">
            <input disabled={!editable} value={d.document_code||''} onChange={e=>setDocs(v=>v.map((x,j)=>j===i?{...x,document_code:e.target.value.toUpperCase()}:x))} className="border rounded-lg px-2 py-2 text-sm disabled:bg-slate-50" placeholder="DOCUMENT_CODE"/>
            <input disabled={!editable} value={d.label||''} onChange={e=>setDocs(v=>v.map((x,j)=>j===i?{...x,label:e.target.value}:x))} className="border rounded-lg px-2 py-2 text-sm disabled:bg-slate-50" placeholder="Libellé"/>
            <div className="flex items-center gap-2"><label className="text-xs"><input disabled={!editable} type="checkbox" checked={Boolean(d.required)} onChange={e=>setDocs(v=>v.map((x,j)=>j===i?{...x,required:e.target.checked}:x))}/> requise</label><label className="text-xs"><input disabled={!editable} type="checkbox" checked={Boolean(d.verified)} onChange={e=>setDocs(v=>v.map((x,j)=>j===i?{...x,verified:e.target.checked}:x))}/> vérifiée</label>{editable&&<button onClick={()=>setDocs(v=>v.filter((_,j)=>j!==i))} className="text-rose-700"><Trash2 className="w-4"/></button>}</div>
          </div>)}</div>
        </div>

        <div className="bg-white border rounded-2xl p-5 flex flex-wrap gap-2">
          {editable&&<button disabled={busy} onClick={save} className="px-4 py-3 rounded-xl border font-black flex gap-2"><Save className="w-4"/>Enregistrer le brouillon</button>}
          {editable&&<button disabled={busy} onClick={submit} className="px-4 py-3 rounded-xl bg-sky-600 text-white font-black flex gap-2"><Send className="w-4"/>Soumettre au premier contrôle</button>}
          {isOwnDraft&&<button disabled={busy} onClick={cancelDraft} className="px-4 py-3 rounded-xl bg-rose-50 text-rose-800 font-black flex gap-2"><XCircle className="w-4"/>Annuler le brouillon</button>}

          {active?.status==='SUBMITTED'&&selected.can_control&&String(active.created_by)!==uid&&<>
            <button disabled={busy} onClick={()=>decision('CONTROL','APPROVE')} className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-black flex gap-2"><CheckCircle2 className="w-4"/>Valider le premier contrôle</button>
            <button disabled={busy} onClick={()=>decision('CONTROL','REJECT')} className="px-4 py-3 rounded-xl bg-rose-50 text-rose-800 font-black">Rejeter</button>
          </>}

          {active?.status==='CONTROL_APPROVED'&&selected.can_final_approve&&String(active.created_by)!==uid&&String(active.control_approved_by)!==uid&&<>
            <button disabled={busy} onClick={()=>decision('FINAL','APPROVE')} className="px-4 py-3 rounded-xl bg-[#1F4A59] text-white font-black flex gap-2"><ShieldCheck className="w-4"/>Approbation finale et application</button>
            <button disabled={busy} onClick={()=>decision('FINAL','REJECT')} className="px-4 py-3 rounded-xl bg-rose-50 text-rose-800 font-black">Rejeter au contrôle final</button>
          </>}
        </div>

        <div className="bg-white border rounded-2xl p-5">
          <div className="flex gap-2 items-center"><History className="w-5"/><h3 className="font-black">Historique de validation</h3></div>
          <div className="mt-4 space-y-2">{history.map(h=><div key={h.event_id} className="border-l-2 pl-3 py-1"><div className="text-sm font-black">{h.action}</div><div className="text-xs text-slate-500">{new Date(h.created_at).toLocaleString('fr-FR')} · {h.actor_name||String(h.actor_uid).slice(0,8)}</div>{h.note&&<div className="text-xs mt-1">{h.note}</div>}</div>)}
          {!history.length&&<div className="text-sm text-slate-500 flex gap-2"><Clock3 className="w-4"/>Aucun changement validé pour cette démarche.</div>}</div>
        </div>
      </div>}
    </div>
  </div>;
}
