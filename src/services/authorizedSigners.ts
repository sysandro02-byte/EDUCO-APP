import { getSupabaseClient } from '../lib/supabase';

export const ADMIN_MINISTRIES = ['MEPSA','MES','METP','MFP'] as const;

export const MINISTRY_SERVICE_CODES: Record<string,{code:string;label:string}[]> = {
  MEPSA: [{code:'MEPSA-AGR',label:'Agrément établissement privé'}],
  MES: [
    {code:'MES-CRE',label:'Création établissement supérieur privé'},
    {code:'MES-OUV',label:'Ouverture établissement supérieur privé'},
    {code:'MES-REN-ENS',label:'Renouvellement autorisation d’enseigner'},
  ],
  METP: [
    {code:'METP-CRE',label:'Création établissement technique/professionnel'},
    {code:'METP-OUV',label:'Ouverture établissement technique/professionnel'},
    {code:'METP-MOD',label:'Modification établissement technique/professionnel'},
  ],
  MFP: [{code:'MFP-EQD',label:'Équivalence administrative de diplôme'}],
};

export function normalizeGovernmentRole(role:string){
  return String(role||'').trim().toUpperCase().replace(/[ -]+/g,'_');
}

export function inferGovernmentMinistry(role:string){
  const normalized=normalizeGovernmentRole(role);
  if(normalized==='ETAT_ADMIN') return null;
  const match=normalized.match(/^(MEPSA|MES|METP|MFP)_/);
  return match?.[1]||null;
}

export function canManageAuthorizedSigners(role:string){
  const normalized=normalizeGovernmentRole(role);
  if(normalized==='ETAT_ADMIN') return true;
  return /^(MEPSA|MES|METP|MFP)_(CABINET|DG|DIRECTEUR_GENERAL|MINISTRE|SECRETAIRE_GENERAL|SIGNER_ADMIN)$/.test(normalized);
}

export async function listAuthorizedSigners(ministry:string){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('list_administrative_signers',{p_ministry:ministry});
  if(error) throw error;
  return data||[];
}

export async function listAuthorizedSignerCandidates(ministry:string){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('list_administrative_signer_candidates',{p_ministry:ministry});
  if(error) throw error;
  return data||[];
}

export async function manageAuthorizedSigner(input:{
  action:'CREATE'|'UPDATE'|'DEACTIVATE'|'REACTIVATE';
  ministry:string;
  signerId?:string|null;
  userUid?:string|null;
  serviceCode?:string|null;
  signerName?:string|null;
  signerTitle?:string|null;
  validUntil?:string|null;
}){
  const s=getSupabaseClient(); if(!s) throw new Error('Supabase indisponible');
  const {data,error}=await s.rpc('manage_administrative_signer',{
    p_action:input.action,
    p_ministry:input.ministry,
    p_signer_id:input.signerId||null,
    p_user_uid:input.userUid||null,
    p_service_code:input.serviceCode||null,
    p_signer_name:input.signerName||null,
    p_signer_title:input.signerTitle||null,
    p_valid_until:input.validUntil||null,
  });
  if(error) throw error;
  return data;
}
