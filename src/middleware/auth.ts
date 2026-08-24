import { Request, Response, NextFunction } from 'express';
import { db, isDbConfigured } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { createClient } from '@supabase/supabase-js';

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

const getSupabaseAuthClient = () => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
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
    const allUsers = isDbConfigured() ? await db.select().from(users).catch(() => []) : [];
    let matched = allUsers.find(u => u.uid === token || u.email === token || String(u.id) === token);
    const jwtPayload = decodeJwtPayload(token);
    
    if (!matched && jwtPayload) {
      // Decode JWT payload if available
      try {
        if (jwtPayload && (jwtPayload.email || jwtPayload.sub)) {
          const userEmail = jwtPayload.email || '';
          matched = allUsers.find(u => u.email === userEmail || u.uid === jwtPayload.sub);
        }
      } catch (jwtErr) {}
    }

    if (!matched) {
      const supabase = getSupabaseAuthClient();
      const lookupEmail = jwtPayload?.email || (token.includes('@') ? token : '');
      if (supabase && lookupEmail) {
        const { data: sbUser } = await supabase
          .from('users')
          .select('*')
          .eq('email', lookupEmail.toLowerCase())
          .limit(1)
          .maybeSingle();
        matched = mapSupabaseUser(sbUser) as any;
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
