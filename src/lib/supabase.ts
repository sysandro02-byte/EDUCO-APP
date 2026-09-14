import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://your-project.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

const decodeJwt = (token?: string | null): any | null => {
  if (!token || token.split('.').length !== 3) return null;
  try {
    let payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    const decoded = typeof window !== 'undefined' && typeof window.atob === 'function'
      ? window.atob(payload)
      : (typeof Buffer !== 'undefined' ? Buffer.from(payload, 'base64').toString('utf8') : '');
    return decoded ? JSON.parse(decoded) : null;
  } catch {
    return null;
  }
};

const isServiceRoleKey = (key?: string | null) => decodeJwt(key)?.role === 'service_role';

const readPublicEnvironment = () => {
  let viteEnv: Record<string, string | undefined> = {};
  try {
    viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
  } catch {}

  const processEnv = typeof process !== 'undefined' ? process.env : {};
  return {
    url: viteEnv.VITE_SUPABASE_URL || processEnv.VITE_SUPABASE_URL || processEnv.SUPABASE_URL || '',
    // Only public/anon credentials belong in this browser-facing module.
    key: viteEnv.VITE_SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY || processEnv.SUPABASE_ANON_KEY || '',
  };
};

export function isPlaceholderSupabaseUrl(url?: string | null): boolean {
  return !url || url.includes('your-project.supabase.co') || url.includes('demo-educo.supabase.co');
}

export function isValidSupabaseUrl(urlString: any): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  if (!/^https:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.hostname && (parsed.hostname.endsWith('.supabase.co') || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'));
  } catch {
    return false;
  }
}

export function extractRefFromJwt(token: string): string | null {
  const ref = decodeJwt(token)?.ref;
  return typeof ref === 'string' && /^[a-z0-9-]+$/i.test(ref) ? ref : null;
}

export function getStoredSupabaseConfig() {
  const publicEnv = readPublicEnvironment();
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('EDUCO_SUPABASE_URL') : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('EDUCO_SUPABASE_ANON_KEY') : null;

  let key = String(localKey || publicEnv.key || DEFAULT_SUPABASE_KEY).trim();
  if (isServiceRoleKey(key)) {
    console.error('[EDUCO SECURITY] Une clé service_role ne doit jamais être stockée dans le navigateur.');
    if (typeof window !== 'undefined') localStorage.removeItem('EDUCO_SUPABASE_ANON_KEY');
    key = String(publicEnv.key || DEFAULT_SUPABASE_KEY).trim();
    if (isServiceRoleKey(key)) key = DEFAULT_SUPABASE_KEY;
  }

  let url = isValidSupabaseUrl(localUrl) ? String(localUrl).trim() : '';
  if (!url && isValidSupabaseUrl(publicEnv.url)) url = String(publicEnv.url).trim();
  if (!url) {
    const ref = extractRefFromJwt(key);
    if (ref) url = `https://${ref}.supabase.co`;
  }
  if (!url) url = DEFAULT_SUPABASE_URL;

  if (typeof window !== 'undefined' && localUrl && !isValidSupabaseUrl(localUrl)) {
    localStorage.removeItem('EDUCO_SUPABASE_URL');
  }

  const dbUrl = typeof window !== 'undefined' ? (localStorage.getItem('EDUCO_SUPABASE_DB_URL') || '') : '';
  return { url, key, dbUrl };
}

let activeClient: SupabaseClient | null = null;
let activeFingerprint = '';

export function getSupabaseClient(): SupabaseClient {
  const { url, key } = getStoredSupabaseConfig();
  const safeUrl = isValidSupabaseUrl(url) ? url : DEFAULT_SUPABASE_URL;
  const safeKey = key && !isServiceRoleKey(key) ? key : DEFAULT_SUPABASE_KEY;
  const fingerprint = `${safeUrl}|${safeKey.slice(-16)}`;

  if (!activeClient || activeFingerprint !== fingerprint) {
    activeClient = createClient(safeUrl, safeKey, {
      auth: {
        persistSession: typeof window !== 'undefined',
        autoRefreshToken: typeof window !== 'undefined',
        detectSessionInUrl: typeof window !== 'undefined',
      },
    });
    activeFingerprint = fingerprint;
  }
  return activeClient;
}

export function resetSupabaseClient(rawUrl: string, rawKey: string) {
  const safeUrl = isValidSupabaseUrl(rawUrl) ? rawUrl.trim() : DEFAULT_SUPABASE_URL;
  const safeKey = String(rawKey || '').trim() || DEFAULT_SUPABASE_KEY;

  if (isServiceRoleKey(safeKey)) {
    throw new Error('Clé refusée : utilisez uniquement la clé Supabase anon/publishable dans le navigateur.');
  }

  if (typeof window !== 'undefined') {
    if (isValidSupabaseUrl(rawUrl)) localStorage.setItem('EDUCO_SUPABASE_URL', safeUrl);
    else localStorage.removeItem('EDUCO_SUPABASE_URL');
    localStorage.setItem('EDUCO_SUPABASE_ANON_KEY', safeKey);
  }

  activeClient = null;
  activeFingerprint = '';
  return getSupabaseClient();
}

export const supabase = getSupabaseClient();

export async function testSupabaseConnection() {
  const client = getSupabaseClient();
  const { url } = getStoredSupabaseConfig();
  try {
    const sessionRes = await client.auth.getSession();
    const session = sessionRes.data?.session || null;
    let profile: any = null;
    let profileError: string | null = null;

    if (session?.user?.id || session?.user?.email) {
      const query = client.from('users').select('id,uid,name,email,role,school_id,status').limit(1);
      const { data, error } = session.user.id
        ? await query.eq('uid', session.user.id).maybeSingle()
        : await query.eq('email', session.user.email || '').maybeSingle();
      profile = data || null;
      profileError = error?.message || null;
    }

    return {
      success: !sessionRes.error,
      supabaseUrl: url,
      session,
      sessionError: sessionRes.error?.message || null,
      profile,
      profileError,
      rlsExpected: true,
    };
  } catch (err: any) {
    return { success: false, supabaseUrl: url, error: err?.message || 'Erreur lors du test Supabase' };
  }
}

/**
 * SQL de durcissement à exécuter APRÈS la création du schéma EDUCO.
 * Les écritures applicatives restent volontairement sans policy côté navigateur :
 * elles doivent passer par le backend, qui utilise la service-role uniquement sur le serveur.
 */
export function generateSupabaseSetupSQL(): string {
  return `-- EDUCO — DURCISSEMENT SUPABASE / RLS
-- À exécuter après la création des tables.
-- Ne placez JAMAIS la service_role dans VITE_* ou dans localStorage.

-- 1) Fonctions de contexte. SECURITY DEFINER évite la récursion des policies sur public.users.
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
EXCEPTION WHEN undefined_table THEN
  RETURN NULL;
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
EXCEPTION WHEN undefined_table THEN
  RETURN NULL;
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
EXCEPTION WHEN undefined_table THEN
  RETURN NULL;
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

-- 2) Active RLS sur toutes les tables métier présentes.
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

-- 3) Policies de lecture. Aucune policy INSERT/UPDATE/DELETE n'est créée :
-- les mutations sensibles passent obligatoirement par l'API EDUCO.
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

-- 4) L'anon ne reçoit aucune policy métier. La service_role du backend contourne RLS
-- comme prévu par Supabase; elle doit rester uniquement dans les variables secrètes Render.
`;
}
