create table if not exists public.administrative_government_accounts (
  user_uid uuid primary key references auth.users(id) on delete cascade,
  ministry text not null check (ministry in ('ETAT','MEPSA','MES','METP','MFP')),
  government_role text not null,
  direction text,
  official_title text,
  active boolean not null default true,
  must_change_password boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (ministry='ETAT' and government_role='ETAT_ADMIN')
    or (ministry<>'ETAT' and government_role like ministry||'_%')
  )
);
alter table public.administrative_government_accounts enable row level security;
revoke all on public.administrative_government_accounts from anon,authenticated;

create table if not exists public.administrative_government_account_events (
  id uuid primary key default gen_random_uuid(),
  user_uid uuid references auth.users(id) on delete set null,
  ministry text not null,
  action text not null check (action in ('CREATE','BOOTSTRAP','DEACTIVATE','REACTIVATE','PASSWORD_CHANGED')),
  actor_uid uuid references auth.users(id),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.administrative_government_account_events enable row level security;
revoke all on public.administrative_government_account_events from anon,authenticated;

create index if not exists administrative_government_accounts_ministry_idx
on public.administrative_government_accounts(ministry,active,government_role);

create or replace function private.is_government_provisioner_secure(p_ministry text,p_target_role text default null)
returns boolean language plpgsql security definer set search_path='' stable
as $$
declare
  actor_role text;
  actor_ministry text;
  target_role text:=upper(trim(coalesce(p_target_role,'')));
  target_ministry text:=upper(trim(coalesce(p_ministry,'')));
begin
  if auth.uid() is null then return false; end if;
  select upper(replace(replace(trim(u.role),' ','_'),'-','_')),g.ministry
    into actor_role,actor_ministry
  from public.users u
  join public.administrative_government_accounts g on g.user_uid=auth.uid()
  where u.uid=auth.uid()::text and g.active
    and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
  limit 1;
  if actor_role is null then return false; end if;
  if actor_role='ETAT_ADMIN' then return target_ministry in ('ETAT','MEPSA','MES','METP','MFP'); end if;
  if actor_ministry<>target_ministry then return false; end if;
  if actor_role not in (
    target_ministry||'_MINISTRE',target_ministry||'_CABINET',target_ministry||'_SECRETAIRE_GENERAL',
    target_ministry||'_DG',target_ministry||'_DIRECTEUR_GENERAL'
  ) then return false; end if;
  if target_role='' then return true; end if;
  return target_role in (
    target_ministry||'_DIRECTEUR',target_ministry||'_CHEF_SERVICE',
    target_ministry||'_AGENT_INSTRUCTEUR',target_ministry||'_SIGNATAIRE_HABILITE',
    target_ministry||'_SIGNER_ADMIN',target_ministry||'_FINANCE'
  );
end $$;
revoke all on function private.is_government_provisioner_secure(text,text) from public,anon;
grant execute on function private.is_government_provisioner_secure(text,text) to authenticated;

create or replace function public.can_provision_government_account(p_ministry text,p_target_role text default null)
returns boolean language sql security invoker set search_path='' stable
as $$ select private.is_government_provisioner_secure(p_ministry,p_target_role) $$;
revoke all on function public.can_provision_government_account(text,text) from public,anon;
grant execute on function public.can_provision_government_account(text,text) to authenticated;

create or replace function private.list_government_accounts_secure(p_ministry text default null)
returns table(
  user_uid uuid,ministry text,government_role text,direction text,official_title text,
  active boolean,must_change_password boolean,created_at timestamptz,updated_at timestamptz,
  name text,email text,status text
)
language plpgsql security definer set search_path='' stable
as $$
declare m text:=upper(trim(coalesce(p_ministry,'')));
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if m='' then
    if not private.is_government_provisioner_secure('ETAT',null) then raise exception 'Accès non autorisé'; end if;
  elsif not private.is_government_provisioner_secure(m,null) then
    raise exception 'Accès non autorisé';
  end if;
  return query
  select g.user_uid,g.ministry,g.government_role,g.direction,g.official_title,
         g.active,g.must_change_password,g.created_at,g.updated_at,u.name,u.email,u.status
  from public.administrative_government_accounts g
  join public.users u on u.uid=g.user_uid::text
  where m='' or g.ministry=m
  order by g.active desc,g.ministry,g.government_role,u.name nulls last;
end $$;
revoke all on function private.list_government_accounts_secure(text) from public,anon;
grant execute on function private.list_government_accounts_secure(text) to authenticated;

create or replace function public.list_government_accounts(p_ministry text default null)
returns table(
  user_uid uuid,ministry text,government_role text,direction text,official_title text,
  active boolean,must_change_password boolean,created_at timestamptz,updated_at timestamptz,
  name text,email text,status text
)
language sql security invoker set search_path='' stable
as $$ select * from private.list_government_accounts_secure(p_ministry) $$;
revoke all on function public.list_government_accounts(text) from public,anon;
grant execute on function public.list_government_accounts(text) to authenticated;

create or replace function private.change_government_account_status_secure(p_user_uid uuid,p_active boolean)
returns public.administrative_government_accounts
language plpgsql security definer set search_path=''
as $$
declare g public.administrative_government_accounts; actor_role text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if p_user_uid=auth.uid() then raise exception 'Vous ne pouvez pas modifier votre propre statut'; end if;
  select * into g from public.administrative_government_accounts where user_uid=p_user_uid for update;
  if g.user_uid is null then raise exception 'Compte ministériel introuvable'; end if;
  if not private.is_government_provisioner_secure(g.ministry,g.government_role) then raise exception 'Accès non autorisé'; end if;
  select upper(replace(replace(trim(u.role),' ','_'),'-','_')) into actor_role
  from public.users u where u.uid=auth.uid()::text limit 1;
  if g.government_role='ETAT_ADMIN' and actor_role<>'ETAT_ADMIN' then raise exception 'Seul ETAT_ADMIN peut gérer un autre ETAT_ADMIN'; end if;
  update public.administrative_government_accounts set active=p_active,updated_at=now()
  where user_uid=p_user_uid returning * into g;
  update public.users set status=case when p_active then 'Actif' else 'Inactif' end where uid=p_user_uid::text;
  insert into public.administrative_government_account_events(user_uid,ministry,action,actor_uid,details)
  values(p_user_uid,g.ministry,case when p_active then 'REACTIVATE' else 'DEACTIVATE' end,auth.uid(),
    jsonb_build_object('government_role',g.government_role));
  return g;
end $$;
revoke all on function private.change_government_account_status_secure(uuid,boolean) from public,anon;
grant execute on function private.change_government_account_status_secure(uuid,boolean) to authenticated;

create or replace function public.change_government_account_status(p_user_uid uuid,p_active boolean)
returns public.administrative_government_accounts language sql security invoker set search_path=''
as $$ select private.change_government_account_status_secure(p_user_uid,p_active) $$;
revoke all on function public.change_government_account_status(uuid,boolean) from public,anon;
grant execute on function public.change_government_account_status(uuid,boolean) to authenticated;

create or replace function private.get_my_government_account_secure()
returns public.administrative_government_accounts language sql security definer set search_path='' stable
as $$ select g from public.administrative_government_accounts g where g.user_uid=auth.uid() limit 1 $$;
revoke all on function private.get_my_government_account_secure() from public,anon;
grant execute on function private.get_my_government_account_secure() to authenticated;

create or replace function public.get_my_government_account()
returns public.administrative_government_accounts language sql security invoker set search_path='' stable
as $$ select private.get_my_government_account_secure() $$;
revoke all on function public.get_my_government_account() from public,anon;
grant execute on function public.get_my_government_account() to authenticated;

create or replace function private.complete_government_password_setup_secure()
returns boolean language plpgsql security definer set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  update public.administrative_government_accounts set must_change_password=false,updated_at=now()
  where user_uid=auth.uid() and active;
  if not found then raise exception 'Compte ministériel actif introuvable'; end if;
  insert into public.administrative_government_account_events(user_uid,ministry,action,actor_uid)
  select g.user_uid,g.ministry,'PASSWORD_CHANGED',auth.uid()
  from public.administrative_government_accounts g where g.user_uid=auth.uid();
  return true;
end $$;
revoke all on function private.complete_government_password_setup_secure() from public,anon;
grant execute on function private.complete_government_password_setup_secure() to authenticated;

create or replace function public.complete_government_password_setup()
returns boolean language sql security invoker set search_path=''
as $$ select private.complete_government_password_setup_secure() $$;
revoke all on function public.complete_government_password_setup() from public,anon;
grant execute on function public.complete_government_password_setup() to authenticated;

create or replace function public.is_ministry_administrative_agent(p_ministry text)
returns boolean language sql stable set search_path='public'
as $$
 select exists(
   select 1 from public.users u
   join public.administrative_government_accounts g on g.user_uid=(select auth.uid())
   where u.uid=(select auth.uid())::text and g.active
     and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
     and (
       upper(regexp_replace(coalesce(u.role,''),'[^A-Za-z0-9]+','_','g'))='ETAT_ADMIN'
       or (g.ministry=upper(p_ministry)
         and upper(regexp_replace(coalesce(u.role,''),'[^A-Za-z0-9]+','_','g')) like upper(p_ministry)||'_%')
     )
 )
$$;

create or replace function private.is_ministry_signer_admin_secure(p_ministry text)
returns boolean language plpgsql security definer set search_path='' stable
as $$
declare r text; m text;
begin
  if auth.uid() is null or nullif(trim(p_ministry),'') is null then return false; end if;
  select upper(replace(replace(trim(u.role),' ','_'),'-','_')),g.ministry into r,m
  from public.users u join public.administrative_government_accounts g on g.user_uid=auth.uid()
  where u.uid=auth.uid()::text and g.active
    and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
  limit 1;
  if r is null then return false; end if;
  return r='ETAT_ADMIN' or (
    m=upper(p_ministry) and r in (
      upper(p_ministry)||'_CABINET',upper(p_ministry)||'_DG',
      upper(p_ministry)||'_DIRECTEUR_GENERAL',upper(p_ministry)||'_MINISTRE',
      upper(p_ministry)||'_SECRETAIRE_GENERAL',upper(p_ministry)||'_SIGNER_ADMIN'
    )
  );
end $$;
revoke all on function private.is_ministry_signer_admin_secure(text) from public,anon;
grant execute on function private.is_ministry_signer_admin_secure(text) to authenticated;

create or replace function private.list_administrative_signer_candidates_secure(p_ministry text)
returns table(user_uid uuid,user_name text,user_email text,user_role text)
language plpgsql security definer set search_path='' stable
as $$
begin
  if not private.is_ministry_signer_admin_secure(p_ministry) then raise exception 'Accès non autorisé'; end if;
  return query
  select u.uid::uuid,u.name,u.email,u.role
  from public.users u
  join public.administrative_government_accounts g on g.user_uid=u.uid::uuid
  where g.active and g.ministry=upper(trim(p_ministry))
    and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
    and upper(replace(replace(trim(u.role),' ','_'),'-','_')) in (
      upper(trim(p_ministry))||'_SIGNATAIRE_HABILITE',upper(trim(p_ministry))||'_MINISTRE',
      upper(trim(p_ministry))||'_SECRETAIRE_GENERAL',upper(trim(p_ministry))||'_DG',
      upper(trim(p_ministry))||'_DIRECTEUR_GENERAL'
    )
  order by u.name nulls last,u.email;
end $$;
