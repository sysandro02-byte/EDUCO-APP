-- Bind document signers to real government assignments and expose rollout readiness.

alter table public.administrative_authorized_signers
  add column if not exists organization_id uuid
  references public.government_organizations(id) on delete restrict;

create index if not exists administrative_authorized_signers_organization_idx
on public.administrative_authorized_signers(organization_id);

create or replace function private.resolve_signer_assignment_secure(
  p_user_uid uuid,
  p_ministry text,
  p_service_code text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
stable
as $$
declare
  v_ministry text:=upper(trim(coalesce(p_ministry,'')));
  v_direction text;
  v_org uuid;
begin
  if p_user_uid is null or v_ministry='' then return null; end if;

  if p_service_code is not null then
    select upper(nullif(trim(s.competent_direction),'')) into v_direction
    from public.administrative_services s
    where s.code=p_service_code and upper(s.ministry)=v_ministry;

    if not found then raise exception 'Démarche incompatible avec ce ministère'; end if;
  end if;

  select o.id into v_org
  from public.government_assignments a
  join public.government_organizations o on o.id=a.organization_id and o.active
  join public.users u on u.uid=a.user_uid::text
  where a.user_uid=p_user_uid
    and a.active
    and a.valid_from<=now()
    and (a.valid_until is null or a.valid_until>now())
    and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
    and ('*'=any(a.permissions) or 'documents.issue'=any(a.permissions))
    and (
      o.level='STATE'
      or (
        o.ministry=v_ministry
        and (
          o.level='MINISTRY'
          or (p_service_code is not null and v_direction is not null and o.entity=v_direction)
        )
      )
    )
  order by
    case o.level when 'ENTITY' then 1 when 'MINISTRY' then 2 when 'STATE' then 3 else 9 end,
    a.valid_from desc
  limit 1;

  return v_org;
end $$;
revoke all on function private.resolve_signer_assignment_secure(uuid,text,text) from public,anon,authenticated;

create or replace function private.signer_authorization_current_secure(
  p_signer_id uuid,
  p_service_code text
)
returns boolean
language sql
security definer
set search_path=''
stable
as $$
  select exists(
    select 1
    from public.administrative_authorized_signers s
    join public.government_organizations o on o.id=s.organization_id and o.active
    join public.government_assignments a
      on a.organization_id=o.id and a.user_uid=s.user_uid and a.active
    join public.users u on u.uid=s.user_uid::text
    join public.administrative_services sv
      on sv.code=p_service_code and upper(sv.ministry)=upper(s.ministry)
    where s.id=p_signer_id
      and s.active
      and s.valid_from<=now()
      and (s.valid_until is null or s.valid_until>now())
      and a.valid_from<=now()
      and (a.valid_until is null or a.valid_until>now())
      and ('*'=any(a.permissions) or 'documents.issue'=any(a.permissions))
      and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
      and (s.service_code is null or s.service_code=p_service_code)
      and (
        o.level='STATE'
        or (
          o.ministry=upper(s.ministry)
          and (
            o.level='MINISTRY'
            or o.entity=upper(nullif(trim(sv.competent_direction),''))
          )
        )
      )
  )
$$;
revoke all on function private.signer_authorization_current_secure(uuid,text) from public,anon;
grant execute on function private.signer_authorization_current_secure(uuid,text) to authenticated;

-- Backfill signer organization only where a valid current assignment exists.
update public.administrative_authorized_signers s
set organization_id=private.resolve_signer_assignment_secure(s.user_uid,s.ministry,s.service_code)
where s.organization_id is null
  and private.resolve_signer_assignment_secure(s.user_uid,s.ministry,s.service_code) is not null;

create or replace function private.list_administrative_signer_candidates_secure(p_ministry text)
returns table(user_uid uuid,user_name text,user_email text,user_role text)
language plpgsql
security definer
set search_path=''
stable
as $$
begin
  if not private.is_ministry_signer_admin_secure(p_ministry) then raise exception 'Accès non autorisé'; end if;
  return query
  select distinct u.uid::uuid,u.name,u.email,u.role
  from public.users u
  join public.government_assignments a on a.user_uid=u.uid::uuid and a.active
  join public.government_organizations o on o.id=a.organization_id and o.active
  where (o.level='STATE' or o.ministry=upper(trim(p_ministry)))
    and a.valid_from<=now()
    and (a.valid_until is null or a.valid_until>now())
    and ('*'=any(a.permissions) or 'documents.issue'=any(a.permissions))
    and lower(coalesce(u.status,'actif')) not in ('inactif','inactive','suspendu','suspended')
  order by u.name nulls last,u.email;
end $$;
revoke all on function private.list_administrative_signer_candidates_secure(text) from public,anon;
grant execute on function private.list_administrative_signer_candidates_secure(text) to authenticated;

create or replace function private.manage_administrative_signer_secure(
  p_action text,
  p_ministry text,
  p_signer_id uuid default null,
  p_user_uid uuid default null,
  p_service_code text default null,
  p_signer_name text default null,
  p_signer_title text default null,
  p_valid_until timestamptz default null
)
returns public.administrative_authorized_signers
language plpgsql
security definer
set search_path=''
as $$
declare
  a text:=upper(trim(p_action));
  m text:=upper(trim(p_ministry));
  s public.administrative_authorized_signers;
  v_org uuid;
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
    if p_valid_until is not null and p_valid_until<=now() then raise exception 'Date de fin invalide'; end if;

    v_org:=private.resolve_signer_assignment_secure(p_user_uid,m,p_service_code);
    if v_org is null then
      raise exception 'Aucune affectation active avec permission de signature ne correspond à cette démarche';
    end if;

    insert into public.administrative_authorized_signers(
      user_uid,ministry,service_code,signer_name,signer_title,active,valid_from,valid_until,created_by,organization_id
    ) values(
      p_user_uid,m,p_service_code,trim(p_signer_name),trim(p_signer_title),true,now(),p_valid_until,auth.uid(),v_org
    ) returning * into s;

  elsif a in ('UPDATE','DEACTIVATE','REACTIVATE') then
    select * into s
    from public.administrative_authorized_signers
    where id=p_signer_id and ministry=m
    for update;
    if s.id is null then raise exception 'Habilitation introuvable'; end if;

    if a='UPDATE' then
      if nullif(trim(p_signer_name),'') is null or nullif(trim(p_signer_title),'') is null then
        raise exception 'Nom et qualité requis';
      end if;
      if p_valid_until is not null and p_valid_until<=now() then raise exception 'Date de fin invalide'; end if;
      v_org:=private.resolve_signer_assignment_secure(s.user_uid,m,p_service_code);
      if v_org is null then raise exception 'Affectation de signature incompatible avec cette démarche'; end if;

      update public.administrative_authorized_signers
      set service_code=p_service_code,
          signer_name=trim(p_signer_name),
          signer_title=trim(p_signer_title),
          valid_until=p_valid_until,
          organization_id=v_org
      where id=s.id returning * into s;

    elsif a='DEACTIVATE' then
      update public.administrative_authorized_signers
      set active=false
      where id=s.id returning * into s;

    else
      if s.valid_until is not null and s.valid_until<=now() then
        raise exception 'Habilitation expirée : modifiez d’abord sa date de validité';
      end if;
      v_org:=private.resolve_signer_assignment_secure(s.user_uid,m,s.service_code);
      if v_org is null then raise exception 'Affectation de signature inactive ou hors périmètre'; end if;

      update public.administrative_authorized_signers
      set active=true,organization_id=v_org
      where id=s.id returning * into s;
    end if;
  else
    raise exception 'Action invalide';
  end if;

  insert into public.administrative_signer_events(
    signer_authorization_id,ministry,action,actor_uid,details
  ) values(
    s.id,m,a,auth.uid(),
    jsonb_build_object(
      'service_code',s.service_code,
      'user_uid',s.user_uid,
      'organization_id',s.organization_id,
      'active',s.active,
      'valid_until',s.valid_until
    )
  );

  return s;
end $$;
revoke all on function private.manage_administrative_signer_secure(text,text,uuid,uuid,text,text,text,timestamptz)
from public,anon;
grant execute on function private.manage_administrative_signer_secure(text,text,uuid,uuid,text,text,text,timestamptz)
to authenticated;

-- Ensure document reservation/finalization re-checks the active government assignment.
create or replace function private.reserve_administrative_document_secure(p_application_id uuid)
returns public.administrative_official_documents
language plpgsql
security definer
set search_path=''
as $$
declare
 a public.administrative_applications; s public.administrative_services;
 sg public.administrative_authorized_signers; d public.administrative_official_documents; n text;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into a from public.administrative_applications where id=p_application_id for update;
 if a.id is null or not public.is_ministry_administrative_agent(coalesce(a.assigned_ministry,a.ministry)) then raise exception 'Accès non autorisé'; end if;
 if a.status not in ('APPROVED','PAID') then raise exception 'Dossier non éligible à émission'; end if;
 if a.workflow_stage_code='SIGNATURE' and a.assigned_agent_uid is distinct from auth.uid() then raise exception 'Ce dossier est affecté à un autre signataire'; end if;

 select * into s from public.administrative_services where code=a.service_code;
 if s.code is null or s.publication_status<>'PUBLISHED' or s.legal_status<>'VERIFIED'
    or s.requirements_status<>'VERIFIED' then raise exception 'Démarche non publiable juridiquement'; end if;
 if s.payment_enabled and a.status<>'PAID' then raise exception 'Paiement officiel non confirmé'; end if;

 select * into sg
 from public.administrative_authorized_signers x
 where x.user_uid=auth.uid()
   and x.ministry=a.ministry
   and x.active
   and (x.service_code is null or x.service_code=a.service_code)
   and x.valid_from<=now()
   and (x.valid_until is null or x.valid_until>now())
   and private.signer_authorization_current_secure(x.id,a.service_code)
 order by (x.service_code is not null) desc,x.valid_from desc
 limit 1;
 if sg.id is null then raise exception 'Signataire non habilité ou affectation de signature inactive'; end if;

 select * into d from public.administrative_official_documents
 where application_id=a.id and issuance_state='RESERVED' and status='VALID'
 order by issued_at desc limit 1;
 if d.id is not null then
   if d.signer_authorization_id<>sg.id then raise exception 'Une réservation existe déjà pour un autre signataire'; end if;
   return d;
 end if;

 if exists(
   select 1 from public.administrative_official_documents x
   where x.application_id=a.id and x.issuance_state='FINAL' and x.status in ('VALID','SUSPENDED')
 ) then raise exception 'Un document officiel actif existe déjà pour ce dossier'; end if;

 n:=upper(a.ministry)||'-'||replace(a.service_code,'-','')||'-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.administrative_document_number_seq')::text,7,'0');
 insert into public.administrative_official_documents(
   application_id,owner_uid,document_number,document_type,ministry,signer_name,signer_title,
   signer_authorization_id,legal_reference,issuance_state
 ) values(
   a.id,a.applicant_uid,n,coalesce(s.output_document,s.name),a.ministry,sg.signer_name,sg.signer_title,
   sg.id,s.legal_reference,'RESERVED'
 ) returning * into d;

 insert into public.administrative_document_events(document_id,application_id,actor_uid,action,to_status,details)
 values(d.id,a.id,auth.uid(),'RESERVED','VALID',
   jsonb_build_object('document_number',d.document_number,'signer_authorization_id',sg.id,'organization_id',sg.organization_id));
 return d;
end $$;
revoke all on function private.reserve_administrative_document_secure(uuid) from public,anon;
grant execute on function private.reserve_administrative_document_secure(uuid) to authenticated;

create or replace function private.finalize_administrative_document_secure(
  p_document_id uuid,p_storage_path text,p_sha256 text
)
returns public.administrative_official_documents
language plpgsql
security definer
set search_path=''
as $$
declare
 d public.administrative_official_documents; a public.administrative_applications;
 sg public.administrative_authorized_signers;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into d from public.administrative_official_documents where id=p_document_id for update;
 if d.id is null or d.issuance_state<>'RESERVED' or d.status<>'VALID' then raise exception 'Réservation invalide'; end if;
 select * into a from public.administrative_applications where id=d.application_id for update;
 if a.id is null then raise exception 'Dossier introuvable'; end if;
 if a.workflow_stage_code='SIGNATURE' and a.assigned_agent_uid is distinct from auth.uid() then raise exception 'Le signataire affecté a changé'; end if;

 select * into sg
 from public.administrative_authorized_signers
 where id=d.signer_authorization_id
   and user_uid=auth.uid()
   and active
   and valid_from<=now()
   and (valid_until is null or valid_until>now())
   and private.signer_authorization_current_secure(id,a.service_code)
 for share;
 if sg.id is null then raise exception 'Habilitation ou affectation du signataire expirée/révoquée'; end if;

 if p_storage_path is null or p_sha256 !~ '^[0-9a-fA-F]{64}$' then raise exception 'PDF ou empreinte invalide'; end if;

 update public.administrative_official_documents
 set storage_path=p_storage_path,sha256=lower(p_sha256),issuance_state='FINAL'
 where id=d.id returning * into d;

 update public.administrative_applications set status='DOCUMENT_ISSUED',updated_at=now() where id=a.id;
 insert into public.administrative_application_events(application_id,action,from_status,to_status,note)
 values(a.id,'ISSUE_DOCUMENT',a.status,'DOCUMENT_ISSUED',d.document_number);
 insert into public.administrative_document_events(document_id,application_id,actor_uid,action,from_status,to_status,details)
 values(d.id,a.id,auth.uid(),'FINALIZED','RESERVED','FINAL',
   jsonb_build_object('sha256',lower(p_sha256),'storage_path',p_storage_path,'organization_id',sg.organization_id));
 return d;
end $$;
revoke all on function private.finalize_administrative_document_secure(uuid,text,text) from public,anon;
grant execute on function private.finalize_administrative_document_secure(uuid,text,text) to authenticated;

-- Operational rollout readiness, available only to ETAT_ADMIN or ministry account managers.
create or replace function private.government_rollout_readiness_secure(p_ministry text default null)
returns jsonb
language plpgsql
security definer
set search_path=''
stable
as $$
declare
  v_role text;
  v_ministry text:=upper(nullif(trim(coalesce(p_ministry,'')),''));
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select upper(regexp_replace(coalesce(u.role,''),'[^A-Za-z0-9]+','_','g'))
  into v_role
  from public.users u where u.uid=auth.uid()::text limit 1;

  if v_role='ETAT_ADMIN' then
    null;
  elsif v_ministry is null or not (
    v_role in (
      v_ministry||'_MINISTRE',
      v_ministry||'_CABINET',
      v_ministry||'_SECRETAIRE_GENERAL',
      v_ministry||'_DG',
      v_ministry||'_DIRECTEUR_GENERAL'
    )
  ) then
    raise exception 'Accès non autorisé';
  end if;

  select jsonb_build_object(
    'generatedAt',now(),
    'ministry',v_ministry,
    'summary',jsonb_build_object(
      'activeAssignments',(
        select count(*) from public.government_assignments a
        join public.government_organizations o on o.id=a.organization_id
        where a.active and (v_ministry is null or o.ministry=v_ministry)
          and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now())
      ),
      'activeJurisdictions',(
        select count(*) from public.government_school_jurisdictions j
        join public.government_organizations o on o.id=j.organization_id
        where j.active and (v_ministry is null or o.ministry=v_ministry)
          and j.valid_from<=now() and (j.valid_until is null or j.valid_until>now())
      ),
      'activeSigners',(
        select count(*) from public.administrative_authorized_signers s
        where s.active and (v_ministry is null or s.ministry=v_ministry)
          and s.valid_from<=now() and (s.valid_until is null or s.valid_until>now())
          and private.signer_authorization_current_secure(
            s.id,
            coalesce(s.service_code,(
              select sv.code from public.administrative_services sv
              where sv.ministry=s.ministry order by sv.code limit 1
            ))
          )
      ),
      'publishedServices',(
        select count(*) from public.administrative_services s
        where s.publication_status='PUBLISHED'
          and (v_ministry is null or s.ministry=v_ministry)
      ),
      'legalReviewServices',(
        select count(*) from public.administrative_services s
        where s.publication_status='LEGAL_REVIEW'
          and (v_ministry is null or s.ministry=v_ministry)
      ),
      'readyPaymentProviders',(
        select count(*) from public.administrative_payment_providers p
        where p.active and p.config_status='READY'
      )
    ),
    'organizations',coalesce((
      select jsonb_agg(jsonb_build_object(
        'code',o.code,'entity',o.entity,'label',o.label,'level',o.level,
        'activeAssignments',(
          select count(*) from public.government_assignments a
          where a.organization_id=o.id and a.active
            and a.valid_from<=now() and (a.valid_until is null or a.valid_until>now())
        ),
        'activeJurisdictions',(
          select count(*) from public.government_school_jurisdictions j
          where j.organization_id=o.id and j.active
            and j.valid_from<=now() and (j.valid_until is null or j.valid_until>now())
        ),
        'services',(
          select count(*) from public.administrative_services sv
          where sv.ministry=o.ministry
            and (o.level<>'ENTITY' or upper(coalesce(sv.competent_direction,''))=o.entity)
        )
      ) order by o.ministry,o.level,o.entity nulls first)
      from public.government_organizations o
      where o.active and (v_ministry is null or o.ministry=v_ministry)
    ),'[]'::jsonb)
  ) into v_result;

  return v_result;
end $$;
revoke all on function private.government_rollout_readiness_secure(text) from public,anon;
grant execute on function private.government_rollout_readiness_secure(text) to authenticated;

create or replace function public.government_rollout_readiness(p_ministry text default null)
returns jsonb
language sql
security invoker
set search_path=''
stable
as $$ select private.government_rollout_readiness_secure(p_ministry) $$;
revoke all on function public.government_rollout_readiness(text) from public,anon;
grant execute on function public.government_rollout_readiness(text) to authenticated;
