/// <reference types="vite/client" />

export type EducoPortalMode = 'education' | 'government';

declare const __EDUCO_PORTAL_MODE__: EducoPortalMode | undefined;

const resolvedPortalMode: EducoPortalMode =
  typeof __EDUCO_PORTAL_MODE__ !== 'undefined' && __EDUCO_PORTAL_MODE__ === 'government'
    ? 'government'
    : 'education';

export const EDUCO_PORTAL_MODE: EducoPortalMode = resolvedPortalMode;

export function isGovernmentPortalRole(role: string) {
  const normalized = String(role || '').trim().toUpperCase().replace(/[ -]+/g, '_');
  return normalized === 'ETAT_ADMIN' || /^(MEPSA|MES|METP|MFP)_/.test(normalized);
}

export function isRoleAllowedOnCurrentPortal(role: string) {
  const governmentRole = isGovernmentPortalRole(role);
  return EDUCO_PORTAL_MODE === 'government' ? governmentRole : !governmentRole;
}

export function getPortalAccessError(role: string) {
  if (isGovernmentPortalRole(role)) {
    return 'Ce compte ministériel est réservé au portail Ministères & Directions EDUCO.';
  }
  return 'Ce compte établissement/université est réservé au portail EDUCO Écoles & Universités (educo.loukatech.com).';
}
