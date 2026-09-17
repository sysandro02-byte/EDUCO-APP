import type { InstitutionAccessContext } from './accessConfig';

const ACCESS_CONTEXT_KEY = 'EDUCO_ACCESS_CONTEXT';

export const readInstitutionAccessContext = (): InstitutionAccessContext | null => {
  try {
    const raw = sessionStorage.getItem(ACCESS_CONTEXT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InstitutionAccessContext;
    if (!parsed?.sector || !parsed?.label) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveInstitutionAccessContext = (context: InstitutionAccessContext) => {
  sessionStorage.setItem(ACCESS_CONTEXT_KEY, JSON.stringify(context));
};

export const clearInstitutionAccessContext = () => {
  sessionStorage.removeItem(ACCESS_CONTEXT_KEY);
};

const normalizeRoleCode = (role?: string | null) =>
  String(role || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

/**
 * Government access is deliberately strict. A visual selection never grants access.
 * Accounts intended for ministry work should use a role code such as:
 *   MEPSA_CABINET, MES_DEP, METP_DGET
 * Ministry-wide administrators may use MEPSA_ADMIN / MES_ADMIN / METP_ADMIN.
 * ETAT_ADMIN is reserved for a future centrally-managed government account.
 */
export const canRoleAccessInstitutionContext = (
  role: string | null | undefined,
  context: InstitutionAccessContext | null,
) => {
  if (!context || context.sector !== 'STATE' || !context.ministry || !context.entity) return false;
  const normalizedRole = normalizeRoleCode(role);
  if (!normalizedRole) return false;

  const exact = `${context.ministry}_${context.entity}`;
  const ministryAdmin = `${context.ministry}_ADMIN`;
  return normalizedRole === exact || normalizedRole === ministryAdmin || normalizedRole === 'ETAT_ADMIN';
};

export const buildGovernmentRoleCode = (context: InstitutionAccessContext) => {
  if (context.sector !== 'STATE' || !context.ministry || !context.entity) return null;
  return `${context.ministry}_${context.entity}`;
};

export const institutionalAccessContextStorageKey = ACCESS_CONTEXT_KEY;
