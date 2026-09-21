import { getSupabaseClient } from '../lib/supabase';

export const GOVERNMENT_MINISTRIES = ['ETAT','MEPSA','MES','METP','MFP'] as const;

const SUBORDINATE_SUFFIXES = [
  'DIRECTEUR','CHEF_SERVICE','AGENT_INSTRUCTEUR','SIGNATAIRE_HABILITE','SIGNER_ADMIN','FINANCE'
] as const;
const HIGH_SUFFIXES = ['MINISTRE','CABINET','SECRETAIRE_GENERAL','DG','DIRECTEUR_GENERAL'] as const;

export const GOVERNMENT_ROLE_LABELS: Record<string,string> = {
  ETAT_ADMIN: 'Administrateur État',
  MINISTRE: 'Ministre',
  CABINET: 'Cabinet',
  SECRETAIRE_GENERAL: 'Secrétaire général',
  DG: 'Direction générale',
  DIRECTEUR_GENERAL: 'Directeur général',
  DIRECTEUR: 'Directeur',
  CHEF_SERVICE: 'Chef de service',
  AGENT_INSTRUCTEUR: 'Agent instructeur',
  SIGNATAIRE_HABILITE: 'Signataire habilité',
  SIGNER_ADMIN: 'Gestionnaire des habilitations',
  FINANCE: 'Agent financier',
};

export function normalizeGovernmentRole(role:string){
  return String(role||'').trim().toUpperCase().replace(/[ -]+/g,'_');
}

export function isGovernmentRole(role:string){
  const r=normalizeGovernmentRole(role);
  return r==='ETAT_ADMIN'||/^(MEPSA|MES|METP|MFP)_/.test(r);
}

export function inferGovernmentMinistry(role:string){
  const r=normalizeGovernmentRole(role);
  if(r==='ETAT_ADMIN') return 'ETAT';
  return r.match(/^(MEPSA|MES|METP|MFP)_/)?.[1]||null;
}

export function canManageGovernmentAccounts(role:string){
  const r=normalizeGovernmentRole(role);
  return r==='ETAT_ADMIN'||/^(MEPSA|MES|METP|MFP)_(MINISTRE|CABINET|SECRETAIRE_GENERAL|DG|DIRECTEUR_GENERAL)$/.test(r);
}

export function availableGovernmentRoles(actorRole:string,ministry:string){
  const actor=normalizeGovernmentRole(actorRole);
  const m=String(ministry||'').toUpperCase();
  if(m==='ETAT') return actor==='ETAT_ADMIN' ? [{value:'ETAT_ADMIN',label:GOVERNMENT_ROLE_LABELS.ETAT_ADMIN}] : [];
  const suffixes=actor==='ETAT_ADMIN' ? [...HIGH_SUFFIXES,...SUBORDINATE_SUFFIXES] : [...SUBORDINATE_SUFFIXES];
  return suffixes.map(s=>({value:`${m}_${s}`,label:GOVERNMENT_ROLE_LABELS[s]||s}));
}

export async function listGovernmentAccounts(ministry?:string|null){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('list_government_accounts',{p_ministry:ministry||null});
  if(error) throw error;
  return data||[];
}

export async function provisionGovernmentAccount(input:{
  name:string; email:string; ministry:string; governmentRole:string; direction?:string; officialTitle?:string;
}){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.functions.invoke('provision-government-account',{body:{
    name:input.name,email:input.email,ministry:input.ministry,government_role:input.governmentRole,
    direction:input.direction||null,official_title:input.officialTitle||null,
  }});
  if(error) throw error;
  if(data?.error) throw new Error(data.error);
  return data;
}

export async function changeGovernmentAccountStatus(userUid:string,active:boolean){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('change_government_account_status',{p_user_uid:userUid,p_active:active});
  if(error) throw error;
  return data;
}

export async function getMyGovernmentAccount(){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('get_my_government_account');
  if(error) throw error;
  return Array.isArray(data)?data[0]:data;
}

export async function completeGovernmentPasswordSetup(){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('complete_government_password_setup');
  if(error) throw error;
  return data;
}


export async function listGovernmentJurisdictions(ministry:string,entity:string){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('list_government_jurisdictions',{p_ministry:ministry,p_entity:entity});
  if(error) throw error;
  return data||[];
}

export async function searchJurisdictionCandidateSchools(ministry:string,entity:string,search=''){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('list_jurisdiction_candidate_schools',{
    p_ministry:ministry,p_entity:entity,p_search:search.trim()||null
  });
  if(error) throw error;
  return data||[];
}

export async function setGovernmentJurisdiction(ministry:string,entity:string,schoolId:number,active:boolean){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('manage_government_jurisdiction',{
    p_ministry:ministry,p_entity:entity,p_school_id:schoolId,p_active:active
  });
  if(error) throw error;
  return data;
}

export async function getMyGovernmentAssignments(){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('get_my_government_assignments');
  if(error) throw error;
  return data||[];
}
