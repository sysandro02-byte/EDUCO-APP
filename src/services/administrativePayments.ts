import {getSupabaseClient} from '../lib/supabase';
export async function getAdministrativePaymentDue(applicationId:string){
 const s=getSupabaseClient();if(!s)throw new Error('Supabase indisponible');
 const {data,error}=await s.from('administrative_applications').select('id,status,payment_amount,payment_currency,payment_reference,service_code').eq('id',applicationId).single();if(error)throw error;return data;
}
export function canStartAdministrativePayment(a:any){return a?.status==='PAYMENT_DUE'&&Number(a?.payment_amount)>0}
/** Payment initiation intentionally remains provider-neutral until an officially authorized collection channel is configured. */
export async function initiateAdministrativePayment(){throw new Error("Aucun canal officiel de perception n'est encore activé pour cette démarche.");}
