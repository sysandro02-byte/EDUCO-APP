import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';

const TIMETABLE_ROLES = new Set(['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire']);
const DAYS = new Set(['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']);
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && bStart < aEnd;

const mapTimetable = (row: any) => ({
  id: String(row.id),
  classId: Number(row.class_id),
  subjectId: Number(row.subject_id),
  teacherId: Number(row.teacher_id),
  day: row.day_of_week,
  startTime: row.start_time,
  endTime: row.end_time,
  room: row.room || undefined,
});

async function listSchoolTimetable(client: any, schoolId: number) {
  const { data: classes, error: classError } = await client.from('classes').select('id').eq('school_id', schoolId);
  if (classError) throw classError;
  const classIds = (classes || []).map((row: any) => Number(row.id));
  if (!classIds.length) return [];
  const { data, error } = await client.from('timetable').select('*').in('class_id', classIds).order('day_of_week').order('start_time');
  if (error) throw error;
  return (data || []).map(mapTimetable);
}

export function registerTimetableRoutes(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.post('/api/operations/timetable', requireAuth, async (req, res) => {
    try {
      const user = await getUser(req);
      const role = canonicalizeRole(user?.role || '');
      if (!user?.schoolId || !TIMETABLE_ROLES.has(role)) {
        return res.status(403).json({ error: "Modification de l'emploi du temps non autorisée pour ce compte." });
      }
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });

      if (req.body?.action === 'delete') {
        const id = Number(req.body?.id);
        if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'Cours invalide.' });
        const { data: classes, error: classError } = await client.from('classes').select('id').eq('school_id', user.schoolId);
        if (classError) throw classError;
        const classIds = (classes || []).map((row: any) => Number(row.id));
        if (!classIds.length) return res.status(404).json({ error: 'Cours introuvable.' });
        const { data, error } = await client.from('timetable').delete().eq('id', id).in('class_id', classIds).select('id');
        if (error) throw error;
        if (!data?.length) return res.status(404).json({ error: 'Cours introuvable dans cet établissement.' });
        return res.json({ success: true, value: await listSchoolTimetable(client, Number(user.schoolId)) });
      }

      const value = req.body?.value || {};
      const classId = Number(value.classId);
      const subjectId = Number(value.subjectId);
      const teacherId = Number(value.teacherId);
      const day = String(value.day || '');
      const startTime = String(value.startTime || '');
      const endTime = String(value.endTime || '');
      const room = String(value.room || '').trim().slice(0, 120) || null;
      const requestedId = Number(value.id);
      const editingId = Number.isSafeInteger(requestedId) && requestedId > 0 ? requestedId : null;

      if (!Number.isSafeInteger(classId) || classId <= 0 || !Number.isSafeInteger(subjectId) || subjectId <= 0 || !Number.isSafeInteger(teacherId) || teacherId <= 0) {
        return res.status(400).json({ error: 'Classe, matière ou enseignant invalide.' });
      }
      if (!DAYS.has(day) || !TIME_RE.test(startTime) || !TIME_RE.test(endTime) || startTime >= endTime) {
        return res.status(400).json({ error: 'Jour ou horaire invalide.' });
      }

      const [{ data: schoolClass, error: classError }, { data: subject, error: subjectError }, { data: teacher, error: teacherError }] = await Promise.all([
        client.from('classes').select('id,school_id').eq('id', classId).eq('school_id', user.schoolId).maybeSingle(),
        client.from('subjects').select('id,school_id').eq('id', subjectId).eq('school_id', user.schoolId).maybeSingle(),
        client.from('users').select('id,school_id,role,status').eq('id', teacherId).eq('school_id', user.schoolId).maybeSingle(),
      ]);
      if (classError) throw classError;
      if (subjectError) throw subjectError;
      if (teacherError) throw teacherError;
      if (!schoolClass) return res.status(400).json({ error: 'Classe introuvable dans cet établissement.' });
      if (!subject) return res.status(400).json({ error: 'Matière introuvable dans cet établissement.' });
      if (!teacher || canonicalizeRole(teacher.role) !== 'Enseignant' || ['inactive', 'inactif', 'suspendu', 'suspended'].includes(String(teacher.status || '').toLowerCase())) {
        return res.status(400).json({ error: 'Enseignant invalide ou inactif.' });
      }

      const { data: schoolClasses, error: classesError } = await client.from('classes').select('id').eq('school_id', user.schoolId);
      if (classesError) throw classesError;
      const classIds = (schoolClasses || []).map((row: any) => Number(row.id));
      let query = client.from('timetable').select('*').eq('day_of_week', day);
      if (classIds.length) query = query.in('class_id', classIds);
      const { data: dayRows, error: rowsError } = await query;
      if (rowsError) throw rowsError;

      const conflicting = (dayRows || []).find((row: any) => {
        if (editingId && Number(row.id) === editingId) return false;
        if (!overlaps(startTime, endTime, String(row.start_time), String(row.end_time))) return false;
        return Number(row.class_id) === classId || Number(row.teacher_id) === teacherId;
      });
      if (conflicting) {
        const reason = Number(conflicting.class_id) === classId
          ? 'Cette classe a déjà un cours sur ce créneau.'
          : 'Cet enseignant a déjà un cours sur ce créneau.';
        return res.status(409).json({ error: reason });
      }

      const payload = {
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        day_of_week: day,
        start_time: startTime,
        end_time: endTime,
        room,
      };

      if (editingId) {
        const { data: existing, error: existingError } = await client.from('timetable').select('id,class_id').eq('id', editingId).maybeSingle();
        if (existingError) throw existingError;
        if (!existing || !classIds.includes(Number(existing.class_id))) return res.status(404).json({ error: 'Cours introuvable dans cet établissement.' });
        const { error } = await client.from('timetable').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await client.from('timetable').insert([payload]);
        if (error) throw error;
      }

      return res.json({ success: true, value: await listSchoolTimetable(client, Number(user.schoolId)) });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || "Impossible d'enregistrer l'emploi du temps." });
    }
  });
}
