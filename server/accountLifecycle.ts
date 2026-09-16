import type { Express } from 'express';
import { sendBrevoEmail, otpManager } from './brevo.ts';
import { createLocalSessionToken } from '../src/middleware/auth.ts';
import { canonicalizeRole, normalizeAccountStatus } from '../src/services/userAccountWorkflow.ts';

const DAY = 86_400_000;
const WARNING_AFTER = 14 * DAY;
const ADMIN_ALERT_AFTER = 30 * DAY;
const AUTO_DELETE_GRACE = 5 * DAY;
const protectedRoles = new Set(['Admin', 'Co-admin']);
export const cleanPhone = (value: unknown) => String(value || '').replace(/[^0-9+]/g, '');
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
  const { data, error } = await client
    .from('users')
    .select('*')
    .eq('phone_normalized', phone)
    .limit(2);
  if (error) throw error;
  const matches = (data || []).filter((user: any) => user.email && !/inactif|inactive/i.test(user.status || ''));
  return matches.length === 1 ? matches[0] : null;
}

const phoneRequests = new Map<string, { count: number; resetAt: number }>();
const allowPhoneRequest = (key: string, now = Date.now()) => {
  const existing = phoneRequests.get(key);
  if (!existing || existing.resetAt <= now) {
    phoneRequests.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return true;
  }
  existing.count += 1;
  return existing.count <= 3;
};

const PHONE_CREDENTIALS_ERROR = 'Numéro ou mot de passe incorrect.';
const GENERIC_PHONE_MESSAGE = 'Mot de passe confirmé. Un code OTP a été envoyé à l’adresse e-mail enregistrée sur votre compte.';

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
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await client.from('users').select('*').eq('inactivity_exempt', false).range(from, from + 999);
      if (error) return res.status(500).json({ error: error.message });
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
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
          let adminsQuery = client.from('users').select('id,email,name').in('role', ['Admin', 'Co-admin']);
          adminsQuery = account.school_id == null ? adminsQuery.is('school_id', null) : adminsQuery.eq('school_id', account.school_id);
          const { data: admins, error: adminError } = await adminsQuery;
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

          // Delete the Supabase Auth identity first and only continue after a
          // confirmed success (or an already-missing identity). This keeps the
          // database row available for a later retry if Auth deletion fails.
          if (account.uid) {
            if (!client.auth?.admin) throw new Error('Supabase Auth admin indisponible pour la suppression automatique.');
            const { error: authDeleteError } = await client.auth.admin.deleteUser(account.uid);
            if (authDeleteError && authDeleteError.status !== 404 && !/not found|introuvable/i.test(authDeleteError.message || '')) {
              throw authDeleteError;
            }
          }

          await Promise.all([
            client.from('students').delete().eq('user_id', account.id).throwOnError(),
            client.from('personnel').delete().eq('user_id', account.id).throwOnError(),
            client.from('notifications').delete().eq('user_id', account.id).throwOnError(),
          ]);
          await client.from('users').delete().eq('id', account.id).throwOnError();
          if (recipient) await sendEmail({ to: recipient, name, subject: 'Votre compte EDUCO a été supprimé', tag: 'account-deleted', html: `<p>Bonjour ${escapeHtml(name || '')},</p><p>Votre compte EDUCO a été supprimé après la période d’inactivité annoncée.</p><p>Si vous souhaitez utiliser EDUCO à nouveau, contactez votre établissement.</p>` });
          stats.deleted++;
        }
      } catch (e) { stats.failed++; console.error('Account lifecycle item failed', account.id, e); }
    }
    res.json({ success: true, stats });
  });

  // Two-step phone login: phone + password are verified first, then a second-factor OTP is delivered only to the registered email.
  app.post('/api/auth/phone-login/request', async (req: any, res) => {
    try {
      const client = getClient(req); if (!client) return res.status(503).json({ error: 'Service indisponible.' });
      const phone = cleanPhone(req.body?.phone);
      const password = String(req.body?.password || '');
      if (phone.length < 7 || password.length < 4) return res.status(400).json({ error: PHONE_CREDENTIALS_ERROR });
      const rateLimitKey = `${req.ip || req.socket?.remoteAddress || 'unknown'}:${phone}`;
      if (!allowPhoneRequest(rateLimitKey)) return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });

      const account = await findPhoneAccount(client, phone);
      if (!account || protectedRoles.has(canonicalizeRole(account.role))) {
        return res.status(401).json({ error: PHONE_CREDENTIALS_ERROR });
      }

      const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: account.email,
        password,
      });
      const authMatchesAccount = Boolean(authData?.user?.id)
        && (!account.uid || String(authData.user.id) === String(account.uid));
      if (authError || !authData?.session?.access_token || !authMatchesAccount) {
        return res.status(401).json({ error: PHONE_CREDENTIALS_ERROR });
      }

      const code = otpManager.generateOtp(account.email, 'login_2fa', { phoneLogin: true, userId: account.id });
      const result = await sendBrevoEmail({
        to: [{ email: account.email, name: account.name }],
        subject: 'Votre code de connexion EDUCO',
        htmlContent: `<p>Bonjour ${escapeHtml(account.name || '')},</p><p>Votre mot de passe EDUCO a été vérifié.</p><p>Votre code de confirmation est :</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>Ce code expire dans 10 minutes.</p>`,
        tags: ['phone-login-otp'],
      });
      if (!result.success) {
        console.warn('Phone login OTP delivery failed:', result.error);
        return res.status(503).json({ error: 'Impossible d’envoyer le code de confirmation. Réessayez.' });
      }
      res.json({ success: true, message: GENERIC_PHONE_MESSAGE });
    } catch (e: any) { res.status(500).json({ error: e.message || 'Connexion indisponible.' }); }
  });

  app.post('/api/auth/phone-login/verify', async (req: any, res) => {
    try {
      const client = getClient(req); if (!client) return res.status(503).json({ error: 'Service indisponible.' });
      const phone = cleanPhone(req.body?.phone); const otpCode = String(req.body?.otpCode || '').trim();
      if (phone.length < 7 || !/^\d{6}$/.test(otpCode)) return res.status(400).json({ error: 'Numéro ou code invalide.' });
      const account = await findPhoneAccount(client, phone);
      if (!account || protectedRoles.has(canonicalizeRole(account.role))) return res.status(401).json({ error: 'Code invalide ou expiré.' });
      const activeOtp = otpManager.getActiveRecord(account.email);
      const boundToAccount = activeOtp?.purpose === 'login_2fa'
        && activeOtp.metadata?.phoneLogin === true
        && String(activeOtp.metadata?.userId) === String(account.id);
      const verified = boundToAccount && otpManager.verifyOtp(account.email, otpCode, 'login_2fa');
      if (!verified || !verified.valid) return res.status(401).json({ error: 'Code invalide ou expiré.' });
      const user = mapLoginUser(account); const token = createLocalSessionToken(user);
      if (!token) return res.status(503).json({ error: 'Impossible de créer une session sécurisée.' });
      await client.from('users').update({ last_active_at: new Date().toISOString(), inactivity_warning_sent_at: null, inactivity_admin_alerted_at: null, inactivity_delete_after: null, deletion_reason: null }).eq('id', account.id).throwOnError();
      res.json({ success: true, user, token });
    } catch (e: any) { res.status(500).json({ error: e.message || 'Connexion indisponible.' }); }
  });
}
