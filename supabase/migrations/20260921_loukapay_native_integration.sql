-- Native EDUCO <-> LoukaPay server integration.
-- The browser never receives a merchant API key or webhook secret.

create table if not exists public.administrative_payment_webhook_events (
  event_id text primary key,
  provider_code text not null,
  provider_reference text,
  external_reference text,
  event_type text not null,
  payload_hash text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text
);
alter table public.administrative_payment_webhook_events enable row level security;
revoke all on public.administrative_payment_webhook_events from anon,authenticated;
create index if not exists administrative_payment_webhook_provider_idx
  on public.administrative_payment_webhook_events(provider_code,provider_reference,received_at desc);
create index if not exists administrative_payment_webhook_external_idx
  on public.administrative_payment_webhook_events(external_reference,received_at desc);

insert into public.administrative_payment_providers(
  code,display_name,active,config_status,currency,public_metadata
) values(
  'LOUKAPAY','LoukaPay',true,'READY','XAF',
  '{"hostedCheckout":true,"nonCustodial":true,"serverInitiated":true}'::jsonb
)
on conflict(code) do update set
  display_name=excluded.display_name,
  active=true,
  config_status='READY',
  currency='XAF',
  public_metadata=excluded.public_metadata,
  updated_at=now();

create or replace function private.create_administrative_payment_intent_server_secure(
  p_application_id uuid,
  p_provider_code text,
  p_applicant_uid uuid
)
returns public.administrative_payment_transactions
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.administrative_applications;
  s public.administrative_services;
  p public.administrative_payment_providers;
  t public.administrative_payment_transactions;
begin
  if p_applicant_uid is null then raise exception 'Identité demandeur requise'; end if;

  select * into a
  from public.administrative_applications
  where id=p_application_id and applicant_uid=p_applicant_uid
  for update;
  if a.id is null then raise exception 'Dossier introuvable'; end if;
  if a.status<>'PAYMENT_DUE' then raise exception 'Ce dossier n’est pas en attente de paiement'; end if;

  select * into s from public.administrative_services where code=a.service_code;
  if s.code is null or not s.payment_enabled
     or s.fee_status<>'VERIFIED_CURRENT'
     or s.fee_amount is null
     or s.publication_status<>'PUBLISHED'
     or s.legal_status<>'VERIFIED'
     or s.requirements_status<>'VERIFIED'
     or nullif(trim(coalesce(s.fee_reference,'')),'') is null
     or nullif(trim(coalesce(s.fee_source_url,'')),'') is null then
    raise exception 'Paiement bloqué : la démarche ou son tarif n’est pas officiellement validé';
  end if;

  select * into p
  from public.administrative_payment_providers
  where code=upper(trim(p_provider_code))
    and active and config_status='READY'
  for share;
  if p.code is null then raise exception 'Canal de paiement officiel indisponible'; end if;
  if upper(p.currency)<>upper(s.fee_currency) then
    raise exception 'Devise non prise en charge par ce canal';
  end if;

  if a.payment_amount is distinct from s.fee_amount
     or upper(coalesce(a.payment_currency,''))<>upper(s.fee_currency) then
    raise exception 'Le montant du dossier ne correspond plus au tarif officiel courant';
  end if;

  select * into t
  from public.administrative_payment_transactions
  where application_id=a.id and status='PENDING'
  order by initiated_at desc limit 1;

  if t.id is not null then
    if t.provider_code<>p.code or t.amount<>a.payment_amount
       or upper(t.currency)<>upper(a.payment_currency) then
      raise exception 'Une transaction incompatible est déjà en attente';
    end if;
    return t;
  end if;

  insert into public.administrative_payment_transactions(
    application_id,applicant_uid,provider_code,amount,currency
  ) values(
    a.id,a.applicant_uid,p.code,a.payment_amount,a.payment_currency
  ) returning * into t;

  insert into public.administrative_application_events(
    application_id,actor_uid,action,from_status,to_status,note
  ) values(
    a.id,p_applicant_uid,'PAYMENT_INTENT',a.status,a.status,t.internal_reference
  );

  return t;
end $$;
revoke all on function private.create_administrative_payment_intent_server_secure(uuid,text,uuid)
from public,anon,authenticated;
grant execute on function private.create_administrative_payment_intent_server_secure(uuid,text,uuid)
to service_role;

create or replace function public.create_administrative_payment_intent_server(
  p_application_id uuid,
  p_provider_code text,
  p_applicant_uid uuid
)
returns public.administrative_payment_transactions
language sql
security invoker
set search_path=''
as $$
  select private.create_administrative_payment_intent_server_secure(
    p_application_id,p_provider_code,p_applicant_uid
  )
$$;
revoke all on function public.create_administrative_payment_intent_server(uuid,text,uuid)
from public,anon,authenticated;
grant execute on function public.create_administrative_payment_intent_server(uuid,text,uuid)
to service_role;

create or replace function private.record_administrative_payment_webhook_secure(
  p_event_id text,
  p_provider_code text,
  p_provider_reference text,
  p_external_reference text,
  p_event_type text,
  p_payload_hash text
)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare
  existing public.administrative_payment_webhook_events;
begin
  if nullif(trim(p_event_id),'') is null
     or nullif(trim(p_payload_hash),'') is null then
    raise exception 'Événement webhook invalide';
  end if;

  select * into existing
  from public.administrative_payment_webhook_events
  where event_id=p_event_id
  for update;

  if existing.event_id is not null then
    if existing.payload_hash<>lower(p_payload_hash) then
      raise exception 'Identifiant webhook réutilisé avec un payload différent';
    end if;
    return case when existing.processed_at is null then 'RETRY' else 'ALREADY_PROCESSED' end;
  end if;

  insert into public.administrative_payment_webhook_events(
    event_id,provider_code,provider_reference,external_reference,event_type,payload_hash
  ) values(
    p_event_id,upper(trim(p_provider_code)),nullif(trim(p_provider_reference),''),
    nullif(trim(p_external_reference),''),p_event_type,lower(p_payload_hash)
  );

  return 'NEW';
end $$;
revoke all on function private.record_administrative_payment_webhook_secure(text,text,text,text,text,text)
from public,anon,authenticated;
grant execute on function private.record_administrative_payment_webhook_secure(text,text,text,text,text,text)
to service_role;

create or replace function public.record_administrative_payment_webhook(
  p_event_id text,
  p_provider_code text,
  p_provider_reference text,
  p_external_reference text,
  p_event_type text,
  p_payload_hash text
)
returns text
language sql
security invoker
set search_path=''
as $$
 select private.record_administrative_payment_webhook_secure(
   p_event_id,p_provider_code,p_provider_reference,p_external_reference,p_event_type,p_payload_hash
 )
$$;
revoke all on function public.record_administrative_payment_webhook(text,text,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.record_administrative_payment_webhook(text,text,text,text,text,text)
to service_role;

create or replace function private.complete_administrative_payment_webhook_secure(
  p_event_id text,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
begin
  update public.administrative_payment_webhook_events
  set processed_at=case when p_error is null then now() else processed_at end,
      processing_error=left(nullif(trim(p_error),''),1000)
  where event_id=p_event_id;
  return found;
end $$;
revoke all on function private.complete_administrative_payment_webhook_secure(text,text)
from public,anon,authenticated;
grant execute on function private.complete_administrative_payment_webhook_secure(text,text)
to service_role;

create or replace function public.complete_administrative_payment_webhook(
  p_event_id text,
  p_error text default null
)
returns boolean
language sql
security invoker
set search_path=''
as $$ select private.complete_administrative_payment_webhook_secure(p_event_id,p_error) $$;
revoke all on function public.complete_administrative_payment_webhook(text,text)
from public,anon,authenticated;
grant execute on function public.complete_administrative_payment_webhook(text,text)
to service_role;
