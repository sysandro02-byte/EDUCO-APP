-- EDUCO — inscriptions établissement + validation des comptes sous tutelle
-- Migration additive : aucune donnée historique n'est supprimée.

create extension if not exists pgcrypto;

-- 1) Nature juridique des écoles (public / privé).
alter table public.schools
  add column if not exists ownership_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schools_ownership_type_check'
      and conrelid = 'public.schools'::regclass
  ) then
    alter table public.schools
      add constraint schools_ownership_type_check
      check (ownership_type is null or ownership_type in ('PUBLIC', 'PRIVATE'));
  end if;
end $$;

-- Le backend historique persiste déjà le JSON levels. La nouvelle UI y ajoute
-- __ownershipType ; ce trigger normalise la valeur dans une vraie colonne sans
-- casser les anciens clients ni les anciens dossiers.
create or replace function public.educo_sync_school_ownership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.ownership_type is null
     and jsonb_typeof(coalesce(new.levels::jsonb, '{}'::jsonb)) = 'object'
     and (new.levels::jsonb ? '__ownershipType') then
    new.ownership_type := upper(trim(new.levels::jsonb ->> '__ownershipType'));
  end if;
  if new.ownership_type is not null then
    new.ownership_type := upper(trim(new.ownership_type));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_educo_sync_school_ownership on public.schools;
create trigger trg_educo_sync_school_ownership
before insert or update of levels, ownership_type on public.schools
for each row execute function public.educo_sync_school_ownership();

update public.schools
set ownership_type = upper(trim(levels::jsonb ->> '__ownershipType'))
where ownership_type is null
  and jsonb_typeof(coalesce(levels::jsonb, '{}'::jsonb)) = 'object'
  and levels::jsonb ? '__ownershipType'
  and upper(trim(levels::jsonb ->> '__ownershipType')) in ('PUBLIC', 'PRIVATE');

create index if not exists schools_ownership_type_idx
  on public.schools (ownership_type);

-- 2) Dossiers de création d'établissements d'enseignement supérieur.
create table if not exists public.higher_education_establishment_requests (
  id uuid primary key default gen_random_uuid(),
  institution_type text not null check (institution_type in ('PUBLIC', 'PRIVATE')),
  request_type text not null default 'CREATION' check (request_type in ('CREATION', 'OPENING', 'REOPENING')),
  official_name text not null,
  legal_form text,
  promoter_or_initiator text not null,
  legal_representative text,
  official_email text not null,
  phone text not null,
  department text,
  address text not null,
  planned_capacity integer,
  lmd_levels text[] not null default '{}',
  programs jsonb not null default '[]'::jsonb,
  dossier_data jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  reviewer_uid text,
  reviewer_role text,
  review_notes text,
  reviewed_at timestamptz,
  notification_status text not null default 'PENDING' check (notification_status in ('PENDING', 'SENT', 'FAILED', 'NOT_REQUIRED')),
  notification_error text,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint higher_education_establishment_requests_email_format
    check (official_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint higher_education_establishment_requests_name_len
    check (char_length(trim(official_name)) between 2 and 220),
  constraint higher_education_establishment_requests_payload
    check (jsonb_typeof(dossier_data) = 'object' and jsonb_typeof(programs) = 'array')
);

create unique index if not exists higher_ed_pending_email_name_uidx
  on public.higher_education_establishment_requests (lower(official_email), lower(official_name))
  where status in ('PENDING', 'UNDER_REVIEW');
create index if not exists higher_ed_status_created_idx
  on public.higher_education_establishment_requests (status, created_at desc);

alter table public.higher_education_establishment_requests enable row level security;
revoke all on table public.higher_education_establishment_requests from public, anon, authenticated;
grant insert (
  institution_type, request_type, official_name, legal_form,
  promoter_or_initiator, legal_representative, official_email, phone,
  department, address, planned_capacity, lmd_levels, programs, dossier_data, status
) on public.higher_education_establishment_requests to anon, authenticated;

drop policy if exists higher_ed_request_submit on public.higher_education_establishment_requests;
create policy higher_ed_request_submit
on public.higher_education_establishment_requests
for insert
to anon, authenticated
with check (
  status = 'PENDING'
  and reviewer_uid is null
  and reviewer_role is null
  and reviewed_at is null
  and notification_status = 'PENDING'
  and char_length(trim(official_name)) between 2 and 220
  and official_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and char_length(trim(phone)) between 6 and 40
  and jsonb_typeof(dossier_data) = 'object'
  and jsonb_typeof(programs) = 'array'
);

-- 3) Traçabilité de la validation des comptes de directions sous tutelle.
alter table public.institutional_account_requests
  add column if not exists reviewer_role text,
  add column if not exists account_uid text,
  add column if not exists notification_status text not null default 'PENDING',
  add column if not exists notification_error text,
  add column if not exists notification_sent_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'institutional_account_requests_notification_status_check'
      and conrelid = 'public.institutional_account_requests'::regclass
  ) then
    alter table public.institutional_account_requests
      add constraint institutional_account_requests_notification_status_check
      check (notification_status in ('PENDING', 'SENT', 'FAILED', 'NOT_REQUIRED'));
  end if;
end $$;

create index if not exists institutional_account_requests_ministry_status_idx
  on public.institutional_account_requests (ministry, status, created_at desc);

comment on column public.schools.ownership_type is
  'Nature juridique de l’établissement : PUBLIC ou PRIVATE.';
comment on table public.higher_education_establishment_requests is
  'Dossiers EDUCO de projet/création/ouverture d’établissement d’enseignement supérieur, transmis au MES pour instruction.';
