create or replace function public.government_workspace_snapshot(p_ministry text, p_entity text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_required text;
  v_result jsonb;
begin
  select upper(regexp_replace(coalesce(u.role, ''), '[^A-Za-z0-9]+', '_', 'g'))
    into v_role
  from public.users u
  where u.uid = auth.uid()::text
  limit 1;

  v_required := upper(regexp_replace(coalesce(p_ministry, ''), '[^A-Za-z0-9]+', '_', 'g'))
    || '_' || upper(regexp_replace(coalesce(p_entity, ''), '[^A-Za-z0-9]+', '_', 'g'));

  if v_role is null or not (
    v_role = v_required
    or v_role = upper(regexp_replace(coalesce(p_ministry, ''), '[^A-Za-z0-9]+', '_', 'g')) || '_ADMIN'
    or v_role = 'ETAT_ADMIN'
  ) then
    raise exception 'Accès institutionnel non autorisé';
  end if;

  select jsonb_build_object(
    'generatedAt', now(),
    'summary', jsonb_build_object(
      'schools', (select count(*) from public.schools),
      'activeSchools', (select count(*) from public.schools where coalesce(status, 'active') = 'active'),
      'users', (select count(*) from public.users where coalesce(status, 'active') = 'active'),
      'students', (select count(*) from public.students where coalesce(status, 'active') = 'active'),
      'personnel', (select count(*) from public.personnel),
      'classes', (select count(*) from public.classes where coalesce(status, 'active') = 'active'),
      'paymentsCount', (select count(*) from public.payments where coalesce(status, 'paid') = 'paid'),
      'paymentsTotal', (select coalesce(sum(amount), 0) from public.payments where coalesce(status, 'paid') = 'paid'),
      'incomeTotal', (select coalesce(sum(amount), 0) from public.transactions where lower(coalesce(type, '')) = 'income'),
      'expenseTotal', (select coalesce(sum(amount), 0) from public.transactions where lower(coalesce(type, '')) = 'expense'),
      'attendanceRecords', (select count(*) from public.attendance),
      'gradesRecords', (select count(*) from public.grades)
    ),
    'schools', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'identifier', s.identifier,
        'status', s.status,
        'address', s.address,
        'levels', s.levels,
        'createdAt', s.created_at
      ) order by s.name)
      from public.schools s
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object('role', x.role, 'count', x.total) order by x.total desc, x.role)
      from (
        select coalesce(nullif(role, ''), 'Non renseigné') role, count(*) total
        from public.users
        where coalesce(status, 'active') = 'active'
        group by 1
      ) x
    ), '[]'::jsonb),
    'classLevels', coalesce((
      select jsonb_agg(jsonb_build_object('level', x.level, 'count', x.total) order by x.total desc, x.level)
      from (
        select coalesce(nullif(level, ''), 'Non renseigné') level, count(*) total
        from public.classes
        where coalesce(status, 'active') = 'active'
        group by 1
      ) x
    ), '[]'::jsonb),
    'recentActivity', coalesce((
      select jsonb_agg(jsonb_build_object(
        'action', a.action,
        'schoolName', a.school_name,
        'userRole', a.user_role,
        'createdAt', a.created_at
      ) order by a.created_at desc)
      from (
        select action, school_name, user_role, created_at
        from public.activity_logs
        order by created_at desc
        limit 20
      ) a
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.government_workspace_snapshot(text, text) from public;
grant execute on function public.government_workspace_snapshot(text, text) to authenticated;
