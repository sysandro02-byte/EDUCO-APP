import { Request, Response, NextFunction } from 'express';
import { db, isDbConfigured } from '../db/index.ts';
import { users } from '../db/schema.ts';

export interface AuthRequest extends Request {
  user?: any;
}

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

  if (!isDbConfigured()) {
    return res.status(503).json({ error: 'Base de données non configurée : authentification réelle indisponible.' });
  }

  try {
    const allUsers = await db.select().from(users).catch(() => []);
    let matched = allUsers.find(u => u.uid === token || u.email === token || String(u.id) === token);
    
    if (!matched && (token.startsWith('eyJ') || token.includes('.'))) {
      // Decode JWT payload if available
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload && (payload.email || payload.sub)) {
            const userEmail = payload.email || '';
            matched = allUsers.find(u => u.email === userEmail || u.uid === payload.sub);
            if (!matched) {
              matched = {
                uid: payload.sub || token,
                email: userEmail,
                name: payload.user_metadata?.full_name || userEmail.split('@')[0] || 'Utilisateur',
                role: payload.user_metadata?.role || 'Promoteur',
              } as any;
            }
          }
        }
      } catch (jwtErr) {}
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
