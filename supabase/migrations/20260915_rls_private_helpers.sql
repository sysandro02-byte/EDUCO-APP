-- EDUCO — move RLS SECURITY DEFINER helpers out of the exposed public schema.
-- Mirrors the production hardening applied to Supabase on 2026-09-15.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.educo_current_user_id()
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result_id integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN NULL; END IF;
  SELECT u.id INTO result_id FROM public.users u
  WHERE u.uid = (SELECT auth.uid())::text
     OR lower(u.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  LIMIT 1;
  RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.educo_current_school_id()
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result_id integer;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN NULL; END IF;
  SELECT u.school_id INTO result_id FROM public.users u
  WHERE u.uid = (SELECT auth.uid())::text
     OR lower(u.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  LIMIT 1;
  RETURN result_id;
END;
$$;

CREATE OR REPLACE FUNCTION private.educo_current_role()
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result_role text;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN RETURN NULL; END IF;
  SELECT u.role INTO result_role FROM public.users u
  WHERE u.uid = (SELECT auth.uid())::text
     OR lower(u.email) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  LIMIT 1;
  RETURN result_role;
END;
$$;

CREATE OR REPLACE FUNCTION private.educo_is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT lower(coalesce(private.educo_current_role(), '')) IN ('admin', 'co-admin', 'co admin');
$$;

REVOKE ALL ON FUNCTION private.educo_current_user_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.educo_current_school_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.educo_current_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.educo_is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.educo_current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.educo_current_school_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.educo_current_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.educo_is_platform_admin() TO authenticated, service_role;

DO $$
DECLARE p record; expr text;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname, qual FROM pg_policies WHERE schemaname='public' AND policyname LIKE 'educo_%' LOOP
    expr := p.qual;
    expr := replace(expr, 'educo_is_platform_admin()', 'private.educo_is_platform_admin()');
    expr := replace(expr, 'educo_current_user_id()', 'private.educo_current_user_id()');
    expr := replace(expr, 'educo_current_school_id()', 'private.educo_current_school_id()');
    EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', p.policyname, p.schemaname, p.tablename, expr);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.educo_is_platform_admin();
DROP FUNCTION IF EXISTS public.educo_current_role();
DROP FUNCTION IF EXISTS public.educo_current_school_id();
DROP FUNCTION IF EXISTS public.educo_current_user_id();
