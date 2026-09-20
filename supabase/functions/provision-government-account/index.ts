import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const ministries=["ETAT","MEPSA","MES","METP","MFP"];
const roles:Record<string,string[]>={
 ETAT:["ETAT_ADMIN"],
 MEPSA:["MEPSA_MINISTRE","MEPSA_CABINET","MEPSA_SECRETAIRE_GENERAL","MEPSA_DG","MEPSA_DIRECTEUR_GENERAL","MEPSA_DIRECTEUR","MEPSA_CHEF_SERVICE","MEPSA_AGENT_INSTRUCTEUR","MEPSA_SIGNATAIRE_HABILITE","MEPSA_SIGNER_ADMIN","MEPSA_FINANCE"],
 MES:["MES_MINISTRE","MES_CABINET","MES_SECRETAIRE_GENERAL","MES_DG","MES_DIRECTEUR_GENERAL","MES_DIRECTEUR","MES_CHEF_SERVICE","MES_AGENT_INSTRUCTEUR","MES_SIGNATAIRE_HABILITE","MES_SIGNER_ADMIN","MES_FINANCE"],
 METP:["METP_MINISTRE","METP_CABINET","METP_SECRETAIRE_GENERAL","METP_DG","METP_DIRECTEUR_GENERAL","METP_DIRECTEUR","METP_CHEF_SERVICE","METP_AGENT_INSTRUCTEUR","METP_SIGNATAIRE_HABILITE","METP_SIGNER_ADMIN","METP_FINANCE"],
 MFP:["MFP_MINISTRE","MFP_CABINET","MFP_SECRETAIRE_GENERAL","MFP_DG","MFP_DIRECTEUR_GENERAL","MFP_DIRECTEUR","MFP_CHEF_SERVICE","MFP_AGENT_INSTRUCTEUR","MFP_SIGNATAIRE_HABILITE","MFP_SIGNER_ADMIN","MFP_FINANCE"],
};
const randomPassword=()=>{
 const alphabet="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
 const bytes=crypto.getRandomValues(new Uint8Array(24));
 return Array.from(bytes,b=>alphabet[b%alphabet.length]).join("");
};

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

 const body=await req.json().catch(()=>({}));
 const name=String(body.name||"").trim();
 const email=String(body.email||"").trim().toLowerCase();
 const ministry=String(body.ministry||"").trim().toUpperCase();
 const governmentRole=String(body.government_role||"").trim().toUpperCase().replace(/[ -]+/g,"_");
 const direction=String(body.direction||"").trim()||null;
 const officialTitle=String(body.official_title||"").trim()||null;

 if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:"Nom ou adresse e-mail invalide"},400);
 if(!ministries.includes(ministry)||!roles[ministry]?.includes(governmentRole)) return json({error:"Rôle ministériel invalide"},400);

 const {data:allowed,error:allowError}=await userClient.rpc("can_provision_government_account",{p_ministry:ministry,p_target_role:governmentRole});
 if(allowError||allowed!==true) return json({error:"Vous n’êtes pas habilité à créer ce rôle"},403);

 const {data:existingProfile}=await admin.from("users").select("id,uid,email").ilike("email",email).limit(1).maybeSingle();
 if(existingProfile) return json({error:"Cette adresse e-mail est déjà associée à un compte EDUCO"},409);

 const tempPassword=randomPassword();
 const {data:authData,error:authError}=await admin.auth.admin.createUser({
   email,password:tempPassword,email_confirm:true,
   user_metadata:{name,account_type:"government",ministry,government_role:governmentRole}
 });
 if(authError||!authData?.user?.id) return json({error:authError?.message||"Création du compte Auth impossible"},400);

 const uid=authData.user.id;
 const {error:profileError}=await admin.from("users").insert({
   uid,name,role:governmentRole,email,status:"Actif",school_id:null,inactivity_exempt:true
 });
 if(profileError){
   await admin.auth.admin.deleteUser(uid).catch(()=>{});
   return json({error:"Création du profil EDUCO impossible",detail:profileError.message},400);
 }

 const {error:govError}=await admin.from("administrative_government_accounts").insert({
   user_uid:uid,ministry,government_role:governmentRole,direction,official_title,
   active:true,must_change_password:true,created_by:user.id
 });
 if(govError){
   await admin.from("users").delete().eq("uid",uid);
   await admin.auth.admin.deleteUser(uid).catch(()=>{});
   return json({error:"Création du compte ministériel impossible",detail:govError.message},400);
 }

 await admin.from("administrative_government_account_events").insert({
   user_uid:uid,ministry,action:"CREATE",actor_uid:user.id,
   details:{government_role:governmentRole,direction,official_title,email}
 });

 return json({
   account:{user_uid:uid,name,email,ministry,government_role:governmentRole,direction,official_title,active:true,must_change_password:true},
   temporary_password:tempPassword,
   password_notice:"Ce mot de passe temporaire est affiché une seule fois et devra être changé à la première connexion."
 },201);
});