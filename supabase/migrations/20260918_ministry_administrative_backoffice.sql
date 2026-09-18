-- Ministry back-office workflow for administrative applications.
alter table public.administrative_applications add column if not exists assigned_ministry text;
alter table public.administrative_applications add column if not exists assigned_direction text;
alter table public.administrative_applications add column if not exists assigned_agent_uid uuid;
alter table public.administrative_applications add column if not exists review_note text;
alter table public.administrative_applications add column if not exists decision_note text;

create table if not exists public.administrative_application_events (
 id bigserial primary key, application_id uuid not null references public.administrative_applications(id) on delete cascade,
 actor_uid uuid not null default auth.uid(), action text not null, from_status text, to_status text, note text,
 created_at timestamptz not null default now()
);
alter table public.administrative_application_events enable row level security;
grant select on public.administrative_application_events to authenticated;

create or replace function public.is_ministry_administrative_agent(p_ministry text)
returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from public.users u where u.uid=(select auth.uid())::text and (
  upper(regexp_replace(coalesce(u.role,''),'[^A-Za-z0-9]+','_','g')) in
  (upper(p_ministry)||'_ADMIN', upper(p_ministry)||'_CABINET', upper(p_ministry)||'_DG', 'ETAT_ADMIN')
  or upper(regexp_replace(coalesce(u.role,''),'[^A-Za-z0-9]+','_','g')) like upper(p_ministry)||'_%'
 ));
$$;
revoke all on function public.is_ministry_administrative_agent(text) from public;
grant execute on function public.is_ministry_administrative_agent(text) to authenticated;

create policy "ministry agents read applications" on public.administrative_applications for select to authenticated
 using (public.is_ministry_administrative_agent(coalesce(assigned_ministry,ministry)));
create policy "ministry agents update applications" on public.administrative_applications for update to authenticated
 using (public.is_ministry_administrative_agent(coalesce(assigned_ministry,ministry)))
 with check (public.is_ministry_administrative_agent(coalesce(assigned_ministry,ministry)));
create policy "applicant reads events" on public.administrative_application_events for select to authenticated
 using (exists(select 1 from public.administrative_applications a where a.id=application_id and a.applicant_uid=(select auth.uid())));
create policy "ministry reads events" on public.administrative_application_events for select to authenticated
 using (exists(select 1 from public.administrative_applications a where a.id=application_id and public.is_ministry_administrative_agent(coalesce(a.assigned_ministry,a.ministry))));

create or replace function public.process_administrative_application(p_id uuid,p_action text,p_note text default null,p_direction text default null)
returns public.administrative_applications language plpgsql security invoker set search_path=public as $$
declare v public.administrative_applications; old_status text; next_status text; svc public.administrative_services;
begin
 select * into v from public.administrative_applications where id=p_id for update;
 if v.id is null then raise exception 'Dossier introuvable'; end if;
 if not public.is_ministry_administrative_agent(coalesce(v.assigned_ministry,v.ministry)) then raise exception 'Accès non autorisé'; end if;
 old_status:=v.status;
 next_status:=case upper(p_action)
  when 'ASSIGN' then 'UNDER_REVIEW' when 'REQUEST_MISSING' then 'MISSING_DOCUMENTS'
  when 'APPROVE' then 'APPROVED' when 'REJECT' then 'REJECTED' else null end;
 if next_status is null then raise exception 'Action non prise en charge'; end if;
 if upper(p_action)='APPROVE' then
   select * into svc from public.administrative_services where code=v.service_code;
   if svc.payment_enabled then
     if svc.fee_status<>'VERIFIED_CURRENT' or svc.fee_amount is null or svc.publication_status<>'PUBLISHED' then raise exception 'Paiement bloqué: tarif officiel non vérifié'; end if;
     next_status:='PAYMENT_DUE';
   end if;
 end if;
 update public.administrative_applications set status=next_status,assigned_ministry=coalesce(assigned_ministry,ministry),
 assigned_direction=coalesce(p_direction,assigned_direction),assigned_agent_uid=case when upper(p_action)='ASSIGN' then (select auth.uid()) else assigned_agent_uid end,
 review_note=case when upper(p_action)='REQUEST_MISSING' then p_note else review_note end,
 decision_note=case when upper(p_action) in ('APPROVE','REJECT') then p_note else decision_note end,
 reviewed_at=case when upper(p_action) in ('APPROVE','REJECT') then now() else reviewed_at end,updated_at=now() where id=p_id returning * into v;
 insert into public.administrative_application_events(application_id,action,from_status,to_status,note) values(p_id,upper(p_action),old_status,next_status,p_note);
 return v;
end $$;
revoke all on function public.process_administrative_application(uuid,text,text,text) from public;
grant execute on function public.process_administrative_application(uuid,text,text,text) to authenticated;
