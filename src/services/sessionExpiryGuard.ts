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
