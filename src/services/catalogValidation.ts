import { getSupabaseClient } from '../lib/supabase';
import { inferGovernmentMinistry, normalizeGovernmentRole } from './governmentAccounts';

export function catalogMinistryFromRole(role:string){
  const ministry=inferGovernmentMinistry(role);
  return ministry==='ETAT'?null:ministry;
}

export function canUseCatalogWorkspace(role:string){
  const r=normalizeGovernmentRole(role);
  return /^(MEPSA|MES|METP|MFP)_(DIRECTEUR|FINANCE|DG|DIRECTEUR_GENERAL|SECRETAIRE_GENERAL|CABINET|MINISTRE)$/.test(r);
}

export async function listCatalogValidationWorkspace(ministry:string){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('list_catalog_validation_workspace',{p_ministry:ministry});
  if(error) throw error;
  return data||[];
}

export async function saveCatalogChangeRequest(input:{
  requestId?:string|null; serviceCode:string; proposedService:any; formFields:any[]; requiredDocuments:any[]; feeVariants:any[];
}){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('save_catalog_change_request',{
    p_request_id:input.requestId||null,
    p_service_code:input.serviceCode,
    p_proposed_service:input.proposedService,
    p_form_fields:input.formFields,
    p_required_documents:input.requiredDocuments,
    p_fee_variants:input.feeVariants||[],
  });
  if(error) throw error;
  return Array.isArray(data)?data[0]:data;
}

export async function submitCatalogChangeRequest(requestId:string){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('submit_catalog_change_request',{p_request_id:requestId});
  if(error) throw error;
  return Array.isArray(data)?data[0]:data;
}

export async function reviewCatalogChangeRequest(requestId:string,decision:'APPROVE'|'REJECT',note?:string|null){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('review_catalog_change_request',{
    p_request_id:requestId,p_decision:decision,p_note:note||null,
  });
  if(error) throw error;
  return Array.isArray(data)?data[0]:data;
}

export async function finalizeCatalogChangeRequest(requestId:string,decision:'APPROVE'|'REJECT',note?:string|null){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('finalize_catalog_change_request',{
    p_request_id:requestId,p_decision:decision,p_note:note||null,
  });
  if(error) throw error;
  return Array.isArray(data)?data[0]:data;
}

export async function cancelCatalogChangeRequest(requestId:string){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('cancel_catalog_change_request',{p_request_id:requestId});
  if(error) throw error;
  return Array.isArray(data)?data[0]:data;
}

export async function listCatalogChangeHistory(serviceCode:string){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('list_catalog_change_history',{p_service_code:serviceCode});
  if(error) throw error;
  return data||[];
}
