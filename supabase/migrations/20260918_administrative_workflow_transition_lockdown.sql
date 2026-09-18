-- Lock administrative status transitions behind controlled RPCs.
-- Applied to Supabase as migration administrative_workflow_transition_lockdown.

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create or replace function private.process_administrative_application_secure(p_id uuid,p_action text,p_note text default null,p_direction text default null)
returns public.administrative_applications language plpgsql security definer set search_path=''
as $$
declare v public.administrative_applications; old_status text; next_status text; svc public.administrative_services; act text;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into v from public.administrative_applications where id=p_id for update;
 if v.id is null then raise exception 'Dossier introuvable'; end if;
 if not public.is_ministry_administrative_agent(coalesce(v.assigned_ministry,v.ministry)) then raise exception 'Accès non autorisé'; end if;
 act:=upper(trim(p_action)); old_status:=v.status;
 if act='ASSIGN' then
   if old_status<>'SUBMITTED' then raise exception 'Transition interdite: % -> ASSIGN',old_status; end if;
   next_status:='UNDER_REVIEW';
 elsif act='REQUEST_MISSING' then
   if old_status<>'UNDER_REVIEW' then raise exception 'Transition interdite: % -> REQUEST_MISSING',old_status; end if;
   if nullif(trim(p_note),'') is null then raise exception 'Une note est requise'; end if;
   next_status:='MISSING_DOCUMENTS';
 elsif act='APPROVE' then
   if old_status<>'UNDER_REVIEW' then raise exception 'Transition interdite: % -> APPROVE',old_status; end if;
   select * into svc from public.administrative_services where code=v.service_code;
   if svc.code is null then raise exception 'Démarche introuvable'; end if;
   next_status:='APPROVED';
   if svc.payment_enabled then
     if svc.fee_status<>'VERIFIED_CURRENT' or svc.fee_amount is null or svc.publication_status<>'PUBLISHED' then raise exception 'Paiement bloqué: tarif officiel non vérifié'; end if;
     next_status:='PAYMENT_DUE';
   end if;
 elsif act='REJECT' then
   if old_status<>'UNDER_REVIEW' then raise exception 'Transition interdite: % -> REJECT',old_status; end if;
   if nullif(trim(p_note),'') is null then raise exception 'Un motif de rejet est requis'; end if;
   next_status:='REJECTED';
 else raise exception 'Action non prise en charge';
 end if;
 update public.administrative_applications set status=next_status,assigned_ministry=coalesce(assigned_ministry,ministry),
 assigned_direction=case when act='ASSIGN' then coalesce(nullif(trim(p_direction),''),assigned_direction) else assigned_direction end,
 assigned_agent_uid=case when act='ASSIGN' then auth.uid() else assigned_agent_uid end,
 review_note=case when act='REQUEST_MISSING' then p_note else review_note end,
 decision_note=case when act in ('APPROVE','REJECT') then p_note else decision_note end,
 reviewed_at=case when act in ('APPROVE','REJECT') then now() else reviewed_at end,
 payment_amount=case when next_status='PAYMENT_DUE' then svc.fee_amount else payment_amount end,
 payment_currency=case when next_status='PAYMENT_DUE' then svc.fee_currency else payment_currency end,updated_at=now()
 where id=p_id returning * into v;
 insert into public.administrative_application_events(application_id,action,from_status,to_status,note) values(p_id,act,old_status,next_status,p_note);
 return v;
end $$;
revoke all on function private.process_administrative_application_secure(uuid,text,text,text) from public,anon;
grant execute on function private.process_administrative_application_secure(uuid,text,text,text) to authenticated;

create or replace function public.process_administrative_application(p_id uuid,p_action text,p_note text default null,p_direction text default null)
returns public.administrative_applications language sql security invoker set search_path=''
as $$ select private.process_administrative_application_secure(p_id,p_action,p_note,p_direction) $$;
revoke all on function public.process_administrative_application(uuid,text,text,text) from public,anon;
grant execute on function public.process_administrative_application(uuid,text,text,text) to authenticated;

create or replace function private.submit_administrative_application_secure(p_id uuid)
returns public.administrative_applications language plpgsql security definer set search_path=''
as $$
declare v public.administrative_applications;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 update public.administrative_applications set status='SUBMITTED',submitted_at=now(),updated_at=now()
 where id=p_id and applicant_uid=auth.uid() and status in ('DRAFT','MISSING_DOCUMENTS') returning * into v;
 if v.id is null then raise exception 'Dossier introuvable ou non soumissible'; end if;
 return v;
end $$;
revoke all on function private.submit_administrative_application_secure(uuid) from public,anon;
grant execute on function private.submit_administrative_application_secure(uuid) to authenticated;

create or replace function public.submit_administrative_application(p_id uuid)
returns public.administrative_applications language sql security invoker set search_path=''
as $$ select private.submit_administrative_application_secure(p_id) $$;
revoke all on function public.submit_administrative_application(uuid) from public,anon;
grant execute on function public.submit_administrative_application(uuid) to authenticated;

drop policy if exists "ministry agents update applications" on public.administrative_applications;
drop policy if exists "applicant edits own open applications" on public.administrative_applications;
revoke update on public.administrative_applications from authenticated, anon;
