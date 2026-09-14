import crypto from 'node:crypto';
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const protectedDatabasePaths = new Set([
  '/api/db/accounts',
  '/api/db/query',
  '/api/db/seed-all',
  '/api/db/purge-all',
  '/api/db/test-create-school',
  '/api/db/init-seed',
]);

const maintenancePaths = new Set([
  '/api/admin/maintenance/purge-school',
  '/api/admin/maintenance/restore',
  '/api/admin/maintenance/delete-user',
]);

const normalizeRole = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[\s_-]+/g, ' ')
  .trim();

const isAdministrator = (role) => {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'co admin';
};

const decodeJwtPayload = (token) => {
  if (!token || !token.includes('.')) return null;
  try {
    const parts = token.split('.');
    const payload = parts.length === 2 ? parts[0] : parts[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
};

const verifyEducoSession = (token) => {
  const secret = process.env.AUTH_SESSION_SECRET || process.env.OTP_SIGNING_SECRET;
  if (!secret || !token || token.split('.').length !== 2) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const givenBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (givenBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(givenBuffer, expectedBuffer)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (session.typ !== 'educo-session' || Number(session.exp) <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
};

const getSupabaseUrl = (key) => {
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url && key) {
    const ref = decodeJwtPayload(key)?.ref;
    if (ref) url = `https://${ref}.supabase.co`;
  }
  return url || null;
};

let authClient;
const getAuthClient = () => {
  if (authClient !== undefined) return authClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || process.env.SUPABASE_KEY;
  const url = getSupabaseUrl(key);
  if (!url || !key) return (authClient = null);
  try {
    authClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  } catch {
    authClient = null;
  }
  return authClient;
};

let maintenanceClient;
const getMaintenanceClient = () => {
  if (maintenanceClient !== undefined) return maintenanceClient;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = getSupabaseUrl(key);
  const legacyServiceRole = decodeJwtPayload(key)?.role === 'service_role';
  const modernServerSecret = typeof key === 'string' && key.startsWith('sb_secret_');
  if (!url || !key || (!legacyServiceRole && !modernServerSecret)) return (maintenanceClient = null);
  try {
    maintenanceClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  } catch {
    maintenanceClient = null;
  }
  return maintenanceClient;
};

const lookupRole = async (email, fallbackRole) => {
  const client = getAuthClient();
  if (!client || !email) return fallbackRole;
  try {
    const { data } = await client
      .from('users')
      .select('role,status')
      .eq('email', String(email).toLowerCase())
      .limit(1)
      .maybeSingle();
    if (!data || String(data.status || 'active').toLowerCase() !== 'active') return null;
    return data.role || fallbackRole;
  } catch {
    return fallbackRole;
  }
};

const authorizeDatabaseRequest = async (req) => {
  const header = String(req.headers?.authorization || '');
  if (!header.startsWith('Bearer ')) return { ok: false, status: 401, error: 'Authentification administrateur requise.' };
  const token = header.slice(7).trim();
  if (!token) return { ok: false, status: 401, error: 'Session administrateur manquante.' };

  const localSession = verifyEducoSession(token);
  if (localSession) {
    const role = await lookupRole(localSession.email, localSession.role);
    return isAdministrator(role)
      ? { ok: true, email: localSession.email, role }
      : { ok: false, status: 403, error: 'Accès réservé aux administrateurs EDUCO.' };
  }

  const client = getAuthClient();
  const jwtPayload = decodeJwtPayload(token);
  if (!client || !jwtPayload) return { ok: false, status: 401, error: 'Session invalide ou expirée.' };

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.email) return { ok: false, status: 401, error: 'Session invalide ou expirée.' };
    const role = await lookupRole(data.user.email, data.user.user_metadata?.role);
    return isAdministrator(role)
      ? { ok: true, email: data.user.email, role }
      : { ok: false, status: 403, error: 'Accès réservé aux administrateurs EDUCO.' };
  } catch {
    return { ok: false, status: 401, error: 'Session invalide ou expirée.' };
  }
};

const allowedOrigins = [
  process.env.CORS_ALLOWED_ORIGINS || process.env.PUBLIC_APP_URL || 'https://educo-app.vercel.app,https://educo.loukatech.com',
  process.env.RENDER_EXTERNAL_URL || 'https://educo-app.onrender.com',
]
  .filter(Boolean)
  .flatMap((value) => String(value).split(','))
  .map((value) => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

const applyCors = (req, res) => {
  const origin = String(req.headers?.origin || '').replace(/\/$/, '');
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
};

const sendJson = (req, res, status, payload) => {
  if (res.headersSent) return;
  applyCors(req, res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req, maxBytes = 8 * 1024 * 1024) => new Promise((resolve, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > maxBytes) {
      reject(Object.assign(new Error('Corps de requête trop volumineux.'), { status: 413 }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    try {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      resolve(raw ? JSON.parse(raw) : {});
    } catch {
      reject(Object.assign(new Error('JSON invalide.'), { status: 400 }));
    }
  });
  req.on('error', reject);
});

const compact = (value) => Object.fromEntries(
  Object.entries(value || {}).filter(([, item]) => item !== undefined)
);

const missingTable = (error) => error?.code === '42P01' || /does not exist|not found/i.test(String(error?.message || ''));

const runDelete = async (results, name, operation) => {
  try {
    const { error, count } = await operation();
    if (error && !missingTable(error)) throw error;
    results[name] = { success: true, count: count ?? null, skipped: Boolean(error) };
  } catch (error) {
    results[name] = { success: false, error: error?.message || String(error) };
  }
};

const safePurgeAll = async () => {
  const client = getMaintenanceClient();
  if (!client) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY est requise pour la maintenance.'), { status: 503 });

  const results = {};
  const tables = [
    'survey_responses', 'surveys', 'subscription_requests', 'subscriptions',
    'notifications', 'timetable', 'attendance', 'grades', 'subjects',
    'payments', 'transactions', 'fees', 'students', 'personnel', 'classes',
    'activity_logs'
  ];

  for (const table of tables) {
    await runDelete(results, table, () => client.from(table).delete({ count: 'exact' }).not('id', 'is', null));
  }

  await runDelete(results, 'users', () => client
    .from('users')
    .delete({ count: 'exact' })
    .neq('role', 'Admin')
    .neq('role', 'Co-admin'));

  await runDelete(results, 'schools', () => client.from('schools').delete({ count: 'exact' }).not('id', 'is', null));

  const failures = Object.entries(results).filter(([, result]) => !result.success);
  if (failures.length) {
    const error = new Error(`Purge partielle : ${failures.map(([name]) => name).join(', ')}.`);
    error.status = 500;
    error.results = results;
    throw error;
  }

  return {
    success: true,
    message: 'Toutes les données applicatives ont été supprimées. Les comptes Admin/Co-admin ont été conservés.',
    results,
  };
};

const resolveSchool = async (client, reference) => {
  const raw = String(reference || '').trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const { data } = await client.from('schools').select('id,name,identifier').eq('id', Number(raw)).maybeSingle();
    if (data) return data;
  }

  const { data: byIdentifier } = await client.from('schools').select('id,name,identifier').eq('identifier', raw).maybeSingle();
  if (byIdentifier) return byIdentifier;

  const { data: byName } = await client.from('schools').select('id,name,identifier').ilike('name', raw).maybeSingle();
  return byName || null;
};

const ids = (rows, key = 'id') => (rows || [])
  .map((row) => Number(row?.[key]))
  .filter((value) => Number.isSafeInteger(value) && value > 0);

const deleteIds = async (client, table, column, values) => {
  if (!values.length) return;
  const { error } = await client.from(table).delete().in(column, values);
  if (error && !missingTable(error)) throw error;
};

const purgeSchoolData = async (reference, options = {}) => {
  const client = getMaintenanceClient();
  if (!client) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY est requise pour la maintenance.'), { status: 503 });

  const school = await resolveSchool(client, reference);
  if (!school) {
    return { success: true, alreadyRemoved: true, message: 'Établissement déjà absent : aucune donnée à réinitialiser.' };
  }

  const purge = { students: true, payments: true, personnel: true, grades: true, ...options };
  const [{ data: studentRows }, { data: personnelRows }, { data: classRows }] = await Promise.all([
    client.from('students').select('id,user_id').eq('school_id', school.id),
    client.from('personnel').select('id,user_id').eq('school_id', school.id),
    client.from('classes').select('id').eq('school_id', school.id),
  ]);

  const studentIds = ids(studentRows);
  const studentUserIds = ids(studentRows, 'user_id');
  const personnelUserIds = ids(personnelRows, 'user_id');
  const classIds = ids(classRows);

  if (purge.grades) {
    await deleteIds(client, 'grades', 'student_id', studentIds);
    await deleteIds(client, 'grades', 'class_id', classIds);
  }

  if (purge.payments) {
    const { error: paymentError } = await client.from('payments').delete().eq('school_id', school.id);
    if (paymentError && !missingTable(paymentError)) throw paymentError;
    const { error: transactionError } = await client.from('transactions').delete().eq('school_id', school.id);
    if (transactionError && !missingTable(transactionError)) throw transactionError;
  }

  if (purge.students) {
    await deleteIds(client, 'attendance', 'student_id', studentIds);
    const { error: studentError } = await client.from('students').delete().eq('school_id', school.id);
    if (studentError && !missingTable(studentError)) throw studentError;
    if (studentUserIds.length) {
      const { error: userError } = await client.from('users').delete().in('id', studentUserIds);
      if (userError && !missingTable(userError)) throw userError;
    }
  }

  if (purge.personnel) {
    const { error: personnelError } = await client.from('personnel').delete().eq('school_id', school.id);
    if (personnelError && !missingTable(personnelError)) throw personnelError;

    if (personnelUserIds.length) {
      const { data: removableUsers, error: lookupError } = await client
        .from('users')
        .select('id,role')
        .in('id', personnelUserIds);
      if (lookupError && !missingTable(lookupError)) throw lookupError;
      const removableIds = (removableUsers || [])
        .filter((user) => !['admin', 'co admin', 'promoteur'].includes(normalizeRole(user.role)))
        .map((user) => user.id);
      if (removableIds.length) {
        const { error: userError } = await client.from('users').delete().in('id', removableIds);
        if (userError && !missingTable(userError)) throw userError;
      }
    }
  }

  return {
    success: true,
    schoolId: school.id,
    schoolName: school.name,
    message: `Les données sélectionnées de « ${school.name} » ont été réinitialisées sans supprimer l'établissement.`,
  };
};

const normalizeRestoredRows = (table, items, forcedSchoolId) => {
  const list = Array.isArray(items) ? items : [];
  const schoolId = (item) => forcedSchoolId ?? item.schoolId ?? item.school_id;

  if (table === 'schools') return list.map((school) => compact({
    id: school.id,
    name: school.name,
    identifier: school.identifier,
    address: school.address,
    phone: school.phone || school.contact,
    email: school.email,
    promoter_name: school.promoterName || school.promoter_name,
    promoter_contact: school.promoterContact || school.promoter_contact,
    promoter_email: school.promoterEmail || school.promoter_email,
    status: school.status || 'active',
    settings: school.settings,
  }));

  if (table === 'users') return list
    .filter((user) => !['admin', 'co admin'].includes(normalizeRole(user.role)))
    .map((user) => compact({
      id: user.id,
      uid: user.uid || (user.id ? `restored_${user.id}` : undefined),
      school_id: schoolId(user),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status || 'active',
      phone: user.phone || user.contact,
      avatar: user.avatar,
    }));

  if (table === 'classes') return list.map((item) => compact({
    id: item.id,
    school_id: schoolId(item),
    name: item.name,
    level: item.level || item.section,
    capacity: item.capacity || item.maxStudents,
    teacher_id: item.teacherId || item.teacher_id,
  }));

  if (table === 'students') return list.map((item) => compact({
    id: item.id,
    user_id: item.userId || item.user_id,
    school_id: schoolId(item),
    student_id: item.studentId || item.student_id || item.matricule,
    class_id: item.classId || item.class_id,
    parent_name: item.parentName || item.parent_name,
    parent_phone: item.parentPhone || item.parent_phone,
    address: item.address,
    date_of_birth: item.dateOfBirth || item.date_of_birth,
    status: item.status || 'active',
  }));

  if (table === 'payments') return list.map((item) => compact({
    id: item.id,
    school_id: schoolId(item),
    student_id: item.studentRecordId || item.student_id || item.studentId,
    fee_id: item.feeId || item.fee_id,
    amount: Number(item.amount || item.amountPaid || 0),
    payment_date: item.paymentDate || item.payment_date || item.date,
    receipt_number: item.receiptNumber || item.receipt_number,
    payment_method: item.paymentMethod || item.payment_method || item.method,
    status: item.status || 'paid',
  }));

  if (table === 'transactions') return list.map((item) => compact({
    id: item.id,
    school_id: schoolId(item),
    type: item.type,
    category: item.category,
    amount: Number(item.amount || 0),
    description: item.description,
    date: item.date,
    recorded_by: item.recordedBy || item.recorded_by,
  }));

  if (table === 'personnel') return list.map((item) => compact({
    id: item.id,
    user_id: item.userId || item.user_id,
    school_id: schoolId(item),
    matricule: item.matricule,
    role: item.role,
    base_salary: Number(item.baseSalary ?? item.base_salary ?? item.salary ?? 0),
    hire_date: item.hireDate || item.hire_date,
    bank_account: item.bankAccount || item.bank_account,
  }));

  return [];
};

const restoreBackup = async (body) => {
  const client = getMaintenanceClient();
  if (!client) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY est requise pour la restauration.'), { status: 503 });

  const backupData = body?.backupData;
  if (!backupData || typeof backupData !== 'object') throw Object.assign(new Error('Sauvegarde invalide.'), { status: 400 });

  const target = String(body?.targetSchoolName || 'ALL').trim();
  const globalRestore = !target || ['ALL', 'TOUT', "Toute l'application"].includes(target);
  const targetSchool = globalRestore ? null : await resolveSchool(client, target);
  if (!globalRestore && !targetSchool) throw Object.assign(new Error('Établissement cible introuvable.'), { status: 404 });

  const source = { ...backupData };
  if (!source.students && Array.isArray(source.users)) {
    source.students = source.users.filter((user) => normalizeRole(user.role) === 'eleve');
  }

  const tables = ['schools', 'users', 'classes', 'students', 'payments', 'transactions', 'personnel'];
  const restored = {};

  for (const table of tables) {
    if (table === 'schools' && !globalRestore) continue;
    let items = Array.isArray(source[table]) ? source[table] : [];
    if (!globalRestore) {
      items = items.filter((item) => {
        const itemSchoolId = Number(item?.schoolId ?? item?.school_id);
        const itemSchoolName = String(item?.schoolName ?? item?.school_name ?? '').trim();
        return itemSchoolId === Number(targetSchool.id) || itemSchoolName.toLowerCase() === String(targetSchool.name).toLowerCase();
      });
    }
    const rows = normalizeRestoredRows(table, items, targetSchool?.id);
    if (!rows.length) {
      restored[table] = 0;
      continue;
    }
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error && !missingTable(error)) throw Object.assign(new Error(`Restauration ${table}: ${error.message}`), { status: 422 });
    restored[table] = rows.length;
  }

  return {
    success: true,
    restored,
    message: globalRestore
      ? 'Sauvegarde restaurée côté serveur avec contrôle administrateur.'
      : `Sauvegarde restaurée pour « ${targetSchool.name} » sans accès Supabase direct depuis le navigateur.`,
  };
};

const deleteUser = async (reference) => {
  const client = getMaintenanceClient();
  if (!client) throw Object.assign(new Error('SUPABASE_SERVICE_ROLE_KEY est requise pour la maintenance.'), { status: 503 });
  const raw = String(reference || '').trim();
  if (!raw) throw Object.assign(new Error('Utilisateur requis.'), { status: 400 });

  let query = client.from('users').select('id,uid,role').limit(1);
  query = /^\d+$/.test(raw) ? query.eq('id', Number(raw)) : query.eq('uid', raw);
  const { data: user, error } = await query.maybeSingle();
  if (error) throw error;
  if (!user) return { success: true, alreadyRemoved: true };
  if (isAdministrator(user.role)) throw Object.assign(new Error('Un compte administrateur central ne peut pas être supprimé par cette opération.'), { status: 403 });

  const { error: deleteError } = await client.from('users').delete().eq('id', user.id);
  if (deleteError) throw deleteError;
  return { success: true };
};

const handleMaintenance = async (req, res, pathname, parsedUrl) => {
  const authorization = await authorizeDatabaseRequest(req);
  if (!authorization.ok) {
    sendJson(req, res, authorization.status, { success: false, error: authorization.error });
    return;
  }

  try {
    if (pathname === '/api/db/purge-all' && req.method === 'POST') {
      sendJson(req, res, 200, await safePurgeAll());
      return;
    }

    if (pathname === '/api/admin/maintenance/purge-school' && req.method === 'DELETE') {
      const options = {
        students: parsedUrl.searchParams.get('students') !== '0',
        payments: parsedUrl.searchParams.get('payments') !== '0',
        personnel: parsedUrl.searchParams.get('personnel') !== '0',
        grades: parsedUrl.searchParams.get('grades') !== '0',
      };
      sendJson(req, res, 200, await purgeSchoolData(parsedUrl.searchParams.get('school'), options));
      return;
    }

    if (pathname === '/api/admin/maintenance/restore' && req.method === 'POST') {
      const body = await readJsonBody(req);
      sendJson(req, res, 200, await restoreBackup(body));
      return;
    }

    if (pathname === '/api/admin/maintenance/delete-user' && req.method === 'DELETE') {
      sendJson(req, res, 200, await deleteUser(parsedUrl.searchParams.get('user')));
      return;
    }

    sendJson(req, res, 405, { success: false, error: 'Méthode non autorisée.' });
  } catch (error) {
    sendJson(req, res, Number(error?.status) || 500, {
      success: false,
      error: error?.message || 'Erreur de maintenance.',
      ...(error?.results ? { results: error.results } : {}),
    });
  }
};

// server.ts contains legacy DB diagnostic/maintenance endpoints that predate the
// modern route-level authorization layer. Patch the Express application entry
// point before the app is created so sensitive routes always require a verified
// Admin/Co-admin session. Destructive maintenance is handled here with the
// service-role key and never trusts project credentials supplied by the browser.
const originalHandle = express.application.handle;
express.application.handle = function educoGuardedHandle(req, res, callback) {
  let parsedUrl;
  let pathname = '';
  try {
    parsedUrl = new URL(req.url || '/', 'http://localhost');
    pathname = parsedUrl.pathname;
  } catch {
    parsedUrl = new URL('/', 'http://localhost');
    pathname = String(req.url || '').split('?')[0];
  }

  if (req.method === 'OPTIONS') {
    return originalHandle.call(this, req, res, callback);
  }

  if ((pathname === '/api/db/purge-all' && req.method === 'POST') || maintenancePaths.has(pathname)) {
    void handleMaintenance(req, res, pathname, parsedUrl);
    return;
  }

  if (!protectedDatabasePaths.has(pathname)) {
    return originalHandle.call(this, req, res, callback);
  }

  void authorizeDatabaseRequest(req).then((result) => {
    if (result.ok) {
      originalHandle.call(this, req, res, callback);
      return;
    }
    sendJson(req, res, result.status, { success: false, error: result.error });
  }).catch(() => {
    sendJson(req, res, 500, { success: false, error: 'Erreur de contrôle d’accès.' });
  });
};
