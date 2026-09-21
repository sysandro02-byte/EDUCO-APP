import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});

Deno.serve(async(req)=>{
  if(req.method!=="POST") return json({error:"Method not allowed"},405);

  const url=Deno.env.get("SUPABASE_URL")!;
  const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const gatewayUrl=Deno.env.get("ADMIN_PAYMENT_GATEWAY_URL")||"";
  const gatewayToken=Deno.env.get("ADMIN_PAYMENT_GATEWAY_TOKEN")||"";
  if(!gatewayUrl||!gatewayToken) return json({error:"Canal officiel de paiement non configuré"},503);

  const auth=req.headers.get("Authorization")||"";
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const admin=createClient(url,service);
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user) return json({error:"Authentification requise"},401);

  const body=await req.json().catch(()=>({}));
  const applicationId=String(body.application_id||"").trim();
  const providerCode=String(body.provider_code||"").trim().toUpperCase();
  if(!applicationId||!providerCode) return json({error:"application_id et provider_code requis"},400);

  const {data:intent,error:intentError}=await userClient.rpc("create_administrative_payment_intent",{
    p_application_id:applicationId,p_provider_code:providerCode
  });
  if(intentError||!intent) return json({error:intentError?.message||"Intent de paiement impossible"},400);
  const tx=Array.isArray(intent)?intent[0]:intent;

  const callbackUrl=`${url}/functions/v1/administrative-payment-webhook`;
  let gatewayResponse:Response;
  try{
    gatewayResponse=await fetch(gatewayUrl,{
      method:"POST",
      headers:{
        "content-type":"application/json",
        "authorization":`Bearer ${gatewayToken}`,
        "x-educo-idempotency-key":tx.internal_reference,
      },
      body:JSON.stringify({
        provider_code:providerCode,
        transaction_id:tx.id,
        internal_reference:tx.internal_reference,
        amount:Number(tx.amount),
        currency:tx.currency,
        callback_url:callbackUrl,
        metadata:{application_id:applicationId,applicant_uid:user.id},
      }),
    });
  }catch(error){
    return json({error:"Passerelle de paiement indisponible",detail:String(error)},502);
  }

  const gateway=await gatewayResponse.json().catch(()=>({}));
  if(!gatewayResponse.ok){
    return json({error:"Initialisation refusée par la passerelle",detail:gateway?.error||gatewayResponse.statusText},502);
  }

  const providerReference=String(gateway?.provider_reference||"").trim();
  const checkoutUrl=String(gateway?.checkout_url||"").trim();
  if(!providerReference||!checkoutUrl||!/^https:\/\//i.test(checkoutUrl)){
    return json({error:"Réponse de passerelle incomplète"},502);
  }

  const {error:bindError}=await admin.rpc("bind_administrative_payment_provider_reference",{
    p_transaction_id:tx.id,p_provider_reference:providerReference
  });
  if(bindError) return json({error:"Référence fournisseur non enregistrée",detail:bindError.message},500);

  return json({
    transaction_id:tx.id,
    internal_reference:tx.internal_reference,
    provider_reference:providerReference,
    checkout_url:checkoutUrl,
    amount:tx.amount,
    currency:tx.currency,
  });
});