-- EDUCO account lifecycle: durable inactivity state and indexed phone lookup.
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists last_active_at timestamptz;
alter table public.users add column if not exists inactivity_warning_sent_at timestamptz;
alter table public.users add column if not exists inactivity_admin_alerted_at timestamptz;
alter table public.users add column if not exists inactivity_delete_after timestamptz;
alter table public.users add column if not exists inactivity_exempt boolean not null default false;
alter table public.users add column if not exists deletion_reason text;
alter table public.users add column if not exists phone_normalized text
  generated always as (regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g')) stored;

update public.users
set last_active_at = coalesce(last_active_at, created_at::timestamptz, now())
where last_active_at is null;

create index if not exists users_last_active_at_idx on public.users(last_active_at);
create index if not exists users_inactivity_delete_after_idx on public.users(inactivity_delete_after)
  where inactivity_delete_after is not null;

-- Historical data can legitimately contain duplicate phone values. Keep the
-- lookup indexed without making the migration fail; the login resolver requires
-- exactly one matching active account before sending or accepting an OTP.
drop index if exists public.users_phone_unique_idx;
create index if not exists users_phone_lookup_idx
  on public.users (phone_normalized)
  where phone_normalized <> '';
