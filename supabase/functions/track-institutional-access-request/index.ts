import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
 status,headers:{"content-type":"application/json","access-control-allow-origin":"*"}
});
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const sha256=async(value:string)=>{
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
 return hex(new Uint8Array(digest));
};

Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:{"access-control-allow-origin":"*","access-control-allow-headers":"authorization, x-client-info, apikey, content-type"}});
 if(req.method!=="POST") return json({error:"Method not allowed"},405);

 const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
 const body=await req.json().catch(()=>({}));
 const requestId=String(body.request_id||"").trim();
 const token=String(body.tracking_token||"").trim();
 if(!requestId||!token) return json({error:"Référence et code de suivi requis"},400);

 const {data,error}=await admin.from("institutional_account_requests")
   .select("id,ministry,entity,requested_role,status,review_notes,created_at,reviewed_at,provisioned_at")
   .eq("id",requestId)
   .eq("tracking_token_hash",await sha256(token))
   .maybeSingle();

 if(error||!data) return json({error:"Référence ou code de suivi invalide"},404);

 return json({
   request_id:data.id,
   ministry:data.ministry,
   entity:data.entity,
   requested_role:data.requested_role,
   status:data.status,
   review_notes:data.status==="REJECTED"?data.review_notes:null,
   created_at:data.created_at,
   reviewed_at:data.reviewed_at,
   provisioned_at:data.provisioned_at
 });
});