import { getStoredSupabaseConfig, getSupabaseClient } from '../lib/supabase';

export const INSTITUTIONAL_MINISTRIES = ['MEPSA','MES','METP','MFP'] as const;
export const INSTITUTIONAL_ROLE_SUFFIXES = [
  'MINISTRE','CABINET','SECRETAIRE_GENERAL','DG','DIRECTEUR_GENERAL'
] as const;

export const institutionalRoleOptions = (ministry:string) =>
  INSTITUTIONAL_ROLE_SUFFIXES.map(s => ({
    value: `${ministry}_${s}`,
    label: s === 'SECRETAIRE_GENERAL' ? 'Secrétaire général'
      : s === 'DIRECTEUR_GENERAL' ? 'Directeur général'
      : s === 'DG' ? 'Direction générale'
      : s === 'CABINET' ? 'Cabinet'
      : 'Ministre'
  }));

async function publicFunctionFetch(name:string, body:BodyInit, contentType?:string){
  const {url,key}=getStoredSupabaseConfig();
  const headers:Record<string,string> = { apikey:key };
  if(contentType) headers['content-type']=contentType;
  const res=await fetch(`${url}/functions/v1/${name}`,{method:'POST',headers,body});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data?.error||'Opération impossible');
  return data;
}

export async function submitInstitutionalAccessRequest(input:{
  ministry:string; entity:string; requestedRole:string; fullName:string; officialEmail:string;
  phone:string; employeeNumber:string; functionTitle:string; serviceUnit:string;
  appointmentReference:string; justification:string; appointmentFile:File;
}){
  const form=new FormData();
  form.set('ministry',input.ministry);
  form.set('entity',input.entity);
  form.set('requested_role',input.requestedRole);
  form.set('full_name',input.fullName);
  form.set('official_email',input.officialEmail);
  form.set('phone',input.phone);
  form.set('employee_number',input.employeeNumber);
  form.set('function_title',input.functionTitle);
  form.set('service_unit',input.serviceUnit);
  form.set('appointment_reference',input.appointmentReference);
  form.set('justification',input.justification);
  form.set('appointment_file',input.appointmentFile);
  return publicFunctionFetch('submit-institutional-access-request',form);
}

export async function trackInstitutionalAccessRequest(requestId:string,trackingToken:string){
  return publicFunctionFetch(
    'track-institutional-access-request',
    JSON.stringify({request_id:requestId,tracking_token:trackingToken}),
    'application/json'
  );
}

export async function listInstitutionalAccessRequests(statuses:string[]=['PENDING','UNDER_REVIEW']){
  const s=getSupabaseClient();
  const {data,error}=await s.functions.invoke('review-institutional-access-requests',{
    body:{action:'LIST',statuses}
  });
  if(error) throw error;
  if(data?.error) throw new Error(data.error);
  return data?.requests||[];
}

export async function reviewInstitutionalAccessRequest(input:{
  action:'APPROVE'|'REJECT';
  requestId:string;
  checklist?:Record<string,boolean>;
  approvedRole?:string;
  note?:string;
}){
  const s=getSupabaseClient();
  const {data,error}=await s.functions.invoke('review-institutional-access-requests',{
    body:{
      action:input.action,
      request_id:input.requestId,
      checklist:input.checklist||{},
      approved_role:input.approvedRole||null,
      note:input.note||null,
    }
  });
  if(error) throw error;
  if(data?.error) throw new Error(data.error);
  return data;
}
