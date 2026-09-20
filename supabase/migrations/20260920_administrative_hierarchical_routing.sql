create table if not exists public.administrative_workflow_stages (
  service_code text not null references public.administrative_services(code) on delete cascade,
  stage_order integer not null check (stage_order between 1 and 20),
  stage_code text not null,
  label text not null,
  allowed_role_suffixes text[] not null,
  can_request_missing boolean not null default false,
  can_reject boolean not null default false,
  can_approve boolean not null default false,
  is_signature_stage boolean not null default false,
  primary key(service_code,stage_order),
  unique(service_code,stage_code)
);
alter table public.administrative_workflow_stages enable row level security;
revoke all on public.administrative_workflow_stages from anon,authenticated;

insert into public.administrative_workflow_stages(
  service_code,stage_order,stage_code,label,allowed_role_suffixes,
  can_request_missing,can_reject,can_approve,is_signature_stage
)
select s.code,v.stage_order,v.stage_code,v.label,v.allowed_role_suffixes,
       v.can_request_missing,v.can_reject,v.can_approve,v.is_signature_stage
from public.administrative_services s
cross join (values
  (1,'INSTRUCTION','Instruction',array['AGENT_INSTRUCTEUR']::text[],true,false,false,false),
  (2,'SERVICE_REVIEW','Validation chef de service',array['CHEF_SERVICE']::text[],true,false,false,false),
  (3,'DIRECTION_REVIEW','Validation direction',array['DIRECTEUR']::text[],true,true,false,false),
  (4,'DG_REVIEW','Validation direction générale',array['DG','DIRECTEUR_GENERAL']::text[],true,true,false,false),
  (5,'CABINET_REVIEW','Validation cabinet',array['CABINET','MINISTRE','SECRETAIRE_GENERAL']::text[],true,true,true,false),
  (6,'SIGNATURE','Signature / délivrance',array['SIGNATAIRE_HABILITE','MINISTRE','SECRETAIRE_GENERAL','DG','DIRECTEUR_GENERAL']::text[],false,false,false,true)
) as v(stage_order,stage_code,label,allowed_role_suffixes,can_request_missing,can_reject,can_approve,is_signature_stage)
on conflict(service_code,stage_order) do nothing;

alter table public.administrative_applications
  add column if not exists workflow_stage_order integer,
  add column if not exists workflow_stage_code text;

alter table public.administrative_application_events
  add column if not exists from_stage text,
  add column if not exists to_stage text,
  add column if not exists target_uid uuid references auth.users(id);

create index if not exists administrative_applications_workflow_stage_idx
on public.administrative_applications(ministry,status,workflow_stage_order);

create or replace function private.is_ministry_administrative_agent_secure(p_ministry text)
returns boolean language sql security definer set search_path='' stable
as $$
 select exists(
   select 1
   from public.users u
   join public.administrative_government_accounts g on g.user_uid=auth.uid()
   where u.uid=auth.uid()::text
     and g.active
     and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
     and (
       upper(regexp_replace(coalesce(u.role,''),'[^A-Za-z0-9]+','_','g'))='ETAT_ADMIN'
       or (
         g.ministry=upper(trim(p_ministry))
         and upper(regexp_replace(coalesce(u.role,''),'[^A-Za-z0-9]+','_','g')) like upper(trim(p_ministry))||'_%'
       )
     )
 )
$$;
revoke all on function private.is_ministry_administrative_agent_secure(text) from public,anon;
grant execute on function private.is_ministry_administrative_agent_secure(text) to authenticated;

create or replace function public.is_ministry_administrative_agent(p_ministry text)
returns boolean language sql security invoker set search_path='' stable
as $$ select private.is_ministry_administrative_agent_secure(p_ministry) $$;
revoke all on function public.is_ministry_administrative_agent(text) from public,anon;
grant execute on function public.is_ministry_administrative_agent(text) to authenticated;

create or replace function private.role_matches_stage_secure(p_ministry text,p_role text,p_suffixes text[])
returns boolean language sql security definer set search_path='' stable
as $$
 select exists(
   select 1 from unnest(p_suffixes) s
   where upper(replace(replace(trim(p_role),' ','_'),'-','_'))=upper(trim(p_ministry))||'_'||upper(s)
 )
$$;
revoke all on function private.role_matches_stage_secure(text,text,text[]) from public,anon;
grant execute on function private.role_matches_stage_secure(text,text,text[]) to authenticated;

create or replace function private.is_ministry_workflow_supervisor_secure(p_ministry text)
returns boolean language plpgsql security definer set search_path='' stable
as $$
declare r text; m text;
begin
  if auth.uid() is null then return false; end if;
  select upper(replace(replace(trim(u.role),' ','_'),'-','_')),g.ministry into r,m
  from public.users u
  join public.administrative_government_accounts g on g.user_uid=auth.uid()
  where u.uid=auth.uid()::text and g.active
    and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
  limit 1;
  if r is null or m<>upper(trim(p_ministry)) then return false; end if;
  return r in (
    m||'_CHEF_SERVICE',m||'_DIRECTEUR',m||'_DG',m||'_DIRECTEUR_GENERAL',
    m||'_CABINET',m||'_MINISTRE',m||'_SECRETAIRE_GENERAL'
  );
end $$;
revoke all on function private.is_ministry_workflow_supervisor_secure(text) from public,anon;
grant execute on function private.is_ministry_workflow_supervisor_secure(text) to authenticated;

create or replace function private.validate_routing_target_secure(
  p_application public.administrative_applications,
  p_target_uid uuid,
  p_stage_order integer
)
returns public.administrative_government_accounts
language plpgsql security definer set search_path='' stable
as $$
declare
  g public.administrative_government_accounts;
  u public.users;
  st public.administrative_workflow_stages;
begin
  if p_target_uid is null then raise exception 'Destinataire requis'; end if;
  select * into st from public.administrative_workflow_stages
  where service_code=p_application.service_code and stage_order=p_stage_order;
  if st.service_code is null then raise exception 'Étape de workflow introuvable'; end if;

  select * into g from public.administrative_government_accounts
  where user_uid=p_target_uid and active and ministry=upper(p_application.ministry) limit 1;
  if g.user_uid is null then raise exception 'Destinataire ministériel invalide'; end if;

  select * into u from public.users where uid=p_target_uid::text limit 1;
  if u.uid is null or lower(coalesce(u.status,'actif')) in ('inactif','inactive','suspendu','suspended') then
    raise exception 'Compte destinataire inactif';
  end if;

  if not private.role_matches_stage_secure(p_application.ministry,u.role,st.allowed_role_suffixes) then
    raise exception 'Le rôle du destinataire ne correspond pas à l’étape %',st.stage_code;
  end if;
  return g;
end $$;
revoke all on function private.validate_routing_target_secure(public.administrative_applications,uuid,integer) from public,anon;
grant execute on function private.validate_routing_target_secure(public.administrative_applications,uuid,integer) to authenticated;

create or replace function private.route_administrative_application_secure(
  p_id uuid,p_action text,p_target_uid uuid default null,p_note text default null
)
returns public.administrative_applications
language plpgsql security definer set search_path=''
as $$
declare
  v public.administrative_applications;
  svc public.administrative_services;
  current_stage public.administrative_workflow_stages;
  target_stage public.administrative_workflow_stages;
  target_account public.administrative_government_accounts;
  actor_role text;
  act text:=upper(trim(p_action));
  old_status text;
  old_stage text;
  next_status text;
  next_stage_order integer;
  next_stage_code text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into v from public.administrative_applications where id=p_id for update;
  if v.id is null then raise exception 'Dossier introuvable'; end if;
  if not public.is_ministry_administrative_agent(coalesce(v.assigned_ministry,v.ministry)) then raise exception 'Accès non autorisé'; end if;

  select u.role into actor_role
  from public.users u
  join public.administrative_government_accounts g on g.user_uid=auth.uid() and g.active
  where u.uid=auth.uid()::text limit 1;
  if actor_role is null then raise exception 'Compte ministériel actif requis'; end if;

  old_status:=v.status;
  old_stage:=v.workflow_stage_code;
  if v.workflow_stage_order is not null then
    select * into current_stage from public.administrative_workflow_stages
    where service_code=v.service_code and stage_order=v.workflow_stage_order;
  end if;

  if act='CLAIM' then
    if old_status<>'SUBMITTED' then raise exception 'Transition interdite: % -> CLAIM',old_status; end if;
    select * into target_stage from public.administrative_workflow_stages where service_code=v.service_code and stage_order=1;
    if not private.role_matches_stage_secure(v.ministry,actor_role,target_stage.allowed_role_suffixes) then
      raise exception 'Seul un agent instructeur peut prendre directement ce dossier';
    end if;
    next_status:='UNDER_REVIEW'; next_stage_order:=1; next_stage_code:=target_stage.stage_code; p_target_uid:=auth.uid();
    select * into target_account from public.administrative_government_accounts where user_uid=auth.uid();

  elsif act='ASSIGN' then
    if old_status<>'SUBMITTED' then raise exception 'Transition interdite: % -> ASSIGN',old_status; end if;
    if not private.is_ministry_workflow_supervisor_secure(v.ministry) then raise exception 'Seule une autorité de supervision peut affecter un dossier'; end if;
    next_stage_order:=1;
    select * into target_stage from public.administrative_workflow_stages where service_code=v.service_code and stage_order=next_stage_order;
    target_account:=private.validate_routing_target_secure(v,p_target_uid,next_stage_order);
    next_status:='UNDER_REVIEW'; next_stage_code:=target_stage.stage_code;

  elsif act in ('FORWARD','RETURN','REQUEST_MISSING','REJECT','APPROVE') then
    if old_status<>'UNDER_REVIEW' then raise exception 'Transition interdite depuis %',old_status; end if;
    if v.assigned_agent_uid is distinct from auth.uid() then raise exception 'Seul l’agent actuellement responsable peut effectuer cette action'; end if;
    if current_stage.service_code is null then raise exception 'Étape courante invalide'; end if;
    if not private.role_matches_stage_secure(v.ministry,actor_role,current_stage.allowed_role_suffixes) then
      raise exception 'Votre rôle ne correspond pas à l’étape courante %',current_stage.stage_code;
    end if;

    if act='FORWARD' then
      next_stage_order:=v.workflow_stage_order+1;
      select * into target_stage from public.administrative_workflow_stages where service_code=v.service_code and stage_order=next_stage_order;
      if target_stage.service_code is null or target_stage.is_signature_stage then raise exception 'Utilisez APPROVE pour transmettre à la signature'; end if;
      target_account:=private.validate_routing_target_secure(v,p_target_uid,next_stage_order);
      next_status:='UNDER_REVIEW'; next_stage_code:=target_stage.stage_code;

    elsif act='RETURN' then
      if v.workflow_stage_order<=1 then raise exception 'Aucune étape précédente'; end if;
      next_stage_order:=v.workflow_stage_order-1;
      select * into target_stage from public.administrative_workflow_stages where service_code=v.service_code and stage_order=next_stage_order;
      target_account:=private.validate_routing_target_secure(v,p_target_uid,next_stage_order);
      next_status:='UNDER_REVIEW'; next_stage_code:=target_stage.stage_code;

    elsif act='REQUEST_MISSING' then
      if not current_stage.can_request_missing then raise exception 'Action non autorisée à cette étape'; end if;
      if nullif(trim(p_note),'') is null then raise exception 'Une note est requise'; end if;
      next_status:='MISSING_DOCUMENTS'; next_stage_order:=v.workflow_stage_order; next_stage_code:=v.workflow_stage_code;
      p_target_uid:=v.assigned_agent_uid;
      select * into target_account from public.administrative_government_accounts where user_uid=v.assigned_agent_uid;

    elsif act='REJECT' then
      if not current_stage.can_reject then raise exception 'Le rejet définitif n’est pas autorisé à cette étape'; end if;
      if nullif(trim(p_note),'') is null then raise exception 'Un motif de rejet est requis'; end if;
      next_status:='REJECTED'; next_stage_order:=v.workflow_stage_order; next_stage_code:=v.workflow_stage_code;
      p_target_uid:=v.assigned_agent_uid;
      select * into target_account from public.administrative_government_accounts where user_uid=v.assigned_agent_uid;

    elsif act='APPROVE' then
      if not current_stage.can_approve then raise exception 'La décision finale n’est pas autorisée à cette étape'; end if;
      if p_target_uid is null then raise exception 'Un signataire cible est requis'; end if;
      next_stage_order:=v.workflow_stage_order+1;
      select * into target_stage from public.administrative_workflow_stages where service_code=v.service_code and stage_order=next_stage_order;
      if target_stage.service_code is null or not target_stage.is_signature_stage then raise exception 'Étape de signature introuvable'; end if;
      target_account:=private.validate_routing_target_secure(v,p_target_uid,next_stage_order);
      select * into svc from public.administrative_services where code=v.service_code;
      if svc.code is null then raise exception 'Démarche introuvable'; end if;
      next_status:='APPROVED';
      if svc.payment_enabled then
        if svc.fee_status<>'VERIFIED_CURRENT' or svc.fee_amount is null or svc.publication_status<>'PUBLISHED' then raise exception 'Paiement bloqué: tarif officiel non vérifié'; end if;
        next_status:='PAYMENT_DUE';
      end if;
      next_stage_code:=target_stage.stage_code;
    end if;
  else
    raise exception 'Action non prise en charge';
  end if;

  update public.administrative_applications
  set status=next_status,
      assigned_ministry=coalesce(assigned_ministry,ministry),
      assigned_direction=coalesce(target_account.direction,target_account.official_title,target_account.government_role),
      assigned_agent_uid=p_target_uid,
      workflow_stage_order=next_stage_order,
      workflow_stage_code=next_stage_code,
      review_note=case when act='REQUEST_MISSING' then p_note else review_note end,
      decision_note=case when act in ('APPROVE','REJECT') then p_note else decision_note end,
      reviewed_at=case when act in ('APPROVE','REJECT') then now() else reviewed_at end,
      payment_amount=case when next_status='PAYMENT_DUE' then svc.fee_amount else payment_amount end,
      payment_currency=case when next_status='PAYMENT_DUE' then svc.fee_currency else payment_currency end,
      updated_at=now()
  where id=p_id returning * into v;

  insert into public.administrative_application_events(
    application_id,action,from_status,to_status,note,from_stage,to_stage,target_uid
  ) values(p_id,act,old_status,next_status,p_note,old_stage,next_stage_code,p_target_uid);

  return v;
end $$;
revoke all on function private.route_administrative_application_secure(uuid,text,uuid,text) from public,anon;
grant execute on function private.route_administrative_application_secure(uuid,text,uuid,text) to authenticated;

create or replace function public.route_administrative_application(
  p_id uuid,p_action text,p_target_uid uuid default null,p_note text default null
)
returns public.administrative_applications
language sql security invoker set search_path=''
as $$ select private.route_administrative_application_secure(p_id,p_action,p_target_uid,p_note) $$;
revoke all on function public.route_administrative_application(uuid,text,uuid,text) from public,anon;
grant execute on function public.route_administrative_application(uuid,text,uuid,text) to authenticated;

create or replace function private.list_administrative_routing_candidates_secure(
  p_application_id uuid,p_target_stage_order integer default null
)
returns table(
  user_uid uuid,name text,email text,government_role text,direction text,official_title text,
  stage_order integer,stage_code text,stage_label text
)
language plpgsql security definer set search_path='' stable
as $$
declare a public.administrative_applications; ord integer; st public.administrative_workflow_stages;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into a from public.administrative_applications where id=p_application_id;
  if a.id is null then raise exception 'Dossier introuvable'; end if;
  if not public.is_ministry_administrative_agent(a.ministry) then raise exception 'Accès non autorisé'; end if;

  ord:=coalesce(p_target_stage_order,case when a.workflow_stage_order is null then 1 else a.workflow_stage_order+1 end);
  select * into st from public.administrative_workflow_stages where service_code=a.service_code and stage_order=ord;
  if st.service_code is null then raise exception 'Étape cible introuvable'; end if;

  return query
  select g.user_uid,u.name,u.email,g.government_role,g.direction,g.official_title,
         st.stage_order,st.stage_code,st.label
  from public.administrative_government_accounts g
  join public.users u on u.uid=g.user_uid::text
  where g.ministry=upper(a.ministry)
    and g.active
    and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
    and private.role_matches_stage_secure(a.ministry,u.role,st.allowed_role_suffixes)
  order by u.name nulls last,u.email;
end $$;
revoke all on function private.list_administrative_routing_candidates_secure(uuid,integer) from public,anon;
grant execute on function private.list_administrative_routing_candidates_secure(uuid,integer) to authenticated;

create or replace function public.list_administrative_routing_candidates(
  p_application_id uuid,p_target_stage_order integer default null
)
returns table(
  user_uid uuid,name text,email text,government_role text,direction text,official_title text,
  stage_order integer,stage_code text,stage_label text
)
language sql security invoker set search_path='' stable
as $$ select * from private.list_administrative_routing_candidates_secure(p_application_id,p_target_stage_order) $$;
revoke all on function public.list_administrative_routing_candidates(uuid,integer) from public,anon;
grant execute on function public.list_administrative_routing_candidates(uuid,integer) to authenticated;

create or replace function private.resubmit_administrative_application_secure(p_id uuid)
returns public.administrative_applications
language plpgsql security definer set search_path=''
as $$
declare a public.administrative_applications; old_status text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into a from public.administrative_applications where id=p_id for update;
  if a.id is null then raise exception 'Dossier introuvable'; end if;
  if a.applicant_uid<>auth.uid() then raise exception 'Accès non autorisé'; end if;
  if a.status<>'MISSING_DOCUMENTS' then raise exception 'Le dossier n’attend pas de complément'; end if;
  old_status:=a.status;
  update public.administrative_applications
  set status='UNDER_REVIEW',submitted_at=now(),review_note=null,updated_at=now()
  where id=p_id returning * into a;
  insert into public.administrative_application_events(
    application_id,action,from_status,to_status,note,from_stage,to_stage,target_uid
  ) values(
    p_id,'RESUBMIT',old_status,'UNDER_REVIEW','Compléments transmis par le demandeur',
    a.workflow_stage_code,a.workflow_stage_code,a.assigned_agent_uid
  );
  return a;
end $$;
revoke all on function private.resubmit_administrative_application_secure(uuid) from public,anon;
grant execute on function private.resubmit_administrative_application_secure(uuid) to authenticated;

create or replace function public.resubmit_administrative_application(p_id uuid)
returns public.administrative_applications
language sql security invoker set search_path=''
as $$ select private.resubmit_administrative_application_secure(p_id) $$;
revoke all on function public.resubmit_administrative_application(uuid) from public,anon;
grant execute on function public.resubmit_administrative_application(uuid) to authenticated;

create or replace function private.process_administrative_application_secure(
  p_id uuid,p_action text,p_note text default null,p_direction text default null
)
returns public.administrative_applications
language plpgsql security definer set search_path=''
as $$
declare act text:=upper(trim(p_action));
begin
  if act='ASSIGN' then
    return private.route_administrative_application_secure(p_id,'CLAIM',null,p_note);
  elsif act in ('REQUEST_MISSING','REJECT') then
    return private.route_administrative_application_secure(p_id,act,null,p_note);
  else
    raise exception 'Cette action nécessite le nouveau routage hiérarchique sécurisé';
  end if;
end $$;
