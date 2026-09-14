import crypto from 'node:crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const protectedDatabasePaths = new Set([
  '/api/db/accounts',
  '/api/db/query',
  '/api/db/seed-all',
  '/api/db/purge-all',
  '/api/db/test-create-school',
  '/api/db/init-seed',
]);

const normalizeRole = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[\s_-]+/g, ' ')
  .trim();

const isAdministrator = (role) => {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'co admin';
};

const decodeJwtPayload = (token) => {
  if (!token || !token.includes('.')) return null;
  try {
    const parts = token.split('.');
    const payload = parts.length === 2 ? parts[0] : parts[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const verifyEducoSession = (token) => {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.OTP_SIGNING_SECRET;
  if (!secret || !token || token.split('.').length !== 2) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(givenBuffer, expectedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.typ !== 'educo-session' || Number(session.exp) <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
};

let adminClient;
const getAdminClient = () => {
  if (adminClient !== undefined) return adminClient;

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url && key) {
    const ref = decodeJwtPayload(key)?.ref;
    if (ref) url = `https://${ref}.supabase.co`;
  }

  if (!url || !key) {
    adminClient = null;
    return adminClient;
  }

  try {
    adminClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  } catch {
    adminClient = null;
  }
  return adminClient;
};

const lookupRole = async (email, fallbackRole) => {
  const client = getAdminClient();
  if (!client || !email) return fallbackRole;
  try {
    const { data } = await client
      .from('users')
      .select('role,status')
      .eq('email', String(email).toLowerCase())
      .limit(1)
      .maybeSingle();
    if (!data || String(data.status || 'active').toLowerCase() !== 'active') return null;
    return data.role || fallbackRole;
  } catch {
    return fallbackRole;
  }
};

const authorizeDatabaseRequest = async (req) => {
  const header = String(req.headers?.authorization || '');
  if (!header.startsWith('Bearer ')) return { ok: false, status: 401, error: 'Authentification administrateur requise.' };
  const token = header.slice(7).trim();
  if (!token) return { ok: false, status: 401, error: 'Session administrateur manquante.' };

  const localSession = verifyEducoSession(token);
  if (localSession) {
    const role = await lookupRole(localSession.email, localSession.role);
    return isAdministrator(role)
      ? { ok: true }
      : { ok: false, status: 403, error: 'Accès réservé aux administrateurs EDUCO.' };
  }

  const client = getAdminClient();
  const jwtPayload = decodeJwtPayload(token);
  if (!client || !jwtPayload) return { ok: false, status: 401, error: 'Session invalide ou expirée.' };

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.email) return { ok: false, status: 401, error: 'Session invalide ou expirée.' };
    const role = await lookupRole(data.user.email, data.user.user_metadata?.role);
    return isAdministrator(role)
      ? { ok: true }
      : { ok: false, status: 403, error: 'Accès réservé aux administrateurs EDUCO.' };
  } catch {
    return { ok: false, status: 401, error: 'Session invalide ou expirée.' };
  }
};

// server.ts contains legacy DB diagnostic/maintenance endpoints that predate the
// modern route-level authorization layer. Patch the Express application entry
// point before the app is created so these sensitive paths can never be reached
// without a verified Admin/Co-admin session. /api/db/status stays public as a
// harmless connectivity health check.
const originalHandle = express.application.handle;
express.application.handle = function educoGuardedHandle(req, res, callback) {
  let pathname = '';
  try {
    pathname = new URL(req.url || '/', 'http://localhost').pathname;
  } catch {
    pathname = String(req.url || '').split('?')[0];
  }

  if (req.method === 'OPTIONS' || !protectedDatabasePaths.has(pathname)) {
    return originalHandle.call(this, req, res, callback);
  }

  void authorizeDatabaseRequest(req).then((result) => {
    if (result.ok) {
      originalHandle.call(this, req, res, callback);
      return;
    }
    if (!res.headersSent) {
      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, error: result.error }));
    }
  }).catch(() => {
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, error: 'Erreur de contrôle d’accès.' }));
    }
  });
};
