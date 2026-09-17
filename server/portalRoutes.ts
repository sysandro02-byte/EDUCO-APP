import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';

const PERSONAL_ROLES = new Set(['Parent', 'Parent d’élève', 'Parent d\'élève', 'Parent/Tuteur', 'Élève']);
const same = (a: any, b: any) => a != null && b != null && String(a) !== '' && String(a) === String(b);
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();

const mapUser = (row: any) => ({
  id: row.id,
  uid: row.uid,
  schoolId: row.school_id,
  name: row.name,
  email: row.email,
  role: canonicalizeRole(row.role),
  status: row.status,
  studentId: row.student_id || row.matricule,
  matricule: row.matricule || row.student_id,
  classId: row.class_id,
  class: row.class,
  parentName: row.parent_name,
  parentEmail: row.parent_email,
  parentPhone: row.parent_phone,
  phone: row.phone || row.contact,
  contact: row.contact || row.phone,
  avatar: row.avatar,
});

const mapStudent = (row: any) => ({
  id: row.id,
  userId: row.user_id,
  schoolId: row.school_id,
  classId: row.class_id,
  studentId: row.student_id || row.matricule,
  matricule: row.matricule || row.student_id,
  parentName: row.parent_name,
  parentEmail: row.parent_email,
  parentPhone: row.parent_phone,
});

export function registerPortalRoutes(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.get('/api/portal', requireAuth, async (req: any, res: any) => {
    try {
      const user = await getUser(req);
      const role = canonicalizeRole(user?.role || '');
      if (!user?.schoolId || !user?.id || !PERSONAL_ROLES.has(role)) {
        return res.status(403).json({ error: 'Ce portail est réservé aux comptes Parent et Élève.' });
      }
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const schoolId = Number(user.schoolId);

      const { data: allStudents, error: studentsError } = await client
        .from('students')
        .select('*')
        .eq('school_id', schoolId);
      if (studentsError) throw studentsError;

      const parentEmail = normalizeEmail(user.email);
      const linkedStudents = (allStudents || []).filter((student: any) => {
        if (role === 'Élève') return same(student.user_id, user.id);
        const byMatricule = user.studentId && same(student.student_id || student.matricule, user.studentId);
        const byParentEmail = parentEmail && normalizeEmail(student.parent_email) === parentEmail;
        return Boolean(byMatricule || byParentEmail);
      });

      const studentRecordIds = linkedStudents.map((row: any) => Number(row.id)).filter((id: number) => Number.isSafeInteger(id) && id > 0);
      const studentUserIds = linkedStudents.map((row: any) => Number(row.user_id)).filter((id: number) => Number.isSafeInteger(id) && id > 0);
      const classIds = [...new Set(linkedStudents.map((row: any) => Number(row.class_id)).filter((id: number) => Number.isSafeInteger(id) && id > 0))];

      if (!studentRecordIds.length) {
        const { data: school, error: schoolError } = await client.from('schools').select('id,name,address,phone,email,logo,settings').eq('id', schoolId).maybeSingle();
        if (schoolError) throw schoolError;
        return res.json({
          users: role === 'Élève' ? [mapUser(user)] : [],
          students: [], classes: [], subjects: [], grades: [], payments: [], transactions: [], fees: [], attendance: [], timetable: [], homeworkDiary: [], reportCardComments: [], messages: [],
          schoolSettings: { name: school?.name || '', address: school?.address || '', contact: school?.phone || '', email: school?.email || '', logo: school?.logo || '', currency: school?.settings?.schoolSettings?.currency || 'FCFA' },
        });
      }

      const queries: Promise<any>[] = [
        client.from('users').select('*').eq('school_id', schoolId).in('id', studentUserIds),
        client.from('classes').select('*').eq('school_id', schoolId).in('id', classIds),
        client.from('grades').select('*').in('student_id', studentRecordIds),
        client.from('payments').select('*').eq('school_id', schoolId).in('student_id', studentRecordIds),
        client.from('attendance').select('*').in('student_id', studentRecordIds),
        client.from('timetable').select('*').in('class_id', classIds),
        client.from('subjects').select('*').eq('school_id', schoolId),
        client.from('fees').select('*').eq('school_id', schoolId),
        client.from('schools').select('id,name,address,phone,email,logo,settings').eq('id', schoolId).maybeSingle(),
        client.from('messages').select('*').eq('school_id', schoolId).order('created_at', { ascending: true }).limit(300),
      ] as any;
      const results = await Promise.all(queries as any);
      for (const result of results) if (result?.error) throw result.error;

      const [userRows, classRows, gradeRows, paymentRows, attendanceRows, timetableRows, subjectRows, feeRows, schoolResult, messageRows] = results.map((result: any) => result.data);
      const linkedUsers = (userRows || []).map(mapUser).map((studentUser: any) => {
        const student = linkedStudents.find((row: any) => same(row.user_id, studentUser.id));
        const cls = (classRows || []).find((row: any) => same(row.id, student?.class_id));
        return {
          ...studentUser,
          studentRecordId: student?.id,
          studentId: student?.student_id || student?.matricule || studentUser.studentId,
          matricule: student?.matricule || student?.student_id || studentUser.matricule,
          classId: student?.class_id,
          class: cls?.name || studentUser.class,
          parentName: student?.parent_name || studentUser.parentName,
          parentEmail: student?.parent_email || studentUser.parentEmail,
          parentPhone: student?.parent_phone || studentUser.parentPhone,
        };
      });

      const subjectById = new Map((subjectRows || []).map((subject: any) => [Number(subject.id), subject.name]));
      const school = schoolResult || {};
      const operations = school.settings?.operations || {};
      const linkedStudentRefs = new Set(linkedStudents.flatMap((student: any) => [String(student.id), String(student.user_id)]));
      const linkedClassRefs = new Set(classIds.map(String));

      const personalTransactions = (paymentRows || []).map((payment: any) => ({
        id: String(payment.receipt_number || payment.id),
        schoolId,
        type: 'Revenu',
        category: 'Scolarité',
        amount: Number(payment.amount || payment.amount_paid || 0),
        description: `Paiement scolarité — élève #${payment.student_id}`,
        date: payment.payment_date || payment.created_at || '',
        paymentMethod: payment.payment_method || 'Non renseigné',
        status: payment.status || 'paid',
      }));

      const visibleMessages = (messageRows || []).filter((row: any) => {
        const involved = Number(row.sender_id) === Number(user.id) || Number(row.recipient_id) === Number(user.id);
        return (row.message_type === 'direct' || row.recipient_id != null) && involved;
      }).map((row: any) => ({
        id: String(row.id), type: 'internal', channelId: row.channel_id, senderId: row.sender_id, senderName: row.sender_name, senderRole: row.sender_role, recipientId: row.recipient_id, text: row.text, timestamp: row.created_at,
      }));

      return res.json({
        users: linkedUsers,
        students: linkedStudents.map(mapStudent),
        classes: (classRows || []).map((row: any) => ({ id: row.id, schoolId: row.school_id, name: row.name, level: row.level || row.section, section: row.section || row.level, teacherId: row.teacher_id, status: row.status || 'active' })),
        subjects: (subjectRows || []).map((row: any) => ({ id: row.id, schoolId: row.school_id, name: row.name, coefficient: Number(row.coefficient || 1), teacherId: row.teacher_id })),
        grades: (gradeRows || []).map((row: any) => ({ id: String(row.id), studentId: linkedStudents.find((student: any) => same(student.id, row.student_id))?.user_id || row.student_id, classId: row.class_id, subjectId: row.subject_id, subject: subjectById.get(Number(row.subject_id)) || `Matière #${row.subject_id}`, assignment: row.assignment || row.term || 'Devoir', score: Number(row.score || 0), maxScore: Number(row.max_score || 20), teacherId: row.teacher_id, date: row.date })),
        payments: (paymentRows || []).map((row: any) => ({ id: row.id, schoolId: row.school_id, studentRecordId: row.student_id, studentId: linkedStudents.find((student: any) => same(student.id, row.student_id))?.user_id || row.student_id, feeId: row.fee_id, amount: Number(row.amount || row.amount_paid || 0), amountPaid: Number(row.amount || row.amount_paid || 0), paymentDate: row.payment_date || row.created_at, receiptNumber: row.receipt_number, paymentMethod: row.payment_method, status: row.status || 'paid' })),
        transactions: personalTransactions,
        fees: (feeRows || []).filter((fee: any) => !fee.class || !fee.class_id || linkedClassRefs.has(String(fee.class_id)) || (classRows || []).some((cls: any) => linkedClassRefs.has(String(cls.id)) && String(fee.class || '').trim() === String(cls.name || '').trim())).map((row: any) => ({ id: row.id, schoolId: row.school_id, name: row.name || row.title, title: row.title || row.name, amount: Number(row.amount || 0), dueDate: row.due_date, type: row.type, class: row.class || row.class_name, classId: row.class_id })),
        attendance: (attendanceRows || []).map((row: any) => ({ id: row.id, studentId: linkedStudents.find((student: any) => same(student.id, row.student_id))?.user_id || row.student_id, classId: row.class_id, date: row.date, status: row.status, recordedBy: row.recorded_by })),
        timetable: (timetableRows || []).map((row: any) => ({ id: String(row.id), classId: row.class_id, subjectId: row.subject_id, teacherId: row.teacher_id, day: row.day_of_week, startTime: row.start_time, endTime: row.end_time, room: row.room || undefined })),
        homeworkDiary: Array.isArray(operations.homeworkDiary) ? operations.homeworkDiary.filter((row: any) => linkedClassRefs.has(String(row.classId))) : [],
        reportCardComments: Array.isArray(operations.reportCardComments) ? operations.reportCardComments.filter((row: any) => linkedStudentRefs.has(String(row.studentId))) : [],
        messages: visibleMessages,
        schoolSettings: { name: school.name || '', address: school.address || '', contact: school.phone || '', email: school.email || '', logo: school.logo || '', currency: school.settings?.schoolSettings?.currency || operations.schoolSettings?.currency || 'FCFA', ...(operations.schoolSettings || {}), nameOverrideIgnored: undefined },
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible de charger le portail Parent/Élève.' });
    }
  });
}
