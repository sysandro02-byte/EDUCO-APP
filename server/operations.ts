import { randomUUID } from 'node:crypto';
import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';

const direction = ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire'];
const finance = ['Promoteur', 'Directeur Général', 'Responsable des finances'];
const teaching = [...direction, 'Enseignant'];
export const operationRoles: Record<string, string[]> = {
  attendance: [...teaching, 'Surveillant Général', 'Surveillant Général Adjoint'],
  subjects: direction, timetable: direction, homeworkDiary: teaching,
  reportCardComments: teaching, financialEvents: [...finance, 'Caissière'],
  academicYear: direction, schoolSettings: direction, budget: finance,
  cashierSettings: finance, rafSettings: finance,
  communicationSettings: finance, messageTemplates: [...finance, 'Caissière'],
};
const collections = new Set(['attendance', 'subjects', 'timetable', 'homeworkDiary', 'reportCardComments', 'financialEvents', 'messageTemplates']);
const personalRole = (role: string) => /parent|élève|eleve/i.test(role);
const same = (a: any, b: any) => a != null && b != null && String(a) !== '' && String(a) === String(b);

export function selectPersonalStudents(user: any, students: any[]) {
  return students.filter(student => same(student.school_id ?? student.schoolId, user.schoolId ?? user.school_id) && (
    /parent/i.test(user.role)
      ? (same(student.student_id ?? student.studentId, user.studentId ?? user.student_id)
        || (!!user.email && String(student.parent_email ?? student.parentEmail ?? '').toLowerCase() === String(user.email).toLowerCase()))
      : same(student.user_id ?? student.userId, user.id)
  ));
}

export function mutateOperations(current: any, key: string, body: any) {
  if (!collections.has(key)) return { ...current, [key]: body.value };
  let rows = Array.isArray(current[key]) ? current[key] : [];
  if (key === 'attendance') {
    rows = rows.filter((row: any) => !(same(row.classId, body.classId) && row.date === body.date));
    return { ...current, attendance: [...rows, ...body.records.map((row: any) => ({
      studentId: row.studentId, status: row.status, classId: body.classId, date: body.date,
      id: `${body.classId}:${body.date}:${row.studentId}`,
    }))] };
  }
  if (body.action === 'delete') return { ...current, [key]: rows.filter((row: any) => !same(row.id, body.id)) };
  const value = { ...body.value };
  if (key === 'reportCardComments') {
    value.id = rows.find((row: any) => same(row.studentId, value.studentId) && row.period === value.period && row.year === value.year)?.id || value.id;
  }
  value.id ||= key === 'subjects' || key === 'messageTemplates' ? Date.now() : randomUUID();
  return { ...current, [key]: [...rows.filter((row: any) => !same(row.id, value.id)), value] };
}

// School settings already provide durable JSON storage. Compare-and-swap keeps
// independent accounts from overwriting each other's changes, without a migration.
export function registerOperations(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.post('/api/records/:table/delete', requireAuth, async (req, res) => {
    try {
      const table = String(req.params.table);
      const allowed: Record<string, string[]> = { classes: direction, fees: finance, personnel: finance };
      const user = await getUser(req);
      if (!user?.schoolId || !allowed[table]?.includes(canonicalizeRole(user.role))) return res.status(403).json({ error: 'Suppression non autorisée.' });
      const client = getClient(req);
      if (!client) throw new Error('Supabase non configuré.');
      const { data, error } = await client.from(table).delete().eq('school_id', user.schoolId).eq('id', req.body.id).select('id');
      if (error) throw error;
      if (!data?.length) return res.status(404).json({ error: 'Enregistrement introuvable.' });
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
  async function context(req: any) {
    const user = await getUser(req);
    if (!user?.schoolId) throw new Error('Aucun établissement associé au compte.');
    const client = getClient(req);
    if (!client) throw new Error('Supabase non configuré.');
    const { data: school, error } = await client.from('schools').select('*').eq('id', user.schoolId).single();
    if (error) throw error;
    return { user, client, school };
  }
  app.get('/api/operations', requireAuth, async (req, res) => {
    try {
      const { user, client, school } = await context(req);
      const results = await Promise.all([
        client.from('classes').select('*').eq('school_id', user.schoolId),
        client.from('students').select('*').eq('school_id', user.schoolId),
        client.from('subjects').select('*').eq('school_id', user.schoolId),
      ]);
      for (const result of results) if (result.error) throw result.error;
      const [classRows, students, subjectRows] = results.map(result => result.data || []);
      const allClassIds = classRows.map((row: any) => row.id);
      const legacy = allClassIds.length ? await Promise.all([
        client.from('attendance').select('*').in('class_id', allClassIds),
        client.from('timetable').select('*').in('class_id', allClassIds),
      ]) : [{ data: [] }, { data: [] }];
      for (const result of legacy) if (result.error) throw result.error;
      const saved = school.settings?.operations || {};
      const data: any = { ...saved };
      for (const key of collections) data[key] = saved[key] || [];
      data.subjects = saved.subjects ?? subjectRows;
      const userIdForStudent = (id: any) => students.find((s: any) => same(s.id, id))?.user_id || id;
      data.attendance = [...(legacy[0].data || []).map((row: any) => ({ ...row, studentId: userIdForStudent(row.student_id), classId: row.class_id }))
        .filter((row: any) => !data.attendance.some((r: any) => same(r.classId, row.classId) && r.date === row.date)), ...data.attendance];
      data.timetable = saved.timetable ?? (legacy[1].data || []).map((row: any) => ({ id: String(row.id), classId: row.class_id, subjectId: row.subject_id, teacherId: row.teacher_id, day: row.day_of_week, startTime: row.start_time, endTime: row.end_time }));
      data.schoolSettings = { name: school.name, address: school.address || '', contact: school.phone || '', email: school.email || '', logo: school.logo || '', currency: 'FCFA', ...(school.settings?.schoolSettings || {}), ...(saved.schoolSettings || {}) };
      const userRole = canonicalizeRole(user.role);
      if (personalRole(userRole)) {
        const linked = selectPersonalStudents(user, students);
        const classIds = linked.map((s: any) => s.class_id);
        const studentIds = linked.flatMap((s: any) => [s.id, s.user_id]);
        for (const key of ['attendance', 'reportCardComments']) data[key] = data[key].filter((row: any) => studentIds.some(id => same(id, row.studentId)));
        for (const key of ['timetable', 'homeworkDiary']) data[key] = data[key].filter((row: any) => classIds.some((id: any) => same(id, row.classId)));
        for (const key of ['cashierSettings', 'rafSettings', 'communicationSettings', 'budget', 'messageTemplates']) delete data[key];
      } else if (userRole === 'Enseignant') {
        const classIds = classRows.filter((c: any) => same(c.teacher_id, user.id)).map((c: any) => c.id);
        for (const key of ['attendance', 'timetable', 'homeworkDiary']) data[key] = data[key].filter((row: any) => classIds.some((id: any) => same(id, row.classId)));
        for (const key of ['cashierSettings', 'rafSettings', 'communicationSettings', 'budget']) delete data[key];
      }
      res.json(data);
    } catch (error: any) { res.status(503).json({ error: error.message }); }
  });
  app.post('/api/operations/:key', requireAuth, async (req, res) => {
    try {
      const key = String(req.params.key);
      const { user, client } = await context(req);
      const userRole = canonicalizeRole(user.role);
      if (!operationRoles[key]?.includes(userRole)) return res.status(403).json({ error: 'Opération non autorisée pour ce compte.' });
      const body = req.body;
      if (body.action !== 'delete' && key !== 'attendance' && (!body.value || typeof body.value !== 'object' || Array.isArray(body.value))) return res.status(400).json({ error: 'Données invalides.' });
      if (key === 'attendance' && (!body.classId || !Array.isArray(body.records) || !/^\d{4}-\d{2}-\d{2}$/.test(body.date || '') || body.records.some((r: any) => !r.studentId || !['Présent', 'Absent', 'En Retard', 'Retard', 'present', 'absent', 'late', 'Retard justifié', 'Absence justifiée'].includes(r.status)))) return res.status(400).json({ error: 'Feuille de présence invalide.' });
      const classId = key === 'attendance' ? body.classId : body.value?.classId;
      if (classId) {
        const { data: schoolClass, error } = await client.from('classes').select('*').eq('id', classId).eq('school_id', user.schoolId).maybeSingle();
        if (error) throw error;
        if (!schoolClass || (userRole === 'Enseignant' && !same(schoolClass.teacher_id, user.id))) return res.status(403).json({ error: 'Classe non autorisée.' });
      }
      if (key === 'attendance' || key === 'reportCardComments') {
        const ids = key === 'attendance' ? body.records.map((row: any) => row.studentId) : [body.value.studentId];
        const { data: pupils, error } = await client.from('users').select('id,role').eq('school_id', user.schoolId).in('id', ids);
        if (error) throw error;
        if (ids.some((id: any) => !pupils.some((p: any) => same(p.id, id) && /élève|eleve/i.test(p.role)))) return res.status(403).json({ error: 'Élève non autorisé.' });
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data: school, error } = await client.from('schools').select('settings').eq('id', user.schoolId).single();
        if (error) throw error;
        const old = school.settings;
        const current = { ...(old?.operations || {}) };
        if (current[key] === undefined && (key === 'subjects' || key === 'timetable')) {
          if (key === 'subjects') {
            const legacy = await client.from('subjects').select('*').eq('school_id', user.schoolId);
            if (legacy.error) throw legacy.error;
            current.subjects = legacy.data || [];
          } else {
            const schoolClasses = await client.from('classes').select('id').eq('school_id', user.schoolId);
            if (schoolClasses.error) throw schoolClasses.error;
            const ids = (schoolClasses.data || []).map((c: any) => c.id);
            const legacy = ids.length ? await client.from('timetable').select('*').in('class_id', ids) : { data: [] };
            if (legacy.error) throw legacy.error;
            current.timetable = (legacy.data || []).map((row: any) => ({ id: String(row.id), classId: row.class_id, subjectId: row.subject_id, teacherId: row.teacher_id, day: row.day_of_week, startTime: row.start_time, endTime: row.end_time }));
          }
        }
        const next = { ...(old || {}), operations: mutateOperations(current, key, body) };
        let update = client.from('schools').update({ settings: next }).eq('id', user.schoolId);
        update = old == null ? update.is('settings', null) : update.eq('settings', JSON.stringify(old));
        const result = await update.select('id');
        if (result.error) throw result.error;
        if (result.data?.length) return res.json({ success: true, value: next.operations[key] });
      }
      res.status(409).json({ error: 'Données modifiées par un autre compte. Réessayez.' });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
}
