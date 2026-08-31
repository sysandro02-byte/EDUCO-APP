import { Request, Response, NextFunction } from 'express';
import { db, isDbConfigured } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export interface AuthRequest extends Request {
  user?: any;
}

const decodeJwtPayload = (token?: string | null): any | null => {
  if (!token || !token.includes('.')) return null;
  try {
    let payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

const getSessionSecret = () => (
  process.env.AUTH_SESSION_SECRET
  || process.env.OTP_SIGNING_SECRET
  || process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_KEY
  || process.env.DATABASE_URL
  || null
);

export const createLocalSessionToken = (user: any): string | null => {
  const secret = getSessionSecret();
  if (!secret || !user?.email) return null;
  const payload = Buffer.from(JSON.stringify({
    typ: 'educo-session',
    uid: user.uid || user.id,
    email: String(user.email).toLowerCase(),
    role: user.role,
    schoolId: user.schoolId ?? user.school_id ?? null,
    exp: Date.now() + 8 * 60 * 60 * 1000,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
};

const verifyLocalSessionToken = (token: string): any | null => {
  const secret = getSessionSecret();
  if (!secret || !token.includes('.')) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(givenBuffer, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.typ === 'educo-session' && Number(session.exp) > Date.now() ? session : null;
  } catch {
    return null;
  }
};

const getSupabaseAuthClient = (req?: Request) => {
  const requestKey = typeof req?.headers['x-supabase-key'] === 'string'
    ? req.headers['x-supabase-key']
    : undefined;
  const requestUrl = typeof req?.headers['x-supabase-url'] === 'string'
    ? req.headers['x-supabase-url']
    : undefined;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || requestKey;
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || requestUrl;
  if (!url && key) {
    const ref = decodeJwtPayload(key)?.ref;
    if (ref) url = `https://${ref}.supabase.co`;
  }
  if (!url || !key || url.includes('your-project.supabase.co') || url.includes('demo-educo.supabase.co')) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
};

const mapSupabaseUser = (user: any) => user ? {
  id: user.id,
  uid: user.uid,
  email: user.email,
  name: user.name || user.email?.split('@')[0] || 'Utilisateur',
  role: user.role || 'Personnel',
  schoolId: user.school_id || user.schoolId,
  avatar: user.avatar,
  status: user.status || 'active',
  studentId: user.student_id || user.studentId || user.matricule,
  parentName: user.parent_name || user.parentName,
  parentEmail: user.parent_email || user.parentEmail,
} : null;

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Accès non autorisé : Token manquant.' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé : Token vide.' });
  }

  try {
    let jwtPayload = decodeJwtPayload(token);
    let matched: any = verifyLocalSessionToken(token);

    // Keep the verifier aligned with the API client. In particular, this lets
    // a configured frontend validate its real Supabase session even when a
    // Render environment variable has not yet been populated.
    const supabase = getSupabaseAuthClient(req);
    if (!matched && supabase && jwtPayload) {
      const { data: verified, error: verificationError } = await supabase.auth.getUser(token);
      if (verificationError || !verified.user) {
        return res.status(401).json({ error: 'Accès non autorisé : session invalide ou expirée.' });
      }
      jwtPayload = {
        ...jwtPayload,
        sub: verified.user.id,
        email: verified.user.email,
        user_metadata: verified.user.user_metadata,
      };
    }
    const lookupEmail = matched?.email || jwtPayload?.email || token.includes('@') ? (matched?.email || jwtPayload?.email || token) : '';
    if (!matched && supabase && lookupEmail) {
      const { data: sbUser } = await supabase
        .from('users')
        .select('*')
        .eq('email', lookupEmail.toLowerCase())
        .limit(1)
        .maybeSingle();
      matched = mapSupabaseUser(sbUser) as any;
    }

    if (!matched && isDbConfigured()) {
      const allUsers = await db.select().from(users).catch(() => []);
      matched = allUsers.find(u => u.uid === token || u.email === token || String(u.id) === token);
      
      if (!matched && jwtPayload) {
        // Decode JWT payload if available
        try {
          if (jwtPayload && (jwtPayload.email || jwtPayload.sub)) {
            const userEmail = jwtPayload.email || '';
            matched = allUsers.find(u => u.email === userEmail || u.uid === jwtPayload.sub);
          }
        } catch (jwtErr) {}
      }
    }

    if (!matched && jwtPayload && (jwtPayload.email || jwtPayload.sub)) {
      const userEmail = jwtPayload.email || '';
      matched = {
        uid: jwtPayload.sub || token,
        email: userEmail,
        name: jwtPayload.user_metadata?.full_name || jwtPayload.user_metadata?.name || userEmail.split('@')[0] || 'Utilisateur',
        role: jwtPayload.user_metadata?.role || 'Promoteur',
      } as any;
    }

    if (!matched) {
      return res.status(401).json({ error: 'Accès non autorisé : utilisateur introuvable.' });
    }
    
    req.user = matched;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Erreur serveur lors de la vérification de session.' });
  }
};
