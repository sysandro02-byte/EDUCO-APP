import { getSupabaseClient } from '../lib/supabase';

export function normalizeMinistryRole(role:string){
  return String(role||'').trim().toUpperCase().replace(/[ -]+/g,'_');
}

export function canClaimAdministrativeApplication(role:string){
  return /_(AGENT_INSTRUCTEUR)$/.test(normalizeMinistryRole(role));
}

export function canSuperviseAdministrativeApplications(role:string){
  return /_(CHEF_SERVICE|DIRECTEUR|DG|DIRECTEUR_GENERAL|CABINET|MINISTRE|SECRETAIRE_GENERAL)$/.test(normalizeMinistryRole(role));
}

export async function listAdministrativeRoutingCandidates(applicationId:string,targetStageOrder?:number|null){
  const supabase=getSupabaseClient(); if(!supabase) throw new Error('Supabase indisponible');
  const {data,error}=await supabase.rpc('list_administrative_routing_candidates',{
    p_application_id:applicationId,
    p_target_stage_order:targetStageOrder??null,
  });
  if(error) throw error;
  return data||[];
}

export async function routeAdministrativeApplication(input:{
  id:string;
  action:'CLAIM'|'ASSIGN'|'FORWARD'|'RETURN'|'REQUEST_MISSING'|'REJECT'|'APPROVE';
  targetUid?:string|null;
  note?:string|null;
}){
  const supabase=getSupabaseClient(); if(!supabase) throw new Error('Supabase indisponible');
  const {data,error}=await supabase.rpc('route_administrative_application',{
    p_id:input.id,
    p_action:input.action,
    p_target_uid:input.targetUid||null,
    p_note:input.note||null,
  });
  if(error) throw error;
  return data;
}
