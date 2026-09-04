export type AccountCreationKind = 'student' | 'teacher' | 'staff';

const teacherRoles = new Set(['enseignant']);
const studentRoles = new Set(['élève', 'eleve']);

export const normalizeEmail = (email?: string | null) => String(email || '').trim().toLowerCase();

export const normalizeRole = (role?: string | null) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const getAccountCreationKind = (role?: string | null): AccountCreationKind => {
  const normalizedRole = normalizeRole(role);
  if (studentRoles.has(normalizedRole)) return 'student';
  if (teacherRoles.has(normalizedRole)) return 'teacher';
  return 'staff';
};

export const isStudentRole = (role?: string | null) => getAccountCreationKind(role) === 'student';

export const isTeacherRole = (role?: string | null) => getAccountCreationKind(role) === 'teacher';

export const buildDuplicateEmailMessage = (email?: string | null) => {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail
    ? `Cette adresse email (${normalizedEmail}) est déjà associée à un compte. Utilisez une autre adresse.`
    : 'Cette adresse email est déjà associée à un compte. Utilisez une autre adresse.';
};

export const makeStudentTechnicalEmail = (params: {
  name?: string | null;
  studentId?: string | null;
  schoolId?: number | string | null;
}) => {
  const cleanName = String(params.name || 'eleve')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 32) || 'eleve';
  const cleanMatricule = String(params.studentId || Date.now())
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const schoolPart = String(params.schoolId || 'school').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${cleanName}.${schoolPart}.${cleanMatricule}@eleves.educo.local`;
};

export const buildStaffMatricule = (params: {
  schoolAcronym?: string | null;
  role?: string | null;
  idOrSeed?: number | string | null;
}) => {
  const prefix = isTeacherRole(params.role) ? 'ENS' : 'PER';
  const schoolAcronym = String(params.schoolAcronym || 'EDUCO').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'EDUCO';
  const seed = String(params.idOrSeed || Date.now()).replace(/\D/g, '').slice(-5).padStart(5, '0');
  return `${schoolAcronym}-${prefix}-${new Date().getFullYear()}-${seed}`;
};
