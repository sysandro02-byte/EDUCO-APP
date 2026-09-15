import { getSupabaseClient, getStoredSupabaseConfig, isPlaceholderSupabaseUrl } from '../lib/supabase';

/**
 * Build API headers from real session credentials only.
 * Never treats cached user identity or browser Supabase configuration as authentication.
 */
export async function getSecureAuthHeaders(includeJson = true): Promise<Record<string, string>> {
  const headers: Record<string, string> = includeJson ? { 'Content-Type': 'application/json' } : {};

  try {
    const config = getStoredSupabaseConfig();
    let token = localStorage.getItem('EDUCO_USER_TOKEN') || '';

    if (!isPlaceholderSupabaseUrl(config.url)) {
      try {
        const supabase = getSupabaseClient();
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
        ]) as any;
        if (result?.data?.session?.access_token) token = result.data.session.access_token;
      } catch {
        // A signed EDUCO session can still be used when Supabase is temporarily unavailable.
      }
    }

    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Protected server routes will return 401 when no valid credential is available.
  }

  return headers;
}
