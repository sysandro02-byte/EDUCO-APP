-- EDUCO — Supabase RLS hardening
-- Apply with the Supabase migration workflow after the schema exists.
-- Browser clients receive read-only, school-scoped access. All mutations go through EDUCO API.

CREATE OR REPLACE FUNCTION public.educo_current_user_id()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result_id integer;
BEGIN
  EXECUTE 'SELECT id FROM public.users WHERE uid = $1 OR lower(email) = lower($2) LIMIT 1'
    INTO result_id
    USING auth.uid()::text, coalesce(auth.jwt() ->> 'email', '');
  RETURN result_id;
EXCEPTION WHEN undefined_table THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.educo_current_school_id()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result_id integer;
BEGIN
  EXECUTE 'SELECT school_id FROM public.users WHERE uid = $1 OR lower(email) = lower($2) LIMIT 1'
    INTO result_id
    USING auth.uid()::text, coalesce(auth.jwt() ->> 'email', '');
  RETURN result_id;
EXCEPTION WHEN undefined_table THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.educo_current_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result_role text;
BEGIN
  EXECUTE 'SELECT role FROM public.users WHERE uid = $1 OR lower(email) = lower($2) LIMIT 1'
    INTO result_role
    USING auth.uid()::text, coalesce(auth.jwt() ->> 'email', '');
  RETURN result_role;
EXCEPTION WHEN undefined_table THEN RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.educo_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(public.educo_current_role(), '')) IN ('admin', 'co-admin', 'co admin');
$$;

REVOKE ALL ON FUNCTION public.educo_current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.educo_current_school_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.educo_current_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.educo_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.educo_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.educo_current_school_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.educo_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.educo_is_platform_admin() TO authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'schools','users','classes','personnel','students','fees','payments','transactions',
    'subjects','grades','attendance','timetable','notifications','subscriptions',
    'subscription_requests','surveys','survey_responses','activity_logs'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    DROP POLICY IF EXISTS educo_users_read ON public.users;
    CREATE POLICY educo_users_read ON public.users FOR SELECT TO authenticated
    USING (
      public.educo_is_platform_admin()
      OR id = public.educo_current_user_id()
      OR school_id = public.educo_current_school_id()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.schools') IS NOT NULL THEN
    DROP POLICY IF EXISTS educo_schools_read ON public.schools;
    CREATE POLICY educo_schools_read ON public.schools FOR SELECT TO authenticated
    USING (public.educo_is_platform_admin() OR id = public.educo_current_school_id());
  END IF;
END $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'classes','personnel','students','fees','payments','transactions','subjects',
    'subscriptions','subscription_requests','surveys','activity_logs'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS educo_school_read ON public.%I', table_name);
      EXECUTE format(
        'CREATE POLICY educo_school_read ON public.%I FOR SELECT TO authenticated USING (public.educo_is_platform_admin() OR school_id = public.educo_current_school_id())',
        table_name
      );
    END IF;
  END LOOP;
END $$;

DO $$ BEGIN
  IF to_regclass('public.grades') IS NOT NULL THEN
    DROP POLICY IF EXISTS educo_grades_read ON public.grades;
    CREATE POLICY educo_grades_read ON public.grades FOR SELECT TO authenticated
    USING (
      public.educo_is_platform_admin()
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = grades.student_id AND s.school_id = public.educo_current_school_id())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.attendance') IS NOT NULL THEN
    DROP POLICY IF EXISTS educo_attendance_read ON public.attendance;
    CREATE POLICY educo_attendance_read ON public.attendance FOR SELECT TO authenticated
    USING (
      public.educo_is_platform_admin()
      OR EXISTS (SELECT 1 FROM public.students s WHERE s.id = attendance.student_id AND s.school_id = public.educo_current_school_id())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.timetable') IS NOT NULL THEN
    DROP POLICY IF EXISTS educo_timetable_read ON public.timetable;
    CREATE POLICY educo_timetable_read ON public.timetable FOR SELECT TO authenticated
    USING (
      public.educo_is_platform_admin()
      OR EXISTS (SELECT 1 FROM public.classes c WHERE c.id = timetable.class_id AND c.school_id = public.educo_current_school_id())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    DROP POLICY IF EXISTS educo_notifications_read ON public.notifications;
    CREATE POLICY educo_notifications_read ON public.notifications FOR SELECT TO authenticated
    USING (public.educo_is_platform_admin() OR user_id = public.educo_current_user_id());
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.survey_responses') IS NOT NULL AND to_regclass('public.surveys') IS NOT NULL THEN
    DROP POLICY IF EXISTS educo_survey_responses_read ON public.survey_responses;
    CREATE POLICY educo_survey_responses_read ON public.survey_responses FOR SELECT TO authenticated
    USING (
      public.educo_is_platform_admin()
      OR EXISTS (SELECT 1 FROM public.surveys s WHERE s.id = survey_responses.survey_id AND s.school_id = public.educo_current_school_id())
    );
  END IF;
END $$;

-- No browser INSERT/UPDATE/DELETE policies are created intentionally.
-- The backend service-role bypasses RLS and is the only mutation path for sensitive data.
