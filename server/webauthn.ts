import { Router, Request, Response } from 'express';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { requireAuth, AuthRequest, createLocalSessionToken } from '../src/middleware/auth.ts';

const LOCAL_WEBAUTHN_FILE = path.join(process.cwd(), 'data_webauthn_credentials.json');

export interface StoredCredential {
  id: string;
  userId: string;
  userEmail: string;
  credentialId: string;
  publicKey: string;
  counter: number;
  deviceName: string;
  deviceType: string;
  transports?: string[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string | null;
}

const challengeStore = new Map<string, { challenge: string; email: string; expiresAt: number }>();
const challengeCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of challengeStore.entries()) if (val.expiresAt < now) challengeStore.delete(key);
}, 60000);
challengeCleanupTimer.unref();

function normalizeEmail(value: unknown): string {
  return String(value || '').toLowerCase().trim();
}

function getLocalCredentials(): StoredCredential[] {
  try {
    if (fs.existsSync(LOCAL_WEBAUTHN_FILE)) return JSON.parse(fs.readFileSync(LOCAL_WEBAUTHN_FILE, 'utf-8'));
  } catch (err) {
    console.warn('Error reading local webauthn credentials file:', err);
  }
  return [];
}

function writeLocalCredentials(list: StoredCredential[]): void {
  fs.writeFileSync(LOCAL_WEBAUTHN_FILE, JSON.stringify(list, null, 2));
}

function saveLocalCredential(cred: StoredCredential): void {
  try {
    const list = getLocalCredentials();
    const index = list.findIndex(c => c.credentialId === cred.credentialId);
    if (index >= 0) list[index] = { ...list[index], ...cred }; else list.push(cred);
    writeLocalCredentials(list);
  } catch (err) {
    console.error('Error saving local webauthn credential:', err);
  }
}

function updateLocalDeviceName(id: string, ownerEmail: string, newName: string): boolean {
  try {
    const list = getLocalCredentials();
    const cred = list.find(c => (c.id === id || c.credentialId === id) && normalizeEmail(c.userEmail) === ownerEmail);
    if (!cred) return false;
    cred.deviceName = newName;
    writeLocalCredentials(list);
    return true;
  } catch (err) {
    console.error('Error updating local device name:', err);
    return false;
  }
}

function revokeLocalCredential(id: string, ownerEmail: string): boolean {
  try {
    const list = getLocalCredentials();
    const cred = list.find(c => (c.id === id || c.credentialId === id) && normalizeEmail(c.userEmail) === ownerEmail);
    if (!cred) return false;
    cred.revokedAt = new Date().toISOString();
    writeLocalCredentials(list);
    return true;
  } catch (err) {
    console.error('Error revoking local webauthn credential:', err);
    return false;
  }
}

export function createWebAuthnRouter(getSupabaseAdmin?: (req?: any) => any, db?: any, webauthnCredentialsTable?: any) {
  const router = Router();
  const trustedOrigins = new Set([
    ...(process.env.CORS_ALLOWED_ORIGINS || process.env.PUBLIC_APP_URL || 'https://educo-app.vercel.app,https://educo.loukatech.com')
      .split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean),
    (process.env.RENDER_EXTERNAL_URL || 'https://educo-app.onrender.com').replace(/\/$/, ''),
  ]);

  const getRpConfig = (req: Request) => {
    const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
    const hostHeader = forwardedHost || req.get('host') || 'localhost:3000';
    const proto = req.get('x-forwarded-proto')?.split(',')[0]?.trim() || (req.secure ? 'https' : 'http');
    const requestOrigin = req.get('origin')?.replace(/\/$/, '');
    const origin = requestOrigin && trustedOrigins.has(requestOrigin) ? requestOrigin : `${proto}://${hostHeader}`;
    const rpHostname = new URL(origin).hostname;
    return { rpID: rpHostname === '127.0.0.1' ? 'localhost' : rpHostname, origin, rpName: 'EDUCO APP' };
  };

  async function findUserCredentials(email: string, supabaseAdmin?: any): Promise<StoredCredential[]> {
    const normalizedEmail = normalizeEmail(email);
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin.from('webauthn_credentials').select('*').ilike('user_email', normalizedEmail).is('revoked_at', null);
        if (!error && data?.length) return data.map((row: any) => ({
          id: String(row.id), userId: row.user_id, userEmail: row.user_email, credentialId: row.credential_id,
          publicKey: row.public_key, counter: Number(row.counter || 0), deviceName: row.device_name || 'Appareil enregistré',
          deviceType: row.device_type || 'platform', transports: row.transports || [], createdAt: row.created_at,
          lastUsedAt: row.last_used_at, revokedAt: row.revoked_at
        }));
      } catch (err) { console.warn('Supabase fetch webauthn credentials notice:', err); }
    }
    if (db && webauthnCredentialsTable) {
      try {
        const rows = await db.select().from(webauthnCredentialsTable);
        const filtered = rows.filter((r: any) => normalizeEmail(r.userEmail) === normalizedEmail && !r.revokedAt);
        if (filtered.length) return filtered.map((r: any) => ({
          id: String(r.id), userId: r.userId, userEmail: r.userEmail, credentialId: r.credentialId, publicKey: r.publicKey,
          counter: Number(r.counter || 0), deviceName: r.deviceName || 'Appareil enregistré', deviceType: r.deviceType || 'platform',
          transports: r.transports || [], createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
          lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : undefined,
          revokedAt: r.revokedAt ? new Date(r.revokedAt).toISOString() : null
        }));
      } catch (err) { console.warn('Drizzle DB webauthn fetch notice:', err); }
    }
    return getLocalCredentials().filter(c => normalizeEmail(c.userEmail) === normalizedEmail && !c.revokedAt);
  }

  async function saveCredential(cred: StoredCredential, supabaseAdmin?: any) {
    saveLocalCredential(cred);
    let durableSaveSucceeded = false;
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('webauthn_credentials').upsert([{
        user_id: cred.userId, user_email: cred.userEmail, credential_id: cred.credentialId, public_key: cred.publicKey,
        counter: cred.counter, device_name: cred.deviceName, device_type: cred.deviceType, transports: cred.transports || []
      }], { onConflict: 'credential_id' });
      if (error) throw new Error(`La clé biométrique n’a pas pu être sauvegardée durablement : ${error.message}`);
      durableSaveSucceeded = true;
    }
    if (db && webauthnCredentialsTable) {
      try {
        await db.insert(webauthnCredentialsTable).values({ userId: cred.userId, userEmail: cred.userEmail, credentialId: cred.credentialId,
          publicKey: cred.publicKey, counter: cred.counter, deviceName: cred.deviceName, deviceType: cred.deviceType, transports: cred.transports || [] }).onConflictDoNothing();
        durableSaveSucceeded = true;
      } catch (err) { if (!durableSaveSucceeded) throw err; }
    }
    if (!durableSaveSucceeded && process.env.NODE_ENV === 'production') throw new Error('Aucun stockage persistant n’est configuré pour la clé biométrique.');
  }

  async function updateCredentialUsage(credentialId: string, newCounter: number, supabaseAdmin?: any) {
    const now = new Date().toISOString();
    const local = getLocalCredentials();
    const item = local.find(c => c.credentialId === credentialId);
    if (item) { item.counter = newCounter; item.lastUsedAt = now; saveLocalCredential(item); }
    if (supabaseAdmin) try { await supabaseAdmin.from('webauthn_credentials').update({ counter: newCounter, last_used_at: now }).eq('credential_id', credentialId); } catch {}
    if (db && webauthnCredentialsTable) try { await db.update(webauthnCredentialsTable).set({ counter: newCounter, lastUsedAt: new Date() }).where(db.eq(webauthnCredentialsTable.credentialId, credentialId)); } catch {}
  }

  router.post('/register/options', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const email = normalizeEmail(req.user?.email);
      if (!email) return res.status(401).json({ error: 'Session utilisateur invalide.' });
      const userId = String(req.user?.uid || req.user?.id || email);
      const userName = String(req.user?.name || email.split('@')[0]);
      const deviceName = String(req.body?.deviceName || 'Mon Appareil Biométrique');
      const { rpID, rpName } = getRpConfig(req);
      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      const userCredentials = await findUserCredentials(email, supabaseAdmin);
      const options = await generateRegistrationOptions({
        rpName, rpID, userID: Buffer.from(userId), userName: email, userDisplayName: userName, attestationType: 'none',
        excludeCredentials: userCredentials.map(c => ({ id: c.credentialId, transports: c.transports as any })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'preferred', authenticatorAttachment: 'platform' }
      });
      challengeStore.set(`reg_${email}`, { challenge: options.challenge, email, expiresAt: Date.now() + 5 * 60 * 1000 });
      return res.json({ options, deviceName });
    } catch (err: any) {
      console.error('Error generating WebAuthn registration options:', err);
      return res.status(500).json({ error: err.message || 'Erreur lors de la préparation biométrique.' });
    }
  });

  router.post('/register/verify', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const email = normalizeEmail(req.user?.email);
      const userId = String(req.user?.uid || req.user?.id || email);
      const { registrationResponse } = req.body || {};
      const deviceName = String(req.body?.deviceName || 'Appareil enregistré');
      if (!email || !registrationResponse) return res.status(400).json({ error: 'Données d’enregistrement biométrique incomplètes.' });
      const challengeKey = `reg_${email}`;
      const stored = challengeStore.get(challengeKey);
      if (!stored || stored.email !== email || stored.expiresAt < Date.now()) {
        challengeStore.delete(challengeKey);
        return res.status(400).json({ error: 'La session d’enregistrement biométrique a expiré. Veuillez réessayer.' });
      }
      // Consume before cryptographic verification so a challenge cannot be replayed.
      challengeStore.delete(challengeKey);
      const { rpID, origin } = getRpConfig(req);
      const verification = await verifyRegistrationResponse({ response: registrationResponse, expectedChallenge: stored.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
      if (!verification.verified || !verification.registrationInfo) return res.status(400).json({ error: 'L’enregistrement de l’authentificateur a échoué.' });
      const { credential } = verification.registrationInfo;
      const newCred: StoredCredential = {
        id: `cred_${Date.now()}_${Math.random().toString(36).substring(7)}`, userId, userEmail: email, credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter, deviceName, deviceType: 'platform',
        transports: credential.transports || ['internal'], createdAt: new Date().toISOString()
      };
      await saveCredential(newCred, getSupabaseAdmin ? getSupabaseAdmin(req) : null);
      return res.json({ verified: true, message: 'Accès biométrique activé avec succès sur cet appareil !', credential: { id: newCred.id, credentialId: newCred.credentialId, deviceName: newCred.deviceName } });
    } catch (err: any) {
      console.error('Error verifying WebAuthn registration:', err);
      return res.status(500).json({ error: err.message || 'Échec de la vérification biométrique.' });
    }
  });

  router.post('/login/options', async (req: Request, res: Response) => {
    try {
      const { rpID } = getRpConfig(req);
      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      const targetEmail = normalizeEmail(req.body?.email);
      let allowCredentials: any[] = [];
      if (targetEmail) {
        const userCreds = await findUserCredentials(targetEmail, supabaseAdmin);
        if (!userCreds.length) return res.status(404).json({ code: 'PASSKEY_NOT_REGISTERED', error: 'Aucune clé biométrique active n’est enregistrée pour ce compte. Connectez-vous avec votre mot de passe puis activez la biométrie sur cet appareil.' });
        allowCredentials = userCreds.map(c => ({ id: c.credentialId, transports: c.transports as any }));
      }
      const options = await generateAuthenticationOptions({ rpID, allowCredentials, userVerification: 'preferred' });
      const challengeId = crypto.randomUUID();
      challengeStore.set(`login_${challengeId}`, { challenge: options.challenge, email: targetEmail, expiresAt: Date.now() + 5 * 60 * 1000 });
      return res.json({ options, challengeId });
    } catch (err: any) {
      console.error('Error generating WebAuthn login options:', err);
      return res.status(500).json({ error: err.message || 'Erreur d’initialisation biométrique.' });
    }
  });

  router.post('/login/verify', async (req: Request, res: Response) => {
    try {
      const { authenticationResponse, challengeId } = req.body || {};
      if (!authenticationResponse?.id || !challengeId) return res.status(400).json({ error: 'Réponse d’authentification biométrique absente.' });
      const challengeKey = `login_${challengeId}`;
      const stored = challengeStore.get(challengeKey);
      if (!stored || stored.expiresAt < Date.now()) {
        challengeStore.delete(challengeKey);
        return res.status(400).json({ error: 'Challenge d’authentification expiré ou invalide.' });
      }
      // One-time challenge: consume it before verification, including failed attempts.
      challengeStore.delete(challengeKey);
      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      let credential = getLocalCredentials().find(c => c.credentialId === authenticationResponse.id && !c.revokedAt);
      if (!credential && supabaseAdmin) {
        try {
          const { data } = await supabaseAdmin.from('webauthn_credentials').select('*').eq('credential_id', authenticationResponse.id).is('revoked_at', null).limit(1);
          if (data?.length) {
            const row = data[0];
            credential = { id: String(row.id), userId: row.user_id, userEmail: row.user_email, credentialId: row.credential_id, publicKey: row.public_key,
              counter: Number(row.counter || 0), deviceName: row.device_name, deviceType: row.device_type, transports: row.transports || [], createdAt: row.created_at };
          }
        } catch {}
      }
      if (!credential) return res.status(400).json({ code: 'PASSKEY_NOT_FOUND', error: 'Cette clé biométrique n’est plus reconnue par le serveur. Connectez-vous avec votre mot de passe, puis enregistrez à nouveau cet appareil.' });
      if (stored.email && normalizeEmail(credential.userEmail) !== stored.email) return res.status(400).json({ error: 'Cette clé biométrique ne correspond pas au compte demandé.' });
      const { rpID, origin } = getRpConfig(req);
      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse, expectedChallenge: stored.challenge, expectedOrigin: origin, expectedRPID: rpID,
        credential: { id: credential.credentialId, publicKey: Buffer.from(credential.publicKey, 'base64url'), counter: credential.counter }, requireUserVerification: true
      });
      if (!verification.verified) return res.status(400).json({ error: 'Validation cryptographique biométrique échouée.' });
      await updateCredentialUsage(credential.credentialId, verification.authenticationInfo.newCounter, supabaseAdmin);
      let user: any = { uid: credential.userId, id: credential.userId, email: normalizeEmail(credential.userEmail), name: normalizeEmail(credential.userEmail).split('@')[0] };
      if (supabaseAdmin) {
        try {
          const { data: profile } = await supabaseAdmin.from('users').select('*').eq('email', user.email).limit(1).maybeSingle();
          if (profile) user = { ...profile, uid: profile.uid || profile.id, schoolId: profile.school_id ?? profile.schoolId ?? null };
        } catch {}
      }
      const token = createLocalSessionToken(user);
      if (!token) return res.status(503).json({ error: 'La session sécurisée EDUCO ne peut pas être créée. Vérifiez AUTH_SESSION_SECRET.' });
      return res.json({ verified: true, userEmail: user.email, userId: user.uid || user.id, deviceName: credential.deviceName, token, user, message: 'Authentification biométrique réussie !' });
    } catch (err: any) {
      console.error('Error verifying WebAuthn login:', err);
      return res.status(500).json({ error: err.message || 'Authentification biométrique non reconnue.' });
    }
  });

  router.get('/devices', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const email = normalizeEmail(req.user?.email);
      if (!email) return res.status(401).json({ error: 'Session utilisateur invalide.' });
      return res.json({ devices: await findUserCredentials(email, getSupabaseAdmin ? getSupabaseAdmin(req) : null) });
    } catch (err: any) { return res.status(500).json({ error: err.message || 'Erreur de récupération des appareils.' }); }
  });

  router.patch('/devices/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || '');
      const email = normalizeEmail(req.user?.email);
      const deviceName = String(req.body?.deviceName || '').trim();
      if (!email) return res.status(401).json({ error: 'Session utilisateur invalide.' });
      if (!deviceName) return res.status(400).json({ error: 'Nouveau nom d’appareil requis.' });
      updateLocalDeviceName(id, email, deviceName);
      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      if (supabaseAdmin) await supabaseAdmin.from('webauthn_credentials').update({ device_name: deviceName }).ilike('user_email', email).or(`id.eq.${id},credential_id.eq.${id}`);
      return res.json({ success: true, message: 'Nom d’appareil mis à jour.' });
    } catch (err: any) { return res.status(500).json({ error: err.message || 'Erreur lors du renommage.' }); }
  });

  router.delete('/devices/:id', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const id = String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id || '');
      const email = normalizeEmail(req.user?.email);
      if (!email) return res.status(401).json({ error: 'Session utilisateur invalide.' });
      revokeLocalCredential(id, email);
      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      if (supabaseAdmin) await supabaseAdmin.from('webauthn_credentials').update({ revoked_at: new Date().toISOString() }).ilike('user_email', email).or(`id.eq.${id},credential_id.eq.${id}`);
      return res.json({ success: true, message: 'Appareil révoqué avec succès.' });
    } catch (err: any) { return res.status(500).json({ error: err.message || 'Erreur lors de la révocation de l’appareil.' }); }
  });

  return router;
}
