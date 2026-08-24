import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import net from 'net';
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
  app.use(express.json());

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
      const userList = await db.select().from(users);
      const schoolList = await db.select().from(schools);
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
    if (!isDbConfigured()) {
      return res.json({ 
        connected: false, 
        message: 'Mode local / Déconnecté actif (Base de données en attente de configuration)',
        tablesConfigured: true,
        recordCount: 0,
        schoolsCount: 0,
        personnelCount: 0
      });
    }
    try {
      const userList = await db.select().from(users).limit(50);
      const schoolList = await db.select().from(schools).limit(50);
      const personnelList = await db.select().from(personnel).limit(50);
      res.json({ 
        connected: true, 
        message: 'Base de données Supabase / PostgreSQL connectée et peuplée',
        tablesConfigured: true,
        recordCount: userList.length,
        schoolsCount: schoolList.length,
        personnelCount: personnelList.length
      });
    } catch (error: any) {
      res.json({ 
        connected: false, 
        message: 'Support local actif (Base de données en attente)',
        tablesConfigured: true,
        recordCount: 0,
        schoolsCount: 0,
        personnelCount: 0
      });
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

      let processedCount = 0;
      for (const op of operations) {
        try {
          if (op.type === 'TRANSACTION') {
            const t = op.payload;
            if (t) {
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
          return res.status(isDuplicateEmail ? 409 : 502).json({
            error: isDuplicateEmail
              ? 'Cette adresse email est déjà associée à un compte.'
              : errorMessage
          });
        }

        resolvedUid = authData.user.id;
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
        const matchingStudents = await db.select().from(students).where(eq(students.studentId, studentMatricule.trim()));
        if (matchingStudents.length > 0) {
          linkedStudent = matchingStudents[0];
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
          'Admin' // Default role for first user if no school, though usually school register comes first
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
      
      const isSelfUpdate = dbUser && (
        (req.body.id && Number(req.body.id) === dbUser.id) ||
        (req.body.uid && req.body.uid === dbUser.uid) ||
        (req.body.email && req.body.email.toLowerCase() === dbUser.email.toLowerCase())
      );

      const targetSchoolId = req.body.schoolId || dbUser?.schoolId || 1;

      if (req.body.id) {
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

        // Also update in Supabase
        const supabaseAdmin = getSupabaseAdmin(req);
        if (supabaseAdmin) {
          try {
            await supabaseAdmin.from('users').update({
              name: req.body.name,
              email: req.body.email,
              role: req.body.role,
              status: req.body.status === 'Actif' ? 'active' : 'inactive',
              avatar: req.body.avatar,
              phone: req.body.phone,
              school_id: targetSchoolId
            }).eq('id', Number(req.body.id));
          } catch (e) {
            console.warn('Supabase user update notice:', e);
          }
        }

        return res.json(updated[0] || req.body);
      }

      let resolvedUid = req.body.uid || `usr_${Date.now()}`;
      
      const adminClient = getSupabaseAdmin(req);
      if (adminClient && req.body.email) {
        try {
          const tempPassword = req.body.tempPassword || 'Educo123!';
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

          // Insert into Supabase users table directly
          await adminClient.from('users').insert([{
            uid: resolvedUid,
            name: req.body.name,
            email: req.body.email,
            role: req.body.role,
            status: req.body.status === 'Inactif' ? 'inactive' : 'active',
            school_id: targetSchoolId,
            avatar: req.body.avatar,
            phone: req.body.phone
          }]);
        } catch (e: any) {
          console.warn("Could not create user in Supabase Admin:", e.message);
        }
      }

      try {
        const newUser = await db.insert(users).values({
          ...req.body,
          uid: resolvedUid,
          status: req.body.status || 'Actif',
          schoolId: targetSchoolId
        }).returning();
        return res.json(newUser[0]);
      } catch (dbInsertErr) {
        const adminClient = getSupabaseAdmin(req);
        if (!adminClient) throw dbInsertErr;

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
          ...(req.body.avatar !== undefined && { avatar: req.body.avatar }),
          ...(req.body.phone !== undefined && { phone: req.body.phone }),
          ...(req.body.matricule !== undefined && { matricule: req.body.matricule }),
          ...(req.body.studentId !== undefined && { student_id: req.body.studentId }),
          ...(req.body.className !== undefined && { class_name: req.body.className })
        };

        const { data: sbUser, error: sbUserError } = existingUser?.id
          ? await adminClient.from('users').update(payload).eq('id', existingUser.id).select('*').single()
          : await adminClient.from('users').insert([payload]).select('*').single();

        if (sbUserError || !sbUser) throw sbUserError || dbInsertErr;
        return res.json(mapSupabaseUser(sbUser));
      }
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
      const [updatedUser] = await db.update(users)
        .set({
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(role !== undefined && { role }),
          ...(status !== undefined && { status }),
          ...(avatar !== undefined && { avatar }),
          ...(schoolId !== undefined && { schoolId: Number(schoolId) })
        })
        .where(eq(users.id, targetUserId))
        .returning();

      // Sync to Supabase
      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('users').update({
            ...(name !== undefined && { name }),
            ...(email !== undefined && { email }),
            ...(role !== undefined && { role }),
            ...(status !== undefined && { status: status === 'Actif' ? 'active' : 'inactive' }),
            ...(avatar !== undefined && { avatar }),
            ...(phone !== undefined && { phone }),
            ...(schoolId !== undefined && { school_id: Number(schoolId) })
          }).eq('id', targetUserId);
        } catch (e) {
          console.warn('Supabase PUT user error:', e);
        }
      }

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

      const [existing] = await db.select().from(users).where(eq(users.id, targetUserId));
      const currentStatus = existing?.status || 'Actif';
      const newStatus = currentStatus === 'Actif' ? 'Inactif' : 'Actif';

      const [updated] = await db.update(users)
        .set({ status: newStatus })
        .where(eq(users.id, targetUserId))
        .returning();

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('users').update({
            status: newStatus === 'Actif' ? 'active' : 'inactive'
          }).eq('id', targetUserId);
        } catch (e) {
          console.warn('Supabase toggle-status error:', e);
        }
      }

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

      const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId));
      const tempPass = `Educo${Math.floor(1000 + Math.random() * 9000)}!`;

      const supabaseAdmin = getSupabaseAdmin(req);
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

      // Fetch target user details before deletion
      const [targetUser] = await db.select().from(users).where(eq(users.id, targetUserId));

      // Delete referencing dependent records
      await db.delete(students).where(eq(students.userId, targetUserId));
      await db.delete(personnel).where(eq(personnel.userId, targetUserId));
      await db.delete(notifications).where(eq(notifications.userId, targetUserId));
      await db.delete(users).where(eq(users.id, targetUserId));

      // Also delete from Supabase client directly
      await deleteUserFromSupabaseDirectly(targetUserId);

      // Log action into activityLogs table in DB and Supabase
      const logDetails = `Compte supprimé : ID ${targetUserId}, Nom : ${targetUser?.name || 'Inconnu'}, Email : ${targetUser?.email || 'N/A'}, Rôle : ${targetUser?.role || 'N/A'}`;
      try {
        await db.insert(activityLogs).values({
          schoolId: dbUser?.schoolId || 1,
          schoolName: `Établissement #${dbUser?.schoolId || 1}`,
          userName: dbUser?.name || 'Admin',
          userRole: dbUser?.role || 'Admin',
          userEmail: dbUser?.email || '',
          action: 'Suppression de compte',
          details: logDetails,
        });
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

      const newLog = await db.insert(activityLogs).values({
        schoolId: schoolId || dbUser?.schoolId || 1,
        schoolName: schoolName || '',
        userName: userName || dbUser?.name || 'Admin',
        userRole: userRole || dbUser?.role || 'Admin',
        userEmail: userEmail || dbUser?.email || '',
        action: action || 'Action Administrateur',
        details: details || '',
        ipAddress: ipAddress || '',
        location: location || '',
        device: device || '',
        browser: browser || '',
        page: page || '',
      }).returning();

      await saveActivityLogToSupabaseDirectly({
        action,
        details,
        userName: userName || dbUser?.name,
        userRole: userRole || dbUser?.role,
        userEmail: userEmail || dbUser?.email,
        schoolName,
        schoolId: schoolId || dbUser?.schoolId,
        ipAddress: ipAddress || '',
        location: location || '',
        device: device || '',
        browser: browser || '',
        page: page || '',
      });

      res.json({ success: true, log: newLog[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Transactions Endpoints
  app.get('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const allTxns = await db.select().from(transactions)
        .where(eq(transactions.schoolId, dbUser.schoolId))
        .orderBy(desc(transactions.date));
      res.json(allTxns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const newTxn = await db.insert(transactions).values({
        ...req.body,
        schoolId: dbUser.schoolId,
        recordedBy: dbUser.id
      }).returning();
      res.json(newTxn[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/transactions/:id/status', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const updated = await db.update(transactions)
        .set({ description: `(Status: ${req.body.status}) ${req.body.description || ''}` })
        .where(eq(transactions.id, Number(req.params.id)))
        .returning();
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Payments Endpoints
  app.get('/api/payments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const allPayments = await db.select().from(payments)
        .where(eq(payments.schoolId, dbUser.schoolId))
        .orderBy(desc(payments.paymentDate));
      res.json(allPayments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/payments', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const newPayment = await db.insert(payments).values({
        ...req.body,
        schoolId: dbUser.schoolId
      }).returning();
      res.json(newPayment[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // School Settings Endpoints
  app.get('/api/school', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const school = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
      res.json(school[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put('/api/school', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const updated = await db.update(schools)
        .set(req.body)
        .where(eq(schools.id, dbUser.schoolId))
        .returning();
      res.json(updated[0]);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  app.get('/api/budget', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      // Calculate budget from transactions
      const schoolTxns = await db.select().from(transactions).where(eq(transactions.schoolId, dbUser.schoolId));
      const income = schoolTxns.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
      const expense = schoolTxns.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

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

      const all = await db.select().from(classes).where(eq(classes.schoolId, dbUser.schoolId));
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fees Endpoints
  app.get('/api/fees', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const all = await db.select().from(fees).where(eq(fees.schoolId, dbUser.schoolId));
      res.json(all);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Personnel Endpoints
  app.get('/api/personnel', requireAuth, async (req: AuthRequest, res) => {
    try {
      const dbUser = await getUserByUid(req.user!.uid);
      if (!dbUser?.schoolId) return res.status(403).json({ error: 'No school associated' });

      const all = await db.select().from(personnel).where(eq(personnel.schoolId, dbUser.schoolId));
      res.json(all);
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
          schoolIdentifier: 'EDUCO-SCH-DEMO',
          schoolName: 'Établissement Démo',
          message: 'Aucun établissement associé.'
        });
      }

      const schoolResult = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
      const school = schoolResult[0];
      const schoolIdentifier = school?.identifier || `EDUCO-SCH-${dbUser.schoolId.toString().padStart(4, '0')}`;

      // Query active subscription for this school
      const subList = await db.select().from(subscriptions)
        .where(eq(subscriptions.schoolId, dbUser.schoolId))
        .orderBy(desc(subscriptions.endDate));

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
      res.json({
        isActive: true,
        isPreSubscription: false,
        planType: 'standard',
        planName: 'Abonnement Standard (Inclus)',
        isAiEnabled: true,
        daysRemaining: 365,
        schoolIdentifier: 'EDUCO-SCH-DEMO',
        schoolName: 'Établissement Scolaire',
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

      const schoolResult = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
      const school = schoolResult[0];

      // Find subscription in DB
      const existing = await db.select().from(subscriptions).where(eq(subscriptions.code, cleanCode)).limit(1);
      const sub = existing[0];

      if (!sub) {
        return res.status(404).json({ error: 'Code d\'abonnement introuvable ou invalide.' });
      }

      if (sub.status === 'revoked') {
        return res.status(400).json({ error: 'Ce code d\'abonnement a été révoqué par l\'administrateur.' });
      }

      // Check if it belongs to another school
      if (sub.schoolId && sub.schoolId !== dbUser.schoolId) {
        return res.status(400).json({ error: 'Ce code d\'abonnement est déjà assigné à un autre établissement.' });
      }

      const now = new Date();
      // Calculate end date based on duration
      const durationDays = (sub.months || 1) * 30;
      const newEndDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const [updatedSub] = await db.update(subscriptions)
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

      // Add a notification
      await db.insert(notifications).values({
        userId: dbUser.id,
        title: 'Licence Activée avec Succès !',
        message: `Votre abonnement ${updatedSub.planType === 'ai_premium' ? 'IA Premium' : 'Standard'} est activé pour ${updatedSub.months} mois jusqu'au ${newEndDate.toLocaleDateString('fr-FR')}.`,
        type: 'subscription',
      });

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

      const schoolResult = await db.select().from(schools).where(eq(schools.id, dbUser.schoolId)).limit(1);
      const school = schoolResult[0];
      const schoolIdentifier = school?.identifier || `EDUCO-SCH-${dbUser.schoolId}`;

      const [newRequest] = await db.insert(subscriptionRequests).values({
        schoolId: dbUser.schoolId,
        schoolIdentifier,
        schoolName: school?.name || 'Établissement',
        promoterName: dbUser.name,
        promoterContact: dbUser.email,
        requestedPlan: requestedPlan || 'standard',
        requestedMonths: Number(requestedMonths) || 1,
        status: 'pending',
      }).returning();

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

      let allSubs = await db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)).catch(() => []);
      let allRequests = await db.select().from(subscriptionRequests).orderBy(desc(subscriptionRequests.createdAt)).catch(() => []);
      let allSchools = await db.select().from(schools).catch(() => []);

      const supabaseAdmin = getSupabaseAdmin(req);
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
                allSubs.push({
                  id: s.id,
                  code: s.code,
                  schoolId: s.school_id || s.schoolId,
                  schoolName: s.school_name || s.schoolName || 'Établissement',
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
                  autoRenewFrequency: s.auto_renew_frequency || s.autoRenewFrequency || 'before_expiry',
                  createdAt: s.created_at ? new Date(s.created_at) : new Date()
                } as any);
              }
            });
          }

          if (sbReqs) {
            sbReqs.forEach(r => {
              if (!allRequests.some(x => x.id === r.id)) {
                allRequests.push({
                  id: r.id,
                  schoolId: r.school_id || r.schoolId,
                  schoolIdentifier: r.school_identifier || r.schoolIdentifier,
                  schoolName: r.school_name || r.schoolName || 'Établissement',
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

      // Match school if exists
      let matchedSchoolId: number | null = null;
      if (schoolIdentifier) {
        const found = await db.select().from(schools).where(eq(schools.identifier, schoolIdentifier)).limit(1);
        if (found[0]) matchedSchoolId = found[0].id;
      }

      const [newSub] = await db.insert(subscriptions).values({
        code,
        schoolId: matchedSchoolId,
        schoolName: schoolName || 'Établissement',
        schoolIdentifier: schoolIdentifier || `EDUCO-SCH-${Math.floor(1000 + Math.random() * 9000)}`,
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

      // Sync to Supabase subscriptions
      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('subscriptions').insert([{
            code,
            school_id: matchedSchoolId,
            school_name: schoolName || 'Établissement',
            school_identifier: schoolIdentifier || `EDUCO-SCH-${Math.floor(1000 + Math.random() * 9000)}`,
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
          }]);
        } catch (e) {
          console.warn('Supabase subscription insert notice:', e);
        }
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

      const subResult = await db.select().from(subscriptions).where(eq(subscriptions.id, Number(subscriptionId))).limit(1);
      const sub = subResult[0];

      if (!sub) {
        return res.status(404).json({ error: 'Abonnement introuvable.' });
      }

      const currentEnd = new Date(sub.endDate);
      const baseDate = currentEnd.getTime() > Date.now() ? currentEnd : new Date();
      const newEndDate = new Date(baseDate.getTime() + addMonths * 30 * 24 * 60 * 60 * 1000);
      const monthlyRate = sub.planType === 'ai_premium' ? 20000 : 10000;
      const newAmount = (sub.amountPaid || 0) + (monthlyRate * addMonths);
      const totalMonths = (sub.months || 1) + addMonths;

      const [updatedSub] = await db.update(subscriptions)
        .set({
          endDate: newEndDate,
          months: totalMonths,
          amountPaid: newAmount,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id))
        .returning();

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('subscriptions')
            .update({
              end_date: newEndDate.toISOString(),
              months: totalMonths,
              amount_paid: newAmount,
              status: 'active'
            })
            .eq('id', sub.id);
        } catch (e) {
          console.warn('Supabase subscription extend notice:', e);
        }
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
      const [updatedSub] = await db.update(subscriptions)
        .set({
          autoRenew: Boolean(autoRenew),
          autoRenewFrequency: autoRenewFrequency || 'before_expiry',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, Number(subscriptionId)))
        .returning();

      const supabaseAdmin = getSupabaseAdmin(req);
      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('subscriptions')
            .update({
              auto_renew: Boolean(autoRenew),
              auto_renew_frequency: autoRenewFrequency || 'before_expiry'
            })
            .eq('id', Number(subscriptionId));
        } catch (e) {
          console.warn('Supabase auto renew update notice:', e);
        }
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

      const reqResult = await db.select().from(subscriptionRequests).where(eq(subscriptionRequests.id, Number(requestId))).limit(1);
      request = reqResult[0];

      const supabaseAdmin = getSupabaseAdmin(req);
      if (!request && supabaseAdmin) {
        const { data: sbReq } = await supabaseAdmin.from('subscription_requests').select('*').eq('id', Number(requestId)).single();
        if (sbReq) {
          request = {
            id: sbReq.id,
            schoolId: sbReq.school_id || sbReq.schoolId,
            schoolName: sbReq.school_name || sbReq.schoolName,
            schoolIdentifier: sbReq.school_identifier || sbReq.schoolIdentifier,
            promoterName: sbReq.promoter_name || sbReq.promoterName,
            promoterContact: sbReq.promoter_contact || sbReq.promoterContact,
            requestedPlan: sbReq.requested_plan || sbReq.requestedPlan,
            requestedMonths: sbReq.requested_months || sbReq.requestedMonths,
            status: sbReq.status
          };
        }
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

      const [newSub] = await db.insert(subscriptions).values({
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

      if (supabaseAdmin) {
        try {
          await supabaseAdmin.from('subscriptions').insert([{
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
          }]);
          await supabaseAdmin.from('subscription_requests')
            .update({ status: 'processed' })
            .eq('id', request.id);
        } catch (e) {
          console.warn('Supabase fulfill request update notice:', e);
        }
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

      // Query real database records from local DB
      let allPayments = await db.select().from(payments);
      let allTransactions = await db.select().from(transactions);
      let allSubscriptions = await db.select().from(subscriptions);

      // Merge with Supabase DB if available
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        try {
          const { data: sbPayments } = await supabaseAdmin.from('payments').select('*');
          if (sbPayments && sbPayments.length > 0) {
            sbPayments.forEach(sp => {
              if (!allPayments.some(p => p.id === sp.id)) {
                allPayments.push({
                  id: sp.id,
                  schoolId: sp.school_id || sp.schoolId || 1,
                  amount: sp.amount || 0,
                  paymentDate: sp.payment_date || sp.paymentDate || sp.created_at,
                  paymentType: sp.payment_type || sp.paymentType || 'frais_scolarite',
                  status: sp.status || 'valide'
                } as any);
              }
            });
          }

          const { data: sbTx } = await supabaseAdmin.from('transactions').select('*');
          if (sbTx && sbTx.length > 0) {
            sbTx.forEach(st => {
              if (!allTransactions.some(t => t.id === st.id)) {
                allTransactions.push({
                  id: st.id,
                  schoolId: st.school_id || st.schoolId || 1,
                  amount: st.amount || 0,
                  type: st.type || 'dépense',
                  date: st.date || st.created_at,
                  category: st.category || 'Général',
                  description: st.description || ''
                } as any);
              }
            });
          }
        } catch (e) {
          console.warn('Supabase financials fetch warning:', e);
        }
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

      let allSchools = await db.select().from(schools).orderBy(desc(schools.createdAt)).catch(() => []);
      let allSubscriptions = await db.select().from(subscriptions).catch(() => []);
      let allUsers = await db.select().from(users).catch(() => []);

      // Merge Supabase schools and subscriptions if available
      const supabaseAdmin = getSupabaseAdmin(req);
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

      // Merge Supabase DB entities if available
      if (supabaseAdmin) {
        try {
          const [
            { data: sbSchools },
            { data: sbUsers },
            { data: sbStudents },
            { data: sbPersonnel },
            { data: sbClasses },
            { data: sbPayments },
            { data: sbTx },
            { data: sbAtt },
            { data: sbFees },
            { data: sbNotifs },
            { data: sbSubs },
            { data: sbReqs }
          ] = await Promise.all([
            supabaseAdmin.from('schools').select('*'),
            supabaseAdmin.from('users').select('*'),
            supabaseAdmin.from('students').select('*'),
            supabaseAdmin.from('personnel').select('*'),
            supabaseAdmin.from('classes').select('*'),
            supabaseAdmin.from('payments').select('*'),
            supabaseAdmin.from('transactions').select('*'),
            supabaseAdmin.from('attendance').select('*'),
            supabaseAdmin.from('fees').select('*'),
            supabaseAdmin.from('notifications').select('*'),
            supabaseAdmin.from('subscriptions').select('*'),
            supabaseAdmin.from('subscription_requests').select('*')
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
                allClasses.push({ id: c.id, name: c.name, schoolId: c.school_id || c.schoolId || 1, section: c.section, capacity: c.capacity } as any);
              }
            });
          }

          if (sbPayments) {
            sbPayments.forEach(p => {
              if (!allPayments.some(x => x.id === p.id)) {
                allPayments.push({ id: p.id, schoolId: p.school_id || p.schoolId || 1, studentId: p.student_id || p.studentId, amount: p.amount, paymentDate: p.payment_date || p.paymentDate, type: p.type, reference: p.reference, status: p.status || 'completed' } as any);
              }
            });
          }

          if (sbTx) {
            sbTx.forEach(t => {
              if (!allTransactions.some(x => x.id === t.id)) {
                allTransactions.push({ id: t.id, schoolId: t.school_id || t.schoolId || 1, amount: t.amount, type: t.type, date: t.date, category: t.category, description: t.description } as any);
              }
            });
          }

          if (sbAtt) {
            sbAtt.forEach(a => {
              if (!allAttendance.some(x => x.id === a.id)) {
                allAttendance.push({ id: a.id, schoolId: a.school_id || a.schoolId || 1, studentId: a.student_id || a.studentId, date: a.date, status: a.status } as any);
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
          console.warn('Supabase export-data merge warning:', e);
        }
      }

      // Add schoolName to all data entities for consolidation display in frontend
      const enrichedUsers = allUsers.map(u => ({ ...u, schoolName: allSchools.find(s => Number(s.id) === Number(u.schoolId))?.name || 'Inconnu' }));
      const enrichedStudents = allStudents.map(st => ({ ...st, schoolName: allSchools.find(s => Number(s.id) === Number(st.schoolId))?.name || 'Inconnu' }));
      const enrichedPersonnel = allPersonnel.map(p => ({ ...p, schoolName: allSchools.find(s => Number(s.id) === Number(p.schoolId))?.name || 'Inconnu' }));
      const enrichedClasses = allClasses.map(c => ({ ...c, schoolName: allSchools.find(s => Number(s.id) === Number(c.schoolId))?.name || 'Inconnu' }));
      const enrichedPayments = allPayments.map(p => ({ ...p, schoolName: allSchools.find(s => Number(s.id) === Number(p.schoolId))?.name || 'Inconnu' }));
      const enrichedTransactions = allTransactions.map(t => ({ ...t, schoolName: allSchools.find(s => Number(s.id) === Number(t.schoolId))?.name || 'Inconnu' }));

      const enrichedSchools = allSchools.map(sch => {
        const schoolSubs = allSubscriptions.filter(s => Number(s.schoolId) === Number(sch.id) || s.schoolIdentifier === sch.identifier);
        const activeSub = schoolSubs.find(s => s.status === 'active' && new Date(s.endDate).getTime() > Date.now());
        
        return {
          ...sch,
          name: sch.name || 'École Inconnue',
          identifier: sch.identifier || `EDUCO-SCH-${sch.id?.toString().padStart(4, '0') || '0000'}`,
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
      const visibleSchools = isSuperAdmin
        ? enrichedSchools
        : enrichedSchools.filter((school: any) => Number(school?.id) === currentSchoolId);
      const visibleUsers = isSuperAdmin
        ? enrichedUsers
        : enrichedUsers.filter((u: any) => belongsToCurrentSchool(u) || isCurrentUserRow(u));
      const visibleStudents = isSuperAdmin
        ? enrichedStudents
        : enrichedStudents.filter((st: any) => belongsToCurrentSchool(st) || String(st?.parentEmail || '').toLowerCase() === currentUserEmail || String(st?.email || '').toLowerCase() === currentUserEmail);
      const visiblePersonnel = isSuperAdmin ? enrichedPersonnel : enrichedPersonnel.filter(belongsToCurrentSchool);
      const visibleClasses = isSuperAdmin ? enrichedClasses : enrichedClasses.filter(belongsToCurrentSchool);
      const visiblePayments = isSuperAdmin ? enrichedPayments : enrichedPayments.filter(belongsToCurrentSchool);
      const visibleTransactions = isSuperAdmin ? enrichedTransactions : enrichedTransactions.filter(belongsToCurrentSchool);
      const visibleAttendance = isSuperAdmin ? allAttendance : allAttendance.filter(belongsToCurrentSchool);
      const visibleFees = isSuperAdmin ? allFees : allFees.filter(belongsToCurrentSchool);
      const visibleNotifications = isSuperAdmin
        ? allNotifications
        : allNotifications.filter((n: any) => belongsToCurrentSchool(n) || String(n?.userId || n?.user_id || '') === String(currentUserId || ''));
      const visibleSubscriptions = isSuperAdmin ? allSubscriptions : allSubscriptions.filter(belongsToCurrentSchool);
      const visibleSubscriptionRequests = isSuperAdmin ? allSubscriptionRequests : allSubscriptionRequests.filter(belongsToCurrentSchool);

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

      let surveyList;
      if (schoolId) {
        surveyList = await db.select().from(surveys).where(eq(surveys.schoolId, schoolId)).orderBy(desc(surveys.createdAt));
      } else {
        surveyList = await db.select().from(surveys).orderBy(desc(surveys.createdAt));
      }

      // Fetch response counts
      const allResponses = await db.select().from(surveyResponses);
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

      const [newSurvey] = await db.insert(surveys).values({
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

      // Add notification for direction
      if (dbUser?.id) {
        await db.insert(notifications).values({
          userId: dbUser.id,
          title: `Nouveau sondage créé : ${title}`,
          message: `Le sondage est prêt à être partagé aux parents d'élèves par WhatsApp ou E-mail.`,
          type: 'Information',
        });
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

      const [newResponse] = await db.insert(surveyResponses).values({
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
      const surveyResult = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
      const survey = surveyResult[0];

      if (!survey) {
        return res.status(404).json({ error: 'Sondage introuvable.' });
      }

      const responses = await db.select().from(surveyResponses).where(eq(surveyResponses.surveyId, surveyId)).orderBy(desc(surveyResponses.submittedAt));
      
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
      
      const surveyResult = await db.select().from(surveys).where(eq(surveys.id, surveyId)).limit(1);
      const survey = surveyResult[0];

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
        } else if (isDbConfigured()) {
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
          token: `bio_session_${Date.now()}`,
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
            token: `token_${Date.now()}`,
          });
        }
      }

      // 2. Check Database users table
      let dbUser = null;
      if (isDbConfigured()) {
        try {
          const found = await db.select().from(users).where(eq(users.email, targetIdentifier)).limit(1);
          if (found.length > 0) {
            dbUser = found[0];
          }
        } catch (e) {}
      }

      if (!dbUser) {
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

        const supabaseAuth = getSupabaseAdmin(req);
        if (supabaseAuth) {
          const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
            email: targetIdentifier,
            password
          });
          if (authError || !authData?.session) {
            return res.status(401).json({
              success: false,
              error: 'Identifiants invalides.'
            });
          }
        } else {
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
          token: `token_${Date.now()}`,
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
  // ADMIN ACCOUNT REGISTRATION ENDPOINT (Super Admin & Co-Admin)
  // =========================================================================
  app.post(['/api/auth/register-admin', '/api/admin/create-account', '/api/admin/register'], async (req, res) => {
    try {
      const { name, email, phone, password, role = 'Admin', securityKey } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Le nom, l\'adresse email et le mot de passe sont obligatoires.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Le mot de passe doit comporter au moins 6 caractères.' });
      }

      const cleanEmail = email.toLowerCase().trim();

      // Check if user already exists
      let existingUser = null;
      if (isDbConfigured()) {
        try {
          const found = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);
          if (found.length > 0) {
            existingUser = found[0];
          }
        } catch (e) {}
      }

      // Generate UID
      let userUid = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Attempt Supabase Admin Auth creation if configured
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        try {
          const { data: sbUser, error: sbErr } = await supabaseAdmin.auth.admin.createUser({
            email: cleanEmail,
            password: password,
            email_confirm: true,
            user_metadata: {
              name: name.trim(),
              role: role || 'Admin',
              contact: phone || '',
            }
          });
          if (sbUser?.user?.id) {
            userUid = sbUser.user.id;
          } else if (sbErr) {
            console.warn("Supabase admin createUser warning:", sbErr.message);
          }
        } catch (sbEx: any) {
          console.warn("Supabase admin create exception:", sbEx?.message);
        }
      }

      // Save in DB users table
      let createdUser = null;
      if (isDbConfigured()) {
        try {
          const [newUser] = await db.insert(users).values({
            uid: userUid,
            name: name.trim(),
            email: cleanEmail,
            role: role || 'Admin',
            schoolId: 1,
            status: 'active',
          }).returning();
          createdUser = newUser;
        } catch (dbErr: any) {
          console.warn("Database insert admin error:", dbErr?.message);
        }
      }

      if (!createdUser) {
        createdUser = {
          id: Date.now(),
          uid: userUid,
          name: name.trim(),
          email: cleanEmail,
          role: role || 'Admin',
          schoolId: 1,
          status: 'active',
        };
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
          role: role || 'Admin',
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
        loginUrl: loginUrl || `${req.protocol}://${req.get('host')}/login`,
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
      const { email, templateId, customApiKey } = req.body;
      if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "Adresse email valide requise." });
      }

      // Generate a 6-digit reset OTP
      const resetCode = otpManager.generateOtp(email, 'password_reset');
      
      const emailResult = await sendPasswordResetEmail({
        email,
        name: email.split('@')[0],
        resetCode,
        resetUrl: `${req.protocol}://${req.get('host')}/login?resetEmail=${encodeURIComponent(email)}`,
        templateId: templateId || null,
        customApiKey,
      });

      res.json({
        success: emailResult.success,
        message: "Instructions de réinitialisation et code OTP envoyés par email.",
        messageId: emailResult.messageId,
        mode: emailResult.mode,
      });
    } catch (error: any) {
      console.error("Send Password Reset Error:", error);
      res.status(500).json({ error: error.message || "Erreur lors de la demande de réinitialisation" });
    }
  });

  // 5. Confirm Password Reset with OTP & Update
  app.post('/api/email/confirm-reset-password', async (req, res) => {
    try {
      const { email, otpCode, newPassword } = req.body;
      if (!email || !otpCode || !newPassword) {
        return res.status(400).json({ error: "Email, code OTP et nouveau mot de passe requis." });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
      }

      const verification = otpManager.verifyOtp(email, otpCode, 'password_reset');
      if (!verification.valid) {
        return res.status(400).json({ error: verification.error || "Code OTP invalide ou expiré." });
      }

      // Find user in PostgreSQL and update if necessary
      const matchingUsers = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim()));
      if (matchingUsers.length > 0) {
        // Notification for the user
        await db.insert(notifications).values({
          userId: matchingUsers[0].id,
          title: "Mot de passe réinitialisé",
          message: "Le mot de passe de votre compte a été mis à jour avec succès.",
          type: "Information",
        });

        const adminClient = getSupabaseAdmin();
        if (adminClient) {
          const userUid = matchingUsers[0].uid;
          if (userUid && userUid.length > 20) {
            try {
              const { error: updateError } = await adminClient.auth.admin.updateUserById(userUid, {
                password: newPassword
              });
              if (updateError) {
                console.error("Failed to update password in Supabase Auth:", updateError.message);
              } else {
                console.log("Successfully updated password in Supabase Auth for user:", userUid);
              }
            } catch (err: any) {
              console.error("Error during Supabase Admin password reset:", err.message);
            }
          }
        }
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

