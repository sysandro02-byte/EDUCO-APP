-- EDUCO institutional account requests
-- Public users may only INSERT a constrained pending request. No public read/update/delete access is granted.

create extension if not exists pgcrypto;

create table if not exists public.institutional_account_requests (
  id uuid primary key default gen_random_uuid(),
  ministry text not null check (ministry in ('MEPSA', 'MES', 'METP')),
  entity text not null,
  requested_role text not null,
  full_name text not null,
  official_email text not null,
  phone text not null,
  employee_number text not null,
  function_title text not null,
  service_unit text not null,
  appointment_reference text not null,
  justification text not null,
  extra_data jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED')),
  reviewer_uid text,
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institutional_account_requests_entity_check check (
    (ministry = 'MEPSA' and entity in ('CABINET','DGEB','DGES','DCEG','DGRHAS','DGAENF','INSPECTION','DEP','DSIC','EXAMENS','AGREMENTS','DDEPSA'))
    or (ministry = 'MES' and entity in ('CABINET','DGES','DGASOU','DEP','DIRCOOP','DSIC','DAEP','INSPECTION','ACADEMIES'))
    or (ministry = 'METP' and entity in ('CABINET','DGET','DGEP','DGA_RH','EXAMENS_CONCOURS','DSIC','INSPECTION','EQUIPEMENT_PATRIMOINE'))
  ),
  constraint institutional_account_requests_role_check check (requested_role = ministry || '_' || entity),
  constraint institutional_account_requests_full_name_len check (char_length(trim(full_name)) between 2 and 160),
  constraint institutional_account_requests_email_len check (char_length(trim(official_email)) between 5 and 254),
  constraint institutional_account_requests_phone_len check (char_length(trim(phone)) between 6 and 40),
  constraint institutional_account_requests_employee_number_len check (char_length(trim(employee_number)) between 1 and 120),
  constraint institutional_account_requests_function_len check (char_length(trim(function_title)) between 2 and 180),
  constraint institutional_account_requests_service_len check (char_length(trim(service_unit)) between 2 and 220),
  constraint institutional_account_requests_appointment_len check (char_length(trim(appointment_reference)) between 2 and 220),
  constraint institutional_account_requests_justification_len check (char_length(trim(justification)) between 10 and 2000),
  constraint institutional_account_requests_email_format check (official_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  constraint institutional_account_requests_extra_object check (jsonb_typeof(extra_data) = 'object')
);

create unique index if not exists institutional_account_requests_pending_email_context_uidx
  on public.institutional_account_requests (ministry, entity, lower(official_email))
  where status in ('PENDING', 'UNDER_REVIEW');

create index if not exists institutional_account_requests_status_created_idx
  on public.institutional_account_requests (status, created_at desc);

create index if not exists institutional_account_requests_context_created_idx
  on public.institutional_account_requests (ministry, entity, created_at desc);

alter table public.institutional_account_requests enable row level security;

revoke all on table public.institutional_account_requests from public, anon, authenticated;

grant insert (
  ministry,
  entity,
  requested_role,
  full_name,
  official_email,
  phone,
  employee_number,
  function_title,
  service_unit,
  appointment_reference,
  justification,
  extra_data,
  status
) on public.institutional_account_requests to anon, authenticated;

-- Submission is intentionally the only public operation. Review/approval is performed
-- by privileged administration flows using the server/service role.
drop policy if exists institutional_account_requests_submit on public.institutional_account_requests;
create policy institutional_account_requests_submit
on public.institutional_account_requests
for insert
to anon, authenticated
with check (
  status = 'PENDING'
  and reviewer_uid is null
  and review_notes is null
  and reviewed_at is null
  and requested_role = ministry || '_' || entity
  and char_length(trim(full_name)) between 2 and 160
  and char_length(trim(official_email)) between 5 and 254
  and official_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  and char_length(trim(phone)) between 6 and 40
  and char_length(trim(employee_number)) between 1 and 120
  and char_length(trim(function_title)) between 2 and 180
  and char_length(trim(service_unit)) between 2 and 220
  and char_length(trim(appointment_reference)) between 2 and 220
  and char_length(trim(justification)) between 10 and 2000
  and jsonb_typeof(extra_data) = 'object'
);

comment on table public.institutional_account_requests is
  'Demandes de comptes institutionnels EDUCO. Une demande ne crée jamais directement un compte privilégié.';
