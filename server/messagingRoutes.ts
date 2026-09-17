import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';

const PLATFORM_ROLES = new Set(['Admin', 'Co-admin']);
const PERSONAL_ROLES = new Set(['Parent', 'Parent d’élève', 'Parent d\'élève', 'Parent/Tuteur', 'Élève']);
const STAFF_ROLES = new Set([
  'Promoteur',
  'Directeur Général',
  'Directeur des Etudes',
  'Directeur du Primaire',
  'Responsable des finances',
  'Caissière',
  'Surveillant Général',
  'Surveillant Général Adjoint',
  'Enseignant',
]);

const CHANNEL_ROLES: Record<string, string[]> = {
  general: ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire', 'Responsable des finances', 'Surveillant Général', 'Surveillant Général Adjoint', 'Caissière', 'Enseignant'],
  teachers: ['Directeur des Etudes', 'Directeur du Primaire', 'Enseignant'],
  admin: ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire', 'Responsable des finances', 'Caissière'],
  parents: ['Parent', 'Parent d’élève', 'Parent d\'élève', 'Parent/Tuteur'],
};

const normalizeMessage = (value: unknown) => String(value || '').trim();
const uniquePositiveIds = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.map((id) => Number(id)).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
  : [];

const mapMessage = (row: any) => ({
  id: String(row.id),
  type: 'internal',
  schoolId: row.school_id,
  channelId: row.channel_id,
  senderId: row.sender_id,
  senderName: row.sender_name,
  senderRole: row.sender_role,
  text: row.text,
  timestamp: row.created_at,
  recipientId: row.recipient_id,
});

export function registerMessagingRoutes(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.get('/api/messages', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getUser(req);
      if (!user?.schoolId || !user?.id) return res.status(403).json({ error: 'Compte sans établissement associé.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });

      const role = canonicalizeRole(user.role || '');
      const { data, error } = await client
        .from('messages')
        .select('*')
        .eq('school_id', Number(user.schoolId))
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) throw error;

      const visible = (data || []).filter((row: any) => {
        const direct = row.message_type === 'direct' || row.recipient_id != null;
        const involved = Number(row.sender_id) === Number(user.id) || Number(row.recipient_id) === Number(user.id);
        if (PERSONAL_ROLES.has(role)) return direct && involved;
        if (STAFF_ROLES.has(role)) return direct ? involved : true;
        return involved;
      });
      return res.json({ success: true, messages: visible.map(mapMessage) });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible de charger les messages.' });
    }
  });

  app.post('/api/messages', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getUser(req);
      if (!user?.schoolId || !user?.id) return res.status(403).json({ error: 'Compte sans établissement associé.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });

      const role = canonicalizeRole(user.role || '');
      const text = normalizeMessage(req.body?.text || req.body?.message);
      if (!text || text.length > 4000) return res.status(400).json({ error: 'Le message doit contenir entre 1 et 4000 caractères.' });

      // School identity is always authoritative from the authenticated account.
      // targetSchoolId/schoolId supplied by a browser is deliberately ignored.
      const schoolId = Number(user.schoolId);
      const recipientIds = uniquePositiveIds(req.body?.recipientIds);
      const channelId = normalizeMessage(req.body?.channelId || 'general').slice(0, 120) || 'general';
      const senderName = String(user.name || 'Utilisateur EDUCO').slice(0, 200);
      const senderRole = role || String(user.role || '').slice(0, 120);

      if (recipientIds.length > 0) {
        const { data: recipients, error: recipientsError } = await client
          .from('users')
          .select('id,role,school_id')
          .eq('school_id', schoolId)
          .in('id', recipientIds);
        if (recipientsError) throw recipientsError;
        if ((recipients || []).length !== recipientIds.length) {
          return res.status(403).json({ error: 'Tous les destinataires doivent appartenir au même établissement.' });
        }
        if (PERSONAL_ROLES.has(role) && (recipients || []).some((recipient: any) => PERSONAL_ROLES.has(canonicalizeRole(recipient.role || '')))) {
          return res.status(403).json({ error: 'Les comptes Parent/Élève peuvent écrire directement au personnel, pas aux autres comptes personnels.' });
        }

        const rows = (recipients || []).map((recipient: any) => ({
          school_id: schoolId,
          sender_id: Number(user.id),
          recipient_id: Number(recipient.id),
          channel_id: `direct_${recipient.id}`,
          message_type: 'direct',
          sender_name: senderName,
          sender_role: senderRole,
          text,
        }));
        const { data: inserted, error: insertError } = await client.from('messages').insert(rows).select('*');
        if (insertError) throw insertError;
        const notificationRows = (recipients || []).map((recipient: any) => ({
          school_id: schoolId,
          sender_id: Number(user.id),
          user_id: Number(recipient.id),
          title: `Message de ${senderName}`,
          message: text,
          type: 'Messagerie interne',
          is_read: false,
          link: 'Messagerie',
        }));
        const { error: notificationError } = await client.from('notifications').insert(notificationRows);
        if (notificationError) throw notificationError;
        return res.json({ success: true, sent: rows.length, messages: (inserted || []).map(mapMessage) });
      }

      if (!STAFF_ROLES.has(role)) {
        return res.status(403).json({ error: 'La diffusion sur un canal est réservée au personnel autorisé.' });
      }
      const allowedRoles = CHANNEL_ROLES[channelId];
      if (!allowedRoles) return res.status(400).json({ error: 'Canal de messagerie invalide.' });

      const { data: recipients, error: recipientsError } = await client
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .in('role', allowedRoles);
      if (recipientsError) throw recipientsError;

      const { data: inserted, error: insertError } = await client.from('messages').insert([{
        school_id: schoolId,
        sender_id: Number(user.id),
        recipient_id: null,
        channel_id: channelId,
        message_type: 'channel',
        sender_name: senderName,
        sender_role: senderRole,
        text,
      }]).select('*');
      if (insertError) throw insertError;

      const notificationRows = (recipients || [])
        .filter((recipient: any) => Number(recipient.id) !== Number(user.id))
        .map((recipient: any) => ({
          school_id: schoolId,
          sender_id: Number(user.id),
          user_id: Number(recipient.id),
          title: `Message de ${senderName}`,
          message: text,
          type: 'Messagerie interne',
          is_read: false,
          link: 'Messagerie',
        }));
      if (notificationRows.length) {
        const { error: notificationError } = await client.from('notifications').insert(notificationRows);
        if (notificationError) throw notificationError;
      }
      return res.json({ success: true, sent: notificationRows.length, messages: (inserted || []).map(mapMessage) });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible d’envoyer le message.' });
    }
  });

  // Exact route registered before server.ts legacy handler. It preserves the
  // existing response contract while enforcing an authoritative audience.
  app.post('/api/notifications/dispatch', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getUser(req);
      const client = getClient(req);
      if (!client) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });

      const role = canonicalizeRole(user?.role || '');
      const message = normalizeMessage(req.body?.message);
      const title = normalizeMessage(req.body?.title || req.body?.type || 'Notification').slice(0, 250);
      const type = normalizeMessage(req.body?.type || 'Information').slice(0, 120);
      const link = normalizeMessage(req.body?.link).slice(0, 500) || null;
      const requestedRoles: string[] = Array.isArray(req.body?.roles)
        ? Array.from(new Set<string>(
            req.body.roles
              .map((value: any) => canonicalizeRole(String(value || '').trim()))
              .filter((value: string) => Boolean(value)),
          )).slice(0, 30)
        : [];
      if (!message || message.length > 4000 || !requestedRoles.length) {
        return res.status(400).json({ success: false, error: 'Le message et les destinataires sont obligatoires.' });
      }

      const platformAudience = requestedRoles.every((targetRole: string) => PLATFORM_ROLES.has(targetRole));
      if (platformAudience) {
        if (!PLATFORM_ROLES.has(role)) return res.status(403).json({ success: false, error: 'Audience plateforme non autorisée.' });
      } else {
        if (!user?.schoolId) return res.status(403).json({ success: false, error: 'Compte sans établissement associé.' });
        if (PERSONAL_ROLES.has(role)) return res.status(403).json({ success: false, error: 'La diffusion par rôle est réservée au personnel autorisé.' });
        if (requestedRoles.some((targetRole: string) => PLATFORM_ROLES.has(targetRole))) {
          return res.status(403).json({ success: false, error: 'Les audiences établissement et plateforme ne peuvent pas être mélangées.' });
        }
      }

      let recipientsQuery = client.from('users').select('id,school_id').in('role', requestedRoles);
      if (!platformAudience) recipientsQuery = recipientsQuery.eq('school_id', Number(user.schoolId));
      const { data: recipients, error: recipientsError } = await recipientsQuery;
      if (recipientsError) throw recipientsError;

      const rows = (recipients || []).map((recipient: any) => ({
        school_id: platformAudience ? null : Number(user.schoolId),
        sender_id: Number(user.id) || null,
        user_id: Number(recipient.id),
        title,
        message,
        type,
        is_read: false,
        link,
      }));
      if (!rows.length) return res.json({ success: true, sent: 0 });
      const { data, error } = await client.from('notifications').insert(rows).select('id');
      if (error) throw error;
      return res.json({ success: true, sent: data?.length || 0 });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error?.message || 'Erreur lors de l’envoi de la notification.' });
    }
  });
}
