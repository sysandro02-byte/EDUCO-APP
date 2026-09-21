import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const hex=(bytes:Uint8Array)=>Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
const timingSafeEqual=(a:string,b:string)=>{
  if(a.length!==b.length)return false;
  let diff=0;
  for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
};

Deno.serve(async(req)=>{
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  const secret=Deno.env.get("ADMIN_PAYMENT_WEBHOOK_SECRET")||"";
  if(!secret) return json({error:"Webhook non configuré"},503);

  const raw=await req.text();
  const supplied=(req.headers.get("x-educo-signature")||"").trim().toLowerCase().replace(/^sha256=/,"");
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=hex(new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(raw))));
  if(!supplied||!timingSafeEqual(signature,supplied)) return json({error:"Signature invalide"},401);

  const payload=JSON.parse(raw||"{}");
  const providerCode=String(payload.provider_code||"").trim().toUpperCase();
  const providerReference=String(payload.provider_reference||"").trim();
  const status=String(payload.status||"").trim().toUpperCase();
  const amount=Number(payload.amount);
  const currency=String(payload.currency||"").trim().toUpperCase();
  if(!providerCode||!providerReference||!Number.isFinite(amount)||!currency) return json({error:"Payload fournisseur invalide"},400);

  const url=Deno.env.get("SUPABASE_URL")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin=createClient(url,service);
  const payloadHash=hex(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw))));

  const {data,error}=await admin.rpc("confirm_administrative_payment_provider",{
    p_provider_code:providerCode,
    p_provider_reference:providerReference,
    p_status:status,
    p_amount:amount,
    p_currency:currency,
    p_payload_hash:payloadHash,
    p_failure_code:payload.failure_code?String(payload.failure_code):null,
    p_failure_message:payload.failure_message?String(payload.failure_message):null,
  });
  if(error) return json({error:error.message},400);
  return json({ok:true,transaction:Array.isArray(data)?data[0]:data});
});