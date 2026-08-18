import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://demo-educo.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export function isValidSupabaseUrl(urlString: any): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function extractRefFromJwt(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      let decodedPayload = '';
      if (typeof window !== 'undefined' && typeof window.atob === 'function') {
        decodedPayload = window.atob(payloadBase64);
      } else if (typeof Buffer !== 'undefined') {
        decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf8');
      }
      if (decodedPayload) {
        const parsed = JSON.parse(decodedPayload);
        if (parsed && parsed.ref) {
          return parsed.ref;
        }
      }
    }
  } catch (err) {
    console.warn('[SUPABASE CONFIG] Failed to extract ref from JWT:', err);
  }
  return null;
}

export function getStoredSupabaseConfig() {
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('EDUCO_SUPABASE_URL') : null;
  let viteEnv: any = {};
  try {
    viteEnv = (Function('return typeof import.meta !== "undefined" ? import.meta.env : {}')() || {});
  } catch {}

  const envUrl = (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL)) ||
    viteEnv?.VITE_SUPABASE_URL;

  const localKey = typeof window !== 'undefined' ? localStorage.getItem('EDUCO_SUPABASE_ANON_KEY') : null;
  const envKey = (typeof process !== 'undefined' && (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY)) ||
    viteEnv?.VITE_SUPABASE_ANON_KEY;

  let key = DEFAULT_SUPABASE_KEY;
  if (localKey && localKey.trim()) {
    key = localKey.trim();
  } else if (envKey && envKey.trim()) {
    key = envKey.trim();
  }

  let url = DEFAULT_SUPABASE_URL;
  if (localUrl && isValidSupabaseUrl(localUrl)) {
    url = localUrl.trim();
  } else if (envUrl && isValidSupabaseUrl(envUrl)) {
    url = envUrl.trim();
  } else {
    // Self-healing: extract from token or env key
    const ref = extractRefFromJwt(key) || (envUrl ? extractRefFromJwt(envUrl) : null);
    if (ref) {
      url = `https://${ref}.supabase.co`;
    }
  }

  if (url === DEFAULT_SUPABASE_URL || !isValidSupabaseUrl(url)) {
    const ref = extractRefFromJwt(key);
    if (ref) {
      url = `https://${ref}.supabase.co`;
    }
  }

  // Clear corrupted or invalid stored URL from localStorage
  if (typeof window !== 'undefined' && localUrl && !isValidSupabaseUrl(localUrl)) {
    try {
      localStorage.removeItem('EDUCO_SUPABASE_URL');
    } catch {}
  }

  const dbUrl = (typeof window !== 'undefined' ? localStorage.getItem('EDUCO_SUPABASE_DB_URL') : null) || '';

  return { url, key, dbUrl };
}

let activeClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  const { url, key } = getStoredSupabaseConfig();
  if (!activeClient) {
    const safeUrl = isValidSupabaseUrl(url) ? url : DEFAULT_SUPABASE_URL;
    const safeKey = key || DEFAULT_SUPABASE_KEY;
    try {
      activeClient = createClient(safeUrl, safeKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.warn('[SUPABASE INIT WARNING] Could not initialize Supabase client with stored config. Falling back to default URL:', err);
      activeClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
  }
  return activeClient;
}

export function resetSupabaseClient(rawUrl: string, rawKey: string) {
  const safeUrl = isValidSupabaseUrl(rawUrl) ? rawUrl.trim() : DEFAULT_SUPABASE_URL;
  const safeKey = (rawKey && rawKey.trim()) ? rawKey.trim() : DEFAULT_SUPABASE_KEY;

  if (typeof window !== 'undefined') {
    if (isValidSupabaseUrl(rawUrl)) {
      localStorage.setItem('EDUCO_SUPABASE_URL', safeUrl);
    } else {
      localStorage.removeItem('EDUCO_SUPABASE_URL');
    }
    localStorage.setItem('EDUCO_SUPABASE_ANON_KEY', safeKey);
  }

  try {
    activeClient = createClient(safeUrl, safeKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn('[SUPABASE RESET WARNING] Could not reset Supabase client with provided URL, using fallback:', err);
    activeClient = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return activeClient;
}

export const supabase = getSupabaseClient();

export async function testSupabaseConnection() {
  const client = getSupabaseClient();
  const { url } = getStoredSupabaseConfig();

  try {
    // 1) Test supabase.auth.getSession() as requested
    const sessionRes = await client.auth.getSession().catch(err => ({ data: { session: null }, error: { message: err?.message || 'Failed to fetch' } }));
    const sessionData = sessionRes?.data;
    const sessionError = sessionRes?.error;
    
    // 2) Test select query on users & schools
    const { data: usersData, error: usersError } = await client
      .from('users')
      .select('*')
      .limit(5);

    const { data: schoolsData, error: schoolsError } = await client
      .from('schools')
      .select('*')
      .limit(5);

    return {
      success: !usersError || !schoolsError,
      supabaseUrl: url,
      session: sessionData?.session || null,
      sessionError: sessionError?.message || null,
      users: usersData || [],
      usersError: usersError?.message || null,
      schools: schoolsData || [],
      schoolsError: schoolsError?.message || null,
    };
  } catch (err: any) {
    return {
      success: false,
      supabaseUrl: url,
      error: err?.message || 'Erreur lors du test Supabase',
    };
  }
}

export function generateSupabaseSetupSQL(): string {
  return `-- SQL SCRIPT DE CRÉATION DE TABLES ET DÉSACTIVATION RLS (A COPIER DANS LE SQL EDITOR DE SUPABASE)

-- 1. Table Schools
CREATE TABLE IF NOT EXISTS public.schools (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  identifier TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo TEXT,
  creation_date TEXT,
  promoter_name TEXT,
  promoter_contact TEXT,
  promoter_email TEXT,
  levels JSONB DEFAULT '{}'::jsonb,
  opening_authorization_doc TEXT,
  promoter_id_doc TEXT,
  statutes_doc TEXT,
  status TEXT DEFAULT 'active',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Table Users
CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Table Classes
CREATE TABLE IF NOT EXISTS public.classes (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT,
  capacity INTEGER,
  teacher_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL
);

-- 4. Table Personnel
CREATE TABLE IF NOT EXISTS public.personnel (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  matricule TEXT,
  role TEXT,
  base_salary DOUBLE PRECISION,
  hire_date TEXT,
  bank_account TEXT
);

-- 5. Table Students
CREATE TABLE IF NOT EXISTS public.students (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id TEXT UNIQUE,
  class_id INTEGER REFERENCES public.classes(id) ON DELETE SET NULL,
  parent_name TEXT,
  parent_phone TEXT,
  address TEXT,
  date_of_birth TEXT,
  enrollment_date TEXT,
  status TEXT DEFAULT 'active'
);

-- 6. Table Fees
CREATE TABLE IF NOT EXISTS public.fees (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  due_date TEXT,
  type TEXT
);

-- 7. Table Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category TEXT,
  amount DOUBLE PRECISION NOT NULL,
  description TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recorded_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL
);

-- 8. Table Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
  fee_id INTEGER REFERENCES public.fees(id) ON DELETE SET NULL,
  amount DOUBLE PRECISION NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  receipt_number TEXT UNIQUE,
  payment_method TEXT,
  status TEXT DEFAULT 'paid'
);

-- 9. Table Subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  coefficient INTEGER DEFAULT 1
);

-- 10. Table Grades
CREATE TABLE IF NOT EXISTS public.grades (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES public.subjects(id) ON DELETE SET NULL,
  class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  max_score DOUBLE PRECISION DEFAULT 20,
  term TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teacher_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL
);

-- 11. Table Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES public.students(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  date TEXT NOT NULL,
  recorded_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL
);

-- 12. Table Timetable
CREATE TABLE IF NOT EXISTS public.timetable (
  id SERIAL PRIMARY KEY,
  class_id INTEGER REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  room TEXT
);

-- 13. Table Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Table Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE SET NULL,
  school_name TEXT NOT NULL,
  school_identifier TEXT NOT NULL,
  promoter_name TEXT NOT NULL,
  promoter_contact TEXT,
  plan_type TEXT NOT NULL,
  amount_paid DOUBLE PRECISION NOT NULL,
  months INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  auto_renew BOOLEAN DEFAULT false,
  auto_renew_frequency TEXT DEFAULT 'before_expiry',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. Table Subscription Requests
CREATE TABLE IF NOT EXISTS public.subscription_requests (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  school_identifier TEXT NOT NULL,
  school_name TEXT NOT NULL,
  promoter_name TEXT NOT NULL,
  promoter_contact TEXT,
  requested_plan TEXT NOT NULL,
  requested_months INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Table Surveys
CREATE TABLE IF NOT EXISTS public.surveys (
  id SERIAL PRIMARY KEY,
  school_id INTEGER REFERENCES public.schools(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Général',
  target_audience TEXT DEFAULT 'all',
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  creator_name TEXT,
  creator_role TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. Table Survey Responses
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id SERIAL PRIMARY KEY,
  survey_id INTEGER REFERENCES public.surveys(id) ON DELETE CASCADE,
  parent_name TEXT NOT NULL,
  parent_phone TEXT,
  parent_email TEXT,
  student_name TEXT,
  student_class TEXT,
  channel TEXT DEFAULT 'whatsapp',
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  comment TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 18. Désactivation RLS pour un accès fluide avec la clé Supabase
ALTER TABLE public.schools DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.personnel DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.grades DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses DISABLE ROW LEVEL SECURITY;

-- ACCORDER les droits aux rôles anonymes, authentifiés et service_role
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
`;
}
