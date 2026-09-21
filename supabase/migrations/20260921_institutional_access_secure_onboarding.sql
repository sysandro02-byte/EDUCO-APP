do $$
begin
  alter table public.institutional_account_requests drop constraint if exists institutional_account_requests_ministry_check;
  alter table public.institutional_account_requests drop constraint if exists institutional_account_requests_entity_check;
  alter table public.institutional_account_requests drop constraint if exists institutional_account_requests_role_check;
exception when undefined_table then null;
end $$;

alter table public.institutional_account_requests
  add column if not exists proof_storage_path text,
  add column if not exists tracking_token_hash text,
  add column if not exists review_checklist jsonb not null default '{}'::jsonb,
  add column if not exists approved_role text,
  add column if not exists provisioned_at timestamptz;

alter table public.institutional_account_requests
  add constraint institutional_account_requests_ministry_v2_check
    check (ministry in ('MEPSA','MES','METP','MFP')),
  add constraint institutional_account_requests_entity_v2_check
    check (char_length(trim(entity)) between 2 and 160),
  add constraint institutional_account_requests_role_v2_check
    check (
      requested_role in (
        ministry||'_MINISTRE',
        ministry||'_CABINET',
        ministry||'_SECRETAIRE_GENERAL',
        ministry||'_DG',
        ministry||'_DIRECTEUR_GENERAL'
      )
    ),
  add constraint institutional_account_requests_review_checklist_object
    check (jsonb_typeof(review_checklist)='object');

create unique index if not exists institutional_account_requests_tracking_hash_uidx
on public.institutional_account_requests(tracking_token_hash)
where tracking_token_hash is not null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'institutional-account-proofs',
  'institutional-account-proofs',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png']::text[]
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists institutional_account_requests_submit on public.institutional_account_requests;
revoke insert on public.institutional_account_requests from anon,authenticated;

create or replace function private.is_etat_admin_secure()
returns boolean
language sql
security definer
set search_path=''
stable
as $$
 select exists(
   select 1
   from public.users u
   join public.administrative_government_accounts g on g.user_uid=auth.uid()
   where u.uid=auth.uid()::text
     and upper(replace(replace(trim(u.role),' ','_'),'-','_'))='ETAT_ADMIN'
     and g.ministry='ETAT'
     and g.government_role='ETAT_ADMIN'
     and g.active
     and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
 )
$$;
revoke all on function private.is_etat_admin_secure() from public,anon;
grant execute on function private.is_etat_admin_secure() to authenticated;

create or replace function public.can_review_institutional_access_requests()
returns boolean
language sql
security invoker
set search_path=''
stable
as $$ select private.is_etat_admin_secure() $$;
revoke all on function public.can_review_institutional_access_requests() from public,anon;
grant execute on function public.can_review_institutional_access_requests() to authenticated;

comment on column public.institutional_account_requests.proof_storage_path is
'Acte de nomination ou justificatif professionnel, stocké dans un bucket privé.';
comment on column public.institutional_account_requests.tracking_token_hash is
'Empreinte SHA-256 du secret de suivi remis une seule fois au demandeur.';
comment on column public.institutional_account_requests.approved_role is
'Rôle gouvernemental réellement provisionné après contrôle ETAT_ADMIN.';