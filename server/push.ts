import type { Express } from 'express';
import webpush from 'web-push';

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

const MAX_DEVICES_PER_USER = 5;

const getVapidConfig = () => {
  const publicKey = String(process.env.VAPID_PUBLIC_KEY || '').trim();
  const privateKey = String(process.env.VAPID_PRIVATE_KEY || '').trim();
  const subject = String(process.env.VAPID_SUBJECT || 'mailto:notifications@educo.app').trim();
  return {
    publicKey,
    privateKey,
    subject,
    configured: Boolean(publicKey && privateKey),
  };
};

const readPushSubscriptions = async (client: any, schoolId: number | string) => {
  const { data: school, error } = await client
    .from('schools')
    .select('settings')
    .eq('id', schoolId)
    .single();
  if (error) throw error;
  const subscriptions = school?.settings?.pushSubscriptions;
  return Array.isArray(subscriptions) ? subscriptions as StoredPushSubscription[] : [];
};

const updatePushSubscriptions = async (
  client: any,
  schoolId: number | string,
  updater: (current: StoredPushSubscription[]) => StoredPushSubscription[],
) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const { data: school, error } = await client
      .from('schools')
      .select('settings')
      .eq('id', schoolId)
      .single();
    if (error) throw error;

    const oldSettings = school?.settings || {};
    const current = Array.isArray(oldSettings.pushSubscriptions)
      ? oldSettings.pushSubscriptions as StoredPushSubscription[]
      : [];
    const nextSubscriptions = updater(current);
    const nextSettings = { ...oldSettings, pushSubscriptions: nextSubscriptions };

    let update = client.from('schools').update({ settings: nextSettings }).eq('id', schoolId);
    update = school?.settings == null
      ? update.is('settings', null)
      : update.eq('settings', JSON.stringify(school.settings));

    const result = await update.select('id');
    if (result.error) throw result.error;
    if (result.data?.length) return nextSubscriptions;
  }
  throw new Error('Les abonnements push ont été modifiés simultanément. Réessayez.');
};

const isValidSubscription = (subscription: any) => Boolean(
  subscription
  && typeof subscription.endpoint === 'string'
  && subscription.endpoint.startsWith('https://')
  && typeof subscription.keys?.p256dh === 'string'
  && typeof subscription.keys?.auth === 'string'
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
    title: payload.title || 'EDUCO',
    body: payload.message || 'Vous avez une nouvelle notification EDUCO.',
    url: typeof payload.link === 'string' && payload.link.startsWith('/') ? payload.link : '/',
    type: payload.type || 'info',
    tag: payload.tag || `educo-${Date.now()}`,
    timestamp: Date.now(),
  });

  await Promise.all(targets.map(async (subscription) => {
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }, pushPayload, {
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

  if (staleEndpoints.size > 0) {
    await updatePushSubscriptions(client, schoolId, (current) =>
      current.filter((subscription) => !staleEndpoints.has(subscription.endpoint))
    ).catch((error) => console.warn('Failed to prune stale push subscriptions:', error?.message || error));
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
      if (!isValidSubscription(subscription)) {
        return res.status(400).json({ error: 'Abonnement push invalide.' });
      }

      const now = new Date().toISOString();
      const record: StoredPushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        userId: String(user.id),
        role: String(user.role || ''),
        createdAt: now,
        updatedAt: now,
      };

      const subscriptions = await updatePushSubscriptions(client, user.schoolId, (current) => {
        const withoutEndpoint = current.filter((item) => item.endpoint !== record.endpoint);
        const sameUser = withoutEndpoint
          .filter((item) => String(item.userId) === record.userId)
          .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
        const allowedSameUserEndpoints = new Set(sameUser.slice(0, MAX_DEVICES_PER_USER - 1).map((item) => item.endpoint));
        const pruned = withoutEndpoint.filter((item) =>
          String(item.userId) !== record.userId || allowedSameUserEndpoints.has(item.endpoint)
        );
        return [...pruned, record];
      });

      res.json({
        success: true,
        devices: subscriptions.filter((item) => String(item.userId) === String(user.id)).length,
      });
    } catch (error: any) {
      console.error('Push subscribe error:', error?.message || error);
      res.status(500).json({ error: error?.message || 'Impossible d’enregistrer cet appareil.' });
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

      await updatePushSubscriptions(client, user.schoolId, (current) => current.filter((item) =>
        !(item.endpoint === endpoint && String(item.userId) === String(user.id))
      ));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Impossible de désactiver les notifications.' });
    }
  });

  app.post('/api/push/test', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getUser(req);
      if (!user?.schoolId || !user?.id) return res.status(403).json({ error: 'Compte sans établissement associé.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const result = await sendPushToSchool(
        client,
        user.schoolId,
        (subscription) => String(subscription.userId) === String(user.id),
        {
          title: String(req.body?.title || 'EDUCO'),
          message: String(req.body?.message || 'Les notifications push sont actives.'),
          link: String(req.body?.link || '/'),
          type: 'test',
        },
      );
      if (!result.configured) return res.status(503).json({ error: 'Clés VAPID non configurées sur le serveur.' });
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Échec du test push.' });
    }
  });

  // The existing notification route remains the source of truth. This middleware
  // mirrors a successfully-created in-app notification to subscribed devices.
  app.use('/api/notifications/dispatch', requireAuth, async (req: any, res: any, next: any) => {
    let user: any = null;
    let client: any = null;
    try {
      user = await getUser(req);
      client = getClient(req);
    } catch {
      // Let the real notification endpoint handle authentication/data errors.
    }

    const body = { ...(req.body || {}) };
    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300 || !client) return;
      const schoolId = body.targetSchoolId || body.schoolId || user?.schoolId;
      if (!schoolId) return;

      const roles = Array.isArray(body.roles) ? new Set(body.roles.map((role: any) => String(role))) : null;
      const recipientIds = Array.isArray(body.recipientIds)
        ? new Set(body.recipientIds.map((id: any) => String(id)))
        : null;

      void sendPushToSchool(
        client,
        schoolId,
        (subscription) => recipientIds?.size
          ? recipientIds.has(String(subscription.userId))
          : roles?.size
            ? roles.has(String(subscription.role))
            : true,
        {
          title: String(body.title || 'EDUCO'),
          message: String(body.message || body.text || 'Vous avez une nouvelle notification EDUCO.'),
          link: String(body.link || '/'),
          type: String(body.type || 'info'),
        },
      ).catch((error) => console.warn('Push mirror error:', error?.message || error));
    });

    next();
  });
}
