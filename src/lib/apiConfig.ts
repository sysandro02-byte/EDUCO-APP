/// <reference types="vite/client" />

// API Configuration for cross-origin or proxied API requests
const LOCAL_FRONTEND_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];
const EDUCO_RENDER_API_URL = 'https://educo-app.onrender.com';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const isLocalFrontendHost = (host: string) => (
  LOCAL_FRONTEND_HOSTS.includes(host)
  || host.startsWith('192.168.')
  || host.startsWith('10.')
  || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
);

const isInvalidApiBaseUrl = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    !value
    || normalized.includes('your-render-service')
    || normalized.includes('example.com')
    || normalized.includes('localhost')
    || normalized.includes('127.0.0.1')
    || normalized.includes('vercel.app')
    || normalized.includes('loukatech.com')
    || normalized.includes('brevo.com')
  );
};

export function getApiUrl(path: string): string {
  const meta = import.meta as any;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const configuredBaseUrl = trimTrailingSlash(meta.env?.VITE_API_URL || meta.env?.VITE_BACKEND_URL || '');

  if (typeof window === 'undefined') {
    return configuredBaseUrl ? `${configuredBaseUrl}${cleanPath}` : cleanPath;
  }

  // Local development is served by Express/Vite, so it must remain same-origin.
  if (isLocalFrontendHost(window.location.hostname)) {
    return cleanPath;
  }

  // In production the Vercel deployment is static: it has no /api proxy.
  // Use an explicitly configured API when available, otherwise use the EDUCO
  // Render service. This prevents Vercel 404 pages from being mistaken for an
  // authentication failure.
  if (!isInvalidApiBaseUrl(configuredBaseUrl)) {
    return `${configuredBaseUrl}${cleanPath}`;
  }

  if (window.location.hostname === new URL(EDUCO_RENDER_API_URL).hostname) {
    return cleanPath;
  }

  return `${EDUCO_RENDER_API_URL}${cleanPath}`;
}

/** Public endpoint used for email and OTP operations. */
export function getEmailApiUrl(path: string): string {
  const meta = import.meta as any;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const configuredBaseUrl = trimTrailingSlash(meta.env?.VITE_API_URL || meta.env?.VITE_BACKEND_URL || '');

  if (typeof window === 'undefined' || isLocalFrontendHost(window.location.hostname)) {
    return configuredBaseUrl ? `${configuredBaseUrl}${cleanPath}` : cleanPath;
  }

  const baseUrl = isInvalidApiBaseUrl(configuredBaseUrl) ? EDUCO_RENDER_API_URL : configuredBaseUrl;
  return `${baseUrl}${cleanPath}`;
}
