export type AccountCreationKind = 'student' | 'teacher' | 'parent' | 'staff';

const teacherRoles = new Set(['enseignant']);
const studentRoles = new Set(['élève', 'eleve']);
const parentRoles = new Set(['parent', 'parent d\'eleve', 'parent d’eleve']);

export const normalizeEmail = (email?: string | null) => String(email || '').trim().toLowerCase();

export const normalizeRole = (role?: string | null) =>
  String(role || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const normalizeAccountStatus = (status?: string | null) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (!normalized || normalized === 'active' || normalized === 'actif') return 'Actif';
  if (normalized === 'inactive' || normalized === 'inactif') return 'Inactif';
  if (normalized === 'suspended' || normalized === 'suspendu') return 'Suspendu';
  return status || 'Actif';
};

export const getAccountCreationKind = (role?: string | null): AccountCreationKind => {
  const normalizedRole = normalizeRole(role);
  if (studentRoles.has(normalizedRole)) return 'student';
  if (teacherRoles.has(normalizedRole)) return 'teacher';
  if (parentRoles.has(normalizedRole)) return 'parent';
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

export const buildSchoolAcronym = (schoolNameOrAcronym?: string | null) => {
  const words = String(schoolNameOrAcronym || 'EDUCO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[A-Za-z0-9]+/g) || [];
  const acronym = words.length > 1
    ? words.map(word => word[0]).join('')
    : (words[0] || 'EDUCO').slice(0, 6);
  return acronym.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'EDUCO';
};

const buildScopedMatricule = (params: {
  schoolAcronym?: string | null;
  prefix: string;
  idOrSeed?: number | string | null;
}) => {
  const schoolAcronym = buildSchoolAcronym(params.schoolAcronym);
  const seed = String(params.idOrSeed || Date.now()).replace(/\D/g, '').slice(-5).padStart(5, '0');
  return `${schoolAcronym}-${params.prefix}-${new Date().getFullYear()}-${seed}`;
};

export const buildStudentMatricule = (params: {
  schoolAcronym?: string | null;
  idOrSeed?: number | string | null;
}) => buildScopedMatricule({ ...params, prefix: 'ELV' });

export const buildStaffMatricule = (params: {
  schoolAcronym?: string | null;
  role?: string | null;
  idOrSeed?: number | string | null;
}) => {
  const prefix = isTeacherRole(params.role) ? 'ENS' : 'PER';
  return buildScopedMatricule({ ...params, prefix });
};
