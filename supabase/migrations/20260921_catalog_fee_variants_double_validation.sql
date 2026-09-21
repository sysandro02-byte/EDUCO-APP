
-- Make variable fee schedules part of the same three-person catalog validation workflow.

alter table public.administrative_catalog_change_requests
  add column if not exists proposed_fee_variants jsonb not null default '[]'::jsonb;

create or replace function private.catalog_service_snapshot_secure(p_service_code text)
returns jsonb
language sql
security definer
set search_path=''
stable
as $$
 select jsonb_build_object(
   'service',to_jsonb(s),
   'form_fields',coalesce((
     select jsonb_agg(to_jsonb(f) order by f.sort_order,f.field_key)
     from public.administrative_service_form_fields f
     where f.service_code=s.code
   ),'[]'::jsonb),
   'required_documents',coalesce((
     select jsonb_agg(to_jsonb(d) order by d.sort_order,d.document_code)
     from public.administrative_service_required_documents d
     where d.service_code=s.code
   ),'[]'::jsonb),
   'fee_variants',coalesce((
     select jsonb_agg(to_jsonb(v) order by v.variant_code)
     from public.administrative_service_fee_variants v
     where v.service_code=s.code
   ),'[]'::jsonb)
 )
 from public.administrative_services s
 where s.code=p_service_code
 limit 1
$$;
revoke all on function private.catalog_service_snapshot_secure(text) from public,anon;
grant execute on function private.catalog_service_snapshot_secure(text) to authenticated;

create or replace function private.validate_catalog_fee_variants_secure(
  p_service_code text,
  p_service jsonb,
  p_variants jsonb
)
returns boolean
language plpgsql
security definer
set search_path=''
stable
as $$
declare
  fee_mode text:=upper(coalesce(p_service->>'fee_mode','UNVERIFIED'));
  fee_status text:=upper(coalesce(p_service->>'fee_status','TO_VERIFY'));
  duplicate_count integer;
  current_count integer;
begin
  if jsonb_typeof(p_variants)<>'array' then
    raise exception 'Barème variable invalide';
  end if;

  select count(*)-count(distinct x->>'variant_code')
  into duplicate_count
  from jsonb_array_elements(p_variants) x;
  if duplicate_count>0 then raise exception 'Codes de variantes tarifaires dupliqués'; end if;

  if exists(
    select 1
    from jsonb_array_elements(p_variants) x
    where coalesce(x->>'variant_code','') !~ '^[A-Z0-9_-]{2,64}$'
       or nullif(trim(coalesce(x->>'label','')),'') is null
       or nullif(trim(coalesce(x->>'amount','')),'') is null
       or (x->>'amount')::numeric<0
       or upper(coalesce(x->>'currency','XAF')) !~ '^[A-Z]{3}$'
       or upper(coalesce(x->>'fee_status','TO_VERIFY'))
          not in ('VERIFIED_CURRENT','HISTORICAL','TO_VERIFY')
  ) then
    raise exception 'Définition de variante tarifaire invalide';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(p_variants) x
    where coalesce((x->>'active')::boolean,true)
      and upper(coalesce(x->>'fee_status',''))='VERIFIED_CURRENT'
      and (
        nullif(trim(coalesce(x->>'legal_reference','')),'') is null
        or nullif(trim(coalesce(x->>'source_url','')),'') is null
      )
  ) then
    raise exception 'Chaque variante courante vérifiée exige une référence et une source officielles';
  end if;

  if exists(
    select 1
    from jsonb_array_elements(p_variants) x
    where nullif(trim(coalesce(x->>'valid_from','')),'') is not null
      and nullif(trim(coalesce(x->>'valid_until','')),'') is not null
      and (x->>'valid_until')::date < (x->>'valid_from')::date
  ) then
    raise exception 'Période de validité tarifaire invalide';
  end if;

  select count(*) into current_count
  from jsonb_array_elements(p_variants) x
  where coalesce((x->>'active')::boolean,true)
    and upper(coalesce(x->>'fee_status',''))='VERIFIED_CURRENT'
    and (
      nullif(trim(coalesce(x->>'valid_from','')),'') is null
      or (x->>'valid_from')::date<=current_date
    )
    and (
      nullif(trim(coalesce(x->>'valid_until','')),'') is null
      or (x->>'valid_until')::date>=current_date
    );

  if fee_mode='VARIANT' and fee_status='VERIFIED_CURRENT' and current_count=0 then
    raise exception 'Un tarif VARIANT courant exige au moins une variante VERIFIED_CURRENT';
  end if;

  if fee_mode<>'VARIANT' and current_count>0 then
    raise exception 'Des variantes courantes ne peuvent être actives que pour un mode VARIANT';
  end if;

  return true;
end $$;
revoke all on function private.validate_catalog_fee_variants_secure(text,jsonb,jsonb)
from public,anon;
grant execute on function private.validate_catalog_fee_variants_secure(text,jsonb,jsonb)
to authenticated;

create or replace function private.save_catalog_change_request_secure(
  p_request_id uuid,
  p_service_code text,
  p_proposed_service jsonb,
  p_form_fields jsonb,
  p_required_documents jsonb,
  p_fee_variants jsonb
)
returns public.administrative_catalog_change_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.administrative_services;
  r public.administrative_catalog_change_requests;
  snap jsonb;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into s from public.administrative_services where code=p_service_code;
  if s.code is null then raise exception 'Démarche introuvable'; end if;
  if not private.can_edit_catalog_secure(s.ministry) then raise exception 'Accès non autorisé'; end if;

  perform private.validate_catalog_proposal_secure(
    s.ministry,p_proposed_service,p_form_fields,p_required_documents
  );
  perform private.validate_catalog_fee_variants_secure(
    s.code,p_proposed_service,coalesce(p_fee_variants,'[]'::jsonb)
  );
  snap:=private.catalog_service_snapshot_secure(s.code);

  if p_request_id is null then
    if exists(
      select 1 from public.administrative_catalog_change_requests x
      where x.service_code=s.code and x.status in ('DRAFT','SUBMITTED','CONTROL_APPROVED')
    ) then raise exception 'Une proposition est déjà ouverte pour cette démarche'; end if;

    insert into public.administrative_catalog_change_requests(
      service_code,ministry,status,version_base,before_snapshot,proposed_service,
      proposed_form_fields,proposed_required_documents,proposed_fee_variants,created_by
    ) values(
      s.code,s.ministry,'DRAFT',s.form_version,snap,p_proposed_service,
      p_form_fields,p_required_documents,coalesce(p_fee_variants,'[]'::jsonb),auth.uid()
    ) returning * into r;

    insert into public.administrative_catalog_change_events(
      request_id,service_code,ministry,action,actor_uid,payload
    ) values(
      r.id,s.code,s.ministry,'DRAFT_CREATED',auth.uid(),
      jsonb_build_object('version_base',s.form_version)
    );
  else
    select * into r
    from public.administrative_catalog_change_requests
    where id=p_request_id
    for update;
    if r.id is null or r.service_code<>s.code then raise exception 'Proposition introuvable'; end if;
    if r.status<>'DRAFT' then raise exception 'Seul un brouillon peut être modifié'; end if;
    if r.created_by<>auth.uid() then raise exception 'Seul le créateur peut modifier ce brouillon'; end if;

    update public.administrative_catalog_change_requests
    set proposed_service=p_proposed_service,
        proposed_form_fields=p_form_fields,
        proposed_required_documents=p_required_documents,
        proposed_fee_variants=coalesce(p_fee_variants,'[]'::jsonb),
        updated_at=now()
    where id=r.id
    returning * into r;

    insert into public.administrative_catalog_change_events(
      request_id,service_code,ministry,action,actor_uid
    ) values(r.id,s.code,s.ministry,'DRAFT_UPDATED',auth.uid());
  end if;

  return r;
end $$;
revoke all on function private.save_catalog_change_request_secure(uuid,text,jsonb,jsonb,jsonb,jsonb)
from public,anon;
grant execute on function private.save_catalog_change_request_secure(uuid,text,jsonb,jsonb,jsonb,jsonb)
to authenticated;

create or replace function public.save_catalog_change_request(
  p_request_id uuid,
  p_service_code text,
  p_proposed_service jsonb,
  p_form_fields jsonb,
  p_required_documents jsonb,
  p_fee_variants jsonb
)
returns public.administrative_catalog_change_requests
language sql
security invoker
set search_path=''
as $$
 select private.save_catalog_change_request_secure(
   p_request_id,p_service_code,p_proposed_service,p_form_fields,p_required_documents,p_fee_variants
 )
$$;
revoke all on function public.save_catalog_change_request(uuid,text,jsonb,jsonb,jsonb,jsonb)
from public,anon;
grant execute on function public.save_catalog_change_request(uuid,text,jsonb,jsonb,jsonb,jsonb)
to authenticated;

create or replace function private.list_catalog_validation_workspace_secure(p_ministry text)
returns table(
  service_code text,ministry text,service_name text,current_snapshot jsonb,active_request jsonb,
  can_edit boolean,can_control boolean,can_final_approve boolean
)
language plpgsql
security definer
set search_path=''
stable
as $$
declare m text:=upper(trim(p_ministry)); allowed boolean;
begin
  allowed:=private.can_edit_catalog_secure(m)
    or private.can_control_catalog_secure(m)
    or private.can_final_approve_catalog_secure(m);
  if not allowed then raise exception 'Accès non autorisé'; end if;

  return query
  select
    s.code,s.ministry,s.name,
    private.catalog_service_snapshot_secure(s.code),
    (
      select jsonb_build_object(
        'id',r.id,'status',r.status,'version_base',r.version_base,
        'proposed_service',r.proposed_service,
        'proposed_form_fields',r.proposed_form_fields,
        'proposed_required_documents',r.proposed_required_documents,
        'proposed_fee_variants',r.proposed_fee_variants,
        'created_by',r.created_by,'created_at',r.created_at,'submitted_at',r.submitted_at,
        'control_approved_by',r.control_approved_by,'control_approved_at',r.control_approved_at,
        'final_approved_by',r.final_approved_by,'final_approved_at',r.final_approved_at,
        'rejection_note',r.rejection_note
      )
      from public.administrative_catalog_change_requests r
      where r.service_code=s.code
        and r.status in ('DRAFT','SUBMITTED','CONTROL_APPROVED')
      order by r.created_at desc
      limit 1
    ),
    private.can_edit_catalog_secure(m),
    private.can_control_catalog_secure(m),
    private.can_final_approve_catalog_secure(m)
  from public.administrative_services s
  where s.ministry=m
  order by s.name;
end $$;
revoke all on function private.list_catalog_validation_workspace_secure(text) from public,anon;
grant execute on function private.list_catalog_validation_workspace_secure(text) to authenticated;

create or replace function private.submit_catalog_change_request_secure(p_request_id uuid)
returns public.administrative_catalog_change_requests
language plpgsql
security definer
set search_path=''
as $$
declare r public.administrative_catalog_change_requests;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into r
  from public.administrative_catalog_change_requests
  where id=p_request_id
  for update;
  if r.id is null then raise exception 'Proposition introuvable'; end if;
  if r.status<>'DRAFT' or r.created_by<>auth.uid() then raise exception 'Brouillon non soumissible'; end if;
  if not private.can_edit_catalog_secure(r.ministry) then raise exception 'Accès non autorisé'; end if;

  perform private.validate_catalog_proposal_secure(
    r.ministry,r.proposed_service,r.proposed_form_fields,r.proposed_required_documents
  );
  perform private.validate_catalog_fee_variants_secure(
    r.service_code,r.proposed_service,r.proposed_fee_variants
  );

  update public.administrative_catalog_change_requests
  set status='SUBMITTED',submitted_at=now(),updated_at=now()
  where id=r.id
  returning * into r;

  insert into public.administrative_catalog_change_events(
    request_id,service_code,ministry,action,actor_uid
  ) values(r.id,r.service_code,r.ministry,'SUBMITTED',auth.uid());

  return r;
end $$;
revoke all on function private.submit_catalog_change_request_secure(uuid) from public,anon;
grant execute on function private.submit_catalog_change_request_secure(uuid) to authenticated;

create or replace function private.review_catalog_change_request_secure(
  p_request_id uuid,p_decision text,p_note text default null
)
returns public.administrative_catalog_change_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.administrative_catalog_change_requests;
  decision text:=upper(trim(p_decision));
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select * into r
  from public.administrative_catalog_change_requests
  where id=p_request_id
  for update;
  if r.id is null then raise exception 'Proposition introuvable'; end if;
  if r.status<>'SUBMITTED' then
    raise exception 'Proposition non disponible pour le premier contrôle';
  end if;
  if not private.can_control_catalog_secure(r.ministry) then raise exception 'Accès non autorisé'; end if;
  if r.created_by=auth.uid() then raise exception 'Le créateur ne peut pas effectuer le premier contrôle'; end if;

  if decision='APPROVE' then
    perform private.validate_catalog_proposal_secure(
      r.ministry,r.proposed_service,r.proposed_form_fields,r.proposed_required_documents
    );
    perform private.validate_catalog_fee_variants_secure(
      r.service_code,r.proposed_service,r.proposed_fee_variants
    );

    update public.administrative_catalog_change_requests
    set status='CONTROL_APPROVED',
        control_approved_by=auth.uid(),
        control_approved_at=now(),
        updated_at=now()
    where id=r.id
    returning * into r;

    insert into public.administrative_catalog_change_events(
      request_id,service_code,ministry,action,actor_uid,note
    ) values(r.id,r.service_code,r.ministry,'CONTROL_APPROVED',auth.uid(),p_note);

  elsif decision='REJECT' then
    if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Un motif de rejet est requis'; end if;

    update public.administrative_catalog_change_requests
    set status='REJECTED',rejected_by=auth.uid(),rejection_note=p_note,updated_at=now()
    where id=r.id
    returning * into r;

    insert into public.administrative_catalog_change_events(
      request_id,service_code,ministry,action,actor_uid,note
    ) values(r.id,r.service_code,r.ministry,'REJECTED',auth.uid(),p_note);
  else
    raise exception 'Décision invalide';
  end if;

  return r;
end $$;
revoke all on function private.review_catalog_change_request_secure(uuid,text,text) from public,anon;
grant execute on function private.review_catalog_change_request_secure(uuid,text,text) to authenticated;

create or replace function private.finalize_catalog_change_request_secure(
  p_request_id uuid,p_decision text,p_note text default null
)
returns public.administrative_catalog_change_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  r public.administrative_catalog_change_requests;
  s public.administrative_services;
  decision text:=upper(trim(p_decision));
  ps jsonb;
  f jsonb;
  d jsonb;
  fv jsonb;
  v_fee_mode text;
  v_fee_status text;
  v_payment_enabled boolean;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select * into r
  from public.administrative_catalog_change_requests
  where id=p_request_id
  for update;
  if r.id is null then raise exception 'Proposition introuvable'; end if;
  if r.status<>'CONTROL_APPROVED' then raise exception 'La proposition doit avoir passé le premier contrôle'; end if;
  if not private.can_final_approve_catalog_secure(r.ministry) then raise exception 'Accès final non autorisé'; end if;
  if r.created_by=auth.uid() or r.control_approved_by=auth.uid() then
    raise exception 'Le second contrôle doit être effectué par une troisième personne distincte';
  end if;

  if decision='REJECT' then
    if nullif(trim(coalesce(p_note,'')),'') is null then raise exception 'Un motif de rejet est requis'; end if;
    update public.administrative_catalog_change_requests
    set status='REJECTED',rejected_by=auth.uid(),rejection_note=p_note,updated_at=now()
    where id=r.id returning * into r;
    insert into public.administrative_catalog_change_events(
      request_id,service_code,ministry,action,actor_uid,note
    ) values(r.id,r.service_code,r.ministry,'REJECTED',auth.uid(),p_note);
    return r;
  elsif decision<>'APPROVE' then
    raise exception 'Décision invalide';
  end if;

  select * into s
  from public.administrative_services
  where code=r.service_code
  for update;
  if s.code is null then raise exception 'Démarche introuvable'; end if;
  if s.form_version<>r.version_base then
    raise exception 'Le catalogue a changé depuis la création de cette proposition';
  end if;

  perform private.validate_catalog_proposal_secure(
    r.ministry,r.proposed_service,r.proposed_form_fields,r.proposed_required_documents
  );
  perform private.validate_catalog_fee_variants_secure(
    r.service_code,r.proposed_service,r.proposed_fee_variants
  );

  ps:=r.proposed_service;
  v_fee_mode:=upper(coalesce(ps->>'fee_mode','UNVERIFIED'));
  v_fee_status:=upper(coalesce(ps->>'fee_status','TO_VERIFY'));
  v_payment_enabled:=coalesce((ps->>'payment_enabled')::boolean,false);

  update public.administrative_services
  set name=coalesce(nullif(trim(ps->>'name'),''),name),
      audience=coalesce(nullif(trim(ps->>'audience'),''),audience),
      competent_direction=nullif(trim(ps->>'competent_direction'),''),
      competent_service=nullif(trim(ps->>'competent_service'),''),
      legal_status=upper(ps->>'legal_status'),
      legal_reference=nullif(trim(ps->>'legal_reference'),''),
      legal_source_url=nullif(trim(ps->>'legal_source_url'),''),
      fee_mode=v_fee_mode,
      fee_amount=case
        when v_fee_mode='FIXED' and nullif(trim(coalesce(ps->>'fee_amount','')),'') is not null
          then (ps->>'fee_amount')::numeric
        else null
      end,
      fee_currency=upper(coalesce(nullif(trim(ps->>'fee_currency'),''),'XAF')),
      fee_status=v_fee_status,
      fee_reference=nullif(trim(ps->>'fee_reference'),''),
      fee_source_url=nullif(trim(ps->>'fee_source_url'),''),
      fee_verified_at=case when v_fee_status='VERIFIED_CURRENT' then now() else null end,
      fee_verification_note=case
        when v_fee_status='VERIFIED_CURRENT' then coalesce(
          nullif(trim(ps->>'fee_verification_note'),''),
          'Double validation ministérielle finalisée le '||to_char(now(),'YYYY-MM-DD')
        )
        else nullif(trim(ps->>'fee_verification_note'),'')
      end,
      processing_days=case
        when nullif(trim(coalesce(ps->>'processing_days','')),'') is null then null
        else (ps->>'processing_days')::integer
      end,
      processing_days_status=upper(coalesce(ps->>'processing_days_status','TO_VERIFY')),
      publication_status=upper(ps->>'publication_status'),
      requirements_status=upper(ps->>'requirements_status'),
      output_document=nullif(trim(ps->>'output_document'),''),
      payment_enabled=v_payment_enabled,
      form_version=form_version+1,
      updated_at=now()
  where code=s.code;

  delete from public.administrative_service_form_fields where service_code=s.code;
  for f in select value from jsonb_array_elements(r.proposed_form_fields)
  loop
    insert into public.administrative_service_form_fields(
      service_code,field_key,label,input_type,required,verified,options,help_text,sort_order,active
    ) values(
      s.code,f->>'field_key',f->>'label',f->>'input_type',
      coalesce((f->>'required')::boolean,false),
      coalesce((f->>'verified')::boolean,false),
      coalesce(f->'options','[]'::jsonb),
      nullif(trim(f->>'help_text'),''),
      coalesce((f->>'sort_order')::integer,0),
      coalesce((f->>'active')::boolean,true)
    );
  end loop;

  delete from public.administrative_service_required_documents where service_code=s.code;
  for d in select value from jsonb_array_elements(r.proposed_required_documents)
  loop
    insert into public.administrative_service_required_documents(
      service_code,document_code,label,required,verified,conditional_note,
      allowed_mime_types,max_size_bytes,sort_order,active
    ) values(
      s.code,d->>'document_code',d->>'label',
      coalesce((d->>'required')::boolean,true),
      coalesce((d->>'verified')::boolean,false),
      nullif(trim(d->>'conditional_note'),''),
      coalesce(
        array(select jsonb_array_elements_text(
          coalesce(d->'allowed_mime_types','["application/pdf","image/jpeg","image/png"]'::jsonb)
        )),
        array['application/pdf','image/jpeg','image/png']::text[]
      ),
      coalesce((d->>'max_size_bytes')::bigint,10485760),
      coalesce((d->>'sort_order')::integer,0),
      coalesce((d->>'active')::boolean,true)
    );
  end loop;

  delete from public.administrative_service_fee_variants where service_code=s.code;
  for fv in select value from jsonb_array_elements(r.proposed_fee_variants)
  loop
    insert into public.administrative_service_fee_variants(
      service_code,variant_code,label,attributes,amount,currency,fee_status,
      legal_reference,source_url,valid_from,valid_until,active,verified_at,verification_note
    ) values(
      s.code,
      upper(trim(fv->>'variant_code')),
      trim(fv->>'label'),
      coalesce(fv->'attributes','{}'::jsonb),
      (fv->>'amount')::numeric,
      upper(coalesce(nullif(trim(fv->>'currency'),''),'XAF')),
      upper(coalesce(fv->>'fee_status','TO_VERIFY')),
      nullif(trim(fv->>'legal_reference'),''),
      nullif(trim(fv->>'source_url'),''),
      case when nullif(trim(coalesce(fv->>'valid_from','')),'') is null then null else (fv->>'valid_from')::date end,
      case when nullif(trim(coalesce(fv->>'valid_until','')),'') is null then null else (fv->>'valid_until')::date end,
      coalesce((fv->>'active')::boolean,true),
      case when upper(coalesce(fv->>'fee_status',''))='VERIFIED_CURRENT' then now() else null end,
      case
        when upper(coalesce(fv->>'fee_status',''))='VERIFIED_CURRENT'
          then coalesce(
            nullif(trim(fv->>'verification_note'),''),
            'Double validation ministérielle finalisée le '||to_char(now(),'YYYY-MM-DD')
          )
        else nullif(trim(fv->>'verification_note'),'')
      end
    );
  end loop;

  update public.administrative_catalog_change_requests
  set status='APPLIED',
      final_approved_by=auth.uid(),
      final_approved_at=now(),
      applied_at=now(),
      updated_at=now()
  where id=r.id
  returning * into r;

  insert into public.administrative_catalog_change_events(
    request_id,service_code,ministry,action,actor_uid,note,payload
  ) values(
    r.id,r.service_code,r.ministry,'FINAL_APPROVED',auth.uid(),p_note,
    jsonb_build_object(
      'new_form_version',s.form_version+1,
      'fee_mode',v_fee_mode,
      'fee_status',v_fee_status,
      'fee_variant_count',jsonb_array_length(r.proposed_fee_variants),
      'payment_enabled',v_payment_enabled
    )
  );

  insert into public.administrative_catalog_change_events(
    request_id,service_code,ministry,action,actor_uid,payload
  ) values(
    r.id,r.service_code,r.ministry,'APPLIED',auth.uid(),
    jsonb_build_object(
      'publication_status',upper(ps->>'publication_status'),
      'fee_mode',v_fee_mode
    )
  );

  return r;
end $$;
revoke all on function private.finalize_catalog_change_request_secure(uuid,text,text)
from public,anon;
grant execute on function private.finalize_catalog_change_request_secure(uuid,text,text)
to authenticated;
