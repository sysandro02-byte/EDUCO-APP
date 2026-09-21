-- Synchronize ministry accounts with normalized assignments and expose controlled jurisdiction management.

create index if not exists government_assignments_created_by_idx on public.government_assignments(created_by);
create index if not exists government_assignments_source_request_id_idx on public.government_assignments(source_request_id);
create index if not exists government_organizations_parent_id_idx on public.government_organizations(parent_id);
create index if not exists government_school_jurisdictions_created_by_idx on public.government_school_jurisdictions(created_by);

create or replace function private.sync_government_account_assignment()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org uuid;
  v_entity text:=upper(regexp_replace(coalesce(new.direction,''),'[^A-Za-z0-9]+','_','g'));
begin
  if new.ministry='ETAT' then
    select id into v_org from public.government_organizations where code='ETAT' and active limit 1;
  elsif v_entity<>'' then
    select id into v_org from public.government_organizations
    where ministry=new.ministry and entity=v_entity and active limit 1;
  end if;

  if v_org is null then
    select id into v_org from public.government_organizations
    where ministry=new.ministry and entity is null and active limit 1;
  end if;

  if v_org is null then
    raise exception 'Organisation gouvernementale introuvable pour % / %',new.ministry,new.direction;
  end if;

  update public.government_assignments
  set active=false,updated_at=now()
  where user_uid=new.user_uid
    and (organization_id<>v_org or role_code<>new.government_role);

  insert into public.government_assignments(
    user_uid,organization_id,role_code,permissions,active,valid_from,source,created_by
  ) values(
    new.user_uid,v_org,new.government_role,
    private.government_default_permissions(new.government_role,nullif(v_entity,'')),
    new.active,coalesce(new.created_at,now()),'GOVERNMENT_ACCOUNT',new.created_by
  )
  on conflict(user_uid,organization_id,role_code) do update set
    permissions=excluded.permissions,
    active=excluded.active,
    updated_at=now();

  return new;
end $$;
revoke all on function private.sync_government_account_assignment() from public,anon,authenticated;

drop trigger if exists sync_government_account_assignment_trg on public.administrative_government_accounts;
create trigger sync_government_account_assignment_trg
after insert or update of ministry,government_role,direction,active
on public.administrative_government_accounts
for each row execute function private.sync_government_account_assignment();

-- Re-run sync for any existing accounts.
update public.administrative_government_accounts
set updated_at=updated_at;

create or replace function private.manage_government_jurisdiction_secure(
  p_ministry text,p_entity text,p_school_id integer,p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_org public.government_organizations;
  v_school public.schools;
  v_row public.government_school_jurisdictions;
begin
  if not private.government_actor_has_capability_secure(p_ministry,p_entity,'jurisdictions.manage') then
    raise exception 'Gestion du périmètre non autorisée';
  end if;

  select * into v_org
  from public.government_organizations
  where ministry=upper(regexp_replace(coalesce(p_ministry,''),'[^A-Za-z0-9]+','_','g'))
    and entity=upper(regexp_replace(coalesce(p_entity,''),'[^A-Za-z0-9]+','_','g'))
    and active
  limit 1;
  if v_org.id is null then raise exception 'Entité gouvernementale introuvable'; end if;

  select * into v_school from public.schools where id=p_school_id;
  if v_school.id is null then raise exception 'Établissement introuvable'; end if;

  insert into public.government_school_jurisdictions(
    school_id,organization_id,active,source,created_by
  ) values(p_school_id,v_org.id,p_active,'MANUAL_ASSIGNMENT',(select auth.uid()))
  on conflict(school_id,organization_id) do update set
    active=excluded.active,
    valid_from=case when excluded.active and not public.government_school_jurisdictions.active then now() else public.government_school_jurisdictions.valid_from end,
    valid_until=case when excluded.active then null else now() end,
    source='MANUAL_ASSIGNMENT',
    updated_at=now()
  returning * into v_row;

  perform private.log_government_access_secure(
    p_ministry,p_entity,
    case when p_active then 'JURISDICTION_ATTACH' else 'JURISDICTION_DETACH' end,
    'school',p_school_id::text,
    jsonb_build_object('schoolName',v_school.name)
  );

  return jsonb_build_object(
    'id',v_row.id,'schoolId',v_row.school_id,'active',v_row.active,
    'schoolName',v_school.name,'schoolIdentifier',v_school.identifier
  );
end $$;
revoke all on function private.manage_government_jurisdiction_secure(text,text,integer,boolean) from public,anon;
grant execute on function private.manage_government_jurisdiction_secure(text,text,integer,boolean) to authenticated;

create or replace function public.manage_government_jurisdiction(
  p_ministry text,p_entity text,p_school_id integer,p_active boolean
)
returns jsonb
language sql
security invoker
set search_path=''
as $$ select private.manage_government_jurisdiction_secure(p_ministry,p_entity,p_school_id,p_active) $$;
revoke all on function public.manage_government_jurisdiction(text,text,integer,boolean) from public,anon;
grant execute on function public.manage_government_jurisdiction(text,text,integer,boolean) to authenticated;

create or replace function private.list_government_jurisdictions_secure(
  p_ministry text,p_entity text
)
returns table(
  jurisdiction_id uuid,school_id integer,school_name text,school_identifier text,
  school_status text,active boolean,source text,valid_from timestamptz,valid_until timestamptz
)
language plpgsql
security definer
set search_path=''
stable
as $$
begin
  if not (
    private.government_actor_has_capability_secure(p_ministry,p_entity,'workspace.read')
    or private.government_actor_has_capability_secure(p_ministry,p_entity,'jurisdictions.manage')
  ) then raise exception 'Accès institutionnel non autorisé'; end if;

  return query
  select j.id,s.id,s.name,s.identifier,s.status,j.active,j.source,j.valid_from,j.valid_until
  from public.government_school_jurisdictions j
  join public.government_organizations o on o.id=j.organization_id
  join public.schools s on s.id=j.school_id
  where o.ministry=upper(regexp_replace(coalesce(p_ministry,''),'[^A-Za-z0-9]+','_','g'))
    and o.entity=upper(regexp_replace(coalesce(p_entity,''),'[^A-Za-z0-9]+','_','g'))
  order by j.active desc,s.name;
end $$;
revoke all on function private.list_government_jurisdictions_secure(text,text) from public,anon;
grant execute on function private.list_government_jurisdictions_secure(text,text) to authenticated;

create or replace function public.list_government_jurisdictions(p_ministry text,p_entity text)
returns table(
  jurisdiction_id uuid,school_id integer,school_name text,school_identifier text,
  school_status text,active boolean,source text,valid_from timestamptz,valid_until timestamptz
)
language sql
security invoker
set search_path=''
stable
as $$ select * from private.list_government_jurisdictions_secure(p_ministry,p_entity) $$;
revoke all on function public.list_government_jurisdictions(text,text) from public,anon;
grant execute on function public.list_government_jurisdictions(text,text) to authenticated;

create or replace function private.list_jurisdiction_candidate_schools_secure(
  p_ministry text,p_entity text,p_search text default null
)
returns table(id integer,name text,identifier text,status text,ownership_type text)
language plpgsql
security definer
set search_path=''
stable
as $$
begin
  if not private.government_actor_has_capability_secure(p_ministry,p_entity,'jurisdictions.manage') then
    raise exception 'Gestion du périmètre non autorisée';
  end if;
  return query
  select s.id,s.name,s.identifier,s.status,s.ownership_type
  from public.schools s
  where nullif(trim(coalesce(p_search,'')),'') is null
     or s.name ilike '%'||trim(p_search)||'%'
     or coalesce(s.identifier,'') ilike '%'||trim(p_search)||'%'
  order by s.name
  limit 100;
end $$;
revoke all on function private.list_jurisdiction_candidate_schools_secure(text,text,text) from public,anon;
grant execute on function private.list_jurisdiction_candidate_schools_secure(text,text,text) to authenticated;

create or replace function public.list_jurisdiction_candidate_schools(
  p_ministry text,p_entity text,p_search text default null
)
returns table(id integer,name text,identifier text,status text,ownership_type text)
language sql
security invoker
set search_path=''
stable
as $$ select * from private.list_jurisdiction_candidate_schools_secure(p_ministry,p_entity,p_search) $$;
revoke all on function public.list_jurisdiction_candidate_schools(text,text,text) from public,anon;
grant execute on function public.list_jurisdiction_candidate_schools(text,text,text) to authenticated;
