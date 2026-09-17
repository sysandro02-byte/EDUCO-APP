import type { Express } from 'express';
import webpush from 'web-push';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';
import { registerMessagingRoutes } from './messagingRoutes.ts';
import { registerPortalRoutes } from './portalRoutes.ts';

interface StoredPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userId: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface PushPayload {
  title: string;
  message: string;
  link?: string;
  type?: string;
  tag?: string;
}

const MAX_DEVICES_PER_USER = 20;

const getVapidConfig = () => {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.VAPID_SUBJECT || 'mailto:notifications@educo.app').trim();
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey) };
};

const mapStored = (row: any): StoredPushSubscription => ({
  endpoint: row.endpoint,
  keys: { p256dh: row.p256dh, auth: row.auth },
  userId: String(row.user_id),
  role: String(row.role || ''),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const readPushSubscriptions = async (client: any, schoolId: number | string) => {
  const { data, error } = await client
    .from('push_subscriptions')
    .select('*')
    .eq('school_id', Number(schoolId));
  if (error) throw error;
  return (data || []).map(mapStored);
};

const isValidSubscription = (subscription: any) => Boolean(
  subscription
  && typeof subscription.endpoint === 'string'
  && subscription.endpoint.startsWith('https://')
  && subscription.endpoint.length <= 4096
  && typeof subscription.keys?.p256dh === 'string'
  && subscription.keys.p256dh.length >= 10
  && typeof subscription.keys?.auth === 'string'
  && subscription.keys.auth.length >= 4
);

async function sendPushToSchool(
  client: any,
  schoolId: number | string,
  predicate: (subscription: StoredPushSubscription) => boolean,
  payload: PushPayload,
) {
  const vapid = getVapidConfig();
  if (!vapid.configured) return { configured: false, sent: 0, attempted: 0 };

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  const stored = await readPushSubscriptions(client, schoolId);
  const targets = stored.filter((subscription) => isValidSubscription(subscription) && predicate(subscription));
  const staleEndpoints = new Set<string>();
  let sent = 0;

  const pushPayload = JSON.stringify({
    title: String(payload.title || 'EDUCO').slice(0, 250),
    body: String(payload.message || 'Vous avez une nouvelle notification EDUCO.').slice(0, 4000),
    url: typeof payload.link === 'string' && payload.link.startsWith('/') ? payload.link : '/',
    type: String(payload.type || 'info').slice(0, 120),
    tag: String(payload.tag || `educo-${Date.now()}`).slice(0, 200),
    timestamp: Date.now(),
  });

  await Promise.all(targets.map(async (subscription) => {
    try {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, pushPayload, {
        TTL: 60 * 60,
        urgency: 'high',
      });
      sent += 1;
    } catch (error: any) {
      const statusCode = Number(error?.statusCode || error?.status);
      if (statusCode === 404 || statusCode === 410) staleEndpoints.add(subscription.endpoint);
      console.warn('Push delivery failed:', statusCode || error?.message || error);
    }
  }));

  if (staleEndpoints.size) {
    const { error } = await client.from('push_subscriptions').delete().eq('school_id', Number(schoolId)).in('endpoint', [...staleEndpoints]);
    if (error) console.warn('Failed to prune stale push subscriptions:', error.message || error);
  }
  return { configured: true, sent, attempted: targets.length };
}

export function registerPushNotifications(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.get('/api/push/config', requireAuth, async (_req: any, res: any) => {
    const vapid = getVapidConfig();
    res.json({ configured: vapid.configured, publicKey: vapid.configured ? vapid.publicKey : null });
  });

  app.post('/api/push/subscribe', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getUser(req);
      if (!user?.schoolId || !user?.id) return res.status(403).json({ error: 'Compte sans établissement associé.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const subscription = req.body?.subscription || req.body;
      if (!isValidSubscription(subscription)) return res.status(400).json({ error: 'Abonnement push invalide.' });

      const endpoint = String(subscription.endpoint);
      const { data: existing, error: existingError } = await client
        .from('push_subscriptions')
        .select('id,user_id,school_id')
        .eq('endpoint', endpoint)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing && (Number(existing.user_id) !== Number(user.id) || Number(existing.school_id) !== Number(user.schoolId))) {
        return res.status(409).json({ error: 'Cet appareil est déjà associé à un autre compte.' });
      }

      const record = {
        school_id: Number(user.schoolId),
        user_id: Number(user.id),
        endpoint,
        p256dh: String(subscription.keys.p256dh),
        auth: String(subscription.keys.auth),
        role: canonicalizeRole(user.role || '') || String(user.role || ''),
        updated_at: new Date().toISOString(),
      };
      const query = existing?.id
        ? client.from('push_subscriptions').update(record).eq('id', existing.id).eq('user_id', Number(user.id))
        : client.from('push_subscriptions').insert([record]);
      const { error: saveError } = await query;
      if (saveError) throw saveError;

      const { data: userDevices, error: devicesError } = await client
        .from('push_subscriptions')
        .select('id,endpoint,updated_at')
        .eq('school_id', Number(user.schoolId))
        .eq('user_id', Number(user.id))
        .order('updated_at', { ascending: false });
      if (devicesError) throw devicesError;
      const overflow = (userDevices || []).slice(MAX_DEVICES_PER_USER).map((row: any) => Number(row.id));
      if (overflow.length) {
        const { error: pruneError } = await client.from('push_subscriptions').delete().eq('user_id', Number(user.id)).in('id', overflow);
        if (pruneError) throw pruneError;
      }
      return res.json({ success: true, devices: Math.min((userDevices || []).length, MAX_DEVICES_PER_USER) });
    } catch (error: any) {
      console.error('Push subscribe error:', error?.message || error);
      return res.status(500).json({ error: error?.message || 'Impossible d’enregistrer cet appareil.' });
    }
  });

  app.post('/api/push/unsubscribe', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getUser(req);
      if (!user?.schoolId || !user?.id) return res.status(403).json({ error: 'Compte sans établissement associé.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const endpoint = String(req.body?.endpoint || '').trim();
      if (!endpoint) return res.status(400).json({ error: 'Endpoint push manquant.' });
      const { error } = await client.from('push_subscriptions')
        .delete()
        .eq('school_id', Number(user.schoolId))
        .eq('user_id', Number(user.id))
        .eq('endpoint', endpoint);
      if (error) throw error;
      return res.json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible de désactiver les notifications.' });
    }
  });

  app.post('/api/push/test', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getUser(req);
      if (!user?.schoolId || !user?.id) return res.status(403).json({ error: 'Compte sans établissement associé.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const result = await sendPushToSchool(client, user.schoolId,
        (subscription) => String(subscription.userId) === String(user.id), {
          title: String(req.body?.title || 'EDUCO'),
          message: String(req.body?.message || 'Les notifications push sont actives.'),
          link: String(req.body?.link || '/'),
          type: 'test',
        });
      if (!result.configured) return res.status(503).json({ error: 'Clés VAPID non configurées sur le serveur.' });
      return res.json({ success: true, ...result });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Échec du test push.' });
    }
  });

  app.use('/api/notifications/dispatch', requireAuth, async (req: any, res: any, next: any) => {
    let user: any = null;
    let client: any = null;
    try {
      user = await getUser(req);
      client = getClient(req);
    } catch {
      return next();
    }
    const body = { ...(req.body || {}) };
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300 || !client || !user?.schoolId) return;
      const roles = Array.isArray(body.roles)
        ? new Set(body.roles.map((role: any) => canonicalizeRole(String(role || ''))).filter(Boolean))
        : null;
      const recipientIds = Array.isArray(body.recipientIds)
        ? new Set(body.recipientIds.map((id: any) => String(id)))
        : null;
      void sendPushToSchool(client, user.schoolId,
        (subscription) => recipientIds?.size
          ? recipientIds.has(String(subscription.userId))
          : roles?.size
            ? roles.has(canonicalizeRole(String(subscription.role || '')))
            : false,
        {
          title: String(body.title || 'EDUCO'),
          message: String(body.message || body.text || 'Vous avez une nouvelle notification EDUCO.'),
          link: String(body.link || '/'),
          type: String(body.type || 'info'),
        }).catch((error) => console.warn('Push mirror error:', error?.message || error));
    });
    return next();
  });

  // These exact routes are registered through operations before the broad
  // server.ts fallbacks, so personal data is scoped by the authenticated user.
  registerMessagingRoutes(app, requireAuth, getUser, getClient);
  registerPortalRoutes(app, requireAuth, getUser, getClient);
}
