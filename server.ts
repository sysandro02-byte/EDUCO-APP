import express from 'express';
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
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser, getUserByUid } from './src/db/users.ts';
import { createClient } from '@supabase/supabase-js';

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

const getSupabaseServerKey = (req?: any) => (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  (req?.headers?.['x-supabase-key'] as string)
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

const mapSupabaseUser = (user: any) => user ? ({
  id: user.id,
  uid: user.uid,
  schoolId: user.school_id || user.schoolId,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
  status: user.status,
  studentId: user.student_id || user.studentId || user.matricule,
  parentName: user.parent_name || user.parentName,
  parentEmail: user.parent_email || user.parentEmail,
  createdAt: user.created_at || user.createdAt,
}) : null;

const getSupabaseAdmin = (req?: any) => {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || (req?.headers?.['x-supabase-url'] as string);
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
  teacherId: c.teacher_id || c.teacherId
}) : null;

const mapSupabaseFee = (f: any) => f ? ({
  id: f.id,
  schoolId: f.school_id || f.schoolId,
  name: f.name || f.title,
  title: f.title || f.name,
  amount: Number(f.amount || 0),
  dueDate: f.due_date || f.dueDate,
  type: f.type
}) : null;

const mapSupabasePersonnel = (p: any) => p ? ({
  id: p.id,
  userId: p.user_id || p.userId,
  schoolId: p.school_id || p.schoolId,
  matricule: p.matricule,
  role: p.role,
  baseSalary: p.base_salary || p.baseSalary,
  salary: p.salary || p.base_salary || p.baseSalary,
  hireDate: p.hire_date || p.hireDate,
  bankAccount: p.bank_account || p.bankAccount,
  name: p.name || `Personnel #${p.id}`,
  email: p.email || '',
  phone: p.phone || '',
  status: p.status || 'Actif'
}) : null;

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
  status: s.status || 'active',
  startDate: s.start_date || s.startDate,
  endDate: s.end_date || s.endDate,
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

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '8mb' }));

  // WebAuthn / Passkeys API Routes
  app.use('/api/auth/webauthn', createWebAuthnRouter(getSupabaseAdmin, db, schema.webauthnCredentials));

  // Ensure database tables & schema columns are synchronized asynchronously without blocking port binding
  ensureSchemaColumns().catch(err => {
    console.warn("Background schema sync notice:", err?.message || err);
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Get All Accounts in Supabase DB
  app.get('/api/db/accounts', async (req, res) => {
    try {
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
  app.get('/api/db/status', async (req, res) => {
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
  app.post('/api/db/query', async (req, res) => {
    try {
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

  // Explicit Seed All Endpoint
  app.post('/api/db/seed-all', async (req, res) => {
    return res.status(410).json({
      success: false,
      error: "Le peuplement automatique de données fictives est désactivé."
    });
    try {
      const ok = await seedDatabaseWithFullInitialData();
      const userList = await db.select().from(users);
      const schoolList = await db.select().from(schools);
      const personnelList = await db.select().from(personnel);

      res.json({
        success: ok,
        message: "🚀 Peuplage et synchronisation complète de Supabase terminés !",
        stats: {
          usersCount: userList.length,
          schoolsCount: schoolList.length,
          personnelCount: personnelList.length,
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Erreur lors du peulpage' });
    }
  });

  // Explicit Purge All Endpoint
  app.post('/api/db/purge-all', async (req, res) => {
    try {
      // Clean up server Drizzle tables in reverse dependency order
      try {
        await db.delete(schema.surveyResponses);
        await db.delete(schema.surveys);
        await db.delete(schema.subscriptionRequests);
        await db.delete(schema.subscriptions);
        await db.delete(schema.notifications);
        await db.delete(schema.timetable);
        await db.delete(schema.attendance);
        await db.delete(schema.grades);
        await db.delete(schema.subjects);
        await db.delete(schema.payments);
        await db.delete(schema.transactions);
        await db.delete(schema.fees);
        await db.delete(schema.students);
        await db.delete(schema.personnel);
        await db.delete(schema.classes);
        await db.delete(schema.users);
        await db.delete(schema.schools);
      } catch (e: any) {
        console.warn("Drizzle DB purge warning:", e?.message || e);
      }

      // Clean up Supabase Admin if configured
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        const tables = [
          'survey_responses', 'surveys', 'subscription_requests', 'subscriptions', 
          'notifications', 'timetable', 'attendance', 'grades', 'subjects', 
          'payments', 'transactions', 'fees', 'students', 'personnel', 'classes', 'users', 'schools'
        ];
        for (const t of tables) {
          try {
            await supabaseAdmin.from(t).delete().gt('id', -999999);
          } catch (e) {
            // Ignore errors for individual tables during purge
          }
        }
      }

      res.json({
        success: true,
        message: "✅ Purge globale de la base de données Supabase et locale effectuée avec succès !"
      });
    } catch (err: any) {
      console.error("Error in /api/db/purge-all:", err);
      res.status(500).json({ success: false, error: err?.message || "Erreur lors de la purge" });
    }
  });

  // Test Endpoint to Create a Test School in Database
  app.post('/api/db/test-create-school', async (req, res) => {
    return res.status(410).json({
      success: false,
      error: "La création d'établissement test est désactivée. Utilisez le formulaire réel d'inscription."
    });
    try {
      const testSuffix = Math.floor(1000 + Math.random() * 9000);
      const testIdentifier = `EDUCO-SCH-TEST-${testSuffix}`;
      
      // 1. Insert Test School
      const [newTestSchool] = await db.insert(schools).values({
        name: `Complexe Scolaire Supabase (${testSuffix})`,
        identifier: testIdentifier,
        address: "Avenue de l'Excellence, Cotonou, Bénin",
        phone: "+229 97 00 11 22",
        email: `contact.test${testSuffix}@educo-ecole.com`,
        creationDate: "2026-01-15",
        promoterName: "Dr. Marc TEST-PROMOTEUR",
        promoterContact: "+229 95 88 77 66",
        promoterEmail: `promoteur.test${testSuffix}@educo-ecole.com`,
        levels: { primaire: true, secondaireCollege: true, secondaireLycee: true },
        status: "active",
        settings: { currency: "FCFA", isTestDatabaseAccount: true }
      }).returning();

      // 2. Insert Associated Test User / Promoter
      const [newTestUser] = await db.insert(users).values({
        uid: `test_promoter_${Date.now()}_${testSuffix}`,
        schoolId: newTestSchool.id,
        name: "Dr. Marc TEST-PROMOTEUR",
        email: `promoteur.test${testSuffix}@educo-ecole.com`,
        role: "Promoteur",
        status: "active"
      }).returning();

      // 3. Insert Admin User for this school
      const [newAdminUser] = await db.insert(users).values({
        uid: `test_admin_${Date.now()}_${testSuffix}`,
        schoolId: newTestSchool.id,
        name: "M. Auguste LOUKOU - Directeur",
        email: `directeur.test${testSuffix}@educo-ecole.com`,
        role: "Admin",
        status: "active"
      }).returning();

      // 4. Insert Personnel
      const [newPersonnel] = await db.insert(personnel).values({
        schoolId: newTestSchool.id,
        userId: newTestUser.id,
        matricule: `PER-2026-${testSuffix}`,
        role: "Fondateur & Promoteur Général",
        baseSalary: 450000,
        hireDate: "2026-01-15"
      }).returning();

      // 5. Insert Class
      const [newClass] = await db.insert(classes).values({
        schoolId: newTestSchool.id,
        name: "6ème A (Pilote)",
        level: "Collège",
        capacity: 40
      }).returning();

      // 6. Insert Fee
      const [newFee] = await db.insert(fees).values({
        schoolId: newTestSchool.id,
        name: "Scolarité 1ère Tranche",
        amount: 150000,
        type: "tuition",
        dueDate: "2026-10-15"
      }).returning();

      res.json({
        success: true,
        message: "✅ Nouvel établissement & personnel créés dans Supabase !",
        dbStatus: "Base de données Supabase active",
        school: newTestSchool,
        user: newTestUser,
        admin: newAdminUser,
        personnel: newPersonnel,
        class: newClass,
        fee: newFee
      });
    } catch (error: any) {
      console.error("Test School DB Error:", error);
      res.status(500).json({
        success: false,
        message: "Impossible d'insérer dans la base de données.",
        error: error?.message || "Erreur base de données"
      });
    }
  });


  // Seed / Sync Initial Data to Cloud SQL
  app.post('/api/db/init-seed', async (req, res) => {
    try {
      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        return res.json({
          success: true,
          message: 'Supabase est la base principale : seed PostgreSQL ignoré, synchronisation initiale validée.'
        });
      }

      const { initialUsers, initialClasses, initialFees, initialTransactions, initialBudget, initialPersonnel, initialSettings } = req.body;

      // Seed Users if table is empty
      const existingUsers = await db.select().from(users).limit(1);
      if (existingUsers.length === 0 && Array.isArray(initialUsers) && initialUsers.length > 0) {
        for (const u of initialUsers) {
          await db.insert(users).values({
            uid: `seed_${Math.random().toString(36).substring(7)}`,
            name: u.name,
            role: u.role,
            email: u.email,
            status: u.status || 'active',
            avatar: u.avatar || null,
          }).onConflictDoNothing();
        }
      }

      // Seed Classes
      const existingClasses = await db.select().from(classes).limit(1);
      if (existingClasses.length === 0 && Array.isArray(initialClasses) && initialClasses.length > 0) {
        for (const c of initialClasses) {
          await db.insert(classes).values({
            name: c.name,
            level: c.level || 'Primaire',
            capacity: c.capacity || 40,
          }).onConflictDoNothing();
        }
      }

      // Seed Fees
      const existingFees = await db.select().from(fees).limit(1);
      if (existingFees.length === 0 && Array.isArray(initialFees) && initialFees.length > 0) {
        for (const f of initialFees) {
          await db.insert(fees).values({
            name: f.name || f.feeType || f.type,
            amount: Number(f.amount) || 0,
            dueDate: f.dueDate || null,
            type: f.type || 'tuition',
          });
        }
      }

      // Seed Transactions
      const existingTxns = await db.select().from(transactions).limit(1);
      if (existingTxns.length === 0 && Array.isArray(initialTransactions) && initialTransactions.length > 0) {
        for (const t of initialTransactions) {
          await db.insert(transactions).values({
            description: t.description,
            type: t.type,
            amount: Number(t.amount) || 0,
            date: t.date ? new Date(t.date) : new Date(),
            category: t.category || 'Autres',
          });
        }
      }

      // Seed Personnel
      const existingPersonnel = await db.select().from(personnel).limit(1);
      if (existingPersonnel.length === 0 && Array.isArray(initialPersonnel) && initialPersonnel.length > 0) {
        for (const p of initialPersonnel) {
          await db.insert(personnel).values({
            role: p.role,
            baseSalary: Number(p.salary) || 0,
            hireDate: p.hireDate || null,
          });
        }
      }

      res.json({ success: true, message: 'Données synchronisées avec succès sur Cloud SQL' });
    } catch (error: any) {
      console.error('Error seeding database:', error);
      res.status(500).json({ success: false, error: error?.message || 'Erreur de synchronisation initiale' });
    }
  });

  // Batch Sync Endpoint for Offline Queue Processing
  app.post('/api/sync-batch', async (req, res) => {
    try {
      const { operations } = req.body;
      if (!Array.isArray(operations) || operations.length === 0) {
        return res.json({ success: true, message: 'Aucune opération à synchroniser' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      let processedCount = 0;
      for (const op of operations) {
        try {
          if (op.type === 'TRANSACTION') {
            const t = op.payload;
            if (t) {
              if (supabaseAdmin) {
                const { error } = await supabaseAdmin.from('transactions').insert([{
                  school_id: t.schoolId || t.school_id || null,
                  description: t.description || '',
                  type: t.type || 'expense',
                  amount: Number(t.amount) || 0,
                  date: t.date || new Date().toISOString(),
                  category: t.category || 'Autres',
                  recorded_by: t.recordedBy || t.recorded_by || null,
                }]);
                if (error) throw error;
                processedCount++;
                continue;
              }
              await db.insert(transactions).values({
                description: t.description,
                type: t.type,
                amount: Number(t.amount) || 0,
                date: t.date ? new Date(t.date) : new Date(),
                category: t.category || 'Autres',
              });
              processedCount++;
            }
          } else if (op.type === 'PAYMENT') {
            const p = op.payload;
            if (p) {
              if (supabaseAdmin) {
                const { error } = await supabaseAdmin.from('payments').insert([{
                  school_id: p.schoolId || p.school_id || null,
                  student_id: p.studentId || p.student_id || null,
                  fee_id: p.feeId || p.fee_id || null,
                  amount: Number(p.amountPaid || p.amount) || 0,
                  payment_date: p.paymentDate || p.payment_date || new Date().toISOString(),
                  payment_method: p.paymentMethod || p.payment_method || 'Espèces',
                  receipt_number: p.receiptNumber || p.receipt_number || `REC-${Date.now()}`,
                  status: p.status || 'paid',
                }]);
                if (error) throw error;
                processedCount++;
                continue;
              }
              await db.insert(payments).values({
                studentId: p.studentId,
                amount: Number(p.amountPaid) || 0,
                paymentDate: p.paymentDate ? new Date(p.paymentDate) : new Date(),
                paymentMethod: p.paymentMethod || 'Espèces',
                receiptNumber: p.receiptNumber || `REC-${Date.now()}`,
                status: p.status || 'paid',
              });
              processedCount++;
            }
          } else if (op.type === 'USER') {
            const u = op.payload;
            if (u) {
              if (supabaseAdmin) {
                const { error } = await supabaseAdmin.from('users').upsert([{
                  uid: u.uid || `local_${Date.now()}`,
                  school_id: u.schoolId || u.school_id || null,
                  name: u.name || u.email?.split('@')[0] || 'Utilisateur',
                  role: u.role || 'Parent',
                  email: u.email,
                  status: u.status || 'active',
                  avatar: u.avatar || null,
                }], { onConflict: 'email' });
                if (error) throw error;
                processedCount++;
                continue;
              }
              await db.insert(users).values({
                uid: u.uid || `local_${Date.now()}`,
                name: u.name,
                role: u.role,
                email: u.email,
                status: u.status || 'active',
                avatar: u.avatar || null,
              });
              processedCount++;
            }
          }
        } catch (itemErr) {
          console.warn('Erreur lors du traitement d\'une opération sync:', itemErr);
        }
      }

      res.json({
        success: true,
        message: `${processedCount} opération(s) synchronisée(s) avec succès.`,
        processedCount,
        syncedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Batch Sync Error:', error);
      res.status(500).json({ success: false, error: error?.message || 'Erreur lors de la synchronisation en lot' });
    }
  });

  // Admin Endpoint: Reset (DANGEROUS)
  app.post('/api/admin/reset-data', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
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

  // Serve Service Worker & PWA Manifest files
  app.get('/sw.js', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'sw.js'));
  });
  app.get('/manifest.json', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'manifest.json'));
  });

  // User and School Management
  app.post('/api/auth/register-school', async (req: AuthRequest, res) => {
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
        uid
      } = req.body;
      const firebaseUser = req.user;

      // Generate a unique institutional identifier (e.g., EDUCO-SCH-8492)
      const randomSuffix = Math.floor(1000 + Math.random() * 9000).toString();
      const schoolIdentifier = `EDUCO-SCH-${randomSuffix}`;
      const resolvedEmail = promoterEmail || firebaseUser?.email || `promoter@example.com`;
      const rawAdminPassword = adminPassword || password;
      const supabaseAdmin = getSupabaseAdmin(req);
      let resolvedUid = uid || firebaseUser?.uid || null;

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
        const authResult = keyRole === 'service_role'
          ? await supabaseAdmin.auth.admin.createUser({
              email: resolvedEmail,
              password: rawAdminPassword,
              email_confirm: true,
              user_metadata: authMetadata
            })
          : await supabaseAdmin.auth.signUp({
              email: resolvedEmail,
              password: rawAdminPassword,
              options: {
                data: authMetadata
              }
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
        email: promoterEmail || firebaseUser?.email || null,
        creationDate: creationDate || null,
        promoterName: promoterName || firebaseUser?.name || 'Promoteur',
        promoterContact: promoterContact || schoolPhone || null,
        promoterEmail: promoterEmail || firebaseUser?.email || null,
        levels: levels || {},
        openingAuthorizationDoc: openingAuthorizationDoc || (req.body.hasOpeningDoc ? 'Autorisation_Ouverture_Ministère.pdf' : null),
        promoterIdDoc: promoterIdDoc || (req.body.hasPromoterDoc ? 'Piece_Identite_Promoteur.pdf' : null),
        statutesDoc: statutesDoc || null,
        status: 'registered',
      };

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
          promoterName || firebaseUser?.name || 'Promoteur',
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
          });
        }

        // Add a notification for the school owner as well
        await db.insert(notifications).values({
          userId: adminUser.id,
          title: `Bienvenue sur EDUCO !`,
          message: `Votre établissement "${schoolName}" (${schoolIdentifier}) est enregistré en mode Inscription. Activez votre licence pour déverrouiller tous les modules.`,
          type: 'Information',
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
  app.post('/api/auth/register-parent', async (req, res) => {
    try {
      const { schoolMatricule, studentMatricule, parentName, parentEmail, parentPhone, password, studentName } = req.body;

      if (!schoolMatricule || !parentName || !parentEmail) {
        return res.status(400).json({ error: 'Le N° Matricule d\'établissement, le nom du parent et l\'adresse e-mail sont obligatoires.' });
      }

      const formattedMatricule = schoolMatricule.trim().toUpperCase();
      const supabaseAdmin = getSupabaseAdmin(req);
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

      let resolvedUid = req.body.uid;
      if (!resolvedUid) {
        const adminClient = supabaseAdmin || getSupabaseAdmin(req);
        if (adminClient && parentEmail) {
          try {
            const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
              email: parentEmail,
              password: password || 'Parent123!',
              email_confirm: true,
              user_metadata: {
                name: parentName,
                role: 'Parent'
              }
            });
            if (authUser?.user?.id) {
              resolvedUid = authUser.user.id;
            } else if (createError) {
              console.warn("Supabase Admin parent createUser notice:", createError.message);
            }
          } catch (e: any) {
            console.warn("Could not create parent in Supabase Admin:", e.message);
          }
        }
      }

      const uid = resolvedUid || `parent_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const parentValues = {
        uid,
        schoolId: schoolObj.id,
        name: parentName,
        email: parentEmail,
        role: 'Parent',
        status: 'active',
      };

      let newParent: any;
      try {
        [newParent] = await db.insert(users).values(parentValues).returning();
      } catch (dbParentErr) {
        if (!supabaseAdmin) throw dbParentErr;
        console.warn('Postgres parent insert failed, falling back to Supabase REST:', dbParentErr);
        const { data: sbParent, error: sbParentError } = await supabaseAdmin
          .from('users')
          .insert([{
            uid,
            school_id: schoolObj.id,
            name: parentName,
            email: parentEmail,
            role: 'Parent',
            status: 'active',
          }])
          .select('*')
          .single();

        if (sbParentError || !sbParent) {
          throw sbParentError || dbParentErr;
        }
        newParent = mapSupabaseUser(sbParent);
      }

      if (supabaseAdmin && studentMatricule) {
        try {
          await supabaseAdmin
            .from('students')
            .update({
              parent_name: parentName,
              parent_phone: parentPhone || '',
              parent_email: parentEmail
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
  app.get('/api/auth/verify-school-matricule/:matricule', async (req, res) => {
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
          } else {
            console.warn('Postgres all schools lookup failed and Supabase fallback is unavailable:', dbAllSchoolsErr);
          }
        }
      }

      if (schoolObj) {
        res.json({ valid: true, school: { id: schoolObj.id, name: schoolObj.name, identifier: schoolObj.identifier, address: schoolObj.address, phone: schoolObj.phone } });
      } else {
        res.json({ valid: false, error: 'Matricule d\'établissement introuvable.' });
      }
    } catch (error: any) {
      res.status(500).json({ valid: false, error: error.message });
    }
  });

  // Find user by email (Public)
  app.get('/api/auth/find-user', async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) {
        return res.status(400).json({ error: 'Email requis.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { data: sbUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('email', email.toLowerCase().trim())
          .limit(1)
          .maybeSingle();
        return res.json({ user: mapSupabaseUser(sbUser) });
      }
      
      if (!isDbConfigured()) {
        return res.json({ user: null });
      }

      const allUsers = await db.select().from(users);
      const matched = allUsers.find(u => u.email?.toLowerCase().trim() === email.toLowerCase().trim());
      
      if (matched) {
        return res.json({ user: matched });
      }
      return res.json({ user: null });
    } catch (error: any) {
      console.error('Error finding user by email:', error);
      res.status(500).json({ error: error.message });
    }
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
          const { data: sbUsers } = await supabaseAdmin.from('users').select('*');
          if (sbUsers && sbUsers.length > 0) {
            sbUsers.forEach(su => {
              const existingIdx = allUsersList.findIndex(u => u.id === su.id || (su.email && u.email && u.email.toLowerCase() === su.email.toLowerCase()));
              if (existingIdx >= 0) {
                // Enrich existing user with any missing fields from Supabase
                allUsersList[existingIdx] = {
                  ...allUsersList[existingIdx],
                  avatar: allUsersList[existingIdx].avatar || su.avatar,
                  phone: allUsersList[existingIdx].phone || su.phone,
                  status: (allUsersList[existingIdx].status === 'Actif' || su.status === 'active' || su.status === 'Actif') ? 'Actif' : (allUsersList[existingIdx].status || 'Actif'),
                  studentId: allUsersList[existingIdx].studentId || su.student_id || su.matricule,
                  class: allUsersList[existingIdx].class || su.class,
                };
              } else {
                allUsersList.push({
                  id: su.id,
                  uid: su.uid || `usr_${su.id}`,
                  email: su.email,
                  name: su.name || su.email?.split('@')[0] || 'Utilisateur',
                  role: su.role || 'Personnel',
                  schoolId: su.school_id || su.schoolId || 1,
                  status: (su.status === 'active' || su.status === 'Actif' || !su.status) ? 'Actif' : 'Inactif',
                  avatar: su.avatar,
                  phone: su.phone,
                  matricule: su.matricule,
                  studentId: su.student_id || su.matricule,
                  class: su.class
                });
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
      if (requestedRole === 'Admin') {
        return res.status(403).json({ error: 'Le compte Admin unique ne peut pas être créé depuis la gestion des utilisateurs.' });
      }
      if (requestedRole === 'Co-admin' && dbUser?.role !== 'Admin') {
        return res.status(403).json({ error: 'Seul le compte Admin peut créer ou modifier un compte Co-admin.' });
      }
      
      const isSelfUpdate = dbUser && (
        (req.body.id && Number(req.body.id) === dbUser.id) ||
        (req.body.uid && req.body.uid === dbUser.uid) ||
        (req.body.email && req.body.email.toLowerCase() === dbUser.email.toLowerCase())
      );

      const isCentralAdmin = dbUser?.role === 'Admin' || dbUser?.role === 'Co-admin';
      const requestedSchoolId = Number(req.body.schoolId);
      const targetSchoolId: number | null = isCentralAdmin && Number.isInteger(requestedSchoolId) && requestedSchoolId > 0
        ? requestedSchoolId
        : (dbUser?.schoolId ? Number(dbUser.schoolId) : null);
      if (!targetSchoolId && requestedRole !== 'Co-admin') {
        return res.status(403).json({ error: 'Aucun établissement associé au créateur de ce compte.' });
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
        if (supabaseAdmin) {
          const { data: updatedUser, error: updateError } = await supabaseAdmin
            .from('users')
            .update({
              name: req.body.name,
              email: req.body.email,
              role: req.body.role,
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
            role: req.body.role,
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
      if (adminClient && req.body.email) {
        const tempPassword = req.body.tempPassword || req.body.password;
        if (!tempPassword || String(tempPassword).length < 6) {
          return res.status(400).json({ error: 'Un mot de passe initial d’au moins 6 caractères est obligatoire.' });
        }
        const { data: authUser, error: createError } = await adminClient.auth.admin.createUser({
          email: req.body.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: req.body.name || req.body.email.split('@')[0],
            role: req.body.role || 'Enseignant'
          }
        });
        
        if (authUser?.user?.id) {
          resolvedUid = authUser.user.id;
        } else if (createError) {
          console.warn("Supabase Admin createUser notice:", createError.message);
        }

        const { data: existingUser } = await adminClient
          .from('users')
          .select('*')
          .eq('email', String(req.body.email || '').toLowerCase())
          .limit(1)
          .maybeSingle();

        const payload: Record<string, any> = {
          uid: resolvedUid,
          name: req.body.name,
          email: req.body.email,
          role: req.body.role,
          status: req.body.status === 'Inactif' ? 'inactive' : 'active',
          school_id: targetSchoolId,
          ...(req.body.avatar !== undefined && { avatar: req.body.avatar })
        };

        const { data: sbUser, error: sbUserError } = existingUser?.id
          ? await adminClient.from('users').update(payload).eq('id', existingUser.id).select('*').single()
          : await adminClient.from('users').insert([payload]).select('*').single();

        if (sbUserError || !sbUser) throw sbUserError || new Error('Impossible de synchroniser le compte utilisateur dans Supabase.');

        if (String(req.body.role || '').toLowerCase().includes('élève') || String(req.body.role || '').toLowerCase().includes('eleve')) {
          const studentPayload = {
            user_id: sbUser.id,
            school_id: targetSchoolId,
            student_id: req.body.studentId || req.body.matricule || `MAT-${sbUser.id}`,
            class_id: req.body.classId || null,
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
        }

        const normalizedRole = String(req.body.role || '').toLowerCase();
        if (!normalizedRole.includes('élève') && !normalizedRole.includes('eleve') && normalizedRole !== 'parent' && normalizedRole !== 'co-admin') {
          const { data: schoolRow } = await adminClient.from('schools').select('name').eq('id', targetSchoolId).maybeSingle();
          const words = String(schoolRow?.name || 'EDUCO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[A-Za-z0-9]+/g) || [];
          const acronym = (words.length > 1 ? words.map((word: string) => word[0]).join('') : (words[0] || 'EDUCO').slice(0, 5)).toUpperCase().slice(0, 6);
          const matricule = req.body.matricule || `${acronym}-EMP-${new Date().getFullYear()}-${String(sbUser.id).padStart(5, '0')}`;
          const { data: existingPersonnel } = await adminClient.from('personnel').select('id').eq('user_id', sbUser.id).eq('school_id', targetSchoolId).maybeSingle();
          const personnelPayload = { user_id: sbUser.id, school_id: targetSchoolId, matricule, role: req.body.role };
          const { error: personnelError } = existingPersonnel?.id
            ? await adminClient.from('personnel').update(personnelPayload).eq('id', existingPersonnel.id).eq('school_id', targetSchoolId)
            : await adminClient.from('personnel').insert([personnelPayload]);
          if (personnelError) throw personnelError;
          sbUser.matricule = matricule;
        }


        const { data: welcomeSchool } = targetSchoolId
          ? await adminClient.from('schools').select('name,identifier').eq('id', targetSchoolId).maybeSingle()
          : { data: null };
        sendWelcomeEmail({
          email: req.body.email,
          name: req.body.name,
          role: req.body.role || 'Personnel',
          schoolName: welcomeSchool?.name || 'Administration Centrale EDUCO',
          schoolIdentifier: welcomeSchool?.identifier || 'EDUCO-CENTRAL',
          tempPassword,
          loginUrl: `${getPublicAppUrl(req)}/?login=1`,
        }).catch(err => console.warn('User welcome email warning:', err));

        return res.json(mapSupabaseUser(sbUser));
      }

      const newUser = await db.insert(users).values({
        ...req.body,
        uid: resolvedUid,
        status: req.body.status || 'Actif',
        schoolId: targetSchoolId
      }).returning();
      return res.json(newUser[0]);
    } catch (error: any) {
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
      const actor = (req.user?.role ? req.user : await getUserByUid(req.user!.uid));
      if (role === 'Admin') {
        return res.status(403).json({ error: 'Il ne peut exister qu’un seul compte Admin et ce rôle ne peut pas être attribué.' });
      }
      if (role === 'Co-admin' && actor?.role !== 'Admin') {
        return res.status(403).json({ error: 'Seul le compte Admin peut attribuer le rôle Co-admin.' });
      }
      const isCentralAdmin = actor?.role === 'Admin' || actor?.role === 'Co-admin';
      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        const { data: target } = await supabaseAdmin.from('users').select('school_id').eq('id', targetUserId).maybeSingle();
        if (!target || (!isCentralAdmin && Number(target.school_id) !== Number(actor?.schoolId))) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
        const payload = {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(role !== undefined && { role }),
          ...(status !== undefined && { status: status === 'Inactif' ? 'inactive' : 'active' }),
          ...(avatar !== undefined && { avatar }),
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
          ...(email !== undefined && { email }),
          ...(role !== undefined && { role }),
          ...(status !== undefined && { status }),
          ...(avatar !== undefined && { avatar }),
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
      const actor = await getUserByUid(req.user!.uid);
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
      const actor = await getUserByUid(req.user!.uid);
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
      const tempPass = `Educo${Math.floor(1000 + Math.random() * 9000)}!`;

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
      const dbUser = await getUserByUid(req.user!.uid);
      if (!['Admin', 'Co-admin', 'Promoteur'].includes(dbUser?.role || '')) {
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

        const isCentralAdmin = dbUser?.role === 'Admin' || dbUser?.role === 'Co-admin';
        if (!targetUser || (!isCentralAdmin && Number(targetUser.schoolId) !== Number(dbUser?.schoolId))) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
        if (targetUser.role === 'Admin') {
          return res.status(403).json({ error: 'Le compte Admin unique ne peut pas être supprimé.' });
        }
        if (targetUser.role === 'Co-admin' && dbUser?.role !== 'Admin') {
          return res.status(403).json({ error: 'Seul l’Admin peut supprimer un Co-admin.' });
        }

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
        const isCentralAdmin = dbUser?.role === 'Admin' || dbUser?.role === 'Co-admin';
        if (!targetUser || (!isCentralAdmin && Number(targetUser.schoolId) !== Number(dbUser?.schoolId))) {
          return res.status(403).json({ error: 'Cet utilisateur appartient à un autre établissement.' });
        }
        if (targetUser.role === 'Admin') {
          return res.status(403).json({ error: 'Le compte Admin unique ne peut pas être supprimé.' });
        }
        if (targetUser.role === 'Co-admin' && dbUser?.role !== 'Admin') {
          return res.status(403).json({ error: 'Seul l’Admin peut supprimer un Co-admin.' });
        }

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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

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
        .select('*')
        .single();
      if (updateResult.error) {
        updateResult = await supabaseAdmin
          .from('transactions')
          .update({ description: `(Status: ${req.body.status}) ${req.body.description || ''}` })
          .eq('id', transactionId)
          .eq('school_id', dbUser.schoolId)
          .select('*')
          .single();
      }
      const { data, error } = updateResult;
      if (error) throw error;
      res.json(mapSupabaseTransaction(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Payments Endpoints
  app.get('/api/payments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('school_id', dbUser.schoolId)
        .order('payment_date', { ascending: false });
      if (error) throw error;
      res.json((data || []).map(mapSupabasePayment));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const payload = {
        school_id: dbUser.schoolId,
        student_id: req.body.studentId || req.body.student_id || null,
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
  app.get('/api/school', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await supabaseAdmin.from('schools').select('*').eq('id', dbUser.schoolId).limit(1).maybeSingle();
      if (error) throw error;
      res.json(mapSupabaseSchool(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/school', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
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
      res.json(mapSupabaseSchool(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get('/api/budget', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await supabaseAdmin.from('classes').select('*').eq('school_id', dbUser.schoolId);
      if (error) throw error;
      res.json((data || []).map(mapSupabaseClass));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/classes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const payload = {
        school_id: dbUser.schoolId,
        name: req.body.name,
        level: req.body.level || req.body.section || null,
        capacity: req.body.capacity ? Number(req.body.capacity) : null,
        teacher_id: req.body.teacherId || req.body.teacher_id || null
      };

      const query = Number.isFinite(Number(req.body.id))
        ? supabaseAdmin.from('classes').update(payload).eq('id', Number(req.body.id)).eq('school_id', dbUser.schoolId)
        : supabaseAdmin.from('classes').insert([payload]);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      res.json(mapSupabaseClass(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fees Endpoints
  app.get('/api/fees', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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

      const query = Number.isFinite(Number(req.body.id))
        ? supabaseAdmin.from('fees').update(payload).eq('id', Number(req.body.id)).eq('school_id', dbUser.schoolId)
        : supabaseAdmin.from('fees').insert([payload]);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      res.json(mapSupabaseFee(data));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Personnel Endpoints
  app.get('/api/personnel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });

      let userId = req.body.userId || req.body.user_id || null;
      const personName = req.body.name || req.body.fullName || 'Membre du personnel';
      const personEmail = req.body.email || `${String(req.body.matricule || `personnel-${Date.now()}`).toLowerCase().replace(/[^a-z0-9._-]/g, '-') }@personnel.educo.local`;

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
              role: req.body.role || 'Personnel',
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
            role: req.body.role || 'Personnel',
            status: req.body.status || 'active'
          })
          .eq('id', Number(userId))
          .eq('school_id', dbUser.schoolId);
      }

      const payload = {
        user_id: Number(userId),
        school_id: dbUser.schoolId,
        matricule: req.body.matricule || null,
        role: req.body.role || null,
        base_salary: Number(req.body.baseSalary || req.body.salary || 0),
        hire_date: req.body.hireDate || req.body.hire_date || null,
        bank_account: req.body.bankAccount || req.body.bank_account || null
      };
      const query = Number.isFinite(Number(req.body.id))
        ? supabaseAdmin.from('personnel').update(payload).eq('id', Number(req.body.id)).eq('school_id', dbUser.schoolId)
        : supabaseAdmin.from('personnel').insert([payload]);
      const { data, error } = await query.select('*').single();
      if (error) throw error;
      res.json(mapSupabasePersonnel({ ...data, name: personName, email: personEmail, status: req.body.status || 'Actif' }));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Grades Endpoints
  app.get('/api/grades', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });
      const [{ data: gradeRows, error }, { data: subjectRows }] = await Promise.all([
        supabaseAdmin.from('grades').select('*'),
        supabaseAdmin.from('subjects').select('*').eq('school_id', dbUser.schoolId)
      ]);
      if (error) throw error;
      const subjectsById = new Map((subjectRows || []).map((s: any) => [Number(s.id), s.name]));
      const classIds = new Set<number>();
      const { data: schoolClasses } = await supabaseAdmin.from('classes').select('id').eq('school_id', dbUser.schoolId);
      (schoolClasses || []).forEach((c: any) => classIds.add(Number(c.id)));
      res.json((gradeRows || [])
        .filter((g: any) => classIds.has(Number(g.class_id || g.classId)))
        .map((g: any) => mapSupabaseGrade(g, subjectsById.get(Number(g.subject_id || g.subjectId)))));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/grades', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
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
      let resolvedStudentId = requestedStudentId;
      const { data: existingStudentById } = await supabaseAdmin
        .from('students')
        .select('*')
        .eq('id', requestedStudentId)
        .limit(1)
        .maybeSingle();
      if (!existingStudentById) {
        const { data: studentUser } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', requestedStudentId)
          .eq('school_id', dbUser.schoolId)
          .limit(1)
          .maybeSingle();
        if (studentUser?.id) {
          const { data: existingStudentByUser } = await supabaseAdmin
            .from('students')
            .select('*')
            .eq('user_id', studentUser.id)
            .limit(1)
            .maybeSingle();
          if (existingStudentByUser?.id) {
            resolvedStudentId = existingStudentByUser.id;
          } else {
            const { data: createdStudent, error: studentError } = await supabaseAdmin
              .from('students')
              .insert([{
                user_id: studentUser.id,
                school_id: dbUser.schoolId,
                student_id: studentUser.student_id || studentUser.matricule || `MAT-${studentUser.id}`,
                parent_name: studentUser.parent_name || '',
                parent_phone: studentUser.phone || '',
                status: studentUser.status || 'active'
              }])
              .select('*')
              .single();
            if (studentError) throw studentError;
            resolvedStudentId = createdStudent.id;
          }
        }
      }

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
      const { data, error } = await supabaseAdmin.from('grades').insert([payload]).select('*').single();
      if (error) throw error;
      res.json(mapSupabaseGrade(data, subjectName));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Intra/inter-school messaging using the existing notifications table as durable delivery
  app.post('/api/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase non configuré.' });

      const text = String(req.body.text || req.body.message || '').trim();
      if (!text) return res.status(400).json({ error: 'Le message est obligatoire.' });
      const targetSchoolId = req.body.targetSchoolId || req.body.schoolId || dbUser.schoolId;
      const targetRoles = Array.isArray(req.body.roles) && req.body.roles.length > 0 ? req.body.roles : null;

      let usersQuery = supabaseAdmin.from('users').select('*').eq('school_id', Number(targetSchoolId));
      if (targetRoles) usersQuery = usersQuery.in('role', targetRoles);
      const { data: recipients, error: recipientsError } = await usersQuery;
      if (recipientsError) throw recipientsError;

      const rows = (recipients || []).map((u: any) => ({
        user_id: u.id,
        title: req.body.title || `Message de ${dbUser.name || 'EDUCO'}`,
        message: text,
        type: Number(targetSchoolId) === Number(dbUser.schoolId) ? 'Messagerie interne' : 'Messagerie inter-école',
        is_read: false
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
      const dbUser = await getUserByUid(req.user!.uid);
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('user_id', dbUser?.id || req.user?.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      res.json({ success: true, notifications: (data || []).map(mapSupabaseNotification).filter(Boolean) });
    } catch (error: any) {
      console.error('Notifications fetch error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', Number(req.params.id))
        .eq('user_id', dbUser?.id || req.user?.id)
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
      const dbUser = await getUserByUid(req.user!.uid);
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });

      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', dbUser?.id || req.user?.id);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error('Notification mark-all-read error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/notifications/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });

      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', Number(req.params.id))
        .eq('user_id', dbUser?.id || req.user?.id);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error('Notification delete error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.delete('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      const supabaseAdmin = getSupabaseAdmin(req);
      if (!supabaseAdmin) return res.status(503).json({ success: false, error: 'Supabase non configuré.' });

      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', dbUser?.id || req.user?.id);
      if (error) throw error;

      res.json({ success: true });
    } catch (error: any) {
      console.error('Notifications clear error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/admin/broadcast-notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
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
        promoters: ['Promoteur', 'Admin', 'Co-admin'],
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

      const rows = (recipients || []).map((u: any) => ({
        user_id: u.id,
        title,
        message,
        type: 'Message Admin',
        is_read: false,
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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
        school = mapSupabaseSchool(sbSchool);
      } else {
        const schoolResult = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
        school = schoolResult[0];
      }
      const schoolIdentifier = school?.identifier || `EDUCO-SCH-${dbUser.schoolId.toString().padStart(4, '0')}`;

      // Query active subscription for this school
      let subList: any[] = [];
      if (supabaseAdmin) {
        const { data: sbSubs, error } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('school_id', dbUser.schoolId);
        if (error) throw error;
        subList = (sbSubs || []).map(mapSupabaseSubscription).filter(Boolean)
          .sort((a: any, b: any) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime());
      } else {
        subList = await db.select().from(subscriptions)
          .where(eq(subscriptions.schoolId, dbUser.schoolId))
          .orderBy(desc(subscriptions.endDate));
      }

      const activeSub = subList[0];
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
      const isExpired = endDate.getTime() < now.getTime() || activeSub.status === 'expired' || activeSub.status === 'revoked';
      const daysRemaining = isExpired ? 0 : Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      res.json({
        isActive: !isExpired && activeSub.status === 'active',
        isPreSubscription: isExpired || activeSub.status !== 'active',
        planType: activeSub.planType, // 'standard' | 'ai_premium'
        planName: activeSub.planType === 'ai_premium' ? 'Abonnement IA Premium (20.000 FCFA/mois)' : 'Abonnement Standard (10.000 FCFA/mois)',
        isAiEnabled: !isExpired && activeSub.planType === 'ai_premium',
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const sameSchoolId = Number(sub.schoolId) === Number(dbUser.schoolId);
      const sameSchoolIdentifier = String(sub.schoolIdentifier || '').trim().toUpperCase() === String(school?.identifier || '').trim().toUpperCase();
      if (!sameSchoolId || !sameSchoolIdentifier) {
        return res.status(403).json({ error: 'Cette clé a été émise pour un autre établissement et ne peut pas être utilisée ici.' });
      }

      const now = new Date();
      // Calculate end date based on duration
      const durationDays = (sub.months || 1) * 30;
      const newEndDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      let updatedSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            school_id: dbUser.schoolId,
            school_name: school?.name || sub.schoolName,
            school_identifier: school?.identifier || sub.schoolIdentifier,
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
            schoolIdentifier: school?.identifier || sub.schoolIdentifier,
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
          is_read: false
        }]).throwOnError();
      } else {
        await db.insert(notifications).values({
          userId: dbUser.id,
          title: 'Licence Activée avec Succès !',
          message: `Votre abonnement ${updatedSub.planType === 'ai_premium' ? 'IA Premium' : 'Standard'} est activé pour ${updatedSub.months} mois jusqu'au ${newEndDate.toLocaleDateString('fr-FR')}.`,
          type: 'subscription',
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
      const dbUser = await getUserByUid(req.user!.uid);
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

      let newRequest: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('subscription_requests').insert([{
          school_id: dbUser.schoolId,
          school_identifier: schoolIdentifier,
          school_name: school?.name || 'Établissement',
          promoter_name: dbUser.name,
          promoter_contact: dbUser.email,
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
          promoterName: dbUser.name,
          promoterContact: dbUser.email,
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
      const dbUser = await getUserByUid(req.user!.uid);
      if (dbUser?.role !== 'Admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

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
      const dbUser = await getUserByUid(req.user!.uid);
      if (dbUser?.role !== 'Admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

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
      const isAI = planType === 'ai_premium';
      const monthlyRate = isAI ? 20000 : 10000;
      const computedAmount = Number(amountPaid) || (monthlyRate * numMonths);

      // Generate Unique Code format: EDUCO-STD-2026-X8F9-Q2M1 or EDUCO-AI-2026-Y4K8-V7B3
      const planPrefix = isAI ? 'AI' : 'STD';
      const year = new Date().getFullYear();
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `EDUCO-${planPrefix}-${year}-${part1}-${part2}`;

      const now = new Date();
      const endDate = new Date(now.getTime() + numMonths * 30 * 24 * 60 * 60 * 1000);

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

      const fallbackIdentifier = schoolIdentifier.trim().toUpperCase();
      let newSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('subscriptions').insert([{
          code,
          school_id: matchedSchoolId,
          school_name: schoolName || 'Établissement',
          school_identifier: fallbackIdentifier,
          promoter_name: promoterName || 'Promoteur',
          promoter_contact: promoterContact || '',
          plan_type: isAI ? 'ai_premium' : 'standard',
          amount_paid: computedAmount,
          months: numMonths,
          status: 'active',
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
          planType: isAI ? 'ai_premium' : 'standard',
          amountPaid: computedAmount,
          months: numMonths,
          status: 'active',
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
      const dbUser = await getUserByUid(req.user!.uid);
      if (dbUser?.role !== 'Admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

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
      const monthlyRate = sub.planType === 'ai_premium' ? 20000 : 10000;
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
      const dbUser = await getUserByUid(req.user!.uid);
      if (dbUser?.role !== 'Admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

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

  // Admin: Fulfill Renewal Request
  app.post('/api/admin/subscriptions/fulfill-request', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (dbUser?.role !== 'Admin') {
        return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
      }

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

      const isAI = request.requestedPlan === 'ai_premium';
      const numMonths = request.requestedMonths || 1;
      const amountPaid = (isAI ? 20000 : 10000) * numMonths;

      // Generate Code
      const planPrefix = isAI ? 'AI' : 'STD';
      const year = new Date().getFullYear();
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `EDUCO-${planPrefix}-${year}-${part1}-${part2}`;

      const now = new Date();
      const endDate = new Date(now.getTime() + numMonths * 30 * 24 * 60 * 60 * 1000);

      let newSub: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('subscriptions').insert([{
          code,
          school_id: request.schoolId,
          school_name: request.schoolName,
          school_identifier: request.schoolIdentifier,
          promoter_name: request.promoterName,
          promoter_contact: request.promoterContact,
          plan_type: request.requestedPlan,
          amount_paid: amountPaid,
          months: numMonths,
          status: 'active',
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
          planType: request.requestedPlan,
          amountPaid,
          months: numMonths,
          status: 'active',
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
        message: `Code ${code} généré et activé pour ${request.schoolName}.`,
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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
                name: st.name || linkedUser?.name || `Élève #${st.id}`,
                schoolId: st.school_id || st.schoolId || linkedUser?.schoolId || 1,
                classId: st.class_id || st.classId || null,
                matricule: st.matricule || (linkedUser as any)?.studentId || (linkedUser as any)?.matricule || `MAT-${st.id}`,
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
      const linkedParentStudents = enrichedStudents.filter((student: any) =>
        (parentStudentReference && String(student.studentId || student.matricule || '').toLowerCase() === parentStudentReference)
        || (!!currentUserEmail && (String(student.parentEmail || '').toLowerCase() === currentUserEmail || String(student.email || '').toLowerCase() === currentUserEmail))
        || (!!parentName && String(student.parentName || '').toLowerCase() === parentName)
      );
      const linkedStudentIds = new Set(linkedParentStudents.map((student: any) => String(student.id)));
      const linkedStudentReferences = new Set(linkedParentStudents.map((student: any) => String(student.studentId || student.matricule || '')));
      const linkedStudentNames = new Set(linkedParentStudents.map((student: any) => String(student.name || '').toLowerCase()));
      const linkedStudentUserIds = new Set(enrichedUsers
        .filter((user: any) => /élève|eleve|student/i.test(String(user.role || '')) && (linkedStudentReferences.has(String(user.studentId || user.matricule || '')) || linkedStudentNames.has(String(user.name || '').toLowerCase())))
        .map((user: any) => String(user.id)));

      if (!isSuperAdmin && /parent/.test(normalizedRole)) {
        const linkedClassIds = new Set(linkedParentStudents.map((student: any) => String(student.classId || student.class_id || '')));
        visibleUsers = enrichedUsers.filter((user: any) => isCurrentUserRow(user) || linkedStudentUserIds.has(String(user.id)));
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

      if (!isSuperAdmin && (/parent/.test(normalizedRole) || /enseignant|professeur|teacher/.test(normalizedRole))) {
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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
      const dbUser = await getUserByUid(req.user!.uid);
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

  app.post('/api/surveys/:id/respond', async (req, res) => {
    try {
      const surveyId = Number(req.params.id);
      const { parentName, parentPhone, parentEmail, studentName, studentClass, channel, answers, comment } = req.body;

      if (!parentName) {
        return res.status(400).json({ error: 'Le nom du parent est obligatoire.' });
      }

      const supabaseAdmin = getSupabaseAdmin(req);
      let newResponse: any;
      if (supabaseAdmin) {
        const { data, error } = await supabaseAdmin.from('survey_responses').insert([{
          survey_id: surveyId,
          parent_name: parentName,
          parent_phone: parentPhone || '',
          parent_email: parentEmail || '',
          student_name: studentName || '',
          student_class: studentClass || '',
          channel: channel || 'whatsapp',
          answers: answers || {},
          comment: comment || '',
        }]).select('*').single();
        if (error) throw error;
        newResponse = mapSupabaseSurveyResponse(data);
      } else {
        [newResponse] = await db.insert(surveyResponses).values({
          surveyId,
          parentName,
          parentPhone: parentPhone || '',
          parentEmail: parentEmail || '',
          studentName: studentName || '',
          studentClass: studentClass || '',
          channel: channel || 'whatsapp',
          answers: answers || {},
          comment: comment || '',
        }).returning();
      }

      res.json({
        success: true,
        message: 'Votre participation au sondage a bien été enregistrée. Merci pour votre collaboration !',
        response: newResponse,
      });
    } catch (error: any) {
      console.error('Survey Response Error:', error);
      res.status(500).json({ error: error.message });
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

  app.post('/api/surveys/:id/broadcast', requireAuth, async (req: AuthRequest, res) => {
    try {
      const surveyId = Number(req.params.id);
      const { channel, customMessage } = req.body; // 'whatsapp' | 'email' | 'all'
      
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

      // Return formatted WhatsApp Link and broadcast payload
      const encodedMsg = encodeURIComponent(
        `🏫 *${survey.title}*\n\nChers parents,\n${customMessage || survey.description || 'Votre avis compte pour la réussite de nos élèves ! Merci de bien vouloir répondre à ce court sondage.'}\n\n👉 *Participez directement ici :* ${req.protocol}://${req.get('host')}/?survey=${survey.id}\n\n_Direction de l'Établissement_`
      );

      res.json({
        success: true,
        message: `Diffusion générée pour le sondage "${survey.title}".`,
        whatsappShareUrl: `https://api.whatsapp.com/send?text=${encodedMsg}`,
        simulatedCount: 154,
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

  // Groq AI API Proxy
  app.post('/api/ai/groq/report', async (req, res) => {
    try {
      const { prompt } = req.body;
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GROQ_API_KEY is missing' });
      }
      
      const groq = new Groq({ apiKey });
      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama3-8b-8192',
      });
      
      res.json({ text: completion.choices[0]?.message?.content || '' });
    } catch (error: any) {
      console.error('Groq API Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Gemini AI API Proxy
  app.post('/api/ai/gemini/report', async (req, res) => {
    try {
      const { prompt } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is missing' });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // =========================================================================
  // AUTHENTICATION (Admin, Promoteur, Personnel, Parents)
  // =========================================================================
  const registeredAccountsStore = new Map<string, { password: string; user: any }>();
  const adminRoles = new Set(['Admin', 'Co-admin']);

  // UNIFIED LOGIN ENDPOINT (Supports Email/Password, Identifiers & Biometrics)
  app.post(['/api/auth/login', '/api/users/login'], async (req, res) => {
    try {
      const { email, identifier, password, isBiometric, isAdminPortal } = req.body;
      const targetIdentifier = (email || identifier || '').trim().toLowerCase();

      if (!targetIdentifier) {
        return res.status(400).json({ success: false, error: 'Identifiant ou adresse e-mail requis.' });
      }

      // Biometric Login: instant verification if user exists or enrolled
      if (isBiometric) {
        let authUser = null;
        if (registeredAccountsStore.has(targetIdentifier)) {
          authUser = registeredAccountsStore.get(targetIdentifier)!.user;
        } else {
          // Production accounts are stored in Supabase. Looking only in the
          // local fallback database made valid admin accounts appear unknown.
          const supabaseDb = getSupabaseAdmin(req);
          if (supabaseDb) {
            try {
              const { data: sbUser } = await supabaseDb
                .from('users')
                .select('*')
                .eq('email', targetIdentifier)
                .maybeSingle();
              authUser = mapSupabaseUser(sbUser);
            } catch (e) {}
          }
        }

        if (!authUser && isDbConfigured()) {
          try {
            const found = await db.select().from(users).where(eq(users.email, targetIdentifier)).limit(1);
            if (found.length > 0) authUser = found[0];
          } catch (e) {}
        }

        if (!authUser) {
          return res.status(401).json({
            success: false,
            error: "Authentification biométrique impossible : ce compte n'est pas reconnu par le système."
          });
        }

        if (adminRoles.has(authUser.role) && !isAdminPortal) {
          return res.status(403).json({
            success: false,
            error: "Accès refusé : L'administrateur n'est pas autorisé à se connecter depuis la page d'accueil. Veuillez utiliser le portail d'administration dédié."
          });
        }
        if (!adminRoles.has(authUser.role) && isAdminPortal) {
          return res.status(403).json({
            success: false,
            error: "Accès refusé : ce portail est réservé aux administrateurs et co-administrateurs."
          });
        }

        return res.json({
          success: true,
          message: 'Authentification biométrique validée.',
          user: authUser,
          token: authUser.uid || authUser.email,
        });
      }

      // Standard Login with Password
      if (!password) {
        return res.status(400).json({ success: false, error: 'Veuillez saisir votre mot de passe.' });
      }

      // 1. Check registered accounts store
      if (registeredAccountsStore.has(targetIdentifier)) {
        const entry = registeredAccountsStore.get(targetIdentifier)!;
        if (entry.password === password) {
          const authUser = entry.user;
          if (adminRoles.has(authUser.role) && !isAdminPortal) {
            return res.status(403).json({
              success: false,
              error: "Accès refusé : L'administrateur n'est pas autorisé à se connecter depuis la page d'accueil. Veuillez utiliser le portail d'administration dédié."
            });
          }
          if (!adminRoles.has(authUser.role) && isAdminPortal) {
            return res.status(403).json({
              success: false,
              error: "Accès refusé : ce portail est réservé aux administrateurs et co-administrateurs."
            });
          }

          return res.json({
            success: true,
            message: 'Connexion réussie.',
            user: authUser,
            token: authUser.uid || authUser.email,
          });
        }
      }

      // 2. Check Supabase users table first to avoid Render/Postgres connection delays
      let dbUser = null;
      const supabaseDb = getSupabaseAdmin(req);
      if (supabaseDb) {
        try {
          const { data: sbUser } = await supabaseDb
            .from('users')
            .select('*')
            .eq('email', targetIdentifier)
            .limit(1)
            .maybeSingle();
          dbUser = mapSupabaseUser(sbUser);
        } catch (e) {}
      }

      // 3. Fallback to Database users table when Supabase REST is unavailable
      if (!dbUser && isDbConfigured()) {
        try {
          const found = await db.select().from(users).where(eq(users.email, targetIdentifier)).limit(1);
          if (found.length > 0) {
            dbUser = found[0];
          }
        } catch (e) {}
      }

      if (dbUser) {
        try {
          dbUser.email = dbUser.email || targetIdentifier;
          dbUser.name = dbUser.name || targetIdentifier.split('@')[0];
          dbUser.role = dbUser.role || 'Personnel';
        } catch (e) {}
      }

      let loginToken = dbUser?.uid || targetIdentifier;
      if (dbUser && supabaseDb) {
        try {
          const { data: authData, error: authError } = await supabaseDb.auth.signInWithPassword({
            email: targetIdentifier,
            password
          });
          if (authError || !authData?.session) {
            return res.status(401).json({
              success: false,
              error: 'Identifiants invalides.'
            });
          }
          if (authData.user?.id) {
            dbUser.uid = authData.user.id;
          }
          if (authData.session?.access_token) {
            loginToken = authData.session.access_token;
          } else if (authData.user?.id) {
            loginToken = authData.user.id;
          }
        } catch (e) {
          return res.status(401).json({
            success: false,
            error: 'Identifiants invalides.'
          });
        }
      }

      if (dbUser) {
        if (adminRoles.has(dbUser.role) && !isAdminPortal) {
          return res.status(403).json({
            success: false,
            error: "Accès refusé : L'administrateur n'est pas autorisé à se connecter depuis la page d'accueil. Veuillez utiliser le portail d'administration dédié."
          });
        }
        if (!adminRoles.has(dbUser.role) && isAdminPortal) {
          return res.status(403).json({
            success: false,
            error: "Accès refusé : ce portail est réservé aux administrateurs et co-administrateurs."
          });
        }

        if (!supabaseDb) {
          return res.status(503).json({
            success: false,
            error: 'Authentification indisponible : configurez Supabase/Auth avant de connecter des comptes.'
          });
        }

        registeredAccountsStore.set(targetIdentifier, { password, user: dbUser });
        return res.json({
          success: true,
          message: 'Connexion réussie.',
          user: dbUser,
          token: loginToken,
        });
      }

      return res.status(401).json({
        success: false,
        error: 'Identifiants invalides ou compte non reconnu par le système. Seuls les comptes et adresses emails enregistrés ont accès à cette application.',
      });
    } catch (err: any) {
      console.error('Login Endpoint Error:', err);
      res.status(500).json({ success: false, error: 'Erreur interne lors de la connexion.' });
    }
  });

  // =========================================================================
  // ONE-TIME ADMIN BOOTSTRAP ENDPOINT. Co-admins are created later by this Admin.
  // =========================================================================
  app.post('/api/auth/register-admin', async (req, res) => {
    try {
      const { name, email, phone, password, securityKey } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Le nom, l\'adresse email et le mot de passe sont obligatoires.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 6 caractères.' });
      }

      const cleanEmail = email.toLowerCase().trim();

      const supabaseAdmin = getSupabaseAdmin(req);
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

      // Persist in registered accounts memory registry for instantaneous login
      registeredAccountsStore.set(cleanEmail, {
        password: password,
        user: createdUser
      });

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
      if (!name || !email || !password || String(password).length < 6) {
        return res.status(400).json({ error: 'Nom, e-mail et mot de passe (6 caractères minimum) requis.' });
      }
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
  app.post(['/api/email/send-otp', '/api/auth/send-otp', '/api/otp/send', '/api/send-otp'], async (req, res) => {
    try {
      const { email, name, purpose, templateId, customApiKey } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Une adresse e-mail valide est requise." });
      }

      const otpCode = otpManager.generateOtp(email, purpose || 'general', { name });
      console.log(`[OTP] /api/email/send-otp called for ${email}. purpose=${purpose || 'general'} brevoKey=${process.env.BREVO_API_KEY ? 'present' : 'missing'}`);
      
      const emailResult = await sendOtpEmail({
        email,
        name: name || email.split('@')[0],
        otpCode,
        purpose: purpose || 'school_registration',
        templateId: templateId || null,
        customApiKey,
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
  app.post(['/api/email/verify-otp', '/api/auth/verify-otp', '/api/otp/verify', '/api/verify-otp'], async (req, res) => {
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

  // 3. Send Welcome Email
  app.post('/api/email/send-welcome', async (req, res) => {
    try {
      const { 
        email, name, role, schoolName, schoolIdentifier, 
        tempPassword, loginUrl, templateId, customApiKey 
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
  app.post('/api/email/send-reset-password', async (req, res) => {
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
  app.post('/api/email/confirm-reset-password', async (req, res) => {
    try {
      const { email, otpCode, newPassword, resetChallenge } = req.body;
      if (!email || !otpCode || !newPassword) {
        return res.status(400).json({ error: "Email, code OTP et nouveau mot de passe requis." });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
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
  app.get('/api/email/logs', async (req, res) => {
    try {
      const apiKey = (req.query.apiKey as string) || undefined;
      const logsResult = await getBrevoEmailLogs(apiKey);
      res.json(logsResult);
    } catch (error: any) {
      console.error("Get Email Logs Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la récupération des journaux d'email" });
    }
  });

  // 7. Verify Sender Email Address Validation in Brevo Senders Dashboard
  app.get('/api/email/senders', async (req, res) => {
    try {
      const apiKey = (req.query.apiKey as string) || undefined;
      const sendersResult = await getBrevoSenders(apiKey);
      res.json(sendersResult);
    } catch (error: any) {
      console.error("Get Brevo Senders Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la vérification de l'expéditeur Brevo" });
    }
  });

  // 8. Test Brevo API Connection & Send Test Transactional Email
  app.post('/api/email/test-brevo', async (req, res) => {
    try {
      const { apiKey, senderEmail, senderName, toEmail, templateId } = req.body || {};
      const targetApiKey = apiKey || process.env.BREVO_API_KEY;
      
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
  app.post('/api/messaging/brevo-bulk', async (req, res) => {
    try {
      const { 
        recipients, 
        channel = 'email', 
        subject, 
        message, 
        schoolName, 
        apiKey, 
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
        apiKey,
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

  app.post('/api/parent-receipts/send', async (req, res) => {
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
      const {
        recipient,
        message,
        subject,
        schoolName,
        filename = `recu-parent-${Date.now()}.pdf`,
        pdfBase64,
      } = req.body || {};

      const parentPhone = recipient?.phone || recipient?.parentPhone || '';
      const parentEmail = recipient?.email || recipient?.parentEmail || '';
      const parentName = recipient?.name || recipient?.parentName || 'Parent/Tuteur';

      const whatsappResult = parentPhone
        ? await sendWhatsAppDocument({ to: parentPhone, message, filename, pdfBase64 })
        : { success: false, channel: 'whatsapp', error: 'Aucun numéro WhatsApp parent fourni.' };

      let emailResult: any = null;
      if (!whatsappResult.success && parentEmail) {
        emailResult = await sendBrevoEmail({
          to: [{ email: parentEmail, name: parentName }],
          subject: subject || `Reçu de paiement - ${schoolName || 'EDUCO'}`,
          htmlContent: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
              <h2 style="color:#1F4A59">Reçu de paiement</h2>
              <p>Bonjour <strong>${parentName}</strong>,</p>
              <p>${String(message || '').replace(/\n/g, '<br>')}</p>
              <p>Le reçu PDF est joint à ce message.</p>
            </div>
          `,
          attachment: pdfBase64 ? [{ name: filename, content: pdfBase64 }] : undefined,
          tags: ['parent-receipt', 'payment'],
        });
      }

      return res.json({
        success: whatsappResult.success || !!emailResult?.success,
        whatsapp: whatsappResult,
        email: emailResult,
        fallbackUsed: !whatsappResult.success && !!emailResult?.success,
      });
    } catch (error: any) {
      console.error('Parent receipt delivery error:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'Erreur lors de l’envoi du reçu parent.',
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

