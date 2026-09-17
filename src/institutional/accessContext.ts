import { MINISTRIES, type InstitutionAccessContext } from './accessConfig';

const ACCESS_CONTEXT_KEY = 'EDUCO_ACCESS_CONTEXT';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Valide uniquement les destinations réellement configurées dans EDUCO.
 * Le contexte étant stocké côté navigateur pour piloter l'interface, il doit être
 * considéré comme non fiable et ne doit jamais permettre d'inventer une direction.
 */
export const isValidInstitutionAccessContext = (
  value: unknown,
): value is InstitutionAccessContext => {
  if (!isRecord(value) || typeof value.label !== 'string' || !value.label.trim()) return false;

  if (value.sector === 'STATE') {
    if (typeof value.ministry !== 'string' || typeof value.entity !== 'string') return false;
    const ministry = MINISTRIES.find((item) => item.code === value.ministry);
    return Boolean(ministry?.entities.some((entity) => entity.code === value.entity));
  }

  if (value.sector === 'SCHOOL') {
    return value.schoolType === 'GENERAL' || value.schoolType === 'TECHNICAL';
  }

  if (value.sector === 'UNIVERSITY') {
    return value.universityType === 'PUBLIC' || value.universityType === 'PRIVATE';
  }

  return false;
};

export const readInstitutionAccessContext = (): InstitutionAccessContext | null => {
  try {
    const raw = sessionStorage.getItem(ACCESS_CONTEXT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidInstitutionAccessContext(parsed)) {
      sessionStorage.removeItem(ACCESS_CONTEXT_KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(ACCESS_CONTEXT_KEY);
    return null;
  }
};

export const saveInstitutionAccessContext = (context: InstitutionAccessContext) => {
  if (!isValidInstitutionAccessContext(context)) {
    throw new Error('Contexte institutionnel EDUCO invalide.');
  }
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
 * L'accès aux espaces de l'État reste volontairement strict : sélectionner une
 * direction dans le portail ne donne aucun droit. Le rôle authentifié doit
 * correspondre à la destination, ou être administrateur du ministère/de l'État.
 */
export const canRoleAccessInstitutionContext = (
  role: string | null | undefined,
  context: InstitutionAccessContext | null,
) => {
  if (!context || !isValidInstitutionAccessContext(context)) return false;
  if (context.sector !== 'STATE' || !context.ministry || !context.entity) return false;

  const normalizedRole = normalizeRoleCode(role);
  if (!normalizedRole) return false;

  const exact = `${context.ministry}_${context.entity}`;
  const ministryAdmin = `${context.ministry}_ADMIN`;
  return normalizedRole === exact || normalizedRole === ministryAdmin || normalizedRole === 'ETAT_ADMIN';
};

export const buildGovernmentRoleCode = (context: InstitutionAccessContext) => {
  if (!isValidInstitutionAccessContext(context)) return null;
  if (context.sector !== 'STATE' || !context.ministry || !context.entity) return null;
  return `${context.ministry}_${context.entity}`;
};

export const institutionalAccessContextStorageKey = ACCESS_CONTEXT_KEY;
