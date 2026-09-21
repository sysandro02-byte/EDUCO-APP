-- EDUCO verified catalog sources, provider-neutral payment ledger, and document lifecycle audit.

alter table public.administrative_services
  add column if not exists fee_reference text,
  add column if not exists fee_source_url text,
  add column if not exists processing_days integer,
  add column if not exists processing_days_status text not null default 'TO_VERIFY'
    check (processing_days_status in ('TO_VERIFY','VERIFIED','NOT_APPLICABLE'));

alter table public.administrative_services
  drop constraint if exists administrative_services_processing_days_check;
alter table public.administrative_services
  add constraint administrative_services_processing_days_check
  check (processing_days is null or processing_days between 0 and 3650);

create or replace function private.validate_catalog_proposal_secure(
  p_ministry text,
  p_service jsonb,
  p_fields jsonb,
  p_documents jsonb
)
returns boolean
language plpgsql
security definer
set search_path=''
stable
as $$
declare
  legal_status text:=upper(coalesce(p_service->>'legal_status',''));
  fee_status text:=upper(coalesce(p_service->>'fee_status',''));
  publication_status text:=upper(coalesce(p_service->>'publication_status',''));
  requirements_status text:=upper(coalesce(p_service->>'requirements_status',''));
  processing_status text:=upper(coalesce(p_service->>'processing_days_status','TO_VERIFY'));
  payment_enabled boolean:=coalesce((p_service->>'payment_enabled')::boolean,false);
  fee_amount numeric;
  processing_days integer;
  duplicate_count integer;
begin
  if jsonb_typeof(p_service)<>'object' or jsonb_typeof(p_fields)<>'array' or jsonb_typeof(p_documents)<>'array' then
    raise exception 'Proposition de catalogue invalide';
  end if;

  if legal_status not in ('VERIFIED','TO_VERIFY','OBSOLETE') then raise exception 'Statut juridique invalide'; end if;
  if fee_status not in ('VERIFIED_CURRENT','HISTORICAL','TO_VERIFY','FREE') then raise exception 'Statut tarifaire invalide'; end if;
  if publication_status not in ('DRAFT','LEGAL_REVIEW','MINISTRY_APPROVED','PUBLISHED','SUSPENDED') then raise exception 'Statut de publication invalide'; end if;
  if requirements_status not in ('TO_VERIFY','VERIFIED','SUSPENDED') then raise exception 'Statut des exigences invalide'; end if;
  if processing_status not in ('TO_VERIFY','VERIFIED','NOT_APPLICABLE') then raise exception 'Statut du délai invalide'; end if;

  if nullif(trim(coalesce(p_service->>'fee_amount','')),'') is not null then
    fee_amount:=(p_service->>'fee_amount')::numeric;
    if fee_amount<0 then raise exception 'Le tarif ne peut pas être négatif'; end if;
  end if;

  if nullif(trim(coalesce(p_service->>'processing_days','')),'') is not null then
    processing_days:=(p_service->>'processing_days')::integer;
    if processing_days<0 or processing_days>3650 then raise exception 'Délai de traitement invalide'; end if;
  end if;

  if legal_status='VERIFIED' then
    if nullif(trim(coalesce(p_service->>'legal_reference','')),'') is null then
      raise exception 'Une référence juridique est requise pour un statut VERIFIED';
    end if;
    if nullif(trim(coalesce(p_service->>'legal_source_url','')),'') is null then
      raise exception 'Une source juridique officielle est requise pour un statut VERIFIED';
    end if;
  end if;

  if fee_status='VERIFIED_CURRENT' then
    if fee_amount is null then raise exception 'Un tarif vérifié doit avoir un montant'; end if;
    if nullif(trim(coalesce(p_service->>'fee_reference','')),'') is null then
      raise exception 'Une référence tarifaire officielle est requise';
    end if;
    if nullif(trim(coalesce(p_service->>'fee_source_url','')),'') is null then
      raise exception 'Une source tarifaire officielle est requise';
    end if;
  end if;

  if processing_status='VERIFIED' and processing_days is null then
    raise exception 'Un délai vérifié doit préciser un nombre de jours';
  end if;

  select count(*)-count(distinct x->>'field_key') into duplicate_count
  from jsonb_array_elements(p_fields) x;
  if duplicate_count>0 then raise exception 'Clés de formulaire dupliquées'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_fields) x
    where coalesce(x->>'field_key','') !~ '^[a-z][a-z0-9_]{1,63}$'
       or coalesce(x->>'input_type','') not in ('text','email','tel','date','textarea','select','number')
       or nullif(trim(coalesce(x->>'label','')),'') is null
  ) then raise exception 'Définition de champ de formulaire invalide'; end if;

  select count(*)-count(distinct x->>'document_code') into duplicate_count
  from jsonb_array_elements(p_documents) x;
  if duplicate_count>0 then raise exception 'Codes de pièces dupliqués'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_documents) x
    where coalesce(x->>'document_code','') !~ '^[A-Z0-9_-]{2,64}$'
       or nullif(trim(coalesce(x->>'label','')),'') is null
       or coalesce((x->>'max_size_bytes')::bigint,10485760) not between 1 and 52428800
  ) then raise exception 'Définition de pièce justificative invalide'; end if;

  if requirements_status='VERIFIED' then
    if exists(
      select 1 from jsonb_array_elements(p_fields) x
      where coalesce((x->>'active')::boolean,true)
        and coalesce((x->>'required')::boolean,false)
        and not coalesce((x->>'verified')::boolean,false)
    ) then raise exception 'Tous les champs obligatoires doivent être vérifiés'; end if;

    if exists(
      select 1 from jsonb_array_elements(p_documents) x
      where coalesce((x->>'active')::boolean,true)
        and coalesce((x->>'required')::boolean,false)
        and not coalesce((x->>'verified')::boolean,false)
    ) then raise exception 'Toutes les pièces obligatoires doivent être vérifiées'; end if;
  end if;

  if fee_status='FREE' and payment_enabled then raise exception 'Une démarche gratuite ne peut pas activer un paiement'; end if;
  if payment_enabled and (fee_status<>'VERIFIED_CURRENT' or fee_amount is null) then
    raise exception 'Paiement impossible sans tarif courant vérifié';
  end if;

  if publication_status='PUBLISHED' then
    if legal_status<>'VERIFIED' then raise exception 'Publication impossible sans validation juridique'; end if;
    if requirements_status<>'VERIFIED' then raise exception 'Publication impossible sans validation des exigences'; end if;
    if nullif(trim(coalesce(p_service->>'output_document','')),'') is null then
      raise exception 'Le document final doit être défini avant publication';
    end if;
  end if;

  return true;
end $$;
revoke all on function private.validate_catalog_proposal_secure(text,jsonb,jsonb,jsonb) from public,anon;
grant execute on function private.validate_catalog_proposal_secure(text,jsonb,jsonb,jsonb) to authenticated;

create table if not exists public.administrative_payment_providers (
  code text primary key,
  display_name text not null,
  active boolean not null default false,
  config_status text not null default 'DISABLED'
    check (config_status in ('DISABLED','READY','MAINTENANCE')),
  currency text not null default 'XAF',
  public_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.administrative_payment_providers enable row level security;
revoke all on public.administrative_payment_providers from anon,authenticated;

create table if not exists public.administrative_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.administrative_applications(id) on delete restrict,
  applicant_uid uuid not null references auth.users(id) on delete restrict,
  provider_code text not null references public.administrative_payment_providers(code) on delete restrict,
  internal_reference text not null unique default ('EDUCO-PAY-'||upper(replace(gen_random_uuid()::text,'-',''))),
  provider_reference text,
  amount numeric not null check (amount>0),
  currency text not null default 'XAF',
  status text not null default 'PENDING'
    check (status in ('PENDING','PAID','FAILED','CANCELLED','REFUNDED')),
  payload_hash text,
  failure_code text,
  failure_message text,
  initiated_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.administrative_payment_transactions enable row level security;
revoke all on public.administrative_payment_transactions from anon,authenticated;
create index if not exists administrative_payment_transactions_application_idx
  on public.administrative_payment_transactions(application_id,initiated_at desc);
create index if not exists administrative_payment_transactions_applicant_idx
  on public.administrative_payment_transactions(applicant_uid,initiated_at desc);
create unique index if not exists administrative_payment_transactions_provider_ref_uq
  on public.administrative_payment_transactions(provider_code,provider_reference)
  where provider_reference is not null;
create unique index if not exists administrative_payment_transactions_one_pending_idx
  on public.administrative_payment_transactions(application_id)
  where status='PENDING';

create or replace function private.list_administrative_payment_providers_secure()
returns table(code text,display_name text,currency text,public_metadata jsonb)
language sql
security definer
set search_path=''
stable
as $$
  select p.code,p.display_name,p.currency,p.public_metadata
  from public.administrative_payment_providers p
  where p.active and p.config_status='READY'
  order by p.display_name
$$;
revoke all on function private.list_administrative_payment_providers_secure() from public,anon;
grant execute on function private.list_administrative_payment_providers_secure() to authenticated;

create or replace function public.list_administrative_payment_providers()
returns table(code text,display_name text,currency text,public_metadata jsonb)
language sql
security invoker
set search_path=''
stable
as $$ select * from private.list_administrative_payment_providers_secure() $$;
revoke all on function public.list_administrative_payment_providers() from public,anon;
grant execute on function public.list_administrative_payment_providers() to authenticated;

create or replace function private.create_administrative_payment_intent_secure(
  p_application_id uuid,p_provider_code text
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
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select * into a from public.administrative_applications
  where id=p_application_id and applicant_uid=auth.uid()
  for update;
  if a.id is null then raise exception 'Dossier introuvable'; end if;
  if a.status<>'PAYMENT_DUE' then raise exception 'Ce dossier n’est pas en attente de paiement'; end if;

  select * into s from public.administrative_services where code=a.service_code;
  if s.code is null or not s.payment_enabled or s.fee_status<>'VERIFIED_CURRENT'
     or s.fee_amount is null or s.publication_status<>'PUBLISHED'
     or s.legal_status<>'VERIFIED' or s.requirements_status<>'VERIFIED' then
    raise exception 'Paiement bloqué : la démarche ou son tarif n’est pas officiellement validé';
  end if;

  select * into p from public.administrative_payment_providers
  where code=upper(trim(p_provider_code)) and active and config_status='READY'
  for share;
  if p.code is null then raise exception 'Canal de paiement officiel indisponible'; end if;
  if upper(p.currency)<>upper(s.fee_currency) then raise exception 'Devise non prise en charge par ce canal'; end if;

  if a.payment_amount is distinct from s.fee_amount or upper(coalesce(a.payment_currency,''))<>upper(s.fee_currency) then
    raise exception 'Le montant du dossier ne correspond plus au tarif officiel courant';
  end if;

  select * into t from public.administrative_payment_transactions
  where application_id=a.id and status='PENDING'
  order by initiated_at desc limit 1;
  if t.id is not null then return t; end if;

  insert into public.administrative_payment_transactions(
    application_id,applicant_uid,provider_code,amount,currency
  ) values(a.id,a.applicant_uid,p.code,a.payment_amount,a.payment_currency)
  returning * into t;

  insert into public.administrative_application_events(
    application_id,actor_uid,action,from_status,to_status,note
  ) values(a.id,auth.uid(),'PAYMENT_INTENT',a.status,a.status,t.internal_reference);

  return t;
end $$;
revoke all on function private.create_administrative_payment_intent_secure(uuid,text) from public,anon;
grant execute on function private.create_administrative_payment_intent_secure(uuid,text) to authenticated;

create or replace function public.create_administrative_payment_intent(
  p_application_id uuid,p_provider_code text
)
returns public.administrative_payment_transactions
language sql
security invoker
set search_path=''
as $$ select private.create_administrative_payment_intent_secure(p_application_id,p_provider_code) $$;
revoke all on function public.create_administrative_payment_intent(uuid,text) from public,anon;
grant execute on function public.create_administrative_payment_intent(uuid,text) to authenticated;

create or replace function private.bind_administrative_payment_provider_reference_secure(
  p_transaction_id uuid,p_provider_reference text
)
returns public.administrative_payment_transactions
language plpgsql
security definer
set search_path=''
as $$
declare t public.administrative_payment_transactions;
begin
  if auth.role()<>'service_role' then raise exception 'Service fournisseur requis'; end if;
  if nullif(trim(p_provider_reference),'') is null then raise exception 'Référence fournisseur requise'; end if;
  update public.administrative_payment_transactions
  set provider_reference=trim(p_provider_reference),updated_at=now()
  where id=p_transaction_id and status='PENDING'
  returning * into t;
  if t.id is null then raise exception 'Transaction introuvable ou non modifiable'; end if;
  return t;
end $$;
revoke all on function private.bind_administrative_payment_provider_reference_secure(uuid,text) from public,anon,authenticated;
grant execute on function private.bind_administrative_payment_provider_reference_secure(uuid,text) to service_role;

create or replace function public.bind_administrative_payment_provider_reference(
  p_transaction_id uuid,p_provider_reference text
)
returns public.administrative_payment_transactions
language sql
security invoker
set search_path=''
as $$ select private.bind_administrative_payment_provider_reference_secure(p_transaction_id,p_provider_reference) $$;
revoke all on function public.bind_administrative_payment_provider_reference(uuid,text) from public,anon,authenticated;
grant execute on function public.bind_administrative_payment_provider_reference(uuid,text) to service_role;

create or replace function private.confirm_administrative_payment_provider_secure(
  p_provider_code text,p_provider_reference text,p_status text,
  p_amount numeric,p_currency text,p_payload_hash text default null,
  p_failure_code text default null,p_failure_message text default null
)
returns public.administrative_payment_transactions
language plpgsql
security definer
set search_path=''
as $$
declare
  t public.administrative_payment_transactions;
  a public.administrative_applications;
  normalized_status text:=upper(trim(p_status));
begin
  if auth.role()<>'service_role' then raise exception 'Service fournisseur requis'; end if;
  if normalized_status not in ('PAID','FAILED','CANCELLED','REFUNDED') then raise exception 'Statut fournisseur invalide'; end if;

  select * into t from public.administrative_payment_transactions
  where provider_code=upper(trim(p_provider_code))
    and provider_reference=trim(p_provider_reference)
  for update;
  if t.id is null then raise exception 'Transaction fournisseur inconnue'; end if;

  if t.status='PAID' and normalized_status='PAID' then return t; end if;
  if t.status in ('FAILED','CANCELLED','REFUNDED') and t.status<>normalized_status then
    raise exception 'Transition de transaction interdite depuis %',t.status;
  end if;

  if normalized_status='PAID' then
    if p_amount is distinct from t.amount or upper(trim(p_currency))<>upper(t.currency) then
      raise exception 'Montant ou devise du fournisseur non conforme';
    end if;
    select * into a from public.administrative_applications where id=t.application_id for update;
    if a.id is null or a.status<>'PAYMENT_DUE' then raise exception 'Dossier non payable'; end if;

    update public.administrative_payment_transactions
    set status='PAID',payload_hash=lower(p_payload_hash),paid_at=now(),updated_at=now(),
        failure_code=null,failure_message=null
    where id=t.id returning * into t;

    update public.administrative_applications
    set status='PAID',payment_reference=t.provider_reference,
        payment_amount=t.amount,payment_currency=t.currency,updated_at=now()
    where id=a.id;

    insert into public.administrative_application_events(
      application_id,actor_uid,action,from_status,to_status,note
    ) values(a.id,null,'PAYMENT_CONFIRMED',a.status,'PAID',t.provider_code||':'||t.provider_reference);
  else
    update public.administrative_payment_transactions
    set status=normalized_status,payload_hash=lower(p_payload_hash),
        failure_code=nullif(trim(p_failure_code),''),
        failure_message=nullif(trim(p_failure_message),''),
        updated_at=now()
    where id=t.id returning * into t;

    insert into public.administrative_application_events(
      application_id,actor_uid,action,from_status,to_status,note
    ) values(t.application_id,null,'PAYMENT_'||normalized_status,'PAYMENT_DUE','PAYMENT_DUE',
      coalesce(t.provider_code||':'||t.provider_reference,'Paiement non abouti'));
  end if;

  return t;
end $$;
revoke all on function private.confirm_administrative_payment_provider_secure(text,text,text,numeric,text,text,text,text) from public,anon,authenticated;
grant execute on function private.confirm_administrative_payment_provider_secure(text,text,text,numeric,text,text,text,text) to service_role;

create or replace function public.confirm_administrative_payment_provider(
  p_provider_code text,p_provider_reference text,p_status text,
  p_amount numeric,p_currency text,p_payload_hash text default null,
  p_failure_code text default null,p_failure_message text default null
)
returns public.administrative_payment_transactions
language sql
security invoker
set search_path=''
as $$
 select private.confirm_administrative_payment_provider_secure(
   p_provider_code,p_provider_reference,p_status,p_amount,p_currency,
   p_payload_hash,p_failure_code,p_failure_message
 )
$$;
revoke all on function public.confirm_administrative_payment_provider(text,text,text,numeric,text,text,text,text) from public,anon,authenticated;
grant execute on function public.confirm_administrative_payment_provider(text,text,text,numeric,text,text,text,text) to service_role;

create or replace function private.list_my_administrative_payments_secure()
returns table(
  id uuid,application_id uuid,provider_code text,internal_reference text,provider_reference text,
  amount numeric,currency text,status text,initiated_at timestamptz,paid_at timestamptz,updated_at timestamptz
)
language sql
security definer
set search_path=''
stable
as $$
 select t.id,t.application_id,t.provider_code,t.internal_reference,t.provider_reference,
        t.amount,t.currency,t.status,t.initiated_at,t.paid_at,t.updated_at
 from public.administrative_payment_transactions t
 where t.applicant_uid=(select auth.uid())
 order by t.initiated_at desc
$$;
revoke all on function private.list_my_administrative_payments_secure() from public,anon;
grant execute on function private.list_my_administrative_payments_secure() to authenticated;

create or replace function public.list_my_administrative_payments()
returns table(
  id uuid,application_id uuid,provider_code text,internal_reference text,provider_reference text,
  amount numeric,currency text,status text,initiated_at timestamptz,paid_at timestamptz,updated_at timestamptz
)
language sql
security invoker
set search_path=''
stable
as $$ select * from private.list_my_administrative_payments_secure() $$;
revoke all on function public.list_my_administrative_payments() from public,anon;
grant execute on function public.list_my_administrative_payments() to authenticated;

create table if not exists public.administrative_document_events (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.administrative_official_documents(id) on delete cascade,
  application_id uuid not null references public.administrative_applications(id) on delete cascade,
  actor_uid uuid references auth.users(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.administrative_document_events enable row level security;
revoke all on public.administrative_document_events from anon,authenticated;
create index if not exists administrative_document_events_document_idx
  on public.administrative_document_events(document_id,created_at desc);
create index if not exists administrative_document_events_application_idx
  on public.administrative_document_events(application_id,created_at desc);
create index if not exists administrative_document_events_actor_idx
  on public.administrative_document_events(actor_uid,created_at desc);

alter table public.administrative_official_documents
  drop constraint if exists administrative_official_documents_application_id_key;
drop index if exists public.administrative_official_documents_application_id_key;
create unique index if not exists administrative_official_documents_one_current_per_application_uq
  on public.administrative_official_documents(application_id)
  where issuance_state in ('RESERVED','FINAL') and status in ('VALID','SUSPENDED');

create or replace function private.reserve_administrative_document_secure(p_application_id uuid)
returns public.administrative_official_documents
language plpgsql
security definer
set search_path=''
as $$
declare
 a public.administrative_applications; s public.administrative_services;
 sg public.administrative_authorized_signers; d public.administrative_official_documents; n text;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into a from public.administrative_applications where id=p_application_id for update;
 if a.id is null or not public.is_ministry_administrative_agent(coalesce(a.assigned_ministry,a.ministry)) then raise exception 'Accès non autorisé'; end if;
 if a.status not in ('APPROVED','PAID') then raise exception 'Dossier non éligible à émission'; end if;
 if a.workflow_stage_code='SIGNATURE' and a.assigned_agent_uid is distinct from auth.uid() then raise exception 'Ce dossier est affecté à un autre signataire'; end if;

 select * into s from public.administrative_services where code=a.service_code;
 if s.code is null or s.publication_status<>'PUBLISHED' or s.legal_status<>'VERIFIED'
    or s.requirements_status<>'VERIFIED' then raise exception 'Démarche non publiable juridiquement'; end if;
 if s.payment_enabled and a.status<>'PAID' then raise exception 'Paiement officiel non confirmé'; end if;

 select * into sg from public.administrative_authorized_signers
 where user_uid=auth.uid() and ministry=a.ministry and active
   and (service_code is null or service_code=a.service_code)
   and valid_from<=now() and (valid_until is null or valid_until>now())
 order by (service_code is not null) desc,valid_from desc limit 1;
 if sg.id is null then raise exception 'Signataire non habilité'; end if;

 select * into d from public.administrative_official_documents
 where application_id=a.id and issuance_state='RESERVED' and status='VALID'
 order by issued_at desc limit 1;
 if d.id is not null then
   if d.signer_authorization_id<>sg.id then raise exception 'Une réservation existe déjà pour un autre signataire'; end if;
   return d;
 end if;

 if exists(
   select 1 from public.administrative_official_documents x
   where x.application_id=a.id and x.issuance_state='FINAL' and x.status in ('VALID','SUSPENDED')
 ) then raise exception 'Un document officiel actif existe déjà pour ce dossier'; end if;

 n:=upper(a.ministry)||'-'||replace(a.service_code,'-','')||'-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.administrative_document_number_seq')::text,7,'0');
 insert into public.administrative_official_documents(
   application_id,owner_uid,document_number,document_type,ministry,signer_name,signer_title,
   signer_authorization_id,legal_reference,issuance_state
 ) values(
   a.id,a.applicant_uid,n,coalesce(s.output_document,s.name),a.ministry,sg.signer_name,sg.signer_title,
   sg.id,s.legal_reference,'RESERVED'
 ) returning * into d;

 insert into public.administrative_document_events(document_id,application_id,actor_uid,action,to_status,details)
 values(d.id,a.id,auth.uid(),'RESERVED','VALID',jsonb_build_object('document_number',d.document_number,'signer_authorization_id',sg.id));
 return d;
end $$;
revoke all on function private.reserve_administrative_document_secure(uuid) from public,anon;
grant execute on function private.reserve_administrative_document_secure(uuid) to authenticated;

create or replace function private.finalize_administrative_document_secure(
  p_document_id uuid,p_storage_path text,p_sha256 text
)
returns public.administrative_official_documents
language plpgsql
security definer
set search_path=''
as $$
declare
 d public.administrative_official_documents; a public.administrative_applications;
 sg public.administrative_authorized_signers;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into d from public.administrative_official_documents where id=p_document_id for update;
 if d.id is null or d.issuance_state<>'RESERVED' or d.status<>'VALID' then raise exception 'Réservation invalide'; end if;
 select * into a from public.administrative_applications where id=d.application_id for update;
 if a.id is null then raise exception 'Dossier introuvable'; end if;
 if a.workflow_stage_code='SIGNATURE' and a.assigned_agent_uid is distinct from auth.uid() then raise exception 'Le signataire affecté a changé'; end if;

 select * into sg from public.administrative_authorized_signers
 where id=d.signer_authorization_id and user_uid=auth.uid() and active
   and valid_from<=now() and (valid_until is null or valid_until>now())
 for share;
 if sg.id is null then raise exception 'Habilitation du signataire expirée ou révoquée'; end if;

 if p_storage_path is null or p_sha256 !~ '^[0-9a-fA-F]{64}$' then raise exception 'PDF ou empreinte invalide'; end if;

 update public.administrative_official_documents
 set storage_path=p_storage_path,sha256=lower(p_sha256),issuance_state='FINAL'
 where id=d.id returning * into d;

 update public.administrative_applications set status='DOCUMENT_ISSUED',updated_at=now() where id=a.id;
 insert into public.administrative_application_events(application_id,action,from_status,to_status,note)
 values(a.id,'ISSUE_DOCUMENT',a.status,'DOCUMENT_ISSUED',d.document_number);
 insert into public.administrative_document_events(document_id,application_id,actor_uid,action,from_status,to_status,details)
 values(d.id,a.id,auth.uid(),'FINALIZED','RESERVED','FINAL',jsonb_build_object('sha256',lower(p_sha256),'storage_path',p_storage_path));
 return d;
end $$;
revoke all on function private.finalize_administrative_document_secure(uuid,text,text) from public,anon;
grant execute on function private.finalize_administrative_document_secure(uuid,text,text) to authenticated;

create or replace function private.fail_administrative_document_secure(
  p_document_id uuid,p_reason text
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare d public.administrative_official_documents;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into d from public.administrative_official_documents where id=p_document_id for update;
 if d.id is null or d.issuance_state<>'RESERVED' then return false; end if;
 if d.signer_authorization_id not in (
   select s.id from public.administrative_authorized_signers s where s.user_uid=auth.uid()
 ) then raise exception 'Accès non autorisé'; end if;
 update public.administrative_official_documents set issuance_state='FAILED',status='CANCELLED',revoked_at=now() where id=d.id;
 insert into public.administrative_document_events(document_id,application_id,actor_uid,action,from_status,to_status,details)
 values(d.id,d.application_id,auth.uid(),'GENERATION_FAILED','RESERVED','FAILED',
   jsonb_build_object('reason',left(coalesce(p_reason,'Erreur de génération'),1000)));
 return true;
end $$;
revoke all on function private.fail_administrative_document_secure(uuid,text) from public,anon;
grant execute on function private.fail_administrative_document_secure(uuid,text) to authenticated;

create or replace function public.fail_administrative_document(p_document_id uuid,p_reason text)
returns boolean
language sql security invoker set search_path=''
as $$ select private.fail_administrative_document_secure(p_document_id,p_reason) $$;
revoke all on function public.fail_administrative_document(uuid,text) from public,anon;
grant execute on function public.fail_administrative_document(uuid,text) to authenticated;

create or replace function private.change_administrative_document_status_secure(
  p_document_id uuid,p_action text,p_replacement_id uuid default null
)
returns public.administrative_official_documents
language plpgsql
security definer
set search_path=''
as $$
declare d public.administrative_official_documents; replacement public.administrative_official_documents; ns text; old_status text;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into d from public.administrative_official_documents where id=p_document_id for update;
 if d.id is null or not private.is_ministry_signer_admin_secure(d.ministry) then raise exception 'Accès non autorisé'; end if;
 ns:=case upper(p_action) when 'SUSPEND' then 'SUSPENDED' when 'REVOKE' then 'REVOKED' when 'CANCEL' then 'CANCELLED' when 'REPLACE' then 'REPLACED' else null end;
 if ns is null then raise exception 'Action invalide'; end if;
 if d.status not in ('VALID','SUSPENDED','REVOKED') then raise exception 'Transition interdite depuis %',d.status; end if;

 if ns='REPLACED' then
   if p_replacement_id is null then raise exception 'Document de remplacement requis'; end if;
   select * into replacement from public.administrative_official_documents where id=p_replacement_id;
   if replacement.id is null or replacement.application_id<>d.application_id or replacement.issuance_state<>'FINAL' or replacement.status<>'VALID' then
     raise exception 'Document de remplacement invalide';
   end if;
 end if;

 old_status:=d.status;
 update public.administrative_official_documents
 set status=ns,
     revoked_at=case when ns in ('REVOKED','CANCELLED') then coalesce(revoked_at,now()) else revoked_at end,
     replaced_by=case when ns='REPLACED' then p_replacement_id else replaced_by end
 where id=d.id returning * into d;

 insert into public.administrative_document_events(document_id,application_id,actor_uid,action,from_status,to_status,details)
 values(d.id,d.application_id,auth.uid(),upper(p_action),old_status,ns,
   case when p_replacement_id is null then '{}'::jsonb else jsonb_build_object('replacement_id',p_replacement_id) end);
 return d;
end $$;
revoke all on function private.change_administrative_document_status_secure(uuid,text,uuid) from public,anon;
grant execute on function private.change_administrative_document_status_secure(uuid,text,uuid) to authenticated;
