export type StudentPaymentLedgerInput = {
  payments?: any[];
  students?: any[];
  users?: any[];
  classes?: any[];
  fees?: any[];
  schoolId?: number | string | null;
};

export type StudentPaymentLedgerRow = {
  id: number;
  studentRecordId: number | string;
  studentId: string;
  name: string;
  class: string;
  totalFees: number;
  amountPaid: number;
  schoolId?: number | string | null;
};

const normalizeRole = (role?: string | null) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const isStudentAccount = (user: any) => normalizeRole(user?.role) === 'eleve';

export const buildStudentPaymentLedger = ({
  payments = [],
  students = [],
  users = [],
  classes = [],
  fees = [],
  schoolId = null,
}: StudentPaymentLedgerInput): StudentPaymentLedgerRow[] => {
  const usersById = new Map(users.map((user: any) => [Number(user.id), user]));
  const classesById = new Map(classes.map((classRow: any) => [Number(classRow.id), classRow]));
  const paymentsByStudentId = new Map<number, number>();

  payments.forEach((payment: any) => {
    const studentId = Number(payment.student_id || payment.studentId || 0);
    if (!studentId) return;
    paymentsByStudentId.set(studentId, (paymentsByStudentId.get(studentId) || 0) + Number(payment.amount || 0));
  });

  const studentUserIds = new Set(students.map((student: any) => Number(student.user_id || student.userId)).filter(Boolean));
  const ledgerStudents = [
    ...students,
    ...users
      .filter((user: any) => isStudentAccount(user) && !studentUserIds.has(Number(user.id)))
      .map((user: any) => ({
        id: user.id,
        user_id: user.id,
        school_id: user.school_id || user.schoolId,
        student_id: user.student_id || user.studentId || user.matricule || `MAT-${user.id}`,
        class_id: user.class_id || user.classId,
        class: user.class,
      })),
  ];

  return ledgerStudents.map((student: any) => {
    const linkedUser = usersById.get(Number(student.user_id || student.userId));
    const className = student.class || linkedUser?.class || classesById.get(Number(student.class_id || student.classId))?.name || '';
    const matchingFees = fees.filter((fee: any) => {
      const feeClass = String(fee.class || fee.class_name || fee.className || '').trim().toLowerCase();
      return !feeClass || !className || feeClass === String(className).trim().toLowerCase();
    });
    const totalFees = matchingFees.reduce((sum: number, fee: any) => sum + Number(fee.amount || 0), 0);

    return {
      id: Number(student.user_id || student.userId || student.id),
      studentRecordId: student.id,
      studentId: student.student_id || student.studentId || linkedUser?.student_id || linkedUser?.studentId || linkedUser?.matricule || `MAT-${student.id}`,
      name: linkedUser?.name || student.name || 'Élève',
      class: className,
      totalFees,
      amountPaid: paymentsByStudentId.get(Number(student.id)) || 0,
      schoolId,
    };
  });
};
