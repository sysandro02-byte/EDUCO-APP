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

  // Browser requests should normally stay same-origin. In production this lets
  // Vercel's /api function proxy the request to Render while preserving the
  // public host WebAuthn uses as its RP ID and expected origin. It also keeps
  // local development on the Express/Vite server instead of calling Render.
  if (isLocalFrontendHost(window.location.hostname) || isInvalidApiBaseUrl(configuredBaseUrl)) {
    return cleanPath;
  }

  return `${configuredBaseUrl}${cleanPath}`;
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
