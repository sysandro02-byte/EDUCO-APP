-- Harden EDUCO government workflow RPC exposure and table sequences.
-- The public RPCs remain available only to authenticated users; internal helper
-- functions are no longer directly callable from the exposed API roles.

revoke execute on function public.government_context_authorized(text,text) from public, anon, authenticated;
revoke execute on function public.government_domain_table(text) from public, anon, authenticated;
revoke execute on function public.government_status_transition_allowed(text,text) from public, anon, authenticated;

revoke execute on function public.government_module_records(text,text,text) from public, anon;
revoke execute on function public.government_module_save(text,text,text,jsonb) from public, anon;
revoke execute on function public.government_module_transition(text,text,text,bigint,text) from public, anon;
revoke execute on function public.government_module_delete(text,text,text,bigint) from public, anon;
revoke execute on function public.government_module_history(text,text,text,bigint) from public, anon;
revoke execute on function public.government_workspace_snapshot(text,text) from public, anon;

grant execute on function public.government_module_records(text,text,text) to authenticated;
grant execute on function public.government_module_save(text,text,text,jsonb) to authenticated;
grant execute on function public.government_module_transition(text,text,text,bigint,text) to authenticated;
grant execute on function public.government_module_delete(text,text,text,bigint) to authenticated;
grant execute on function public.government_module_history(text,text,text,bigint) to authenticated;
grant execute on function public.government_workspace_snapshot(text,text) to authenticated;

alter function public.government_domain_table(text) set search_path = public;
alter function public.government_status_transition_allowed(text,text) set search_path = public;

-- Tables cloned with LIKE initially inherited the source sequence default.
-- Give each register its own sequence before production records are created.
do $$
declare
  v_table text;
  v_seq text;
begin
  foreach v_table in array array[
    'government_national_exams','government_accreditations','government_hr_movements',
    'government_infrastructures','government_assets','government_validation_cases',
    'government_projects','government_decisions','government_school_map'
  ] loop
    v_seq := v_table || '_id_seq';
    execute format('create sequence if not exists public.%I', v_seq);
    execute format('alter sequence public.%I owned by public.%I.id', v_seq, v_table);
    execute format('alter table public.%I alter column id set default nextval(''public.%I''::regclass)', v_table, v_seq);
  end loop;
end $$;

-- Use an explicit second SELECT after the update instead of relying on a
-- dynamic RETURNING row expression. This keeps the workflow RPC portable and
-- easy to audit.
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
  v_updated_id bigint;
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
    'update public.%I set status=$4, updated_by=$5, updated_at=now() where id=$1 and ministry=$2 and entity=$3 returning id',
    v_table
  ) into v_updated_id using p_id, upper(p_ministry), upper(p_entity), v_new_status, v_actor;

  if v_updated_id is null then
    raise exception 'Dossier introuvable ou hors périmètre';
  end if;

  insert into public.government_record_events(
    ministry, entity, domain, record_id, action, from_status, to_status, actor_uid
  ) values (
    upper(p_ministry), upper(p_entity), lower(p_domain), p_id,
    'Changement de statut', v_old_status, v_new_status, v_actor
  );

  execute format('select to_jsonb(x) from public.%I x where x.id=$1', v_table)
    into v_result using p_id;
  return v_result;
end;
$$;

revoke execute on function public.government_module_transition(text,text,text,bigint,text) from public, anon;
grant execute on function public.government_module_transition(text,text,text,bigint,text) to authenticated;
