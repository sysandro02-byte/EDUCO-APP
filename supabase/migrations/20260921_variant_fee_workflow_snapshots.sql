
-- Route approval through the verified fee resolver and freeze the approved tariff in the dossier.
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
  resolved_variant text;
  resolved_amount numeric;
  resolved_currency text;
  resolved_reference text;
  resolved_source text;
  resolved_verified_at timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into v from public.administrative_applications where id=p_id for update;
  if v.id is null then raise exception 'Dossier introuvable'; end if;
  if not public.is_ministry_administrative_agent(coalesce(v.assigned_ministry,v.ministry)) then
    raise exception 'Accès non autorisé';
  end if;

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
    select * into target_stage from public.administrative_workflow_stages
    where service_code=v.service_code and stage_order=1;
    if not private.role_matches_stage_secure(v.ministry,actor_role,target_stage.allowed_role_suffixes) then
      raise exception 'Seul un agent instructeur peut prendre directement ce dossier';
    end if;
    next_status:='UNDER_REVIEW';
    next_stage_order:=1;
    next_stage_code:=target_stage.stage_code;
    p_target_uid:=auth.uid();
    select * into target_account
    from public.administrative_government_accounts where user_uid=auth.uid();

  elsif act='ASSIGN' then
    if old_status<>'SUBMITTED' then raise exception 'Transition interdite: % -> ASSIGN',old_status; end if;
    if not private.is_ministry_workflow_supervisor_secure(v.ministry) then
      raise exception 'Seule une autorité de supervision peut affecter un dossier';
    end if;
    next_stage_order:=1;
    select * into target_stage from public.administrative_workflow_stages
    where service_code=v.service_code and stage_order=next_stage_order;
    target_account:=private.validate_routing_target_secure(v,p_target_uid,next_stage_order);
    next_status:='UNDER_REVIEW';
    next_stage_code:=target_stage.stage_code;

  elsif act in ('FORWARD','RETURN','REQUEST_MISSING','REJECT','APPROVE') then
    if old_status<>'UNDER_REVIEW' then raise exception 'Transition interdite depuis %',old_status; end if;
    if v.assigned_agent_uid is distinct from auth.uid() then
      raise exception 'Seul l’agent actuellement responsable peut effectuer cette action';
    end if;
    if current_stage.service_code is null then raise exception 'Étape courante invalide'; end if;
    if not private.role_matches_stage_secure(v.ministry,actor_role,current_stage.allowed_role_suffixes) then
      raise exception 'Votre rôle ne correspond pas à l’étape courante %',current_stage.stage_code;
    end if;

    if act='FORWARD' then
      next_stage_order:=v.workflow_stage_order+1;
      select * into target_stage from public.administrative_workflow_stages
      where service_code=v.service_code and stage_order=next_stage_order;
      if target_stage.service_code is null or target_stage.is_signature_stage then
        raise exception 'Utilisez APPROVE pour transmettre à la signature';
      end if;
      target_account:=private.validate_routing_target_secure(v,p_target_uid,next_stage_order);
      next_status:='UNDER_REVIEW';
      next_stage_code:=target_stage.stage_code;

    elsif act='RETURN' then
      if v.workflow_stage_order<=1 then raise exception 'Aucune étape précédente'; end if;
      next_stage_order:=v.workflow_stage_order-1;
      select * into target_stage from public.administrative_workflow_stages
      where service_code=v.service_code and stage_order=next_stage_order;
      target_account:=private.validate_routing_target_secure(v,p_target_uid,next_stage_order);
      next_status:='UNDER_REVIEW';
      next_stage_code:=target_stage.stage_code;

    elsif act='REQUEST_MISSING' then
      if not current_stage.can_request_missing then raise exception 'Action non autorisée à cette étape'; end if;
      if nullif(trim(p_note),'') is null then raise exception 'Une note est requise'; end if;
      next_status:='MISSING_DOCUMENTS';
      next_stage_order:=v.workflow_stage_order;
      next_stage_code:=v.workflow_stage_code;
      p_target_uid:=v.assigned_agent_uid;
      select * into target_account
      from public.administrative_government_accounts where user_uid=v.assigned_agent_uid;

    elsif act='REJECT' then
      if not current_stage.can_reject then raise exception 'Le rejet définitif n’est pas autorisé à cette étape'; end if;
      if nullif(trim(p_note),'') is null then raise exception 'Un motif de rejet est requis'; end if;
      next_status:='REJECTED';
      next_stage_order:=v.workflow_stage_order;
      next_stage_code:=v.workflow_stage_code;
      p_target_uid:=v.assigned_agent_uid;
      select * into target_account
      from public.administrative_government_accounts where user_uid=v.assigned_agent_uid;

    elsif act='APPROVE' then
      if not current_stage.can_approve then raise exception 'La décision finale n’est pas autorisée à cette étape'; end if;
      if p_target_uid is null then raise exception 'Un signataire cible est requis'; end if;
      next_stage_order:=v.workflow_stage_order+1;
      select * into target_stage from public.administrative_workflow_stages
      where service_code=v.service_code and stage_order=next_stage_order;
      if target_stage.service_code is null or not target_stage.is_signature_stage then
        raise exception 'Étape de signature introuvable';
      end if;
      target_account:=private.validate_routing_target_secure(v,p_target_uid,next_stage_order);

      select * into svc from public.administrative_services where code=v.service_code;
      if svc.code is null then raise exception 'Démarche introuvable'; end if;
      next_status:='APPROVED';

      if svc.payment_enabled then
        if svc.fee_status<>'VERIFIED_CURRENT'
           or svc.publication_status<>'PUBLISHED'
           or svc.legal_status<>'VERIFIED'
           or svc.requirements_status<>'VERIFIED' then
          raise exception 'Paiement bloqué: tarif ou démarche non vérifié';
        end if;

        select r.fee_variant_code,r.amount,r.currency,r.fee_reference,r.fee_source_url,r.verified_at
        into resolved_variant,resolved_amount,resolved_currency,resolved_reference,resolved_source,resolved_verified_at
        from private.resolve_administrative_fee_secure(v.service_code,v.form_data) r;

        if resolved_amount is null then raise exception 'Tarif officiel applicable introuvable'; end if;
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
      payment_amount=case when next_status='PAYMENT_DUE' then resolved_amount else payment_amount end,
      payment_currency=case when next_status='PAYMENT_DUE' then resolved_currency else payment_currency end,
      fee_variant_code=case when next_status='PAYMENT_DUE' then resolved_variant else fee_variant_code end,
      fee_reference_snapshot=case when next_status='PAYMENT_DUE' then resolved_reference else fee_reference_snapshot end,
      fee_source_url_snapshot=case when next_status='PAYMENT_DUE' then resolved_source else fee_source_url_snapshot end,
      fee_verified_at_snapshot=case when next_status='PAYMENT_DUE' then resolved_verified_at else fee_verified_at_snapshot end,
      updated_at=now()
  where id=p_id
  returning * into v;

  insert into public.administrative_application_events(
    application_id,action,from_status,to_status,note,from_stage,to_stage,target_uid
  ) values(
    p_id,act,old_status,next_status,p_note,old_stage,next_stage_code,p_target_uid
  );

  return v;
end $$;
revoke all on function private.route_administrative_application_secure(uuid,text,uuid,text) from public,anon;
grant execute on function private.route_administrative_application_secure(uuid,text,uuid,text) to authenticated;

-- Keep the legacy authenticated intent path consistent with the server bridge.
create or replace function private.create_administrative_payment_intent_secure(
  p_application_id uuid,
  p_provider_code text
)
returns public.administrative_payment_transactions
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.administrative_applications;
  s public.administrative_services;
  p public.administrative_payment_providers;
  t public.administrative_payment_transactions;
  resolved record;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select * into a
  from public.administrative_applications
  where id=p_application_id and applicant_uid=auth.uid()
  for update;
  if a.id is null then raise exception 'Dossier introuvable'; end if;
  if a.status<>'PAYMENT_DUE' then raise exception 'Ce dossier n’est pas en attente de paiement'; end if;

  select * into s from public.administrative_services where code=a.service_code;
  if s.code is null or not s.payment_enabled
     or s.fee_status<>'VERIFIED_CURRENT'
     or s.publication_status<>'PUBLISHED'
     or s.legal_status<>'VERIFIED'
     or s.requirements_status<>'VERIFIED' then
    raise exception 'Paiement bloqué : la démarche ou son tarif n’est pas officiellement validé';
  end if;

  select * into resolved from private.resolve_administrative_fee_secure(a.service_code,a.form_data);

  if a.payment_amount is distinct from resolved.amount
     or upper(coalesce(a.payment_currency,''))<>upper(resolved.currency)
     or a.fee_variant_code is distinct from resolved.fee_variant_code
     or a.fee_reference_snapshot is distinct from resolved.fee_reference
     or a.fee_source_url_snapshot is distinct from resolved.fee_source_url then
    raise exception 'Le barème officiel a changé depuis l’approbation : nouvelle validation requise';
  end if;

  select * into p
  from public.administrative_payment_providers
  where code=upper(trim(p_provider_code)) and active and config_status='READY'
  for share;
  if p.code is null then raise exception 'Canal de paiement officiel indisponible'; end if;
  if upper(p.currency)<>upper(resolved.currency) then
    raise exception 'Devise non prise en charge par ce canal';
  end if;

  select * into t
  from public.administrative_payment_transactions
  where application_id=a.id and status='PENDING'
  order by initiated_at desc limit 1;
  if t.id is not null then return t; end if;

  insert into public.administrative_payment_transactions(
    application_id,applicant_uid,provider_code,amount,currency
  ) values(a.id,a.applicant_uid,p.code,a.payment_amount,a.payment_currency)
  returning * into t;

  insert into public.administrative_application_events(
    application_id,actor_uid,action,from_status,to_status,note
  ) values(a.id,auth.uid(),'PAYMENT_INTENT',a.status,a.status,t.internal_reference);

  return t;
end $$;
revoke all on function private.create_administrative_payment_intent_secure(uuid,text) from public,anon;
grant execute on function private.create_administrative_payment_intent_secure(uuid,text) to authenticated;
