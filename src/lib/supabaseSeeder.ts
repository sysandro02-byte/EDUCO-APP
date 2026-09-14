import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { getApiUrl } from './apiConfig';

const isBrowser = () => typeof window !== 'undefined';

let serverClient: ReturnType<typeof createClient> | null | undefined;
const getServerSupabaseClient = () => {
  if (serverClient !== undefined) return serverClient;
  if (typeof process === 'undefined') return (serverClient = null);

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;
  let url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;

  if (!url && key?.includes('.')) {
    try {
      const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      if (payload?.ref) url = `https://${payload.ref}.supabase.co`;
    } catch {}
  }

  if (!url || !key) return (serverClient = null);
  try {
    serverClient = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  } catch {
    serverClient = null;
  }
  return serverClient;
};

const getDataClient = () => isBrowser() ? getSupabaseClient() : (getServerSupabaseClient() || getSupabaseClient());

async function getBrowserAuthToken() {
  if (!isBrowser()) return '';
  let token = localStorage.getItem('EDUCO_USER_TOKEN') || '';
  try {
    const { data } = await Promise.race([
      getSupabaseClient().auth.getSession(),
      new Promise<any>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 2000)),
    ]) as any;
    if (data?.session?.access_token) token = data.session.access_token;
  } catch {}
  return token;
}

async function browserApiRequest(path: string, init: RequestInit = {}) {
  const token = await getBrowserAuthToken();
  if (!token) throw new Error('Session administrateur requise. Reconnectez-vous à EDUCO.');

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body !== undefined && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(getApiUrl(path), { ...init, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : { error: await response.text().catch(() => '') };

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || `Opération serveur impossible (HTTP ${response.status}).`);
  }
  return data;
}

export async function seedSupabaseDirectly() {
  return {
    success: false,
    message: 'Le peuplement automatique de données fictives est désactivé.',
    results: {}
  };
}

export async function purgeSupabaseDirectly() {
  if (isBrowser()) {
    return browserApiRequest('/api/db/purge-all', { method: 'POST', body: '{}' });
  }

  const supabase = getDataClient();
  const results: Record<string, any> = {};
  const tablesToPurge = [
    'survey_responses', 'surveys', 'subscription_requests', 'subscriptions',
    'notifications', 'timetable', 'attendance', 'grades', 'subjects', 'payments',
    'transactions', 'fees', 'students', 'personnel', 'classes', 'activity_logs'
  ];

  for (const table of tablesToPurge) {
    try {
      const { error, count } = await supabase.from(table).delete({ count: 'exact' }).not('id', 'is', null);
      results[table] = { error: error?.message || null, count: count ?? 0 };
    } catch (err: any) {
      results[table] = { error: err?.message || String(err) };
    }
  }

  try {
    const { error, count } = await supabase
      .from('users')
      .delete({ count: 'exact' })
      .neq('role', 'Admin')
      .neq('role', 'Co-admin');
    results.users = { error: error?.message || null, count: count ?? 0 };
  } catch (err: any) {
    results.users = { error: err?.message || String(err) };
  }

  try {
    const { error, count } = await supabase.from('schools').delete({ count: 'exact' }).not('id', 'is', null);
    results.schools = { error: error?.message || null, count: count ?? 0 };
  } catch (err: any) {
    results.schools = { error: err?.message || String(err) };
  }

  const hasErrors = Object.values(results).some((result: any) => result.error);
  return {
    success: !hasErrors,
    message: hasErrors
      ? 'Purge serveur partiellement exécutée.'
      : 'Toutes les données applicatives ont été supprimées; les comptes Admin/Co-admin sont conservés.',
    results
  };
}

export async function purgeSchoolSupabaseDirectly(
  schoolNameOrId: string,
  options?: { students?: boolean; payments?: boolean; personnel?: boolean; grades?: boolean }
) {
  const purge = { students: true, payments: true, personnel: true, grades: true, ...options };

  if (isBrowser()) {
    const query = new URLSearchParams({
      school: String(schoolNameOrId),
      students: purge.students ? '1' : '0',
      payments: purge.payments ? '1' : '0',
      personnel: purge.personnel ? '1' : '0',
      grades: purge.grades ? '1' : '0',
    });
    return browserApiRequest(`/api/admin/maintenance/purge-school?${query.toString()}`, { method: 'DELETE' });
  }

  // Server-only compatibility path used by legacy school-deletion code. The
  // browser never reaches this block; destructive access remains server-side.
  const supabase = getDataClient();
  try {
    let schoolId: number | null = null;
    const numeric = Number(schoolNameOrId);
    if (Number.isSafeInteger(numeric) && numeric > 0) {
      schoolId = numeric;
    } else {
      const { data } = await supabase.from('schools').select('id').ilike('name', schoolNameOrId).maybeSingle();
      schoolId = data?.id ? Number(data.id) : null;
    }

    if (!schoolId) return { success: true, alreadyRemoved: true, message: 'Établissement absent.' };

    if (purge.grades) {
      const { data: students } = await supabase.from('students').select('id').eq('school_id', schoolId);
      const studentIds = (students || []).map((student: any) => student.id);
      if (studentIds.length) await supabase.from('grades').delete().in('student_id', studentIds);
    }
    if (purge.payments) {
      await supabase.from('payments').delete().eq('school_id', schoolId);
      await supabase.from('transactions').delete().eq('school_id', schoolId);
    }
    if (purge.students) await supabase.from('students').delete().eq('school_id', schoolId);
    if (purge.personnel) await supabase.from('personnel').delete().eq('school_id', schoolId);

    // Legacy server callers use this helper as part of permanent establishment
    // deletion, so preserve their old cleanup semantics on the server only.
    await supabase.from('classes').delete().eq('school_id', schoolId);
    await supabase.from('subjects').delete().eq('school_id', schoolId);
    await supabase.from('subscriptions').delete().eq('school_id', schoolId);
    await supabase.from('users').delete().eq('school_id', schoolId);
    await supabase.from('schools').delete().eq('id', schoolId);

    return { success: true, message: `Établissement ${schoolId} supprimé côté serveur.` };
  } catch (err: any) {
    return { success: false, message: err?.message || String(err) };
  }
}

export async function restoreDataToSupabase(backupData: any, targetSchoolName?: string) {
  if (isBrowser()) {
    return browserApiRequest('/api/admin/maintenance/restore', {
      method: 'POST',
      body: JSON.stringify({ backupData, targetSchoolName: targetSchoolName || 'ALL' }),
    });
  }

  const supabase = getDataClient();
  try {
    const isGlobal = !targetSchoolName || ['ALL', 'TOUT', "Toute l'application"].includes(targetSchoolName);
    const term = String(targetSchoolName || '').toLowerCase().trim();
    const matchesSchool = (item: any) => {
      if (isGlobal) return true;
      if (!item) return false;
      const name = String(item.schoolName || item.school_name || item.name || '').toLowerCase();
      const id = String(item.schoolId || item.school_id || '').toLowerCase();
      return name === term || id === term;
    };
    const filterItems = (items: any[]) => Array.isArray(items) ? items.filter(matchesSchool) : [];

    if (isGlobal && Array.isArray(backupData.schools) && backupData.schools.length) {
      await supabase.from('schools').upsert(backupData.schools, { onConflict: 'id' });
    }

    const users = filterItems(backupData.users || []).filter((user: any) => !/^(Admin|Co-admin)$/i.test(String(user.role || '')));
    if (users.length) {
      await supabase.from('users').upsert(users.map((user: any) => ({
        id: user.id,
        uid: user.uid || `restored_${user.id}`,
        school_id: user.schoolId || user.school_id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status || 'active',
        avatar: user.avatar,
      })), { onConflict: 'id' });
    }

    const classes = filterItems(backupData.classes || []);
    if (classes.length) await supabase.from('classes').upsert(classes.map((item: any) => ({
      id: item.id, school_id: item.schoolId || item.school_id, name: item.name,
      level: item.level || item.section, capacity: item.capacity || item.maxStudents,
      teacher_id: item.teacherId || item.teacher_id,
    })), { onConflict: 'id' });

    const students = filterItems(backupData.students || []);
    if (students.length) await supabase.from('students').upsert(students.map((item: any) => ({
      id: item.id, user_id: item.userId || item.user_id, school_id: item.schoolId || item.school_id,
      student_id: item.studentId || item.student_id || item.matricule, class_id: item.classId || item.class_id,
      parent_name: item.parentName || item.parent_name, parent_phone: item.parentPhone || item.parent_phone,
      address: item.address, date_of_birth: item.dateOfBirth || item.date_of_birth, status: item.status || 'active',
    })), { onConflict: 'id' });

    const payments = filterItems(backupData.payments || []);
    if (payments.length) await supabase.from('payments').upsert(payments.map((item: any) => ({
      id: item.id, school_id: item.schoolId || item.school_id, student_id: item.studentRecordId || item.student_id || item.studentId,
      fee_id: item.feeId || item.fee_id, amount: Number(item.amount || 0), payment_date: item.paymentDate || item.payment_date || item.date,
      receipt_number: item.receiptNumber || item.receipt_number, payment_method: item.paymentMethod || item.payment_method || item.method,
      status: item.status || 'paid',
    })), { onConflict: 'id' });

    const transactions = filterItems(backupData.transactions || []);
    if (transactions.length) await supabase.from('transactions').upsert(transactions.map((item: any) => ({
      id: item.id, school_id: item.schoolId || item.school_id, type: item.type, category: item.category,
      amount: Number(item.amount || 0), description: item.description, date: item.date, recorded_by: item.recordedBy || item.recorded_by,
    })), { onConflict: 'id' });

    const personnel = filterItems(backupData.personnel || []);
    if (personnel.length) await supabase.from('personnel').upsert(personnel.map((item: any) => ({
      id: item.id, user_id: item.userId || item.user_id, school_id: item.schoolId || item.school_id,
      matricule: item.matricule, role: item.role, base_salary: Number(item.baseSalary ?? item.base_salary ?? item.salary ?? 0),
      hire_date: item.hireDate || item.hire_date, bank_account: item.bankAccount || item.bank_account,
    })), { onConflict: 'id' });

    return { success: true, message: 'Restauration serveur terminée.' };
  } catch (err: any) {
    return { success: false, message: `Erreur lors de la restauration Supabase: ${err?.message || err}` };
  }
}

export async function deleteUserFromSupabaseDirectly(userId: number | string) {
  if (isBrowser()) {
    const query = new URLSearchParams({ user: String(userId) });
    return browserApiRequest(`/api/admin/maintenance/delete-user?${query.toString()}`, { method: 'DELETE' });
  }

  const supabase = getDataClient();
  try {
    const numeric = Number(userId);
    if (Number.isSafeInteger(numeric) && numeric > 0) {
      await supabase.from('users').delete().eq('id', numeric);
    } else {
      await supabase.from('users').delete().eq('uid', String(userId));
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Erreur suppression utilisateur Supabase serveur:', err);
    return { success: false, error: err?.message };
  }
}

export async function saveActivityLogToSupabaseDirectly(logEntry: {
  action: string;
  details?: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  schoolName?: string;
  schoolId?: number;
  ipAddress?: string;
  location?: string;
  device?: string;
  browser?: string;
  page?: string;
}) {
  if (isBrowser()) {
    return browserApiRequest('/api/activity-logs', { method: 'POST', body: JSON.stringify(logEntry) });
  }

  const supabase = getDataClient();
  try {
    const { error } = await supabase.from('activity_logs').insert([{
      action: logEntry.action,
      details: logEntry.details || '',
      user_name: logEntry.userName || 'Admin',
      user_role: logEntry.userRole || 'Admin',
      user_email: logEntry.userEmail || '',
      school_name: logEntry.schoolName || '',
      school_id: logEntry.schoolId || null,
      ip_address: logEntry.ipAddress || '',
      location: logEntry.location || '',
      device: logEntry.device || '',
      browser: logEntry.browser || '',
      page: logEntry.page || '',
      created_at: new Date().toISOString(),
    }]);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.warn('Save activity log to Supabase failed:', err);
    return { success: false, error: err?.message };
  }
}

export async function fetchActivityLogsFromSupabaseDirectly() {
  if (isBrowser()) {
    const data = await browserApiRequest('/api/activity-logs', { method: 'GET' });
    return Array.isArray(data) ? data : (Array.isArray(data?.logs) ? data.logs : []);
  }

  const supabase = getDataClient();
  try {
    const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (error || !data) return [];
    return data.map((item: any) => ({
      id: item.id || `log_${Date.now()}_${Math.random()}`,
      timestamp: item.created_at || new Date().toISOString(),
      user: item.user_name || 'Inconnu',
      role: item.user_role || 'Admin',
      email: item.user_email || '',
      schoolName: item.school_name || '',
      action: item.action,
      details: item.details || '',
      ipAddress: item.ip_address || '',
      location: item.location || '',
      device: item.device || '',
      browser: item.browser || '',
      page: item.page || '',
    }));
  } catch {
    return [];
  }
}
