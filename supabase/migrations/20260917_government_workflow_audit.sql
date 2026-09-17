-- EDUCO government workflow audit and status hardening
-- Additive hardening applied after 20260917_government_business_workflows.sql.

create table if not exists public.government_record_events (
  id bigserial primary key,
  ministry text not null check (ministry in ('MEPSA','MES','METP')),
  entity text not null,
  domain text not null,
  record_id bigint not null,
  action text not null,
  from_status text,
  to_status text,
  actor_uid text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists government_record_events_record_idx
  on public.government_record_events (ministry, entity, domain, record_id, created_at desc);

alter table public.government_record_events enable row level security;
revoke all on table public.government_record_events from anon, authenticated;

create or replace function public.government_status_transition_allowed(p_from text, p_to text)
returns boolean
language sql
immutable
as $$
  select case coalesce(p_from, '')
    when 'Brouillon' then p_to in ('Soumis')
    when 'Soumis' then p_to in ('En cours', 'Rejeté')
    when 'En cours' then p_to in ('À valider', 'Rejeté')
    when 'À valider' then p_to in ('Validé', 'Rejeté')
    when 'Validé' then p_to in ('Clôturé')
    when 'Rejeté' then p_to in ('Brouillon')
    else false
  end;
$$;

create or replace function public.government_module_save(
  p_ministry text,
  p_entity text,
  p_domain text,
  p_record jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_id bigint;
  v_result jsonb;
  v_title text;
  v_reference text;
  v_description text;
  v_school_id bigint;
  v_due_date date;
  v_data jsonb;
  v_actor text;
  v_current_status text;
  v_action text;
begin
  if not public.government_context_authorized(p_ministry, p_entity) then
    raise exception 'Accès institutionnel non autorisé';
  end if;

  v_table := public.government_domain_table(p_domain);
  if v_table is null then
    raise exception 'Domaine gouvernemental non pris en charge';
  end if;

  v_title := nullif(trim(coalesce(p_record->>'title', '')), '');
  if v_title is null then
    raise exception 'Le titre est obligatoire';
  end if;

  v_reference := nullif(trim(coalesce(p_record->>'reference', '')), '');
  v_description := nullif(trim(coalesce(p_record->>'description', '')), '');
  v_school_id := nullif(p_record->>'schoolId', '')::bigint;
  v_due_date := nullif(p_record->>'dueDate', '')::date;
  v_data := coalesce(p_record->'data', '{}'::jsonb);
  v_actor := auth.uid()::text;
  v_id := nullif(p_record->>'id', '')::bigint;

  if v_school_id is not null and not exists (select 1 from public.schools where id = v_school_id) then
    raise exception 'Établissement associé introuvable';
  end if;

  if v_id is null then
    execute format(
      'insert into public.%I (ministry, entity, title, reference, status, description, school_id, due_date, data, created_by, updated_by) values ($1,$2,$3,$4,''Brouillon'',$5,$6,$7,$8,$9,$9) returning id',
      v_table
    ) into v_id using upper(p_ministry), upper(p_entity), v_title, v_reference, v_description, v_school_id, v_due_date, v_data, v_actor;
    v_current_status := 'Brouillon';
    v_action := 'Création';
  else
    execute format(
      'select status from public.%I where id=$1 and ministry=$2 and entity=$3',
      v_table
    ) into v_current_status using v_id, upper(p_ministry), upper(p_entity);

    if v_current_status is null then
      raise exception 'Dossier introuvable ou hors périmètre';
    end if;

    execute format(
      'update public.%I set title=$4, reference=$5, description=$6, school_id=$7, due_date=$8, data=$9, updated_by=$10, updated_at=now() where id=$1 and ministry=$2 and entity=$3 returning id',
      v_table
    ) into v_id using v_id, upper(p_ministry), upper(p_entity), v_title, v_reference, v_description, v_school_id, v_due_date, v_data, v_actor;
    v_action := 'Modification';
  end if;

  insert into public.government_record_events(
    ministry, entity, domain, record_id, action, from_status, to_status, actor_uid, details
  ) values (
    upper(p_ministry), upper(p_entity), lower(p_domain), v_id, v_action,
    v_current_status, v_current_status, v_actor,
    jsonb_build_object('title', v_title, 'reference', v_reference)
  );

  execute format('select to_jsonb(x) from public.%I x where x.id=$1', v_table)
    into v_result using v_id;
  return v_result;
end;
$$;

create or replace function public.government_module_transition(
  p_ministry text,
  p_entity text,
  p_domain text,
  p_id bigint,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_old_status text;
  v_new_status text;
  v_actor text;
  v_result jsonb;
begin
  if not public.government_context_authorized(p_ministry, p_entity) then
    raise exception 'Accès institutionnel non autorisé';
  end if;

  v_table := public.government_domain_table(p_domain);
  if v_table is null then
    raise exception 'Domaine gouvernemental non pris en charge';
  end if;

  v_new_status := nullif(trim(coalesce(p_status, '')), '');
  if v_new_status is null then
    raise exception 'Statut cible obligatoire';
  end if;

  execute format(
    'select status from public.%I where id=$1 and ministry=$2 and entity=$3',
    v_table
  ) into v_old_status using p_id, upper(p_ministry), upper(p_entity);

  if v_old_status is null then
    raise exception 'Dossier introuvable ou hors périmètre';
  end if;

  if not public.government_status_transition_allowed(v_old_status, v_new_status) then
    raise exception 'Transition de statut non autorisée : % vers %', v_old_status, v_new_status;
  end if;

  v_actor := auth.uid()::text;
  execute format(
    'update public.%I set status=$4, updated_by=$5, updated_at=now() where id=$1 and ministry=$2 and entity=$3 returning to_jsonb(%I.*)',
    v_table, v_table
  ) into v_result using p_id, upper(p_ministry), upper(p_entity), v_new_status, v_actor;

  insert into public.government_record_events(
    ministry, entity, domain, record_id, action, from_status, to_status, actor_uid
  ) values (
    upper(p_ministry), upper(p_entity), lower(p_domain), p_id,
    'Changement de statut', v_old_status, v_new_status, v_actor
  );

  return v_result;
end;
$$;

create or replace function public.government_module_delete(
  p_ministry text,
  p_entity text,
  p_domain text,
  p_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_status text;
  v_actor text;
  v_deleted bigint;
begin
  if not public.government_context_authorized(p_ministry, p_entity) then
    raise exception 'Accès institutionnel non autorisé';
  end if;

  v_table := public.government_domain_table(p_domain);
  if v_table is null then
    raise exception 'Domaine gouvernemental non pris en charge';
  end if;

  execute format(
    'select status from public.%I where id=$1 and ministry=$2 and entity=$3',
    v_table
  ) into v_status using p_id, upper(p_ministry), upper(p_entity);

  if v_status is null then
    return false;
  end if;

  if v_status not in ('Brouillon', 'Rejeté') then
    raise exception 'Seuls les brouillons ou dossiers rejetés peuvent être supprimés';
  end if;

  v_actor := auth.uid()::text;
  insert into public.government_record_events(
    ministry, entity, domain, record_id, action, from_status, to_status, actor_uid
  ) values (
    upper(p_ministry), upper(p_entity), lower(p_domain), p_id,
    'Suppression', v_status, null, v_actor
  );

  execute format(
    'delete from public.%I where id=$1 and ministry=$2 and entity=$3 returning id',
    v_table
  ) into v_deleted using p_id, upper(p_ministry), upper(p_entity);

  return v_deleted is not null;
end;
$$;

create or replace function public.government_module_history(
  p_ministry text,
  p_entity text,
  p_domain text,
  p_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  if not public.government_context_authorized(p_ministry, p_entity) then
    raise exception 'Accès institutionnel non autorisé';
  end if;

  if public.government_domain_table(p_domain) is null then
    raise exception 'Domaine gouvernemental non pris en charge';
  end if;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc), '[]'::jsonb)
    into v_rows
  from public.government_record_events e
  where e.ministry = upper(p_ministry)
    and e.entity = upper(p_entity)
    and e.domain = lower(p_domain)
    and e.record_id = p_id;

  return jsonb_build_object('rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;

revoke all on function public.government_status_transition_allowed(text,text) from public;
revoke all on function public.government_module_save(text,text,text,jsonb) from public;
revoke all on function public.government_module_transition(text,text,text,bigint,text) from public;
revoke all on function public.government_module_delete(text,text,text,bigint) from public;
revoke all on function public.government_module_history(text,text,text,bigint) from public;

grant execute on function public.government_module_save(text,text,text,jsonb) to authenticated;
grant execute on function public.government_module_transition(text,text,text,bigint,text) to authenticated;
grant execute on function public.government_module_delete(text,text,text,bigint) to authenticated;
grant execute on function public.government_module_history(text,text,text,bigint) to authenticated;
