import type { Express } from 'express';

const DAY = 86_400_000;
const WARNING_AFTER = 14 * DAY;
const ADMIN_ALERT_AFTER = 30 * DAY;
const AUTO_DELETE_GRACE = 5 * DAY;
const protectedRoles = new Set(['Admin', 'Co-admin']);
const cleanPhone = (value: any) => String(value || '').trim().replace(/[\s().-]/g, '');

export const lifecyclePolicy = { WARNING_AFTER, ADMIN_ALERT_AFTER, AUTO_DELETE_GRACE };

export function registerAccountLifecycle(app: Express, deps: {
  requireAuth: any;
  getUser: any;
  getClient: any;
  sendEmail: (input: { to: string; name?: string; subject: string; html: string; tag: string }) => Promise<any>;
}) {
  const { requireAuth, getUser, getClient, sendEmail } = deps;

  // Any authenticated activity refreshes the inactivity clock and cancels pending deletion.
  app.post('/api/account/activity', requireAuth, async (req: any, res) => {
    try {
      const user = await getUser(req); const client = getClient(req);
      if (!user?.id || !client) return res.status(503).json({ success: false });
      const now = new Date().toISOString();
      const { error } = await client.from('users').update({ last_active_at: now, inactivity_warning_sent_at: null, inactivity_admin_alerted_at: null, inactivity_delete_after: null }).eq('id', user.id);
      if (error) throw error;
      res.json({ success: true, lastActiveAt: now });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  // Protected internal endpoint: call daily from Render Cron / scheduler with X-CRON-SECRET.
  app.post('/api/internal/account-lifecycle/run', async (req: any, res) => {
    if (!process.env.CRON_SECRET || req.header('x-cron-secret') !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Non autorisé.' });
    const client = deps.getClient(req);
    if (!client) return res.status(503).json({ error: 'Supabase indisponible.' });
    const now = Date.now();
    const { data: rows, error } = await client.from('users').select('*').eq('inactivity_exempt', false).limit(1000);
    if (error) return res.status(500).json({ error: error.message });
    const stats = { warned: 0, adminAlerted: 0, deleted: 0, skipped: 0 };

    for (const account of rows || []) {
      if (protectedRoles.has(String(account.role || ''))) { stats.skipped++; continue; }
      const last = new Date(account.last_active_at || account.updated_at || account.created_at || now).getTime();
      const inactiveFor = now - last;
      try {
        if (inactiveFor >= WARNING_AFTER && inactiveFor < ADMIN_ALERT_AFTER && !account.inactivity_warning_sent_at) {
          if (account.email) await sendEmail({ to: account.email, name: account.name, subject: 'Votre compte EDUCO est inactif', tag: 'account-inactivity-warning', html: `<p>Bonjour ${account.name || ''},</p><p>Votre compte EDUCO n’a pas été utilisé depuis deux semaines.</p><p>Sans nouvelle connexion avant un mois d’inactivité, le compte entrera dans la procédure de suppression.</p><p>Une simple connexion à EDUCO annule automatiquement cette procédure.</p>` });
          await client.from('users').update({ inactivity_warning_sent_at: new Date().toISOString() }).eq('id', account.id);
          stats.warned++; continue;
        }
        if (inactiveFor >= ADMIN_ALERT_AFTER && !account.inactivity_admin_alerted_at) {
          const alertedAt = new Date(); const deleteAfter = new Date(alertedAt.getTime() + AUTO_DELETE_GRACE);
          const { data: admins } = await client.from('users').select('id,email,name').in('role', ['Admin', 'Co-admin']).eq('status', 'Actif');
          for (const admin of admins || []) {
            await client.from('notifications').insert({ user_id: admin.id, type: 'ACCOUNT_INACTIVITY', title: 'Compte inactif à contrôler', message: `${account.name || account.email} est inactif depuis un mois et sera supprimé automatiquement dans 5 jours sans action.`, is_read: false });
            if (admin.email) await sendEmail({ to: admin.email, name: admin.name, subject: 'EDUCO — compte inactif à contrôler', tag: 'account-inactivity-admin', html: `<p>Le compte <strong>${account.name || account.email}</strong> est inactif depuis un mois.</p><p>Sans intervention, EDUCO le supprimera automatiquement le ${deleteAfter.toLocaleDateString('fr-FR')}.</p>` });
          }
          await client.from('users').update({ inactivity_admin_alerted_at: alertedAt.toISOString(), inactivity_delete_after: deleteAfter.toISOString() }).eq('id', account.id);
          stats.adminAlerted++; continue;
        }
        if (account.inactivity_delete_after && now >= new Date(account.inactivity_delete_after).getTime()) {
          const recipient = account.email; const name = account.name;
          // Delete profile first. Database FK/cascade policy remains authoritative for linked EDUCO records.
          const { error: deleteError } = await client.from('users').delete().eq('id', account.id);
          if (deleteError) throw deleteError;
          if (account.uid && client.auth?.admin) await client.auth.admin.deleteUser(account.uid).catch(() => undefined);
          if (recipient) await sendEmail({ to: recipient, name, subject: 'Votre compte EDUCO a été supprimé', tag: 'account-deleted', html: `<p>Bonjour ${name || ''},</p><p>Votre compte EDUCO a été supprimé après la période d’inactivité annoncée.</p><p>Si vous souhaitez utiliser EDUCO à nouveau, contactez votre établissement.</p>` });
          stats.deleted++;
        }
      } catch (e) { console.error('Account lifecycle item failed', account.id, e); }
    }
    res.json({ success: true, stats });
  });

  // Resolve a unique phone to its account email. OTP itself is still sent only to email.
  app.post('/api/auth/resolve-phone', async (req: any, res) => {
    const client = deps.getClient(req); if (!client) return res.status(503).json({ error: 'Service indisponible.' });
    const phone = cleanPhone(req.body?.phone);
    if (phone.length < 7) return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
    const { data, error } = await client.from('users').select('id,email,phone,status').limit(1000);
    if (error) return res.status(500).json({ error: 'Recherche impossible.' });
    const matches = (data || []).filter((u: any) => cleanPhone(u.phone) === phone && u.email && !/inactif|inactive/i.test(u.status || ''));
    if (matches.length !== 1) return res.status(404).json({ error: 'Aucun compte actif unique ne correspond à ce numéro.' });
    res.json({ success: true, email: matches[0].email });
  });
}
