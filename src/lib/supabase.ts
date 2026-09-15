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
const isSecretSupabaseKey = (key?: string | null) => /^sb_secret_/i.test(String(key || '').trim());
const isUnsafeBrowserKey = (key?: string | null) => isServiceRoleKey(key) || isSecretSupabaseKey(key);

const readPublicEnvironment = () => {
  let viteEnv: Record<string, string | undefined> = {};
  try {
    viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
  } catch {}

  const processEnv = typeof process !== 'undefined' ? process.env : {};
  return {
    url: viteEnv.VITE_SUPABASE_URL || processEnv.VITE_SUPABASE_URL || processEnv.SUPABASE_URL || '',
    key: viteEnv.VITE_SUPABASE_ANON_KEY || processEnv.VITE_SUPABASE_ANON_KEY || processEnv.SUPABASE_ANON_KEY || '',
  };
};

export function isPlaceholderSupabaseUrl(url?: string | null): boolean {
  return !url || url.includes('your-project.supabase.co') || url.includes('demo-educo.supabase.co');
}

export function isValidSupabaseUrl(urlString: any): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  const trimmed = urlString.trim();
  try {
    const parsed = new URL(trimmed);
    const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (isLocal) return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co');
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
  if (isUnsafeBrowserKey(key)) {
    console.error('[EDUCO SECURITY] Une clé Supabase secrète/service_role ne doit jamais être stockée dans le navigateur.');
    if (typeof window !== 'undefined') localStorage.removeItem('EDUCO_SUPABASE_ANON_KEY');
    key = String(publicEnv.key || DEFAULT_SUPABASE_KEY).trim();
    if (isUnsafeBrowserKey(key)) key = DEFAULT_SUPABASE_KEY;
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
  const safeKey = key && !isUnsafeBrowserKey(key) ? key : DEFAULT_SUPABASE_KEY;
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

  if (isUnsafeBrowserKey(safeKey)) {
    throw new Error('Clé refusée : utilisez uniquement une clé Supabase anon/publishable dans le navigateur.');
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
 * Le schéma RLS de production est versionné dans supabase/migrations/.
 * Cette fonction est conservée pour compatibilité avec l'ancien écran admin,
 * mais ne doit plus générer de fonctions SECURITY DEFINER publiques obsolètes.
 */
export function generateSupabaseSetupSQL(): string {
  return `-- EDUCO — configuration RLS versionnée\n-- Utilisez les migrations Supabase du dépôt (supabase/migrations).\n-- Les écritures sensibles passent par le backend et aucune clé secrète ne doit être exposée au navigateur.\n`;
}
