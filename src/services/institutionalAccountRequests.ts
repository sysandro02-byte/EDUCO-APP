import { getSupabaseClient } from '../lib/supabase';
import { buildGovernmentRoleCode, isValidInstitutionAccessContext } from '../institutional/accessContext';
import type { InstitutionAccessContext } from '../institutional/accessConfig';

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
  const metadata = Object.fromEntries(
    Object.entries(values)
      .filter(([key, value]) => !reserved.has(key) && clean(value))
      .map(([key, value]) => [key, clean(value, 500)]),
  );

  const requestedRole = buildGovernmentRoleCode(context);
  if (!requestedRole) throw new Error('Rôle institutionnel impossible à déterminer.');

  const client = getSupabaseClient();
  const { error } = await client
    .from('institutional_account_requests')
    .insert({
      ministry: context.ministry,
      entity: context.entity,
      requested_role: requestedRole,
      full_name: fullName,
      official_email: officialEmail,
      phone,
      employee_number: employeeNumber,
      function_title: functionTitle,
      service_unit: serviceUnit,
      appointment_reference: appointmentReference,
      justification,
      extra_data: metadata,
      status: 'PENDING',
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Une demande en attente existe déjà pour cette adresse et cette entité.');
    }
    throw new Error(error.message || 'Impossible d’enregistrer la demande.');
  }

  return { success: true };
};
