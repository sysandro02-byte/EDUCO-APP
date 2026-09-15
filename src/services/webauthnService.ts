import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { getApiUrl } from '../lib/apiConfig';
import { getSupabaseClient, getStoredSupabaseConfig, isPlaceholderSupabaseUrl } from '../lib/supabase';

export interface WebAuthnDevice { id: string; credentialId: string; deviceName: string; deviceType: string; transports?: string[]; createdAt: string; lastUsedAt?: string; }
export interface WebAuthnAvailability { supported: boolean; reason?: string; localhostUrl?: string; }

const isLocalNetworkHostname = (hostname: string): boolean => hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
const getLocalhostUrl = (): string | undefined => {
  if (typeof window === 'undefined' || !isLocalNetworkHostname(window.location.hostname)) return undefined;
  const nextUrl = new URL(window.location.href); nextUrl.hostname = 'localhost'; return nextUrl.toString();
};

async function secureHeaders(): Promise<Record<string, string>> {
  let token = typeof localStorage !== 'undefined' ? localStorage.getItem('EDUCO_USER_TOKEN') || '' : '';
  try {
    const config = getStoredSupabaseConfig();
    if (!isPlaceholderSupabaseUrl(config.url)) {
      const result = await Promise.race([getSupabaseClient().auth.getSession(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))]) as any;
      if (result?.data?.session?.access_token) token = result.data.session.access_token;
    }
  } catch {}
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : { 'Content-Type': 'application/json' };
}

export function getWebAuthnAvailability(): WebAuthnAvailability {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || typeof window.PublicKeyCredential !== 'function') return { supported: false, reason: 'Votre navigateur ne prend pas en charge la connexion biométrique (WebAuthn).' };
  if (!window.isSecureContext) {
    const localhostUrl = getLocalhostUrl();
    return { supported: false, reason: localhostUrl ? 'La biométrie est bloquée sur cette adresse IP locale. Ouvrez cette même page avec localhost pour l’utiliser en développement.' : 'La biométrie doit être ouverte depuis une adresse HTTPS. En développement, utilisez http://localhost plutôt qu’une adresse IP locale.', localhostUrl };
  }
  return { supported: true };
}

export async function readApiJson(response: Response): Promise<any> {
  const body = await response.text(); const contentType = response.headers.get('content-type') || '';
  if (!body.trim()) { if (response.ok) return {}; throw new Error(`Le service biométrique n'a renvoyé aucun détail (HTTP ${response.status}).`); }
  try { return JSON.parse(body); } catch {
    const looksLikeHtml = /text\/html/i.test(contentType) || /^\s*</.test(body);
    throw new Error(looksLikeHtml ? `Le service biométrique est indisponible (HTTP ${response.status}) : le proxy API a renvoyé une page HTML au lieu de JSON.` : `Le service biométrique a renvoyé une réponse non-JSON invalide (HTTP ${response.status}).`);
  }
}

export function isWebAuthnSupported(): boolean { return getWebAuthnAvailability().supported; }
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try { if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (err) { console.warn('Error checking platform authenticator availability:', err); }
  return false;
}

export function detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Appareil Connecté';
  const ua = navigator.userAgent; let os = 'Appareil';
  if (/iPhone/i.test(ua)) os = 'iPhone (Face ID / Touch ID)'; else if (/iPad/i.test(ua)) os = 'iPad (Face ID / Touch ID)'; else if (/Macintosh|Mac OS X/i.test(ua)) os = 'MacBook / Mac (Touch ID)'; else if (/Windows/i.test(ua)) os = 'PC Windows (Windows Hello)'; else if (/Android/i.test(ua)) os = 'Android (Empreinte / Visage)'; else if (/Linux/i.test(ua)) os = 'Linux';
  let browser = 'Navigateur'; if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome'; else if (/Edg/i.test(ua)) browser = 'Edge'; else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'; else if (/Firefox/i.test(ua)) browser = 'Firefox';
  return `${os} — ${browser}`;
}

export function mapWebAuthnError(err: any): string {
  if (!err) return 'Une erreur biométrique est survenue.';
  const name = err.name || ''; const message = err.message || String(err); const normalized = message.toLowerCase();
  if (name === 'NotAllowedError' || name === 'AbortError' || normalized.includes('cancelled') || normalized.includes('canceled') || normalized.includes('denied') || normalized.includes('not allowed') || normalized.includes('timed out')) return 'Authentification biométrique annulée ou refusée par l’utilisateur.';
  if (name === 'InvalidStateError') return 'Cet appareil est déjà enregistré pour ce compte EDUCO.';
  if (name === 'NotSupportedError') return 'Votre navigateur ou cet appareil ne prend pas en charge la biométrie (Passkeys).';
  if (name === 'SecurityError') return 'La biométrie doit être ouverte depuis une adresse HTTPS. En développement, utilisez http://localhost plutôt qu’une adresse IP locale.';
  if (/PASSKEY_NOT_REGISTERED|PASSKEY_NOT_FOUND|No biometric credential|Aucune clé/i.test(message)) return 'Aucune clé biométrique active n’est disponible pour ce compte sur cet appareil. Connectez-vous avec votre mot de passe, puis activez la biométrie dans votre profil.';
  return message || 'L’authentification biométrique n’a pas pu être vérifiée.';
}

export async function registerWebAuthnCredential(email: string, userId?: string, userName?: string, customDeviceName?: string): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const availability = getWebAuthnAvailability(); if (!availability.supported) return { success: false, message: '', error: availability.reason };
    const deviceName = customDeviceName || detectDeviceName(); const headers = await secureHeaders();
    const optionsRes = await fetch(getApiUrl('/api/auth/webauthn/register/options'), { method: 'POST', headers, body: JSON.stringify({ deviceName }) });
    const optionsData = await readApiJson(optionsRes); if (!optionsRes.ok || !optionsData.options) throw new Error(optionsData.error || 'Impossible d’obtenir les options d’enregistrement biométrique.');
    const registrationResponse = await startRegistration({ optionsJSON: optionsData.options });
    const verifyRes = await fetch(getApiUrl('/api/auth/webauthn/register/verify'), { method: 'POST', headers: await secureHeaders(), body: JSON.stringify({ deviceName, registrationResponse }) });
    const verifyData = await readApiJson(verifyRes); if (!verifyRes.ok || !verifyData.verified) throw new Error(verifyData.error || 'Échec de la validation de la clé biométrique par le serveur.');
    return { success: true, message: verifyData.message || 'Authentification biométrique configurée avec succès !' };
  } catch (err: any) { console.error('WebAuthn Registration Error:', err); return { success: false, message: '', error: mapWebAuthnError(err) }; }
}

export async function loginWithWebAuthn(email?: string): Promise<{ success: boolean; userEmail?: string; userId?: string; token?: string; user?: any; message?: string; error?: string }> {
  try {
    const availability = getWebAuthnAvailability(); if (!availability.supported) return { success: false, error: availability.reason };
    const optionsRes = await fetch(getApiUrl('/api/auth/webauthn/login/options'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email || '' }) });
    const optionsData = await readApiJson(optionsRes); if (!optionsRes.ok || !optionsData.options) throw new Error(`${optionsData.code ? `${optionsData.code}: ` : ''}${optionsData.error || 'Impossible d’initialiser la biométrie.'}`);
    const authenticationResponse = await startAuthentication({ optionsJSON: optionsData.options });
    const verifyRes = await fetch(getApiUrl('/api/auth/webauthn/login/verify'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ authenticationResponse, challengeId: optionsData.challengeId }) });
    const verifyData = await readApiJson(verifyRes); if (!verifyRes.ok || !verifyData.verified || !verifyData.token) throw new Error(`${verifyData.code ? `${verifyData.code}: ` : ''}${verifyData.error || 'Authentification biométrique non reconnue.'}`);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('EDUCO_USER_TOKEN', verifyData.token);
      if (verifyData.user) localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(verifyData.user));
    }
    return { success: true, userEmail: verifyData.userEmail, userId: verifyData.userId, token: verifyData.token, user: verifyData.user, message: verifyData.message || 'Connexion biométrique réussie !' };
  } catch (err: any) { console.error('WebAuthn Login Error:', err); return { success: false, error: mapWebAuthnError(err) }; }
}

export async function fetchUserDevices(_email: string): Promise<WebAuthnDevice[]> {
  try { const res = await fetch(getApiUrl('/api/auth/webauthn/devices'), { headers: await secureHeaders() }); if (!res.ok) return []; const data = await readApiJson(res); return data.devices || []; } catch (err) { console.error('Error fetching devices:', err); return []; }
}
export async function renameUserDevice(id: string, newName: string): Promise<boolean> {
  try { const res = await fetch(getApiUrl(`/api/auth/webauthn/devices/${encodeURIComponent(id)}`), { method: 'PATCH', headers: await secureHeaders(), body: JSON.stringify({ deviceName: newName }) }); return res.ok; } catch (err) { console.error('Error renaming device:', err); return false; }
}
export async function revokeUserDevice(id: string): Promise<boolean> {
  try { const res = await fetch(getApiUrl(`/api/auth/webauthn/devices/${encodeURIComponent(id)}`), { method: 'DELETE', headers: await secureHeaders() }); return res.ok; } catch (err) { console.error('Error revoking device:', err); return false; }
}
