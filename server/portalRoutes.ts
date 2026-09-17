import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';

const PERSONAL_ROLES = new Set(['Parent', 'Parent d’élève', 'Parent d\'élève', 'Parent/Tuteur', 'Élève']);
const same = (a: any, b: any) => a != null && b != null && String(a) !== '' && String(a) === String(b);
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase();
const isActiveAccount = (status: unknown) => ['active', 'actif'].includes(String(status || '').trim().toLowerCase());

const mapUser = (row: any) => ({
  id: row.id,
  schoolId: row.school_id,
  name: row.name,
  email: row.email,
  role: canonicalizeRole(row.role),
  status: row.status,
  isAccountActivated: isActiveAccount(row.status),
  studentId: row.student_id || row.matricule,
  matricule: row.matricule || row.student_id,
  classId: row.class_id,
  class: row.class,
  parentName: row.parent_name,
  parentEmail: row.parent_email,
  parentPhone: row.parent_phone,
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
  // Existing clients historically used the admin export endpoint for the
  // Parent/Élève dashboard. Redirect only personal accounts to the minimal
  // portal response; staff/admin continue to the legacy export handler.
  app.get('/api/admin/export-data', requireAuth, async (req: any, res: any, next: any) => {
    try {
      const user = await getUser(req);
      const role = canonicalizeRole(user?.role || '');
      if (!PERSONAL_ROLES.has(role)) return next();
      return res.redirect(307, '/api/portal');
    } catch (error) {
      return next(error);
    }
  });

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

      const { data: school, error: schoolError } = await client
        .from('schools')
        .select('id,name,address,phone,email,logo,settings')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolError) throw schoolError;
      const operations = school?.settings?.operations || {};
      const publicSchoolSettings = {
        name: school?.name || '',
        address: school?.address || '',
        contact: school?.phone || '',
        email: school?.email || '',
        logo: school?.logo || '',
        currency: operations.schoolSettings?.currency || school?.settings?.schoolSettings?.currency || 'FCFA',
        themeColor: operations.schoolSettings?.themeColor || school?.settings?.schoolSettings?.themeColor || '#1F4A59',
        slogan: operations.schoolSettings?.slogan || school?.settings?.schoolSettings?.slogan || '',
        currentYear: operations.schoolSettings?.currentYear || school?.settings?.schoolSettings?.currentYear || '',
        academicYear: operations.schoolSettings?.academicYear || school?.settings?.schoolSettings?.academicYear || '',
        defaultLanguage: operations.schoolSettings?.defaultLanguage || school?.settings?.schoolSettings?.defaultLanguage || 'Français',
      };

      if (!studentRecordIds.length) {
        return res.json({
          users: [], students: [], classes: [], subjects: [], grades: [], payments: [], transactions: [], fees: [], attendance: [], timetable: [], homeworkDiary: [], reportCardComments: [], messages: [],
          schoolSettings: publicSchoolSettings,
        });
      }

      const results = await Promise.all([
        client.from('users').select('id,school_id,name,email,role,status,student_id,matricule,class_id,class,parent_name,parent_email,parent_phone,avatar').eq('school_id', schoolId).in('id', studentUserIds),
        client.from('classes').select('id,school_id,name,level,section,teacher_id,status').eq('school_id', schoolId).in('id', classIds),
        client.from('grades').select('*').in('student_id', studentRecordIds),
        client.from('payments').select('*').eq('school_id', schoolId).in('student_id', studentRecordIds),
        client.from('attendance').select('*').in('student_id', studentRecordIds),
        client.from('timetable').select('*').in('class_id', classIds),
        client.from('subjects').select('id,school_id,name,coefficient,teacher_id').eq('school_id', schoolId),
        client.from('fees').select('*').eq('school_id', schoolId),
        client.from('messages').select('*').eq('school_id', schoolId).order('created_at', { ascending: true }).limit(300),
      ]);
      for (const result of results) if (result?.error) throw result.error;

      const [userRows, classRows, gradeRows, paymentRows, attendanceRows, timetableRows, subjectRows, feeRows, messageRows] = results.map((result: any) => result.data || []);
      const linkedUsers = userRows.map(mapUser).map((studentUser: any) => {
        const student = linkedStudents.find((row: any) => same(row.user_id, studentUser.id));
        const cls = classRows.find((row: any) => same(row.id, student?.class_id));
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

      // Financial status remains visible before activation so registration and
      // outstanding fees can be resolved. Pedagogical data requires an active
      // student account, matching the Parent dashboard's activation notice.
      const activeUserIds = new Set(linkedUsers.filter((row: any) => row.isAccountActivated).map((row: any) => String(row.id)));
      const activeRecordIds = new Set(linkedStudents.filter((student: any) => activeUserIds.has(String(student.user_id))).map((student: any) => String(student.id)));
      const activeClassIds = new Set(linkedStudents.filter((student: any) => activeUserIds.has(String(student.user_id))).map((student: any) => String(student.class_id)));
      const activeStudentRefs = new Set(linkedStudents.filter((student: any) => activeUserIds.has(String(student.user_id))).flatMap((student: any) => [String(student.id), String(student.user_id)]));

      const visibleGrades = gradeRows.filter((row: any) => activeRecordIds.has(String(row.student_id)));
      const visibleAttendance = attendanceRows.filter((row: any) => activeRecordIds.has(String(row.student_id)));
      const visibleTimetable = timetableRows.filter((row: any) => activeClassIds.has(String(row.class_id)));
      const relevantSubjectIds = new Set([
        ...visibleGrades.map((row: any) => String(row.subject_id)),
        ...visibleTimetable.map((row: any) => String(row.subject_id)),
      ]);
      const visibleSubjects = subjectRows.filter((row: any) => relevantSubjectIds.has(String(row.id)));
      const subjectById = new Map(visibleSubjects.map((subject: any) => [Number(subject.id), subject.name]));
      const linkedClassRefs = new Set(classIds.map(String));
      const linkedClassNames = new Set(classRows.map((row: any) => String(row.name || '').trim()).filter(Boolean));

      const personalTransactions = paymentRows.map((payment: any) => ({
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

      const visibleMessages = messageRows.filter((row: any) => {
        const involved = Number(row.sender_id) === Number(user.id) || Number(row.recipient_id) === Number(user.id);
        return (row.message_type === 'direct' || row.recipient_id != null) && involved;
      }).map((row: any) => ({
        id: String(row.id), type: 'internal', channelId: row.channel_id, senderId: row.sender_id, senderName: row.sender_name, senderRole: row.sender_role, recipientId: row.recipient_id, text: row.text, timestamp: row.created_at,
      }));

      return res.json({
        users: linkedUsers,
        students: linkedStudents.map(mapStudent),
        classes: classRows.map((row: any) => ({ id: row.id, schoolId: row.school_id, name: row.name, level: row.level || row.section, section: row.section || row.level, teacherId: row.teacher_id, status: row.status || 'active' })),
        subjects: visibleSubjects.map((row: any) => ({ id: row.id, schoolId: row.school_id, name: row.name, coefficient: Number(row.coefficient || 1), teacherId: row.teacher_id })),
        grades: visibleGrades.map((row: any) => ({ id: String(row.id), studentId: linkedStudents.find((student: any) => same(student.id, row.student_id))?.user_id || row.student_id, classId: row.class_id, subjectId: row.subject_id, subject: subjectById.get(Number(row.subject_id)) || `Matière #${row.subject_id}`, assignment: row.assignment || row.term || 'Devoir', score: Number(row.score || 0), maxScore: Number(row.max_score || 20), teacherId: row.teacher_id, date: row.date })),
        payments: paymentRows.map((row: any) => ({ id: row.id, schoolId: row.school_id, studentRecordId: row.student_id, studentId: linkedStudents.find((student: any) => same(student.id, row.student_id))?.user_id || row.student_id, feeId: row.fee_id, amount: Number(row.amount || row.amount_paid || 0), amountPaid: Number(row.amount || row.amount_paid || 0), paymentDate: row.payment_date || row.created_at, receiptNumber: row.receipt_number, paymentMethod: row.payment_method, status: row.status || 'paid' })),
        transactions: personalTransactions,
        fees: feeRows.filter((fee: any) => {
          const hasClassId = fee.class_id != null && String(fee.class_id) !== '';
          const className = String(fee.class || fee.class_name || '').trim();
          const hasClassName = Boolean(className);
          return (!hasClassId && !hasClassName)
            || (hasClassId && linkedClassRefs.has(String(fee.class_id)))
            || (hasClassName && linkedClassNames.has(className));
        }).map((row: any) => ({ id: row.id, schoolId: row.school_id, name: row.name || row.title, title: row.title || row.name, amount: Number(row.amount || 0), dueDate: row.due_date, type: row.type, class: row.class || row.class_name, classId: row.class_id })),
        attendance: visibleAttendance.map((row: any) => ({ id: row.id, studentId: linkedStudents.find((student: any) => same(student.id, row.student_id))?.user_id || row.student_id, classId: row.class_id, date: row.date, status: row.status, recordedBy: row.recorded_by })),
        timetable: visibleTimetable.map((row: any) => ({ id: String(row.id), classId: row.class_id, subjectId: row.subject_id, teacherId: row.teacher_id, day: row.day_of_week, startTime: row.start_time, endTime: row.end_time, room: row.room || undefined })),
        homeworkDiary: Array.isArray(operations.homeworkDiary) ? operations.homeworkDiary.filter((row: any) => activeClassIds.has(String(row.classId))) : [],
        reportCardComments: Array.isArray(operations.reportCardComments) ? operations.reportCardComments.filter((row: any) => activeStudentRefs.has(String(row.studentId))) : [],
        messages: visibleMessages,
        schoolSettings: publicSchoolSettings,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible de charger le portail Parent/Élève.' });
    }
  });
}
