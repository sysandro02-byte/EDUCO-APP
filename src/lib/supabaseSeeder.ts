import { getSupabaseClient } from './supabase';

export async function seedSupabaseDirectly() {
  return {
    success: false,
    message: 'Le peuplement automatique de donnees fictives est desactive.',
    results: {}
  };
}

export async function purgeSupabaseDirectly() {
  const supabase = getSupabaseClient();
  const results: Record<string, any> = {};

  const tablesToPurge = [
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
    'schools'
  ];

  for (const table of tablesToPurge) {
    try {
      const { error, count } = await supabase
        .from(table)
        .delete({ count: 'exact' })
        .gt('id', -999999);

      results[table] = { error: error?.message || null, count: count ?? 0 };
    } catch (err: any) {
      results[table] = { error: err?.message || String(err) };
    }
  }

  const hasErrors = Object.values(results).some((r: any) => r.error !== null);

  return {
    success: !hasErrors,
    message: hasErrors
      ? "⚠️ Purge Supabase partiellement exécutée (vérifiez les contraintes de clés étrangères si des erreurs persistent)."
      : "✅ Toutes les tables de la base de données Supabase ont été entièrement purgées !",
    results
  };
}

export async function purgeSchoolSupabaseDirectly(schoolNameOrId: string, options?: { students?: boolean; payments?: boolean; personnel?: boolean; grades?: boolean }) {
  const supabase = getSupabaseClient();
  const results: Record<string, any> = {};

  try {
    // First find school ID if exists
    let schoolId: number | null = null;
    if (!isNaN(Number(schoolNameOrId))) {
      schoolId = Number(schoolNameOrId);
    } else {
      const { data } = await supabase.from('schools').select('id, name').ilike('name', `%${schoolNameOrId}%`).maybeSingle();
      if (data?.id) {
        schoolId = data.id;
      }
    }

    const filterCol = (builder: any, colName: string = 'school_name') => {
      if (schoolId) {
        return builder.or(`school_id.eq.${schoolId},${colName}.ilike.%${schoolNameOrId}%`);
      }
      return builder.ilike(colName, `%${schoolNameOrId}%`);
    };

    // Purge related tables
    const purgeOpt = options || { students: true, payments: true, personnel: true, grades: true };

    if (purgeOpt.grades) {
      try {
        await filterCol(supabase.from('grades').delete(), 'school_name');
      } catch (e) {}
    }

    if (purgeOpt.payments) {
      try {
        await filterCol(supabase.from('payments').delete(), 'school_name');
        await filterCol(supabase.from('transactions').delete(), 'school_name');
      } catch (e) {}
    }

    if (purgeOpt.students) {
      try {
        await filterCol(supabase.from('students').delete(), 'school_name');
      } catch (e) {}
    }

    if (purgeOpt.personnel) {
      try {
        await filterCol(supabase.from('personnel').delete(), 'school_name');
      } catch (e) {}
    }

    // Purge classes, timetable, subjects, users, subscriptions
    try {
      await filterCol(supabase.from('classes').delete(), 'school_name');
      await filterCol(supabase.from('timetable').delete(), 'school_name');
      await filterCol(supabase.from('subjects').delete(), 'school_name');
      await filterCol(supabase.from('subscriptions').delete(), 'school_name');
      await filterCol(supabase.from('users').delete(), 'school_name');
    } catch (e) {}

    // Optionally delete school record if full reset requested
    if (schoolId) {
      try {
        await supabase.from('schools').delete().eq('id', schoolId);
      } catch (e) {}
    } else {
      try {
        await supabase.from('schools').delete().ilike('name', `%${schoolNameOrId}%`);
      } catch (e) {}
    }

    return {
      success: true,
      message: `✅ Les données de l'établissement "${schoolNameOrId}" ont été entièrement supprimées dans Supabase !`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erreur lors de la purge Supabase de l'établissement: ${err?.message || err}`
    };
  }
}

export async function restoreDataToSupabase(backupData: any, targetSchoolName?: string) {
  const supabase = getSupabaseClient();

  try {
    const isGlobal = !targetSchoolName || targetSchoolName === 'ALL' || targetSchoolName === 'TOUT' || targetSchoolName === 'Toute l\'application';
    const term = targetSchoolName ? targetSchoolName.toLowerCase().trim() : '';

    const matchesSchool = (item: any) => {
      if (isGlobal) return true;
      if (!item) return false;
      const nameMatch = (item.schoolName || item.school_name || item.name || '').toLowerCase().includes(term);
      const idMatch = String(item.schoolId || item.school_id || '').toLowerCase() === term;
      return nameMatch || idMatch;
    };

    const filterItems = (arr: any[]) => (Array.isArray(arr) ? arr.filter(matchesSchool) : []);

    // 1. Schools
    if (isGlobal && Array.isArray(backupData.schools) && backupData.schools.length > 0) {
      try {
        await supabase.from('schools').upsert(backupData.schools, { onConflict: 'id' });
      } catch (e) {}
    } else if (backupData.schoolSettings && matchesSchool(backupData.schoolSettings)) {
      try {
        const sch = backupData.schoolSettings;
        await supabase.from('schools').upsert([{
          id: sch.id || 1,
          name: sch.name,
          identifier: sch.identifier || 'EDUCO-SCH-RESTORED',
          address: sch.address,
          phone: sch.contact,
          email: sch.email,
          creation_date: new Date().toISOString().slice(0, 10),
          status: 'active',
          settings: sch
        }], { onConflict: 'id' });
      } catch (e) {}
    }

    // 2. Users
    const usersToRestore = filterItems(backupData.users || []);
    if (usersToRestore.length > 0) {
      try {
        await supabase.from('users').upsert(usersToRestore.map((u: any) => ({
          id: u.id,
          uid: u.uid || `user_${u.id}`,
          school_id: u.schoolId || u.school_id || 1,
          school_name: u.schoolName || u.school_name,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status || 'active',
          phone: u.phone,
          avatar: u.avatar
        })), { onConflict: 'id' });
      } catch (e) {}
    }

    // 3. Classes
    const classesToRestore = filterItems(backupData.classes || []);
    if (classesToRestore.length > 0) {
      try {
        await supabase.from('classes').upsert(classesToRestore.map((c: any) => ({
          id: c.id,
          school_id: c.schoolId || c.school_id || 1,
          school_name: c.schoolName || c.school_name,
          name: c.name,
          level: c.level,
          capacity: c.capacity,
          class_teacher: c.classTeacher || c.class_teacher
        })), { onConflict: 'id' });
      } catch (e) {}
    }

    // 4. Students
    const studentsToRestore = filterItems(backupData.students || backupData.users?.filter((u: any) => u.role === 'Élève') || []);
    if (studentsToRestore.length > 0) {
      try {
        await supabase.from('students').upsert(studentsToRestore.map((s: any) => ({
          id: s.id,
          school_id: s.schoolId || s.school_id || 1,
          school_name: s.schoolName || s.school_name,
          matricule: s.matricule || `MAT-${s.id}`,
          first_name: s.firstName || s.first_name || s.name?.split(' ')[0] || s.name,
          last_name: s.lastName || s.last_name || s.name?.split(' ').slice(1).join(' ') || '',
          gender: s.gender || 'M',
          date_of_birth: s.dateOfBirth || s.date_of_birth || '2010-01-01',
          class_name: s.className || s.class_name
        })), { onConflict: 'id' });
      } catch (e) {}
    }

    // 5. Payments
    const paymentsToRestore = filterItems(backupData.payments || []);
    if (paymentsToRestore.length > 0) {
      try {
        await supabase.from('payments').upsert(paymentsToRestore.map((p: any) => ({
          id: p.id,
          school_id: p.schoolId || p.school_id || 1,
          school_name: p.schoolName || p.school_name,
          student_name: p.studentName || p.student_name,
          amount: p.amount,
          payment_date: p.date || p.payment_date,
          payment_method: p.method || p.payment_method,
          receipt_number: p.receiptNumber || p.receipt_number
        })), { onConflict: 'id' });
      } catch (e) {}
    }

    // 6. Transactions
    const txToRestore = filterItems(backupData.transactions || []);
    if (txToRestore.length > 0) {
      try {
        await supabase.from('transactions').upsert(txToRestore.map((t: any) => ({
          id: t.id,
          school_id: t.schoolId || t.school_id || 1,
          school_name: t.schoolName || t.school_name,
          type: t.type,
          amount: t.amount,
          category: t.category,
          date: t.date,
          description: t.description
        })), { onConflict: 'id' });
      } catch (e) {}
    }

    // 7. Personnel
    const persToRestore = filterItems(backupData.personnel || []);
    if (persToRestore.length > 0) {
      try {
        await supabase.from('personnel').upsert(persToRestore.map((p: any) => ({
          id: p.id,
          school_id: p.schoolId || p.school_id || 1,
          school_name: p.schoolName || p.school_name,
          full_name: p.name || p.full_name,
          role: p.role,
          phone: p.phone,
          email: p.email
        })), { onConflict: 'id' });
      } catch (e) {}
    }

    return {
      success: true,
      message: isGlobal 
        ? "✅ Toutes les données ont été restaurées avec succès dans Supabase !" 
        : `✅ Les données de l'établissement "${targetSchoolName}" ont été restaurées avec succès dans Supabase !`
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Erreur lors de la restauration Supabase: ${err?.message || err}`
    };
  }
}

export async function deleteUserFromSupabaseDirectly(userId: number | string) {
  const supabase = getSupabaseClient();
  try {
    const idNum = Number(userId);
    if (!isNaN(idNum)) {
      await supabase.from('users').delete().eq('id', idNum);
      await supabase.from('students').delete().eq('user_id', idNum);
      await supabase.from('personnel').delete().eq('user_id', idNum);
    } else {
      await supabase.from('users').delete().eq('uid', userId);
    }
    return { success: true };
  } catch (err: any) {
    console.warn("Erreur suppression utilisateur Supabase direct:", err);
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
  const supabase = getSupabaseClient();
  try {
    const entry = {
      action: logEntry.action,
      details: logEntry.details || '',
      user_name: logEntry.userName || 'Admin',
      user_role: logEntry.userRole || 'Admin',
      user_email: logEntry.userEmail || '',
      school_name: logEntry.schoolName || '',
      school_id: logEntry.schoolId || 1,
      ip_address: logEntry.ipAddress || '',
      location: logEntry.location || '',
      device: logEntry.device || '',
      browser: logEntry.browser || '',
      page: logEntry.page || '',
      created_at: new Date().toISOString()
    };
    await supabase.from('activity_logs').insert([entry]);
    return { success: true };
  } catch (err: any) {
    console.warn("Save activity log to Supabase failed:", err);
    return { success: false };
  }
}

export async function fetchActivityLogsFromSupabaseDirectly() {
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

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
      page: item.page || ''
    }));
  } catch (err) {
    return [];
  }
}



