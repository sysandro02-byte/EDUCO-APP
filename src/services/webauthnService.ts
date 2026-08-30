import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { getApiUrl } from '../lib/apiConfig';

export interface WebAuthnDevice {
  id: string;
  credentialId: string;
  deviceName: string;
  deviceType: string;
  transports?: string[];
  createdAt: string;
  lastUsedAt?: string;
}

export interface WebAuthnAvailability {
  supported: boolean;
  reason?: string;
}

/**
 * WebAuthn is a powerful browser feature and is deliberately unavailable on
 * regular HTTP origins. `PublicKeyCredential` can still exist in that case,
 * so checking its presence alone makes the login button look available and
 * only fails after the user has clicked it.
 */
export function getWebAuthnAvailability(): WebAuthnAvailability {
  if (typeof window === 'undefined' || !window.PublicKeyCredential || typeof window.PublicKeyCredential !== 'function') {
    return { supported: false, reason: 'Votre navigateur ne prend pas en charge la connexion biométrique (WebAuthn).' };
  }

  if (!window.isSecureContext) {
    return {
      supported: false,
      reason: 'La biométrie doit être ouverte depuis une adresse HTTPS. En développement, utilisez http://localhost plutôt qu’une adresse IP locale.'
    };
  }

  return { supported: true };
}

/**
 * Reads an API response defensively. When the frontend is served without the
 * API route (for example by a standalone Vite server), it returns index.html.
 * Parsing that page with response.json() hid the real problem behind
 * "Unexpected token '<'".
 */
export async function readApiJson(response: Response): Promise<any> {
  const body = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (!body.trim()) {
    if (response.ok) return {};
    throw new Error(`Le service biométrique n'a renvoyé aucun détail (HTTP ${response.status}).`);
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    const looksLikeHtml = /text\/html/i.test(contentType) || /^\s*</.test(body);
    throw new Error(
      looksLikeHtml
        ? `Le service biométrique est indisponible (HTTP ${response.status}) : le proxy API a renvoyé une page HTML au lieu de JSON.`
        : `Le service biométrique a renvoyé une réponse non-JSON invalide (HTTP ${response.status}).`
    );
  }
}

/**
 * Detects if the current environment supports WebAuthn / Passkeys
 */
export function isWebAuthnSupported(): boolean {
  return getWebAuthnAvailability().supported;
}

/**
 * Checks if the device has an available platform authenticator (Touch ID, Face ID, Windows Hello, Fingerprint)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) return false;
  try {
    if (window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
  } catch (err) {
    console.warn('Error checking platform authenticator availability:', err);
  }
  return false;
}

/**
 * Generates a human-friendly name for the current browser/device
 */
export function detectDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Appareil Connecté';
  const ua = navigator.userAgent;
  
  let os = 'Appareil';
  if (/iPhone/i.test(ua)) os = 'iPhone (Face ID / Touch ID)';
  else if (/iPad/i.test(ua)) os = 'iPad (Face ID / Touch ID)';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'MacBook / Mac (Touch ID)';
  else if (/Windows/i.test(ua)) os = 'PC Windows (Windows Hello)';
  else if (/Android/i.test(ua)) os = 'Android (Empreinte / Visage)';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Navigateur';
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  return `${os} — ${browser}`;
}

/**
 * Translates WebAuthn errors into user-friendly French messages
 */
export function mapWebAuthnError(err: any): string {
  if (!err) return 'Une erreur biométrique est survenue.';

  const name = err.name || '';
  const message = err.message || String(err);
  const normalizedMessage = message.toLowerCase();

  if (
    name === 'NotAllowedError' ||
    name === 'AbortError' ||
    normalizedMessage.includes('cancelled') ||
    normalizedMessage.includes('canceled') ||
    normalizedMessage.includes('denied') ||
    normalizedMessage.includes('not allowed') ||
    normalizedMessage.includes('timed out') ||
    message.includes('NotAllowedError')
  ) {
    return 'Authentification biométrique annulée ou refusée par l\'utilisateur.';
  }
  if (name === 'InvalidStateError' || message.includes('InvalidStateError')) {
    return 'Cet appareil est déjà enregistré pour ce compte EDUCO.';
  }
  if (name === 'NotSupportedError' || message.includes('NotSupportedError')) {
    return 'Votre navigateur ou cet appareil ne prend pas en charge la biométrie (Passkeys).';
  }
  if (name === 'SecurityError' || message.includes('SecurityError')) {
    return 'La biométrie doit être ouverte depuis une adresse HTTPS. En développement, utilisez http://localhost plutôt qu’une adresse IP locale.';
  }
  if (message.includes('No biometric credential') || message.includes('Aucune clé')) {
    return 'Aucune clé biométrique enregistrée ne correspond à cet appareil pour ce compte.';
  }

  return message || 'L\'authentification biométrique n\'a pas pu être vérifiée. Veuillez réessayer ou utiliser votre mot de passe.';
}

/**
 * Registers a new WebAuthn / Passkey credential for the current user
 */
export async function registerWebAuthnCredential(
  email: string,
  userId?: string,
  userName?: string,
  customDeviceName?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const availability = getWebAuthnAvailability();
    if (!availability.supported) {
      return { success: false, message: '', error: availability.reason };
    }

    const deviceName = customDeviceName || detectDeviceName();

    // 1. Get registration options from server
    const optionsRes = await fetch(getApiUrl('/api/auth/webauthn/register/options'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userId, userName, deviceName })
    });

    const optionsData = await readApiJson(optionsRes);
    if (!optionsRes.ok || !optionsData.options) {
      throw new Error(optionsData.error || 'Impossible d\'obtenir les options d\'enregistrement biométrique.');
    }

    // 2. Invoke browser WebAuthn prompt
    const registrationResponse = await startRegistration({ optionsJSON: optionsData.options });

    // 3. Send credential response to server for verification
    const verifyRes = await fetch(getApiUrl('/api/auth/webauthn/register/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        userId,
        deviceName,
        registrationResponse
      })
    });

    const verifyData = await readApiJson(verifyRes);
    if (!verifyRes.ok || !verifyData.verified) {
      throw new Error(verifyData.error || 'Échec de la validation de la clé biométrique par le serveur.');
    }

    return {
      success: true,
      message: verifyData.message || 'Authentification biométrique configurée avec succès !'
    };
  } catch (err: any) {
    console.error('WebAuthn Registration Error:', err);
    return {
      success: false,
      message: '',
      error: mapWebAuthnError(err)
    };
  }
}

/**
 * Performs WebAuthn / Passkey authentication login
 */
export async function loginWithWebAuthn(
  email?: string
): Promise<{ success: boolean; userEmail?: string; userId?: string; message?: string; error?: string }> {
  try {
    const availability = getWebAuthnAvailability();
    if (!availability.supported) {
      return { success: false, error: availability.reason };
    }

    // 1. Fetch authentication options from server
    const optionsRes = await fetch(getApiUrl('/api/auth/webauthn/login/options'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email || '' })
    });

    const optionsData = await readApiJson(optionsRes);
    if (!optionsRes.ok || !optionsData.options) {
      throw new Error(optionsData.error || 'Impossible d\'initialiser la biométrie.');
    }

    // 2. Trigger browser WebAuthn prompt (Touch ID / Face ID / Windows Hello)
    const authenticationResponse = await startAuthentication({ optionsJSON: optionsData.options });

    // 3. Send response to server for verification
    const verifyRes = await fetch(getApiUrl('/api/auth/webauthn/login/verify'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authenticationResponse, challengeId: optionsData.challengeId })
    });

    const verifyData = await readApiJson(verifyRes);
    if (!verifyRes.ok || !verifyData.verified) {
      throw new Error(verifyData.error || 'Authentification biométrique non reconnue.');
    }

    return {
      success: true,
      userEmail: verifyData.userEmail,
      userId: verifyData.userId,
      message: verifyData.message || 'Connexion biométrique réussie !'
    };
  } catch (err: any) {
    console.error('WebAuthn Login Error:', err);
    return {
      success: false,
      error: mapWebAuthnError(err)
    };
  }
}

/**
 * Fetches user's registered devices/passkeys
 */
export async function fetchUserDevices(email: string): Promise<WebAuthnDevice[]> {
  try {
    const res = await fetch(getApiUrl(`/api/auth/webauthn/devices?email=${encodeURIComponent(email)}`));
    if (!res.ok) return [];
    const data = await readApiJson(res);
    return data.devices || [];
  } catch (err) {
    console.error('Error fetching devices:', err);
    return [];
  }
}

/**
 * Renames a registered passkey device
 */
export async function renameUserDevice(id: string, newName: string): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl(`/api/auth/webauthn/devices/${id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceName: newName })
    });
    return res.ok;
  } catch (err) {
    console.error('Error renaming device:', err);
    return false;
  }
}

/**
 * Revokes/Deletes a registered passkey device
 */
export async function revokeUserDevice(id: string): Promise<boolean> {
  try {
    const res = await fetch(getApiUrl(`/api/auth/webauthn/devices/${id}`), {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.error('Error revoking device:', err);
    return false;
  }
}
