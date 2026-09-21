import express from 'express';
import { registerOperations, selectPersonalStudents } from './server/operations';
import { registerCollections } from './server/collections';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import net from 'net';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProductionServer = process.env.NODE_ENV === 'production' || path.basename(__dirname) === 'dist';

const findAvailablePort = async (startPort: number): Promise<number> => {
  const canUsePort = (port: number) =>
    new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port);
    });

  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await canUsePort(port)) {
      return port;
    }
  }

  return startPort;
};
import * as dotenv from 'dotenv';
import { db, ensureSchemaColumns, isDbConfigured } from './src/db/index.ts';
import * as schema from './src/db/schema.ts';
import { eq, desc, and, asc } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import Groq from 'groq-sdk';
import { requireAuth, AuthRequest, createLocalSessionToken } from './src/middleware/auth.ts';
import { getOrCreateUser, getUserByUid } from './src/db/users.ts';
import { createClient } from '@supabase/supabase-js';
import {
  buildIssuedSubscriptionStatus,
  calculateSubscriptionEndDate,
  ensureActivationBelongsToSchool,
  getSubscriptionMonthlyRate,
  normalizeSchoolIdentifier,
  normalizeSubscriptionPlan,
  pickCurrentActiveSubscription,
} from './src/services/subscriptionWorkflow.ts';
import {
  buildDuplicateEmailMessage,
  buildSchoolAcronym,
  buildStaffMatricule,
  buildStudentMatricule,
  canDeleteAccount,
  canViewGrades,
  canonicalizeRole,
  getAccountCreationKind,
  normalizeAccountStatus,
  normalizeEmail,
  normalizeRole,
} from './src/services/userAccountWorkflow.ts';
import { getNewPasswordError } from './src/services/passwordPolicy.ts';
import { buildStudentPaymentLedger } from './src/services/cashierWorkflow.ts';
import { registerAdministrativePaymentRoutes, registerLoukaPayWebhook } from './server/administrativePayments.ts';

const base64UrlEncode = (value: Buffer) => value.toString('base64url');
const base64UrlDecode = (value: string) => Buffer.from(value, 'base64url');

/**
 * Password-reset OTPs must survive a Render instance restart/load-balancer hop.
 * The challenge is encrypted (not merely signed), so the OTP is never exposed
 * to the browser while no server-side session storage is required.
 */
const createPasswordResetChallenge = (email: string, code: string): string | null => {
  const secret = process.env.OTP_SIGNING_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_ANON_KEY;
  if (!secret) return null;

  const key = crypto.createHash('sha256').update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const payload = JSON.stringify({
    email: email.toLowerCase().trim(),
    code,
    purpose: 'password_reset',
    expiresAt: Date.now() + 10 * 60 * 1000,
  });
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  return `${base64UrlEncode(iv)}.${base64UrlEncode(cipher.getAuthTag())}.${base64UrlEncode(encrypted)}`;
};

const verifyPasswordResetChallenge = (challenge: unknown, email: string, code: string): boolean => {
  if (typeof challenge !== 'string') return false;
  const secret = process.env.OTP_SIGNING_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_ANON_KEY;
  if (!secret) return false;

  try {
    const [ivPart, tagPart, encryptedPart] = challenge.split('.');
    if (!ivPart || !tagPart || !encryptedPart) return false;
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, base64UrlDecode(ivPart));
    decipher.setAuthTag(base64UrlDecode(tagPart));
    const payload = JSON.parse(Buffer.concat([
      decipher.update(base64UrlDecode(encryptedPart)),
      decipher.final(),
    ]).toString('utf8'));
    return payload.purpose === 'password_reset'
      && payload.email === email.toLowerCase().trim()
      && payload.code === code.trim()
      && Number(payload.expiresAt) > Date.now();
  } catch {
    return false;
  }
};

const decodeSupabaseJwtPayload = (key?: string | null): any | null => {
  if (!key || !key.includes('.')) return null;
  try {
    let payload = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  } catch {
    return null;
  }
};

const getSupabaseServerKey = (_req?: any) => (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY
);

const getSupabaseServerKeyRole = (req?: any) => decodeSupabaseJwtPayload(getSupabaseServerKey(req))?.role;

const mapSupabaseSchool = (school: any) => school ? ({
  id: school.id,
  name: school.name,
  identifier: school.identifier,
  address: school.address,
  phone: school.phone,
  email: school.email,
  logo: school.logo,
  creationDate: school.creation_date || school.creationDate,
  promoterName: school.promoter_name || school.promoterName,
  promoterContact: school.promoter_contact || school.promoterContact,
  promoterEmail: school.promoter_email || school.promoterEmail,
  levels: school.levels || {},
  openingAuthorizationDoc: school.opening_authorization_doc || school.openingAuthorizationDoc,
  promoterIdDoc: school.promoter_id_doc || school.promoterIdDoc,
  statutesDoc: school.statutes_doc || school.statutesDoc,
  status: school.status,
  settings: school.settings || {},
  createdAt: school.created_at || school.createdAt,
}) : null;

// Legacy establishments can predate the identifier column. Keep one stable
// identifier everywhere (licensing, parent onboarding and school settings).
const buildFallbackSchoolIdentifier = (schoolId: string | number) =>
  `EDUCO-SCH-${String(schoolId).replace(/\D/g, '').padStart(4, '0')}`;

const ensureSchoolIdentifier = async (school: any, supabaseAdmin?: any) => {
  if (!school?.id) return school;
  const identifier = String(school.identifier || '').trim() || buildFallbackSchoolIdentifier(school.id);
  if (!school.identifier && supabaseAdmin) {
    const { error } = await supabaseAdmin.from('schools').update({ identifier }).eq('id', school.id);
    if (error) throw error;
  }
  return { ...school, identifier };
};

const normalizePhoneIdentity = (value: unknown) => String(value || '').replace(/[^0-9+]/g, '');
const isDuplicatePhoneError = (error: any) => error?.code === '23505' || /users_phone_unique_idx|phone.*unique|duplicate.*phone/i.test(String(error?.message || error || ''));

const mapSupabaseUser = (user: any) => user ? ({
  id: user.id,
  uid: user.uid,
  schoolId: user.school_id ?? user.schoolId ?? null,
  // A subscription is scoped to its school. Expose the inherited scope so
  // clients never need to guess or fall back to another establishment.
  licenseSchoolId: user.school_id ?? user.schoolId ?? null,
  name: user.name,
  email: user.email,
  role: canonicalizeRole(user.role),
  avatar: user.avatar,
  status: normalizeAccountStatus(user.status),
  personnelId: user.personnelId || user.personnel_id,
  studentId: user.student_id || user.studentId || user.matricule,
  matricule: user.matricule || user.student_id || user.studentId,
  classId: user.class_id || user.classId,
  class: user.class || user.className,
  parentName: user.parent_name || user.parentName,
  parentEmail: user.parent_email || user.parentEmail,
  parentPhone: user.parent_phone || user.parentPhone,
  phone: user.phone || user.contact,
  contact: user.contact || user.phone,
  createdAt: user.created_at || user.createdAt,
}) : null;

const getSupabaseAdmin = (req?: any) => {
  let supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = getSupabaseServerKey(req);
  if (!supabaseUrl) {
    const ref = decodeSupabaseJwtPayload(serviceRoleKey)?.ref;
    if (ref) {
      supabaseUrl = `https://${ref}.supabase.co`;
    }
  }
  if (supabaseUrl && serviceRoleKey && !supabaseUrl.includes('demo-educo.supabase.co')) {
    try {
      return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    } catch (err) {
      console.error("Failed to init Supabase Admin Client:", err);
    }
  }
  return null;
};

const mapSupabaseTransaction = (t: any) => t ? ({
  id: t.id,
  schoolId: t.school_id || t.schoolId,
  type: t.type,
  category: t.category,
  amount: Number(t.amount || 0),
  description: t.description,
  date: t.date,
  recordedBy: t.recorded_by || t.recordedBy,
  status: (String(t.description || '').includes('(Status:') ? String(t.description).match(/\(Status:\s*([^)]+)\)/)?.[1] : undefined) || t.status || 'Approuvé'
}) : null;

const mapSupabasePayment = (p: any) => p ? ({
  id: p.id,
  schoolId: p.school_id || p.schoolId,
  studentId: p.student_id || p.studentId,
  feeId: p.fee_id || p.feeId,
  amount: Number(p.amount || 0),
  paymentDate: p.payment_date || p.paymentDate,
  receiptNumber: p.receipt_number || p.receiptNumber,
  paymentMethod: p.payment_method || p.paymentMethod,
  status: p.status || 'paid'
}) : null;

const mapSupabaseClass = (c: any) => c ? ({
  id: c.id,
  schoolId: c.school_id || c.schoolId,
  name: c.name,
  level: c.level || c.section,
  section: c.section || c.level,
  capacity: c.capacity,
  maxStudents: c.capacity,
  teacherId: c.teacher_id || c.teacherId,
  tuitionFee: Number(c.tuition_fee || c.tuitionFee || 0),
  isExamClass: Boolean(c.is_exam_class ?? c.isExamClass),
  status: c.status || 'active'
}) : null;

const mapSupabaseFee = (f: any) => f ? ({
  id: f.id,
  schoolId: f.school_id || f.schoolId,
  name: f.name || f.title,
  title: f.title || f.name,
  amount: Number(f.amount || 0),
  dueDate: f.due_date || f.dueDate,
  type: f.type,
  class: f.class || f.className || f.class_name
}) : null;

const mapSupabasePersonnel = (p: any) => {
  if (!p) return null;
  const parsedSalary = Number(p.base_salary ?? p.baseSalary ?? p.salary ?? 0);
  const baseSalary = Number.isFinite(parsedSalary) ? parsedSalary : 0;
  return {
    id: p.id,
    userId: p.user_id || p.userId,
    schoolId: p.school_id || p.schoolId,
    matricule: p.matricule,
    role: p.role,
    baseSalary,
    salary: baseSalary,
    hireDate: p.hire_date || p.hireDate,
    bankAccount: p.bank_account || p.bankAccount,
    name: p.name || `Personnel #${p.id}`,
    email: p.email || '',
    phone: p.phone || '',
    status: normalizeAccountStatus(p.status)
  };
};

const mapSupabaseGrade = (g: any, subjectName?: string) => g ? ({
  id: String(g.id),
  studentId: g.student_id || g.studentId,
  classId: g.class_id || g.classId || 0,
  subjectId: g.subject_id || g.subjectId,
  subject: subjectName || g.subject || g.subject_name || `Matière #${g.subject_id || ''}`.trim(),
  assignment: g.assignment || g.term || 'Devoir',
  score: Number(g.score || 0),
  maxScore: Number(g.max_score || g.maxScore || 20),
  teacherId: g.teacher_id || g.teacherId,
  date: g.date
}) : null;

const mapSupabaseSubscription = (s: any) => s ? ({
  id: s.id,
  code: s.code,
  schoolId: s.school_id || s.schoolId,
  schoolName: s.school_name || s.schoolName || 'Établissement',
  schoolIdentifier: s.school_identifier || s.schoolIdentifier,
  promoterName: s.promoter_name || s.promoterName,
  promoterContact: s.promoter_contact || s.promoterContact,
  planType: s.plan_type || s.planType || 'standard',
  amountPaid: Number(s.amount_paid ?? s.amountPaid ?? 0),
  months: Number(s.months || 1),
  status: s.status || s.subscription_status || s.subscriptionStatus || 'active',
  startDate: s.start_date || s.startDate || s.starts_at || s.startsAt || s.created_at,
  endDate: s.end_date || s.endDate || s.expires_at || s.expiresAt || s.expiry_date || s.expiryDate || s.valid_until || s.validUntil,
  autoRenew: Boolean(s.auto_renew ?? s.autoRenew),
  autoRenewFrequency: s.auto_renew_frequency || s.autoRenewFrequency || 'before_expiry',
  createdAt: s.created_at || s.createdAt,
  updatedAt: s.updated_at || s.updatedAt,
}) : null;

const mapSupabaseSubscriptionRequest = (r: any) => r ? ({
  id: r.id,
  schoolId: r.school_id || r.schoolId,
  schoolIdentifier: r.school_identifier || r.schoolIdentifier,
  schoolName: r.school_name || r.schoolName || 'Établissement',
  promoterName: r.promoter_name || r.promoterName || 'Promoteur',
  promoterContact: r.promoter_contact || r.promoterContact || '',
  requestedPlan: r.requested_plan || r.requestedPlan || 'standard',
  requestedMonths: Number(r.requested_months || r.requestedMonths || 1),
  status: r.status || 'pending',
  createdAt: r.created_at || r.createdAt,
}) : null;

const getPublicAppUrl = (req: any) => {
  const configured = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.VITE_APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  const protocol = forwardedProto || req?.protocol || 'https';
  const host = forwardedHost || req?.get?.('host');
  return host ? `${protocol}://${host}` : 'https://educo-app.school';
};

const mapSupabaseSurvey = (s: any) => s ? ({
  id: s.id,
  schoolId: s.school_id || s.schoolId,
  title: s.title,
  description: s.description || '',
  category: s.category || 'Général',
  targetAudience: s.target_audience || s.targetAudience || 'all',
  deadline: s.deadline,
  status: s.status || 'active',
  questions: s.questions || [],
  creatorName: s.creator_name || s.creatorName || 'Direction',
  creatorRole: s.creator_role || s.creatorRole || 'Admin',
  createdAt: s.created_at || s.createdAt,
}) : null;

const mapSupabaseSurveyResponse = (r: any) => r ? ({
  id: r.id,
  surveyId: r.survey_id || r.surveyId,
  parentName: r.parent_name || r.parentName,
  parentPhone: r.parent_phone || r.parentPhone || '',
  parentEmail: r.parent_email || r.parentEmail || '',
  studentName: r.student_name || r.studentName || '',
  studentClass: r.student_class || r.studentClass || '',
  channel: r.channel || 'whatsapp',
  answers: r.answers || {},
  comment: r.comment || '',
  submittedAt: r.submitted_at || r.submittedAt,
}) : null;

const mapSupabaseNotification = (n: any) => n ? ({
  id: n.id,
  notifId: n.notif_id || n.notifId,
  userId: n.user_id || n.userId,
  title: n.title || 'Notification',
  message: n.message || '',
  type: n.type || 'Information',
  isRead: Boolean(n.is_read ?? n.isRead ?? n.read),
  read: Boolean(n.is_read ?? n.isRead ?? n.read),
  timestamp: n.created_at || n.createdAt || n.timestamp || new Date().toISOString(),
  createdAt: n.created_at || n.createdAt,
  link: n.link || n.page || '',
  roles: n.roles || [],
}) : null;

const orderByCreatedDesc = (items: any[]) => [...items].sort((a, b) => {
  const at = new Date(a.createdAt || a.created_at || 0).getTime();
  const bt = new Date(b.createdAt || b.created_at || 0).getTime();
  return bt - at;
});

const getRequestUser = async (req: AuthRequest) => (
  req.user?.role || req.user?.schoolId ? req.user : await getUserByUid(req.user!.uid)
);

const getRequestUserId = async (req: AuthRequest) => {
  const dbUser = await getRequestUser(req);
  const rawUserId = dbUser?.id ?? req.user?.id;
  const userId = Number(rawUserId);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

// Audit writes deliberately never make a completed business operation fail:
// deployments apply the accompanying migration before the table is available.
const writeFinancialAudit = async (req: AuthRequest, entry: {
  action: string; entityType: string; entityId?: string | number; oldValues?: any; newValues?: any; reason?: string;
}) => {
  try {
    const actor = await getRequestUser(req);
    const client = getSupabaseAdmin(req);
    if (!client || !actor) return;
    const { error } = await client.from('financial_audit_logs').insert([{
      school_id: actor.schoolId ?? actor.school_id ?? null,
      actor_user_id: actor.id ?? null,
      actor_role: canonicalizeRole(actor.role) || actor.role || 'Inconnu',
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId == null ? null : String(entry.entityId),
      old_values: entry.oldValues ?? null,
      new_values: entry.newValues ?? null,
      reason: entry.reason ?? null,
    }]);
    if (error) console.warn('Financial audit not persisted:', error.message);
  } catch (error: any) {
    console.warn('Financial audit write failed:', error?.message || error);
  }
};

const requirePlatformAdmin = async (req: AuthRequest, res: any) => {
  const dbUser = await getRequestUser(req);
  if (dbUser?.role !== 'Admin') {
    res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
    return null;
  }
  return dbUser;
};

const ensureUniqueUserEmail = async (params: {
  req: AuthRequest;
  email?: string | null;
  excludeUserId?: number | null;
  excludeUid?: string | null;
}) => {
  const email = normalizeEmail(params.email);
  if (!email) return null;

  const supabaseAdmin = getSupabaseAdmin(params.req);
  if (supabaseAdmin) {
    const { data: existingProfile, error } = await supabaseAdmin
      .from('users')
      .select('id,uid,email')
      .eq('email', email)
      .maybeSingle();
    if (error) throw error;
    if (
      existingProfile?.id
      && Number(existingProfile.id) !== Number(params.excludeUserId || 0)
      && (!params.excludeUid || existingProfile.uid !== params.excludeUid)
    ) {
      return existingProfile;
    }

    const authLookup = await supabaseAdmin.auth.admin.listUsers();
    if (!authLookup.error) {
      const existingAuthUser = authLookup.data.users.find((user: any) => normalizeEmail(user.email) === email);
      if (
        existingAuthUser
        && (!params.excludeUid || existingAuthUser.id !== params.excludeUid)
        && existingProfile?.uid !== existingAuthUser.id
      ) {
        return { id: existingAuthUser.id, uid: existingAuthUser.id, email };
      }
    }
    return null;
  }

  if (isDbConfigured()) {
    const allUsers = await db.select().from(users).catch(() => []);
    return allUsers.find((user: any) =>
      normalizeEmail(user.email) === email
      && Number(user.id) !== Number(params.excludeUserId || 0)
      && (!params.excludeUid || user.uid !== params.excludeUid)
    ) || null;
  }

  return null;
};

const getSupabaseRows = async (client: any, table: string, columns = '*') => {
  // PostgREST returns at most 1,000 rows by default.  The administration
  // dashboard is a consolidated view, so silently accepting the first page
  // makes its totals wrong as soon as a school grows.  Read every page and
  // propagate query errors instead of turning a failed query into an empty set.
  const pageSize = 1000;
  const rows: any[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw error;

    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
};

const deleteSupabaseBySchool = async (client: any, table: string, schoolId: number) => {
  const { error } = await client.from(table).delete().eq('school_id', schoolId);
  if (error) {
    console.warn(`Supabase cleanup warning for ${table}:`, error.message);
  }
};
import { 
  otpManager, 
  sendBrevoEmail, 
  sendOtpEmail, 
  sendWelcomeEmail, 
  sendPasswordResetEmail, 
  sendAdminSchoolAlertEmail, 
  sendSubscriptionConfirmationEmail,
  getBrevoEmailLogs,
  getBrevoSenders,
  checkBrevoApiKey,
  sendBrevoSms,
  sendBulkBrevoCampaign
} from './server/brevo.ts';

import { 
  deleteUserFromSupabaseDirectly, 
  saveActivityLogToSupabaseDirectly, 
  fetchActivityLogsFromSupabaseDirectly, 
  purgeSchoolSupabaseDirectly 
} from './src/lib/supabaseSeeder.ts';
import { createWebAuthnRouter } from './server/webauthn.ts';

dotenv.config();
dotenv.config({ path: '.env.local', override: true });

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character] || character));

const sendAccountDeletionEmail = async (targetUser: any, actor: any) => {
  const recipientEmail = String(targetUser?.email || '').trim();
  if (!recipientEmail) return { success: false, skipped: true };

  const targetName = String(targetUser?.name || 'Utilisateur');
  const actorName = String(actor?.name || 'Administration EDUCO');
  const actorRole = canonicalizeRole(actor?.role) || 'Administration EDUCO';
  try {
    const result = await sendBrevoEmail({
      to: [{ email: recipientEmail, name: targetName }],
      subject: 'Votre compte EDUCO a été supprimé',
      htmlContent: `<p>Bonjour ${escapeHtml(targetName)},</p><p>Votre compte EDUCO a été supprimé de la plateforme par <strong>${escapeHtml(actorName)}</strong> (${escapeHtml(actorRole)}).</p><p>Si vous pensez qu’il s’agit d’une erreur, veuillez contacter votre établissement.</p>`,
      textContent: `Bonjour ${targetName},\n\nVotre compte EDUCO a été supprimé de la plateforme par ${actorName} (${actorRole}).\n\nSi vous pensez qu’il s’agit d’une erreur, veuillez contacter votre établissement.`,
      tags: ['account-deletion'],
    });
    if (!result.success) console.warn('Account-deletion email warning:', result.error || 'delivery failed');
    return result;
  } catch (error: any) {
    console.warn('Account-deletion email warning:', error?.message || error);
    return { success: false, error: error?.message || 'delivery failed' };
  }
};

const { 
  users, students, schools, classes, fees, payments, transactions, personnel, 
  subjects, grades, attendance, timetable, notifications,
  subscriptions, subscriptionRequests, surveys, surveyResponses, activityLogs 
} = schema;

async function seedDatabaseWithFullInitialData() {
  return false;
}

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT || process.env.VITE_PORT || 3001);
  const PORT = await findAvailablePort(preferredPort);

  // The API may also serve the built SPA on Render.  Its public URL is a
  // first-party origin, so include the platform-provided URL alongside the
  // explicit browser origins rather than falling back to a permissive CORS
  // policy.
  const configuredOrigins = [
    process.env.CORS_ALLOWED_ORIGINS || process.env.PUBLIC_APP_URL || 'https://educo-app.vercel.app,https://educo.loukatech.com',
    process.env.RENDER_EXTERNAL_URL || 'https://educo-app.onrender.com',
  ]
    .filter(Boolean)
    .flatMap(origins => origins!.split(','))
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(cors({
    origin(origin, callback) {
      if (!origin || (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) || configuredOrigins.includes(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }
      return callback(new Error('Origine non autorisée par la politique CORS.'));
    },
    credentials: true,
  }));
  // LoukaPay signs the exact raw bytes, so register its webhook before JSON parsing.
  registerLoukaPayWebhook(app, getSupabaseAdmin);
  app.use(express.json({ limit: '8mb' }));

  const rateBuckets = new Map<string, { count: number; resetAt: number }>();
  const rateLimit = (prefix: string, max: number, windowMs: number) => (req: any, res: any, next: any) => {
    const key = `${prefix}:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > max) return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
    return next();
  };

  // Enforce operational rights on the server as well as in the navigation.
  app.use('/api', (req: AuthRequest, res, next) => {
    const resource = req.path.split('/')[1];
    const writers: Record<string, string[]> = {
      transactions: ['Directeur Général', 'Responsable des finances', 'Caissière'],
      payments: ['Directeur Général', 'Responsable des finances', 'Caissière'],
      classes: ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire'],
      fees: ['Promoteur', 'Directeur Général', 'Responsable des finances'],
      personnel: ['Promoteur', 'Directeur Général', 'Responsable des finances'],
      grades: ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire', 'Enseignant'],
      school: ['Promoteur', 'Directeur Général'],
    };
    if (!writers[resource]) return next();
    return requireAuth(req, res, async () => {
      try {
        const user = await getRequestUser(req);
        const role = canonicalizeRole(user?.role);
        if (req.method === 'GET') {
          if (/parent|élève|eleve/i.test(role) && resource !== 'school') return res.status(403).json({ error: 'Utilisez votre espace personnel pour consulter vos données.' });
          if (resource === 'grades' && !canViewGrades(role)) return res.status(403).json({ error: 'Accès aux notes non autorisé pour ce compte.' });
        } else if (!['Admin', 'Co-admin', ...writers[resource]].includes(role)
          || (resource === 'transactions' && req.path.endsWith('/status') && role === 'Caissière')) {
          return res.status(403).json({ error: 'Opération non autorisée pour ce compte.' });
        }
        next();
      } catch (error: any) { res.status(503).json({ error: error.message }); }
    });
  });

  registerAdministrativePaymentRoutes(app, requireAuth, getRequestUser, getSupabaseAdmin);

  // WebAuthn / Passkeys API Routes
  app.use('/api/auth/webauthn', createWebAuthnRouter(getSupabaseAdmin, db, schema.webauthnCredentials));

  // Password login: credentials are verified by Supabase Auth on the server.
  // Public profile rows, cached browser users and biometric flags are never authentication proof.
  app.post('/api/auth/login', rateLimit('login', 10, 60_000), async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || '');
      const isAdminPortal = Boolean(req.body?.isAdminPortal);
      if (!email || password.length < 4) return res.status(400).json({ success: false, error: 'Identifiants invalides.' });
      if (req.body?.isBiometric) return res.status(400).json({ success: false, error: 'La biométrie doit utiliser la vérification WebAuthn dédiée.' });

      const authClient = getSupabaseAdmin();
      if (!authClient) return res.status(503).json({ success: false, error: 'Service d’authentification indisponible.' });
      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });
      if (authError || !authData?.user?.id || !authData?.session?.access_token) {
        return res.status(401).json({ success: false, error: 'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.' });
      }

      const { data: profile, error: profileError } = await authClient.from('users').select('*').eq('uid', authData.user.id).limit(1).maybeSingle();
      const resolvedProfile = profile || (await authClient.from('users').select('*').eq('email', email).limit(1).maybeSingle()).data;
      if (profileError && !resolvedProfile) return res.status(401).json({ success: false, error: 'Profil EDUCO introuvable.' });
      const user = mapSupabaseUser(resolvedProfile);
      if (!user || user.status === 'Inactif' || user.status === 'inactive') return res.status(403).json({ success: false, error: 'Ce compte est inactif.' });

      const isAdmin = user.role === 'Admin' || user.role === 'Co-admin';
      if (isAdmin && !isAdminPortal) return res.status(403).json({ success: false, error: 'Utilisez le portail d’administration dédié.' });
      if (isAdminPortal && !isAdmin) return res.status(403).json({ success: false, error: 'Ce portail est réservé aux administrateurs.' });

      const token = createLocalSessionToken(user);
      if (!token) return res.status(503).json({ success: false, error: 'Impossible de créer une session EDUCO sécurisée.' });
      return res.json({ success: true, user, token });
    } catch (error: any) {
      console.error('Secure login error:', error);
      return res.status(500).json({ success: false, error: 'Service d’authentification indisponible.' });
    }
  });

  // Ensure database tables & schema columns are synchronized asynchronously without blocking port binding
  ensureSchemaColumns().catch(err => {
    console.warn("Background schema sync notice:", err?.message || err);
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), commit: process.env.RENDER_GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || null });
  });

  // Get All Accounts in Supabase DB
  app.get('/api/db/accounts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const platformAdmin = await requirePlatformAdmin(req, res);
      if (!platformAdmin) return;
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) {
        return res.status(503).json({ success: false, error: 'Supabase non configuré' });
      }

      const [rawUsers, rawSchools] = await Promise.all([
        getSupabaseRows(supabaseAdmin, 'users'),
        getSupabaseRows(supabaseAdmin, 'schools')
      ]);
      const userList = rawUsers.map(mapSupabaseUser).filter(Boolean);
      const schoolList = rawSchools.map(mapSupabaseSchool).filter(Boolean);
      res.json({
        success: true,
        count: userList.length,
        users: userList,
        schools: schoolList
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erreur lors de la récupération des comptes' });
    }
  });

  // DB Connection Status
  app.get('/api/db/status', requireAuth, async (req: AuthRequest, res) => {
    const platformAdmin = await requirePlatformAdmin(req, res);
    if (!platformAdmin) return;
    const supabaseAdmin = getSupabaseAdmin(req);
    if (!supabaseAdmin) {
      return res.json({ 
        connected: false, 
        message: 'Supabase non configuré',
        tablesConfigured: true,
        recordCount: 0,
        schoolsCount: 0,
        personnelCount: 0
      });
    }
    try {
      const [{ data: userList }, { data: schoolList }, { data: personnelList }] = await Promise.all([
        supabaseAdmin.from('users').select('id').limit(50),
        supabaseAdmin.from('schools').select('id').limit(50),
        supabaseAdmin.from('personnel').select('id').limit(50)
      ]);
      res.json({ 
        connected: true, 
        message: 'Base de données Supabase connectée',
        tablesConfigured: true,
        recordCount: userList?.length || 0,
        schoolsCount: schoolList?.length || 0,
        personnelCount: personnelList?.length || 0
      });
    } catch (error: any) {
      res.json({ 
        connected: false, 
        message: 'Supabase indisponible',
        tablesConfigured: true,
        recordCount: 0,
        schoolsCount: 0,
        personnelCount: 0
      });
    }
  });

  // Safe Supabase table preview endpoint used by the Admin diagnostic console.
  // It intentionally supports only read-only SELECT ... FROM <table> LIMIT <n> previews.
  app.post('/api/db/query', requireAuth, async (req: AuthRequest, res) => {
    try {
      const platformAdmin = await requirePlatformAdmin(req, res);
      if (!platformAdmin) return;
      const query = String(req.body?.query || '').trim();
      if (!query) {
        return res.status(400).json({ success: false, error: 'Requête vide.' });
      }
      if (!/^select\b/i.test(query)) {
        return res.status(400).json({ success: false, error: 'Seules les requêtes SELECT de lecture sont autorisées.' });
      }

      const tableMatch = query.match(/\bfrom\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
      const limitMatch = query.match(/\blimit\s+(\d+)/i);
      const table = tableMatch?.[1]?.toLowerCase();
      const limit = Math.min(Math.max(Number(limitMatch?.[1] || 25), 1), 100);
      const allowedTables = new Set([
        'schools',
        'users',
        'students',
        'personnel',
        'classes',
        'fees',
        'payments',
        'transactions',
        'attendance',
        'grades',
        'subjects',
        'notifications',
        'subscriptions',
        'subscription_requests',
        'surveys',
        'survey_responses',
        'activity_logs'
      ]);

      if (!table || !allowedTables.has(table)) {
        return res.status(400).json({ success: false, error: 'Table non autorisée ou introuvable dans la requête.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact' })
          .limit(limit);
        if (error) throw error;
        return res.json({ success: true, source: 'supabase', table, rows: data || [], rowCount: count ?? data?.length ?? 0 });
      }

      if (!isDbConfigured()) {
        return res.status(503).json({ success: false, error: 'Supabase non configuré et PostgreSQL désactivé.' });
      }

      const fallbackTables: Record<string, any> = {
        schools, users, students, personnel, classes, fees, payments, transactions,
        attendance, grades, subjects, notifications, subscriptions, subscription_requests: subscriptionRequests,
        surveys, survey_responses: surveyResponses, activity_logs: activityLogs
      };
      const rows = await db.select().from(fallbackTables[table]).limit(limit);
      res.json({ success: true, source: 'fallback-db', table, rows, rowCount: rows.length });
    } catch (error: any) {
      console.error('Safe DB query error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Erreur lors de la lecture Supabase.' });
    }
  });

  // Legacy seed endpoint permanently disabled in production.
  app.post('/api/db/seed-all', (_req, res) => {
    return res.status(410).json({
      success: false,
      error: 'Le peuplement automatique de données fictives est définitivement désactivé.'
    });
  });

  // Legacy global purge removed. Use audited, tenant-scoped administration workflows instead.
  app.post('/api/db/purge-all', (_req, res) => {
    return res.status(410).json({
      success: false,
      error: 'La purge globale non auditée est désactivée.'
    });
  });

  // Test-school creation is disabled on production data.
  app.post('/api/db/test-create-school', (_req, res) => {
    return res.status(410).json({
      success: false,
      error: "La création d'établissement test est désactivée."
    });
  });


  // Legacy initial seed/sync cannot mutate production data.
  app.post('/api/db/init-seed', (_req, res) => {
    return res.status(410).json({
      success: false,
      error: 'La synchronisation initiale legacy est désactivée. Utilisez les workflows métier authentifiés.'
    });
  });

  // Batch Sync Endpoint for Offline Queue Processing.
  // Only financial records that can be safely reconstructed offline are accepted.
  app.post('/api/sync-batch', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = await getRequestUser(req);
      const role = canonicalizeRole(actor?.role);
      const client = getSupabaseAdmin(req);
      if (!actor || !client) return res.status(503).json({ success: false, error: 'Synchronisation sécurisée indisponible.' });

      const allowedRoles = new Set([
        'Admin','Co-admin','Promoteur','Directeur Général','Responsable des finances','Caissière'
      ]);
      if (!allowedRoles.has(role)) {
        return res.status(403).json({ success: false, error: 'Ce compte ne peut pas synchroniser des opérations financières.' });
      }

      const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
      if (!operations.length) return res.json({ success: true, processedCount: 0, duplicates: 0 });

      if (operations.length > 200) {
        return res.status(400).json({ success: false, error: 'Lot de synchronisation trop volumineux.' });
      }
      if (operations.some((op: any) => !['TRANSACTION','PAYMENT'].includes(String(op?.type || '').toUpperCase()))) {
        return res.status(400).json({
          success: false,
          error: 'La synchronisation hors-ligne des comptes utilisateurs ou autres objets sensibles est interdite.'
        });
      }

      const central = role === 'Admin' || role === 'Co-admin';
      let processedCount = 0;
      let duplicates = 0;

      for (const raw of operations) {
        const opId = String(raw?.id || '').trim();
        const opType = String(raw?.type || '').toUpperCase();
        const payload = raw?.payload || {};
        if (!/^[A-Za-z0-9_-]{8,120}$/.test(opId)) {
          return res.status(400).json({ success: false, error: 'Identifiant d’opération hors-ligne invalide.' });
        }

        const requestedSchoolId = Number(payload.schoolId || payload.school_id || 0);
        const schoolId = central ? requestedSchoolId : Number(actor.schoolId || actor.school_id || 0);
        if (!Number.isInteger(schoolId) || schoolId <= 0) {
          return res.status(400).json({ success: false, error: 'Établissement cible invalide pour la synchronisation.' });
        }

        const { data: school, error: schoolError } = await client
          .from('schools').select('id').eq('id', schoolId).maybeSingle();
        if (schoolError) throw schoolError;
        if (!school) return res.status(404).json({ success: false, error: 'Établissement cible introuvable.' });

        if (opType === 'TRANSACTION') {
          const amount = Number(payload.amount);
          if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Montant de transaction invalide.' });
          }
          const { data: existing, error: existingError } = await client
            .from('transactions').select('id').eq('offline_operation_id', opId).maybeSingle();
          if (existingError) throw existingError;
          if (existing) { duplicates += 1; continue; }

          const { error } = await client.from('transactions').insert([{
            school_id: schoolId,
            description: String(payload.description || '').slice(0, 500),
            type: payload.type || 'expense',
            amount,
            date: payload.date || new Date().toISOString(),
            category: String(payload.category || 'Autres').slice(0, 120),
            recorded_by: actor.id || null,
            offline_operation_id: opId,
          }]);
          if (error) throw error;
          processedCount += 1;
          continue;
        }

        const amount = Number(payload.amountPaid ?? payload.amount);
        const studentId = Number(payload.studentId || payload.student_id || 0);
        const feeId = Number(payload.feeId || payload.fee_id || 0);
        if (!Number.isFinite(amount) || amount <= 0 || !Number.isInteger(studentId) || studentId <= 0) {
          return res.status(400).json({ success: false, error: 'Paiement hors-ligne invalide.' });
        }

        const { data: student, error: studentError } = await client
          .from('students').select('id,school_id').eq('id', studentId).eq('school_id', schoolId).maybeSingle();
        if (studentError) throw studentError;
        if (!student) return res.status(403).json({ success: false, error: 'Élève hors du périmètre de cet établissement.' });

        if (feeId > 0) {
          const { data: fee, error: feeError } = await client
            .from('fees').select('id,school_id').eq('id', feeId).eq('school_id', schoolId).maybeSingle();
          if (feeError) throw feeError;
          if (!fee) return res.status(403).json({ success: false, error: 'Frais hors du périmètre de cet établissement.' });
        }

        const { data: existing, error: existingError } = await client
          .from('payments').select('id').eq('offline_operation_id', opId).maybeSingle();
        if (existingError) throw existingError;
        if (existing) { duplicates += 1; continue; }

        const { error } = await client.from('payments').insert([{
          school_id: schoolId,
          student_id: studentId,
          fee_id: feeId > 0 ? feeId : null,
          amount,
          payment_date: payload.paymentDate || payload.payment_date || new Date().toISOString(),
          payment_method: String(payload.paymentMethod || payload.payment_method || 'Espèces').slice(0, 80),
          receipt_number: String(payload.receiptNumber || payload.receipt_number || ('OFF-' + opId)).slice(0, 120),
          status: 'paid',
          offline_operation_id: opId,
        }]);
        if (error) throw error;
        processedCount += 1;
      }

      return res.json({
        success: true,
        processedCount,
        duplicates,
        syncedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Secure batch sync error:', error);
      return res.status(500).json({ success: false, error: 'Synchronisation hors-ligne impossible.' });
    }
  });

  // Admin Endpoint: Reset (DANGEROUS)
  app.post('/api/admin/reset-data', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (dbUser?.role !== 'Admin') return res.status(403).json({ error: 'Only admins can reset data' });
      
      const schoolId = dbUser.schoolId;
      if (!schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        await Promise.all([
          deleteSupabaseBySchool(supabaseAdmin, 'payments', Number(schoolId)),
          deleteSupabaseBySchool(supabaseAdmin, 'transactions', Number(schoolId)),
          deleteSupabaseBySchool(supabaseAdmin, 'fees', Number(schoolId)),
          deleteSupabaseBySchool(supabaseAdmin, 'classes', Number(schoolId)),
          deleteSupabaseBySchool(supabaseAdmin, 'subjects', Number(schoolId)),
          deleteSupabaseBySchool(supabaseAdmin, 'personnel', Number(schoolId)),
          deleteSupabaseBySchool(supabaseAdmin, 'students', Number(schoolId)),
        ]);
        return res.json({ success: true, message: 'Données de l\'établissement réinitialisées avec succès dans Supabase.' });
      }

      // Order to avoid FK constraint violations
      await db.delete(notifications).where(eq(notifications.userId, dbUser.id));
      await db.delete(payments).where(eq(payments.schoolId, schoolId));
      await db.delete(transactions).where(eq(transactions.schoolId, schoolId));
      await db.delete(fees).where(eq(fees.schoolId, schoolId));
      await db.delete(classes).where(eq(classes.schoolId, schoolId));
      await db.delete(subjects).where(eq(subjects.schoolId, schoolId));
      await db.delete(personnel).where(eq(personnel.schoolId, schoolId));
      // We don't delete users to avoid breaking the current session

      res.json({ success: true, message: 'Données de l\'établissement réinitialisées avec succès.' });
    } catch (error: any) {
      console.error('Reset Error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Erreur lors de la réinitialisation' });
    }
  });

  // Render serves the source worker while Vercel serves public/sw.js. Both
  // workers build the same complete offline cache during installation.
  app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'sw.js'));
  });
  app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
  });

  // User and School Management
  app.post('/api/auth/register-school', rateLimit('school-registration', 5, 30 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const { 
        schoolName, 
        schoolAddress, 
        schoolPhone, 
        creationDate,
        promoterName, 
        promoterContact,
        promoterEmail,
        levels,
        openingAuthorizationDoc,
        promoterIdDoc,
        statutesDoc,
        adminPassword,
        password,
        otpCode
      } = req.body;

      const resolvedEmail = normalizeEmail(promoterEmail);
      const rawAdminPassword = adminPassword || password;
      if (!resolvedEmail || !schoolName || !schoolAddress || !promoterName) {
        return res.status(400).json({ error: 'Établissement, responsable et adresse e-mail valides sont requis.' });
      }
      const passwordError = getNewPasswordError(rawAdminPassword);
      if (passwordError) return res.status(400).json({ error: passwordError });
      const otpVerification = otpManager.verifyOtp(resolvedEmail, String(otpCode || ''), 'school_registration' as any);
      if (!otpVerification.valid) {
        return res.status(400).json({ error: otpVerification.error || 'Code OTP invalide ou expiré.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin || getSupabaseServerKeyRole(req) !== 'service_role') {
        return res.status(503).json({ error: 'Service sécurisé de création d’établissement indisponible.' });
      }
      let resolvedUid: string | null = null;

      // A registration retry must reuse the existing dossier instead of creating
      // a second school with a new identifier.  Previously a retry could leave
      // two rows for the same promoter, while the account pointed at only one
      // of them; this is why the identifier shown in the subscription modal
      // could differ from the identifier shown in the admin directory.
      if (supabaseAdmin && resolvedEmail) {
        const normalizedEmail = resolvedEmail.trim().toLowerCase();
        const normalizedSchoolName = String(schoolName || '').trim().toLocaleLowerCase();
        const [{ data: account }, { data: schoolsByEmail }, { data: schoolsByPromoterEmail }] = await Promise.all([
          supabaseAdmin.from('users').select('school_id').eq('email', normalizedEmail).limit(1).maybeSingle(),
          supabaseAdmin.from('schools').select('id, name, identifier').eq('email', normalizedEmail),
          supabaseAdmin.from('schools').select('id, name, identifier').eq('promoter_email', normalizedEmail),
        ]);
        const existingSchools = [...(schoolsByEmail || []), ...(schoolsByPromoterEmail || [])];
        const matchingSchool = existingSchools.find((school: any) =>
          String(school.name || '').trim().toLocaleLowerCase() === normalizedSchoolName
        );

        if (matchingSchool) {
          return res.status(409).json({
            error: 'Un dossier existe déjà pour cet établissement et cette adresse e-mail.',
            schoolId: matchingSchool.id,
            schoolIdentifier: matchingSchool.identifier,
          });
        }
        if (account?.school_id) {
          return res.status(409).json({
            error: 'Cette adresse e-mail est déjà rattachée à un établissement. Utilisez le compte existant ou contactez l’administration EDUCO.',
            schoolId: account.school_id,
          });
        }
      }

      // Generate a unique institutional identifier (e.g., EDUCO-SCH-8492)
      const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const schoolIdentifier = `EDUCO-SCH-${randomSuffix}`;

      ensureSchemaColumns().catch(err => {
        console.warn('School registration schema sync notice:', err?.message || err);
      });

      if (!resolvedUid) {
        if (!rawAdminPassword) {
          return res.status(400).json({
            error: 'Le mot de passe promoteur est obligatoire pour créer le compte établissement.'
          });
        }

        if (!supabaseAdmin) {
          return res.status(503).json({
            error: 'Supabase Auth serveur doit être configuré avant de créer un établissement.'
          });
        }

        const authMetadata = {
            name: promoterName || firebaseUser?.name || 'Promoteur',
            role: 'Promoteur',
            schoolName,
            schoolIdentifier
        };
        const keyRole = getSupabaseServerKeyRole(req);
        const authResult = await supabaseAdmin.auth.admin.createUser({
          email: resolvedEmail,
          password: rawAdminPassword,
          email_confirm: true,
          user_metadata: authMetadata
        });

        const authData = authResult.data;
        const authError = authResult.error;

        if (authError || !authData?.user?.id) {
          const errorMessage = authError?.message || 'Impossible de créer le compte promoteur dans Supabase Auth.';
          const isDuplicateEmail = /already|exist|registered|duplicate/i.test(errorMessage);
          if (isDuplicateEmail && keyRole === 'service_role') {
            const { data: existingAppUser } = await supabaseAdmin
              .from('users')
              .select('id, uid, email')
              .eq('email', resolvedEmail)
              .limit(1)
              .maybeSingle();

            if (existingAppUser?.uid) {
              return res.status(409).json({
                error: 'Cette adresse email est déjà associée à un compte.'
              });
            }

            const { data: authUsers, error: listAuthError } = await supabaseAdmin.auth.admin.listUsers({
              page: 1,
              perPage: 1000,
            });
            if (!listAuthError) {
              const orphanAuthUser = authUsers?.users?.find((user: any) =>
                String(user.email || '').toLowerCase() === resolvedEmail.toLowerCase()
              );
              if (orphanAuthUser?.id) {
                const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(orphanAuthUser.id, {
                  password: rawAdminPassword,
                  email_confirm: true,
                  user_metadata: authMetadata,
                });
                if (!updateAuthError) {
                  resolvedUid = orphanAuthUser.id;
                }
              }
            }
          }

          if (resolvedUid) {
            console.warn(`Recovered orphan Supabase Auth user for school registration: ${resolvedEmail}`);
          } else {
            return res.status(isDuplicateEmail ? 409 : 502).json({
              error: isDuplicateEmail
                ? 'Cette adresse email est déjà associée à un compte.'
                : errorMessage
            });
          }
        }

        if (!resolvedUid && authData?.user?.id) {
          resolvedUid = authData.user.id;
        }
      }

      // 1. Create the school with complete dossier
      const schoolValues = {
        name: schoolName,
        identifier: schoolIdentifier,
        address: schoolAddress,
        phone: schoolPhone || null,
        email: resolvedEmail,
        creationDate: creationDate || null,
        promoterName: promoterName || 'Promoteur',
        promoterContact: promoterContact || schoolPhone || null,
        promoterEmail: resolvedEmail,
        levels: levels || {},
        openingAuthorizationDoc: openingAuthorizationDoc || (req.body.hasOpeningDoc ? 'Autorisation_Ouverture_Ministère.pdf' : null),
        promoterIdDoc: promoterIdDoc || (req.body.hasPromoterDoc ? 'Piece_Identite_Promoteur.pdf' : null),
        statutesDoc: statutesDoc || null,
        status: 'registered',
      };

      const selectedClassRows = Object.entries(schoolValues.levels || {}).flatMap(([cycleKey, cycleValue]: [string, any]) => {
        const cycleLabels: Record<string, string> = {
          garderie: 'Garderie',
          prescolaire: 'Préscolaire',
          primaire: 'Primaire',
          secondaireCollege: 'Collège',
          secondaireLycee: 'Lycée',
        };

        if (cycleKey === 'garderie' && cycleValue === true) {
          return [{ name: 'Garderie', level: cycleLabels[cycleKey] || 'Garderie' }];
        }

        if (!cycleValue || typeof cycleValue !== 'object') return [];

        return Object.entries(cycleValue)
          .filter(([, isSelected]) => Boolean(isSelected))
          .map(([className]) => ({
            name: className,
            level: cycleLabels[cycleKey] || cycleKey,
          }));
      });

      let newSchool: any;
      try {
        [newSchool] = await db.insert(schools).values(schoolValues).returning();
      } catch (dbSchoolErr) {
        if (!supabaseAdmin) throw dbSchoolErr;
        console.warn('Postgres school insert failed, falling back to Supabase REST:', dbSchoolErr);
        const { data: sbSchool, error: sbSchoolError } = await supabaseAdmin
          .from('schools')
          .insert([{
            name: schoolValues.name,
            identifier: schoolValues.identifier,
            address: schoolValues.address,
            phone: schoolValues.phone,
            email: resolvedEmail,
            creation_date: schoolValues.creationDate,
            promoter_name: schoolValues.promoterName,
            promoter_contact: schoolValues.promoterContact,
            promoter_email: resolvedEmail,
            levels: schoolValues.levels,
            opening_authorization_doc: schoolValues.openingAuthorizationDoc,
            promoter_id_doc: schoolValues.promoterIdDoc,
            statutes_doc: schoolValues.statutesDoc,
            status: schoolValues.status,
          }])
          .select('*')
          .single();

        if (sbSchoolError || !sbSchool) {
          throw sbSchoolError || dbSchoolErr;
        }
        newSchool = mapSupabaseSchool(sbSchool);
      }

      // 2. Create the promoter/admin user linked to this school
      let adminUser: any;
      try {
        adminUser = await getOrCreateUser(
          resolvedUid,
          resolvedEmail,
          promoterName || 'Promoteur',
          'Promoteur',
          newSchool.id
        );
      } catch (dbUserErr) {
        if (!supabaseAdmin) throw dbUserErr;
        console.warn('Postgres promoter insert failed, falling back to Supabase REST:', dbUserErr);
        const { data: sbUser, error: sbUserError } = await supabaseAdmin
          .from('users')
          .insert([{
            uid: resolvedUid,
            email: resolvedEmail,
            phone: normalizePhoneIdentity(promoterContact || schoolPhone) || null,
            name: promoterName || firebaseUser?.name || 'Promoteur',
            role: 'Promoteur',
            school_id: newSchool.id,
            status: 'active'
          }])
          .select('*')
          .single();

        if (sbUserError || !sbUser) {
          throw sbUserError || dbUserErr;
        }
        adminUser = mapSupabaseUser(sbUser);
      }

      // 2b. Sync directly with Supabase DB if configured
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('schools').upsert([{
            id: newSchool.id,
            name: schoolName,
            identifier: schoolIdentifier,
            address: schoolAddress,
            phone: schoolPhone || null,
            email: resolvedEmail,
            creation_date: creationDate || null,
            promoter_name: promoterName || firebaseUser?.name || 'Promoteur',
            promoter_contact: promoterContact || schoolPhone || null,
            promoter_email: resolvedEmail,
            status: 'registered'
          }], { onConflict: 'id' });

          const promoterUserPayload = {
            uid: resolvedUid,
            email: resolvedEmail,
            phone: normalizePhoneIdentity(promoterContact || schoolPhone) || null,
            name: promoterName || firebaseUser?.name || 'Promoteur',
            role: 'Promoteur',
            school_id: newSchool.id,
            status: 'active'
          };

          const { data: existingPromoterUser } = await supabaseAdmin
            .from('users')
            .select('*')
            .eq('email', resolvedEmail)
            .limit(1)
            .maybeSingle();

          const { data: syncedPromoterUser, error: syncedPromoterError } = existingPromoterUser?.id
            ? await supabaseAdmin
                .from('users')
                .update(promoterUserPayload)
                .eq('id', existingPromoterUser.id)
                .select('*')
                .single()
            : await supabaseAdmin
                .from('users')
                .insert([promoterUserPayload])
                .select('*')
                .single();

          if (syncedPromoterError) {
            throw syncedPromoterError;
          }

          if (syncedPromoterUser) {
            adminUser = mapSupabaseUser(syncedPromoterUser);
          }
        } catch (sbSyncErr) {
          console.warn('Supabase school registration sync warning:', sbSyncErr);
        }
      }

      if (selectedClassRows.length > 0) {
        try {
          const classValues = selectedClassRows.map(row => ({
            schoolId: newSchool.id,
            name: row.name,
            level: row.level,
            capacity: 30,
          }));
          await db.insert(classes).values(classValues);
        } catch (classDbErr) {
          if (!supabaseAdmin) {
            console.warn('Initial class creation warning:', classDbErr);
          } else {
            const { error: sbClassError } = await supabaseAdmin.from('classes').insert(
              selectedClassRows.map(row => ({
                school_id: newSchool.id,
                name: row.name,
                level: row.level,
                capacity: 30,
              }))
            );
            if (sbClassError) {
              console.warn('Supabase initial class creation warning:', sbClassError);
            }
          }
        }
      }

      // 3. Dispatch in-app and email notifications to all Admin and Co-Admin accounts
      try {
        const adminUsers = await db.select().from(users).where(eq(users.role, 'Admin'));
        const coAdminUsers = await db.select().from(users).where(eq(users.role, 'Co-admin'));
        const allSuperAdmins = [...adminUsers, ...coAdminUsers];

        const notificationMessage = `Nouvel établissement inscrit : "${schoolName}" (ID: ${schoolIdentifier}). Promoteur : ${promoterName || 'Non spécifié'} (${promoterContact || schoolPhone || 'Contact'}). Le dossier officiel et les pièces justificatives sont prêts à être validés.`;

        for (const adm of allSuperAdmins) {
          await db.insert(notifications).values({
            userId: adm.id,
            title: `Nouvelle Inscription : ${schoolName}`,
            message: notificationMessage,
            type: 'Alerte',
            link: 'Établissements Inscrits',
          });
        }

        // Add a notification for the school owner as well
        await db.insert(notifications).values({
          userId: adminUser.id,
          title: `Bienvenue sur EDUCO !`,
          message: `Votre établissement "${schoolName}" (${schoolIdentifier}) est enregistré en mode Inscription. Activez votre licence pour déverrouiller tous les modules.`,
          type: 'Information',
          link: 'Abonnement & Licence',
        });

        // Brevo email dispatches:
        // A) Alert Super Admins
        const adminEmailList = allSuperAdmins.map(a => a.email).filter(Boolean);
        if (adminEmailList.length > 0) {
          sendAdminSchoolAlertEmail({
            adminEmails: adminEmailList,
            schoolName,
            schoolIdentifier,
            promoterName: promoterName || 'Non spécifié',
            promoterPhone: promoterContact || schoolPhone || '',
            promoterEmail: resolvedEmail,
          }).catch(e => console.warn('Brevo Admin Alert Email warning:', e));
        }

        // B) Send Welcome Email to the registered promoter
        sendWelcomeEmail({
          email: resolvedEmail,
          name: promoterName || 'Promoteur',
          role: 'Promoteur',
          schoolName,
          schoolIdentifier,
          loginUrl: `${req.protocol}://${req.get('host')}/login`,
        }).catch(e => console.warn('Brevo Promoter Welcome Email warning:', e));

        console.log(`[BREVO EMAIL DISPATCH] Sent registration alert & welcome email for: ${schoolName} (${schoolIdentifier})`);
      } catch (notifErr) {
        console.warn('Notification dispatch warning:', notifErr);
      }

      res.json({ 
        success: true, 
        school: newSchool, 
        user: adminUser,
        schoolIdentifier: newSchool.identifier 
      });
    } catch (error: any) {
      console.error('School Registration Error:', error);
      const databaseDetail = error?.cause?.message || error?.detail || error?.hint;
      res.status(500).json({
        error: databaseDetail || error.message || 'Erreur lors de l\'enregistrement de l\'établissement'
      });
    }
  });

  // Public Parent Account Registration using School Matricule
  app.post('/api/auth/register-parent', rateLimit('parent-registration', 8, 30 * 60 * 1000), async (req, res) => {
    try {
      const { schoolMatricule, studentMatricule, parentName, parentEmail, parentPhone, password, studentName, otpCode } = req.body;

      const normalizedParentPhone = normalizePhoneIdentity(parentPhone);
      if (!schoolMatricule || !parentName || !parentEmail || normalizedParentPhone.length < 7) {
        return res.status(400).json({ error: 'Le N° Matricule d\'établissement, le nom, l\'adresse e-mail et un numéro de téléphone valide sont obligatoires.' });
      }
      const parentPasswordError = getNewPasswordError(password);
      if (parentPasswordError) {
        return res.status(400).json({ error: parentPasswordError });
      }
      const normalizedParentEmail = normalizeEmail(parentEmail);
      const otpVerification = otpManager.verifyOtp(normalizedParentEmail, String(otpCode || ''), 'general' as any);
      if (!otpVerification.valid) {
        return res.status(400).json({ error: otpVerification.error || 'Code OTP invalide ou expiré.' });
      }

      const formattedMatricule = schoolMatricule.trim().toUpperCase();
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin?.auth?.admin) {
        return res.status(503).json({ error: 'Service sécurisé de création de compte indisponible.' });
      }
      let schoolObj: any = null;
      try {
        const matchingSchools = await db.select().from(schools).where(eq(schools.identifier, formattedMatricule));
        schoolObj = matchingSchools[0];
      } catch (dbSchoolLookupErr) {
        console.warn('Postgres school lookup failed for parent registration:', dbSchoolLookupErr);
      }

      if (!schoolObj) {
        try {
          const allSchools = await db.select().from(schools);
          schoolObj = allSchools.find(s => s.identifier?.toLowerCase() === schoolMatricule.trim().toLowerCase());
        } catch (dbAllSchoolsErr) {
          if (supabaseAdmin) {
            const { data: sbSchool } = await supabaseAdmin
              .from('schools')
              .select('*')
              .eq('identifier', formattedMatricule)
              .limit(1)
              .maybeSingle();
            schoolObj = mapSupabaseSchool(sbSchool);
            // A few historical schools have no stored identifier. Their
            // deterministic fallback remains valid and is persisted on first use.
            if (!schoolObj) {
              const { data: allSupabaseSchools, error: allSchoolsError } = await supabaseAdmin
                .from('schools')
                .select('*');
              if (allSchoolsError) throw allSchoolsError;
              const matchedSchool = (allSupabaseSchools || []).find((candidate: any) =>
                String(candidate.identifier || buildFallbackSchoolIdentifier(candidate.id)).toUpperCase() === formattedMatricule
              );
              schoolObj = await ensureSchoolIdentifier(mapSupabaseSchool(matchedSchool), supabaseAdmin);
            }
          } else {
            console.warn('Postgres all schools lookup failed and Supabase fallback is unavailable:', dbAllSchoolsErr);
          }
        }
      }

      if (!schoolObj) {
        return res.status(404).json({ 
          error: `Aucun établissement ne correspond au N° Matricule "${schoolMatricule}". Veuillez vérifier le code auprès de la direction de l'école.` 
        });
      }

      // Check linked student if matricule provided
      let linkedStudent = null;
      if (studentMatricule) {
        try {
          const matchingStudents = await db.select().from(students).where(eq(students.studentId, studentMatricule.trim()));
          if (matchingStudents.length > 0) {
            linkedStudent = matchingStudents[0];
          }
        } catch (dbStudentLookupErr) {
          if (supabaseAdmin) {
            const { data: sbStudent } = await supabaseAdmin
              .from('students')
              .select('*')
              .eq('school_id', schoolObj.id)
              .eq('student_id', studentMatricule.trim())
              .limit(1)
              .maybeSingle();
            linkedStudent = sbStudent;
          } else {
            console.warn('Postgres student lookup failed and Supabase fallback is unavailable:', dbStudentLookupErr);
          }
        }
      }

      const { data: existingParentEmail, error: existingParentEmailError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', normalizedParentEmail)
        .limit(1)
        .maybeSingle();
      if (existingParentEmailError) throw existingParentEmailError;
      if (existingParentEmail?.id) {
        return res.status(409).json({ error: 'Cette adresse e-mail est déjà associée à un compte.' });
      }

      const { data: existingParentPhone, error: existingParentPhoneError } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('phone_normalized', normalizedParentPhone)
        .limit(1)
        .maybeSingle();
      if (existingParentPhoneError) throw existingParentPhoneError;
      if (existingParentPhone?.id) {
        return res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un compte.' });
      }

      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedParentEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: parentName,
          role: 'Parent',
          schoolId: schoolObj.id,
        }
      });
      if (createError || !authUser?.user?.id) {
        const message = String(createError?.message || '');
        if (/already|registered|exists|duplicate/i.test(message)) {
          return res.status(409).json({ error: 'Cette adresse e-mail est déjà associée à un compte.' });
        }
        throw createError || new Error('Impossible de créer l’identité de connexion du parent.');
      }

      const uid = authUser.user.id;
      const parentValues = {
        uid,
        schoolId: schoolObj.id,
        name: parentName,
        email: normalizedParentEmail,
        phone: normalizedParentPhone,
        role: 'Parent',
        status: 'active',
      };

      let newParent: any;
      try {
        try {
          [newParent] = await db.insert(users).values(parentValues).returning();
        } catch (dbParentErr) {
          console.warn('Postgres parent insert failed, falling back to Supabase REST:', dbParentErr);
          const { data: sbParent, error: sbParentError } = await supabaseAdmin
            .from('users')
            .insert([{
              uid,
              school_id: schoolObj.id,
              name: parentName,
              email: normalizedParentEmail,
              phone: normalizedParentPhone,
              role: 'Parent',
              status: 'active',
            }])
            .select('*')
            .single();

          if (sbParentError || !sbParent) throw sbParentError || dbParentErr;
          newParent = mapSupabaseUser(sbParent);
        }
      } catch (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => undefined);
        throw profileError;
      }

      if (supabaseAdmin && studentMatricule) {
        try {
          await supabaseAdmin
            .from('students')
            .update({
              parent_name: parentName,
              parent_phone: parentPhone || '',
              parent_email: normalizedParentEmail
            })
            .eq('school_id', schoolObj.id)
            .eq('student_id', studentMatricule.trim());
        } catch (linkErr: any) {
          console.warn('Parent/student link update warning:', linkErr?.message || linkErr);
        }
      }

      res.json({
        success: true,
        user: newParent,
        licenseSchoolId: schoolObj.id,
        school: schoolObj,
        student: linkedStudent,
        message: `Compte Parent créé avec succès pour l'établissement "${schoolObj.name}".`
      });
    } catch (error: any) {
      console.error('Parent Registration Error:', error);
      res.status(500).json({ error: error.message || 'Erreur lors de la création du compte Parent.' });
    }
  });

  // Public Endpoint to Verify School Matricule
  app.get('/api/auth/verify-school-matricule/:matricule', rateLimit('school-matricule-verify', 20, 15 * 60 * 1000), async (req, res) => {
    try {
      const matricule = req.params.matricule.trim().toUpperCase();
      const supabaseAdmin = getSupabaseAdmin(req);
      let schoolObj: any = null;
      try {
        const matchingSchools = await db.select().from(schools).where(eq(schools.identifier, matricule));
        schoolObj = matchingSchools[0];
      } catch (dbSchoolLookupErr) {
        console.warn('Postgres matricule lookup failed:', dbSchoolLookupErr);
      }

      if (!schoolObj) {
        try {
          const allSchools = await db.select().from(schools);
          schoolObj = allSchools.find(s => s.identifier?.toLowerCase() === req.params.matricule.trim().toLowerCase());
        } catch (dbAllSchoolsErr) {
          if (supabaseAdmin) {
            const { data: sbSchool } = await supabaseAdmin
              .from('schools')
              .select('*')
              .eq('identifier', matricule)
              .limit(1)
              .maybeSingle();
            schoolObj = mapSupabaseSchool(sbSchool);
            if (!schoolObj) {
              const { data: allSupabaseSchools, error: allSchoolsError } = await supabaseAdmin
                .from('schools')
                .select('*');
              if (allSchoolsError) throw allSchoolsError;
              const matchedSchool = (allSupabaseSchools || []).find((candidate: any) =>
                String(candidate.identifier || buildFallbackSchoolIdentifier(candidate.id)).toUpperCase() === matricule
              );
              schoolObj = await ensureSchoolIdentifier(mapSupabaseSchool(matchedSchool), supabaseAdmin);
            }
          } else {
            console.warn('Postgres all schools lookup failed and Supabase fallback is unavailable:', dbAllSchoolsErr);
          }
        }
      }

      if (schoolObj) {
        res.json({ valid: true, school: { id: schoolObj.id, name: schoolObj.name, identifier: schoolObj.identifier } });
      } else {
        res.json({ valid: false, error: 'Matricule d\'établissement introuvable.' });
      }
    } catch (error: any) {
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // Find user by email (Public)
  app.get('/api/auth/find-user', rateLimit('find-user-retired', 10, 15 * 60 * 1000), (_req, res) => {
    return res.status(410).json({ error: 'La recherche publique de comptes est désactivée.' });
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const firebaseUser = req.user!;
      const user = await getUserByUid(firebaseUser.uid);
      
      if (!user) {
        // First time login - auto-create user record
        const newUser = await getOrCreateUser(
          firebaseUser.uid,
          firebaseUser.email!,
          firebaseUser.name || 'Utilisateur',
          'Personnel'
        );
        return res.json({ user: newUser });
      }
      
      res.json({ user });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Users Endpoints
  app.get('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = (req.user?.role || req.user?.schoolId) ? req.user : await getUserByUid(req.user!.uid);
      const userRole = req.user?.role || dbUser?.role;
      const schoolId = req.user?.schoolId || dbUser?.schoolId;

      const supabaseAdmin = getSupabaseAdmin(req);
      let allUsersList: any[] = supabaseAdmin ? [] : await db.select().from(users).catch(() => []);
      if (supabaseAdmin) {
        try {
          const [
            { data: sbUsers },
            { data: sbStudents },
            { data: sbPersonnel },
            { data: sbClasses }
          ] = await Promise.all([
            supabaseAdmin.from('users').select('*'),
            supabaseAdmin.from('students').select('*'),
            supabaseAdmin.from('personnel').select('*'),
            supabaseAdmin.from('classes').select('*')
          ]);
          const classesById = new Map((sbClasses || []).map((c: any) => [String(c.id), c]));
          const studentByUserId = new Map((sbStudents || []).map((student: any) => [String(student.user_id || student.userId), student]));
          const personnelByUserId = new Map((sbPersonnel || []).map((person: any) => [String(person.user_id || person.userId), person]));
          const enrichAccount = (user: any) => {
            const student = studentByUserId.get(String(user.id));
            const person = personnelByUserId.get(String(user.id));
            const assignedClass = student ? classesById.get(String(student.class_id || student.classId || '')) : null;
            return {
              ...user,
              personnelId: person?.id || user.personnelId || user.personnel_id,
              matricule: student?.student_id || student?.matricule || person?.matricule || user.matricule,
              student_id: student?.student_id || user.student_id || user.matricule,
              class_id: student?.class_id || user.class_id,
              class: assignedClass?.name || student?.class || user.class,
              parent_name: student?.parent_name || user.parent_name,
              parent_email: student?.parent_email || user.parent_email,
              parent_phone: student?.parent_phone || user.parent_phone,
              phone: user.phone || student?.parent_phone,
              baseSalary: person?.base_salary ?? user.baseSalary,
              salary: person?.base_salary ?? user.salary,
              hireDate: person?.hire_date || user.hireDate,
              bankAccount: person?.bank_account || user.bankAccount,
              role: canonicalizeRole(person?.role || user.role),
              status: normalizeAccountStatus(user.status || student?.status)
            };
          };
          if (sbUsers && sbUsers.length > 0) {
            sbUsers.forEach(su => {
              const enrichedUser = enrichAccount(su);
              const existingIdx = allUsersList.findIndex(u => u.id === enrichedUser.id || (enrichedUser.email && u.email && u.email.toLowerCase() === enrichedUser.email.toLowerCase()));
              if (existingIdx >= 0) {
                // Enrich existing user with any missing fields from Supabase
                allUsersList[existingIdx] = {
                  ...allUsersList[existingIdx],
                  ...mapSupabaseUser(enrichedUser),
                  avatar: allUsersList[existingIdx].avatar || enrichedUser.avatar,
                  phone: allUsersList[existingIdx].phone || enrichedUser.phone,
                  status: normalizeAccountStatus(allUsersList[existingIdx].status || enrichedUser.status),
                };
              } else {
                allUsersList.push(mapSupabaseUser(enrichedUser));
              }
            });
          }
        } catch (e) {
          console.warn('Supabase fetch users warning:', e);
        }
      }

      if (userRole === 'Admin' || userRole === 'Co-admin') {
        return res.json(allUsersList);
      }

      if (!schoolId) return res.status(403).json({ error: 'No school associated' });

      const filteredUsers = allUsersList.filter(u => Number(u.schoolId) === Number(schoolId));
      res.json(filteredUsers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/users', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = (req.user?.role || req.user?.schoolId) ? req.user : await getUserByUid(req.user!.uid);
      const requestedRole = String(req.body.role || '');
      const canonicalRequestedRole = canonicalizeRole(requestedRole);
      const normalizedRequestedRole = normalizeRole(requestedRole);
      const accountKind = getAccountCreationKind(requestedRole);
      const requestEmail = normalizeEmail(req.body.email);
      const requestPhone = normalizePhoneIdentity(req.body.phone || req.body.contact);
      if (requestPhone.length < 7) {
        return res.status(400).json({ error: 'Un numéro de téléphone principal valide est obligatoire.' });
      }
      if (canonicalRequestedRole === 'Admin') {
        return res.status(403).json({ error: 'Le compte Admin unique ne peut pas être créé depuis la gestion des utilisateurs.' });
      }
      if (canonicalRequestedRole === 'Co-admin' && dbUser?.role !== 'Admin') {
        return res.status(403).json({ error: 'Seul le compte Admin peut créer ou modifier un compte Co-admin.' });
      }
      
      const isSelfUpdate = dbUser && (
        (req.body.id && Number(req.body.id) === dbUser.id) ||
        (req.body.uid && req.body.uid === dbUser.uid) ||
        (requestEmail && requestEmail === normalizeEmail(dbUser.email))
      );

      const isCentralAdmin = dbUser?.role === 'Admin' || dbUser?.role === 'Co-admin';
      const requestedSchoolId = Number(req.body.schoolId);
      const targetSchoolId: number | null = isCentralAdmin && Number.isInteger(requestedSchoolId) && requestedSchoolId > 0
        ? requestedSchoolId
        : (dbUser?.schoolId ? Number(dbUser.schoolId) : null);
      if (!targetSchoolId && canonicalRequestedRole !== 'Co-admin') {
        return res.status(403).json({ error: 'Aucun établissement associé au créateur de ce compte.' });
      }
      if (!isCentralAdmin && Number(targetSchoolId) !== Number(dbUser?.schoolId)) {
        return res.status(403).json({ error: 'Le promoteur ne peut créer des comptes que pour son établissement.' });
      }

      if (req.body.id && !isCentralAdmin) {
        const supabaseAdmin = getSupabaseAdmin(req);
        const target = supabaseAdmin
          ? (await supabaseAdmin.from('users').select('school_id').eq('id', Number(req.body.id)).maybeSingle()).data
          : (await db.select().from(users).where(eq(users.id, Number(req.body.id))).limit(1))[0];
        if (!target || Number(target.school_id ?? target.schoolId) !== Number(dbUser.schoolId)) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
      }

      if (req.body.id) {
        const supabaseAdmin = getSupabaseAdmin(req);
        const existingWithEmail = requestEmail
          ? await ensureUniqueUserEmail({ req, email: requestEmail, excludeUserId: Number(req.body.id), excludeUid: req.body.uid })
          : null;
        if (existingWithEmail) {
          return res.status(409).json({ error: buildDuplicateEmailMessage(requestEmail) });
        }
        if (supabaseAdmin) {
          const { data: phoneOwner, error: phoneLookupError } = await supabaseAdmin.from('users').select('id').eq('phone_normalized', requestPhone).neq('id', Number(req.body.id)).limit(1).maybeSingle();
          if (phoneLookupError) throw phoneLookupError;
          if (phoneOwner?.id) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un autre compte.' });
          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              name: req.body.name,
              email: req.body.email,
              phone: requestPhone,
              role: canonicalRequestedRole,
              status: req.body.status === 'Inactif' ? 'inactive' : 'active',
              avatar: req.body.avatar,
              school_id: targetSchoolId
            })
            .eq('id', Number(req.body.id))
            .select('*')
            .single();
          if (updateError) throw updateError;
          return res.json(mapSupabaseUser(updatedUser));
        }

        const updated = await db.update(users)
          .set({
            name: req.body.name,
            email: req.body.email,
            phone: requestPhone,
            role: canonicalRequestedRole,
            status: req.body.status || 'Actif',
            avatar: req.body.avatar,
            schoolId: targetSchoolId
          })
          .where(eq(users.id, Number(req.body.id)))
          .returning();

        return res.json(updated[0] || req.body);
      }

      let resolvedUid = req.body.uid || `usr_${Date.now()}`;
      
      const adminClient = getSupabaseAdmin(req);
      if (adminClient) {
        const { data: phoneOwner, error: phoneLookupError } = await adminClient.from('users').select('id').eq('phone_normalized', requestPhone).limit(1).maybeSingle();
        if (phoneLookupError) throw phoneLookupError;
        if (phoneOwner?.id) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un autre compte.' });
      }
      if (requestEmail) {
        const existingWithEmail = await ensureUniqueUserEmail({ req, email: requestEmail });
        if (existingWithEmail) {
          return res.status(409).json({ error: buildDuplicateEmailMessage(requestEmail) });
        }
      }

      if (adminClient && requestEmail) {
        const tempPassword = req.body.tempPassword || req.body.password;
        if (!tempPassword || String(tempPassword).length < 6) {
          return res.status(400).json({ error: 'Un mot de passe initial d’au moins 6 caractères est obligatoire.' });
        }
        const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
          email: requestEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: req.body.name || requestEmail.split('@')[0],
            role: canonicalRequestedRole || 'Enseignant',
            schoolId: targetSchoolId,
          }
        });
        
        if (authUser?.user?.id) {
          resolvedUid = authUser.user.id;
        } else if (createError) {
          const errorMessage = createError.message || '';
          if (/already|exist|registered|duplicate/i.test(errorMessage)) {
            return res.status(409).json({ error: buildDuplicateEmailMessage(requestEmail) });
          }
          throw createError;
        }

        const payload: Record<string, any> = {
          uid: resolvedUid,
          name: req.body.name,
          email: requestEmail,
          phone: requestPhone,
          role: canonicalRequestedRole,
          status: req.body.status === 'Inactif' ? 'inactive' : 'active',
          school_id: targetSchoolId,
          ...(req.body.avatar !== undefined && { avatar: req.body.avatar })
        };

        const { data: sbUser, error: sbUserError } = await adminClient.from('users').insert([payload]).select('*').single();

        if (sbUserError || !sbUser) throw sbUserError || new Error('Impossible de synchroniser le compte utilisateur dans Supabase.');

        const { data: schoolRow } = targetSchoolId
          ? await adminClient.from('schools').select('name,identifier').eq('id', targetSchoolId).maybeSingle()
          : { data: null };
        const schoolAcronym = buildSchoolAcronym(schoolRow?.name || schoolRow?.identifier || 'EDUCO');
        const keepIfScoped = (value?: string | null) => {
          const cleanValue = String(value || '').trim();
          return cleanValue.toUpperCase().startsWith(`${schoolAcronym}-`) ? cleanValue : '';
        };

        if (accountKind === 'student') {
          const requestedStudentMatricule = keepIfScoped(req.body.studentId || req.body.matricule);
          let classId = req.body.classId || req.body.class_id || null;
          if (!classId && req.body.class) {
            const { data: classRow } = await adminClient
              .from('classes')
              .select('id')
              .eq('school_id', targetSchoolId)
              .ilike('name', String(req.body.class).trim())
              .limit(1)
              .maybeSingle();
            classId = classRow?.id || null;
          }
          const studentPayload = {
            user_id: sbUser.id,
            school_id: targetSchoolId,
            student_id: requestedStudentMatricule || buildStudentMatricule({ schoolAcronym, idOrSeed: sbUser.id }),
            class_id: classId,
            parent_name: req.body.parentName || req.body.guardian || req.body.parentTuteur || '',
            parent_phone: req.body.parentPhone || req.body.guardianPhone || req.body.phone || req.body.contact || '',
            address: req.body.address || '',
            date_of_birth: req.body.dob || req.body.dateOfBirth || '',
            enrollment_date: new Date().toISOString(),
            status: req.body.status === 'Inactif' ? 'inactive' : 'active'
          };
          const { data: existingStudent } = await adminClient
            .from('students')
            .select('*')
            .eq('school_id', targetSchoolId)
            .eq('student_id', studentPayload.student_id)
            .limit(1)
            .maybeSingle();
          if (existingStudent?.id) {
            await adminClient.from('students').update(studentPayload).eq('id', existingStudent.id);
          } else {
            await adminClient.from('students').insert([studentPayload]);
          }
          sbUser.matricule = studentPayload.student_id;
          sbUser.student_id = studentPayload.student_id;
          sbUser.class_id = studentPayload.class_id;
          sbUser.class = req.body.class || '';
        }

        if (accountKind !== 'student' && accountKind !== 'parent' && normalizedRequestedRole !== 'co-admin') {
          const requestedStaffMatricule = keepIfScoped(req.body.matricule || req.body.studentId);
          const matricule = requestedStaffMatricule || buildStaffMatricule({ schoolAcronym, role: canonicalRequestedRole, idOrSeed: sbUser.id });
          const { data: existingPersonnel } = await adminClient.from('personnel').select('id').eq('user_id', sbUser.id).eq('school_id', targetSchoolId).maybeSingle();
          const personnelPayload = {
            user_id: sbUser.id,
            school_id: targetSchoolId,
            matricule,
            role: canonicalRequestedRole,
            base_salary: Number(req.body.baseSalary || req.body.salary || 0)
          };
          const { data: savedPersonnel, error: personnelError } = existingPersonnel?.id
            ? await adminClient.from('personnel').update(personnelPayload).eq('id', existingPersonnel.id).eq('school_id', targetSchoolId).select('id').single()
            : await adminClient.from('personnel').insert([personnelPayload]).select('id').single();
          if (personnelError) throw personnelError;
          sbUser.matricule = matricule;
          sbUser.personnelId = savedPersonnel?.id;
        }


        sendWelcomeEmail({
          email: requestEmail,
          name: req.body.name,
          role: canonicalRequestedRole || 'Personnel',
          schoolName: schoolRow?.name || 'Administration Centrale EDUCO',
          schoolIdentifier: schoolRow?.identifier || 'EDUCO-CENTRAL',
          tempPassword,
          loginUrl: `${getPublicAppUrl(req)}/?login=1`,
        }).catch(err => console.warn('User welcome email warning:', err));

        return res.json({ ...mapSupabaseUser(sbUser), licenseSchoolId: targetSchoolId });
      }

      if (requestEmail) {
        const existingWithEmail = await ensureUniqueUserEmail({ req, email: requestEmail });
        if (existingWithEmail) {
          return res.status(409).json({ error: buildDuplicateEmailMessage(requestEmail) });
        }
      }
      const newUser = await db.insert(users).values({
        ...req.body,
        uid: resolvedUid,
        phone: requestPhone,
        role: canonicalRequestedRole,
        status: req.body.status || 'Actif',
        schoolId: targetSchoolId
      }).returning();
      return res.json({ ...newUser[0], licenseSchoolId: targetSchoolId });
    } catch (error: any) {
      if (isDuplicatePhoneError(error)) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un autre compte.' });
      res.status(500).json({ error: error.message });
    }
  });

  // PUT /api/users/:id - Update user details
  app.put('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const targetUserId = parseInt(rawId, 10);
      if (isNaN(targetUserId)) return res.status(400).json({ error: 'ID utilisateur invalide' });

      const { name, email, role, status, avatar, phone, schoolId } = req.body;
      const canonicalRole = canonicalizeRole(role);
      const actor = await getRequestUser(req);
      if (String(actor?.id || '') === String(targetUserId) && (name !== undefined || email !== undefined || avatar !== undefined || phone !== undefined)) {
        return res.status(403).json({ error: 'Utilisez le parcours Profil sécurisé avec OTP pour modifier votre propre compte.' });
      }
      if (canonicalRole === 'Admin') {
        return res.status(403).json({ error: 'Il ne peut exister qu’un seul compte Admin et ce rôle ne peut pas être attribué.' });
      }
      if (canonicalRole === 'Co-admin' && actor?.role !== 'Admin') {
        return res.status(403).json({ error: 'Seul le compte Admin peut attribuer le rôle Co-admin.' });
      }
      const isCentralAdmin = actor?.role === 'Admin' || actor?.role === 'Co-admin';
      const supabaseAdmin = getSupabaseAdmin(req);
      const normalizedEmail = normalizeEmail(email);
      const normalizedPhone = phone === undefined ? undefined : normalizePhoneIdentity(phone);
      if (normalizedPhone !== undefined && normalizedPhone.length < 7) {
        return res.status(400).json({ error: 'Numéro de téléphone principal invalide.' });
      }
      if (normalizedEmail) {
        const existingWithEmail = await ensureUniqueUserEmail({ req, email: normalizedEmail, excludeUserId: targetUserId });
        if (existingWithEmail) {
          return res.status(409).json({ error: buildDuplicateEmailMessage(normalizedEmail) });
        }
      }
      if (supabaseAdmin) {
        if (normalizedPhone) {
          const { data: phoneOwner, error: phoneLookupError } = await supabaseAdmin.from('users').select('id').eq('phone_normalized', normalizedPhone).neq('id', targetUserId).limit(1).maybeSingle();
          if (phoneLookupError) throw phoneLookupError;
          if (phoneOwner?.id) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un autre compte.' });
        }
        const { data: target } = await supabaseAdmin.from('users').select('school_id').eq('id', targetUserId).maybeSingle();
        if (!target || (!isCentralAdmin && Number(target.school_id) !== Number(actor?.schoolId))) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
        const payload = {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email: normalizedEmail || email }),
          ...(role !== undefined && { role: canonicalRole }),
          ...(status !== undefined && { status: status === 'Inactif' ? 'inactive' : 'active' }),
          ...(avatar !== undefined && { avatar }),
          ...(normalizedPhone !== undefined && { phone: normalizedPhone }),
          ...(isCentralAdmin && schoolId !== undefined && { school_id: Number(schoolId) })
        };
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users')
          .update(payload)
          .eq('id', targetUserId)
          .select('*')
          .single();
        if (updateError) throw updateError;
        return res.json({ success: true, user: mapSupabaseUser(updatedUser) });
      }

      if (!supabaseAdmin) {
        const [target] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
        if (!target || (!isCentralAdmin && Number(target.schoolId) !== Number(actor?.schoolId))) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
      }
      const [updatedUser] = await db.update(users)
        .set({
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email: normalizedEmail || email }),
          ...(role !== undefined && { role: canonicalRole }),
          ...(status !== undefined && { status }),
          ...(avatar !== undefined && { avatar }),
          ...(normalizedPhone !== undefined && { phone: normalizedPhone }),
          ...(isCentralAdmin && schoolId !== undefined && { schoolId: Number(schoolId) })
        })
        .where(eq(users.id, targetUserId))
        .returning();

      res.json({ success: true, user: updatedUser || req.body });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/users/:id/toggle-status - Activate or Deactivate account
  app.post('/api/users/:id/toggle-status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const targetUserId = parseInt(rawId, 10);
      if (isNaN(targetUserId)) return res.status(400).json({ error: 'ID utilisateur invalide' });
      const actor = await getRequestUser(req);
      const isCentralAdmin = actor?.role === 'Admin' || actor?.role === 'Co-admin';

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { data: existingUser, error: existingError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', targetUserId)
          .limit(1)
          .maybeSingle();
        if (existingError) throw existingError;
        if (!existingUser || (!isCentralAdmin && Number(existingUser.school_id) !== Number(actor?.schoolId))) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
        if ((existingUser.role === 'Admin' || existingUser.role === 'Co-admin') && actor?.role !== 'Admin') {
          return res.status(403).json({ error: 'Seul l’Admin peut gérer les comptes de l’administration centrale.' });
        }
        const currentStatus = existingUser?.status || 'active';
        const newStatus = currentStatus === 'active' || currentStatus === 'Actif' ? 'inactive' : 'active';
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from('users')
          .update({ status: newStatus })
          .eq('id', targetUserId)
          .select('*')
          .single();
        if (updateError) throw updateError;
        return res.json({ success: true, status: newStatus === 'active' ? 'Actif' : 'Inactif', user: mapSupabaseUser(updatedUser) });
      }

      const [existing] = await db.select().from(users).where(eq(users.id, targetUserId));
      if (!existing || (!isCentralAdmin && Number(existing.schoolId) !== Number(actor?.schoolId))) {
        return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
      }
      if ((existing.role === 'Admin' || existing.role === 'Co-admin') && actor?.role !== 'Admin') {
        return res.status(403).json({ error: 'Seul l’Admin peut gérer les comptes de l’administration centrale.' });
      }
      const currentStatus = existing?.status || 'Actif';
      const newStatus = currentStatus === 'Actif' ? 'Inactif' : 'Actif';

      const [updated] = await db.update(users)
        .set({ status: newStatus })
        .where(eq(users.id, targetUserId))
        .returning();

      res.json({ success: true, status: newStatus, user: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/users/:id/reset-password - Generate temporary password and send reset
  app.post('/api/users/:id/reset-password', requireAuth, async (req: AuthRequest, res) => {
    try {
      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const targetUserId = parseInt(rawId, 10);
      if (isNaN(targetUserId)) return res.status(400).json({ error: 'ID utilisateur invalide' });
      const actor = await getRequestUser(req);
      const isCentralAdmin = actor?.role === 'Admin' || actor?.role === 'Co-admin';

      const supabaseAdmin = getSupabaseAdmin(req);
      let targetUser: any = null;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', targetUserId).maybeSingle();
        if (error) throw error;
        targetUser = mapSupabaseUser(data);
      } else {
        const [dbTargetUser] = await db.select().from(users).where(eq(users.id, targetUserId));
        targetUser = dbTargetUser;
      }
      if (!targetUser || (!isCentralAdmin && Number(targetUser.schoolId) !== Number(actor?.schoolId))) {
        return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
      }
      if ((targetUser.role === 'Admin' || targetUser.role === 'Co-admin') && actor?.role !== 'Admin') {
        return res.status(403).json({ error: 'Seul l’Admin peut réinitialiser un compte de l’administration centrale.' });
      }
      const tempPass = `Educo!7${crypto.randomBytes(16).toString('base64url')}`;

      if (supabaseAdmin && targetUser?.uid) {
        try {
          await supabaseAdmin.auth.admin.updateUserById(targetUser.uid, {
            password: tempPass
          });
        } catch (e) {
          console.warn('Supabase reset-password error:', e);
        }
      }

      res.json({
        success: true,
        message: `Mot de passe réinitialisé avec succès pour ${targetUser?.name || 'l\'utilisateur'}.`,
        tempPassword: tempPass,
        email: targetUser?.email
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/users/:id - Delete a user account and log to DB & Supabase
  app.delete('/api/users/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      const actorRole = canonicalizeRole(dbUser?.role);
      if (!['Admin', 'Co-admin', 'Promoteur', 'Responsable des finances', 'Directeur Général', 'Directeur des Etudes'].includes(actorRole)) {
        return res.status(403).json({ error: 'Permission refusée. Seuls les administrateurs peuvent supprimer des comptes.' });
      }

      const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const targetUserId = parseInt(rawId, 10);
      if (isNaN(targetUserId)) {
        return res.status(400).json({ error: 'ID utilisateur invalide' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      let targetUser: any = null;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', targetUserId).maybeSingle();
        if (error) throw error;
        targetUser = mapSupabaseUser(data);

        const isCentralAdmin = actorRole === 'Admin' || actorRole === 'Co-admin';
        if (!targetUser || (!isCentralAdmin && Number(targetUser.schoolId) !== Number(dbUser?.schoolId))) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
        if (canonicalizeRole(targetUser.role) === 'Admin') {
          return res.status(403).json({ error: 'Le compte Admin unique ne peut pas être supprimé.' });
        }
        if (canonicalizeRole(targetUser.role) === 'Co-admin' && actorRole !== 'Admin') {
          return res.status(403).json({ error: 'Seul l’Admin peut supprimer un Co-admin.' });
        }
        if (!canDeleteAccount(actorRole, targetUser.role)) {
          return res.status(403).json({ error: 'Le Directeur des Etudes peut uniquement supprimer les comptes des enseignants et des élèves.' });
        }
        await sendAccountDeletionEmail(targetUser, dbUser);

        await Promise.all([
          supabaseAdmin.from('students').delete().eq('user_id', targetUserId),
          supabaseAdmin.from('personnel').delete().eq('user_id', targetUserId),
          supabaseAdmin.from('notifications').delete().eq('user_id', targetUserId),
        ]);
        await supabaseAdmin.from('users').delete().eq('id', targetUserId).throwOnError();
        if (targetUser?.uid) {
          await supabaseAdmin.auth.admin.deleteUser(targetUser.uid).catch((e: any) => {
            console.warn('Supabase Auth delete warning:', e?.message || e);
          });
        }
      } else {
        // Fetch target user details before deletion
        const [dbTargetUser] = await db.select().from(users).where(eq(users.id, targetUserId));
        targetUser = dbTargetUser;
        const isCentralAdmin = actorRole === 'Admin' || actorRole === 'Co-admin';
        if (!targetUser || (!isCentralAdmin && Number(targetUser.schoolId) !== Number(dbUser?.schoolId))) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
        if (canonicalizeRole(targetUser.role) === 'Admin') {
          return res.status(403).json({ error: 'Le compte Admin unique ne peut pas être supprimé.' });
        }
        if (canonicalizeRole(targetUser.role) === 'Co-admin' && actorRole !== 'Admin') {
          return res.status(403).json({ error: 'Seul l’Admin peut supprimer un Co-admin.' });
        }
        if (!canDeleteAccount(actorRole, targetUser.role)) {
          return res.status(403).json({ error: 'Le Directeur des Etudes peut uniquement supprimer les comptes des enseignants et des élèves.' });
        }
        await sendAccountDeletionEmail(targetUser, dbUser);

        // Delete referencing dependent records
        await db.delete(students).where(eq(students.userId, targetUserId));
        await db.delete(personnel).where(eq(personnel.userId, targetUserId));
        await db.delete(notifications).where(eq(notifications.userId, targetUserId));
        await db.delete(users).where(eq(users.id, targetUserId));
      }

      // Also delete from Supabase client directly
      if (!supabaseAdmin) {
        await deleteUserFromSupabaseDirectly(targetUserId);
      }

      // Log action into activityLogs table in DB and Supabase
      const logDetails = `Compte supprimé : ID ${targetUserId}, Nom : ${targetUser?.name || 'Inconnu'}, Email : ${targetUser?.email || 'N/A'}, Rôle : ${targetUser?.role || 'N/A'}`;
      try {
        if (!supabaseAdmin) {
          await db.insert(activityLogs).values({
            schoolId: dbUser?.schoolId || 1,
            schoolName: `Établissement #${dbUser?.schoolId || 1}`,
            userName: dbUser?.name || 'Admin',
            userRole: dbUser?.role || 'Admin',
            userEmail: dbUser?.email || '',
            action: 'Suppression de compte',
            details: logDetails,
          });
        }
        await saveActivityLogToSupabaseDirectly({
          action: 'Suppression de compte',
          details: logDetails,
          userName: dbUser?.name,
          userRole: dbUser?.role,
          userEmail: dbUser?.email,
          schoolId: dbUser?.schoolId || 1,
        });
      } catch (logErr) {
        console.warn("Failed to write activity log:", logErr);
      }

      res.json({ success: true, message: 'Compte supprimé avec succès.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/schools/:id - Delete a school establishment and all its associated data
  app.delete('/api/schools/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!['Admin', 'Co-admin', 'Promoteur'].includes(dbUser?.role || '')) {
        return res.status(403).json({ error: 'Permission refusée. Seuls les administrateurs peuvent supprimer un établissement.' });
      }

      const rawSchoolId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const targetSchoolId = parseInt(rawSchoolId, 10);
      const schoolName = req.body?.schoolName || `Établissement #${targetSchoolId}`;
      if (!targetSchoolId || isNaN(targetSchoolId)) {
        return res.status(400).json({ error: 'Identifiant établissement invalide.' });
      }
      if (dbUser?.role === 'Promoteur' && Number(dbUser.schoolId) !== targetSchoolId) {
        return res.status(403).json({ error: 'Vous ne pouvez administrer que votre propre établissement.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const tableOrder = [
          'survey_responses',
          'surveys',
          'subscription_requests',
          'subscriptions',
          'notifications',
          'timetable',
          'attendance',
          'grades',
          'subjects',
          'payments',
          'transactions',
          'fees',
          'students',
          'personnel',
          'classes',
          'users',
        ];
        for (const table of tableOrder) {
          await deleteSupabaseBySchool(supabaseAdmin, table, targetSchoolId);
        }
        await supabaseAdmin.from('schools').delete().eq('id', targetSchoolId).throwOnError();

        await saveActivityLogToSupabaseDirectly({
          action: 'Suppression d\'établissement',
          details: `Établissement supprimé : "${schoolName}" (ID: ${targetSchoolId})`,
          userName: dbUser?.name,
          userRole: dbUser?.role,
          userEmail: dbUser?.email,
          schoolId: targetSchoolId,
        });

        return res.json({ success: true, message: 'Établissement et toutes ses données supprimés définitivement de Supabase.' });
      }

      // Purge in Supabase
      await purgeSchoolSupabaseDirectly(targetSchoolId.toString(), {
        students: true,
        payments: true,
        personnel: true,
        grades: true
      });

      // Purge in local Drizzle DB
      try {
        await db.delete(payments).where(eq(payments.schoolId, targetSchoolId));
        await db.delete(transactions).where(eq(transactions.schoolId, targetSchoolId));
        await db.delete(fees).where(eq(fees.schoolId, targetSchoolId));
        await db.delete(classes).where(eq(classes.schoolId, targetSchoolId));
        await db.delete(subjects).where(eq(subjects.schoolId, targetSchoolId));
        await db.delete(personnel).where(eq(personnel.schoolId, targetSchoolId));
        await db.delete(students).where(eq(students.schoolId, targetSchoolId));
        await db.delete(users).where(eq(users.schoolId, targetSchoolId));
        await db.delete(schools).where(eq(schools.id, targetSchoolId));
      } catch (e) {}

      // Log action into activityLogs table in DB and Supabase
      const logDetails = `Établissement supprimé : "${schoolName}" (ID: ${targetSchoolId})`;
      try {
        await db.insert(activityLogs).values({
          schoolId: targetSchoolId,
          schoolName: schoolName,
          userName: dbUser?.name || 'Admin',
          userRole: dbUser?.role || 'Admin',
          userEmail: dbUser?.email || '',
          action: 'Suppression d\'établissement',
          details: logDetails,
        });
        await saveActivityLogToSupabaseDirectly({
          action: 'Suppression d\'établissement',
          details: logDetails,
          userName: dbUser?.name,
          userRole: dbUser?.role,
          userEmail: dbUser?.email,
          schoolName: schoolName,
          schoolId: targetSchoolId,
        });
      } catch (e) {}

      res.json({ success: true, message: `Établissement "${schoolName}" et toutes ses données ont été supprimés avec succès.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const CASHIER_REPORT_ACTION = 'Clôture caisse';
  const mapCashierReportLog = (row: any) => {
    let report: any = {};
    try {
      report = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || {});
    } catch {
      report = { notes: row.details || '' };
    }
    return {
      ...report,
      id: report.id || row.id,
      createdAt: row.created_at || row.createdAt,
      cashierName: report.cashierName || row.user_name || row.userName || 'Caisse',
    };
  };

  app.get('/api/cashier-reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('activity_logs')
          .select('*')
          .eq('school_id', dbUser.schoolId)
          .eq('action', CASHIER_REPORT_ACTION)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return res.json({ success: true, reports: (data || []).map(mapCashierReportLog) });
      }

      const logs = await db.select().from(activityLogs)
        .where(and(eq(activityLogs.schoolId, dbUser.schoolId), eq(activityLogs.action, CASHIER_REPORT_ACTION)))
        .orderBy(desc(activityLogs.createdAt))
        .limit(200);
      res.json({ success: true, reports: logs.map(mapCashierReportLog) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message, reports: [] });
    }
  });

  app.post('/api/cashier-reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const report = {
        ...req.body,
        id: req.body.id || `CLS-${Date.now()}`,
        date: req.body.date || new Date().toISOString().slice(0, 10),
        time: req.body.time || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        cashierName: req.body.cashierName || dbUser.name || 'Caisse',
      };
      const details = JSON.stringify(report);
      const now = new Date();

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('activity_logs')
          .insert([{
            action: CASHIER_REPORT_ACTION,
            details,
            user_name: dbUser.name,
            user_role: dbUser.role,
            user_email: dbUser.email,
            school_id: dbUser.schoolId,
            school_name: req.body.schoolName || '',
            page: 'Caisse',
            created_at: now.toISOString(),
          }])
          .select('*')
          .single();
        if (error) throw error;
        return res.json({ success: true, report: mapCashierReportLog(data) });
      }

      const [created] = await db.insert(activityLogs).values({
        action: CASHIER_REPORT_ACTION,
        details,
        userName: dbUser.name,
        userRole: dbUser.role,
        userEmail: dbUser.email,
        schoolId: dbUser.schoolId,
        schoolName: req.body.schoolName || '',
        page: 'Caisse',
        createdAt: now,
      }).returning();
      res.json({ success: true, report: mapCashierReportLog(created) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/cashier-reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin
          .from('activity_logs')
          .delete()
          .eq('school_id', dbUser.schoolId)
          .eq('action', CASHIER_REPORT_ACTION);
        if (error) throw error;
      } else {
        await db.delete(activityLogs)
          .where(and(eq(activityLogs.schoolId, dbUser.schoolId), eq(activityLogs.action, CASHIER_REPORT_ACTION)));
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET & POST /api/activity-logs
  app.get('/api/activity-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const logs = await db.select().from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(200);
      if (logs && logs.length > 0) {
        return res.json(logs.map(l => ({
          id: l.id,
          timestamp: l.createdAt?.toISOString() || new Date().toISOString(),
          user: l.userName || 'Inconnu',
          role: l.userRole || 'Admin',
          email: l.userEmail || '',
          schoolName: l.schoolName || '',
          action: l.action,
          details: l.details || '',
          ipAddress: l.ipAddress || '',
          location: l.location || '',
          device: l.device || '',
          browser: l.browser || '',
          page: l.page || ''
        })));
      }
      const supLogs = await fetchActivityLogsFromSupabaseDirectly();
      res.json(supLogs);
    } catch (error: any) {
      const supLogs = await fetchActivityLogsFromSupabaseDirectly();
      res.json(supLogs);
    }
  });

  app.post('/api/activity-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      let { action, details, userName, userRole, userEmail, schoolName, schoolId, ipAddress, location, device, browser, page } = req.body;

      if (!ipAddress) {
        ipAddress = (typeof req.headers['x-forwarded-for'] === 'string' ? req.headers['x-forwarded-for'].split(',')[0] : req.socket.remoteAddress || '').trim();
      }

      const logPayload = {
        action: action || 'Action Administrateur',
        details: details || '',
        userName: userName || dbUser?.name,
        userRole: userRole || dbUser?.role,
        userEmail: userEmail || dbUser?.email,
        schoolName: schoolName || '',
        schoolId: schoolId || dbUser?.schoolId,
        ipAddress: ipAddress || '',
        location: location || '',
        device: device || '',
        browser: browser || '',
        page: page || '',
      };

      await saveActivityLogToSupabaseDirectly(logPayload);

      res.json({ success: true, log: logPayload });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Transactions Endpoints
  app.get('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('school_id', dbUser.schoolId)
        .order('date', { ascending: false });
      if (error) throw error;
      res.json((data || []).map(mapSupabaseTransaction));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const payload = {
        school_id: dbUser.schoolId,
        type: req.body.type,
        category: req.body.category,
        amount: Number(req.body.amount || 0),
        description: req.body.status ? `(Status: ${req.body.status}) ${req.body.description || ''}` : req.body.description,
        date: req.body.date || new Date().toISOString(),
        recorded_by: dbUser.id
      };
      const { data, error } = await supabaseAdmin.from('transactions').insert([payload]).select('*').single();
      if (error) throw error;
      res.json(mapSupabaseTransaction(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/transactions/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });
      const role = canonicalizeRole(dbUser.role);
      if (!['Responsable des finances', 'Directeur Général', 'Admin'].includes(role)) {
        return res.status(403).json({ error: 'Seuls le RAF ou le Directeur Général peuvent valider une opération.' });
      }
      if (!['Approuvé', 'Rejeté'].includes(req.body.status)) {
        return res.status(400).json({ error: 'Statut de validation invalide.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const transactionId = Number(req.params.id);
      if (!Number.isFinite(transactionId)) {
        return res.status(400).json({ error: 'Transaction Supabase invalide ou non synchronisée.' });
      }
      let updateResult = await supabaseAdmin
        .from('transactions')
        .update({
          status: req.body.status,
          ...(req.body.description !== undefined && { description: req.body.description })
        })
        .eq('id', transactionId)
        .eq('school_id', dbUser.schoolId)
        .eq('status', 'En attente')
        .select('*')
        .single();
      if (updateResult.error) {
        updateResult = await supabaseAdmin
          .from('transactions')
          .update({ description: `(Status: ${req.body.status}) ${req.body.description || ''}` })
          .eq('id', transactionId)
          .eq('school_id', dbUser.schoolId)
          .eq('status', 'En attente')
          .select('*')
          .single();
      }
      const { data, error } = updateResult;
      if (error) throw error;
      await writeFinancialAudit(req, { action: `transaction_${String(req.body.status).toLowerCase()}`, entityType: 'transaction', entityId: transactionId, newValues: { status: req.body.status } });
      res.json(mapSupabaseTransaction(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/transactions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const transactionId = Number(req.params.id);
      if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
        return res.status(400).json({ error: 'Transaction Supabase invalide ou non synchronisée.' });
      }

      const { data: existing, error: existingError } = await supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('school_id', dbUser.schoolId)
        .single();
      if (existingError) throw existingError;

      const amount = req.body.amount !== undefined ? Number(req.body.amount) : undefined;
      if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
        return res.status(400).json({ error: 'Montant invalide.' });
      }

      const status = req.body.status || mapSupabaseTransaction(existing).status;
      const description = req.body.description !== undefined ? String(req.body.description || '') : mapSupabaseTransaction(existing).description;
      const updatePayload: Record<string, any> = {
        ...(req.body.type !== undefined && { type: req.body.type }),
        ...(req.body.category !== undefined && { category: req.body.category }),
        ...(amount !== undefined && { amount }),
        ...(req.body.date !== undefined && { date: req.body.date }),
        description: status ? `(Status: ${status}) ${description}` : description,
      };

      const { data, error } = await supabaseAdmin
        .from('transactions')
        .update(updatePayload)
        .eq('id', transactionId)
        .eq('school_id', dbUser.schoolId)
        .select('*')
        .single();
      if (error) throw error;
      res.json(mapSupabaseTransaction(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Payments Endpoints
  app.get('/api/payments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const [
        { data: paymentRows, error: paymentError },
        { data: studentRows, error: studentError },
        { data: userRows, error: userError },
        { data: classRows },
        { data: feeRows },
      ] = await Promise.all([
        supabaseAdmin.from('payments').select('*').eq('school_id', dbUser.schoolId).order('payment_date', { ascending: false }),
        supabaseAdmin.from('students').select('*').eq('school_id', dbUser.schoolId),
        supabaseAdmin.from('users').select('*').eq('school_id', dbUser.schoolId),
        supabaseAdmin.from('classes').select('*').eq('school_id', dbUser.schoolId),
        supabaseAdmin.from('fees').select('*').eq('school_id', dbUser.schoolId),
      ]);
      if (paymentError) throw paymentError;
      if (studentError) throw studentError;
      if (userError) throw userError;

      res.json(buildStudentPaymentLedger({
        payments: paymentRows || [],
        students: studentRows || [],
        users: userRows || [],
        classes: classRows || [],
        fees: feeRows || [],
        schoolId: dbUser.schoolId,
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const requestedStudentId = Number(req.body.studentRecordId || req.body.studentId || req.body.student_id || 0);
      let resolvedStudentId = Number.isFinite(requestedStudentId) ? requestedStudentId : 0;
      if (resolvedStudentId) {
        const { data: studentById } = await supabaseAdmin
          .from('students')
          .select('id')
          .eq('school_id', dbUser.schoolId)
          .eq('id', resolvedStudentId)
          .maybeSingle();
        if (!studentById?.id) {
          const { data: studentByUser } = await supabaseAdmin
            .from('students')
            .select('id')
            .eq('school_id', dbUser.schoolId)
            .eq('user_id', resolvedStudentId)
            .maybeSingle();
          resolvedStudentId = Number(studentByUser?.id || resolvedStudentId);
        }
      }
      const payload = {
        school_id: dbUser.schoolId,
        student_id: resolvedStudentId || null,
        fee_id: req.body.feeId || req.body.fee_id || null,
        amount: Number(req.body.amount || 0),
        payment_date: req.body.paymentDate || req.body.payment_date || new Date().toISOString(),
        receipt_number: req.body.receiptNumber || req.body.receipt_number || `REC-${Date.now()}`,
        payment_method: req.body.paymentMethod || req.body.payment_method || 'Espèce',
        status: req.body.status || 'paid'
      };
      const { data, error } = await supabaseAdmin.from('payments').insert([payload]).select('*').single();
      if (error) throw error;
      res.json(mapSupabasePayment(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // School Settings Endpoints
  registerOperations(app, requireAuth, getRequestUser, getSupabaseAdmin);
  registerCollections(app, requireAuth, getRequestUser, getSupabaseAdmin, mapSupabaseTransaction);
  app.get('/api/school', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await supabaseAdmin.from('schools').select('*').eq('id', dbUser.schoolId).limit(1).maybeSingle();
      if (error) throw error;
      res.json(await ensureSchoolIdentifier(mapSupabaseSchool(data), supabaseAdmin));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/school', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const payload: any = {
        ...(req.body.name !== undefined && { name: req.body.name }),
        ...(req.body.address !== undefined && { address: req.body.address }),
        ...(req.body.phone !== undefined && { phone: req.body.phone }),
        ...(req.body.email !== undefined && { email: req.body.email }),
        ...(req.body.logo !== undefined && { logo: req.body.logo }),
        ...(req.body.settings !== undefined && { settings: req.body.settings })
      };
      const { data, error } = await supabaseAdmin.from('schools').update(payload).eq('id', dbUser.schoolId).select('*').single();
      if (error) throw error;
      res.json(await ensureSchoolIdentifier(mapSupabaseSchool(data), supabaseAdmin));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get('/api/budget', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data: schoolTxns, error } = await supabaseAdmin.from('transactions').select('*').eq('school_id', dbUser.schoolId);
      if (error) throw error;
      const income = (schoolTxns || []).filter(t => ['income', 'Revenu'].includes(t.type)).reduce((acc, t) => acc + Number(t.amount || 0), 0);
      const expense = (schoolTxns || []).filter(t => ['expense', 'Dépense'].includes(t.type)).reduce((acc, t) => acc + Number(t.amount || 0), 0);

      res.json({ total: income - expense, income, expense });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Classes Endpoints
  app.get('/api/classes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const [{ data, error }, { data: feeRows, error: feeError }] = await Promise.all([
        supabaseAdmin.from('classes').select('*').eq('school_id', dbUser.schoolId),
        supabaseAdmin.from('fees').select('*').eq('school_id', dbUser.schoolId),
      ]);
      if (error) throw error;
      if (feeError) throw feeError;
      res.json((data || []).map((row: any) => {
        const mapped = mapSupabaseClass(row);
        const classFee = (feeRows || []).find((fee: any) =>
          String(fee.type || '').toLowerCase() === 'tuition'
          && String(fee.name || '').toLowerCase().includes(String(row.name || '').toLowerCase())
        );
        return { ...mapped, tuitionFee: Number(classFee?.amount || 0) };
      }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/classes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const payload = {
        school_id: dbUser.schoolId,
        name: req.body.name,
        level: req.body.level || req.body.section || null,
        capacity: req.body.capacity ? Number(req.body.capacity) : null,
        teacher_id: req.body.teacherId || req.body.teacher_id || null,
        is_exam_class: Boolean(req.body.isExamClass ?? req.body.is_exam_class),
        status: req.body.status === 'inactive' ? 'inactive' : 'active'
      };

      const query = (Number.isSafeInteger(Number(req.body.id)) && Number(req.body.id) > 0)
        ? supabaseAdmin.from('classes').update(payload).eq('id', Number(req.body.id)).eq('school_id', dbUser.schoolId)
        : supabaseAdmin.from('classes').insert([payload]);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      const tuitionFee = Number(req.body.tuitionFee || req.body.tuition_fee || 0);
      if (tuitionFee > 0) {
        const feeName = `Frais d'écolage - ${data.name}`;
        const { data: existingFee } = await supabaseAdmin
          .from('fees')
          .select('id')
          .eq('school_id', dbUser.schoolId)
          .eq('name', feeName)
          .maybeSingle();
        const feePayload = {
          school_id: dbUser.schoolId,
          name: feeName,
          amount: tuitionFee,
          type: 'tuition',
          due_date: null,
        };
        if (existingFee?.id) {
          await supabaseAdmin.from('fees').update(feePayload).eq('id', existingFee.id).eq('school_id', dbUser.schoolId).throwOnError();
        } else {
          await supabaseAdmin.from('fees').insert([feePayload]).throwOnError();
        }
      }
      res.json({ ...mapSupabaseClass(data), tuitionFee });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fees Endpoints
  app.get('/api/fees', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await supabaseAdmin.from('fees').select('*').eq('school_id', dbUser.schoolId);
      if (error) throw error;
      res.json((data || []).map(mapSupabaseFee));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/fees', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const payload = {
        school_id: dbUser.schoolId,
        name: req.body.name || req.body.title || req.body.class || 'Frais scolaire',
        amount: Number(req.body.amount || 0),
        due_date: req.body.dueDate || req.body.due_date || null,
        type: req.body.type || req.body.category || null
      };

      const isUpdate = Number.isSafeInteger(Number(req.body.id)) && Number(req.body.id) > 0;
      const previous = isUpdate ? await supabaseAdmin.from('fees').select('*').eq('id', Number(req.body.id)).eq('school_id', dbUser.schoolId).maybeSingle() : { data: null };
      const query = isUpdate
        ? supabaseAdmin.from('fees').update(payload).eq('id', Number(req.body.id)).eq('school_id', dbUser.schoolId)
        : supabaseAdmin.from('fees').insert([payload]);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      await writeFinancialAudit(req, { action: isUpdate ? 'fee_updated' : 'fee_created', entityType: 'fee', entityId: data.id, oldValues: previous.data, newValues: data, reason: req.body.reason });
      res.json(mapSupabaseFee(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Personnel Endpoints
  app.get('/api/personnel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await supabaseAdmin.from('personnel').select('*').eq('school_id', dbUser.schoolId);
      if (error) throw error;
      const userIds = [...new Set((data || []).map((p: any) => p.user_id).filter(Boolean))];
      let userById = new Map<number, any>();
      if (userIds.length > 0) {
        const { data: linkedUsers } = await supabaseAdmin.from('users').select('*').in('id', userIds);
        userById = new Map((linkedUsers || []).map((u: any) => [Number(u.id), u]));
      }
      res.json((data || []).map((p: any) => mapSupabasePersonnel({ ...userById.get(Number(p.user_id)), ...p })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/personnel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });

      let userId = req.body.userId || req.body.user_id || null;
      const personName = req.body.name || req.body.fullName || 'Membre du personnel';
      const personRole = canonicalizeRole(req.body.role || 'Personnel') || 'Personnel';
      const { data: schoolRow } = await supabaseAdmin
        .from('schools')
        .select('name,identifier')
        .eq('id', dbUser.schoolId)
        .maybeSingle();
      const schoolAcronym = buildSchoolAcronym(schoolRow?.name || schoolRow?.identifier || 'EDUCO');
      const requestedMatricule = String(req.body.matricule || req.body.studentId || '').trim();
      const scopedMatricule = requestedMatricule.toUpperCase().startsWith(`${schoolAcronym}-`)
        ? requestedMatricule
        : buildStaffMatricule({ schoolAcronym, role: personRole, idOrSeed: userId || Date.now() });
      const personEmail = req.body.email || `${scopedMatricule.toLowerCase().replace(/[^a-z0-9._-]/g, '-') }@personnel.educo.local`;

      if (!userId) {
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('school_id', dbUser.schoolId)
          .ilike('email', personEmail)
          .limit(1)
          .maybeSingle();
        if (existingUser?.id) {
          userId = existingUser.id;
        } else {
          const { data: createdUser, error: userError } = await supabaseAdmin
            .from('users')
            .insert([{
              uid: `personnel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              school_id: dbUser.schoolId,
              name: personName,
              email: personEmail,
              role: personRole,
              status: req.body.status || 'active'
            }])
            .select('*')
            .single();
          if (userError) throw userError;
          userId = createdUser.id;
        }
      } else {
        await supabaseAdmin
          .from('users')
          .update({
            name: personName,
            email: personEmail,
            role: personRole,
            status: req.body.status || 'active'
          })
          .eq('id', Number(userId))
          .eq('school_id', dbUser.schoolId);
      }

      const payload = {
        user_id: Number(userId),
        school_id: dbUser.schoolId,
        matricule: scopedMatricule,
        role: personRole,
        base_salary: Number(req.body.baseSalary || req.body.salary || 0),
        hire_date: req.body.hireDate || req.body.hire_date || null,
        bank_account: req.body.bankAccount || req.body.bank_account || null
      };
      const query = (Number.isSafeInteger(Number(req.body.id)) && Number(req.body.id) > 0)
        ? supabaseAdmin.from('personnel').update(payload).eq('id', Number(req.body.id)).eq('school_id', dbUser.schoolId)
        : supabaseAdmin.from('personnel').insert([payload]);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      res.json(mapSupabasePersonnel({ ...data, name: personName, email: personEmail, status: req.body.status || 'Actif' }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/personnel/delete', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const personnelId = Number(req.body.id);
      if (!Number.isFinite(personnelId) || personnelId <= 0) {
        return res.status(400).json({ error: 'Identifiant personnel invalide.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { data: existing, error: findError } = await supabaseAdmin
          .from('personnel')
          .select('id,user_id')
          .eq('id', personnelId)
          .eq('school_id', dbUser.schoolId)
          .maybeSingle();
        if (findError) throw findError;
        if (!existing?.id) return res.status(404).json({ error: 'Membre du personnel introuvable.' });

        const { error: deletePersonnelError } = await supabaseAdmin
          .from('personnel')
          .delete()
          .eq('id', personnelId)
          .eq('school_id', dbUser.schoolId);
        if (deletePersonnelError) throw deletePersonnelError;

        if (existing.user_id) {
          await supabaseAdmin
            .from('users')
            .delete()
            .eq('id', Number(existing.user_id))
            .eq('school_id', dbUser.schoolId);
        }

        return res.json({ success: true });
      }

      const [existing] = await db.select().from(personnel).where(and(eq(personnel.id, personnelId), eq(personnel.schoolId, dbUser.schoolId)));
      if (!existing) return res.status(404).json({ error: 'Membre du personnel introuvable.' });
      await db.delete(personnel).where(and(eq(personnel.id, personnelId), eq(personnel.schoolId, dbUser.schoolId)));
      if (existing.userId) {
        await db.delete(users).where(and(eq(users.id, existing.userId), eq(users.schoolId, dbUser.schoolId)));
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Grades Endpoints
  app.get('/api/grades', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });
      const role = canonicalizeRole(dbUser.role);
      if (!canViewGrades(role)) return res.status(403).json({ error: 'Accès aux notes non autorisé pour ce compte.' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const [{ data: gradeRows, error }, { data: subjectRows }] = await Promise.all([
        supabaseAdmin.from('grades').select('*'),
        supabaseAdmin.from('subjects').select('*').eq('school_id', dbUser.schoolId)
      ]);
      if (error) throw error;
      const subjectsById = new Map((subjectRows || []).map((s: any) => [Number(s.id), s.name]));
      const studentResult = await supabaseAdmin.from('students').select('id,user_id').eq('school_id', dbUser.schoolId);
      if (studentResult.error) throw studentResult.error;
      const studentUserIds = new Map((studentResult.data || []).map((s: any) => [Number(s.id), s.user_id]));
      const classIds = new Set<number>();
      const { data: schoolClasses } = await supabaseAdmin.from('classes').select('id,teacher_id').eq('school_id', dbUser.schoolId);
      (schoolClasses || []).forEach((c: any) => classIds.add(Number(c.id)));
      if (role === 'Enseignant') {
        for (const schoolClass of schoolClasses || []) {
          if (Number(schoolClass.teacher_id) !== Number(dbUser.id)) classIds.delete(Number(schoolClass.id));
        }
      }
      res.json((gradeRows || [])
        .filter((g: any) => classIds.has(Number(g.class_id || g.classId)))
        .map((g: any) => ({ ...mapSupabaseGrade(g, subjectsById.get(Number(g.subject_id || g.subjectId))), studentId: studentUserIds.get(Number(g.student_id)) || g.student_id })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/grades', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });

      const subjectName = req.body.subject || 'Matière';
      const { data: existingSubject } = await supabaseAdmin
        .from('subjects')
        .select('*')
        .eq('school_id', dbUser.schoolId)
        .ilike('name', subjectName)
        .limit(1)
        .maybeSingle();

      let subjectId = existingSubject?.id;
      if (!subjectId) {
        const { data: createdSubject, error: subjectError } = await supabaseAdmin
          .from('subjects')
          .insert([{ school_id: dbUser.schoolId, name: subjectName, coefficient: 1 }])
          .select('*')
          .single();
        if (subjectError) throw subjectError;
        subjectId = createdSubject.id;
      }

      const requestedStudentId = Number(req.body.studentId || req.body.student_id);
      const classId = Number(req.body.classId || req.body.class_id);
      const score = Number(req.body.score);
      if (!Number.isFinite(score) || score < 0 || score > 20) return res.status(400).json({ error: 'La note doit être comprise entre 0 et 20.' });
      const classResult = await supabaseAdmin.from('classes').select('*').eq('school_id', dbUser.schoolId).eq('id', classId).maybeSingle();
      if (classResult.error) throw classResult.error;
      if (!classResult.data || (dbUser.role === 'Enseignant' && Number(classResult.data.teacher_id) !== Number(dbUser.id))) return res.status(403).json({ error: 'Classe non autorisée.' });
      const studentResult = await supabaseAdmin.from('students').select('*').eq('school_id', dbUser.schoolId).eq('user_id', requestedStudentId).maybeSingle();
      if (studentResult.error) throw studentResult.error;
      if (!studentResult.data || Number(studentResult.data.class_id) !== classId) return res.status(400).json({ error: 'Élève non inscrit dans cette classe.' });
      const resolvedStudentId = studentResult.data.id;

      const payload = {
        student_id: resolvedStudentId,
        subject_id: Number(subjectId),
        class_id: Number(req.body.classId || req.body.class_id || 0) || null,
        score: Number(req.body.score || 0),
        max_score: Number(req.body.maxScore || req.body.max_score || 20),
        term: req.body.assignment || req.body.term || 'Devoir',
        teacher_id: dbUser.id,
        date: req.body.date || new Date().toISOString()
      };
      const gradeId = Number(req.body.id);
      const query = Number.isSafeInteger(gradeId) && gradeId > 0
        ? supabaseAdmin.from('grades').update(payload).eq('id', gradeId).eq('class_id', classId)
        : supabaseAdmin.from('grades').insert([payload]);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      res.json({ ...mapSupabaseGrade(data, subjectName), studentId: requestedStudentId });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Intra/inter-school messaging using the existing notifications table as durable delivery
  app.post('/api/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });

      const text = String(req.body.text || req.body.message || '').trim();
      if (!text) return res.status(400).json({ error: 'Le message est obligatoire.' });
      const targetSchoolId = /parent|élève|eleve/i.test(dbUser.role) ? dbUser.schoolId : (req.body.targetSchoolId || req.body.schoolId || dbUser.schoolId);
      const targetRoles = Array.isArray(req.body.roles) && req.body.roles.length > 0 ? req.body.roles : null;
      const recipientIds = Array.isArray(req.body.recipientIds)
        ? req.body.recipientIds.map((id: any) => Number(id)).filter((id: number) => Number.isSafeInteger(id) && id > 0)
        : [];

      // A direct conversation is always constrained to the sender's school.
      // This prevents a crafted client request from addressing another school.
      if (recipientIds.length > 0 && Number(targetSchoolId) !== Number(dbUser.schoolId)) {
        return res.status(403).json({ error: 'Un message direct doit rester dans votre établissement.' });
      }

      let usersQuery = supabaseAdmin.from('users').select('*').eq('school_id', Number(targetSchoolId));
      if (recipientIds.length > 0) {
        usersQuery = usersQuery.in('id', recipientIds);
      } else if (targetRoles) {
        usersQuery = usersQuery.in('role', targetRoles);
      }
      const { data: recipients, error: recipientsError } = await usersQuery;
      if (recipientsError) throw recipientsError;

      const rows = (recipients || []).map((u: any) => ({
        user_id: u.id,
        title: req.body.title || `Message de ${dbUser.name || 'EDUCO'}`,
        message: text,
        type: Number(targetSchoolId) === Number(dbUser.schoolId) ? 'Messagerie interne' : 'Messagerie inter-école',
        is_read: false,
        link: 'Messagerie',
      }));

      if (rows.length === 0) {
        return res.json({ success: true, sent: 0, message: 'Aucun destinataire trouvé.' });
      }
      const { data, error } = await supabaseAdmin.from('notifications').insert(rows).select('*');
      if (error) throw error;
      res.json({ success: true, sent: data?.length || 0, messages: data || [] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });
      const userId = await getRequestUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Utilisateur introuvable.' });

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      res.json({ success: true, notifications: (data || []).map(mapSupabaseNotification).filter(Boolean) });
    } catch (error: any) {
      console.error('Notifications fetch error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Create individual notifications for the requested establishment roles.
  // Platform administrators and establishment teams deliberately use separate
  // audiences, so a school operation cannot leak into the platform inbox.
  app.post('/api/notifications/dispatch', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      const userRole = req.user?.role || dbUser?.role || '';
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });

      const message = String(req.body.message || '').trim();
      const title = String(req.body.title || req.body.type || 'Notification').trim();
      const type = String(req.body.type || 'Information').trim();
      const link = String(req.body.link || '').trim() || null;
      const requestedRoles: string[] = Array.isArray(req.body.roles)
        ? Array.from(new Set<string>((req.body.roles as unknown[])
          .map((role) => String(role || '').trim())
          .filter(Boolean)))
        : [];
      if (!message || requestedRoles.length === 0) {
        return res.status(400).json({ success: false, error: 'Le message et les destinataires sont obligatoires.' });
      }

      const platformRoles = new Set(['Admin', 'Co-admin']);
      const schoolRoles = requestedRoles.filter(role => !platformRoles.has(role));
      const recipientRoles = schoolRoles.length > 0 ? schoolRoles : requestedRoles;
      const isPlatformAudience = schoolRoles.length === 0 && recipientRoles.some(role => platformRoles.has(role));

      if (isPlatformAudience && !platformRoles.has(userRole)) {
        return res.status(403).json({ success: false, error: 'Seul un administrateur de la plateforme peut contacter cette audience.' });
      }
      if (!isPlatformAudience && !dbUser?.schoolId) {
        return res.status(403).json({ success: false, error: 'Aucun établissement associé au compte émetteur.' });
      }

      let recipientsQuery = supabaseAdmin.from('users').select('id').in('role', recipientRoles);
      if (!isPlatformAudience) {
        recipientsQuery = recipientsQuery.eq('school_id', Number(dbUser.schoolId));
      }
      const { data: recipients, error: recipientsError } = await recipientsQuery;
      if (recipientsError) throw recipientsError;

      const rows = (recipients || []).map((recipient: any) => ({
        user_id: recipient.id,
        title,
        message,
        type,
        is_read: false,
        link,
      }));
      if (rows.length === 0) return res.json({ success: true, sent: 0 });

      const { data, error } = await supabaseAdmin.from('notifications').insert(rows).select('*');
      if (error) throw error;
      res.json({ success: true, sent: data?.length || 0 });
    } catch (error: any) {
      console.error('Notification dispatch error:', error);
      res.status(500).json({ success: false, error: error.message || 'Erreur lors de l’envoi de la notification.' });
    }
  });

  app.post('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });
      const userId = await getRequestUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Utilisateur introuvable.' });

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', Number(req.params.id))
        .eq('user_id', userId)
        .select('*')
        .maybeSingle();
      if (error) throw error;

      res.json({ success: true, notification: mapSupabaseNotification(data) });
    } catch (error: any) {
      console.error('Notification mark-read error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });
      const userId = await getRequestUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Utilisateur introuvable.' });

      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error('Notification mark-all-read error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/notifications/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });
      const userId = await getRequestUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Utilisateur introuvable.' });

      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', Number(req.params.id))
        .eq('user_id', userId);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error('Notification delete error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });
      const userId = await getRequestUserId(req);
      if (!userId) return res.status(401).json({ success: false, error: 'Utilisateur introuvable.' });

      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error('Notifications clear error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/admin/broadcast-notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      const userRole = req.user?.role || dbUser?.role;
      if (userRole !== 'Admin' && userRole !== 'Co-admin') {
        return res.status(403).json({ success: false, error: 'Accès réservé aux administrateurs.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });

      const title = String(req.body.title || req.body.subject || 'Message EDUCO').trim();
      const message = String(req.body.message || req.body.body || '').trim();
      if (!message) return res.status(400).json({ success: false, error: 'Le contenu du message est obligatoire.' });

      const targetAudience = req.body.targetAudience || 'all_schools';
      const selectedSchoolId = req.body.schoolId || req.body.selectedSchoolId;
      const roleMap: Record<string, string[]> = {
        promoters: ['Promoteur'],
        directors: ['Directeur Général', 'Directeur', 'Directeur des Etudes', 'DE'],
        raf: ['Responsable des finances', 'RAF'],
      };

      let usersQuery = supabaseAdmin.from('users').select('*');
      if (targetAudience === 'specific_school' && selectedSchoolId) {
        usersQuery = usersQuery.eq('school_id', Number(selectedSchoolId));
      }
      if (roleMap[targetAudience]) {
        usersQuery = usersQuery.in('role', roleMap[targetAudience]);
      }

      const { data: recipients, error: recipientsError } = await usersQuery;
      if (recipientsError) throw recipientsError;

      // A platform broadcast is for establishment accounts only. Super-admin
      // accounts are a separate audience and must never inherit these notices.
      const establishmentRecipients = (recipients || []).filter((user: any) =>
        targetAudience !== 'all_schools' || !['Admin', 'Co-admin'].includes(String(user.role || ''))
      );

      const rows = establishmentRecipients.map((u: any) => ({
        user_id: u.id,
        title,
        message,
        type: 'Message Admin',
        is_read: false,
        link: String(req.body.link || 'Tableau de bord'),
      }));

      if (rows.length === 0) {
        return res.json({ success: true, sent: 0, message: 'Aucun destinataire trouvé.' });
      }

      const { data, error } = await supabaseAdmin.from('notifications').insert(rows).select('*');
      if (error) throw error;

      res.json({
        success: true,
        sent: data?.length || 0,
        notifications: (data || []).map(mapSupabaseNotification).filter(Boolean),
        message: `Message Admin envoyé à ${data?.length || 0} destinataire(s).`
      });
    } catch (error: any) {
      console.error('Admin broadcast notifications error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/students/financial-check', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });

      const name = String(req.body.name || req.body.studentName || '').trim().toLowerCase();
      const matricule = String(req.body.matricule || req.body.studentMatricule || '').trim().toLowerCase();
      const parentName = String(req.body.parentName || req.body.parentTuteur || '').trim().toLowerCase();

      const [{ data: studentRows }, { data: schoolRows }, { data: paymentRows }] = await Promise.all([
        supabaseAdmin.from('students').select('*'),
        supabaseAdmin.from('schools').select('*'),
        supabaseAdmin.from('payments').select('*')
      ]);

      const schoolById = new Map((schoolRows || []).map((s: any) => [Number(s.id), s]));
      const paymentsByStudent = new Map<number, number>();
      (paymentRows || []).forEach((p: any) => {
        const sid = Number(p.student_id || p.studentId);
        paymentsByStudent.set(sid, (paymentsByStudent.get(sid) || 0) + Number(p.amount || 0));
      });

      const matches = (studentRows || [])
        .filter((st: any) => Number(st.school_id || st.schoolId) !== Number(dbUser.schoolId))
        .filter((st: any) => {
          const stName = String(st.name || '').toLowerCase();
          const stMatricule = String(st.matricule || st.student_id || st.studentId || '').toLowerCase();
          const stParent = String(st.parent_name || st.parentName || '').toLowerCase();
          return (
            (!!matricule && stMatricule === matricule) ||
            (!!name && stName === name) ||
            (!!name && !!parentName && stName.includes(name) && stParent.includes(parentName))
          );
        })
        .map((st: any) => {
          const totalDue = Number(st.tuition_fee || st.total_fees || st.totalFees || 0);
          const paid = Number(st.paid_amount || st.paidAmount || paymentsByStudent.get(Number(st.id)) || 0);
          const outstanding = Math.max(totalDue - paid, 0);
          const school = schoolById.get(Number(st.school_id || st.schoolId));
          return {
            studentId: st.id,
            studentName: st.name,
            matricule: st.matricule || st.student_id || st.studentId,
            parentName: st.parent_name || st.parentName || '',
            previousSchoolId: st.school_id || st.schoolId,
            previousSchoolName: school?.name || 'Établissement inconnu',
            totalDue,
            paid,
            outstanding
          };
        })
        .filter((m: any) => m.outstanding > 0);

      res.json({
        success: true,
        hasDebt: matches.length > 0,
        matches,
        message: matches.length > 0
          ? 'Dette détectée dans un autre établissement du réseau.'
          : 'Aucune dette inter-école détectée.'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // SUBSCRIPTION & LICENSING ENDPOINTS
  // ==========================================

  // Get Current School Subscription Status
  app.get('/api/subscriptions/current', requireAuth, async (req: AuthRequest, res) => {
    try {
      // requireAuth has already resolved the profile using the active Supabase
      // connection supplied by the client. Re-querying it here could use a
      // different server configuration and lose schoolId, which made the UI
      // show "Non renseigné" for a valid school account.
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) {
        return res.json({
          isActive: false,
          isPreSubscription: true,
          planType: null,
          daysRemaining: 0,
          schoolIdentifier: null,
          schoolName: null,
          message: 'Aucun établissement associé.'
        });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      let school: any = null;
      if (supabaseAdmin) {
        const { data: sbSchool } = await supabaseAdmin
          .from('schools')
          .select('*')
          .eq('id', dbUser.schoolId)
          .maybeSingle();
        school = await ensureSchoolIdentifier(mapSupabaseSchool(sbSchool), supabaseAdmin);
      } else {
        const schoolResult = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
        school = schoolResult[0];
      }
      const schoolIdentifier = school?.identifier || buildFallbackSchoolIdentifier(dbUser.schoolId);

      // Query active subscription for this school
      let subList: any[] = [];
      if (supabaseAdmin) {
        const { data: subscriptionsBySchoolId, error } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('school_id', dbUser.schoolId);
        if (error) throw error;
        // Older issued licences may have been saved before school_id was
        // populated. Their scoped school identifier remains a safe fallback.
        const identifierAliases = Array.from(new Set([
          schoolIdentifier,
          `EDUCO-SCH-${dbUser.schoolId}`,
          buildFallbackSchoolIdentifier(dbUser.schoolId),
        ]));
        const { data: subscriptionsByIdentifier, error: identifierError } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .in('school_identifier', identifierAliases);
        if (identifierError) throw identifierError;
        const uniqueSubscriptions = new Map<string, any>();
        [...(subscriptionsBySchoolId || []), ...(subscriptionsByIdentifier || [])]
          .forEach((subscription: any) => uniqueSubscriptions.set(String(subscription.id), subscription));
        subList = [...uniqueSubscriptions.values()].map(mapSupabaseSubscription).filter(Boolean)
          .sort((a: any, b: any) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime());
      } else {
        subList = await db.select().from(subscriptions)
          .where(eq(subscriptions.schoolId, dbUser.schoolId))
          .orderBy(desc(subscriptions.endDate));
      }

      const activeSub = pickCurrentActiveSubscription(subList);
      const now = new Date();

      if (!activeSub) {
        return res.json({
          isActive: false,
          isPreSubscription: true,
          planType: null,
          daysRemaining: 0,
          schoolIdentifier,
          schoolName: school?.name || 'Mon Établissement',
          promoterName: dbUser.name,
          promoterContact: dbUser.email,
          autoRenew: false,
          message: 'Mode Inscription Uniquement (Abonnement non activé)'
        });
      }

      const endDate = new Date(activeSub.endDate);
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      res.json({
        isActive: true,
        isPreSubscription: false,
        planType: activeSub.planType, // 'standard' | 'ai_premium'
        planName: activeSub.planType === 'ai_premium' ? 'Abonnement IA Premium (20.000 FCFA/mois)' : 'Abonnement Standard (10.000 FCFA/mois)',
        isAiEnabled: activeSub.planType === 'ai_premium',
        daysRemaining,
        endDate: activeSub.endDate,
        startDate: activeSub.startDate,
        months: activeSub.months,
        amountPaid: activeSub.amountPaid,
        code: activeSub.code,
        autoRenew: activeSub.autoRenew || false,
        autoRenewFrequency: activeSub.autoRenewFrequency || 'before_expiry',
        status: activeSub.status,
        schoolIdentifier,
        schoolName: school?.name || activeSub.schoolName,
        promoterName: activeSub.promoterName || dbUser.name,
      });
    } catch (error: any) {
      console.error('Subscription status error:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Impossible de lire l’abonnement depuis Supabase.'
      });
    }
  });

  // Activate a Subscription Code (for Promoter, RAF, DG, Cashier)
  app.post('/api/subscriptions/activate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Veuillez renseigner un code d\'abonnement valide.' });
      }

      const cleanCode = code.trim().toUpperCase();
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) {
        return res.status(403).json({ error: 'Aucun établissement associé à votre compte.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      let school: any = null;
      if (supabaseAdmin) {
        const { data: sbSchool } = await supabaseAdmin.from('schools').select('*').eq('id', dbUser.schoolId).maybeSingle();
        school = mapSupabaseSchool(sbSchool);
      } else {
        const schoolResult = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
        school = schoolResult[0];
      }
      const schoolIdentifier = school?.identifier || `EDUCO-SCH-${dbUser.schoolId}`;

      // Find subscription in DB
      let sub: any = null;
      if (supabaseAdmin) {
        const { data: sbSub, error } = await supabaseAdmin.from('subscriptions').select('*').eq('code', cleanCode).maybeSingle();
        if (error) throw error;
        sub = mapSupabaseSubscription(sbSub);
      } else {
        const existing = await db.select().from(subscriptions).where(eq(subscriptions.code, cleanCode)).limit(1);
        sub = existing[0];
      }

      if (!sub) {
        return res.status(404).json({ error: 'Code d\'abonnement introuvable ou invalide.' });
      }

      if (sub.status === 'revoked') {
        return res.status(400).json({ error: 'Ce code d\'abonnement a été révoqué par l\'administrateur.' });
      }

      // Check if it belongs to another school
      if (!ensureActivationBelongsToSchool(sub, { id: dbUser.schoolId, identifier: schoolIdentifier })) {
        return res.status(403).json({ error: 'Cette clé a été émise pour un autre établissement et ne peut pas être utilisée ici.' });
      }

      const now = new Date();
      const newEndDate = calculateSubscriptionEndDate(now, sub.months);

      let updatedSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            school_id: dbUser.schoolId,
            school_name: school?.name || sub.schoolName,
            school_identifier: schoolIdentifier,
            status: 'active',
            start_date: now.toISOString(),
            end_date: newEndDate.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq('id', sub.id)
          .select('*')
          .single();
        if (error) throw error;
        updatedSub = mapSupabaseSubscription(data);
      } else {
        [updatedSub] = await db.update(subscriptions)
          .set({
            schoolId: dbUser.schoolId,
            schoolName: school?.name || sub.schoolName,
            schoolIdentifier,
            status: 'active',
            startDate: now,
            endDate: newEndDate,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, sub.id))
          .returning();
      }

      // Add a notification
      if (supabaseAdmin) {
        await supabaseAdmin.from('notifications').insert([{
          user_id: dbUser.id,
          title: 'Licence Activée avec Succès !',
          message: `Votre abonnement ${updatedSub.planType === 'ai_premium' ? 'IA Premium' : 'Standard'} est activé pour ${updatedSub.months} mois jusqu'au ${newEndDate.toLocaleDateString('fr-FR')}.`,
          type: 'subscription',
          is_read: false,
          link: 'Abonnement & Licence',
        }]).throwOnError();
      } else {
        await db.insert(notifications).values({
          userId: dbUser.id,
          title: 'Licence Activée avec Succès !',
          message: `Votre abonnement ${updatedSub.planType === 'ai_premium' ? 'IA Premium' : 'Standard'} est activé pour ${updatedSub.months} mois jusqu'au ${newEndDate.toLocaleDateString('fr-FR')}.`,
          type: 'subscription',
          link: 'Abonnement & Licence',
        });
      }

      // Dispatch Brevo email confirmation
      if (dbUser.email) {
        sendSubscriptionConfirmationEmail({
          email: dbUser.email,
          name: dbUser.name || 'Promoteur',
          schoolName: school?.name || updatedSub.schoolName || 'Votre Établissement',
          planType: updatedSub.planType,
          months: updatedSub.months || 1,
          code: updatedSub.code,
          endDate: newEndDate.toLocaleDateString('fr-FR'),
        }).catch(err => console.warn('Brevo Subscription Confirmation Email warning:', err));
      }

      res.json({
        success: true,
        message: 'Abonnement activé avec succès ! Toutes vos fonctionnalités sont désormais déverrouillées.',
        subscription: updatedSub
      });
    } catch (error: any) {
      console.error('Activate Subscription Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Request a Renewal (Promoter, RAF, DG, Cashier)
  app.post('/api/subscriptions/request-renewal', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { requestedPlan, requestedMonths, notes } = req.body;
      const dbUser = await getRequestUser(req);
      if (!dbUser?.schoolId) {
        return res.status(403).json({ error: 'Aucun établissement associé.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      let school: any = null;
      if (supabaseAdmin) {
        const { data: sbSchool } = await supabaseAdmin.from('schools').select('*').eq('id', dbUser.schoolId).maybeSingle();
        school = mapSupabaseSchool(sbSchool);
      } else {
        const schoolResult = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
        school = schoolResult[0];
      }
      const schoolIdentifier = school?.identifier || `EDUCO-SCH-${dbUser.schoolId}`;
      const promoterName = String(
        dbUser?.name ||
        school?.promoterName ||
        school?.promoter_name ||
        req.user?.name ||
        dbUser?.email ||
        'Promoteur'
      ).trim() || 'Promoteur';
      const promoterContact = String(
        dbUser?.email ||
        school?.promoterEmail ||
        school?.promoter_email ||
        school?.promoterContact ||
        school?.promoter_contact ||
        ''
      ).trim() || null;

      let newRequest: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('subscription_requests').insert([{
          school_id: dbUser.schoolId,
          school_identifier: schoolIdentifier,
          school_name: school?.name || 'Établissement',
          promoter_name: promoterName,
          promoter_contact: promoterContact,
          requested_plan: requestedPlan || 'standard',
          requested_months: Number(requestedMonths) || 1,
          status: 'pending',
        }]).select('*').single();
        if (error) throw error;
        newRequest = mapSupabaseSubscriptionRequest(data);
      } else {
        [newRequest] = await db.insert(subscriptionRequests).values({
          schoolId: dbUser.schoolId,
          schoolIdentifier,
          schoolName: school?.name || 'Établissement',
          promoterName,
          promoterContact,
          requestedPlan: requestedPlan || 'standard',
          requestedMonths: Number(requestedMonths) || 1,
          status: 'pending',
        }).returning();
      }

      res.json({
        success: true,
        message: `Demande de renouvellement pour l'établissement ${schoolIdentifier} transmise à l'administrateur EDUCO.`,
        request: newRequest,
      });
    } catch (error: any) {
      console.error('Request Renewal Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get All Subscriptions & Requests
  app.get('/api/admin/subscriptions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await requirePlatformAdmin(req, res);
      if (!dbUser) return;

      const supabaseAdmin = getSupabaseAdmin(req);
      let allSubs = supabaseAdmin ? [] : await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).catch(() => []);
      let allRequests = supabaseAdmin ? [] : await db.select().from(subscriptionRequests).orderBy(desc(subscriptionRequests.createdAt)).catch(() => []);
      let allSchools = supabaseAdmin ? [] : await db.select().from(schools).catch(() => []);
      if (supabaseAdmin) {
        try {
          const [{ data: sbSubs }, { data: sbReqs }, { data: sbSchools }] = await Promise.all([
            supabaseAdmin.from('subscriptions').select('*'),
            supabaseAdmin.from('subscription_requests').select('*'),
            supabaseAdmin.from('schools').select('*')
          ]);

          if (sbSubs) {
            sbSubs.forEach(s => {
              if (!allSubs.some(x => x.id === s.id || (s.code && x.code === s.code))) {
                allSubs.push(mapSupabaseSubscription(s) as any);
              }
            });
          }

          if (sbReqs) {
            sbReqs.forEach(r => {
              if (!allRequests.some(x => x.id === r.id)) {
                allRequests.push(mapSupabaseSubscriptionRequest(r) as any);
              }
            });
          }

          if (sbSchools) {
            sbSchools.forEach(sch => {
              if (!allSchools.some(x => x.id === sch.id || (sch.identifier && x.identifier === sch.identifier))) {
                allSchools.push({
                  id: sch.id,
                  name: sch.name || 'École Inconnue',
                  identifier: sch.identifier || `EDUCO-SCH-${sch.id}`,
                  address: sch.address,
                  phone: sch.phone,
                  email: sch.email,
                  promoterName: sch.promoter_name,
                  promoterContact: sch.promoter_contact
                } as any);
              }
            });
          }
        } catch (e) {
          console.warn('Supabase subscriptions admin fetch warning:', e);
        }
      }

      res.json({
        subscriptions: allSubs,
        requests: allRequests,
        schools: allSchools,
      });
    } catch (error: any) {
      console.error('Admin Subscriptions Fetch Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Generate a Unique Subscription Code
  app.post('/api/admin/subscriptions/generate', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await requirePlatformAdmin(req, res);
      if (!dbUser) return;

      const {
        schoolName,
        schoolIdentifier,
        promoterName,
        promoterContact,
        planType, // 'standard' | 'ai_premium'
        months,
        amountPaid,
        autoRenew,
        autoRenewFrequency, // 'monthly' | 'before_expiry'
      } = req.body;

      const numMonths = Math.max(1, Number(months) || 1);
      const normalizedPlanType = normalizeSubscriptionPlan(planType);
      const isAI = normalizedPlanType === 'ai_premium';
      const monthlyRate = getSubscriptionMonthlyRate(normalizedPlanType);
      const computedAmount = Number(amountPaid) || (monthlyRate * numMonths);

      // Generate Unique Code format: EDUCO-STD-2026-X8F9-Q2M1 or EDUCO-AI-2026-Y4K8-V7B3
      const planPrefix = isAI ? 'AI' : 'STD';
      const year = new Date().getFullYear();
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `EDUCO-${planPrefix}-${year}-${part1}-${part2}`;

      const now = new Date();
      const endDate = calculateSubscriptionEndDate(now, numMonths);

      // A licence must always be bound to one existing school at issuance time.
      let matchedSchoolId: number | null = null;
      const supabaseAdmin = getSupabaseAdmin(req);
      if (schoolIdentifier) {
        if (supabaseAdmin) {
          const { data: foundSchool } = await supabaseAdmin.from('schools').select('id').eq('identifier', schoolIdentifier).maybeSingle();
          if (foundSchool?.id) matchedSchoolId = foundSchool.id;
        } else {
          const found = await db.select().from(schools).where(eq(schools.identifier, schoolIdentifier)).limit(1);
          if (found[0]) matchedSchoolId = found[0].id;
        }
      }

      if (!matchedSchoolId) {
        return res.status(400).json({ error: 'Sélectionnez un établissement enregistré avant de générer la licence.' });
      }

      const fallbackIdentifier = normalizeSchoolIdentifier(schoolIdentifier);
      const issuedStatus = buildIssuedSubscriptionStatus();
      let newSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('subscriptions').insert([{
          code,
          school_id: matchedSchoolId,
          school_name: schoolName || 'Établissement',
          school_identifier: fallbackIdentifier,
          promoter_name: promoterName || 'Promoteur',
          promoter_contact: promoterContact || '',
          plan_type: normalizedPlanType,
          amount_paid: computedAmount,
          months: numMonths,
          status: issuedStatus,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          auto_renew: Boolean(autoRenew),
          auto_renew_frequency: autoRenewFrequency || 'before_expiry'
        }]).select('*').single();
        if (error) throw error;
        newSub = mapSupabaseSubscription(data);
      } else {
        [newSub] = await db.insert(subscriptions).values({
          code,
          schoolId: matchedSchoolId,
          schoolName: schoolName || 'Établissement',
          schoolIdentifier: fallbackIdentifier,
          promoterName: promoterName || 'Promoteur',
          promoterContact: promoterContact || '',
          planType: normalizedPlanType,
          amountPaid: computedAmount,
          months: numMonths,
          status: issuedStatus,
          startDate: now,
          endDate,
          autoRenew: Boolean(autoRenew),
          autoRenewFrequency: autoRenewFrequency || 'before_expiry',
        }).returning();
      }

      res.json({
        success: true,
        message: `Code d'abonnement ${code} généré avec succès pour ${numMonths} mois (${computedAmount.toLocaleString()} FCFA).`,
        subscription: newSub,
      });
    } catch (error: any) {
      console.error('Admin Generate Subscription Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Extend Subscription (+1, +2, +3 months)
  app.post('/api/admin/subscriptions/extend', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await requirePlatformAdmin(req, res);
      if (!dbUser) return;

      const { subscriptionId, additionalMonths } = req.body;
      const addMonths = Number(additionalMonths) || 1;

      const supabaseAdmin = getSupabaseAdmin(req);
      let sub: any = null;
      if (supabaseAdmin) {
        const { data: sbSub, error } = await supabaseAdmin.from('subscriptions').select('*').eq('id', Number(subscriptionId)).maybeSingle();
        if (error) throw error;
        sub = mapSupabaseSubscription(sbSub);
      } else {
        const subResult = await db.select().from(subscriptions).where(eq(subscriptions.id, Number(subscriptionId))).limit(1);
        sub = subResult[0];
      }

      if (!sub) {
        return res.status(404).json({ error: 'Abonnement introuvable.' });
      }

      const currentEnd = new Date(sub.endDate);
      const baseDate = currentEnd.getTime() > Date.now() ? currentEnd : new Date();
      const newEndDate = new Date(baseDate.getTime() + addMonths * 30 * 24 * 60 * 60 * 1000);
      const monthlyRate = getSubscriptionMonthlyRate(sub.planType);
      const newAmount = (sub.amountPaid || 0) + (monthlyRate * addMonths);
      const totalMonths = (sub.months || 1) + addMonths;

      let updatedSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('subscriptions')
          .update({
            end_date: newEndDate.toISOString(),
            months: totalMonths,
            amount_paid: newAmount,
            status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id)
          .select('*')
          .single();
        if (error) throw error;
        updatedSub = mapSupabaseSubscription(data);
      } else {
        [updatedSub] = await db.update(subscriptions)
          .set({
            endDate: newEndDate,
            months: totalMonths,
            amountPaid: newAmount,
            status: 'active',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, sub.id))
          .returning();
      }

      res.json({
        success: true,
        message: `Abonnement prolongé de ${addMonths} mois avec succès (Nouvelle fin : ${newEndDate.toLocaleDateString('fr-FR')}).`,
        subscription: updatedSub,
      });
    } catch (error: any) {
      console.error('Extend Subscription Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Toggle Auto-Renew
  app.post('/api/admin/subscriptions/toggle-auto-renew', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await requirePlatformAdmin(req, res);
      if (!dbUser) return;

      const { subscriptionId, autoRenew, autoRenewFrequency } = req.body;
      const supabaseAdmin = getSupabaseAdmin(req);
      let updatedSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('subscriptions')
          .update({
            auto_renew: Boolean(autoRenew),
            auto_renew_frequency: autoRenewFrequency || 'before_expiry',
            updated_at: new Date().toISOString()
          })
          .eq('id', Number(subscriptionId))
          .select('*')
          .single();
        if (error) throw error;
        updatedSub = mapSupabaseSubscription(data);
      } else {
        [updatedSub] = await db.update(subscriptions)
          .set({
            autoRenew: Boolean(autoRenew),
            autoRenewFrequency: autoRenewFrequency || 'before_expiry',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, Number(subscriptionId)))
          .returning();
      }

      res.json({
        success: true,
        message: `Renouvellement automatique mis à jour : ${autoRenew ? 'Activé (' + autoRenewFrequency + ')' : 'Désactivé'}.`,
        subscription: updatedSub,
      });
    } catch (error: any) {
      console.error('Toggle Auto Renew Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update an issued/active subscription
  app.put('/api/admin/subscriptions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await requirePlatformAdmin(req, res);
      if (!dbUser) return;

      const subscriptionId = Number(req.params.id);
      if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
        return res.status(400).json({ error: 'Licence invalide.' });
      }

      const normalizedPlanType = normalizeSubscriptionPlan(req.body.planType);
      const months = Math.max(1, Number(req.body.months) || 1);
      const amountPaid = Number(req.body.amountPaid) || getSubscriptionMonthlyRate(normalizedPlanType) * months;
      const startDate = req.body.startDate ? new Date(req.body.startDate) : new Date();
      const endDate = req.body.endDate ? new Date(req.body.endDate) : calculateSubscriptionEndDate(startDate, months);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        return res.status(400).json({ error: 'Dates de licence invalides.' });
      }

      const payload = {
        school_name: req.body.schoolName || 'Établissement',
        school_identifier: normalizeSchoolIdentifier(req.body.schoolIdentifier),
        promoter_name: req.body.promoterName || 'Promoteur',
        promoter_contact: req.body.promoterContact || '',
        plan_type: normalizedPlanType,
        amount_paid: amountPaid,
        months,
        status: req.body.status === 'revoked' ? 'revoked' : req.body.status === 'active' ? 'active' : 'pending',
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        auto_renew: Boolean(req.body.autoRenew),
        auto_renew_frequency: req.body.autoRenewFrequency || 'before_expiry',
        updated_at: new Date().toISOString(),
      };

      const supabaseAdmin = getSupabaseAdmin(req);
      let updatedSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .update(payload)
          .eq('id', subscriptionId)
          .select('*')
          .single();
        if (error) throw error;
        updatedSub = mapSupabaseSubscription(data);
      } else {
        [updatedSub] = await db.update(subscriptions)
          .set({
            schoolName: payload.school_name,
            schoolIdentifier: payload.school_identifier,
            promoterName: payload.promoter_name,
            promoterContact: payload.promoter_contact,
            planType: payload.plan_type,
            amountPaid: payload.amount_paid,
            months: payload.months,
            status: payload.status,
            startDate,
            endDate,
            autoRenew: payload.auto_renew,
            autoRenewFrequency: payload.auto_renew_frequency,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
      }

      res.json({ success: true, message: 'Licence mise à jour avec succès.', subscription: updatedSub });
    } catch (error: any) {
      console.error('Update Subscription Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Revoke a subscription without deleting its audit history
  app.post('/api/admin/subscriptions/:id/revoke', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await requirePlatformAdmin(req, res);
      if (!dbUser) return;

      const subscriptionId = Number(req.params.id);
      if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
        return res.status(400).json({ error: 'Licence invalide.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      let updatedSub: any;
      const now = new Date();
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'revoked', auto_renew: false, updated_at: now.toISOString() })
          .eq('id', subscriptionId)
          .select('*')
          .single();
        if (error) throw error;
        updatedSub = mapSupabaseSubscription(data);
      } else {
        [updatedSub] = await db.update(subscriptions)
          .set({ status: 'revoked', autoRenew: false, updatedAt: now })
          .where(eq(subscriptions.id, subscriptionId))
          .returning();
      }

      res.json({ success: true, message: 'Licence révoquée. L’établissement perd l’accès aux modules sous licence.', subscription: updatedSub });
    } catch (error: any) {
      console.error('Revoke Subscription Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete a subscription permanently
  app.delete('/api/admin/subscriptions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await requirePlatformAdmin(req, res);
      if (!dbUser) return;

      const subscriptionId = Number(req.params.id);
      if (!Number.isInteger(subscriptionId) || subscriptionId <= 0) {
        return res.status(400).json({ error: 'Licence invalide.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin.from('subscriptions').delete().eq('id', subscriptionId);
        if (error) throw error;
      } else {
        await db.delete(subscriptions).where(eq(subscriptions.id, subscriptionId));
      }

      res.json({ success: true, message: 'Licence supprimée définitivement.' });
    } catch (error: any) {
      console.error('Delete Subscription Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Fulfill Renewal Request
  app.post('/api/admin/subscriptions/fulfill-request', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await requirePlatformAdmin(req, res);
      if (!dbUser) return;

      const { requestId, autoRenew, autoRenewFrequency } = req.body;
      let request: any = null;

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { data: sbReq } = await supabaseAdmin.from('subscription_requests').select('*').eq('id', Number(requestId)).single();
        request = mapSupabaseSubscriptionRequest(sbReq);
      } else {
        const reqResult = await db.select().from(subscriptionRequests).where(eq(subscriptionRequests.id, Number(requestId))).limit(1);
        request = reqResult[0];
      }

      if (!request) {
        return res.status(404).json({ error: 'Demande introuvable.' });
      }

      const requestPlanType = normalizeSubscriptionPlan(request.requestedPlan);
      const isAI = requestPlanType === 'ai_premium';
      const numMonths = request.requestedMonths || 1;
      const amountPaid = getSubscriptionMonthlyRate(requestPlanType) * numMonths;

      // Generate Code
      const planPrefix = isAI ? 'AI' : 'STD';
      const year = new Date().getFullYear();
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `EDUCO-${planPrefix}-${year}-${part1}-${part2}`;

      const now = new Date();
      const endDate = calculateSubscriptionEndDate(now, numMonths);
      const issuedStatus = buildIssuedSubscriptionStatus();

      let newSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('subscriptions').insert([{
          code,
          school_id: request.schoolId,
          school_name: request.schoolName,
          school_identifier: request.schoolIdentifier,
          promoter_name: request.promoterName,
          promoter_contact: request.promoterContact,
          plan_type: requestPlanType,
          amount_paid: amountPaid,
          months: numMonths,
          status: issuedStatus,
          start_date: now.toISOString(),
          end_date: endDate.toISOString(),
          auto_renew: Boolean(autoRenew),
          auto_renew_frequency: autoRenewFrequency || 'before_expiry'
        }]).select('*').single();
        if (error) throw error;
        newSub = mapSupabaseSubscription(data);
        await supabaseAdmin.from('subscription_requests').update({ status: 'processed' }).eq('id', request.id).throwOnError();
      } else {
        [newSub] = await db.insert(subscriptions).values({
          code,
          schoolId: request.schoolId,
          schoolName: request.schoolName,
          schoolIdentifier: request.schoolIdentifier,
          promoterName: request.promoterName,
          promoterContact: request.promoterContact,
          planType: requestPlanType,
          amountPaid,
          months: numMonths,
          status: issuedStatus,
          startDate: now,
          endDate,
          autoRenew: Boolean(autoRenew),
          autoRenewFrequency: autoRenewFrequency || 'before_expiry',
        }).returning();

        await db.update(subscriptionRequests)
          .set({ status: 'processed' })
          .where(eq(subscriptionRequests.id, request.id))
          .catch(() => {});
      }

      res.json({
        success: true,
        message: `Code ${code} généré pour ${request.schoolName}. L'établissement doit l'activer depuis son portail.`,
        subscription: newSub,
      });
    } catch (error: any) {
      console.error('Fulfill Request Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // ADMIN REGISTERED SCHOOLS DOSSIER DIRECTORY
  // ==========================================
  app.get('/api/admin/diagnostic', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (dbUser?.role !== 'Admin' && dbUser?.role !== 'Co-admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

      let studentsCount = 0;
      let usersCount = 0;
      let schoolsCount = 0;
      let classesCount = 0;
      let paymentsCount = 0;
      let transactionsCount = 0;
      let attendanceCount = 0;
      let gradesCount = 0;
      let subscriptionsCount = 0;

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const tables = [
          ['students', 'studentsCount'],
          ['users', 'usersCount'],
          ['schools', 'schoolsCount'],
          ['classes', 'classesCount'],
          ['payments', 'paymentsCount'],
          ['transactions', 'transactionsCount'],
          ['attendance', 'attendanceCount'],
          ['grades', 'gradesCount'],
          ['subscriptions', 'subscriptionsCount'],
        ] as const;

        const counts = await Promise.all(tables.map(async ([table]) => {
          const { count, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
          if (error) {
            console.warn(`Diagnostic Supabase count warning for ${table}:`, error.message);
            return 0;
          }
          return count || 0;
        }));

        return res.json({
          success: true,
          studentsCount: counts[0],
          usersCount: counts[1],
          schoolsCount: counts[2],
          classesCount: counts[3],
          paymentsCount: counts[4],
          transactionsCount: counts[5],
          attendanceCount: counts[6],
          gradesCount: counts[7],
          subscriptionsCount: counts[8],
          source: 'supabase',
          timestamp: new Date().toISOString()
        });
      }

      try {
        const studRes = await db.select().from(students);
        studentsCount = studRes.length;
      } catch (err: any) {
        console.error('Error fetching students count:', err);
      }

      try {
        const userRes = await db.select().from(users);
        usersCount = userRes.length;
      } catch (err: any) {
        console.error('Error fetching users count:', err);
      }

      try {
        const schoolRes = await db.select().from(schools);
        schoolsCount = schoolRes.length;
      } catch (err: any) {
        console.error('Error fetching schools count:', err);
      }

      try {
        const classRes = await db.select().from(classes);
        classesCount = classRes.length;
      } catch (err: any) {
        console.error('Error fetching classes count:', err);
      }

      try {
        const payRes = await db.select().from(payments);
        paymentsCount = payRes.length;
      } catch (err: any) {
        console.error('Error fetching payments count:', err);
      }

      try {
        const transRes = await db.select().from(transactions);
        transactionsCount = transRes.length;
      } catch (err: any) {
        console.error('Error fetching transactions count:', err);
      }

      try {
        const attRes = await db.select().from(attendance);
        attendanceCount = attRes.length;
      } catch (err: any) {
        console.error('Error fetching attendance count:', err);
      }

      try {
        const grdRes = await db.select().from(grades);
        gradesCount = grdRes.length;
      } catch (err: any) {
        console.error('Error fetching grades count:', err);
      }

      try {
        const subRes = await db.select().from(subscriptions);
        subscriptionsCount = subRes.length;
      } catch (err: any) {
        console.error('Error fetching subscriptions count:', err);
      }

      res.json({
        success: true,
        studentsCount,
        usersCount,
        schoolsCount,
        classesCount,
        paymentsCount,
        transactionsCount,
        attendanceCount,
        gradesCount,
        subscriptionsCount,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Diagnostic error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/consolidated-financials', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      const userRole = req.user?.role || dbUser?.role;
      if (userRole !== 'Admin' && userRole !== 'Co-admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

      const { schoolId } = req.query;

      const supabaseAdmin = getSupabaseAdmin();
      let allPayments: any[] = [];
      let allTransactions: any[] = [];
      let allSubscriptions: any[] = [];
      if (supabaseAdmin) {
        try {
          const [{ data: sbPayments }, { data: sbTx }, { data: sbSubs }] = await Promise.all([
            supabaseAdmin.from('payments').select('*'),
            supabaseAdmin.from('transactions').select('*'),
            supabaseAdmin.from('subscriptions').select('*')
          ]);
          allPayments = (sbPayments || []).map(mapSupabasePayment).filter(Boolean);
          allTransactions = (sbTx || []).map(mapSupabaseTransaction).filter(Boolean);
          allSubscriptions = (sbSubs || []).map(mapSupabaseSubscription).filter(Boolean);
        } catch (e) {
          console.warn('Supabase financials fetch warning:', e);
        }
      } else {
        // Query fallback database records only when Supabase is unavailable
        allPayments = await db.select().from(payments);
        allTransactions = await db.select().from(transactions);
        allSubscriptions = await db.select().from(subscriptions);
      }

      if (schoolId && schoolId !== 'all') {
        const schIdNum = parseInt(schoolId as string, 10);
        allPayments = allPayments.filter(p => p.schoolId === schIdNum);
        allTransactions = allTransactions.filter(t => t.schoolId === schIdNum);
        allSubscriptions = allSubscriptions.filter(s => s.schoolId === schIdNum);
      }

      // Generate exact last 6 months ending in August 2026
      const months = [
        { name: 'Mars 2026', monthNum: 2, year: 2026 },
        { name: 'Avril 2026', monthNum: 3, year: 2026 },
        { name: 'Mai 2026', monthNum: 4, year: 2026 },
        { name: 'Juin 2026', monthNum: 5, year: 2026 },
        { name: 'Juillet 2026', monthNum: 6, year: 2026 },
        { name: 'Août 2026', monthNum: 7, year: 2026 },
      ];

      const monthlyData = months.map(m => {
        const monthPayments = allPayments.filter(p => {
          if (!p.paymentDate) return false;
          const d = new Date(p.paymentDate);
          return d.getMonth() === m.monthNum && d.getFullYear() === m.year;
        });

        const monthTransactions = allTransactions.filter(t => {
          if (!t.date) return false;
          const d = new Date(t.date);
          return d.getMonth() === m.monthNum && d.getFullYear() === m.year;
        });

        const studentFeesSum = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

        const opIncomesSum = monthTransactions
          .filter(t => t.type?.toLowerCase() === 'recette' || t.type?.toLowerCase() === 'income')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        const opExpensesSum = monthTransactions
          .filter(t => t.type?.toLowerCase() === 'dépense' || t.type?.toLowerCase() === 'expense')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        const monthSubscriptions = allSubscriptions.filter(s => {
          if (!s.updatedAt) return false;
          const d = new Date(s.updatedAt);
          return d.getMonth() === m.monthNum && d.getFullYear() === m.year && s.status === 'active';
        });
        const subscriptionRevenue = monthSubscriptions.reduce((sum, s) => sum + (s.amountPaid || 0), 0);

        let revenus = studentFeesSum + opIncomesSum + subscriptionRevenue;
        let depenses = opExpensesSum;

        // Convert to Millions (M FCFA) for display
        const revenusM = Number((revenus / 1_000_000).toFixed(3));
        const depensesM = Number((depenses / 1_000_000).toFixed(3));
        const soldeNetM = Number((revenusM - depensesM).toFixed(3));
        const marge = revenusM > 0 ? Number(((soldeNetM / revenusM) * 100).toFixed(1)) : 0;

        return {
          month: m.name,
          revenus: revenusM,
          depenses: depensesM,
          soldeNet: soldeNetM,
          marge: marge >= 0 ? marge : 0
        };
      });

      res.json({
        success: true,
        monthlyData
      });
    } catch (error: any) {
      console.error('Consolidated financials error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/registered-schools', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      const userRole = req.user?.role || dbUser?.role;
      if (userRole !== 'Admin' && userRole !== 'Co-admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

      // Merge Supabase schools and subscriptions if available
      const supabaseAdmin = getSupabaseAdmin(req);
      let allSchools = supabaseAdmin ? [] : await db.select().from(schools).orderBy(desc(schools.createdAt)).catch(() => []);
      let allSubscriptions = supabaseAdmin ? [] : await db.select().from(subscriptions).catch(() => []);
      let allUsers = supabaseAdmin ? [] : await db.select().from(users).catch(() => []);
      if (supabaseAdmin) {
        try {
          const [{ data: sbSchools }, { data: sbUsers }, { data: sbSubs }] = await Promise.all([
            supabaseAdmin.from('schools').select('*'),
            supabaseAdmin.from('users').select('*'),
            supabaseAdmin.from('subscriptions').select('*')
          ]);

          if (sbSchools && sbSchools.length > 0) {
            sbSchools.forEach(sbSch => {
              if (!allSchools.some(s => s.id === sbSch.id || (sbSch.identifier && s.identifier === sbSch.identifier) || (s.name && sbSch.name && s.name.toLowerCase() === sbSch.name.toLowerCase()))) {
                allSchools.push({
                  id: sbSch.id,
                  name: sbSch.name || 'École Inconnue',
                  identifier: sbSch.identifier || `EDUCO-SCH-${sbSch.id}`,
                  address: sbSch.address || 'Non renseignée',
                  phone: sbSch.phone || 'Non renseigné',
                  email: sbSch.email || 'Non renseigné',
                  creationDate: sbSch.creation_date || sbSch.createdAt || null,
                  promoterName: sbSch.promoter_name || sbSch.promoterName || 'Promoteur',
                  promoterContact: sbSch.promoter_contact || sbSch.promoterContact || sbSch.phone || 'Non renseigné',
                  promoterEmail: sbSch.promoter_email || sbSch.promoterEmail || sbSch.email || 'Non renseigné',
                  levels: sbSch.levels || {},
                  openingAuthorizationDoc: sbSch.opening_authorization_doc || sbSch.openingAuthorizationDoc || null,
                  promoterIdDoc: sbSch.promoter_id_doc || sbSch.promoterIdDoc || null,
                  statutesDoc: sbSch.statutes_doc || sbSch.statutesDoc || null,
                  status: sbSch.status || 'active',
                  createdAt: sbSch.created_at ? new Date(sbSch.created_at) : new Date(),
                } as any);
              }
            });
          }

          if (sbUsers && sbUsers.length > 0) {
            sbUsers.forEach(su => {
              if (!allUsers.some(u => u.id === su.id || u.email === su.email)) {
                allUsers.push({
                  id: su.id,
                  uid: su.uid || `usr_${su.id}`,
                  email: su.email,
                  name: su.name,
                  role: su.role,
                  schoolId: su.school_id || su.schoolId || 1,
                  status: su.status || 'Actif',
                  avatar: su.avatar,
                  phone: su.phone
                } as any);
              }
            });
          }

          if (sbSubs && sbSubs.length > 0) {
            sbSubs.forEach(s => {
              if (!allSubscriptions.some(x => x.id === s.id || (s.code && x.code === s.code))) {
                allSubscriptions.push({
                  id: s.id,
                  code: s.code,
                  schoolId: s.school_id || s.schoolId,
                  schoolName: s.school_name || s.schoolName,
                  schoolIdentifier: s.school_identifier || s.schoolIdentifier,
                  promoterName: s.promoter_name || s.promoterName,
                  promoterContact: s.promoter_contact || s.promoterContact,
                  planType: s.plan_type || s.planType,
                  amountPaid: s.amount_paid || s.amountPaid,
                  months: s.months,
                  status: s.status || 'active',
                  startDate: s.start_date ? new Date(s.start_date) : new Date(),
                  endDate: s.end_date ? new Date(s.end_date) : new Date(),
                  autoRenew: Boolean(s.auto_renew ?? s.autoRenew),
                } as any);
              }
            });
          }
        } catch (e) {
          console.warn('Supabase schools fetch warning:', e);
        }
      }

      const enrichedSchools = allSchools.map(sch => {
        const schoolSubs = allSubscriptions.filter(s => Number(s.schoolId) === Number(sch.id) || s.schoolIdentifier === sch.identifier);
        const activeSub = schoolSubs.find(s => s.status === 'active' && new Date(s.endDate).getTime() > Date.now());
        const promoter = allUsers.find(u => Number(u.schoolId) === Number(sch.id) && (u.role === 'Promoteur' || u.role === 'Admin'));
        
        return {
          id: sch.id,
          name: sch.name || 'École Inconnue',
          identifier: sch.identifier || `EDUCO-SCH-${sch.id?.toString().padStart(4, '0') || '0000'}`,
          address: sch.address || 'Non renseignée',
          phone: sch.phone || 'Non renseigné',
          email: sch.email || promoter?.email || 'Non renseigné',
          creationDate: sch.creationDate || null,
          promoterName: sch.promoterName || promoter?.name || 'Promoteur',
          promoterContact: sch.promoterContact || sch.phone || 'Non renseigné',
          promoterEmail: sch.promoterEmail || promoter?.email || 'Non renseigné',
          levels: sch.levels || {},
          openingAuthorizationDoc: sch.openingAuthorizationDoc,
          promoterIdDoc: sch.promoterIdDoc,
          statutesDoc: sch.statutesDoc,
          status: sch.status || 'active',
          registeredAt: sch.createdAt,
          subscription: activeSub ? {
            isActive: true,
            planType: activeSub.planType,
            months: activeSub.months,
            endDate: activeSub.endDate,
            code: activeSub.code,
            amountPaid: activeSub.amountPaid,
            autoRenew: activeSub.autoRenew,
          } : {
            isActive: false,
            planType: null,
            message: 'Mode Inscription Uniquement',
          },
          subscriptionsCount: schoolSubs.length,
        };
      });

      res.json({ success: true, schools: enrichedSchools });
    } catch (error: any) {
      console.error('Admin Registered Schools Fetch Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Fetch all database entities for structured CSV/Excel exporting
  app.get('/api/admin/export-data', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = (req.user?.role || req.user?.schoolId) ? req.user : await getUserByUid(req.user!.uid);
      const userRole = req.user?.role || dbUser?.role;
      const userSchoolId = req.user?.schoolId || dbUser?.schoolId;
      const isSuperAdmin = userRole === 'Admin' || userRole === 'Co-admin';
      const supabaseAdmin = getSupabaseAdmin(req);

      let allSchools = supabaseAdmin ? [] : await db.select().from(schools).orderBy(asc(schools.name)).catch(() => []);
      let allSubscriptions = supabaseAdmin ? [] : await db.select().from(subscriptions).catch(() => []);
      let allSubscriptionRequests = supabaseAdmin ? [] : await db.select().from(subscriptionRequests).catch(() => []);
      let allUsers = supabaseAdmin ? [] : await db.select().from(users).orderBy(asc(users.name)).catch(() => []);
      let allStudents = supabaseAdmin ? [] : await db.select().from(students).catch(() => []);
      let allPersonnel = supabaseAdmin ? [] : await db.select().from(personnel).catch(() => []);
      let allClasses = supabaseAdmin ? [] : await db.select().from(classes).catch(() => []);
      let allPayments = supabaseAdmin ? [] : await db.select().from(payments).catch(() => []);
      let allTransactions = supabaseAdmin ? [] : await db.select().from(transactions).catch(() => []);
      let allAttendance = supabaseAdmin ? [] : await db.select().from(attendance).catch(() => []);
      let allFees = supabaseAdmin ? [] : await db.select().from(fees).catch(() => []);
      let allNotifications = supabaseAdmin ? [] : await db.select().from(notifications).catch(() => []);
      let allGrades = supabaseAdmin ? [] : await db.select().from(grades).catch(() => []);

      // Merge Supabase DB entities if available
      if (supabaseAdmin) {
        try {
          // Do not discard Supabase errors. The former destructuring ignored
          // `error` and therefore returned a successful payload full of zero
          // counters whenever a table could not be read.
          const [
            sbSchools,
            sbUsers,
            sbStudents,
            sbPersonnel,
            sbClasses,
            sbPayments,
            sbTx,
            sbAtt,
            sbFees,
            sbNotifs,
            sbSubs,
            sbReqs,
            sbGrades,
            sbSubjects
          ] = await Promise.all([
            getSupabaseRows(supabaseAdmin, 'schools'),
            getSupabaseRows(supabaseAdmin, 'users'),
            getSupabaseRows(supabaseAdmin, 'students'),
            getSupabaseRows(supabaseAdmin, 'personnel'),
            getSupabaseRows(supabaseAdmin, 'classes'),
            getSupabaseRows(supabaseAdmin, 'payments'),
            getSupabaseRows(supabaseAdmin, 'transactions'),
            getSupabaseRows(supabaseAdmin, 'attendance'),
            getSupabaseRows(supabaseAdmin, 'fees'),
            getSupabaseRows(supabaseAdmin, 'notifications'),
            getSupabaseRows(supabaseAdmin, 'subscriptions'),
            getSupabaseRows(supabaseAdmin, 'subscription_requests'),
            getSupabaseRows(supabaseAdmin, 'grades'),
            getSupabaseRows(supabaseAdmin, 'subjects')
          ]);

          if (sbSchools) {
            sbSchools.forEach(s => {
              if (!allSchools.some(x => x.id === s.id || (x.name && s.name && x.name.toLowerCase() === s.name.toLowerCase()))) {
                allSchools.push({ id: s.id, name: s.name || 'École Inconnue', identifier: s.identifier || `EDUCO-SCH-${s.id}`, address: s.address, phone: s.phone, email: s.email, promoterName: s.promoter_name, promoterContact: s.promoter_contact, promoterEmail: s.promoter_email } as any);
              }
            });
          }

          if (sbUsers) {
            sbUsers.forEach(u => {
              const existingIdx = allUsers.findIndex(x => x.id === u.id || (u.email && x.email && x.email.toLowerCase() === u.email.toLowerCase()));
              if (existingIdx >= 0) {
                allUsers[existingIdx] = {
                  ...allUsers[existingIdx],
                  avatar: allUsers[existingIdx].avatar || u.avatar,
                  phone: allUsers[existingIdx].phone || u.phone,
                  status: (allUsers[existingIdx].status === 'Actif' || u.status === 'active' || u.status === 'Actif') ? 'Actif' : (allUsers[existingIdx].status || 'Actif'),
                  studentId: (allUsers[existingIdx] as any).studentId || u.student_id || u.matricule,
                  class: (allUsers[existingIdx] as any).class || u.class,
                };
              } else {
                allUsers.push({
                  id: u.id,
                  uid: u.uid || `usr_${u.id}`,
                  name: u.name || u.email?.split('@')[0] || 'Utilisateur',
                  email: u.email,
                  role: u.role,
                  schoolId: u.school_id || u.schoolId || 1,
                  status: (u.status === 'active' || u.status === 'Actif' || !u.status) ? 'Actif' : 'Inactif',
                  avatar: u.avatar,
                  phone: u.phone,
                  matricule: u.matricule,
                  studentId: u.student_id || u.matricule,
                  class: u.class
                } as any);
              }
            });
          }

          if (sbStudents) {
            sbStudents.forEach(st => {
              const linkedUser = allUsers.find(u => u.id === (st.user_id || st.userId) || (st.matricule && (u as any).matricule === st.matricule) || (st.email && u.email && u.email.toLowerCase() === st.email.toLowerCase()));
              const existingIdx = allStudents.findIndex(x => x.id === st.id || (st.matricule && x.matricule === st.matricule));
              const studentObj = {
                id: st.id,
                userId: st.user_id || st.userId || linkedUser?.id,
                studentId: st.student_id || st.studentId || st.matricule || (linkedUser as any)?.studentId,
                name: st.name || linkedUser?.name || `Élève #${st.id}`,
                schoolId: st.school_id || st.schoolId || linkedUser?.schoolId || 1,
                classId: st.class_id || st.classId || null,
                matricule: st.student_id || st.matricule || (linkedUser as any)?.studentId || '',
                class: st.class || (linkedUser as any)?.class || 'Non assignée',
                email: st.email || linkedUser?.email || '',
                phone: st.phone || linkedUser?.phone || '',
                avatar: st.avatar || linkedUser?.avatar || '',
                dob: st.dob || st.date_of_birth || '',
                gender: st.gender || '',
                address: st.address || '',
                parentName: st.parent_name || st.parentName || '',
                parentPhone: st.parent_phone || st.parentPhone || '',
                parentEmail: st.parent_email || st.parentEmail || '',
                status: st.status || linkedUser?.status || 'Actif',
                tuitionFee: st.tuition_fee || st.tuitionFee || 0,
                paidAmount: st.paid_amount || st.paidAmount || 0,
                registrationDate: st.registration_date || st.created_at || new Date()
              };

              if (existingIdx >= 0) {
                allStudents[existingIdx] = { ...allStudents[existingIdx], ...studentObj };
              } else {
                allStudents.push(studentObj as any);
              }
            });
          }

          if (sbPersonnel) {
            sbPersonnel.forEach(p => {
              const linkedUser = allUsers.find(u => u.id === (p.user_id || p.userId) || (p.email && u.email && u.email.toLowerCase() === p.email.toLowerCase()));
              const existingIdx = allPersonnel.findIndex(x => x.id === p.id || (p.email && x.email && x.email.toLowerCase() === p.email.toLowerCase()));
              const personnelObj = {
                id: p.id,
                name: p.name || linkedUser?.name || `Personnel #${p.id}`,
                schoolId: p.school_id || p.schoolId || linkedUser?.schoolId || 1,
                role: p.role || linkedUser?.role || 'Personnel',
                email: p.email || linkedUser?.email || '',
                phone: p.phone || linkedUser?.phone || '',
                avatar: p.avatar || linkedUser?.avatar || '',
                status: p.status || linkedUser?.status || 'Actif',
                contractType: p.contract_type || p.contractType || 'CDI',
                salary: p.salary || 0,
                department: p.department || '',
                hireDate: p.hire_date || p.hireDate || p.created_at || new Date()
              };

              if (existingIdx >= 0) {
                allPersonnel[existingIdx] = { ...allPersonnel[existingIdx], ...personnelObj };
              } else {
                allPersonnel.push(personnelObj as any);
              }
            });
          }

          if (sbClasses) {
            sbClasses.forEach(c => {
              if (!allClasses.some(x => x.id === c.id)) {
                allClasses.push({ id: c.id, name: c.name, schoolId: c.school_id || c.schoolId || 1, section: c.section, capacity: c.capacity, teacherId: c.teacher_id || c.teacherId || null } as any);
              }
            });
          }

          if (sbPayments) {
            sbPayments.forEach(p => {
              if (!allPayments.some(x => x.id === p.id)) {
                const amount = Number(p.amount_paid ?? p.amountPaid ?? p.amount ?? 0) || 0;
                allPayments.push({
                  id: p.id,
                  schoolId: p.school_id || p.schoolId || 1,
                  studentId: p.student_id || p.studentId,
                  amount,
                  amountPaid: amount,
                  totalFees: Number(p.total_fees ?? p.totalFees ?? p.expected_amount ?? p.expectedAmount ?? 0) || 0,
                  paymentDate: p.payment_date || p.paymentDate,
                  type: p.type,
                  reference: p.reference,
                  status: p.status || 'completed'
                } as any);
              }
            });
          }

          if (sbTx) {
            sbTx.forEach(t => {
              if (!allTransactions.some(x => x.id === t.id)) {
                const rawType = String(t.type || '').toLowerCase();
                const type = /revenu|income|recette/.test(rawType)
                  ? 'Revenu'
                  : /dépense|depense|expense/.test(rawType)
                    ? 'Dépense'
                    : t.type;
                allTransactions.push({ id: t.id, schoolId: t.school_id || t.schoolId || 1, amount: Number(t.amount || 0), type, date: t.date, category: t.category, description: t.description || '', status: t.status || 'Approuvé' } as any);
              }
            });
          }

          if (sbAtt) {
            sbAtt.forEach(a => {
              if (!allAttendance.some(x => x.id === a.id)) {
                allAttendance.push({ id: a.id, schoolId: a.school_id || a.schoolId || 1, studentId: a.student_id || a.studentId, classId: a.class_id || a.classId || null, date: a.date, status: a.status } as any);
              }
            });
          }

          if (sbFees) {
            sbFees.forEach(f => {
              if (!allFees.some(x => x.id === f.id)) {
                allFees.push({ id: f.id, schoolId: f.school_id || f.schoolId || 1, title: f.title, amount: f.amount, classId: f.class_id || f.classId, type: f.type, dueDate: f.due_date, mandatory: f.mandatory } as any);
              }
            });
          }

          if (sbNotifs) {
            sbNotifs.forEach(n => {
              if (!allNotifications.some(x => x.id === n.id)) {
                allNotifications.push({ id: n.id, userId: n.user_id || n.userId, schoolId: n.school_id || n.schoolId || 1, title: n.title, message: n.message, type: n.type, isRead: n.is_read || n.isRead, createdAt: n.created_at } as any);
              }
            });
          }

          if (sbGrades) {
            const subjectById = new Map((sbSubjects || []).map((s: any) => [Number(s.id), s.name]));
            sbGrades.forEach(g => {
              if (!allGrades.some(x => String(x.id) === String(g.id))) {
                allGrades.push(mapSupabaseGrade(g, subjectById.get(Number(g.subject_id || g.subjectId))) as any);
              }
            });
          }

          if (sbSubs) {
            sbSubs.forEach(s => {
              if (!allSubscriptions.some(x => x.id === s.id || (s.code && x.code === s.code))) {
                allSubscriptions.push({
                  id: s.id,
                  code: s.code,
                  schoolId: s.school_id || s.schoolId,
                  schoolName: s.school_name || s.schoolName,
                  schoolIdentifier: s.school_identifier || s.schoolIdentifier,
                  promoterName: s.promoter_name || s.promoterName,
                  promoterContact: s.promoter_contact || s.promoterContact,
                  planType: s.plan_type || s.planType,
                  amountPaid: s.amount_paid || s.amountPaid,
                  months: s.months,
                  status: s.status || 'active',
                  startDate: s.start_date ? new Date(s.start_date) : new Date(),
                  endDate: s.end_date ? new Date(s.end_date) : new Date(),
                  autoRenew: Boolean(s.auto_renew ?? s.autoRenew)
                } as any);
              }
            });
          }

          if (sbReqs) {
            sbReqs.forEach(r => {
              if (!allSubscriptionRequests.some(x => x.id === r.id)) {
                allSubscriptionRequests.push({
                  id: r.id,
                  schoolId: r.school_id || r.schoolId,
                  schoolIdentifier: r.school_identifier || r.schoolIdentifier,
                  schoolName: r.school_name || r.schoolName,
                  promoterName: r.promoter_name || r.promoterName,
                  promoterContact: r.promoter_contact || r.promoterContact,
                  requestedPlan: r.requested_plan || r.requestedPlan,
                  requestedMonths: r.requested_months || r.requestedMonths || 1,
                  status: r.status || 'pending',
                  createdAt: r.created_at ? new Date(r.created_at) : new Date()
                } as any);
              }
            });
          }
        } catch (e) {
          // A partial failure must be visible to the administration screen;
          // returning `success: true` with empty arrays was the direct cause
          // of the misleading zero-valued dashboard.
          throw e;
        }
      }

      // Add schoolName to all data entities for consolidation display in frontend
      const enrichedUsers = allUsers.map(u => {
        const linkedStudent = allStudents.find((student: any) =>
          String(student.userId || student.user_id || '') === String(u.id || '')
          || (!!u.studentId && String(student.studentId || student.matricule || '') === String(u.studentId))
        );
        return {
          ...u,
          schoolName: allSchools.find(s => Number(s.id) === Number(u.schoolId))?.name || 'Inconnu',
          studentId: u.studentId || linkedStudent?.studentId || linkedStudent?.matricule,
          class: u.class || linkedStudent?.class,
          classId: u.classId || linkedStudent?.classId,
          parentName: u.parentName || linkedStudent?.parentName,
          parentEmail: u.parentEmail || linkedStudent?.parentEmail,
          parentPhone: u.parentPhone || linkedStudent?.parentPhone,
        };
      });
      const enrichedStudents = allStudents.map(st => ({ ...st, schoolName: allSchools.find(s => Number(s.id) === Number(st.schoolId))?.name || 'Inconnu' }));
      const enrichedPersonnel = allPersonnel.map(p => ({ ...p, schoolName: allSchools.find(s => Number(s.id) === Number(p.schoolId))?.name || 'Inconnu' }));
      const enrichedClasses = allClasses.map(c => ({ ...c, schoolName: allSchools.find(s => Number(s.id) === Number(c.schoolId))?.name || 'Inconnu' }));
      const enrichedPayments = allPayments.map(p => ({ ...p, schoolName: allSchools.find(s => Number(s.id) === Number(p.schoolId))?.name || 'Inconnu' }));
      const enrichedTransactions = allTransactions.map(t => ({ ...t, schoolName: allSchools.find(s => Number(s.id) === Number(t.schoolId))?.name || 'Inconnu' }));

      const enrichedSchools = allSchools.map(sch => {
        const schoolSubs = allSubscriptions.filter(s => Number(s.schoolId) === Number(sch.id) || s.schoolIdentifier === sch.identifier);
        const activeSub = schoolSubs.find(s => s.status === 'active' && new Date(s.endDate).getTime() > Date.now());
        const studentRowsCount = allStudents.filter((student: any) =>
          String(student.schoolId ?? student.school_id ?? '') === String(sch.id ?? '')
        ).length;
        // Older registrations created only a `users` row with the Élève role.
        // Keep those existing pupils visible while the dedicated students table
        // is progressively filled, without double-counting newer records.
        const studentUsersCount = allUsers.filter((user: any) =>
          String(user.schoolId ?? user.school_id ?? '') === String(sch.id ?? '')
          && /élève|eleve|student/i.test(String(user.role || ''))
        ).length;
        const studentCount = studentRowsCount || studentUsersCount;
        
        return {
          ...sch,
          name: sch.name || 'École Inconnue',
          identifier: sch.identifier || `EDUCO-SCH-${sch.id?.toString().padStart(4, '0') || '0000'}`,
          studentCount,
          subscription: activeSub ? {
            isActive: true,
            planType: activeSub.planType,
            plan: activeSub.planType,
            months: activeSub.months,
            endDate: activeSub.endDate,
            code: activeSub.code,
            amountPaid: activeSub.amountPaid,
            autoRenew: activeSub.autoRenew,
          } : {
            isActive: false,
            planType: null,
            message: 'Mode Inscription Uniquement',
          },
          subscriptionsCount: schoolSubs.length,
        };
      });

      const currentUserId = req.user?.id || dbUser?.id || req.user?.uid;
      const currentUserEmail = String(req.user?.email || dbUser?.email || '').toLowerCase();
      const currentSchoolId = userSchoolId ? Number(userSchoolId) : undefined;
      const belongsToCurrentSchool = (row: any) => {
        if (isSuperAdmin) return true;
        if (!currentSchoolId) return false;
        return Number(row?.schoolId || row?.school_id) === currentSchoolId;
      };
      const isCurrentUserRow = (row: any) => {
        const rowEmail = String(row?.email || '').toLowerCase();
        return (
          String(row?.id || '') === String(currentUserId || '') ||
          String(row?.uid || '') === String(req.user?.uid || '') ||
          (!!currentUserEmail && rowEmail === currentUserEmail)
        );
      };
      let visibleSchools = isSuperAdmin
        ? enrichedSchools
        : enrichedSchools.filter((school: any) => Number(school?.id) === currentSchoolId);
      let visibleUsers = isSuperAdmin
        ? enrichedUsers
        : enrichedUsers.filter((u: any) => belongsToCurrentSchool(u) || isCurrentUserRow(u));
      let visibleStudents = isSuperAdmin
        ? enrichedStudents
        : enrichedStudents.filter((st: any) => belongsToCurrentSchool(st) || String(st?.parentEmail || '').toLowerCase() === currentUserEmail || String(st?.email || '').toLowerCase() === currentUserEmail);
      let visiblePersonnel = isSuperAdmin ? enrichedPersonnel : enrichedPersonnel.filter(belongsToCurrentSchool);
      let visibleClasses = isSuperAdmin ? enrichedClasses : enrichedClasses.filter(belongsToCurrentSchool);
      let visiblePayments = isSuperAdmin ? enrichedPayments : enrichedPayments.filter(belongsToCurrentSchool);
      let visibleTransactions = isSuperAdmin ? enrichedTransactions : enrichedTransactions.filter(belongsToCurrentSchool);
      let visibleAttendance = isSuperAdmin ? allAttendance : allAttendance.filter(belongsToCurrentSchool);
      let visibleFees = isSuperAdmin ? allFees : allFees.filter(belongsToCurrentSchool);
      let currentSchoolClassIds = new Set(visibleClasses.map((c: any) => String(c.id)));
      let visibleGrades = isSuperAdmin
        ? allGrades
        : allGrades.filter((g: any) => currentSchoolClassIds.has(String(g.classId || g.class_id || '')) || String(g.studentId || g.student_id || '') === String(currentUserId || ''));
      let visibleNotifications = isSuperAdmin
        ? allNotifications
        : allNotifications.filter((n: any) => belongsToCurrentSchool(n) || String(n?.userId || n?.user_id || '') === String(currentUserId || ''));

      // Principle of least privilege for personal and teacher spaces. Other
      // establishment roles keep their school-wide operational data.
      const normalizedRole = String(userRole || '').toLowerCase();
      const currentAppUser = enrichedUsers.find(isCurrentUserRow) || dbUser || req.user;
      const parentStudentReference = String(currentAppUser?.studentId || currentAppUser?.student_id || '').toLowerCase();
      const parentName = String(currentAppUser?.name || '').toLowerCase();
      const linkedParentStudents = selectPersonalStudents({ ...currentAppUser, schoolId: currentSchoolId, role: userRole }, enrichedStudents);
      const linkedStudentIds = new Set(linkedParentStudents.map((student: any) => String(student.id)));
      const linkedStudentReferences = new Set(linkedParentStudents.map((student: any) => String(student.studentId || student.matricule || '')));
      const linkedStudentNames = new Set(linkedParentStudents.map((student: any) => String(student.name || '').toLowerCase()));
      const linkedStudentUserIds = new Set(enrichedUsers
        .filter((user: any) => belongsToCurrentSchool(user) && /élève|eleve|student/i.test(String(user.role || '')) && (linkedParentStudents.some((s: any) => String(s.userId) === String(user.id)) || (!!user.studentId && linkedStudentReferences.has(String(user.studentId)))))
        .map((user: any) => String(user.id)));

      if (!isSuperAdmin && /parent|élève|eleve|student/.test(normalizedRole)) {
        const linkedClassIds = new Set(linkedParentStudents.map((student: any) => String(student.classId || student.class_id || '')));
        visibleUsers = enrichedUsers.filter((user: any) => belongsToCurrentSchool(user) && (isCurrentUserRow(user) || linkedStudentUserIds.has(String(user.id))));
        visibleStudents = linkedParentStudents;
        visiblePersonnel = [];
        visibleClasses = enrichedClasses.filter((schoolClass: any) => linkedClassIds.has(String(schoolClass.id)));
        visiblePayments = enrichedPayments.filter((payment: any) => linkedStudentIds.has(String(payment.studentId || payment.student_id || '')) || linkedStudentReferences.has(String(payment.studentId || payment.student_id || '')));
        visibleAttendance = allAttendance.filter((record: any) => linkedStudentIds.has(String(record.studentId || record.student_id || '')) || linkedStudentUserIds.has(String(record.studentId || record.student_id || '')));
        currentSchoolClassIds = new Set(visibleClasses.map((schoolClass: any) => String(schoolClass.id)));
        visibleGrades = allGrades.filter((grade: any) => linkedStudentIds.has(String(grade.studentId || grade.student_id || '')) || linkedStudentUserIds.has(String(grade.studentId || grade.student_id || '')));
        visibleFees = allFees.filter((fee: any) => currentSchoolClassIds.has(String(fee.classId || fee.class_id || '')));
        // Transactions do not carry a reliable student foreign key in the
        // legacy schema. Do not expose school cash records to a parent; the
        // parent dashboard derives its receipt list from that child's payments.
        visibleTransactions = [];
        visibleNotifications = allNotifications.filter((notification: any) => String(notification.userId || notification.user_id || '') === String(currentUserId || ''));
      } else if (!isSuperAdmin && /enseignant|professeur|teacher/.test(normalizedRole)) {
        const teacherIds = new Set([String(currentUserId || ''), String(currentAppUser?.id || ''), String(currentAppUser?.uid || '')]);
        visibleClasses = enrichedClasses.filter((schoolClass: any) => teacherIds.has(String(schoolClass.teacherId || schoolClass.teacher_id || '')));
        currentSchoolClassIds = new Set(visibleClasses.map((schoolClass: any) => String(schoolClass.id)));
        const teacherClassNames = new Set(visibleClasses.map((schoolClass: any) => String(schoolClass.name || '')));
        visibleStudents = enrichedStudents.filter((student: any) => currentSchoolClassIds.has(String(student.classId || student.class_id || '')) || teacherClassNames.has(String(student.class || '')));
        const teacherStudentIds = new Set(visibleStudents.map((student: any) => String(student.id)));
        visibleUsers = enrichedUsers.filter((user: any) =>
          isCurrentUserRow(user)
          || (
            /élève|eleve|student/i.test(String(user.role || ''))
            && (teacherClassNames.has(String(user.class || user.className || '')) || teacherStudentIds.has(String(user.id)))
          )
        );
        visibleAttendance = allAttendance.filter((record: any) => currentSchoolClassIds.has(String(record.classId || record.class_id || '')) || teacherStudentIds.has(String(record.studentId || record.student_id || '')));
        visibleGrades = allGrades.filter((grade: any) => currentSchoolClassIds.has(String(grade.classId || grade.class_id || '')) || teacherStudentIds.has(String(grade.studentId || grade.student_id || '')));
        visiblePersonnel = [];
        visiblePayments = [];
        visibleTransactions = [];
        visibleFees = [];
        visibleNotifications = allNotifications.filter((notification: any) => String(notification.userId || notification.user_id || '') === String(currentUserId || ''));
      }
      let visibleSubscriptions = isSuperAdmin ? allSubscriptions : allSubscriptions.filter(belongsToCurrentSchool);
      let visibleSubscriptionRequests = isSuperAdmin ? allSubscriptionRequests : allSubscriptionRequests.filter(belongsToCurrentSchool);

      if (!isSuperAdmin && (/parent|élève|eleve|student/.test(normalizedRole) || /enseignant|professeur|teacher/.test(normalizedRole))) {
        visibleSubscriptions = [];
        visibleSubscriptionRequests = [];
      }

      res.json({
        success: true,
        scope: isSuperAdmin ? 'global' : 'school',
        schools: visibleSchools,
        users: visibleUsers,
        students: visibleStudents,
        personnel: visiblePersonnel,
        classes: visibleClasses,
        payments: visiblePayments,
        transactions: visibleTransactions,
        attendance: visibleAttendance,
        fees: visibleFees,
        grades: visibleGrades,
        notifications: visibleNotifications,
        subscriptions: visibleSubscriptions,
        subscriptionRequests: visibleSubscriptionRequests
      });
    } catch (error: any) {
      console.error('Admin Export Data Fetch Error:', error);
      res.status(500).json({ error: error.message || 'Erreur lors du chargement des données.' });
    }
  });

  // Admin: Delete School from DB permanently
  app.delete('/api/schools/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      if (dbUser?.role !== 'Admin' && dbUser?.role !== 'Co-admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

      const schoolId = Number(req.params.id);
      if (!schoolId || isNaN(schoolId)) {
        return res.status(400).json({ error: 'Identifiant d\'établissement invalide.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const tableOrder = [
          'survey_responses',
          'surveys',
          'subscription_requests',
          'subscriptions',
          'notifications',
          'timetable',
          'attendance',
          'grades',
          'subjects',
          'payments',
          'transactions',
          'students',
          'personnel',
          'classes',
          'users',
        ];
        for (const table of tableOrder) {
          await deleteSupabaseBySchool(supabaseAdmin, table, schoolId);
        }
        await supabaseAdmin.from('schools').delete().eq('id', schoolId).throwOnError();
        return res.json({ success: true, message: 'Établissement et toutes ses données supprimés définitivement de Supabase.' });
      }

      // 1. Delete associated subscriptions, students, payments, transactions, personnel, classes, users
      await db.delete(subscriptions).where(eq(subscriptions.schoolId, schoolId));
      await db.delete(subscriptionRequests).where(eq(subscriptionRequests.schoolId, schoolId));
      await db.delete(payments).where(eq(payments.schoolId, schoolId));
      await db.delete(transactions).where(eq(transactions.schoolId, schoolId));
      await db.delete(students).where(eq(students.schoolId, schoolId));
      await db.delete(personnel).where(eq(personnel.schoolId, schoolId));
      await db.delete(classes).where(eq(classes.schoolId, schoolId));
      await db.delete(users).where(eq(users.schoolId, schoolId));

      // 2. Delete the school record itself
      await db.delete(schools).where(eq(schools.id, schoolId));

      res.json({ success: true, message: 'Établissement et toutes ses données supprimés définitivement de la base de données.' });
    } catch (error: any) {
      console.error('Delete School Error:', error);
      res.status(500).json({ error: error.message || 'Erreur lors de la suppression de l\'établissement.' });
    }
  });

  // ==========================================
  // PARENT SURVEYS & POLLING ENDPOINTS (Direction)
  // ==========================================
  app.get('/api/surveys', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      const schoolId = dbUser?.schoolId;
      const supabaseAdmin = getSupabaseAdmin(req);

      let surveyList;
      if (supabaseAdmin) {
        let query = supabaseAdmin.from('surveys').select('*');
        if (schoolId) query = query.eq('school_id', schoolId);
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        surveyList = (data || []).map(mapSupabaseSurvey).filter(Boolean);
      } else if (schoolId) {
        surveyList = await db.select().from(surveys).where(eq(surveys.schoolId, schoolId)).orderBy(desc(surveys.createdAt));
      } else {
        surveyList = await db.select().from(surveys).orderBy(desc(surveys.createdAt));
      }

      // Fetch response counts
      const allResponses = supabaseAdmin
        ? (await getSupabaseRows(supabaseAdmin, 'survey_responses')).map(mapSupabaseSurveyResponse).filter(Boolean)
        : await db.select().from(surveyResponses);
      const surveysWithStats = surveyList.map(s => {
        const responses = allResponses.filter(r => r.surveyId === s.id);
        return {
          ...s,
          responsesCount: responses.length,
          latestResponseAt: responses.length > 0 ? responses[responses.length - 1].submittedAt : null,
        };
      });

      res.json({ success: true, surveys: surveysWithStats });
    } catch (error: any) {
      console.error('Surveys Fetch Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/surveys/create', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getRequestUser(req);
      const { title, description, category, targetAudience, deadline, questions } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Le titre du sondage est requis.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      let newSurvey: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('surveys').insert([{
          school_id: dbUser?.schoolId || null,
          title,
          description: description || '',
          category: category || 'Activités parascolaires',
          target_audience: targetAudience || 'all',
          deadline: deadline ? new Date(deadline).toISOString() : null,
          questions: questions || [],
          creator_name: dbUser?.name || 'Direction',
          creator_role: dbUser?.role || 'Promoteur',
          status: 'active',
        }]).select('*').single();
        if (error) throw error;
        newSurvey = mapSupabaseSurvey(data);
      } else {
        [newSurvey] = await db.insert(surveys).values({
          schoolId: dbUser?.schoolId || null,
          title,
          description: description || '',
          category: category || 'Activités parascolaires',
          targetAudience: targetAudience || 'all',
          deadline: deadline ? new Date(deadline) : null,
          questions: questions || [],
          creatorName: dbUser?.name || 'Direction',
          creatorRole: dbUser?.role || 'Promoteur',
          status: 'active',
        }).returning();
      }

      // Add notification for direction
      if (dbUser?.id) {
        if (supabaseAdmin) {
          await supabaseAdmin.from('notifications').insert([{
            user_id: dbUser.id,
            title: `Nouveau sondage créé : ${title}`,
            message: `Le sondage est prêt à être partagé aux parents d'élèves par WhatsApp ou E-mail.`,
            type: 'Information',
            is_read: false,
          }]).throwOnError();
        } else {
          await db.insert(notifications).values({
            userId: dbUser.id,
            title: `Nouveau sondage créé : ${title}`,
            message: `Le sondage est prêt à être partagé aux parents d'élèves par WhatsApp ou E-mail.`,
            type: 'Information',
          });
        }
      }

      res.json({ success: true, survey: newSurvey });
    } catch (error: any) {
      console.error('Survey Creation Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/surveys/:id/respond', requireAuth, rateLimit('survey-response', 20, 60 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const surveyId = Number(req.params.id);
      if (!Number.isSafeInteger(surveyId) || surveyId <= 0) {
        return res.status(400).json({ error: 'Sondage invalide.' });
      }
      const actor = await getRequestUser(req);
      const client = getSupabaseAdmin(req);
      if (!actor || !client || !actor.schoolId) {
        return res.status(403).json({ error: 'Compte établissement requis pour répondre au sondage.' });
      }

      const { data: surveyRow, error: surveyError } = await client
        .from('surveys').select('id,school_id,status').eq('id', surveyId).maybeSingle();
      if (surveyError) throw surveyError;
      if (!surveyRow) return res.status(404).json({ error: 'Sondage introuvable.' });
      if (Number(surveyRow.school_id) !== Number(actor.schoolId)) {
        return res.status(403).json({ error: 'Ce sondage appartient à un autre établissement.' });
      }
      if (String(surveyRow.status || '').toLowerCase() === 'closed') {
        return res.status(409).json({ error: 'Ce sondage est clôturé.' });
      }

      const answers = req.body?.answers;
      const comment = String(req.body?.comment || '').slice(0, 4000);
      if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
        return res.status(400).json({ error: 'Réponses de sondage invalides.' });
      }

      const role = canonicalizeRole(actor.role);
      const isParent = /parent|tuteur/i.test(role);
      const parentName = isParent ? String(actor.name || 'Parent/Tuteur') : String(actor.name || 'Utilisateur EDUCO');
      const parentPhone = isParent ? String(actor.phone || actor.contact || '') : '';
      const parentEmail = isParent ? normalizeEmail(actor.email) : '';
      let studentName = '';
      let studentClass = '';

      if (isParent) {
        const { data: linkedStudent, error: linkedStudentError } = await client
          .from('students')
          .select('name,class,student_id')
          .eq('school_id', Number(actor.schoolId))
          .or(`parent_email.eq.${parentEmail},parent_phone.eq.${parentPhone}`)
          .limit(1)
          .maybeSingle();
        if (linkedStudentError) throw linkedStudentError;
        studentName = String(linkedStudent?.name || '');
        studentClass = String(linkedStudent?.class || '');
      }

      const { data, error } = await client.from('survey_responses').insert([{
        survey_id: surveyId,
        parent_name: parentName,
        parent_phone: parentPhone,
        parent_email: parentEmail,
        student_name: studentName,
        student_class: studentClass,
        channel: 'educo',
        answers,
        comment,
      }]).select('*').single();
      if (error) throw error;

      return res.json({
        success: true,
        message: 'Votre participation au sondage a bien été enregistrée.',
        response: mapSupabaseSurveyResponse(data),
      });
    } catch (error: any) {
      console.error('Survey Response Error:', error);
      return res.status(500).json({ error: 'Impossible d’enregistrer la réponse au sondage.' });
    }
  });

  app.get('/api/surveys/:id/report', requireAuth, async (req: AuthRequest, res) => {
    try {
      const surveyId = Number(req.params.id);
      const supabaseAdmin = getSupabaseAdmin(req);
      let survey: any = null;
      let responses: any[] = [];
      if (supabaseAdmin) {
        const { data: sbSurvey, error: surveyError } = await supabaseAdmin.from('surveys').select('*').eq('id', surveyId).maybeSingle();
        if (surveyError) throw surveyError;
        survey = mapSupabaseSurvey(sbSurvey);
      } else {
        const surveyResult = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
        survey = surveyResult[0];
      }

      if (!survey) {
        return res.status(404).json({ error: 'Sondage introuvable.' });
      }

      if (supabaseAdmin) {
        const { data: sbResponses, error: responseError } = await supabaseAdmin
          .from('survey_responses')
          .select('*')
          .eq('survey_id', surveyId)
          .order('submitted_at', { ascending: false });
        if (responseError) throw responseError;
        responses = (sbResponses || []).map(mapSupabaseSurveyResponse).filter(Boolean);
      } else {
        responses = await db.select().from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId)).orderBy(desc(surveyResponses.submittedAt));
      }
      
      // Calculate breakdown metrics per question
      const questionsList = (survey.questions as any[]) || [];
      const analyticsPerQuestion = questionsList.map(q => {
        const questionId = q.id;
        const answerCounts: { [key: string]: number } = {};
        let numericSum = 0;
        let numericCount = 0;
        const openTexts: string[] = [];

        responses.forEach(r => {
          const rawAns = (r.answers as any)?.[questionId];
          if (rawAns !== undefined && rawAns !== null) {
            if (Array.isArray(rawAns)) {
              rawAns.forEach(item => {
                answerCounts[item] = (answerCounts[item] || 0) + 1;
              });
            } else if (typeof rawAns === 'number' || (!isNaN(Number(rawAns)) && q.type === 'rating')) {
              const val = Number(rawAns);
              numericSum += val;
              numericCount += 1;
              answerCounts[`${val} étoile(s)`] = (answerCounts[`${val} étoile(s)`] || 0) + 1;
            } else if (typeof rawAns === 'string') {
              answerCounts[rawAns] = (answerCounts[rawAns] || 0) + 1;
              if (q.type === 'text') openTexts.push(rawAns);
            }
          }
        });

        const totalAnswered = responses.filter(r => (r.answers as any)?.[questionId] !== undefined).length;

        return {
          questionId,
          questionText: q.text,
          type: q.type,
          options: q.options || [],
          totalAnswered,
          distribution: answerCounts,
          averageRating: numericCount > 0 ? (numericSum / numericCount).toFixed(1) : null,
          textResponses: openTexts,
        };
      });

      // Channel Breakdown
      const channelsBreakdown = responses.reduce((acc: any, r) => {
        const ch = r.channel || 'whatsapp';
        acc[ch] = (acc[ch] || 0) + 1;
        return acc;
      }, {});

      res.json({
        success: true,
        survey,
        totalResponses: responses.length,
        analytics: analyticsPerQuestion,
        channels: channelsBreakdown,
        responses: responses.slice(0, 100), // recent answers
      });
    } catch (error: any) {
      console.error('Survey Report Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  const surveyBroadcastRoleMap: Record<string, string[]> = {
    parents: ['Parent', 'Parent/Tuteur', 'Tuteur'],
    teachers: ['Enseignant', 'Teacher', 'Professeur', 'Directeur des Etudes', 'DE', 'Directeur du Primaire'],
    administration: ['Promoteur', 'Directeur Général', 'Directeur', 'Responsable des finances', 'RAF', 'Caissière', 'Secrétaire', 'Comptable'],
  };

  app.post('/api/surveys/:id/broadcast', requireAuth, async (req: AuthRequest, res) => {
    try {
      const surveyId = Number(req.params.id);
      const dbUser = await getRequestUser(req);
      const { channel, customMessage } = req.body; // 'whatsapp' | 'email' | 'all'
      const requestedAudience = String(req.body.audience || req.body.targetAudience || 'all').trim();
      
      const supabaseAdmin = getSupabaseAdmin(req);
      let survey: any = null;
      if (supabaseAdmin) {
        const { data: sbSurvey, error } = await supabaseAdmin.from('surveys').select('*').eq('id', surveyId).maybeSingle();
        if (error) throw error;
        survey = mapSupabaseSurvey(sbSurvey);
      } else {
        const surveyResult = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
        survey = surveyResult[0];
      }

      if (!survey) {
        return res.status(404).json({ error: 'Sondage introuvable.' });
      }

      const audience = requestedAudience === 'all'
        ? 'all'
        : surveyBroadcastRoleMap[requestedAudience]
        ? requestedAudience
        : String(survey.targetAudience || 'all');
      const schoolId = survey.schoolId || dbUser?.schoolId;
      const surveyUrl = `${req.protocol}://${req.get('host')}/?survey=${survey.id}`;
      const audienceLabel = audience === 'parents'
        ? 'parents et tuteurs'
        : audience === 'teachers'
        ? 'corps enseignant'
        : audience === 'administration'
        ? 'personnel administratif'
        : 'parents, enseignants et administration';

      const notificationTitle = `Sondage à compléter : ${survey.title}`;
      const notificationMessage = customMessage || survey.description || `Merci de participer au sondage "${survey.title}". Votre avis aide la direction à prendre une décision éclairée.`;
      const selectedRoles = audience === 'all'
        ? Array.from(new Set(Object.values(surveyBroadcastRoleMap).flat()))
        : surveyBroadcastRoleMap[audience] || [];

      let recipients: any[] = [];
      if (supabaseAdmin) {
        let usersQuery = supabaseAdmin
          .from('users')
          .select('id, email, name, role, school_id')
          .in('role', selectedRoles);
        if (schoolId) usersQuery = usersQuery.eq('school_id', Number(schoolId));
        const { data, error } = await usersQuery;
        if (error) throw error;
        recipients = data || [];

        const rows = recipients.map((user: any) => ({
          user_id: user.id,
          title: notificationTitle,
          message: notificationMessage,
          type: 'Sondage',
          is_read: false,
          link: `/?survey=${survey.id}`,
        }));
        if (rows.length > 0) {
          const { error: notificationError } = await supabaseAdmin.from('notifications').insert(rows);
          if (notificationError) throw notificationError;
        }
      } else {
        const schoolUsers = schoolId
          ? await db.select().from(users).where(eq(users.schoolId, Number(schoolId)))
          : await db.select().from(users);
        recipients = schoolUsers.filter((user: any) => selectedRoles.includes(String(user.role || '')));
        if (recipients.length > 0) {
          await db.insert(notifications).values(recipients.map((user: any) => ({
            userId: user.id,
            title: notificationTitle,
            message: notificationMessage,
            type: 'Sondage',
            link: `/?survey=${survey.id}`,
            isRead: false,
          })));
        }
      }

      const encodedMsg = encodeURIComponent(
        `🏫 *${survey.title}*\n\nChers membres de la communauté éducative,\n${notificationMessage}\n\n👉 *Participez directement ici :* ${surveyUrl}\n\n_Direction de l'Établissement_`
      );

      res.json({
        success: true,
        message: `Diffusion envoyée au public ${audienceLabel}.`,
        whatsappShareUrl: `https://api.whatsapp.com/send?text=${encodedMsg}`,
        sent: recipients.length,
        recipients: recipients.length,
        audience,
        channel: channel || 'all',
      });
    } catch (error: any) {
      console.error('Survey Broadcast Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Insights
  app.post('/api/ai/insights', requireAuth, async (req: AuthRequest, res) => {
    // Placeholder for AI insights logic
    res.json({ insights: "Les finances sont stables ce mois-ci." });
  });

  // Luna only receives a short, aggregated context supplied by the client.  It
  // never receives student names, contacts, credentials or raw accounting rows.
  app.post('/api/ai/chat', requireAuth, rateLimit('luna-chat', 30, 15 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const message = String(req.body?.message || req.body?.prompt || '').trim();
      if (!message || message.length > 2000) {
        return res.status(400).json({ success: false, error: 'La question Luna doit contenir entre 1 et 2 000 caractères.' });
      }

      const requestedModel = String(req.body?.model || 'gemini-2.5-flash');
      const usesGroq = requestedModel === 'groq-llama-3';
      const model = usesGroq
        ? 'openai/gpt-oss-20b'
        : requestedModel === 'gemini-1.5-pro'
          ? 'gemini-1.5-pro'
          : 'gemini-2.5-flash';
      const rawTemperature = Number(req.body?.temperature);
      const temperature = Number.isFinite(rawTemperature) ? Math.min(1, Math.max(0, rawTemperature)) : 0.4;
      const rawContext = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
      const context = Object.entries(rawContext)
        .filter(([key, value]) => /^[a-zA-ZÀ-ÿ0-9_ -]{1,48}$/.test(key) && ['string', 'number', 'boolean'].includes(typeof value))
        .slice(0, 12)
        .map(([key, value]) => `${key}: ${String(value).slice(0, 160)}`)
        .join('\n');

      const apiKey = usesGroq ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(503).json({ success: false, code: 'AI_NOT_CONFIGURED', error: `Luna n’est pas encore reliée à ${usesGroq ? 'Groq' : 'Gemini'}.` });
      }

      const prompt = [
        'Tu es Luna, l’assistante EDUCO d’une plateforme de gestion scolaire.',
        'Réponds exclusivement en français, clairement et de manière concise.',
        'N’invente aucune donnée. Ne demande ni ne révèle de mots de passe, tokens, données personnelles d’élèves ou informations bancaires.',
        'Tu peux expliquer, résumer les indicateurs agrégés fournis et guider vers les écrans. Tu ne peux pas exécuter une action à la place de l’utilisateur.',
        context ? `Contexte agrégé autorisé:\n${context}` : '',
        `Question de l’utilisateur: ${message}`,
      ].filter(Boolean).join('\n\n');
      const reply = usesGroq
        ? String((await new Groq({ apiKey }).chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            max_tokens: 500,
          })).choices[0]?.message?.content || '').trim()
        : String((await new GoogleGenAI({ apiKey }).models.generateContent({
            model,
            contents: prompt,
            config: { temperature, maxOutputTokens: 500 },
          })).text || '').trim();
      if (!reply) throw new Error('Réponse IA vide.');
      return res.json({ success: true, reply, provider: usesGroq ? 'groq' : 'gemini', model });
    } catch (error: any) {
      console.error('Luna AI Error:', error?.message || error);
      return res.status(502).json({ success: false, error: 'Luna ne peut pas répondre pour le moment.' });
    }
  });

  // Groq AI API Proxy
  app.post('/api/ai/groq/report', requireAuth, rateLimit('ai-report-groq', 20, 10 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const actor = await getRequestUser(req);
      if (!actor) return res.status(401).json({ error: 'Session requise.' });
      if (/parent|élève|eleve/i.test(canonicalizeRole(actor.role))) {
        return res.status(403).json({ error: 'Génération de rapport réservée au personnel autorisé.' });
      }
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt || prompt.length > 12000) return res.status(400).json({ error: 'Prompt de rapport invalide.' });
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'Service IA non configuré.' });

      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'openai/gpt-oss-20b',
      });
      return res.json({ text: completion.choices[0]?.message?.content || '' });
    } catch (error: any) {
      console.error('Groq API Error:', error);
      return res.status(502).json({ error: 'Service IA temporairement indisponible.' });
    }
  });

  // Gemini AI API Proxy
  // Gemini AI API Proxy
  app.post('/api/ai/gemini/report', requireAuth, rateLimit('ai-report-gemini', 20, 10 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const actor = await getRequestUser(req);
      if (!actor) return res.status(401).json({ error: 'Session requise.' });
      if (/parent|élève|eleve/i.test(canonicalizeRole(actor.role))) {
        return res.status(403).json({ error: 'Génération de rapport réservée au personnel autorisé.' });
      }
      const prompt = String(req.body?.prompt || '').trim();
      if (!prompt || prompt.length > 12000) return res.status(400).json({ error: 'Prompt de rapport invalide.' });
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(503).json({ error: 'Service IA non configuré.' });

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return res.json({ text: response.text });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      return res.status(502).json({ error: 'Service IA temporairement indisponible.' });
    }
  });


  // =========================================================================
  // AUTHENTICATION  // =========================================================================
  // AUTHENTICATION (Admin, Promoteur, Personnel, Parents)
  // =========================================================================
  const adminRoles = new Set(['Admin', 'Co-admin']);

  // Backward-compatible login endpoint. It uses the exact same authoritative
  // Supabase Auth boundary as /api/auth/login and never stores plaintext passwords.
  app.post('/api/users/login', rateLimit('legacy-login', 10, 60_000), async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email || req.body?.identifier);
      const password = String(req.body?.password || '');
      const isAdminPortal = Boolean(req.body?.isAdminPortal);

      if (!email || password.length < 4) {
        return res.status(400).json({ success: false, error: 'Identifiants invalides.' });
      }
      if (req.body?.isBiometric) {
        return res.status(400).json({
          success: false,
          error: 'La biométrie doit utiliser la vérification WebAuthn dédiée.'
        });
      }

      const authClient = getSupabaseAdmin();
      if (!authClient) {
        return res.status(503).json({ success: false, error: 'Service d’authentification indisponible.' });
      }

      const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });
      if (authError || !authData?.user?.id || !authData?.session?.access_token) {
        return res.status(401).json({ success: false, error: 'Identifiants invalides.' });
      }

      const { data: uidProfile, error: uidProfileError } = await authClient
        .from('users').select('*').eq('uid', authData.user.id).limit(1).maybeSingle();
      if (uidProfileError) throw uidProfileError;

      let resolvedProfile = uidProfile;
      if (!resolvedProfile) {
        const { data: emailProfile, error: emailProfileError } = await authClient
          .from('users').select('*').eq('email', email).limit(1).maybeSingle();
        if (emailProfileError) throw emailProfileError;
        resolvedProfile = emailProfile;
      }

      const user = mapSupabaseUser(resolvedProfile);
      if (!user) return res.status(401).json({ success: false, error: 'Profil EDUCO introuvable.' });
      if (String(user.status || '').toLowerCase() === 'inactif' || String(user.status || '').toLowerCase() === 'inactive') {
        return res.status(403).json({ success: false, error: 'Ce compte est inactif.' });
      }

      const isAdmin = adminRoles.has(user.role);
      if (isAdmin && !isAdminPortal) {
        return res.status(403).json({ success: false, error: 'Utilisez le portail d’administration dédié.' });
      }
      if (isAdminPortal && !isAdmin) {
        return res.status(403).json({ success: false, error: 'Ce portail est réservé aux administrateurs.' });
      }

      const token = createLocalSessionToken(user);
      if (!token) {
        return res.status(503).json({ success: false, error: 'Impossible de créer une session EDUCO sécurisée.' });
      }
      return res.json({ success: true, user, token });
    } catch (error: any) {
      console.error('Legacy-compatible secure login error:', error);
      return res.status(500).json({ success: false, error: 'Service d’authentification indisponible.' });
    }
  });

  // =========================================================================
  // ONE-TIME ADMIN BOOTSTRAP ENDPOINT. Co-admins are created later by this Admin.
  // =========================================================================
  app.post('/api/auth/register-admin', rateLimit('admin-bootstrap', 5, 60 * 60 * 1000), async (req, res) => {
    try {
      const { name, email, phone, password, securityKey } = req.body;
      const bootstrapSecret = String(process.env.ADMIN_BOOTSTRAP_SECRET || '');
      const suppliedSecret = String(securityKey || '');
      if (!bootstrapSecret || bootstrapSecret.length < 24) {
        return res.status(503).json({ error: 'Bootstrap Admin désactivé : secret serveur sécurisé non configuré.' });
      }
      const expected = Buffer.from(bootstrapSecret);
      const supplied = Buffer.from(suppliedSecret);
      if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
        return res.status(403).json({ error: 'Clé de bootstrap invalide.' });
      }
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Le nom, l\'adresse email et le mot de passe sont obligatoires.' });
      }

      const passwordError = getNewPasswordError(password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const cleanEmail = email.toLowerCase().trim();

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin || getSupabaseServerKeyRole(req) !== 'service_role') {
        return res.status(503).json({ error: 'Supabase service_role requis pour le bootstrap Admin.' });
      }
      let existingAdmins: any[] = [];
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('users').select('id,email,uid,role,created_at').eq('role', 'Admin').order('created_at', { ascending: true });
        if (error) throw error;
        existingAdmins = data || [];
      } else if (isDbConfigured()) {
        existingAdmins = await db.select().from(users).where(eq(users.role, 'Admin')).limit(1);
      }
      if (existingAdmins.length > 0) {
        return res.status(409).json({
          error: 'Le compte Admin unique existe déjà. Connectez-vous avec ce compte pour créer des Co-admins.'
        });
      }

      // Generate UID
      let userUid = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      let createdUser: any = null;

      // Attempt Supabase Admin Auth creation if configured
      if (supabaseAdmin) {
        const { data: existingEmail } = await supabaseAdmin.from('users').select('id').eq('email', cleanEmail).maybeSingle();
        if (existingEmail) return res.status(409).json({ error: 'Un compte utilise déjà cette adresse e-mail.' });
        const { data: sbUser, error: sbErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password: password,
          email_confirm: true,
          user_metadata: {
            name: name.trim(),
            role: 'Admin',
            contact: phone || '',
          }
        });
        if (sbErr || !sbUser.user) throw sbErr || new Error('Impossible de créer le compte Admin dans Supabase Auth.');
        userUid = sbUser.user.id;
        const { data: insertedAdmin, error: insertError } = await supabaseAdmin.from('users').insert([{
          uid: userUid,
          name: name.trim(),
          email: cleanEmail,
          role: 'Admin',
          school_id: null,
          status: 'active'
        }]).select('*').single();
        if (insertError) {
          await supabaseAdmin.auth.admin.deleteUser(userUid).catch(() => {});
          throw insertError;
        }
        createdUser = mapSupabaseUser(insertedAdmin);
      }

      // Save in DB users table
      if (!createdUser && isDbConfigured()) {
        try {
          const [newUser] = await db.insert(users).values({
            uid: userUid,
            name: name.trim(),
            email: cleanEmail,
            role: 'Admin',
            schoolId: 1,
            status: 'active',
          }).returning();
          createdUser = newUser;
        } catch (dbErr: any) {
          console.warn("Database insert admin error:", dbErr?.message);
        }
      }

      if (!createdUser) {
        return res.status(503).json({ error: 'Aucune base de données disponible pour enregistrer le compte Admin.' });
      }

      // Send Welcome email via Brevo
      try {
        sendWelcomeEmail({
          email: cleanEmail,
          name: name.trim(),
          role: 'Admin',
          schoolName: 'Administration Centrale EDUCO',
          schoolIdentifier: 'EDUCO-CENTRAL',
          tempPassword: password,
        }).catch(e => console.warn('Admin welcome email warning:', e));
      } catch (e) {}

      return res.json({
        success: true,
        message: 'Compte Administrateur créé avec succès ! Vous pouvez maintenant vous connecter.',
        user: createdUser,
      });
    } catch (error: any) {
      console.error('Register Admin Error:', error);
      res.status(500).json({ error: error.message || 'Erreur lors de la création du compte administrateur.' });
    }
  });

  app.post(['/api/admin/create-account', '/api/admin/register'], requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = (req.user?.role ? req.user : await getUserByUid(req.user!.uid));
      if (actor?.role !== 'Admin') {
        return res.status(403).json({ error: 'Seul le compte Admin unique peut créer un Co-admin.' });
      }
      const { name, email, phone, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nom, e-mail et mot de passe requis.' });
      }
      const passwordError = getNewPasswordError(password);
      if (passwordError) return res.status(400).json({ error: passwordError });
      const cleanEmail = String(email).toLowerCase().trim();
      const adminClient = getSupabaseAdmin(req);
      if (!adminClient) return res.status(503).json({ error: 'Supabase Admin est requis.' });
      const { data: existing } = await adminClient.from('users').select('id').eq('email', cleanEmail).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Un compte utilise déjà cette adresse e-mail.' });
      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        user_metadata: { name: String(name).trim(), role: 'Co-admin', contact: phone || '' }
      });
      if (authError || !authUser.user) throw authError || new Error('Création Auth impossible.');
      const { data: coAdmin, error: insertError } = await adminClient.from('users').insert([{
        uid: authUser.user.id,
        name: String(name).trim(),
        email: cleanEmail,
        role: 'Co-admin',
        school_id: actor.schoolId || null,
        status: 'active'
      }]).select('*').single();
      if (insertError) {
        await adminClient.auth.admin.deleteUser(authUser.user.id).catch(() => {});
        throw insertError;
      }
      return res.json({ success: true, message: 'Compte Co-admin créé par l’Admin.', user: mapSupabaseUser(coAdmin) });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || 'Erreur lors de la création du Co-admin.' });
    }
  });

  // =========================================================================
  // BREVO TRANSACTIONAL EMAIL ENDPOINTS (OTP, BIENVENUE, RESET, ALERTES)
  // =========================================================================

  // 1. Send OTP Code Email (supports templateId with {{params.otpCode}} & responsive HTML)
  app.post(['/api/email/send-otp', '/api/auth/send-otp', '/api/otp/send', '/api/send-otp'], rateLimit('otp-send', 5, 10 * 60 * 1000), async (req, res) => {
    try {
      const { email, name, purpose, templateId, customApiKey } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Une adresse e-mail valide est requise." });
      }

      const otpCode = otpManager.generateOtp(email, purpose || 'general', { name });
      
      const emailResult = await sendOtpEmail({
        email,
        name: name || email.split('@')[0],
        otpCode,
        purpose: purpose || 'school_registration',
        templateId: templateId || null,
      });

      if (!emailResult.success) {
        console.warn(`[OTP Notification] Brevo status notice: ${emailResult.error}. Local OTP code generated: ${otpCode}`);
        return res.status(502).json({
          success: false,
          error: emailResult.error || "Impossible d'envoyer le code OTP par e-mail.",
          messageId: `otp_${Date.now()}`,
          mode: emailResult.mode || 'brevo_live',
          expiresInSeconds: 600,
        });
      }

      res.json({
        success: true,
        message: "Code de vérification OTP envoyé avec succès.",
        messageId: emailResult.messageId,
        mode: emailResult.mode,
        expiresInSeconds: 600,
      });
    } catch (error: any) {
      console.error("Send OTP Error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Erreur lors de l'envoi du code OTP.",
        mode: 'brevo_live',
        expiresInSeconds: 600
      });
    }
  });

  // 2. Verify OTP Code
  app.post(['/api/email/verify-otp', '/api/auth/verify-otp', '/api/otp/verify', '/api/verify-otp'], rateLimit('otp-verify', 10, 10 * 60 * 1000), async (req, res) => {
    try {
      const { email, otpCode, purpose } = req.body;
      if (!email || !otpCode) {
        return res.status(400).json({ error: "Adresse email et code OTP requis." });
      }

      const verification = otpManager.verifyOtp(email, otpCode, purpose);
      if (!verification.valid) {
        return res.status(400).json({ error: verification.error || "Code OTP invalide ou expiré." });
      }

      res.json({
        success: true,
        verified: true,
        message: "Code OTP validé avec succès."
      });
    } catch (error: any) {
      console.error("Verify OTP Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la validation de l'OTP" });
    }
  });

  // Sensitive profile changes are confirmed server-side. The browser cannot
  // bypass this flow by calling the generic user-management endpoint.
  app.post('/api/profile/request-otp', requireAuth, rateLimit('profile-otp', 5, 10 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const actor = await getRequestUser(req);
      const email = normalizeEmail(actor?.email);
      if (!email) return res.status(400).json({ error: 'Adresse e-mail du compte introuvable.' });
      const otpCode = otpManager.generateOtp(email, 'profile_update' as any, { userId: actor.id });
      const delivery = await sendOtpEmail({ email, name: actor.name, otpCode, purpose: 'general' as any });
      if (!delivery.success) return res.status(503).json({ error: delivery.error || 'Impossible d’envoyer le code OTP.' });
      return res.json({ success: true, expiresInSeconds: 600 });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Demande OTP impossible.' });
    }
  });

  app.put('/api/profile', requireAuth, rateLimit('profile-update', 10, 10 * 60 * 1000), async (req: AuthRequest, res) => {
    try {
      const actor = await getRequestUser(req);
      const actorEmail = normalizeEmail(actor?.email);
      if (!actorEmail || !req.body?.otpCode) return res.status(400).json({ error: 'Code OTP requis.' });
      const verification = otpManager.verifyOtp(actorEmail, String(req.body.otpCode), 'profile_update' as any);
      if (!verification.valid) return res.status(400).json({ error: verification.error || 'Code OTP invalide ou expiré.' });
      const name = String(req.body.name || '').trim();
      const email = normalizeEmail(req.body.email);
      const phone = req.body.phone == null ? undefined : String(req.body.phone).trim();
      const avatar = req.body.avatar == null ? undefined : String(req.body.avatar);
      if (!name || !email) return res.status(400).json({ error: 'Nom et adresse e-mail valides requis.' });
      const client = getSupabaseAdmin(req);
      if (!client || !actor?.id) return res.status(503).json({ error: 'Service de profil indisponible.' });
      if (email !== actorEmail) {
        const duplicate = await ensureUniqueUserEmail({ req, email, excludeUserId: Number(actor.id) });
        if (duplicate) return res.status(409).json({ error: buildDuplicateEmailMessage(email) });
        if (actor.uid) {
          const { error: authError } = await client.auth.admin.updateUserById(actor.uid, { email, email_confirm: true });
          if (authError) throw authError;
        }
      }
      const { data, error } = await client.from('users').update({ name, email, ...(phone !== undefined && { phone }), ...(avatar !== undefined && { avatar }) }).eq('id', actor.id).select('*').single();
      if (error) throw error;
      await writeFinancialAudit(req, { action: 'profile_updated', entityType: 'user', entityId: actor.id, oldValues: { name: actor.name, email: actorEmail }, newValues: { name, email } });
      return res.json({ success: true, user: mapSupabaseUser(data) });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Mise à jour du profil impossible.' });
    }
  });

  // 3. Send Welcome Email
  app.post('/api/email/send-welcome', requireAuth, async (req: AuthRequest, res) => {
    try {
      const actor = await getRequestUser(req);
      const actorRole = canonicalizeRole(actor?.role);
      if (!['Admin','Co-admin','Promoteur','Directeur Général','Directeur des Etudes'].includes(actorRole)) {
        return res.status(403).json({ error: 'Envoi de bienvenue non autorisé pour ce compte.' });
      }
      const { 
        email, name, role, schoolName, schoolIdentifier, 
        tempPassword, loginUrl, templateId
      } = req.body;

      if (!email || !schoolName || !schoolIdentifier) {
        return res.status(400).json({ error: "Email, nom d'établissement et matricule requis." });
      }

      const emailResult = await sendWelcomeEmail({
        email,
        name,
        role: role || 'Promoteur',
        schoolName,
        schoolIdentifier,
        tempPassword,
        loginUrl: loginUrl || `${getPublicAppUrl(req)}/?login=1`,
        templateId: templateId || null,
        customApiKey,
      });

      res.json({
        success: emailResult.success,
        messageId: emailResult.messageId,
        mode: emailResult.mode,
        error: emailResult.error
      });
    } catch (error: any) {
      console.error("Send Welcome Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de l'envoi du mail de bienvenue" });
    }
  });

  // 4. Send Password Reset OTP Email
  app.post('/api/email/send-reset-password', rateLimit('password-reset-email', 5, 15 * 60 * 1000), async (req, res) => {
    try {
      const { email, templateId, customApiKey, adminOnly } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Adresse email valide requise." });
      }
      const cleanEmail = String(email).toLowerCase().trim();

      if (adminOnly) {
        let account: any = null;
        const supabaseAdmin = getSupabaseAdmin(req);
        if (supabaseAdmin) {
          const { data, error } = await supabaseAdmin
            .from('users')
            .select('id,role')
            .eq('email', cleanEmail)
            .maybeSingle();
          if (error) throw error;
          account = data;
        } else if (isDbConfigured()) {
          const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
          account = found[0] || null;
        }
        if (!account || !adminRoles.has(account.role)) {
          return res.status(404).json({ error: 'Aucun compte administrateur habilité ne correspond à cette adresse e-mail.' });
        }
      }

      // Generate a 6-digit reset OTP
      const resetCode = otpManager.generateOtp(cleanEmail, 'password_reset');
      const resetChallenge = createPasswordResetChallenge(cleanEmail, resetCode);
      
      const emailResult = await sendPasswordResetEmail({
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        resetCode,
        resetUrl: `${getPublicAppUrl(req)}/?resetEmail=${encodeURIComponent(cleanEmail)}`,
        templateId: templateId || null,
        customApiKey,
      });

      res.json({
        success: emailResult.success,
        message: "Instructions de réinitialisation et code OTP envoyés par email.",
        messageId: emailResult.messageId,
        mode: emailResult.mode,
        // Allows verification after a Render restart without exposing the OTP.
        resetChallenge,
        });
    } catch (error: any) {
      console.error("Send Password Reset Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la demande de réinitialisation" });
    }
  });

  // 5. Confirm Password Reset with OTP & Update
  app.post('/api/email/confirm-reset-password', rateLimit('password-reset-confirm', 10, 15 * 60 * 1000), async (req, res) => {
    try {
      const { email, otpCode, newPassword, resetChallenge } = req.body;
      if (!email || !otpCode || !newPassword) {
        return res.status(400).json({ error: "Email, code OTP et nouveau mot de passe requis." });
      }

      const passwordError = getNewPasswordError(newPassword);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }

      const cleanEmail = String(email).toLowerCase().trim();
      const challengeValid = verifyPasswordResetChallenge(resetChallenge, cleanEmail, String(otpCode));
      if (!challengeValid) {
        // Backward compatibility for an OTP issued before this version.
        const verification = otpManager.verifyOtp(cleanEmail, otpCode, 'password_reset');
        if (!verification.valid) {
          return res.status(400).json({ error: verification.error || "Code OTP invalide ou expiré." });
        }
      }

      const adminClient = getSupabaseAdmin(req);
      if (!adminClient) {
        return res.status(503).json({ error: "Le service Supabase de réinitialisation est indisponible." });
      }

      const { data: profile, error: profileError } = await adminClient
        .from('users')
        .select('uid')
        .eq('email', cleanEmail)
        .maybeSingle();
      if (profileError || !profile?.uid) {
        return res.status(404).json({ error: "Compte utilisateur introuvable pour cette adresse e-mail." });
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(profile.uid, {
        password: newPassword
      });
      if (updateError) {
        console.error("Failed to update password in Supabase Auth:", updateError.message);
        return res.status(502).json({ error: "Impossible de modifier le mot de passe dans Supabase Auth." });
      }

      res.json({
        success: true,
        message: "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter."
      });
    } catch (error: any) {
      console.error("Confirm Password Reset Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la réinitialisation" });
    }
  });

  // 6. Get Transactional Email Audit Logs (Brevo API + Dispatched History)
  app.get('/api/email/logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const platformAdmin = await requirePlatformAdmin(req, res);
      if (!platformAdmin) return;
      const logsResult = await getBrevoEmailLogs();
      res.json(logsResult);
    } catch (error: any) {
      console.error("Get Email Logs Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la récupération des journaux d'email" });
    }
  });

  // 7. Verify Sender Email Address Validation in Brevo Senders Dashboard
  app.get('/api/email/senders', requireAuth, async (req: AuthRequest, res) => {
    try {
      const platformAdmin = await requirePlatformAdmin(req, res);
      if (!platformAdmin) return;
      const sendersResult = await getBrevoSenders();
      res.json(sendersResult);
    } catch (error: any) {
      console.error("Get Brevo Senders Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la vérification de l'expéditeur Brevo" });
    }
  });

  // 8. Test Brevo API Connection & Send Test Transactional Email
  app.post('/api/email/test-brevo', requireAuth, async (req: AuthRequest, res) => {
    try {
      const platformAdmin = await requirePlatformAdmin(req, res);
      if (!platformAdmin) return;
      const { senderEmail, senderName, toEmail, templateId } = req.body || {};
      const targetApiKey = process.env.BREVO_API_KEY;
      
      // Step A: Interrogate Brevo API (/v3/account) to verify key & connectivity
      const keyCheck = await checkBrevoApiKey(targetApiKey);
      
      if (!keyCheck.apiKeyValid) {
        return res.status(401).json({
          success: false,
          apiKeyConfigured: keyCheck.apiKeyConfigured,
          apiKeyValid: false,
          keyCheck,
          error: keyCheck.error || "Clé BREVO_API_KEY invalide ou non autorisée par l'API Brevo.",
          details: "Veuillez vérifier votre clé API dans les variables d'environnement ou les paramètres d'administration."
        });
      }

      // If toEmail is not specified, return key verification and account details
      if (!toEmail || typeof toEmail !== 'string' || !toEmail.includes('@')) {
        return res.json({
          success: true,
          apiKeyConfigured: true,
          apiKeyValid: true,
          keyCheck,
          accountEmail: keyCheck.accountEmail,
          companyName: keyCheck.companyName,
          message: `Connectivité Brevo validée avec succès ! Compte associé : ${keyCheck.accountEmail || keyCheck.companyName || 'Actif'}`,
          infrastructureReady: true
        });
      }

      // Step B: Send test transactional email if a destination email address is provided
      const testResult = await sendBrevoEmail({
        apiKey: targetApiKey,
        sender: senderEmail ? { email: senderEmail, name: senderName || "EDUCO Test" } : undefined,
        to: [{ email: toEmail.trim(), name: "Destinataire Test" }],
        subject: `[TEST BREVO] Vérification de connexion transactionnelle EDUCO (${new Date().toLocaleTimeString('fr-FR')})`,
        templateId: templateId ? Number(templateId) : null,
        params: {
          otpCode: "948271",
          userName: "Testeur Brevo",
          schoolName: "Complexe Scolaire EDUCO",
          testDate: new Date().toISOString(),
        },
        htmlContent: `
          <div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 12px; max-width: 500px; margin: auto; border: 1px solid #e2e8f0;">
            <h2 style="color: #1F4A59; margin-top: 0;">🎉 Test de Connexion Brevo Réussi !</h2>
            <p style="color: #334155; font-size: 14px;">Cet email confirme que votre clé API Brevo et vos paramètres d'expédition sont correctement configurés sur la plateforme EDUCO.</p>
            <div style="background-color: #f1f5f9; padding: 12px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Code OTP test :</strong> <span style="font-family: monospace; font-size: 18px; font-weight: bold; color: #1F4A59; margin-left: 8px;">948271</span></p>
            </div>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">Horodatage : ${new Date().toLocaleString('fr-FR')}</p>
          </div>
        `,
        tags: ['test', 'diagnostic'],
      });

      if (!testResult.success) {
        return res.status(testResult.status || 400).json({
          success: false,
          keyCheck,
          error: testResult.error || "Échec de l'envoi de l'e-mail de test Brevo",
          details: testResult.details
        });
      }

      return res.json({
        success: true,
        keyCheck,
        accountEmail: keyCheck.accountEmail,
        companyName: keyCheck.companyName,
        message: "Email de test Brevo transmis avec succès !",
        messageId: testResult.messageId,
        mode: testResult.mode,
        details: testResult.details,
        infrastructureReady: true
      });
    } catch (error: any) {
      console.error("Test Brevo Error:", error);
      return res.status(500).json({ 
        success: false,
        error: error.message || "Erreur lors du test de connectivité Brevo",
        details: error.stack || null
      });
    }
  });

  // 9. Bulk Broadcast Messaging via Configured Brevo Service (Email / SMS / WhatsApp)
  app.post('/api/messaging/brevo-bulk', requireAuth, async (req: AuthRequest, res) => {
    try {
      const platformAdmin = await requirePlatformAdmin(req, res);
      if (!platformAdmin) return;
      const { 
        recipients, 
        channel = 'email', 
        subject, 
        message, 
        schoolName, 
        senderName, 
        senderEmail 
      } = req.body || {};

      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Aucun destinataire sélectionné pour l'envoi groupé." 
        });
      }

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: "Le corps du message ne peut pas être vide." 
        });
      }

      const campaignResult = await sendBulkBrevoCampaign({
        channel,
        recipients,
        subject: subject || `Communication Administrative - ${schoolName || 'Établissement'}`,
        messageTemplate: message,
        schoolName: schoolName || 'EDUCO Établissement Scolaire',
        senderName,
        senderEmail
      });

      return res.json({
        success: true,
        ...campaignResult,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Brevo Bulk Messaging Error:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Erreur lors de l'exécution de la campagne de messagerie Brevo",
        details: error.stack || null
      });
    }
  });

  app.post('/api/parent-receipts/send', requireAuth, rateLimit('parent-receipt-send', 30, 10 * 60 * 1000), async (req: AuthRequest, res) => {
    const normalizeWhatsAppPhone = (phone?: string) => {
      const digits = String(phone || '').replace(/\D/g, '');
      if (!digits) return '';
      if (digits.startsWith('00')) return digits.slice(2);
      if (digits.startsWith('0') && digits.length >= 9) return `242${digits.slice(1)}`;
      return digits;
    };

    const sendWhatsAppDocument = async (params: {
      to: string;
      message: string;
      filename: string;
      pdfBase64?: string;
    }) => {
      const accessToken = process.env.WHATSAPP_BUSINESS_TOKEN
        || process.env.WHATSAPP_ACCESS_TOKEN
        || process.env.META_WHATSAPP_TOKEN
        || '';
      const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
        || process.env.META_WHATSAPP_PHONE_NUMBER_ID
        || '';
      const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';

      if (!accessToken || !phoneNumberId) {
        return {
          success: false,
          channel: 'whatsapp',
          error: 'WHATSAPP_BUSINESS_TOKEN/WHATSAPP_PHONE_NUMBER_ID non configurés.'
        };
      }

      const cleanTo = normalizeWhatsAppPhone(params.to);
      if (!cleanTo) {
        return { success: false, channel: 'whatsapp', error: 'Numéro WhatsApp parent invalide ou manquant.' };
      }

      let mediaId = '';
      if (params.pdfBase64) {
        const pdfBuffer = Buffer.from(params.pdfBase64, 'base64');
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }), params.filename);

        const mediaRes = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/media`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: form as any,
        });
        const mediaData: any = await mediaRes.json().catch(() => ({}));
        if (!mediaRes.ok || !mediaData?.id) {
          return {
            success: false,
            channel: 'whatsapp',
            status: mediaRes.status,
            error: mediaData?.error?.message || mediaData?.message || `Échec upload média WhatsApp (${mediaRes.status}).`,
            details: mediaData,
          };
        }
        mediaId = mediaData.id;
      }

      const messageBody: any = mediaId
        ? {
            messaging_product: 'whatsapp',
            to: cleanTo,
            type: 'document',
            document: {
              id: mediaId,
              filename: params.filename,
              caption: params.message.slice(0, 1024),
            },
          }
        : {
            messaging_product: 'whatsapp',
            to: cleanTo,
            type: 'text',
            text: { preview_url: false, body: params.message },
          };

      const msgRes = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageBody),
      });
      const msgData: any = await msgRes.json().catch(() => ({}));

      if (!msgRes.ok) {
        return {
          success: false,
          channel: 'whatsapp',
          status: msgRes.status,
          error: msgData?.error?.message || msgData?.message || `Échec envoi WhatsApp (${msgRes.status}).`,
          details: msgData,
        };
      }

      return {
        success: true,
        channel: 'whatsapp',
        messageId: msgData?.messages?.[0]?.id || mediaId || `wa_${Date.now()}`,
        details: msgData,
      };
    };

    try {
      const actor = await getRequestUser(req);
      const role = canonicalizeRole(actor?.role);
      const allowedRoles = new Set(['Promoteur','Directeur Général','Responsable des finances','Caissière']);
      if (!actor?.schoolId || !allowedRoles.has(role)) {
        return res.status(403).json({ success: false, error: 'Envoi de reçu non autorisé pour ce compte.' });
      }

      const client = getSupabaseAdmin(req);
      if (!client) return res.status(503).json({ success: false, error: 'Service de données indisponible.' });

      const recipient = req.body?.recipient || {};
      const requestedEmail = normalizeEmail(recipient.email || recipient.parentEmail);
      const requestedPhone = normalizePhoneIdentity(recipient.phone || recipient.parentPhone);
      if (!requestedEmail && !requestedPhone) {
        return res.status(400).json({ success: false, error: 'Parent destinataire requis.' });
      }

      const { data: school, error: schoolError } = await client
        .from('schools').select('id,name').eq('id', Number(actor.schoolId)).maybeSingle();
      if (schoolError) throw schoolError;
      if (!school) return res.status(404).json({ success: false, error: 'Établissement introuvable.' });

      const { data: studentsRows, error: studentsError } = await client
        .from('students')
        .select('id,name,parent_name,parent_email,parent_phone')
        .eq('school_id', Number(actor.schoolId))
        .limit(1000);
      if (studentsError) throw studentsError;

      const linkedStudent = (studentsRows || []).find((student: any) => {
        const emailMatch = requestedEmail && normalizeEmail(student.parent_email) === requestedEmail;
        const phoneMatch = requestedPhone && normalizePhoneIdentity(student.parent_phone) === requestedPhone;
        return Boolean(emailMatch || phoneMatch);
      });
      if (!linkedStudent) {
        return res.status(403).json({ success: false, error: 'Ce destinataire n’est pas rattaché à un élève de votre établissement.' });
      }

      const message = String(req.body?.message || '').trim();
      const subject = String(req.body?.subject || '').trim();
      const pdfBase64 = req.body?.pdfBase64 ? String(req.body.pdfBase64) : '';
      const filename = String(req.body?.filename || ('recu-parent-' + Date.now() + '.pdf'))
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .slice(0, 120);
      if (!message || message.length > 5000) {
        return res.status(400).json({ success: false, error: 'Message de reçu invalide.' });
      }
      if (pdfBase64 && pdfBase64.length > 12 * 1024 * 1024) {
        return res.status(413).json({ success: false, error: 'Reçu PDF trop volumineux.' });
      }

      const parentPhone = String(linkedStudent.parent_phone || '');
      const parentEmail = normalizeEmail(linkedStudent.parent_email);
      const parentName = String(linkedStudent.parent_name || 'Parent/Tuteur');

      const whatsappResult = parentPhone
        ? await sendWhatsAppDocument({ to: parentPhone, message, filename, pdfBase64: pdfBase64 || undefined })
        : { success: false, channel: 'whatsapp', error: 'Aucun numéro WhatsApp parent enregistré.' };

      let emailResult: any = null;
      if (!whatsappResult.success && parentEmail) {
        emailResult = await sendBrevoEmail({
          to: [{ email: parentEmail, name: parentName }],
          subject: subject || `Reçu de paiement - ${school.name || 'EDUCO'}`,
          htmlContent: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
              <h2 style="color:#1F4A59">Reçu de paiement</h2>
              <p>Bonjour <strong>${escapeHtml(parentName)}</strong>,</p>
              <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
              <p>Le reçu PDF est joint à ce message.</p>
            </div>
          `,
          attachment: pdfBase64 ? [{ name: filename, content: pdfBase64 }] : undefined,
          tags: ['parent-receipt', 'payment'],
        });
      }

      return res.json({
        success: whatsappResult.success || Boolean(emailResult?.success),
        whatsapp: whatsappResult,
        email: emailResult,
        fallbackUsed: !whatsappResult.success && Boolean(emailResult?.success),
      });
    } catch (error: any) {
      console.error('Parent receipt delivery error:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l’envoi du reçu parent.',
      });
    }
  });

  // Anti-cache middleware for HTML, Service Worker, and Manifest to guarantee fresh updates
  app.use((req, res, next) => {
    const url = req.path || '';
    if (url === '/' || url.endsWith('.html') || url === '/sw.js' || url === '/manifest.json') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    next();
  });

  // Vite middleware setup
  if (!isProductionServer) {
    const hmrPort = await findAvailablePort(Number(process.env.VITE_HMR_PORT || 24678));
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { port: hmrPort },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = fs.existsSync(path.join(process.cwd(), 'dist'))
      ? path.join(process.cwd(), 'dist')
      : __dirname;
    app.use(express.static(distPath, {
      etag: true,
      lastModified: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        }
      }
    }));
    app.get('*all', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Educo Server running on http://0.0.0.0:${PORT}`);
    console.log(`Local URL: http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});

