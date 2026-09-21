import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const randomPassword=()=>{
 const chars="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 return Array.from(bytes,b=>chars[b%chars.length]).join("");
};
const highRoles=["MINISTRE","CABINET","SECRETAIRE_GENERAL","DG","DIRECTEUR_GENERAL"];

Deno.serve(async(req)=>{
 if(req.method!=="POST") return json({error:"Method not allowed"},405);

 const url=Deno.env.get("SUPABASE_URL")!;
 const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const auth=req.headers.get("Authorization")||"";
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const admin=createClient(url,service);

 const {data:{user},error:userError}=await userClient.auth.getUser();
 if(userError||!user) return json({error:"Authentification requise"},401);

 const {data:allowed,error:allowedError}=await userClient.rpc("can_review_institutional_access_requests");
 if(allowedError||allowed!==true) return json({error:"Accès ETAT_ADMIN requis"},403);

 const body=await req.json().catch(()=>({}));
 const action=String(body.action||"LIST").toUpperCase();

 if(action==="LIST"){
   const statuses=Array.isArray(body.statuses)&&body.statuses.length?body.statuses:["PENDING","UNDER_REVIEW"];
   const {data,error}=await admin.from("institutional_account_requests")
     .select("id,ministry,entity,requested_role,full_name,official_email,phone,employee_number,function_title,service_unit,appointment_reference,justification,status,review_notes,review_checklist,approved_role,account_uid,created_at,updated_at,proof_storage_path")
     .in("status",statuses).order("created_at",{ascending:false}).limit(100);
   if(error) return json({error:error.message},400);

   const rows=[];
   for(const row of data||[]){
     let proof_url:string|null=null;
     if(row.proof_storage_path){
       const {data:signed}=await admin.storage.from("institutional-account-proofs").createSignedUrl(row.proof_storage_path,600);
       proof_url=signed?.signedUrl||null;
     }
     const {proof_storage_path,...safe}=row;
     rows.push({...safe,proof_url});
   }
   return json({requests:rows});
 }

 const requestId=String(body.request_id||"").trim();
 if(!requestId) return json({error:"Référence de demande requise"},400);

 const {data:reqRow,error:reqError}=await admin.from("institutional_account_requests")
   .select("*").eq("id",requestId).maybeSingle();
 if(reqError||!reqRow) return json({error:"Demande introuvable"},404);

 if(action==="REJECT"){
   const note=String(body.note||"").trim();
   if(note.length<3) return json({error:"Motif de rejet requis"},400);
   if(!["PENDING","UNDER_REVIEW"].includes(reqRow.status)) return json({error:"Demande déjà traitée"},409);

   const {error}=await admin.from("institutional_account_requests").update({
     status:"REJECTED",
     reviewer_uid:user.id,
     reviewer_role:"ETAT_ADMIN",
     review_notes:note,
     reviewed_at:new Date().toISOString(),
     review_checklist:body.checklist||{}
   }).eq("id",requestId).in("status",["PENDING","UNDER_REVIEW"]);

   if(error) return json({error:error.message},400);
   return json({status:"REJECTED"});
 }

 if(action!=="APPROVE") return json({error:"Action invalide"},400);
 if(!["PENDING","UNDER_REVIEW"].includes(reqRow.status)) return json({error:"Demande déjà traitée"},409);

 const checklist=body.checklist||{};
 if(
   checklist.official_email_verified!==true||
   checklist.appointment_verified!==true||
   checklist.employee_number_verified!==true||
   checklist.assignment_verified!==true
 ){
   return json({error:"Tous les contrôles institutionnels doivent être confirmés"},400);
 }

 const approvedRole=String(body.approved_role||reqRow.requested_role||"")
   .trim().toUpperCase().replace(/[ -]+/g,"_");

 if(approvedRole!==reqRow.requested_role){
   return json({error:"Le rôle approuvé doit correspondre au rôle demandé. Rejetez la demande si l’affectation est incorrecte."},400);
 }
 if(!highRoles.some(s=>approvedRole===reqRow.ministry+"_"+s)){
   return json({error:"Rôle initial non autorisé"},400);
 }

 const {data:existingProfile}=await admin.from("users")
   .select("uid,email,role").ilike("email",reqRow.official_email).limit(1).maybeSingle();
 if(existingProfile) return json({error:"Un compte EDUCO existe déjà avec cette adresse e-mail"},409);

 await admin.from("institutional_account_requests").update({
   status:"UNDER_REVIEW",
   reviewer_uid:user.id,
   reviewer_role:"ETAT_ADMIN",
   review_checklist:checklist,
   review_notes:String(body.note||"").trim()||null,
   reviewed_at:new Date().toISOString()
 }).eq("id",requestId).in("status",["PENDING","UNDER_REVIEW"]);

 const tempPassword=randomPassword();
 const {data:authData,error:authError}=await admin.auth.admin.createUser({
   email:reqRow.official_email,
   password:tempPassword,
   email_confirm:true,
   user_metadata:{
     name:reqRow.full_name,
     account_type:"government",
     ministry:reqRow.ministry,
     government_role:approvedRole
   }
 });
 if(authError||!authData?.user?.id){
   await admin.from("institutional_account_requests").update({status:"PENDING"}).eq("id",requestId);
   return json({error:authError?.message||"Création du compte Auth impossible"},400);
 }
 const uid=authData.user.id;

 try{
   const {error:profileError}=await admin.from("users").insert({
     uid,
     name:reqRow.full_name,
     role:approvedRole,
     email:reqRow.official_email,
     status:"Actif",
     school_id:null,
     inactivity_exempt:true
   });
   if(profileError) throw profileError;

   const {error:govError}=await admin.from("administrative_government_accounts").insert({
     user_uid:uid,
     ministry:reqRow.ministry,
     government_role:approvedRole,
     direction:reqRow.entity,
     official_title:reqRow.function_title,
     active:true,
     must_change_password:true,
     created_by:user.id
   });
   if(govError) throw govError;

   await admin.from("administrative_government_account_events").insert({
     user_uid:uid,
     ministry:reqRow.ministry,
     action:"CREATE",
     actor_uid:user.id,
     details:{
       source:"institutional_access_request",
       request_id:requestId,
       government_role:approvedRole
     }
   });

   const {error:finalError}=await admin.from("institutional_account_requests").update({
     status:"APPROVED",
     approved_role:approvedRole,
     account_uid:uid,
     reviewer_uid:user.id,
     reviewer_role:"ETAT_ADMIN",
     review_checklist:checklist,
     review_notes:String(body.note||"").trim()||null,
     reviewed_at:new Date().toISOString(),
     provisioned_at:new Date().toISOString(),
     notification_status:"NOT_REQUIRED"
   }).eq("id",requestId).eq("status","UNDER_REVIEW");
   if(finalError) throw finalError;

   return json({
     status:"APPROVED",
     account:{
       user_uid:uid,
       name:reqRow.full_name,
       email:reqRow.official_email,
       ministry:reqRow.ministry,
       government_role:approvedRole
     },
     temporary_password:tempPassword,
     password_notice:"Mot de passe affiché une seule fois. Le titulaire devra le changer à sa première connexion."
   });
 }catch(error:any){
   await admin.from("administrative_government_accounts").delete().eq("user_uid",uid);
   await admin.from("users").delete().eq("uid",uid);
   await admin.auth.admin.deleteUser(uid).catch(()=>{});
   await admin.from("institutional_account_requests").update({
     status:"PENDING",
     account_uid:null,
     approved_role:null,
     provisioned_at:null
   }).eq("id",requestId);
   return json({error:error?.message||"Provisionnement impossible"},400);
 }
});