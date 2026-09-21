import {getSupabaseClient} from '../lib/supabase';
import {getApiUrl} from '../lib/apiConfig';
import {getSecureAuthHeaders} from './authHeaders';

export async function getAdministrativePaymentDue(applicationId:string){
 const s=getSupabaseClient();if(!s)throw new Error('Supabase indisponible');
 const {data,error}=await s.from('administrative_applications')
  .select('id,status,payment_amount,payment_currency,payment_reference,service_code')
  .eq('id',applicationId).single();
 if(error)throw error;return data;
}

export function canStartAdministrativePayment(a:any){
 return a?.status==='PAYMENT_DUE'&&Number(a?.payment_amount)>0;
}

export async function listAdministrativePaymentProviders(){
 const headers=await getSecureAuthHeaders(false);
 const response=await fetch(getApiUrl('/api/administrative-payments/providers'),{headers});
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload?.error||'Vérification des canaux de paiement impossible.');
 return Array.isArray(payload?.providers)?payload.providers:[];
}

export async function listMyAdministrativePayments(){
 const s=getSupabaseClient();if(!s)throw new Error('Supabase indisponible');
 const {data,error}=await s.rpc('list_my_administrative_payments');
 if(error)throw error;
 return data||[];
}

/**
 * LoukaPay is initiated only by the EDUCO backend. The browser carries the
 * authenticated EDUCO session but never receives the LoukaPay merchant key.
 */
export async function initiateAdministrativePayment(applicationId:string,providerCode:string){
 const providers=await listAdministrativePaymentProviders();
 const provider=providers.find((p:any)=>p.code===providerCode);
 if(!provider)throw new Error("Aucun canal officiel de perception n'est actuellement disponible.");

 const headers=await getSecureAuthHeaders();
 const response=await fetch(
  getApiUrl(`/api/administrative-payments/${encodeURIComponent(applicationId)}/initiate`),
  {method:'POST',headers,body:JSON.stringify({provider_code:providerCode})}
 );
 const payload=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(payload?.error||'Initialisation du paiement impossible.');
 if(!/^https:\/\//i.test(String(payload?.checkout_url||''))){
  throw new Error('La passerelle officielle n’a pas fourni de lien de paiement valide.');
 }
 return payload;
}
