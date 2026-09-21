import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,headers:{"content-type":"application/json","access-control-allow-origin":"*"}
});
const ministries=["MEPSA","MES","METP","MFP"];
const roleSuffixes=["MINISTRE","CABINET","SECRETAIRE_GENERAL","DG","DIRECTEUR_GENERAL"];
const allowedTypes=["application/pdf","image/jpeg","image/png"];
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const sha256=async(value:string)=>{
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return hex(new Uint8Array(digest));
};
const extFor=(type:string)=>type==="application/pdf"?"pdf":type==="image/png"?"png":"jpg";

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type"}});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);

  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try{
    const form=await req.formData();
    const ministry=String(form.get("ministry")||"").trim().toUpperCase();
    const entity=String(form.get("entity")||"").trim();
    const requestedRole=String(form.get("requested_role")||"").trim().toUpperCase().replace(/[ -]+/g,"_");
    const fullName=String(form.get("full_name")||"").trim();
    const officialEmail=String(form.get("official_email")||"").trim().toLowerCase();
    const phone=String(form.get("phone")||"").trim();
    const employeeNumber=String(form.get("employee_number")||"").trim();
    const functionTitle=String(form.get("function_title")||"").trim();
    const serviceUnit=String(form.get("service_unit")||"").trim();
    const appointmentReference=String(form.get("appointment_reference")||"").trim();
    const justification=String(form.get("justification")||"").trim();
    const proof=form.get("appointment_file");

    if(!ministries.includes(ministry)) return json({error:"Ministère invalide"},400);
    if(!roleSuffixes.some(s=>requestedRole===ministry+"_"+s)) return json({error:"Rôle institutionnel invalide"},400);
    if(fullName.length<2||entity.length<2||functionTitle.length<2||serviceUnit.length<2) return json({error:"Informations institutionnelles incomplètes"},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail)) return json({error:"E-mail professionnel invalide"},400);
    if(phone.length<6||employeeNumber.length<1||appointmentReference.length<2||justification.length<10) return json({error:"Dossier de demande incomplet"},400);
    if(!(proof instanceof File)) return json({error:"L’acte de nomination ou justificatif professionnel est obligatoire"},400);
    if(!allowedTypes.includes(proof.type)) return json({error:"Le justificatif doit être un PDF, JPG ou PNG"},400);
    if(proof.size<=0||proof.size>10485760) return json({error:"Le justificatif doit faire au maximum 10 Mo"},400);

    const {data:existing}=await admin.from("institutional_account_requests")
      .select("id,status").eq("ministry",ministry).ilike("official_email",officialEmail)
      .in("status",["PENDING","UNDER_REVIEW"]).maybeSingle();
    if(existing) return json({error:"Une demande active existe déjà pour cette adresse e-mail",request_id:existing.id},409);

    const requestId=crypto.randomUUID();
    const trackingToken=hex(crypto.getRandomValues(new Uint8Array(32)));
    const storagePath=requestId+"/appointment."+extFor(proof.type);

    const {error:uploadError}=await admin.storage.from("institutional-account-proofs")
      .upload(storagePath,proof,{contentType:proof.type,upsert:false});
    if(uploadError) return json({error:"Enregistrement sécurisé du justificatif impossible"},500);

    const {error:insertError}=await admin.from("institutional_account_requests").insert({
      id:requestId,ministry,entity,requested_role:requestedRole,full_name:fullName,
      official_email:officialEmail,phone,employee_number:employeeNumber,function_title:functionTitle,
      service_unit:serviceUnit,appointment_reference:appointmentReference,justification,
      extra_data:{source:"institutional_access_v2"},status:"PENDING",
      proof_storage_path:storagePath,tracking_token_hash:await sha256(trackingToken)
    });
    if(insertError){
      await admin.storage.from("institutional-account-proofs").remove([storagePath]);
      return json({error:"Enregistrement de la demande impossible",detail:insertError.message},400);
    }

    return json({
      request_id:requestId,tracking_token:trackingToken,status:"PENDING",
      notice:"Conservez la référence et le code de suivi. Le code n’est affiché qu’une seule fois."
    },201);
  }catch(error:any){
    return json({error:error?.message||"Demande invalide"},400);
  }
});