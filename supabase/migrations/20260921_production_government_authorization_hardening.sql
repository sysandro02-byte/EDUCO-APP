-- EDUCO production government authorization hardening
-- Normalized organizations, assignments, scoped statistics and hardened RPC boundaries.

create schema if not exists private;
grant usage on schema private to authenticated;

create table if not exists public.government_organizations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  ministry text not null check (ministry in ('ETAT','MEPSA','MES','METP','MFP')),
  entity text,
  label text not null,
  level text not null check (level in ('STATE','MINISTRY','ENTITY')),
  parent_id uuid references public.government_organizations(id) on delete restrict,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (level='STATE' and ministry='ETAT' and entity is null)
    or (level='MINISTRY' and ministry<>'ETAT' and entity is null)
    or (level='ENTITY' and ministry<>'ETAT' and entity is not null)
  )
);
alter table public.government_organizations enable row level security;
revoke all on public.government_organizations from anon, authenticated;
grant select on public.government_organizations to authenticated;
drop policy if exists "authenticated read active government organizations" on public.government_organizations;
create policy "authenticated read active government organizations"
on public.government_organizations for select to authenticated
using (active = true);

create unique index if not exists government_organizations_ministry_root_uq
on public.government_organizations(ministry)
where entity is null;

create unique index if not exists government_organizations_entity_uq
on public.government_organizations(ministry,entity)
where entity is not null;

insert into public.government_organizations(code,ministry,entity,label,level,parent_id)
values ('ETAT','ETAT',null,'État','STATE',null)
on conflict (code) do update set label=excluded.label,active=true,updated_at=now();

insert into public.government_organizations(code,ministry,entity,label,level,parent_id)
select x.code,x.ministry,null,x.label,'MINISTRY',e.id
from (values
  ('MEPSA','MEPSA','MEPSA'),
  ('MES','MES','MES'),
  ('METP','METP','METP'),
  ('MFP','MFP','MFP')
) x(code,ministry,label)
cross join lateral (select id from public.government_organizations where code='ETAT') e
on conflict (code) do update set
  label=excluded.label,parent_id=excluded.parent_id,active=true,updated_at=now();

insert into public.government_organizations(code,ministry,entity,label,level,parent_id)
select v.ministry||':'||v.entity,v.ministry,v.entity,v.label,'ENTITY',m.id
from (values
  ('MEPSA','CABINET','Cabinet'),
  ('MEPSA','DGEB','DG Éducation de base'),
  ('MEPSA','DGES','DG Enseignement secondaire'),
  ('MEPSA','DCEG','Direction des collèges d’enseignement général'),
  ('MEPSA','DGRHAS','DG Ressources humaines & Administration scolaire'),
  ('MEPSA','DGAENF','DG Alphabétisation & Éducation non formelle'),
  ('MEPSA','INSPECTION','Inspection générale'),
  ('MEPSA','DEP','Études & Planification'),
  ('MEPSA','DSIC','Systèmes d’information & Communication'),
  ('MEPSA','EXAMENS','Examens & Concours'),
  ('MEPSA','AGREMENTS','Agrément des établissements privés'),
  ('MEPSA','DDEPSA','Directions départementales'),
  ('MES','CABINET','Cabinet'),
  ('MES','DGES','DG Enseignement supérieur'),
  ('MES','DGASOU','DG Affaires sociales & Œuvres universitaires'),
  ('MES','DEP','Études & Planification'),
  ('MES','DIRCOOP','Coopération & Partenariats'),
  ('MES','DSIC','Systèmes d’information & Communication'),
  ('MES','DAEP','Administration, Équipement & Patrimoine'),
  ('MES','INSPECTION','Inspection générale'),
  ('MES','ACADEMIES','Académies'),
  ('METP','CABINET','Cabinet'),
  ('METP','DGET','DG Enseignement technique'),
  ('METP','DGEP','DG Enseignement professionnel'),
  ('METP','DGA_RH','Administration & Ressources humaines'),
  ('METP','EXAMENS_CONCOURS','Examens & Concours'),
  ('METP','DSIC','Systèmes d’information & Communication'),
  ('METP','INSPECTION','Inspection générale'),
  ('METP','EQUIPEMENT_PATRIMOINE','Équipement & Patrimoine')
) v(ministry,entity,label)
join public.government_organizations m on m.code=v.ministry
on conflict (code) do update set
  label=excluded.label,parent_id=excluded.parent_id,active=true,updated_at=now();

create table if not exists public.government_assignments (
  id uuid primary key default gen_random_uuid(),
  user_uid uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.government_organizations(id) on delete restrict,
  role_code text not null,
  permissions text[] not null default '{}'::text[],
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  source text not null default 'SYSTEM',
  source_request_id uuid references public.institutional_account_requests(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  unique(user_uid,organization_id,role_code)
);
alter table public.government_assignments enable row level security;
revoke all on public.government_assignments from anon, authenticated;
create index if not exists government_assignments_user_active_idx
on public.government_assignments(user_uid,active,valid_from,valid_until);
create index if not exists government_assignments_org_active_idx
on public.government_assignments(organization_id,active);

create table if not exists public.government_school_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  school_id integer not null references public.schools(id) on delete cascade,
  organization_id uuid not null references public.government_organizations(id) on delete cascade,
  active boolean not null default true,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  source text not null default 'EXPLICIT',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (valid_until is null or valid_until > valid_from),
  unique(school_id,organization_id)
);
alter table public.government_school_jurisdictions enable row level security;
revoke all on public.government_school_jurisdictions from anon, authenticated;
create index if not exists government_school_jurisdictions_org_active_idx
on public.government_school_jurisdictions(organization_id,active,school_id);

create table if not exists public.government_access_audit (
  id bigint generated always as identity primary key,
  actor_uid uuid references auth.users(id) on delete set null,
  ministry text not null,
  entity text not null,
  operation text not null,
  resource_type text,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.government_access_audit enable row level security;
revoke all on public.government_access_audit from anon, authenticated;
create index if not exists government_access_audit_context_idx
on public.government_access_audit(ministry,entity,created_at desc);
create index if not exists government_access_audit_actor_idx
on public.government_access_audit(actor_uid,created_at desc);

create or replace function private.government_default_permissions(p_role text,p_entity text default null)
returns text[]
language plpgsql
immutable
set search_path=''
as $$
declare
  r text:=upper(regexp_replace(coalesce(p_role,''),'[^A-Za-z0-9]+','_','g'));
  e text:=upper(regexp_replace(coalesce(p_entity,''),'[^A-Za-z0-9]+','_','g'));
begin
  if r='ETAT_ADMIN' then return array['*']::text[]; end if;

  if r ~ '_(ADMIN|MINISTRE|CABINET|SECRETAIRE_GENERAL|DG|DIRECTEUR_GENERAL)$' then
    return array[
      'workspace.read','statistics.read','records.read','records.write','records.transition','records.delete',
      'accounts.manage','catalog.review','payments.read','payments.validate','documents.issue','audit.read','jurisdictions.manage'
    ]::text[];
  end if;

  if e<>'' and r like '%_'||e then
    return array['workspace.read','statistics.read','records.read','records.write','records.transition']::text[];
  end if;

  if r ~ '_DIRECTEUR$' then
    return array['workspace.read','statistics.read','records.read','records.write','records.transition']::text[];
  elsif r ~ '_CHEF_SERVICE$' then
    return array['workspace.read','statistics.read','records.read','records.write','records.transition']::text[];
  elsif r ~ '_AGENT_INSTRUCTEUR$' then
    return array['workspace.read','records.read','records.write','records.transition']::text[];
  elsif r ~ '_SIGNATAIRE_HABILITE$' then
    return array['workspace.read','records.read','documents.issue']::text[];
  elsif r ~ '_SIGNER_ADMIN$' then
    return array['workspace.read','records.read','documents.issue','accounts.manage']::text[];
  elsif r ~ '_FINANCE$' then
    return array['workspace.read','statistics.read','payments.read','payments.validate']::text[];
  end if;

  return array['workspace.read','records.read']::text[];
end;
$$;

revoke all on function private.government_default_permissions(text,text) from public,anon,authenticated;

-- Approved institutional requests predate the normalized assignment registry.
-- Complete their government account registry rows without granting anything beyond the approved request.
insert into public.administrative_government_accounts(
  user_uid,ministry,government_role,direction,official_title,active,must_change_password,created_by,created_at,updated_at
)
select
  r.account_uid::uuid,
  r.ministry,
  coalesce(nullif(r.approved_role,''),r.requested_role),
  r.entity,
  nullif(r.function_title,''),
  true,
  true,
  case when r.reviewer_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then r.reviewer_uid::uuid else null end,
  coalesce(r.provisioned_at,r.reviewed_at,r.created_at,now()),
  now()
from public.institutional_account_requests r
where r.status='APPROVED'
  and r.account_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
on conflict (user_uid) do update set
  ministry=excluded.ministry,
  government_role=excluded.government_role,
  direction=coalesce(excluded.direction,public.administrative_government_accounts.direction),
  official_title=coalesce(excluded.official_title,public.administrative_government_accounts.official_title),
  active=true,
  updated_at=now();

with account_rows as (
  select
    g.user_uid,
    g.ministry,
    upper(regexp_replace(coalesce(g.direction,''),'[^A-Za-z0-9]+','_','g')) as entity,
    g.government_role,
    g.created_by,
    g.created_at,
    coalesce(
      (
        select o.id
        from public.government_organizations o
        where o.ministry=g.ministry
          and o.entity=upper(regexp_replace(coalesce(g.direction,''),'[^A-Za-z0-9]+','_','g'))
          and o.active
        limit 1
      ),
      (
        select o.id
        from public.government_organizations o
        where o.ministry=g.ministry
          and o.entity is null
          and o.active
        limit 1
      )
    ) as organization_id
  from public.administrative_government_accounts g
  where g.active
)
insert into public.government_assignments(
  user_uid,organization_id,role_code,permissions,active,valid_from,source,created_by
)
select
  a.user_uid,a.organization_id,a.government_role,
  private.government_default_permissions(a.government_role,nullif(a.entity,'')),
  true,coalesce(a.created_at,now()),'GOVERNMENT_ACCOUNT',a.created_by
from account_rows a
where a.organization_id is not null
on conflict (user_uid,organization_id,role_code) do update set
  permissions=excluded.permissions,active=true,updated_at=now();

with approved as (
  select
    r.id,
    r.account_uid::uuid as user_uid,
    r.ministry,
    r.entity,
    coalesce(nullif(r.approved_role,''),r.requested_role) role_code,
    case when r.reviewer_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then r.reviewer_uid::uuid else null end created_by,
    coalesce(r.provisioned_at,r.reviewed_at,r.created_at,now()) valid_from
  from public.institutional_account_requests r
  where r.status='APPROVED'
    and r.account_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
)
insert into public.government_assignments(
  user_uid,organization_id,role_code,permissions,active,valid_from,source,source_request_id,created_by
)
select
  a.user_uid,o.id,a.role_code,
  private.government_default_permissions(a.role_code,a.entity),
  true,a.valid_from,'INSTITUTIONAL_REQUEST',a.id,a.created_by
from approved a
join public.government_organizations o on o.ministry=a.ministry and o.entity=a.entity and o.active
on conflict (user_uid,organization_id,role_code) do update set
  permissions=excluded.permissions,active=true,source_request_id=excluded.source_request_id,updated_at=now();

-- Real existing links between government records and schools are legitimate jurisdiction evidence.
with refs as (
  select ministry,entity,school_id from public.government_inspections where school_id is not null
  union select ministry,entity,school_id from public.government_national_exams where school_id is not null
  union select ministry,entity,school_id from public.government_accreditations where school_id is not null
  union select ministry,entity,school_id from public.government_hr_movements where school_id is not null
  union select ministry,entity,school_id from public.government_infrastructures where school_id is not null
  union select ministry,entity,school_id from public.government_assets where school_id is not null
  union select ministry,entity,school_id from public.government_validation_cases where school_id is not null
  union select ministry,entity,school_id from public.government_projects where school_id is not null
  union select ministry,entity,school_id from public.government_decisions where school_id is not null
  union select ministry,entity,school_id from public.government_school_map where school_id is not null
)
insert into public.government_school_jurisdictions(school_id,organization_id,source)
select distinct r.school_id,o.id,'EXISTING_GOVERNMENT_RECORD'
from refs r
join public.government_organizations o
  on o.ministry=upper(r.ministry) and o.entity=upper(r.entity) and o.active
on conflict (school_id,organization_id) do update set active=true,updated_at=now();

create or replace function private.government_actor_has_capability_secure(
  p_ministry text,
  p_entity text,
  p_capability text
)
returns boolean
language sql
security definer
set search_path=''
stable
as $$
  select exists(
    select 1
    from public.government_assignments a
    join public.government_organizations o on o.id=a.organization_id and o.active
    join public.users u on u.uid=a.user_uid::text
    where a.user_uid=(select auth.uid())
      and a.active
      and a.valid_from<=now()
      and (a.valid_until is null or a.valid_until>now())
      and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
      and (
        '*'=any(a.permissions)
        or lower(p_capability)=any(a.permissions)
      )
      and (
        o.level='STATE'
        or (
          o.ministry=upper(regexp_replace(coalesce(p_ministry,''),'[^A-Za-z0-9]+','_','g'))
          and (
            o.level='MINISTRY'
            or o.entity=upper(regexp_replace(coalesce(p_entity,''),'[^A-Za-z0-9]+','_','g'))
          )
        )
      )
  )
$$;
revoke all on function private.government_actor_has_capability_secure(text,text,text) from public,anon;
grant execute on function private.government_actor_has_capability_secure(text,text,text) to authenticated;

create or replace function public.government_context_authorized(p_ministry text,p_entity text)
returns boolean
language sql
security invoker
set search_path=''
stable
as $$
  select private.government_actor_has_capability_secure(p_ministry,p_entity,'workspace.read')
$$;
revoke all on function public.government_context_authorized(text,text) from public,anon;
grant execute on function public.government_context_authorized(text,text) to authenticated;

create or replace function private.log_government_access_secure(
  p_ministry text,p_entity text,p_operation text,p_resource_type text default null,
  p_resource_id text default null,p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path=''
as $$
  insert into public.government_access_audit(actor_uid,ministry,entity,operation,resource_type,resource_id,details)
  values(
    (select auth.uid()),
    upper(regexp_replace(coalesce(p_ministry,''),'[^A-Za-z0-9]+','_','g')),
    upper(regexp_replace(coalesce(p_entity,''),'[^A-Za-z0-9]+','_','g')),
    p_operation,p_resource_type,p_resource_id,coalesce(p_details,'{}'::jsonb)
  )
$$;
revoke all on function private.log_government_access_secure(text,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function private.government_school_in_scope_secure(
  p_school_id bigint,p_ministry text,p_entity text
)
returns boolean
language sql
security definer
set search_path=''
stable
as $$
  select exists(
    select 1
    from public.government_school_jurisdictions j
    join public.government_organizations o on o.id=j.organization_id and o.active
    where j.school_id=p_school_id
      and j.active
      and j.valid_from<=now()
      and (j.valid_until is null or j.valid_until>now())
      and o.ministry=upper(regexp_replace(coalesce(p_ministry,''),'[^A-Za-z0-9]+','_','g'))
      and (
        upper(regexp_replace(coalesce(p_entity,''),'[^A-Za-z0-9]+','_','g'))='CABINET'
        or o.entity=upper(regexp_replace(coalesce(p_entity,''),'[^A-Za-z0-9]+','_','g'))
      )
  )
$$;
revoke all on function private.government_school_in_scope_secure(bigint,text,text) from public,anon;
grant execute on function private.government_school_in_scope_secure(bigint,text,text) to authenticated;

create or replace function private.government_module_records_secure(
  p_ministry text,p_entity text,p_domain text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_table text; v_rows jsonb;
begin
  if not private.government_actor_has_capability_secure(p_ministry,p_entity,'records.read') then
    raise exception 'Accès institutionnel non autorisé';
  end if;
  v_table:=public.government_domain_table(p_domain);
  if v_table is null then raise exception 'Domaine gouvernemental non pris en charge'; end if;
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc), ''[]''::jsonb)
     from (select * from public.%I where ministry=$1 and entity=$2 order by updated_at desc limit 500) x',
    v_table
  ) into v_rows using upper(p_ministry),upper(p_entity);
  perform private.log_government_access_secure(p_ministry,p_entity,'RECORDS_LIST',lower(p_domain),null,jsonb_build_object('count',jsonb_array_length(coalesce(v_rows,'[]'::jsonb))));
  return jsonb_build_object('domain',lower(p_domain),'rows',coalesce(v_rows,'[]'::jsonb));
end $$;
revoke all on function private.government_module_records_secure(text,text,text) from public,anon;
grant execute on function private.government_module_records_secure(text,text,text) to authenticated;

create or replace function public.government_module_records(p_ministry text,p_entity text,p_domain text)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.government_module_records_secure(p_ministry,p_entity,p_domain) $$;
revoke all on function public.government_module_records(text,text,text) from public,anon;
grant execute on function public.government_module_records(text,text,text) to authenticated;

create or replace function private.government_module_save_secure(
  p_ministry text,p_entity text,p_domain text,p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_table text; v_id bigint; v_result jsonb; v_title text; v_reference text;
  v_description text; v_school_id bigint; v_due_date date; v_data jsonb;
  v_actor text; v_current_status text; v_action text;
begin
  if not private.government_actor_has_capability_secure(p_ministry,p_entity,'records.write') then
    raise exception 'Accès institutionnel non autorisé';
  end if;
  v_table:=public.government_domain_table(p_domain);
  if v_table is null then raise exception 'Domaine gouvernemental non pris en charge'; end if;
  v_title:=nullif(trim(coalesce(p_record->>'title','')),'');
  if v_title is null then raise exception 'Le titre est obligatoire'; end if;
  v_reference:=nullif(trim(coalesce(p_record->>'reference','')),'');
  v_description:=nullif(trim(coalesce(p_record->>'description','')),'');
  v_school_id:=nullif(p_record->>'schoolId','')::bigint;
  v_due_date:=nullif(p_record->>'dueDate','')::date;
  v_data:=coalesce(p_record->'data','{}'::jsonb);
  v_actor:=(select auth.uid())::text;
  v_id:=nullif(p_record->>'id','')::bigint;

  if v_school_id is not null then
    if not exists(select 1 from public.schools s where s.id=v_school_id) then
      raise exception 'Établissement associé introuvable';
    end if;
    if not private.government_school_in_scope_secure(v_school_id,p_ministry,p_entity) then
      raise exception 'Établissement hors périmètre institutionnel';
    end if;
  end if;

  if v_id is null then
    execute format(
      'insert into public.%I (ministry,entity,title,reference,status,description,school_id,due_date,data,created_by,updated_by)
       values ($1,$2,$3,$4,''Brouillon'',$5,$6,$7,$8,$9,$9) returning id',
      v_table
    ) into v_id using upper(p_ministry),upper(p_entity),v_title,v_reference,v_description,v_school_id,v_due_date,v_data,v_actor;
    v_current_status:='Brouillon'; v_action:='Création';
  else
    execute format('select status from public.%I where id=$1 and ministry=$2 and entity=$3',v_table)
      into v_current_status using v_id,upper(p_ministry),upper(p_entity);
    if v_current_status is null then raise exception 'Dossier introuvable ou hors périmètre'; end if;
    execute format(
      'update public.%I set title=$4,reference=$5,description=$6,school_id=$7,due_date=$8,data=$9,updated_by=$10,updated_at=now()
       where id=$1 and ministry=$2 and entity=$3 returning id',
      v_table
    ) into v_id using v_id,upper(p_ministry),upper(p_entity),v_title,v_reference,v_description,v_school_id,v_due_date,v_data,v_actor;
    v_action:='Modification';
  end if;

  insert into public.government_record_events(ministry,entity,domain,record_id,action,from_status,to_status,actor_uid,details)
  values(upper(p_ministry),upper(p_entity),lower(p_domain),v_id,v_action,v_current_status,v_current_status,v_actor,
    jsonb_build_object('title',v_title,'reference',v_reference));

  execute format('select to_jsonb(x) from public.%I x where x.id=$1',v_table) into v_result using v_id;
  perform private.log_government_access_secure(p_ministry,p_entity,'RECORD_SAVE',lower(p_domain),v_id::text,jsonb_build_object('action',v_action));
  return v_result;
end $$;
revoke all on function private.government_module_save_secure(text,text,text,jsonb) from public,anon;
grant execute on function private.government_module_save_secure(text,text,text,jsonb) to authenticated;

create or replace function public.government_module_save(p_ministry text,p_entity text,p_domain text,p_record jsonb)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.government_module_save_secure(p_ministry,p_entity,p_domain,p_record) $$;
revoke all on function public.government_module_save(text,text,text,jsonb) from public,anon;
grant execute on function public.government_module_save(text,text,text,jsonb) to authenticated;

create or replace function private.government_module_transition_secure(
  p_ministry text,p_entity text,p_domain text,p_id bigint,p_status text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_table text; v_old_status text; v_new_status text; v_actor text; v_updated_id bigint; v_result jsonb;
begin
  if not private.government_actor_has_capability_secure(p_ministry,p_entity,'records.transition') then
    raise exception 'Accès institutionnel non autorisé';
  end if;
  v_table:=public.government_domain_table(p_domain);
  if v_table is null then raise exception 'Domaine gouvernemental non pris en charge'; end if;
  v_new_status:=nullif(trim(coalesce(p_status,'')),'');
  if v_new_status is null then raise exception 'Statut cible obligatoire'; end if;
  execute format('select status from public.%I where id=$1 and ministry=$2 and entity=$3',v_table)
    into v_old_status using p_id,upper(p_ministry),upper(p_entity);
  if v_old_status is null then raise exception 'Dossier introuvable ou hors périmètre'; end if;
  if not public.government_status_transition_allowed(v_old_status,v_new_status) then
    raise exception 'Transition de statut non autorisée : % vers %',v_old_status,v_new_status;
  end if;
  v_actor:=(select auth.uid())::text;
  execute format(
    'update public.%I set status=$4,updated_by=$5,updated_at=now()
     where id=$1 and ministry=$2 and entity=$3 returning id',v_table
  ) into v_updated_id using p_id,upper(p_ministry),upper(p_entity),v_new_status,v_actor;
  if v_updated_id is null then raise exception 'Dossier introuvable ou hors périmètre'; end if;
  insert into public.government_record_events(ministry,entity,domain,record_id,action,from_status,to_status,actor_uid)
  values(upper(p_ministry),upper(p_entity),lower(p_domain),p_id,'Changement de statut',v_old_status,v_new_status,v_actor);
  execute format('select to_jsonb(x) from public.%I x where x.id=$1',v_table) into v_result using p_id;
  perform private.log_government_access_secure(p_ministry,p_entity,'RECORD_TRANSITION',lower(p_domain),p_id::text,jsonb_build_object('from',v_old_status,'to',v_new_status));
  return v_result;
end $$;
revoke all on function private.government_module_transition_secure(text,text,text,bigint,text) from public,anon;
grant execute on function private.government_module_transition_secure(text,text,text,bigint,text) to authenticated;

create or replace function public.government_module_transition(p_ministry text,p_entity text,p_domain text,p_id bigint,p_status text)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.government_module_transition_secure(p_ministry,p_entity,p_domain,p_id,p_status) $$;
revoke all on function public.government_module_transition(text,text,text,bigint,text) from public,anon;
grant execute on function public.government_module_transition(text,text,text,bigint,text) to authenticated;

create or replace function private.government_module_history_secure(
  p_ministry text,p_entity text,p_domain text,p_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_rows jsonb;
begin
  if not private.government_actor_has_capability_secure(p_ministry,p_entity,'records.read') then
    raise exception 'Accès institutionnel non autorisé';
  end if;
  if public.government_domain_table(p_domain) is null then raise exception 'Domaine gouvernemental non pris en charge'; end if;
  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb)
    into v_rows
  from public.government_record_events e
  where e.ministry=upper(p_ministry) and e.entity=upper(p_entity)
    and e.domain=lower(p_domain) and e.record_id=p_id;
  perform private.log_government_access_secure(p_ministry,p_entity,'RECORD_HISTORY',lower(p_domain),p_id::text,'{}'::jsonb);
  return jsonb_build_object('rows',coalesce(v_rows,'[]'::jsonb));
end $$;
revoke all on function private.government_module_history_secure(text,text,text,bigint) from public,anon;
grant execute on function private.government_module_history_secure(text,text,text,bigint) to authenticated;

create or replace function public.government_module_history(p_ministry text,p_entity text,p_domain text,p_id bigint)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.government_module_history_secure(p_ministry,p_entity,p_domain,p_id) $$;
revoke all on function public.government_module_history(text,text,text,bigint) from public,anon;
grant execute on function public.government_module_history(text,text,text,bigint) to authenticated;

create or replace function private.government_module_delete_secure(
  p_ministry text,p_entity text,p_domain text,p_id bigint
)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_table text; v_status text; v_actor text; v_deleted bigint;
begin
  if not private.government_actor_has_capability_secure(p_ministry,p_entity,'records.delete') then
    raise exception 'Suppression non autorisée pour cette affectation';
  end if;
  v_table:=public.government_domain_table(p_domain);
  if v_table is null then raise exception 'Domaine gouvernemental non pris en charge'; end if;
  execute format('select status from public.%I where id=$1 and ministry=$2 and entity=$3',v_table)
    into v_status using p_id,upper(p_ministry),upper(p_entity);
  if v_status is null then return false; end if;
  if v_status not in ('Brouillon','Rejeté') then
    raise exception 'Seuls les brouillons ou dossiers rejetés peuvent être supprimés';
  end if;
  v_actor:=(select auth.uid())::text;
  insert into public.government_record_events(ministry,entity,domain,record_id,action,from_status,to_status,actor_uid)
  values(upper(p_ministry),upper(p_entity),lower(p_domain),p_id,'Suppression',v_status,null,v_actor);
  execute format('delete from public.%I where id=$1 and ministry=$2 and entity=$3 returning id',v_table)
    into v_deleted using p_id,upper(p_ministry),upper(p_entity);
  if v_deleted is not null then
    perform private.log_government_access_secure(p_ministry,p_entity,'RECORD_DELETE',lower(p_domain),p_id::text,'{}'::jsonb);
  end if;
  return v_deleted is not null;
end $$;
revoke all on function private.government_module_delete_secure(text,text,text,bigint) from public,anon;
grant execute on function private.government_module_delete_secure(text,text,text,bigint) to authenticated;

create or replace function public.government_module_delete(p_ministry text,p_entity text,p_domain text,p_id bigint)
returns boolean
language sql
security invoker
set search_path=''
as $$ select private.government_module_delete_secure(p_ministry,p_entity,p_domain,p_id) $$;
revoke all on function public.government_module_delete(text,text,text,bigint) from public,anon;
grant execute on function public.government_module_delete(text,text,text,bigint) to authenticated;

create or replace function private.government_workspace_snapshot_secure(p_ministry text,p_entity text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_ministry text:=upper(regexp_replace(coalesce(p_ministry,''),'[^A-Za-z0-9]+','_','g'));
  v_entity text:=upper(regexp_replace(coalesce(p_entity,''),'[^A-Za-z0-9]+','_','g'));
  v_school_ids integer[];
  v_result jsonb;
begin
  if not private.government_actor_has_capability_secure(p_ministry,p_entity,'statistics.read') then
    raise exception 'Accès institutionnel non autorisé';
  end if;

  select coalesce(array_agg(distinct j.school_id),'{}'::integer[])
    into v_school_ids
  from public.government_school_jurisdictions j
  join public.government_organizations o on o.id=j.organization_id and o.active
  where j.active and j.valid_from<=now() and (j.valid_until is null or j.valid_until>now())
    and o.ministry=v_ministry
    and (v_entity='CABINET' or o.entity=v_entity);

  select jsonb_build_object(
    'generatedAt',now(),
    'scope',jsonb_build_object('ministry',v_ministry,'entity',v_entity,'mappedSchools',cardinality(v_school_ids)),
    'summary',jsonb_build_object(
      'schools',(select count(*) from public.schools s where s.id=any(v_school_ids)),
      'activeSchools',(select count(*) from public.schools s where s.id=any(v_school_ids) and lower(coalesce(s.status,'active')) in ('active','actif')),
      'users',(select count(*) from public.users u where u.school_id=any(v_school_ids) and lower(coalesce(u.status,'actif')) in ('active','actif')),
      'students',(select count(*) from public.students st where st.school_id=any(v_school_ids) and lower(coalesce(st.status,'active')) in ('active','actif')),
      'personnel',(select count(*) from public.personnel p where p.school_id=any(v_school_ids)),
      'classes',(select count(*) from public.classes c where c.school_id=any(v_school_ids) and lower(coalesce(c.status,'active')) in ('active','actif')),
      'paymentsCount',(select count(*) from public.payments p where p.school_id=any(v_school_ids) and lower(coalesce(p.status,'paid')) in ('paid','payé','paye')),
      'paymentsTotal',(select coalesce(sum(coalesce(p.amount,p.amount_paid,0)),0) from public.payments p where p.school_id=any(v_school_ids) and lower(coalesce(p.status,'paid')) in ('paid','payé','paye')),
      'incomeTotal',(select coalesce(sum(t.amount),0) from public.transactions t where t.school_id=any(v_school_ids) and lower(coalesce(t.type,'')) in ('income','recette')),
      'expenseTotal',(select coalesce(sum(t.amount),0) from public.transactions t where t.school_id=any(v_school_ids) and lower(coalesce(t.type,'')) in ('expense','dépense','depense')),
      'attendanceRecords',(select count(*) from public.attendance a join public.classes c on c.id=a.class_id where c.school_id=any(v_school_ids)),
      'gradesRecords',(select count(*) from public.grades g join public.classes c on c.id=g.class_id where c.school_id=any(v_school_ids))
    ),
    'schools',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',s.id,'name',s.name,'identifier',s.identifier,'status',s.status,
        'address',s.address,'levels',s.levels,'createdAt',s.created_at
      ) order by s.name)
      from public.schools s where s.id=any(v_school_ids)
    ),'[]'::jsonb),
    'roles',coalesce((
      select jsonb_agg(jsonb_build_object('role',x.role,'count',x.total) order by x.total desc,x.role)
      from (
        select coalesce(nullif(u.role,''),'Non renseigné') role,count(*) total
        from public.users u
        where u.school_id=any(v_school_ids) and lower(coalesce(u.status,'actif')) in ('active','actif')
        group by 1
      ) x
    ),'[]'::jsonb),
    'classLevels',coalesce((
      select jsonb_agg(jsonb_build_object('level',x.level,'count',x.total) order by x.total desc,x.level)
      from (
        select coalesce(nullif(c.level,''),'Non renseigné') level,count(*) total
        from public.classes c
        where c.school_id=any(v_school_ids) and lower(coalesce(c.status,'active')) in ('active','actif')
        group by 1
      ) x
    ),'[]'::jsonb),
    'recentActivity',coalesce((
      select jsonb_agg(jsonb_build_object(
        'action',a.action,'schoolName',a.school_name,'userRole',a.user_role,'createdAt',a.created_at
      ) order by a.created_at desc)
      from (
        select l.action,l.school_name,l.user_role,l.created_at
        from public.activity_logs l
        where l.school_id=any(v_school_ids)
        order by l.created_at desc limit 20
      ) a
    ),'[]'::jsonb)
  ) into v_result;

  perform private.log_government_access_secure(p_ministry,p_entity,'WORKSPACE_SNAPSHOT','statistics',null,jsonb_build_object('mappedSchools',cardinality(v_school_ids)));
  return v_result;
end $$;
revoke all on function private.government_workspace_snapshot_secure(text,text) from public,anon;
grant execute on function private.government_workspace_snapshot_secure(text,text) to authenticated;

create or replace function public.government_workspace_snapshot(p_ministry text,p_entity text)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.government_workspace_snapshot_secure(p_ministry,p_entity) $$;
revoke all on function public.government_workspace_snapshot(text,text) from public,anon;
grant execute on function public.government_workspace_snapshot(text,text) to authenticated;

create or replace function private.get_my_government_assignments_secure()
returns table(
  assignment_id uuid,organization_code text,ministry text,entity text,label text,
  role_code text,permissions text[],valid_from timestamptz,valid_until timestamptz
)
language sql
security definer
set search_path=''
stable
as $$
  select a.id,o.code,o.ministry,o.entity,o.label,a.role_code,a.permissions,a.valid_from,a.valid_until
  from public.government_assignments a
  join public.government_organizations o on o.id=a.organization_id
  where a.user_uid=(select auth.uid()) and a.active
    and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now())
  order by o.level,o.ministry,o.entity nulls first,a.role_code
$$;
revoke all on function private.get_my_government_assignments_secure() from public,anon;
grant execute on function private.get_my_government_assignments_secure() to authenticated;

create or replace function public.get_my_government_assignments()
returns table(
  assignment_id uuid,organization_code text,ministry text,entity text,label text,
  role_code text,permissions text[],valid_from timestamptz,valid_until timestamptz
)
language sql
security invoker
set search_path=''
stable
as $$ select * from private.get_my_government_assignments_secure() $$;
revoke all on function public.get_my_government_assignments() from public,anon;
grant execute on function public.get_my_government_assignments() to authenticated;

-- Minimize Data API privileges on administrative records.
revoke all on public.administrative_application_events from anon,authenticated;
grant select on public.administrative_application_events to authenticated;

revoke all on public.administrative_application_files from anon,authenticated;
grant select,insert,delete on public.administrative_application_files to authenticated;

revoke all on public.administrative_applications from anon,authenticated;
grant select,insert on public.administrative_applications to authenticated;

revoke all on public.administrative_official_documents from anon,authenticated;
grant select on public.administrative_official_documents to authenticated;

drop policy if exists "signers read own authorization" on public.administrative_authorized_signers;
create policy "signers read own authorization"
on public.administrative_authorized_signers for select to authenticated
using (user_uid=(select auth.uid()));

-- Foreign-key indexes reported by the production advisor.
create index if not exists administrative_application_events_target_uid_idx
on public.administrative_application_events(target_uid);
create index if not exists administrative_authorized_signers_created_by_idx
on public.administrative_authorized_signers(created_by);
create index if not exists administrative_authorized_signers_service_code_idx
on public.administrative_authorized_signers(service_code);
create index if not exists administrative_catalog_change_events_actor_uid_idx
on public.administrative_catalog_change_events(actor_uid);
create index if not exists administrative_catalog_change_requests_control_approved_by_idx
on public.administrative_catalog_change_requests(control_approved_by);
create index if not exists administrative_catalog_change_requests_created_by_idx
on public.administrative_catalog_change_requests(created_by);
create index if not exists administrative_catalog_change_requests_final_approved_by_idx
on public.administrative_catalog_change_requests(final_approved_by);
create index if not exists administrative_catalog_change_requests_rejected_by_idx
on public.administrative_catalog_change_requests(rejected_by);
create index if not exists administrative_government_account_events_actor_uid_idx
on public.administrative_government_account_events(actor_uid);
create index if not exists administrative_government_account_events_user_uid_idx
on public.administrative_government_account_events(user_uid);
create index if not exists administrative_government_accounts_created_by_idx
on public.administrative_government_accounts(created_by);
create index if not exists administrative_official_documents_signer_authorization_id_idx
on public.administrative_official_documents(signer_authorization_id);
create index if not exists administrative_signer_events_actor_uid_idx
on public.administrative_signer_events(actor_uid);
create index if not exists administrative_signer_events_signer_authorization_id_idx
on public.administrative_signer_events(signer_authorization_id);
