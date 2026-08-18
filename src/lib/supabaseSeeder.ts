import { getSupabaseClient } from './supabase';

export async function seedSupabaseDirectly() {
  const supabase = getSupabaseClient();
  const results: Record<string, any> = {};

  try {
    // 1. Seed Schools
    const schoolsData = [
      {
        id: 1,
        name: "Complexe Scolaire EDUCO Excelsior",
        identifier: "EDUCO-SCH-8492",
        address: "Avenue Ganhi, Cotonou, Bénin",
        phone: "+229 97 00 11 22",
        email: "contact@educo-excelsior.com",
        creation_date: "2020-09-15",
        promoter_name: "Dr. Marc TEST-PROMOTEUR",
        promoter_contact: "+229 95 88 77 66",
        promoter_email: "promoteur@educo-ecole.com",
        levels: { maternelle: true, primaire: true, secondaireCollege: true, secondaireLycee: true },
        status: "active",
        settings: { currency: "FCFA", academicYear: "2025-2026" }
      },
      {
        id: 2,
        name: "Lycée Blaise Pascal",
        identifier: "EDUCO-SCH-1002",
        address: "Quartier Haie Vive, Cotonou",
        phone: "+229 21 30 15 80",
        email: "contact@lycee-blaise.com",
        creation_date: "2018-10-01",
        promoter_name: "Prof. Alain SOSSOU",
        promoter_contact: "+229 96 11 22 33",
        promoter_email: "alain.sossou@lycee-blaise.com",
        levels: { secondaireCollege: true, secondaireLycee: true },
        status: "active",
        settings: { currency: "FCFA" }
      }
    ];

    const { error: schErr } = await supabase
      .from('schools')
      .upsert(schoolsData, { onConflict: 'id' });
    results.schools = { count: schoolsData.length, error: schErr?.message || null };

    // 2. Seed Users
    const usersData = [
      { id: 1, uid: "admin_seed_001", school_id: 1, name: "M. Auguste LOUKOU", email: "admin@educo-ecole.com", role: "Admin", status: "active" },
      { id: 2, uid: "promoter_seed_001", school_id: 1, name: "Dr. Marc TEST-PROMOTEUR", email: "promoteur@educo-ecole.com", role: "Promoteur", status: "active" },
      { id: 3, uid: "cashier_seed_001", school_id: 1, name: "Mme Fatou SOW", email: "caisse@educo-ecole.com", role: "Caissière", status: "active" },
      { id: 4, uid: "raf_seed_001", school_id: 1, name: "M. Ibrahim DIOP", email: "raf@educo-ecole.com", role: "Responsable des finances", status: "active" },
      { id: 5, uid: "de_seed_001", school_id: 1, name: "M. Jean-Paul KOFFI", email: "de@educo-ecole.com", role: "Directeur des Etudes", status: "active" },
      { id: 6, uid: "teacher_seed_001", school_id: 1, name: "M. Robert OKEMBA", email: "enseignant@educo-ecole.com", role: "Enseignant", status: "active" },
      { id: 7, uid: "student_seed_001", school_id: 1, name: "Amadou DIOP", email: "amadou.diop@educo-ecole.com", role: "Élève", status: "active" },
      { id: 8, uid: "student_seed_002", school_id: 1, name: "Marie KOFFI", email: "marie.koffi@educo-ecole.com", role: "Élève", status: "active" },
      { id: 9, uid: "parent_seed_001", school_id: 1, name: "Mme Charlotte KOFFI", email: "parent@educo-ecole.com", role: "Parent", status: "active" }
    ];

    const { error: usrErr } = await supabase
      .from('users')
      .upsert(usersData, { onConflict: 'id' });
    results.users = { count: usersData.length, error: usrErr?.message || null };

    // 3. Seed Classes
    const classesData = [
      { id: 1, school_id: 1, name: "6ème A", level: "Collège", capacity: 45 },
      { id: 2, school_id: 1, name: "5ème B", level: "Collège", capacity: 42 },
      { id: 3, school_id: 1, name: "4ème C", level: "Collège", capacity: 40 },
      { id: 4, school_id: 1, name: "3ème A", level: "Collège", capacity: 38 },
      { id: 5, school_id: 1, name: "2nde C", level: "Lycée", capacity: 35 },
      { id: 6, school_id: 1, name: "1ère D", level: "Lycée", capacity: 36 },
      { id: 7, school_id: 1, name: "Tle D", level: "Lycée", capacity: 32 }
    ];

    const { error: clsErr } = await supabase
      .from('classes')
      .upsert(classesData, { onConflict: 'id' });
    results.classes = { count: classesData.length, error: clsErr?.message || null };

    // 4. Seed Fees
    const feesData = [
      { id: 1, school_id: 1, name: "Scolarité 1ère Tranche", amount: 150000, type: "tuition", due_date: "2025-10-15" },
      { id: 2, school_id: 1, name: "Scolarité 2ème Tranche", amount: 100000, type: "tuition", due_date: "2026-01-15" },
      { id: 3, school_id: 1, name: "Frais d'Inscription", amount: 25000, type: "registration", due_date: "2025-09-01" },
      { id: 4, school_id: 1, name: "Uniforme & Fournitures", amount: 35000, type: "other", due_date: "2025-09-10" }
    ];

    const { error: feesErr } = await supabase
      .from('fees')
      .upsert(feesData, { onConflict: 'id' });
    results.fees = { count: feesData.length, error: feesErr?.message || null };

    // 5. Seed Personnel
    const personnelData = [
      { id: 1, school_id: 1, user_id: 6, matricule: "PER-2026-001", role: "Enseignant Mathématiques", base_salary: 280000, hire_date: "2022-09-01" },
      { id: 2, school_id: 1, user_id: 3, matricule: "PER-2026-002", role: "Caissière Principale", base_salary: 200000, hire_date: "2023-01-15" },
      { id: 3, school_id: 1, user_id: 4, matricule: "PER-2026-003", role: "Responsable Administratif et Financier (RAF)", base_salary: 450000, hire_date: "2021-09-01" }
    ];

    const { error: persErr } = await supabase
      .from('personnel')
      .upsert(personnelData, { onConflict: 'id' });
    results.personnel = { count: personnelData.length, error: persErr?.message || null };

    // 6. Seed Students
    const studentsData = [
      { id: 1, school_id: 1, user_id: 7, student_id: "MAT-2026-001", class_id: 1, parent_name: "M. Ousmane DIOP", parent_phone: "+229 97 11 22 33", address: "Cotonou Ganhi", date_of_birth: "2010-05-14", enrollment_date: "2025-09-01", status: "active" },
      { id: 2, school_id: 1, user_id: 8, student_id: "MAT-2026-002", class_id: 2, parent_name: "Mme Charlotte KOFFI", parent_phone: "+229 96 44 55 66", address: "Cotonou Haie Vive", date_of_birth: "2011-08-22", enrollment_date: "2025-09-01", status: "active" }
    ];

    const { error: stdErr } = await supabase
      .from('students')
      .upsert(studentsData, { onConflict: 'id' });
    results.students = { count: studentsData.length, error: stdErr?.message || null };

    // 7. Seed Transactions
    const transactionsData = [
      { id: 1, school_id: 1, type: "income", category: "Scolarité", amount: 150000, description: "Versement Scolarité 1ère Tranche - Amadou DIOP" },
      { id: 2, school_id: 1, type: "expense", category: "Salaires", amount: 280000, description: "Paiement Salaire Enseignant M. Robert OKEMBA" },
      { id: 3, school_id: 1, type: "expense", category: "Fournitures", amount: 850000, description: "Achat Rames de papier & fournitures examens" },
      { id: 4, school_id: 1, type: "income", category: "Scolarité", amount: 100000, description: "Acompte Scolarité 2ème Tranche - Marie KOFFI" }
    ];

    const { error: txErr } = await supabase
      .from('transactions')
      .upsert(transactionsData, { onConflict: 'id' });
    results.transactions = { count: transactionsData.length, error: txErr?.message || null };

    // 8. Seed Payments
    const paymentsData = [
      { id: 1, school_id: 1, student_id: 1, fee_id: 1, amount: 150000, receipt_number: "REC-2026-0001", payment_method: "Espèces", status: "paid" },
      { id: 2, school_id: 1, student_id: 2, fee_id: 2, amount: 100000, receipt_number: "REC-2026-0002", payment_method: "Mobile Money", status: "paid" }
    ];
    const { error: payErr } = await supabase
      .from('payments')
      .upsert(paymentsData, { onConflict: 'id' });
    results.payments = { count: paymentsData.length, error: payErr?.message || null };

    // 9. Seed Subjects
    const subjectsData = [
      { id: 1, school_id: 1, name: "Mathématiques", coefficient: 4 },
      { id: 2, school_id: 1, name: "Français", coefficient: 3 },
      { id: 3, school_id: 1, name: "Anglais", coefficient: 2 },
      { id: 4, school_id: 1, name: "Physique-Chimie", coefficient: 3 },
      { id: 5, school_id: 1, name: "Histoire-Géographie", coefficient: 2 }
    ];
    const { error: subjErr } = await supabase
      .from('subjects')
      .upsert(subjectsData, { onConflict: 'id' });
    results.subjects = { count: subjectsData.length, error: subjErr?.message || null };

    // 10. Seed Subscriptions
    const subscriptionsData = [
      {
        id: 1,
        code: "EDUCO-STD-2026-X8F9-Q2M1",
        school_id: 1,
        school_name: "Complexe Scolaire EDUCO Excelsior",
        school_identifier: "EDUCO-SCH-8492",
        promoter_name: "Dr. Marc TEST-PROMOTEUR",
        promoter_contact: "+229 95 88 77 66",
        plan_type: "standard",
        amount_paid: 10000,
        months: 12,
        status: "active",
        end_date: "2027-08-31T23:59:59Z",
        auto_renew: true
      }
    ];

    const { error: subErr } = await supabase
      .from('subscriptions')
      .upsert(subscriptionsData, { onConflict: 'id' });
    results.subscriptions = { count: subscriptionsData.length, error: subErr?.message || null };

    const hasErrors = Object.values(results).some((r: any) => r.error !== null);

    return {
      success: !hasErrors,
      message: hasErrors ? "⚠️ Injection effectuée avec certaines erreurs (Vérifiez si les tables existent dans Supabase)" : "✅ Toutes les données ont été injectées avec succès dans Supabase !",
      results
    };
  } catch (err: any) {
    return {
      success: false,
      message: "Erreur lors du peuplement Supabase REST: " + (err?.message || err),
      results
    };
  }
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


