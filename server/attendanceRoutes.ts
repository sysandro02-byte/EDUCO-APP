import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';

const ATTENDANCE_ROLES = new Set([
  'Promoteur',
  'Directeur Général',
  'Directeur des Etudes',
  'Directeur du Primaire',
  'Enseignant',
  'Surveillant Général',
  'Surveillant Général Adjoint',
]);

const normalizeStatus = (value: unknown) => {
  const status = String(value || '').trim().toLowerCase();
  if (status === 'présent' || status === 'present') return 'Présent';
  if (status === 'absent') return 'Absent';
  if (status === 'en retard' || status === 'retard' || status === 'late') return 'En Retard';
  return null;
};

const mapClass = (row: any) => ({
  id: row.id,
  schoolId: row.school_id ?? row.schoolId,
  name: row.name,
  level: row.level || row.section,
  section: row.section || row.level,
  capacity: row.capacity,
  maxStudents: row.capacity,
  teacherId: row.teacher_id ?? row.teacherId,
  tuitionFee: Number(row.tuition_fee ?? row.tuitionFee ?? 0),
  isExamClass: Boolean(row.is_exam_class ?? row.isExamClass),
  status: row.status || 'active',
});

export function registerAttendanceRoutes(app: Express, requireAuth: any, getUser: any, getClient: any) {
  // Teachers should only receive the classes assigned to them. Other roles fall
  // through to the existing /api/classes implementation.
  app.get('/api/classes', requireAuth, async (req: any, res, next) => {
    try {
      const actor = await getUser(req);
      if (!actor?.schoolId || canonicalizeRole(actor.role) !== 'Enseignant') return next();
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const { data, error } = await client
        .from('classes')
        .select('*')
        .eq('school_id', actor.schoolId)
        .eq('teacher_id', actor.id);
      if (error) throw error;
      return res.json((data || []).map(mapClass));
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible de charger les classes affectées.' });
    }
  });

  // This exact route is registered before the generic /api/operations/:key
  // route and therefore becomes the durable attendance writer.
  app.post('/api/operations/attendance', requireAuth, async (req: any, res) => {
    try {
      const actor = await getUser(req);
      const role = canonicalizeRole(actor?.role);
      if (!actor?.schoolId || !ATTENDANCE_ROLES.has(role)) {
        return res.status(403).json({ error: 'Vous n’êtes pas autorisé à enregistrer les présences.' });
      }

      const classId = Number(req.body?.classId);
      const date = String(req.body?.date || '').trim();
      const records = Array.isArray(req.body?.records) ? req.body.records : [];
      if (!Number.isSafeInteger(classId) || classId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || records.length === 0) {
        return res.status(400).json({ error: 'Feuille de présence invalide.' });
      }

      const normalizedRecords = records.map((record: any) => ({
        userId: Number(record?.studentId),
        status: normalizeStatus(record?.status),
      }));
      if (normalizedRecords.some((record: any) => !Number.isSafeInteger(record.userId) || record.userId <= 0 || !record.status)) {
        return res.status(400).json({ error: 'Un ou plusieurs statuts de présence sont invalides.' });
      }
      if (new Set(normalizedRecords.map((record: any) => record.userId)).size !== normalizedRecords.length) {
        return res.status(400).json({ error: 'Un élève apparaît plusieurs fois dans la même feuille de présence.' });
      }

      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });

      const classResult = await client
        .from('classes')
        .select('id,school_id,teacher_id')
        .eq('school_id', actor.schoolId)
        .eq('id', classId)
        .maybeSingle();
      if (classResult.error) throw classResult.error;
      if (!classResult.data) return res.status(404).json({ error: 'Classe introuvable.' });
      if (role === 'Enseignant' && Number(classResult.data.teacher_id) !== Number(actor.id)) {
        return res.status(403).json({ error: 'Cette classe ne vous est pas affectée.' });
      }

      const userIds = normalizedRecords.map((record: any) => record.userId);
      const studentResult = await client
        .from('students')
        .select('id,user_id,class_id,school_id')
        .eq('school_id', actor.schoolId)
        .eq('class_id', classId)
        .in('user_id', userIds);
      if (studentResult.error) throw studentResult.error;
      const students = studentResult.data || [];
      const studentByUserId = new Map<number, any>(
        students.map((student: any) => [Number(student.user_id), student] as [number, any]),
      );
      if (normalizedRecords.some((record: any) => !studentByUserId.has(record.userId))) {
        return res.status(400).json({ error: 'La feuille contient un élève qui n’est pas inscrit dans cette classe.' });
      }

      const rows = normalizedRecords.map((record: any) => ({
        student_id: studentByUserId.get(record.userId)!.id,
        class_id: classId,
        status: record.status,
        date,
        recorded_by: actor.id,
      }));
      const writeResult = await client
        .from('attendance')
        .upsert(rows, { onConflict: 'student_id,class_id,date' })
        .select('*');
      if (writeResult.error) throw writeResult.error;

      let allowedClassIds: number[] = [classId];
      if (role !== 'Enseignant') {
        const schoolClasses = await client.from('classes').select('id').eq('school_id', actor.schoolId);
        if (schoolClasses.error) throw schoolClasses.error;
        allowedClassIds = (schoolClasses.data || []).map((schoolClass: any) => Number(schoolClass.id));
      }

      if (allowedClassIds.length === 0) return res.json({ success: true, value: [] });
      const [attendanceResult, allStudentsResult] = await Promise.all([
        client.from('attendance').select('*').in('class_id', allowedClassIds),
        client.from('students').select('id,user_id,class_id').eq('school_id', actor.schoolId).in('class_id', allowedClassIds),
      ]);
      if (attendanceResult.error) throw attendanceResult.error;
      if (allStudentsResult.error) throw allStudentsResult.error;
      const userIdByStudentId = new Map((allStudentsResult.data || []).map((student: any) => [Number(student.id), Number(student.user_id)]));
      const value = (attendanceResult.data || [])
        .filter((row: any) => userIdByStudentId.has(Number(row.student_id)))
        .map((row: any) => ({
          id: row.id,
          studentId: userIdByStudentId.get(Number(row.student_id)),
          classId: Number(row.class_id),
          date: row.date,
          status: normalizeStatus(row.status) || row.status,
        }));
      return res.json({ success: true, value });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible d’enregistrer les présences.' });
    }
  });
}
