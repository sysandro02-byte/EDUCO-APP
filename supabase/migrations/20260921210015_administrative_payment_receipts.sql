-- Secure payment receipts for administrative procedures.
-- EDUCO issues a technical payment confirmation automatically after a provider-confirmed PAID transaction.
-- It becomes an OFFICIAL_QUITTANCE only when a fiscal/treasury reference is attached by trusted server-side code.

create sequence if not exists public.administrative_payment_receipt_seq;

create table if not exists public.administrative_payment_receipts (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null unique references public.administrative_payment_transactions(id) on delete restrict,
  application_id uuid not null references public.administrative_applications(id) on delete restrict,
  owner_uid uuid not null references auth.users(id) on delete restrict,
  receipt_number text not null unique,
  receipt_scope text not null default 'TECHNICAL_CONFIRMATION'
    check (receipt_scope in ('TECHNICAL_CONFIRMATION','OFFICIAL_QUITTANCE')),
  provider_code text not null references public.administrative_payment_providers(code) on delete restrict,
  internal_reference text not null,
  provider_reference text,
  fiscal_receipt_reference text,
  amount numeric not null check (amount > 0),
  currency text not null default 'XAF',
  paid_at timestamptz not null,
  verification_token uuid not null unique default gen_random_uuid(),
  status text not null default 'VALID' check (status in ('VALID','REVOKED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.administrative_payment_receipts enable row level security;
revoke all on public.administrative_payment_receipts from anon, authenticated;
revoke all on sequence public.administrative_payment_receipt_seq from anon, authenticated;

create index if not exists administrative_payment_receipts_owner_idx
  on public.administrative_payment_receipts(owner_uid, created_at desc);
create index if not exists administrative_payment_receipts_application_idx
  on public.administrative_payment_receipts(application_id);
create index if not exists administrative_payment_receipts_verification_idx
  on public.administrative_payment_receipts(verification_token);

create or replace function private.issue_administrative_payment_receipt_secure()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_number text;
begin
  if new.status='PAID' and old.status is distinct from 'PAID' then
    v_number := 'EDUCO-RCP-' || to_char(coalesce(new.paid_at, now()), 'YYYY') || '-' ||
      lpad(nextval('public.administrative_payment_receipt_seq')::text, 7, '0');

    insert into public.administrative_payment_receipts(
      transaction_id, application_id, owner_uid, receipt_number,
      provider_code, internal_reference, provider_reference,
      amount, currency, paid_at
    ) values (
      new.id, new.application_id, new.applicant_uid, v_number,
      new.provider_code, new.internal_reference, new.provider_reference,
      new.amount, new.currency, coalesce(new.paid_at, now())
    )
    on conflict (transaction_id) do nothing;
  end if;
  return new;
end
$$;

revoke all on function private.issue_administrative_payment_receipt_secure() from public, anon, authenticated;

drop trigger if exists administrative_payment_receipt_after_paid on public.administrative_payment_transactions;
create trigger administrative_payment_receipt_after_paid
after update of status on public.administrative_payment_transactions
for each row
when (new.status='PAID' and old.status is distinct from new.status)
execute function private.issue_administrative_payment_receipt_secure();

insert into public.administrative_payment_receipts(
  transaction_id, application_id, owner_uid, receipt_number,
  provider_code, internal_reference, provider_reference,
  amount, currency, paid_at
)
select
  t.id, t.application_id, t.applicant_uid,
  'EDUCO-RCP-' || to_char(coalesce(t.paid_at,t.updated_at,t.initiated_at), 'YYYY') || '-' ||
    lpad(nextval('public.administrative_payment_receipt_seq')::text, 7, '0'),
  t.provider_code, t.internal_reference, t.provider_reference,
  t.amount, t.currency, coalesce(t.paid_at,t.updated_at,t.initiated_at)
from public.administrative_payment_transactions t
where t.status='PAID'
on conflict (transaction_id) do nothing;

create or replace function private.list_my_administrative_payment_receipts_secure()
returns table(
  id uuid, application_id uuid, transaction_id uuid, receipt_number text, receipt_scope text,
  provider_code text, provider_name text, internal_reference text, provider_reference text,
  fiscal_receipt_reference text, amount numeric, currency text, paid_at timestamptz,
  verification_token uuid, status text, created_at timestamptz
)
language sql
security definer
set search_path=''
stable
as $$
  select r.id,r.application_id,r.transaction_id,r.receipt_number,r.receipt_scope,
         r.provider_code,p.display_name,r.internal_reference,r.provider_reference,
         r.fiscal_receipt_reference,r.amount,r.currency,r.paid_at,
         r.verification_token,r.status,r.created_at
  from public.administrative_payment_receipts r
  join public.administrative_payment_providers p on p.code=r.provider_code
  where r.owner_uid=(select auth.uid())
  order by r.created_at desc
$$;

revoke all on function private.list_my_administrative_payment_receipts_secure() from public, anon;
grant execute on function private.list_my_administrative_payment_receipts_secure() to authenticated;

create or replace function public.list_my_administrative_payment_receipts()
returns table(
  id uuid, application_id uuid, transaction_id uuid, receipt_number text, receipt_scope text,
  provider_code text, provider_name text, internal_reference text, provider_reference text,
  fiscal_receipt_reference text, amount numeric, currency text, paid_at timestamptz,
  verification_token uuid, status text, created_at timestamptz
)
language sql
security invoker
set search_path=''
stable
as $$ select * from private.list_my_administrative_payment_receipts_secure() $$;

revoke all on function public.list_my_administrative_payment_receipts() from public, anon;
grant execute on function public.list_my_administrative_payment_receipts() to authenticated;

create or replace function private.verify_administrative_payment_receipt_secure(p_token uuid)
returns table(
  receipt_number text, receipt_scope text, provider_name text, fiscal_receipt_reference text,
  amount numeric, currency text, paid_at timestamptz, status text
)
language sql
security definer
set search_path=''
stable
as $$
  select r.receipt_number,r.receipt_scope,p.display_name,r.fiscal_receipt_reference,
         r.amount,r.currency,r.paid_at,r.status
  from public.administrative_payment_receipts r
  join public.administrative_payment_providers p on p.code=r.provider_code
  where r.verification_token=p_token
$$;

revoke all on function private.verify_administrative_payment_receipt_secure(uuid) from public, anon, authenticated;

create or replace function public.verify_administrative_payment_receipt(p_token uuid)
returns table(
  receipt_number text, receipt_scope text, provider_name text, fiscal_receipt_reference text,
  amount numeric, currency text, paid_at timestamptz, status text
)
language sql
security invoker
set search_path=''
stable
as $$ select * from private.verify_administrative_payment_receipt_secure(p_token) $$;

revoke all on function public.verify_administrative_payment_receipt(uuid) from public;
grant execute on function public.verify_administrative_payment_receipt(uuid) to anon, authenticated;

create or replace function private.attach_administrative_fiscal_receipt_secure(
  p_transaction_id uuid,
  p_fiscal_receipt_reference text
)
returns public.administrative_payment_receipts
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.administrative_payment_receipts;
begin
  if not has_function_privilege(session_user,
    'public.attach_administrative_fiscal_receipt(uuid,text)'::regprocedure,'EXECUTE') then
    raise exception 'Service fournisseur requis';
  end if;
  if nullif(trim(p_fiscal_receipt_reference),'') is null then
    raise exception 'Référence de quittance requise';
  end if;

  update public.administrative_payment_receipts
  set fiscal_receipt_reference=trim(p_fiscal_receipt_reference),
      receipt_scope='OFFICIAL_QUITTANCE',
      updated_at=now()
  where transaction_id=p_transaction_id and status='VALID'
  returning * into r;

  if r.id is null then raise exception 'Reçu de paiement introuvable'; end if;
  return r;
end
$$;

revoke all on function private.attach_administrative_fiscal_receipt_secure(uuid,text) from public, anon, authenticated;

create or replace function public.attach_administrative_fiscal_receipt(
  p_transaction_id uuid,
  p_fiscal_receipt_reference text
)
returns public.administrative_payment_receipts
language sql
security invoker
set search_path=''
as $$ select private.attach_administrative_fiscal_receipt_secure(p_transaction_id,p_fiscal_receipt_reference) $$;

revoke all on function public.attach_administrative_fiscal_receipt(uuid,text) from public, anon, authenticated;
grant execute on function public.attach_administrative_fiscal_receipt(uuid,text) to service_role;
