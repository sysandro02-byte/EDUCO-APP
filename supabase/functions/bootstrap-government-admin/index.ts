import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const randomPassword=()=>{
 const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
};

Deno.serve(async(req)=>{
 if(req.method!=="POST") return json({error:"Method not allowed"},405);
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const authorization=req.headers.get("Authorization")||"";
 if(!service||authorization!==`Bearer ${service}`) return json({error:"Accès service_role requis"},403);

 const url=Deno.env.get("SUPABASE_URL")!;
 const admin=createClient(url,service);
 const {count}=await admin.from("administrative_government_accounts").select("user_uid",{count:"exact",head:true}).eq("government_role","ETAT_ADMIN").eq("active",true);
 if((count||0)>0) return json({error:"Un ETAT_ADMIN actif existe déjà. Utilisez le provisionnement normal."},409);

 const body=await req.json().catch(()=>({}));
 const name=String(body.name||"").trim();
 const email=String(body.email||"").trim().toLowerCase();
 if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:"Nom ou adresse e-mail invalide"},400);

 const tempPassword=randomPassword();
 const {data:authData,error:authError}=await admin.auth.admin.createUser({
   email,password:tempPassword,email_confirm:true,
   user_metadata:{name,account_type:"government",ministry:"ETAT",government_role:"ETAT_ADMIN"}
 });
 if(authError||!authData?.user?.id) return json({error:authError?.message||"Création Auth impossible"},400);

 const uid=authData.user.id;
 const {error:profileError}=await admin.from("users").insert({
   uid,name,role:"ETAT_ADMIN",email,status:"Actif",school_id:null,inactivity_exempt:true
 });
 if(profileError){
   await admin.auth.admin.deleteUser(uid).catch(()=>{});
   return json({error:"Création profil EDUCO impossible",detail:profileError.message},400);
 }

 const {error:govError}=await admin.from("administrative_government_accounts").insert({
   user_uid:uid,ministry:"ETAT",government_role:"ETAT_ADMIN",official_title:"Administrateur État",
   active:true,must_change_password:true,created_by:null
 });
 if(govError){
   await admin.from("users").delete().eq("uid",uid);
   await admin.auth.admin.deleteUser(uid).catch(()=>{});
   return json({error:"Création ETAT_ADMIN impossible",detail:govError.message},400);
 }

 await admin.from("administrative_government_account_events").insert({
   user_uid:uid,ministry:"ETAT",action:"BOOTSTRAP",actor_uid:null,details:{email}
 });

 return json({
   account:{user_uid:uid,name,email,ministry:"ETAT",government_role:"ETAT_ADMIN"},
   temporary_password:tempPassword,
   password_notice:"Conservez ce mot de passe uniquement pour la première connexion puis changez-le immédiatement."
 },201);
});