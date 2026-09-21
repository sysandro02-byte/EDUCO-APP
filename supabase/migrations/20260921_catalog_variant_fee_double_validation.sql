
-- Complete catalog double-validation for FIXED/VARIANT fee modes.
create or replace function private.validate_catalog_proposal_secure(
  p_ministry text,
  p_service jsonb,
  p_fields jsonb,
  p_documents jsonb
)
returns boolean
language plpgsql
security definer
set search_path=''
stable
as $$
declare
  legal_status text:=upper(coalesce(p_service->>'legal_status',''));
  fee_status text:=upper(coalesce(p_service->>'fee_status',''));
  fee_mode text:=upper(coalesce(p_service->>'fee_mode','UNVERIFIED'));
  publication_status text:=upper(coalesce(p_service->>'publication_status',''));
  requirements_status text:=upper(coalesce(p_service->>'requirements_status',''));
  processing_status text:=upper(coalesce(p_service->>'processing_days_status','TO_VERIFY'));
  payment_enabled boolean:=coalesce((p_service->>'payment_enabled')::boolean,false);
  fee_amount numeric;
  processing_days integer;
  duplicate_count integer;
begin
  if jsonb_typeof(p_service)<>'object'
     or jsonb_typeof(p_fields)<>'array'
     or jsonb_typeof(p_documents)<>'array' then
    raise exception 'Proposition de catalogue invalide';
  end if;

  if legal_status not in ('VERIFIED','TO_VERIFY','OBSOLETE') then
    raise exception 'Statut juridique invalide';
  end if;
  if fee_status not in ('VERIFIED_CURRENT','HISTORICAL','TO_VERIFY','FREE') then
    raise exception 'Statut tarifaire invalide';
  end if;
  if fee_mode not in ('FIXED','VARIANT','FREE','UNVERIFIED') then
    raise exception 'Mode tarifaire invalide';
  end if;
  if publication_status not in ('DRAFT','LEGAL_REVIEW','MINISTRY_APPROVED','PUBLISHED','SUSPENDED') then
    raise exception 'Statut de publication invalide';
  end if;
  if requirements_status not in ('TO_VERIFY','VERIFIED','SUSPENDED') then
    raise exception 'Statut des exigences invalide';
  end if;
  if processing_status not in ('TO_VERIFY','VERIFIED','NOT_APPLICABLE') then
    raise exception 'Statut du délai invalide';
  end if;

  if nullif(trim(coalesce(p_service->>'fee_amount','')),'') is not null then
    fee_amount:=(p_service->>'fee_amount')::numeric;
    if fee_amount<0 then raise exception 'Le tarif ne peut pas être négatif'; end if;
  end if;

  if nullif(trim(coalesce(p_service->>'processing_days','')),'') is not null then
    processing_days:=(p_service->>'processing_days')::integer;
    if processing_days<0 or processing_days>3650 then
      raise exception 'Délai de traitement invalide';
    end if;
  end if;

  if legal_status='VERIFIED' then
    if nullif(trim(coalesce(p_service->>'legal_reference','')),'') is null then
      raise exception 'Une référence juridique est requise pour un statut VERIFIED';
    end if;
    if nullif(trim(coalesce(p_service->>'legal_source_url','')),'') is null then
      raise exception 'Une source juridique officielle est requise pour un statut VERIFIED';
    end if;
  end if;

  if fee_mode='FIXED' then
    if fee_status='VERIFIED_CURRENT' and fee_amount is null then
      raise exception 'Un tarif fixe vérifié doit avoir un montant';
    end if;
  elsif fee_mode='VARIANT' then
    if fee_amount is not null then
      raise exception 'Un tarif variable ne doit pas définir de montant fixe';
    end if;
  elsif fee_mode='FREE' then
    if fee_status<>'FREE' then raise exception 'Le mode FREE exige le statut FREE'; end if;
    if fee_amount is not null and fee_amount<>0 then raise exception 'Une démarche gratuite ne peut pas avoir de montant'; end if;
    if payment_enabled then raise exception 'Une démarche gratuite ne peut pas activer un paiement'; end if;
  else
    if payment_enabled then raise exception 'Un tarif non vérifié ne peut pas activer un paiement'; end if;
  end if;

  if fee_status='VERIFIED_CURRENT' then
    if fee_mode not in ('FIXED','VARIANT') then
      raise exception 'Un tarif courant vérifié doit être FIXED ou VARIANT';
    end if;
    if nullif(trim(coalesce(p_service->>'fee_reference','')),'') is null then
      raise exception 'Une référence tarifaire officielle est requise';
    end if;
    if nullif(trim(coalesce(p_service->>'fee_source_url','')),'') is null then
      raise exception 'Une source tarifaire officielle est requise';
    end if;
  end if;

  if fee_status='FREE' and fee_mode<>'FREE' then
    raise exception 'Le statut FREE exige le mode FREE';
  end if;

  if processing_status='VERIFIED' and processing_days is null then
    raise exception 'Un délai vérifié doit préciser un nombre de jours';
  end if;

  select count(*)-count(distinct x->>'field_key') into duplicate_count
  from jsonb_array_elements(p_fields) x;
  if duplicate_count>0 then raise exception 'Clés de formulaire dupliquées'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_fields) x
    where coalesce(x->>'field_key','') !~ '^[a-z][a-z0-9_]{1,63}$'
       or coalesce(x->>'input_type','') not in ('text','email','tel','date','textarea','select','number')
       or nullif(trim(coalesce(x->>'label','')),'') is null
  ) then raise exception 'Définition de champ de formulaire invalide'; end if;

  select count(*)-count(distinct x->>'document_code') into duplicate_count
  from jsonb_array_elements(p_documents) x;
  if duplicate_count>0 then raise exception 'Codes de pièces dupliqués'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_documents) x
    where coalesce(x->>'document_code','') !~ '^[A-Z0-9_-]{2,64}$'
       or nullif(trim(coalesce(x->>'label','')),'') is null
       or coalesce((x->>'max_size_bytes')::bigint,10485760) not between 1 and 52428800
  ) then raise exception 'Définition de pièce justificative invalide'; end if;

  if requirements_status='VERIFIED' then
    if exists(
      select 1 from jsonb_array_elements(p_fields) x
      where coalesce((x->>'active')::boolean,true)
        and coalesce((x->>'required')::boolean,false)
        and not coalesce((x->>'verified')::boolean,false)
    ) then raise exception 'Tous les champs obligatoires doivent être vérifiés'; end if;

    if exists(
      select 1 from jsonb_array_elements(p_documents) x
      where coalesce((x->>'active')::boolean,true)
        and coalesce((x->>'required')::boolean,false)
        and not coalesce((x->>'verified')::boolean,false)
    ) then raise exception 'Toutes les pièces obligatoires doivent être vérifiées'; end if;
  end if;

  if payment_enabled then
    if fee_status<>'VERIFIED_CURRENT' or fee_mode not in ('FIXED','VARIANT') then
      raise exception 'Paiement impossible sans tarif courant vérifié';
    end if;
    if fee_mode='FIXED' and fee_amount is null then
      raise exception 'Paiement fixe impossible sans montant';
    end if;
  end if;

  if publication_status='PUBLISHED' then
    if legal_status<>'VERIFIED' then
      raise exception 'Publication impossible sans validation juridique';
    end if;
    if requirements_status<>'VERIFIED' then
      raise exception 'Publication impossible sans validation des exigences';
    end if;
    if nullif(trim(coalesce(p_service->>'output_document','')),'') is null then
      raise exception 'Le document final doit être défini avant publication';
    end if;
  end if;

  return true;
end $$;
revoke all on function private.validate_catalog_proposal_secure(text,jsonb,jsonb,jsonb)
from public,anon;
grant execute on function private.validate_catalog_proposal_secure(text,jsonb,jsonb,jsonb)
to authenticated;

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
  v_fee_mode text;
  v_fee_status text;
  v_payment_enabled boolean;
  v_variant_count integer;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select * into r
  from public.administrative_catalog_change_requests
  where id=p_request_id
  for update;
  if r.id is null then raise exception 'Proposition introuvable'; end if;
  if r.status<>'CONTROL_APPROVED' then
    raise exception 'La proposition doit avoir passé le premier contrôle';
  end if;
  if not private.can_final_approve_catalog_secure(r.ministry) then
    raise exception 'Accès final non autorisé';
  end if;
  if r.created_by=auth.uid() or r.control_approved_by=auth.uid() then
    raise exception 'Le second contrôle doit être effectué par une troisième personne distincte';
  end if;

  if decision='REJECT' then
    if nullif(trim(coalesce(p_note,'')),'') is null then
      raise exception 'Un motif de rejet est requis';
    end if;
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
  ps:=r.proposed_service;
  v_fee_mode:=upper(coalesce(ps->>'fee_mode','UNVERIFIED'));
  v_fee_status:=upper(coalesce(ps->>'fee_status','TO_VERIFY'));
  v_payment_enabled:=coalesce((ps->>'payment_enabled')::boolean,false);

  if v_fee_mode='VARIANT' and v_fee_status='VERIFIED_CURRENT' then
    select count(*) into v_variant_count
    from public.administrative_service_fee_variants fv
    where fv.service_code=s.code
      and fv.active
      and fv.fee_status='VERIFIED_CURRENT'
      and fv.verified_at is not null
      and nullif(trim(coalesce(fv.legal_reference,'')),'') is not null
      and nullif(trim(coalesce(fv.source_url,'')),'') is not null
      and (fv.valid_from is null or fv.valid_from<=current_date)
      and (fv.valid_until is null or fv.valid_until>=current_date);

    if v_variant_count=0 then
      raise exception 'Aucun barème variable courant vérifié n’est enregistré pour cette démarche';
    end if;
  end if;

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
      fee_verified_at=case
        when v_fee_status='VERIFIED_CURRENT' then now()
        else null
      end,
      fee_verification_note=case
        when v_fee_status='VERIFIED_CURRENT'
          then coalesce(
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
