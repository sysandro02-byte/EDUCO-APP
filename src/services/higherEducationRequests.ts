import { getSupabaseClient } from '../lib/supabase';
import type { HigherEducationOwnership } from '../institutional/higherEducationRequestConfig';

export interface HigherEducationRequestPayload {
  ownership: HigherEducationOwnership;
  values: Record<string, string>;
}

const clean = (value: unknown, max = 3000) => String(value ?? '').trim().slice(0, max);

export async function submitHigherEducationEstablishmentRequest({ ownership, values }: HigherEducationRequestPayload) {
  const officialName = clean(values.officialName, 220);
  const officialEmail = clean(values.officialEmail, 254).toLowerCase();
  const phone = clean(values.phone, 40);
  const address = clean(values.address, 1200);
  const promoterOrInitiator = clean(values.promoterOrInitiator, 220);
  const legalRepresentative = clean(values.legalRepresentative, 220);
  const requestType = clean(values.requestType, 20) || 'CREATION';
  const plannedCapacity = Number(values.plannedCapacity || 0);

  if (!officialName || !officialEmail || !phone || !address || !promoterOrInitiator || !legalRepresentative) {
    throw new Error('Veuillez compléter les informations obligatoires du dossier.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(officialEmail)) {
    throw new Error('Adresse e-mail officielle invalide.');
  }
  if (!['CREATION', 'OPENING', 'REOPENING'].includes(requestType)) {
    throw new Error('Nature de la demande invalide.');
  }
  if (!Number.isFinite(plannedCapacity) || plannedCapacity <= 0) {
    throw new Error("La capacité d'accueil prévisionnelle doit être supérieure à zéro.");
  }

  const programs = clean(values.programsSummary, 6000)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((label) => ({ label }));
  if (!programs.length) throw new Error('Renseignez au moins une filière ou un programme prévu.');

  const lmdRaw = clean(values.lmdLevels, 120);
  const lmdLevels = lmdRaw.split('+').map((item) => item.trim()).filter(Boolean);

  const reserved = new Set([
    'officialName', 'requestType', 'promoterOrInitiator', 'legalRepresentative',
    'officialEmail', 'phone', 'department', 'address', 'plannedCapacity',
    'lmdLevels', 'programsSummary', 'legalForm',
  ]);
  const dossierData = Object.fromEntries(
    Object.entries(values)
      .filter(([key, value]) => !reserved.has(key) && clean(value))
      .map(([key, value]) => [key, clean(value)]),
  );

  const client = getSupabaseClient();
  const { error } = await client
    .from('higher_education_establishment_requests')
    .insert({
      institution_type: ownership,
      request_type: requestType,
      official_name: officialName,
      legal_form: clean(values.legalForm, 220) || null,
      promoter_or_initiator: promoterOrInitiator,
      legal_representative: legalRepresentative,
      official_email: officialEmail,
      phone,
      department: clean(values.department, 120) || null,
      address,
      planned_capacity: Math.trunc(plannedCapacity),
      lmd_levels: lmdLevels,
      programs,
      dossier_data: dossierData,
      status: 'PENDING',
    });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Un dossier en attente existe déjà pour cet établissement et cette adresse e-mail.');
    }
    throw new Error(error.message || "Impossible d'enregistrer le dossier.");
  }

  // La table est volontairement INSERT-only pour les visiteurs : ne pas effectuer
  // de SELECT après l'insertion, afin de ne pas contourner la séparation dépôt/instruction.
  return { success: true };
}
