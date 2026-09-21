import { getApiUrl } from '../lib/apiConfig';
import { getSecureAuthHeaders } from './authHeaders';

let installed = false;
let handlingExpiry = false;

const isProtectedApiUrl = (url: URL) => {
  if (!url.pathname.startsWith('/api/')) return false;
  const publicAuthPaths = [
    '/api/auth/login',
    '/api/auth/admin-login',
    '/api/auth/register-school',
    '/api/auth/find-user',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/auth/verify-otp',
  ];
  return !publicAuthPaths.some((path) => url.pathname.startsWith(path));
};

const getAuthorizationHeader = (input: RequestInfo | URL, init?: RequestInit) => {
  const fromInit = new Headers(init?.headers || {}).get('authorization');
  if (fromInit) return fromInit;
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.headers.get('authorization');
  }
  return null;
};

const clearExpiredSession = () => {
  if (handlingExpiry || typeof window === 'undefined') return;
  handlingExpiry = true;
  try {
    localStorage.removeItem('EDUCO_CURRENT_USER');
    localStorage.removeItem('EDUCO_USER_TOKEN');
    sessionStorage.removeItem('EDUCO_SESSION_ACTIVE');
    sessionStorage.removeItem('otpVerified');
    sessionStorage.setItem('EDUCO_SESSION_EXPIRED', 'true');
    window.dispatchEvent(new Event('educo:session-expired'));
  } finally {
    window.setTimeout(() => window.location.reload(), 0);
  }
};

/**
 * Rebuild the transient PWA session marker only after the backend verifies a
 * real persistent credential. Cached profile data alone is never trusted.
 */
export async function restorePersistentSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem('EDUCO_SESSION_ACTIVE') === 'true') return true;

  const headers = await getSecureAuthHeaders();
  if (!headers.Authorization) return false;

  try {
    const response = await fetch(getApiUrl('/api/auth/me'), { headers });
    if (!response.ok) return false;
    const data = await response.json().catch(() => null);
    if (!data?.user) return false;

    localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(data.user));
    sessionStorage.setItem('EDUCO_SESSION_ACTIVE', 'true');
    sessionStorage.setItem('otpVerified', 'true');
    sessionStorage.removeItem('EDUCO_SESSION_EXPIRED');
    return true;
  } catch {
    // Offline startup must stay locked instead of trusting stale cached identity.
    return false;
  }
}

/**
 * Ensures an installed PWA cannot remain in a fake "connected" state after the
 * server session expires. Only authenticated protected API calls are observed;
 * a normal 401 from the login form is intentionally ignored.
 */
export function installSessionExpiryGuard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await nativeFetch(input, init);

    if (response.status === 401 && sessionStorage.getItem('EDUCO_SESSION_ACTIVE') === 'true') {
      try {
        const rawUrl = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
        const url = new URL(rawUrl, window.location.origin);
        const authorization = getAuthorizationHeader(input, init);
        if (isProtectedApiUrl(url) && authorization?.startsWith('Bearer ')) {
          clearExpiredSession();
        }
      } catch {
        // Never let session recovery interfere with the original HTTP response.
      }
    }

    return response;
  };
}
