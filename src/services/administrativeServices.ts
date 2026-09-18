import { getSupabaseClient } from '../lib/supabase';
export async function createAdministrativeApplication(service:any,user:any,formData:any){
 const supabase=getSupabaseClient(); if(!supabase) throw new Error('Supabase indisponible');
 const {data,error}=await supabase.from('administrative_applications').insert({service_code:service.code,ministry:service.ministry,applicant_name:user?.name||'',applicant_email:user?.email||'',form_data:formData}).select().single();
 if(error) throw error; return data;
}
export async function submitAdministrativeApplication(id:string){
 const supabase=getSupabaseClient(); if(!supabase) throw new Error('Supabase indisponible');
 const {data,error}=await supabase.rpc('submit_administrative_application',{p_id:id}); if(error) throw error; return data;
}
export async function listMyAdministrativeApplications(){
 const supabase=getSupabaseClient(); if(!supabase) return []; const {data,error}=await supabase.from('administrative_applications').select('*').order('created_at',{ascending:false}); if(error) throw error; return data||[];
}
export async function uploadAdministrativeFile(applicationId:string,file:File){
 const supabase=getSupabaseClient(); if(!supabase) throw new Error('Supabase indisponible'); const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('Session requise');
 const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'); const path=user.id+'/'+applicationId+'/'+Date.now()+'-'+safe;
 const {error:up}=await supabase.storage.from('administrative-applications').upload(path,file,{contentType:file.type,upsert:false}); if(up) throw up;
 const {error}=await supabase.from('administrative_application_files').insert({application_id:applicationId,owner_uid:user.id,file_name:file.name,storage_path:path,mime_type:file.type,size_bytes:file.size}); if(error) throw error; return path;
}
