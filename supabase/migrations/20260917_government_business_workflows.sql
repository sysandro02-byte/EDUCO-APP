-- EDUCO government business workflows
-- Additive migration: no existing school/university table is modified.

create or replace function public.government_context_authorized(p_ministry text, p_entity text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_ministry text;
  v_entity text;
  v_required text;
begin
  v_ministry := upper(regexp_replace(coalesce(p_ministry, ''), '[^A-Za-z0-9]+', '_', 'g'));
  v_entity := upper(regexp_replace(coalesce(p_entity, ''), '[^A-Za-z0-9]+', '_', 'g'));
  if v_ministry not in ('MEPSA', 'MES', 'METP') or v_entity = '' then
    return false;
  end if;

  select upper(regexp_replace(coalesce(u.role, ''), '[^A-Za-z0-9]+', '_', 'g'))
    into v_role
  from public.users u
  where u.uid = auth.uid()::text
  limit 1;

  v_required := v_ministry || '_' || v_entity;
  return v_role is not null and (
    v_role = v_required
    or v_role = v_ministry || '_ADMIN'
    or v_role = 'ETAT_ADMIN'
  );
end;
$$;

revoke all on function public.government_context_authorized(text, text) from public;
grant execute on function public.government_context_authorized(text, text) to authenticated;

create table if not exists public.government_inspections (
  id bigserial primary key,
  ministry text not null check (ministry in ('MEPSA','MES','METP')),
  entity text not null,
  title text not null,
  reference text,
  status text not null default 'Brouillon',
  description text,
  school_id bigint references public.schools(id) on delete set null,
  due_date date,
  data jsonb not null default '{}'::jsonb,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.government_national_exams (like public.government_inspections including defaults including constraints including indexes);
create table if not exists public.government_accreditations (like public.government_inspections including defaults including constraints including indexes);
create table if not exists public.government_hr_movements (like public.government_inspections including defaults including constraints including indexes);
create table if not exists public.government_infrastructures (like public.government_inspections including defaults including constraints including indexes);
create table if not exists public.government_assets (like public.government_inspections including defaults including constraints including indexes);
create table if not exists public.government_validation_cases (like public.government_inspections including defaults including constraints including indexes);
create table if not exists public.government_projects (like public.government_inspections including defaults including constraints including indexes);
create table if not exists public.government_decisions (like public.government_inspections including defaults including constraints including indexes);
create table if not exists public.government_school_map (like public.government_inspections including defaults including constraints including indexes);

-- LIKE does not copy the foreign-key constraint. Add it explicitly where absent.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'government_national_exams','government_accreditations','government_hr_movements',
    'government_infrastructures','government_assets','government_validation_cases',
    'government_projects','government_decisions','government_school_map'
  ] loop
    if not exists (
      select 1 from pg_constraint c
      join pg_class r on r.oid = c.conrelid
      where r.relname = v_table and c.contype = 'f'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (school_id) references public.schools(id) on delete set null',
        v_table, v_table || '_school_id_fkey'
      );
    end if;
  end loop;
end $$;

-- Fast context/status lookups for ministry dashboards.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'government_inspections','government_national_exams','government_accreditations','government_hr_movements',
    'government_infrastructures','government_assets','government_validation_cases','government_projects',
    'government_decisions','government_school_map'
  ] loop
    execute format('create index if not exists %I on public.%I (ministry, entity, updated_at desc)', v_table || '_context_idx', v_table);
    execute format('create index if not exists %I on public.%I (status)', v_table || '_status_idx', v_table);
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from anon, authenticated', v_table);
  end loop;
end $$;

create or replace function public.government_domain_table(p_domain text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_domain, ''))
    when 'inspections' then 'government_inspections'
    when 'national_exams' then 'government_national_exams'
    when 'accreditations' then 'government_accreditations'
    when 'hr_movements' then 'government_hr_movements'
    when 'infrastructures' then 'government_infrastructures'
    when 'assets' then 'government_assets'
    when 'validation_cases' then 'government_validation_cases'
    when 'projects' then 'government_projects'
    when 'decisions' then 'government_decisions'
    when 'school_map' then 'government_school_map'
    else null
  end;
$$;

create or replace function public.government_module_records(p_ministry text, p_entity text, p_domain text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_rows jsonb;
begin
  if not public.government_context_authorized(p_ministry, p_entity) then
    raise exception 'Accès institutionnel non autorisé';
  end if;

  v_table := public.government_domain_table(p_domain);
  if v_table is null then
    raise exception 'Domaine gouvernemental non pris en charge';
  end if;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc), ''[]''::jsonb) from (select * from public.%I where ministry = $1 and entity = $2 order by updated_at desc limit 500) x',
    v_table
  ) into v_rows using upper(p_ministry), upper(p_entity);

  return jsonb_build_object('domain', lower(p_domain), 'rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;

create or replace function public.government_module_save(p_ministry text, p_entity text, p_domain text, p_record jsonb)
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
  v_status text;
  v_description text;
  v_school_id bigint;
  v_due_date date;
  v_data jsonb;
  v_actor text;
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
  v_status := coalesce(nullif(trim(coalesce(p_record->>'status', '')), ''), 'Brouillon');
  v_description := nullif(trim(coalesce(p_record->>'description', '')), '');
  v_school_id := nullif(p_record->>'schoolId', '')::bigint;
  v_due_date := nullif(p_record->>'dueDate', '')::date;
  v_data := coalesce(p_record->'data', '{}'::jsonb);
  v_actor := auth.uid()::text;
  v_id := nullif(p_record->>'id', '')::bigint;

  if v_id is null then
    execute format(
      'insert into public.%I (ministry, entity, title, reference, status, description, school_id, due_date, data, created_by, updated_by) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) returning id',
      v_table
    ) into v_id using upper(p_ministry), upper(p_entity), v_title, v_reference, v_status, v_description, v_school_id, v_due_date, v_data, v_actor;
  else
    execute format(
      'update public.%I set title=$4, reference=$5, status=$6, description=$7, school_id=$8, due_date=$9, data=$10, updated_by=$11, updated_at=now() where id=$1 and ministry=$2 and entity=$3 returning id',
      v_table
    ) into v_id using v_id, upper(p_ministry), upper(p_entity), v_title, v_reference, v_status, v_description, v_school_id, v_due_date, v_data, v_actor;
    if v_id is null then
      raise exception 'Dossier introuvable ou hors périmètre';
    end if;
  end if;

  execute format('select to_jsonb(x) from public.%I x where x.id=$1', v_table) into v_result using v_id;
  return v_result;
end;
$$;

create or replace function public.government_module_delete(p_ministry text, p_entity text, p_domain text, p_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table text;
  v_deleted bigint;
begin
  if not public.government_context_authorized(p_ministry, p_entity) then
    raise exception 'Accès institutionnel non autorisé';
  end if;
  v_table := public.government_domain_table(p_domain);
  if v_table is null then
    raise exception 'Domaine gouvernemental non pris en charge';
  end if;

  execute format('delete from public.%I where id=$1 and ministry=$2 and entity=$3 returning id', v_table)
    into v_deleted using p_id, upper(p_ministry), upper(p_entity);
  return v_deleted is not null;
end;
$$;

revoke all on function public.government_module_records(text,text,text) from public;
revoke all on function public.government_module_save(text,text,text,jsonb) from public;
revoke all on function public.government_module_delete(text,text,text,bigint) from public;
grant execute on function public.government_module_records(text,text,text) to authenticated;
grant execute on function public.government_module_save(text,text,text,jsonb) to authenticated;
grant execute on function public.government_module_delete(text,text,text,bigint) to authenticated;
