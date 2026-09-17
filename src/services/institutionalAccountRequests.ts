import { buildGovernmentRoleCode, isValidInstitutionAccessContext } from '../institutional/accessContext';
import type { InstitutionAccessContext } from '../institutional/accessConfig';
import { getApiUrl } from '../lib/apiConfig';

export interface InstitutionalAccountRequestPayload {
  context: InstitutionAccessContext;
  values: Record<string, string>;
}

const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);

export const submitInstitutionalAccountRequest = async ({
  context,
  values,
}: InstitutionalAccountRequestPayload) => {
  if (!isValidInstitutionAccessContext(context) || context.sector !== 'STATE' || !context.ministry || !context.entity) {
    throw new Error('Contexte institutionnel invalide.');
  }
  if (context.entity === 'CABINET') {
    throw new Error('Les comptes Cabinet sont créés par l’administration institutionnelle, pas depuis ce formulaire.');
  }

  const fullName = clean(values.fullName, 160);
  const officialEmail = clean(values.officialEmail, 254).toLowerCase();
  const phone = clean(values.phone, 40);
  const employeeNumber = clean(values.employeeNumber, 120);
  const functionTitle = clean(values.functionTitle, 180);
  const serviceUnit = clean(values.serviceUnit, 220);
  const appointmentReference = clean(values.appointmentReference, 220);
  const justification = clean(values.justification, 2000);

  if (!fullName || !officialEmail || !phone || !employeeNumber || !functionTitle || !serviceUnit || !appointmentReference || !justification) {
    throw new Error('Veuillez compléter tous les champs obligatoires.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail)) {
    throw new Error('Adresse e-mail invalide.');
  }

  const reserved = new Set([
    'fullName', 'officialEmail', 'phone', 'employeeNumber', 'functionTitle',
    'serviceUnit', 'appointmentReference', 'justification',
  ]);
  const extraData = Object.fromEntries(
    Object.entries(values)
      .filter(([key, value]) => !reserved.has(key) && clean(value))
      .map(([key, value]) => [key, clean(value, 500)]),
  );

  const requestedRole = buildGovernmentRoleCode(context);
  if (!requestedRole) throw new Error('Rôle institutionnel impossible à déterminer.');

  const response = await fetch(getApiUrl('/api/government/account-requests/submit'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ministry: context.ministry,
      entity: context.entity,
      requestedRole,
      fullName,
      officialEmail,
      phone,
      employeeNumber,
      functionTitle,
      serviceUnit,
      appointmentReference,
      justification,
      extraData,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw new Error(data?.error || 'Impossible de transmettre la demande au cabinet ministériel.');
  }

  return { success: true, message: data?.message || `Demande transmise au cabinet ${context.ministry}.` };
};
