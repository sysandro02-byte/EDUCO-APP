-- Harden final payment transitions against contradictory/replayed provider callbacks.
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
  if current_user<>'service_role' then raise exception 'Service fournisseur requis'; end if;
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
