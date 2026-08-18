import { Router, Request, Response } from 'express';
import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse, 
  generateAuthenticationOptions, 
  verifyAuthenticationResponse 
} from '@simplewebauthn/server';
import fs from 'fs';
import path from 'path';

// Local JSON fallback storage file
const LOCAL_WEBAUTHN_FILE = path.join(process.cwd(), 'data_webauthn_credentials.json');

export interface StoredCredential {
  id: string;
  userId: string;
  userEmail: string;
  credentialId: string; // Base64URL string
  publicKey: string; // Base64URL string
  counter: number;
  deviceName: string;
  deviceType: string;
  transports?: string[];
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string | null;
}

// In-memory challenge store (short-lived, 5 minutes)
const challengeStore = new Map<string, { challenge: string; email: string; expiresAt: number }>();

// Helper to clean expired challenges
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of challengeStore.entries()) {
    if (val.expiresAt < now) {
      challengeStore.delete(key);
    }
  }
}, 60000);

// Helper for local file storage
function getLocalCredentials(): StoredCredential[] {
  try {
    if (fs.existsSync(LOCAL_WEBAUTHN_FILE)) {
      const data = fs.readFileSync(LOCAL_WEBAUTHN_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn('Error reading local webauthn credentials file:', err);
  }
  return [];
}

function saveLocalCredential(cred: StoredCredential): void {
  try {
    const list = getLocalCredentials();
    const existingIndex = list.findIndex(c => c.credentialId === cred.credentialId);
    if (existingIndex >= 0) {
      list[existingIndex] = { ...list[existingIndex], ...cred };
    } else {
      list.push(cred);
    }
    fs.writeFileSync(LOCAL_WEBAUTHN_FILE, JSON.stringify(list, null, 2));
  } catch (err) {
    console.error('Error saving local webauthn credential:', err);
  }
}

function revokeLocalCredential(id: string): boolean {
  try {
    const list = getLocalCredentials();
    const cred = list.find(c => c.id === id || c.credentialId === id);
    if (cred) {
      cred.revokedAt = new Date().toISOString();
      fs.writeFileSync(LOCAL_WEBAUTHN_FILE, JSON.stringify(list, null, 2));
      return true;
    }
  } catch (err) {
    console.error('Error revoking local webauthn credential:', err);
  }
  return false;
}

function updateLocalDeviceName(id: string, newName: string): boolean {
  try {
    const list = getLocalCredentials();
    const cred = list.find(c => c.id === id || c.credentialId === id);
    if (cred) {
      cred.deviceName = newName;
      fs.writeFileSync(LOCAL_WEBAUTHN_FILE, JSON.stringify(list, null, 2));
      return true;
    }
  } catch (err) {
    console.error('Error updating local device name:', err);
  }
  return false;
}

// Router factory
export function createWebAuthnRouter(getSupabaseAdmin?: (req?: any) => any, db?: any, webauthnCredentialsTable?: any) {
  const router = Router();

  // Utility to determine RP ID & Origin dynamically from request
  const getRpConfig = (req: Request) => {
    const hostHeader = req.get('host') || 'localhost:3000';
    const hostname = hostHeader.split(':')[0]; // Strips port
    
    // Protocol detection
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const origin = `${proto}://${hostHeader}`;
    
    // RP ID must be domain without protocol/port
    const rpID = hostname === 'localhost' || hostname === '127.0.0.1' ? 'localhost' : hostname;
    const rpName = 'EDUCO APP';

    return { rpID, origin, rpName };
  };

  // Helper to fetch credentials from DB / Supabase / Local JSON
  async function findUserCredentials(email: string, supabaseAdmin?: any): Promise<StoredCredential[]> {
    const normalizedEmail = email.toLowerCase().trim();
    
    // 1. Try Supabase
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from('webauthn_credentials')
          .select('*')
          .ilike('user_email', normalizedEmail)
          .is('revoked_at', null);
        
        if (!error && data && data.length > 0) {
          return data.map((row: any) => ({
            id: String(row.id),
            userId: row.user_id,
            userEmail: row.user_email,
            credentialId: row.credential_id,
            publicKey: row.public_key,
            counter: Number(row.counter || 0),
            deviceName: row.device_name || 'Appareil enregistré',
            deviceType: row.device_type || 'platform',
            transports: row.transports || [],
            createdAt: row.created_at,
            lastUsedAt: row.last_used_at,
            revokedAt: row.revoked_at
          }));
        }
      } catch (err) {
        console.warn('Supabase fetch webauthn credentials notice:', err);
      }
    }

    // 2. Try Drizzle DB
    if (db && webauthnCredentialsTable) {
      try {
        const rows = await db.select().from(webauthnCredentialsTable);
        const filtered = rows.filter((r: any) => 
          r.userEmail.toLowerCase().trim() === normalizedEmail && !r.revokedAt
        );
        if (filtered.length > 0) {
          return filtered.map((r: any) => ({
            id: String(r.id),
            userId: r.userId,
            userEmail: r.userEmail,
            credentialId: r.credentialId,
            publicKey: r.publicKey,
            counter: Number(r.counter || 0),
            deviceName: r.deviceName || 'Appareil enregistré',
            deviceType: r.deviceType || 'platform',
            transports: r.transports || [],
            createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
            lastUsedAt: r.lastUsedAt ? new Date(r.lastUsedAt).toISOString() : undefined,
            revokedAt: r.revokedAt ? new Date(r.revokedAt).toISOString() : null
          }));
        }
      } catch (err) {
        console.warn('Drizzle DB webauthn fetch notice:', err);
      }
    }

    // 3. Fallback Local File
    const local = getLocalCredentials();
    return local.filter(c => c.userEmail.toLowerCase().trim() === normalizedEmail && !c.revokedAt);
  }

  // Helper to save credential to DB / Supabase / Local File
  async function saveCredential(cred: StoredCredential, supabaseAdmin?: any) {
    saveLocalCredential(cred); // Always save locally as fallback

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('webauthn_credentials').insert([{
          user_id: cred.userId,
          user_email: cred.userEmail,
          credential_id: cred.credentialId,
          public_key: cred.publicKey,
          counter: cred.counter,
          device_name: cred.deviceName,
          device_type: cred.deviceType,
          transports: cred.transports || []
        }]);
      } catch (err) {
        console.warn('Supabase insert webauthn credential notice:', err);
      }
    }

    if (db && webauthnCredentialsTable) {
      try {
        await db.insert(webauthnCredentialsTable).values({
          userId: cred.userId,
          userEmail: cred.userEmail,
          credentialId: cred.credentialId,
          publicKey: cred.publicKey,
          counter: cred.counter,
          deviceName: cred.deviceName,
          deviceType: cred.deviceType,
          transports: cred.transports || []
        }).onConflictDoNothing();
      } catch (err) {
        console.warn('Drizzle insert webauthn credential notice:', err);
      }
    }
  }

  // Helper to update counter & lastUsedAt
  async function updateCredentialUsage(credentialId: string, newCounter: number, supabaseAdmin?: any) {
    const now = new Date().toISOString();
    
    // Update local file
    const local = getLocalCredentials();
    const item = local.find(c => c.credentialId === credentialId);
    if (item) {
      item.counter = newCounter;
      item.lastUsedAt = now;
      saveLocalCredential(item);
    }

    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from('webauthn_credentials')
          .update({ counter: newCounter, last_used_at: now })
          .eq('credential_id', credentialId);
      } catch (err) {}
    }

    if (db && webauthnCredentialsTable) {
      try {
        await db.update(webauthnCredentialsTable)
          .set({ counter: newCounter, lastUsedAt: new Date() })
          .where(db.eq(webauthnCredentialsTable.credentialId, credentialId));
      } catch (err) {}
    }
  }

  // -------------------------------------------------------------
  // 1. REGISTER OPTIONS: POST /api/auth/webauthn/register/options
  // -------------------------------------------------------------
  router.post('/register/options', async (req: Request, res: Response) => {
    try {
      const { email, userId, userName, deviceName } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Adresse e-mail requise pour l\'enregistrement biométrique.' });
      }

      const { rpID, rpName } = getRpConfig(req);
      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      
      const userCredentials = await findUserCredentials(email, supabaseAdmin);

      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID: Buffer.from(userId || email),
        userName: email,
        userDisplayName: userName || email.split('@')[0],
        attestationType: 'none',
        excludeCredentials: userCredentials.map(c => ({
          id: c.credentialId,
          transports: c.transports as any
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
          authenticatorAttachment: 'platform' // Empreinte, Face ID, Windows Hello
        }
      });

      // Store challenge in memory
      const challengeKey = `reg_${email.toLowerCase().trim()}`;
      challengeStore.set(challengeKey, {
        challenge: options.challenge,
        email: email.toLowerCase().trim(),
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      return res.json({ options, deviceName: deviceName || 'Mon Appareil Biométrique' });
    } catch (err: any) {
      console.error('Error generating WebAuthn registration options:', err);
      return res.status(500).json({ error: err.message || 'Erreur lors de la préparation biométrique.' });
    }
  });

  // -------------------------------------------------------------
  // 2. REGISTER VERIFY: POST /api/auth/webauthn/register/verify
  // -------------------------------------------------------------
  router.post('/register/verify', async (req: Request, res: Response) => {
    try {
      const { email, registrationResponse, deviceName, userId } = req.body;
      if (!email || !registrationResponse) {
        return res.status(400).json({ error: 'Données d\'enregistrement biométrique incomplètes.' });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const challengeKey = `reg_${normalizedEmail}`;
      const stored = challengeStore.get(challengeKey);

      if (!stored) {
        return res.status(400).json({ error: 'La session d\'enregistrement biométrique a expiré. Veuillez réessayer.' });
      }

      const { rpID, origin } = getRpConfig(req);

      const verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: stored.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: 'L\'enregistrement de l\'authentificateur a échoué.' });
      }

      const { credential } = verification.registrationInfo;
      challengeStore.delete(challengeKey);

      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;

      const newCred: StoredCredential = {
        id: `cred_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        userId: userId || `usr_${normalizedEmail}`,
        userEmail: normalizedEmail,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: credential.counter,
        deviceName: deviceName || 'Appareil enregistré',
        deviceType: 'platform',
        transports: credential.transports || ['internal'],
        createdAt: new Date().toISOString()
      };

      await saveCredential(newCred, supabaseAdmin);

      return res.json({ 
        verified: true, 
        message: 'Accès biométrique activé avec succès sur cet appareil !',
        credential: {
          id: newCred.id,
          credentialId: newCred.credentialId,
          deviceName: newCred.deviceName
        }
      });
    } catch (err: any) {
      console.error('Error verifying WebAuthn registration:', err);
      return res.status(500).json({ error: err.message || 'Échec de la vérification biométrique.' });
    }
  });

  // -------------------------------------------------------------
  // 3. LOGIN OPTIONS: POST /api/auth/webauthn/login/options
  // -------------------------------------------------------------
  router.post('/login/options', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      const { rpID } = getRpConfig(req);
      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;

      let allowCredentials: any[] = [];
      let targetEmail = email ? email.toLowerCase().trim() : '';

      if (targetEmail) {
        const userCreds = await findUserCredentials(targetEmail, supabaseAdmin);
        allowCredentials = userCreds.map(c => ({
          id: c.credentialId,
          transports: c.transports as any
        }));
      } else {
        // Global passkey search fallback
        const local = getLocalCredentials().filter(c => !c.revokedAt);
        allowCredentials = local.map(c => ({
          id: c.credentialId,
          transports: c.transports as any
        }));
      }

      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials,
        userVerification: 'preferred'
      });

      const challengeKey = `login_${options.challenge}`;
      challengeStore.set(challengeKey, {
        challenge: options.challenge,
        email: targetEmail,
        expiresAt: Date.now() + 5 * 60 * 1000
      });

      return res.json({ options });
    } catch (err: any) {
      console.error('Error generating WebAuthn login options:', err);
      return res.status(500).json({ error: err.message || 'Erreur d\'initialisation biométrique.' });
    }
  });

  // -------------------------------------------------------------
  // 4. LOGIN VERIFY: POST /api/auth/webauthn/login/verify
  // -------------------------------------------------------------
  router.post('/login/verify', async (req: Request, res: Response) => {
    try {
      const { authenticationResponse } = req.body;
      if (!authenticationResponse || !authenticationResponse.id) {
        return res.status(400).json({ error: 'Réponse d\'authentification biométrique absente.' });
      }

      const { rpID, origin } = getRpConfig(req);
      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;

      // Find matching credential across all stored credentials
      const localCreds = getLocalCredentials();
      let credential = localCreds.find(c => c.credentialId === authenticationResponse.id && !c.revokedAt);

      if (!credential && supabaseAdmin) {
        try {
          const { data } = await supabaseAdmin
            .from('webauthn_credentials')
            .select('*')
            .eq('credential_id', authenticationResponse.id)
            .is('revoked_at', null)
            .limit(1);
          if (data && data.length > 0) {
            const row = data[0];
            credential = {
              id: String(row.id),
              userId: row.user_id,
              userEmail: row.user_email,
              credentialId: row.credential_id,
              publicKey: row.public_key,
              counter: Number(row.counter || 0),
              deviceName: row.device_name,
              deviceType: row.device_type,
              createdAt: row.created_at
            };
          }
        } catch (err) {}
      }

      if (!credential) {
        return res.status(400).json({ error: 'Aucune clé biométrique enregistrée ne correspond à cet appareil.' });
      }

      // Find challenge by verifying against active challenges
      let matchedChallengeKey: string | null = null;
      let matchedChallenge: string | null = null;

      for (const [key, val] of challengeStore.entries()) {
        if (key.startsWith('login_')) {
          matchedChallengeKey = key;
          matchedChallenge = val.challenge;
          break;
        }
      }

      if (!matchedChallenge) {
        return res.status(400).json({ error: 'Challenge d\'authentification expiré ou invalide.' });
      }

      const verification = await verifyAuthenticationResponse({
        response: authenticationResponse,
        expectedChallenge: matchedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, 'base64url'),
          counter: credential.counter
        },
        requireUserVerification: true
      });

      if (!verification.verified) {
        return res.status(400).json({ error: 'Validation cryptographique biométrique échouée.' });
      }

      if (matchedChallengeKey) {
        challengeStore.delete(matchedChallengeKey);
      }

      // Update counter and last used
      const newCounter = verification.authenticationInfo.newCounter;
      await updateCredentialUsage(credential.credentialId, newCounter, supabaseAdmin);

      return res.json({
        verified: true,
        userEmail: credential.userEmail,
        userId: credential.userId,
        deviceName: credential.deviceName,
        message: 'Authentification biométrique réussie !'
      });
    } catch (err: any) {
      console.error('Error verifying WebAuthn login:', err);
      return res.status(500).json({ error: err.message || 'Authentification biométrique non reconnue.' });
    }
  });

  // -------------------------------------------------------------
  // 5. DEVICE MANAGEMENT: GET /api/auth/webauthn/devices
  // -------------------------------------------------------------
  router.get('/devices', async (req: Request, res: Response) => {
    try {
      const emailParam = req.query.email;
      const email = (Array.isArray(emailParam) ? emailParam[0] : emailParam) as string || '';
      if (!email) {
        return res.status(400).json({ error: 'E-mail requis pour lister les appareils.' });
      }

      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      const devices = await findUserCredentials(email, supabaseAdmin);

      return res.json({ devices });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erreur de récupération des appareils.' });
    }
  });

  // -------------------------------------------------------------
  // 6. RENAME DEVICE: PATCH /api/auth/webauthn/devices/:id
  // -------------------------------------------------------------
  router.patch('/devices/:id', async (req: Request, res: Response) => {
    try {
      const idParam = req.params.id;
      const id = (Array.isArray(idParam) ? idParam[0] : idParam) || '';
      const { deviceName } = req.body;
      if (!deviceName) {
        return res.status(400).json({ error: 'Nouveau nom d\'appareil requis.' });
      }

      updateLocalDeviceName(id, deviceName);

      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      if (supabaseAdmin) {
        await supabaseAdmin.from('webauthn_credentials')
          .update({ device_name: deviceName })
          .or(`id.eq.${id},credential_id.eq.${id}`);
      }

      return res.json({ success: true, message: 'Nom d\'appareil mis à jour.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erreur lors du renommage.' });
    }
  });

  // -------------------------------------------------------------
  // 7. REVOKE DEVICE: DELETE /api/auth/webauthn/devices/:id
  // -------------------------------------------------------------
  router.delete('/devices/:id', async (req: Request, res: Response) => {
    try {
      const idParam = req.params.id;
      const id = (Array.isArray(idParam) ? idParam[0] : idParam) || '';
      revokeLocalCredential(id);

      const supabaseAdmin = getSupabaseAdmin ? getSupabaseAdmin(req) : null;
      if (supabaseAdmin) {
        await supabaseAdmin.from('webauthn_credentials')
          .update({ revoked_at: new Date().toISOString() })
          .or(`id.eq.${id},credential_id.eq.${id}`);
      }

      return res.json({ success: true, message: 'Appareil révoqué avec succès.' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Erreur lors de la révocation de l\'appareil.' });
    }
  });

  return router;
}
