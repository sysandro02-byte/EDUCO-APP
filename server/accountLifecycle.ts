import type { Express } from 'express';
import { sendBrevoEmail, otpManager } from './brevo.ts';
import { createLocalSessionToken } from '../src/middleware/auth.ts';
import { canonicalizeRole, normalizeAccountStatus } from '../src/services/userAccountWorkflow.ts';

const DAY = 86_400_000;
const WARNING_AFTER = 14 * DAY;
const ADMIN_ALERT_AFTER = 30 * DAY;
const AUTO_DELETE_GRACE = 5 * DAY;
const protectedRoles = new Set(['Admin', 'Co-admin']);
const cleanPhone = (value: any) => String(value || '').trim().replace(/[\s().-]/g, '');
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] || c));

export const lifecyclePolicy = { WARNING_AFTER, ADMIN_ALERT_AFTER, AUTO_DELETE_GRACE };

async function sendEmail(input: { to: string; name?: string; subject: string; html: string; tag: string }) {
  const result = await sendBrevoEmail({
    to: [{ email: input.to, name: input.name }],
    subject: input.subject,
    htmlContent: input.html,
    tags: [input.tag],
  });
  if (!result.success) console.warn(`Lifecycle email ${input.tag} failed:`, result.error);
  return result;
}

async function findPhoneAccount(client: any, phone: string) {
  const { data, error } = await client.from('users').select('*').limit(1000);
  if (error) throw error;
  const matches = (data || []).filter((u: any) => cleanPhone(u.phone) === phone && u.email && !/inactif|inactive/i.test(u.status || ''));
  return matches.length === 1 ? matches[0] : null;
}

const mapLoginUser = (u: any) => ({
  id: u.id, uid: u.uid, schoolId: u.school_id ?? null, licenseSchoolId: u.school_id ?? null,
  name: u.name, email: u.email, phone: u.phone, role: canonicalizeRole(u.role), avatar: u.avatar,
  status: normalizeAccountStatus(u.status), createdAt: u.created_at,
});

export function registerAccountLifecycle(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.post('/api/account/activity', requireAuth, async (req: any, res) => {
    try {
      const user = await getUser(req); const client = getClient(req);
      if (!user?.id || !client) return res.status(503).json({ success: false });
      const now = new Date().toISOString();
      const { error } = await client.from('users').update({ last_active_at: now, inactivity_warning_sent_at: null, inactivity_admin_alerted_at: null, inactivity_delete_after: null, deletion_reason: null }).eq('id', user.id);
      if (error) throw error;
      res.json({ success: true, lastActiveAt: now });
    } catch (e: any) { res.status(500).json({ success: false, error: e.message }); }
  });

  app.post('/api/internal/account-lifecycle/run', async (req: any, res) => {
    if (!process.env.CRON_SECRET || req.header('x-cron-secret') !== process.env.CRON_SECRET) return res.status(401).json({ error: 'Non autorisé.' });
    const client = getClient(req);
    if (!client) return res.status(503).json({ error: 'Supabase indisponible.' });
    const now = Date.now();
    const { data: rows, error } = await client.from('users').select('*').eq('inactivity_exempt', false).limit(1000);
    if (error) return res.status(500).json({ error: error.message });
    const stats = { warned: 0, adminAlerted: 0, deleted: 0, skipped: 0, failed: 0 };

    for (const account of rows || []) {
      if (protectedRoles.has(canonicalizeRole(account.role))) { stats.skipped++; continue; }
      const last = new Date(account.last_active_at || account.created_at || now).getTime();
      const inactiveFor = now - last;
      try {
        if (inactiveFor >= WARNING_AFTER && inactiveFor < ADMIN_ALERT_AFTER && !account.inactivity_warning_sent_at) {
          if (account.email) await sendEmail({ to: account.email, name: account.name, subject: 'Votre compte EDUCO est inactif', tag: 'account-inactivity-warning', html: `<p>Bonjour ${escapeHtml(account.name || '')},</p><p>Votre compte EDUCO n’a pas été utilisé depuis deux semaines.</p><p>Sans nouvelle connexion avant un mois d’inactivité, le compte entrera dans la procédure de suppression.</p><p>Une simple connexion à EDUCO annule automatiquement cette procédure.</p>` });
          await client.from('users').update({ inactivity_warning_sent_at: new Date().toISOString() }).eq('id', account.id).throwOnError();
          stats.warned++; continue;
        }
        if (inactiveFor >= ADMIN_ALERT_AFTER && !account.inactivity_admin_alerted_at) {
          const alertedAt = new Date(); const deleteAfter = new Date(alertedAt.getTime() + AUTO_DELETE_GRACE);
          const { data: admins, error: adminError } = await client.from('users').select('id,email,name').in('role', ['Admin', 'Co-admin']);
          if (adminError) throw adminError;
          for (const admin of admins || []) {
            await client.from('notifications').insert({ user_id: admin.id, type: 'ACCOUNT_INACTIVITY', title: 'Compte inactif à contrôler', message: `${account.name || account.email} est inactif depuis un mois et sera supprimé automatiquement dans 5 jours sans action.`, is_read: false }).throwOnError();
            if (admin.email) await sendEmail({ to: admin.email, name: admin.name, subject: 'EDUCO — compte inactif à contrôler', tag: 'account-inactivity-admin', html: `<p>Le compte <strong>${escapeHtml(account.name || account.email)}</strong> est inactif depuis un mois.</p><p>Sans intervention, EDUCO le supprimera automatiquement le ${deleteAfter.toLocaleDateString('fr-FR')}.</p>` });
          }
          await client.from('users').update({ inactivity_admin_alerted_at: alertedAt.toISOString(), inactivity_delete_after: deleteAfter.toISOString(), deletion_reason: 'inactivity' }).eq('id', account.id).throwOnError();
          stats.adminAlerted++; continue;
        }
        if (account.inactivity_delete_after && now >= new Date(account.inactivity_delete_after).getTime()) {
          const recipient = account.email; const name = account.name;
          await Promise.all([
            client.from('students').delete().eq('user_id', account.id),
            client.from('personnel').delete().eq('user_id', account.id),
            client.from('notifications').delete().eq('user_id', account.id),
          ]);
          await client.from('users').delete().eq('id', account.id).throwOnError();
          if (account.uid && client.auth?.admin) await client.auth.admin.deleteUser(account.uid).catch((e: any) => console.warn('Auth deletion warning:', e?.message || e));
          if (recipient) await sendEmail({ to: recipient, name, subject: 'Votre compte EDUCO a été supprimé', tag: 'account-deleted', html: `<p>Bonjour ${escapeHtml(name || '')},</p><p>Votre compte EDUCO a été supprimé après la période d’inactivité annoncée.</p><p>Si vous souhaitez utiliser EDUCO à nouveau, contactez votre établissement.</p>` });
          stats.deleted++;
        }
      } catch (e) { stats.failed++; console.error('Account lifecycle item failed', account.id, e); }
    }
    res.json({ success: true, stats });
  });

  // Passwordless phone login: the phone identifies the account, but the secret OTP is delivered only to the registered email.
  app.post('/api/auth/phone-login/request', async (req: any, res) => {
    try {
      const client = getClient(req); if (!client) return res.status(503).json({ error: 'Service indisponible.' });
      const phone = cleanPhone(req.body?.phone);
      if (phone.length < 7) return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
      const account = await findPhoneAccount(client, phone);
      // Generic response prevents phone-number account enumeration.
      if (!account || protectedRoles.has(canonicalizeRole(account.role))) return res.json({ success: true, message: 'Si ce numéro correspond à un compte, un code a été envoyé à son adresse e-mail.' });
      const code = otpManager.generateOtp(account.email, 'login_2fa', { phoneLogin: true, userId: account.id });
      const result = await sendBrevoEmail({
        to: [{ email: account.email, name: account.name }],
        subject: 'Votre code de connexion EDUCO',
        htmlContent: `<p>Bonjour ${escapeHtml(account.name || '')},</p><p>Votre code de connexion EDUCO est :</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Ce code expire dans 10 minutes.</p>`,
        tags: ['phone-login-otp'],
      });
      if (!result.success) return res.status(503).json({ error: 'Impossible d’envoyer le code de connexion.' });
      res.json({ success: true, message: 'Si ce numéro correspond à un compte, un code a été envoyé à son adresse e-mail.' });
    } catch (e: any) { res.status(500).json({ error: e.message || 'Connexion indisponible.' }); }
  });

  app.post('/api/auth/phone-login/verify', async (req: any, res) => {
    try {
      const client = getClient(req); if (!client) return res.status(503).json({ error: 'Service indisponible.' });
      const phone = cleanPhone(req.body?.phone); const otpCode = String(req.body?.otpCode || '').trim();
      if (phone.length < 7 || !/^\d{6}$/.test(otpCode)) return res.status(400).json({ error: 'Numéro ou code invalide.' });
      const account = await findPhoneAccount(client, phone);
      if (!account || protectedRoles.has(canonicalizeRole(account.role))) return res.status(401).json({ error: 'Code invalide ou expiré.' });
      const verified = otpManager.verifyOtp(account.email, otpCode, 'login_2fa');
      if (!verified.valid) return res.status(401).json({ error: verified.error || 'Code invalide ou expiré.' });
      const user = mapLoginUser(account); const token = createLocalSessionToken(user);
      if (!token) return res.status(503).json({ error: 'Impossible de créer une session sécurisée.' });
      await client.from('users').update({ last_active_at: new Date().toISOString(), inactivity_warning_sent_at: null, inactivity_admin_alerted_at: null, inactivity_delete_after: null, deletion_reason: null }).eq('id', account.id).throwOnError();
      res.json({ success: true, user, token });
    } catch (e: any) { res.status(500).json({ error: e.message || 'Connexion indisponible.' }); }
  });
}
