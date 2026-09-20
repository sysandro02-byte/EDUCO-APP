create table if not exists public.administrative_signer_events (
  id uuid primary key default gen_random_uuid(),
  signer_authorization_id uuid references public.administrative_authorized_signers(id) on delete set null,
  ministry text not null,
  action text not null check (action in ('CREATE','UPDATE','DEACTIVATE','REACTIVATE')),
  actor_uid uuid not null references auth.users(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.administrative_signer_events enable row level security;
revoke all on public.administrative_signer_events from anon, authenticated;

create unique index if not exists administrative_authorized_signers_one_active_scope
on public.administrative_authorized_signers(user_uid,ministry,coalesce(service_code,'*'))
where active;

create or replace function private.is_ministry_signer_admin_secure(p_ministry text)
returns boolean
language plpgsql
security definer
set search_path=''
stable
as $$
declare r text;
begin
  if auth.uid() is null or nullif(trim(p_ministry),'') is null then return false; end if;
  select upper(replace(replace(trim(u.role),' ','_'),'-','_')) into r
  from public.users u
  where u.uid=(auth.uid())::text
  limit 1;
  if r is null then return false; end if;
  return r='ETAT_ADMIN'
    or r=upper(p_ministry)||'_CABINET'
    or r=upper(p_ministry)||'_DG'
    or r=upper(p_ministry)||'_DIRECTEUR_GENERAL'
    or r=upper(p_ministry)||'_MINISTRE'
    or r=upper(p_ministry)||'_SECRETAIRE_GENERAL'
    or r=upper(p_ministry)||'_SIGNER_ADMIN';
end $$;
revoke all on function private.is_ministry_signer_admin_secure(text) from public,anon;
grant execute on function private.is_ministry_signer_admin_secure(text) to authenticated;

create or replace function private.list_administrative_signers_secure(p_ministry text)
returns table(
  id uuid,user_uid uuid,ministry text,service_code text,signer_name text,signer_title text,
  active boolean,valid_from timestamptz,valid_until timestamptz,created_at timestamptz,
  user_name text,user_email text,user_role text
)
language plpgsql security definer set search_path='' stable
as $$
begin
  if not private.is_ministry_signer_admin_secure(p_ministry) then raise exception 'Accès non autorisé'; end if;
  return query
  select s.id,s.user_uid,s.ministry,s.service_code,s.signer_name,s.signer_title,
         s.active,s.valid_from,s.valid_until,s.created_at,u.name,u.email,u.role
  from public.administrative_authorized_signers s
  left join public.users u on u.uid=s.user_uid::text
  where s.ministry=upper(trim(p_ministry))
  order by s.active desc,s.created_at desc;
end $$;
revoke all on function private.list_administrative_signers_secure(text) from public,anon;
grant execute on function private.list_administrative_signers_secure(text) to authenticated;

create or replace function public.list_administrative_signers(p_ministry text)
returns table(
  id uuid,user_uid uuid,ministry text,service_code text,signer_name text,signer_title text,
  active boolean,valid_from timestamptz,valid_until timestamptz,created_at timestamptz,
  user_name text,user_email text,user_role text
)
language sql security invoker set search_path='' stable
as $$ select * from private.list_administrative_signers_secure(p_ministry) $$;
revoke all on function public.list_administrative_signers(text) from public,anon;
grant execute on function public.list_administrative_signers(text) to authenticated;

create or replace function private.list_administrative_signer_candidates_secure(p_ministry text)
returns table(user_uid uuid,user_name text,user_email text,user_role text)
language plpgsql security definer set search_path='' stable
as $$
begin
  if not private.is_ministry_signer_admin_secure(p_ministry) then raise exception 'Accès non autorisé'; end if;
  return query
  select u.uid::uuid,u.name,u.email,u.role
  from public.users u
  where u.uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    and (
      upper(replace(replace(trim(u.role),' ','_'),'-','_')) like upper(trim(p_ministry))||'\_%' escape '\'
      or upper(replace(replace(trim(u.role),' ','_'),'-','_')) like 'ETAT\_%' escape '\'
    )
  order by u.name nulls last,u.email;
end $$;
revoke all on function private.list_administrative_signer_candidates_secure(text) from public,anon;
grant execute on function private.list_administrative_signer_candidates_secure(text) to authenticated;

create or replace function public.list_administrative_signer_candidates(p_ministry text)
returns table(user_uid uuid,user_name text,user_email text,user_role text)
language sql security invoker set search_path='' stable
as $$ select * from private.list_administrative_signer_candidates_secure(p_ministry) $$;
revoke all on function public.list_administrative_signer_candidates(text) from public,anon;
grant execute on function public.list_administrative_signer_candidates(text) to authenticated;

create or replace function private.manage_administrative_signer_secure(
  p_action text,p_ministry text,p_signer_id uuid default null,p_user_uid uuid default null,
  p_service_code text default null,p_signer_name text default null,p_signer_title text default null,
  p_valid_until timestamptz default null
)
returns public.administrative_authorized_signers
language plpgsql security definer set search_path=''
as $$
declare
  a text:=upper(trim(p_action));
  m text:=upper(trim(p_ministry));
  s public.administrative_authorized_signers;
  target_role text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if not private.is_ministry_signer_admin_secure(m) then raise exception 'Accès non autorisé'; end if;

  if p_service_code is not null and not exists(
    select 1 from public.administrative_services sv
    where sv.code=p_service_code and upper(sv.ministry)=m
  ) then raise exception 'Démarche incompatible avec ce ministère'; end if;

  if a='CREATE' then
    if p_user_uid is null or nullif(trim(p_signer_name),'') is null or nullif(trim(p_signer_title),'') is null then
      raise exception 'Utilisateur, nom et qualité requis';
    end if;
    select upper(replace(replace(trim(u.role),' ','_'),'-','_')) into target_role
    from public.users u where u.uid=p_user_uid::text limit 1;
    if target_role is null or not (target_role like m||'\_%' escape '\' or target_role like 'ETAT\_%' escape '\') then
      raise exception 'Le compte cible ne possède pas un rôle étatique compatible';
    end if;
    if p_valid_until is not null and p_valid_until<=now() then raise exception 'Date de fin invalide'; end if;

    insert into public.administrative_authorized_signers(
      user_uid,ministry,service_code,signer_name,signer_title,active,valid_from,valid_until,created_by
    ) values(
      p_user_uid,m,p_service_code,trim(p_signer_name),trim(p_signer_title),true,now(),p_valid_until,auth.uid()
    ) returning * into s;
  elsif a in ('UPDATE','DEACTIVATE','REACTIVATE') then
    select * into s from public.administrative_authorized_signers where id=p_signer_id and ministry=m for update;
    if s.id is null then raise exception 'Habilitation introuvable'; end if;

    if a='UPDATE' then
      if nullif(trim(p_signer_name),'') is null or nullif(trim(p_signer_title),'') is null then
        raise exception 'Nom et qualité requis';
      end if;
      if p_valid_until is not null and p_valid_until<=now() then raise exception 'Date de fin invalide'; end if;
      update public.administrative_authorized_signers
      set service_code=p_service_code,signer_name=trim(p_signer_name),
          signer_title=trim(p_signer_title),valid_until=p_valid_until
      where id=s.id returning * into s;
    elsif a='DEACTIVATE' then
      update public.administrative_authorized_signers set active=false where id=s.id returning * into s;
    else
      if s.valid_until is not null and s.valid_until<=now() then
        raise exception 'Habilitation expirée : modifiez d’abord sa date de validité';
      end if;
      update public.administrative_authorized_signers set active=true where id=s.id returning * into s;
    end if;
  else
    raise exception 'Action invalide';
  end if;

  insert into public.administrative_signer_events(
    signer_authorization_id,ministry,action,actor_uid,details
  ) values(
    s.id,m,a,auth.uid(),
    jsonb_build_object('service_code',s.service_code,'user_uid',s.user_uid,'active',s.active,'valid_until',s.valid_until)
  );
  return s;
end $$;
revoke all on function private.manage_administrative_signer_secure(text,text,uuid,uuid,text,text,text,timestamptz) from public,anon;
grant execute on function private.manage_administrative_signer_secure(text,text,uuid,uuid,text,text,text,timestamptz) to authenticated;

create or replace function public.manage_administrative_signer(
  p_action text,p_ministry text,p_signer_id uuid default null,p_user_uid uuid default null,
  p_service_code text default null,p_signer_name text default null,p_signer_title text default null,
  p_valid_until timestamptz default null
)
returns public.administrative_authorized_signers
language sql security invoker set search_path=''
as $$
 select private.manage_administrative_signer_secure(
   p_action,p_ministry,p_signer_id,p_user_uid,p_service_code,p_signer_name,p_signer_title,p_valid_until
 )
$$;
revoke all on function public.manage_administrative_signer(text,text,uuid,uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.manage_administrative_signer(text,text,uuid,uuid,text,text,text,timestamptz) to authenticated;

revoke insert,update,delete on public.administrative_authorized_signers from authenticated,anon;
