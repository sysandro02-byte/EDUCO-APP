/// <reference types="vite/client" />

// API Configuration for cross-origin or proxied API requests
const EDUCO_RENDER_API_URL = 'https://educo-app.onrender.com';
const LOCAL_FRONTEND_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];

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

  if (isLocalFrontendHost(window.location.hostname)) {
    return cleanPath;
  }

  const baseUrl = isInvalidApiBaseUrl(configuredBaseUrl) ? EDUCO_RENDER_API_URL : configuredBaseUrl;
  return `${baseUrl}${cleanPath}`;
}
