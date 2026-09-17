import { randomBytes } from 'node:crypto';
import type { Express } from 'express';
import { sendBrevoEmail } from './brevo.ts';

const MINISTRY_ENTITIES: Record<string, Set<string>> = {
  MEPSA: new Set(['CABINET', 'DGEB', 'DGES', 'DCEG', 'DGRHAS', 'DGAENF', 'INSPECTION', 'DEP', 'DSIC', 'EXAMENS', 'AGREMENTS', 'DDEPSA']),
  MES: new Set(['CABINET', 'DGES', 'DGASOU', 'DEP', 'DIRCOOP', 'DSIC', 'DAEP', 'INSPECTION', 'ACADEMIES']),
  METP: new Set(['CABINET', 'DGET', 'DGEP', 'DGA_RH', 'EXAMENS_CONCOURS', 'DSIC', 'INSPECTION', 'EQUIPEMENT_PATRIMOINE']),
};

const clean = (value: unknown, max = 2000) => String(value ?? '').trim().slice(0, max);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeGovernmentRole = (role: unknown) => String(role || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

export const cabinetScopeForRole = (role: unknown): { all: boolean; ministry: string | null; cabinet: boolean } | null => {
  const normalized = normalizeGovernmentRole(role);
  if (normalized === 'ETAT_ADMIN') return { all: true, ministry: null, cabinet: false };
  for (const ministry of Object.keys(MINISTRY_ENTITIES)) {
    if (normalized === `${ministry}_ADMIN`) return { all: false, ministry, cabinet: false };
    if (normalized === `${ministry}_CABINET`) return { all: false, ministry, cabinet: true };
  }
  return null;
};

const escapeHtml = (value: unknown) => clean(value, 4000)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const publicAppUrl = () => {
  const configured = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.VITE_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'https://educo.loukatech.com';
};

const decisionEmail = async (request: any) => {
  const approved = request.status === 'APPROVED';
  const recipient = clean(request.official_email, 254).toLowerCase();
  if (!emailPattern.test(recipient)) return { success: false, error: 'Adresse e-mail demandeur invalide.' };
  const name = escapeHtml(request.full_name || 'Utilisateur');
  const ministry = escapeHtml(request.ministry);
  const entity = escapeHtml(request.entity);
  const notes = escapeHtml(request.review_notes || '');
  const subject = approved
    ? `EDUCO — demande de compte ${entity} validée`
    : `EDUCO — décision sur votre demande de compte ${entity}`;
  const resetUrl = `${publicAppUrl()}/?login=1`;
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a">
      <div style="background:#0b3152;color:white;padding:24px;border-radius:16px 16px 0 0">
        <h1 style="margin:0;font-size:24px">EDUCO</h1>
        <p style="margin:6px 0 0;color:#bae6fd">Notification institutionnelle</p>
      </div>
      <div style="padding:26px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Le cabinet du <strong>${ministry}</strong> a examiné votre demande d’accès à l’espace <strong>${entity}</strong>.</p>
        <p style="font-size:18px;font-weight:700;color:${approved ? '#047857' : '#be123c'}">Décision : ${approved ? 'VALIDÉE' : 'REJETÉE'}</p>
        ${notes ? `<p><strong>Observation du cabinet :</strong><br>${notes}</p>` : ''}
        ${approved ? `<p>Votre compte institutionnel est activé. Pour définir votre mot de passe personnel, ouvrez EDUCO puis utilisez <strong>« Mot de passe oublié ? »</strong> avec cette adresse e-mail.</p><p><a href="${resetUrl}" style="display:inline-block;background:#1F4A59;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Accéder à EDUCO</a></p>` : '<p>Aucun compte privilégié n’a été créé à partir de cette demande.</p>'}
        <p style="margin-top:24px;color:#64748b;font-size:12px">Message automatique. Ne transmettez jamais votre mot de passe ou un code OTP par e-mail.</p>
      </div>
    </div>`;
  return sendBrevoEmail({
    to: [{ email: recipient, name: clean(request.full_name, 160) }],
    subject,
    htmlContent,
    tags: ['institutional-account-decision'],
  });
};

const higherEducationDecisionEmail = async (request: any) => {
  const recipient = clean(request.official_email, 254).toLowerCase();
  if (!emailPattern.test(recipient)) return { success: false, error: 'Adresse e-mail du dossier invalide.' };
  const approved = request.status === 'APPROVED';
  const name = escapeHtml(request.legal_representative || request.promoter_or_initiator || 'Responsable du dossier');
  const institution = escapeHtml(request.official_name);
  const notes = escapeHtml(request.review_notes || '');
  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#0f172a">
      <div style="background:#0b3152;color:white;padding:24px;border-radius:16px 16px 0 0"><h1 style="margin:0">EDUCO · MES</h1></div>
      <div style="padding:26px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 16px 16px">
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Le dossier EDUCO concernant <strong>${institution}</strong> a été examiné par le cabinet du Ministère de l’Enseignement Supérieur.</p>
        <p style="font-size:18px;font-weight:700;color:${approved ? '#047857' : '#be123c'}">Statut d’instruction EDUCO : ${approved ? 'VALIDÉ' : 'REJETÉ'}</p>
        ${notes ? `<p><strong>Observation :</strong><br>${notes}</p>` : ''}
        <p style="padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;font-size:13px">Cette décision dans EDUCO ne remplace pas l’acte juridique de création, l’autorisation d’ouverture ou l’accréditation délivrés selon les procédures officielles applicables.</p>
      </div>
    </div>`;
  return sendBrevoEmail({
    to: [{ email: recipient, name: clean(request.legal_representative || request.promoter_or_initiator, 160) }],
    subject: `EDUCO — instruction du dossier ${clean(request.official_name, 120)}`,
    htmlContent,
    tags: ['higher-education-dossier-decision'],
  });
};

const notifyCabinet = async (client: any, ministry: string, title: string, message: string) => {
  try {
    const roles = [`${ministry}_CABINET`, `${ministry}_ADMIN`, 'ETAT_ADMIN'];
    const { data: cabinetUsers, error } = await client
      .from('users')
      .select('id,name,email,role')
      .in('role', roles)
      .eq('status', 'active');
    if (error) throw error;
    const users = cabinetUsers || [];
    if (users.length) {
      await client.from('notifications').insert(users.map((user: any) => ({
        user_id: user.id,
        title,
        message,
        type: 'Institution',
        is_read: false,
        link: 'Dossiers à valider',
      }))).throwOnError();
    }
    const recipients = users.filter((user: any) => emailPattern.test(clean(user.email, 254)));
    if (recipients.length) {
      await sendBrevoEmail({
        to: recipients.map((user: any) => ({ email: clean(user.email, 254), name: clean(user.name, 160) })),
        subject: `EDUCO — ${title}`,
        htmlContent: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><p>Connectez-vous au cabinet ${escapeHtml(ministry)} puis ouvrez <strong>Dossiers à valider</strong>.</p></div>`,
        tags: ['cabinet-review-alert'],
      }).catch(() => undefined);
    }
  } catch (error: any) {
    console.warn('Cabinet notification warning:', error?.message || error);
  }
};

const requireCabinet = async (req: any, res: any, getUser: any) => {
  const user = await getUser(req);
  const scope = cabinetScopeForRole(user?.role);
  if (!scope) {
    res.status(403).json({ error: 'Accès réservé au cabinet ministériel ou à l’administration institutionnelle.' });
    return null;
  }
  return { user, scope };
};

const canReviewMinistry = (scope: { all: boolean; ministry: string | null }, ministry: string) => scope.all || scope.ministry === ministry;

const createInstitutionalUser = async (client: any, request: any) => {
  const email = clean(request.official_email, 254).toLowerCase();
  const requestedRole = clean(request.requested_role, 160);
  const { data: existingUser, error: lookupError } = await client.from('users').select('*').eq('email', email).limit(1).maybeSingle();
  if (lookupError) throw lookupError;
  if (existingUser) {
    if (normalizeGovernmentRole(existingUser.role) !== normalizeGovernmentRole(requestedRole)) {
      const error: any = new Error('Cette adresse e-mail est déjà associée à un autre rôle EDUCO.');
      error.statusCode = 409;
      throw error;
    }
    if (String(existingUser.status || '').toLowerCase() !== 'active') {
      const { error: activateError } = await client.from('users').update({ status: 'active' }).eq('id', existingUser.id);
      if (activateError) throw activateError;
    }
    return existingUser.uid || null;
  }

  const temporarySecret = `Educo!${randomBytes(24).toString('base64url')}`;
  const { data: authData, error: authError } = await client.auth.admin.createUser({
    email,
    password: temporarySecret,
    email_confirm: true,
    user_metadata: {
      name: clean(request.full_name, 160),
      role: requestedRole,
      ministry: clean(request.ministry, 20),
      entity: clean(request.entity, 80),
      account_origin: 'cabinet_approved_request',
    },
  });
  if (authError || !authData?.user?.id) throw authError || new Error('Impossible de créer le compte Auth institutionnel.');

  const uid = authData.user.id;
  const { error: insertError } = await client.from('users').insert([{
    uid,
    name: clean(request.full_name, 160),
    email,
    phone: clean(request.phone, 40) || null,
    role: requestedRole,
    status: 'active',
    school_id: null,
  }]);
  if (insertError) {
    await client.auth.admin.deleteUser(uid).catch(() => undefined);
    throw insertError;
  }
  return uid;
};

export function registerInstitutionalAccountReview(app: Express, requireAuth: any, getUser: any, getClient: any) {
  // Public submission is validated server-side. It creates only a PENDING dossier;
  // it never grants a role or creates a privileged account.
  app.post('/api/government/account-requests/submit', async (req: any, res: any) => {
    try {
      const ministry = clean(req.body?.ministry, 20).toUpperCase();
      const entity = clean(req.body?.entity, 80).toUpperCase();
      const allowed = MINISTRY_ENTITIES[ministry];
      if (!allowed?.has(entity)) return res.status(400).json({ error: 'Ministère ou entité invalide.' });
      if (entity === 'CABINET') return res.status(400).json({ error: 'Les comptes Cabinet ne peuvent pas être demandés depuis le parcours sous tutelle.' });
      const requestedRole = `${ministry}_${entity}`;
      const fullName = clean(req.body?.fullName, 160);
      const officialEmail = clean(req.body?.officialEmail, 254).toLowerCase();
      const phone = clean(req.body?.phone, 40);
      const employeeNumber = clean(req.body?.employeeNumber, 120);
      const functionTitle = clean(req.body?.functionTitle, 180);
      const serviceUnit = clean(req.body?.serviceUnit, 220);
      const appointmentReference = clean(req.body?.appointmentReference, 220);
      const justification = clean(req.body?.justification, 2000);
      const extraData = req.body?.extraData && typeof req.body.extraData === 'object' && !Array.isArray(req.body.extraData) ? req.body.extraData : {};
      if (!fullName || !emailPattern.test(officialEmail) || phone.length < 6 || !employeeNumber || !functionTitle || !serviceUnit || justification.length < 10 || appointmentReference.length < 2) {
        return res.status(400).json({ error: 'Le dossier de demande est incomplet ou invalide.' });
      }
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Service institutionnel indisponible.' });
      const { error } = await client.from('institutional_account_requests').insert([{
        ministry, entity, requested_role: requestedRole, full_name: fullName,
        official_email: officialEmail, phone, employee_number: employeeNumber,
        function_title: functionTitle, service_unit: serviceUnit,
        appointment_reference: appointmentReference, justification,
        extra_data: extraData, status: 'PENDING', notification_status: 'PENDING',
      }]);
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Une demande en attente existe déjà pour cette adresse et cette direction.' });
        throw error;
      }
      void notifyCabinet(client, ministry, 'Nouvelle demande de compte sous tutelle', `${fullName} demande un accès ${entity} (${ministry}).`);
      return res.json({ success: true, message: `Demande transmise au cabinet ${ministry}.` });
    } catch (error: any) {
      console.error('Institutional request submit error:', error?.message || error);
      return res.status(500).json({ error: error?.message || 'Impossible de transmettre la demande.' });
    }
  });

  app.get('/api/government/account-requests', requireAuth, async (req: any, res: any) => {
    try {
      const auth = await requireCabinet(req, res, getUser);
      if (!auth) return;
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      let query = client.from('institutional_account_requests').select('*').neq('entity', 'CABINET').order('created_at', { ascending: false }).limit(300);
      if (!auth.scope.all && auth.scope.ministry) query = query.eq('ministry', auth.scope.ministry);
      const { data, error } = await query;
      if (error) throw error;
      return res.json({ requests: data || [] });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible de charger les demandes.' });
    }
  });

  app.post('/api/government/account-requests/:id/decision', requireAuth, async (req: any, res: any) => {
    try {
      const auth = await requireCabinet(req, res, getUser);
      if (!auth) return;
      const decision = clean(req.body?.decision, 20).toUpperCase();
      if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Décision invalide.' });
      const notes = clean(req.body?.notes, 1500);
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data: request, error: requestError } = await client.from('institutional_account_requests').select('*').eq('id', req.params.id).maybeSingle();
      if (requestError) throw requestError;
      if (!request) return res.status(404).json({ error: 'Demande introuvable.' });
      if (request.entity === 'CABINET' || !canReviewMinistry(auth.scope, request.ministry)) return res.status(403).json({ error: 'Cette demande ne relève pas de votre cabinet.' });
      if (!['PENDING', 'UNDER_REVIEW'].includes(request.status)) return res.status(409).json({ error: 'Cette demande a déjà reçu une décision.' });

      const reviewerUid = clean(auth.user?.uid || auth.user?.id, 180) || null;
      const reviewerRole = clean(auth.user?.role, 160) || null;
      let accountUid: string | null = request.account_uid || null;
      if (decision === 'APPROVED') accountUid = await createInstitutionalUser(client, request);

      const reviewedAt = new Date().toISOString();
      const { data: updated, error: updateError } = await client.from('institutional_account_requests').update({
        status: decision,
        reviewer_uid: reviewerUid,
        reviewer_role: reviewerRole,
        review_notes: notes || null,
        reviewed_at: reviewedAt,
        updated_at: reviewedAt,
        account_uid: accountUid,
        notification_status: 'PENDING',
        notification_error: null,
      }).eq('id', request.id).select('*').single();
      if (updateError) throw updateError;

      const emailResult = await decisionEmail(updated);
      const sent = Boolean(emailResult?.success);
      await client.from('institutional_account_requests').update({
        notification_status: sent ? 'SENT' : 'FAILED',
        notification_error: sent ? null : clean(emailResult?.error, 1000),
        notification_sent_at: sent ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', request.id);

      return res.json({ success: true, status: decision, emailSent: sent, emailError: sent ? null : emailResult?.error });
    } catch (error: any) {
      console.error('Institutional request decision error:', error?.message || error);
      return res.status(error?.statusCode || 500).json({ error: error?.message || 'Décision impossible.' });
    }
  });

  app.post('/api/government/account-requests/:id/resend-notification', requireAuth, async (req: any, res: any) => {
    try {
      const auth = await requireCabinet(req, res, getUser);
      if (!auth) return;
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data: request, error } = await client.from('institutional_account_requests').select('*').eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!request) return res.status(404).json({ error: 'Demande introuvable.' });
      if (!canReviewMinistry(auth.scope, request.ministry)) return res.status(403).json({ error: 'Demande hors périmètre.' });
      if (!['APPROVED', 'REJECTED'].includes(request.status)) return res.status(409).json({ error: 'Aucune décision finale à notifier.' });
      const result = await decisionEmail(request);
      const sent = Boolean(result?.success);
      await client.from('institutional_account_requests').update({
        notification_status: sent ? 'SENT' : 'FAILED',
        notification_error: sent ? null : clean(result?.error, 1000),
        notification_sent_at: sent ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', request.id);
      return res.json({ success: sent, emailSent: sent, error: sent ? null : result?.error });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Notification impossible.' });
    }
  });

  app.post('/api/government/higher-education-requests/submit', async (req: any, res: any) => {
    try {
      const institutionType = clean(req.body?.institutionType, 20).toUpperCase();
      const requestType = clean(req.body?.requestType, 20).toUpperCase() || 'CREATION';
      const officialName = clean(req.body?.officialName, 220);
      const officialEmail = clean(req.body?.officialEmail, 254).toLowerCase();
      const phone = clean(req.body?.phone, 40);
      const address = clean(req.body?.address, 1200);
      const promoter = clean(req.body?.promoterOrInitiator, 220);
      const legalRepresentative = clean(req.body?.legalRepresentative, 220);
      const plannedCapacity = Math.trunc(Number(req.body?.plannedCapacity || 0));
      if (!['PUBLIC', 'PRIVATE'].includes(institutionType) || !['CREATION', 'OPENING', 'REOPENING'].includes(requestType)) return res.status(400).json({ error: 'Type de dossier invalide.' });
      if (!officialName || !emailPattern.test(officialEmail) || phone.length < 6 || !address || !promoter || !legalRepresentative || plannedCapacity <= 0) return res.status(400).json({ error: 'Dossier incomplet ou invalide.' });
      const programs = Array.isArray(req.body?.programs) ? req.body.programs.slice(0, 100) : [];
      if (!programs.length) return res.status(400).json({ error: 'Au moins une filière ou un programme est obligatoire.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Service institutionnel indisponible.' });
      const { error } = await client.from('higher_education_establishment_requests').insert([{
        institution_type: institutionType,
        request_type: requestType,
        official_name: officialName,
        legal_form: clean(req.body?.legalForm, 220) || null,
        promoter_or_initiator: promoter,
        legal_representative: legalRepresentative,
        official_email: officialEmail,
        phone,
        department: clean(req.body?.department, 120) || null,
        address,
        planned_capacity: plannedCapacity,
        lmd_levels: Array.isArray(req.body?.lmdLevels) ? req.body.lmdLevels.slice(0, 12) : [],
        programs,
        dossier_data: req.body?.dossierData && typeof req.body.dossierData === 'object' && !Array.isArray(req.body.dossierData) ? req.body.dossierData : {},
        status: 'PENDING',
        notification_status: 'PENDING',
      }]);
      if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Un dossier en attente existe déjà pour cet établissement.' });
        throw error;
      }
      void notifyCabinet(client, 'MES', 'Nouveau dossier d’établissement supérieur', `${officialName} — projet ${institutionType === 'PUBLIC' ? 'public' : 'privé'} à instruire.`);
      return res.json({ success: true, message: 'Dossier transmis au cabinet du MES.' });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Transmission impossible.' });
    }
  });

  app.get('/api/government/higher-education-requests', requireAuth, async (req: any, res: any) => {
    try {
      const auth = await requireCabinet(req, res, getUser);
      if (!auth) return;
      if (!auth.scope.all && auth.scope.ministry !== 'MES') return res.status(403).json({ error: 'Ces dossiers relèvent du MES.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await client.from('higher_education_establishment_requests').select('*').order('created_at', { ascending: false }).limit(300);
      if (error) throw error;
      return res.json({ requests: data || [] });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Chargement impossible.' });
    }
  });

  app.post('/api/government/higher-education-requests/:id/decision', requireAuth, async (req: any, res: any) => {
    try {
      const auth = await requireCabinet(req, res, getUser);
      if (!auth) return;
      if (!auth.scope.all && auth.scope.ministry !== 'MES') return res.status(403).json({ error: 'Ces dossiers relèvent du MES.' });
      const decision = clean(req.body?.decision, 20).toUpperCase();
      if (!['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ error: 'Décision invalide.' });
      const client = getClient(req);
      const { data: request, error } = await client.from('higher_education_establishment_requests').select('*').eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!request) return res.status(404).json({ error: 'Dossier introuvable.' });
      if (!['PENDING', 'UNDER_REVIEW'].includes(request.status)) return res.status(409).json({ error: 'Ce dossier a déjà reçu une décision.' });
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await client.from('higher_education_establishment_requests').update({
        status: decision,
        reviewer_uid: clean(auth.user?.uid || auth.user?.id, 180) || null,
        reviewer_role: clean(auth.user?.role, 160) || null,
        review_notes: clean(req.body?.notes, 1500) || null,
        reviewed_at: now,
        updated_at: now,
        notification_status: 'PENDING',
        notification_error: null,
      }).eq('id', request.id).select('*').single();
      if (updateError) throw updateError;
      const emailResult = await higherEducationDecisionEmail(updated);
      const sent = Boolean(emailResult?.success);
      await client.from('higher_education_establishment_requests').update({
        notification_status: sent ? 'SENT' : 'FAILED',
        notification_error: sent ? null : clean(emailResult?.error, 1000),
        notification_sent_at: sent ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq('id', request.id);
      return res.json({ success: true, status: decision, emailSent: sent, emailError: sent ? null : emailResult?.error });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Décision impossible.' });
    }
  });
}
