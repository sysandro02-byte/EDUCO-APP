import {getSupabaseClient} from '../lib/supabase';

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
 const s=getSupabaseClient();if(!s)throw new Error('Supabase indisponible');
 const {data,error}=await s.rpc('list_administrative_payment_providers');
 if(error)throw error;
 return data||[];
}

export async function createAdministrativePaymentIntent(applicationId:string,providerCode:string){
 const s=getSupabaseClient();if(!s)throw new Error('Supabase indisponible');
 const {data,error}=await s.rpc('create_administrative_payment_intent',{
  p_application_id:applicationId,p_provider_code:providerCode
 });
 if(error)throw error;
 return Array.isArray(data)?data[0]:data;
}

export async function listMyAdministrativePayments(){
 const s=getSupabaseClient();if(!s)throw new Error('Supabase indisponible');
 const {data,error}=await s.rpc('list_my_administrative_payments');
 if(error)throw error;
 return data||[];
}

/**
 * A transaction can only be started after an officially configured provider
 * appears in listAdministrativePaymentProviders(). The provider-specific
 * checkout handshake remains server-side so no secret is ever shipped to the browser.
 */
export async function initiateAdministrativePayment(applicationId:string,providerCode:string){
 const s=getSupabaseClient();if(!s)throw new Error('Supabase indisponible');
 const providers=await listAdministrativePaymentProviders();
 const provider=providers.find((p:any)=>p.code===providerCode);
 if(!provider) throw new Error("Aucun canal officiel de perception n'est activé.");
 const {data,error}=await s.functions.invoke('initiate-administrative-payment',{body:{
  application_id:applicationId,provider_code:providerCode
 }});
 if(error) throw error;
 if(data?.error) throw new Error(data.error);
 if(!data?.checkout_url) throw new Error('La passerelle officielle n’a pas fourni de lien de paiement.');
 return data;
}
