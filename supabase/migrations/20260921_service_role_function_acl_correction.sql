
-- Service-role authorization is enforced by EXECUTE ACLs on both public wrappers and private definer functions.
-- Do not inspect current_user inside SECURITY DEFINER: it resolves to the function owner.

create or replace function private.confirm_administrative_payment_provider_secure(
  p_provider_code text,
  p_provider_reference text,
  p_status text,
  p_amount numeric,
  p_currency text,
  p_payload_hash text default null,
  p_failure_code text default null,
  p_failure_message text default null
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
  if normalized_status not in ('PAID','FAILED','CANCELLED','REFUNDED') then
    raise exception 'Statut fournisseur invalide';
  end if;

  select * into t
  from public.administrative_payment_transactions
  where provider_code=upper(trim(p_provider_code))
    and provider_reference=trim(p_provider_reference)
  for update;
  if t.id is null then raise exception 'Transaction fournisseur inconnue'; end if;

  if p_amount is distinct from t.amount
     or upper(trim(p_currency))<>upper(t.currency) then
    raise exception 'Montant ou devise du fournisseur non conforme';
  end if;

  if t.status=normalized_status then return t; end if;
  if t.status='PAID' and normalized_status<>'REFUNDED' then
    raise exception 'Un paiement confirmé ne peut évoluer que vers REFUNDED';
  end if;
  if t.status in ('FAILED','CANCELLED','REFUNDED') then
    raise exception 'Transition de transaction interdite depuis %',t.status;
  end if;

  if normalized_status='PAID' then
    select * into a
    from public.administrative_applications
    where id=t.application_id
    for update;
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
    ) values(
      a.id,null,'PAYMENT_CONFIRMED',a.status,'PAID',
      t.provider_code||':'||t.provider_reference
    );

  elsif normalized_status='REFUNDED' then
    update public.administrative_payment_transactions
    set status='REFUNDED',payload_hash=lower(p_payload_hash),updated_at=now(),
        failure_code=nullif(trim(p_failure_code),''),
        failure_message=nullif(trim(p_failure_message),'')
    where id=t.id returning * into t;

    insert into public.administrative_application_events(
      application_id,actor_uid,action,from_status,to_status,note
    ) values(
      t.application_id,null,'PAYMENT_REFUNDED','PAID','PAID',
      coalesce(t.provider_code||':'||t.provider_reference,'Paiement remboursé')
    );

  else
    update public.administrative_payment_transactions
    set status=normalized_status,payload_hash=lower(p_payload_hash),
        failure_code=nullif(trim(p_failure_code),''),
        failure_message=nullif(trim(p_failure_message),''),
        updated_at=now()
    where id=t.id returning * into t;

    insert into public.administrative_application_events(
      application_id,actor_uid,action,from_status,to_status,note
    ) values(
      t.application_id,null,'PAYMENT_'||normalized_status,
      'PAYMENT_DUE','PAYMENT_DUE',
      coalesce(t.provider_code||':'||t.provider_reference,'Paiement non abouti')
    );
  end if;

  return t;
end $$;

revoke all on function private.confirm_administrative_payment_provider_secure(text,text,text,numeric,text,text,text,text)
from public,anon,authenticated;
grant execute on function private.confirm_administrative_payment_provider_secure(text,text,text,numeric,text,text,text,text)
to service_role;

revoke all on function public.confirm_administrative_payment_provider(text,text,text,numeric,text,text,text,text)
from public,anon,authenticated;
grant execute on function public.confirm_administrative_payment_provider(text,text,text,numeric,text,text,text,text)
to service_role;

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
  resolved record;
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
     or s.publication_status<>'PUBLISHED'
     or s.legal_status<>'VERIFIED'
     or s.requirements_status<>'VERIFIED' then
    raise exception 'Paiement bloqué : la démarche ou son tarif n’est pas officiellement validé';
  end if;

  select * into resolved
  from private.resolve_administrative_fee_secure(a.service_code,a.form_data);

  if a.payment_amount is distinct from resolved.amount
     or upper(coalesce(a.payment_currency,''))<>upper(resolved.currency)
     or a.fee_variant_code is distinct from resolved.fee_variant_code
     or a.fee_reference_snapshot is distinct from resolved.fee_reference
     or a.fee_source_url_snapshot is distinct from resolved.fee_source_url then
    raise exception 'Le barème officiel a changé depuis l’approbation : nouvelle validation requise';
  end if;

  select * into p
  from public.administrative_payment_providers
  where code=upper(trim(p_provider_code))
    and active and config_status='READY'
  for share;
  if p.code is null then raise exception 'Canal de paiement officiel indisponible'; end if;
  if upper(p.currency)<>upper(resolved.currency) then
    raise exception 'Devise non prise en charge par ce canal';
  end if;

  select * into t
  from public.administrative_payment_transactions
  where application_id=a.id and status='PENDING'
  order by initiated_at desc
  limit 1;

  if t.id is not null then
    if t.provider_code<>p.code
       or t.amount<>a.payment_amount
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

revoke all on function public.create_administrative_payment_intent_server(uuid,text,uuid)
from public,anon,authenticated;
grant execute on function public.create_administrative_payment_intent_server(uuid,text,uuid)
to service_role;
