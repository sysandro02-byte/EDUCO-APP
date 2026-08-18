/// <reference types="vite/client" />

// API Configuration for cross-origin or proxied API requests

export function getApiUrl(path: string): string {
  const meta = import.meta as any;
  const baseUrl = (meta.env?.VITE_API_URL || meta.env?.VITE_BACKEND_URL || '').replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}
