import { getSupabaseClient } from '../lib/supabase';
import type { InstitutionAccessContext } from '../institutional/accessConfig';
import type { GovernmentDomain } from '../institutional/governmentDomains';

export interface GovernmentRecord {
  id: number;
  ministry: string;
  entity: string;
  title: string;
  reference?: string | null;
  status: string;
  description?: string | null;
  school_id?: number | null;
  due_date?: string | null;
  data?: Record<string, unknown> | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GovernmentRecordDraft {
  id?: number | null;
  title: string;
  reference?: string;
  status?: string;
  description?: string;
  schoolId?: number | null;
  dueDate?: string;
  data?: Record<string, unknown>;
}

export interface GovernmentRecordEvent {
  id: number;
  ministry: string;
  entity: string;
  domain: string;
  record_id: number;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  actor_uid?: string | null;
  details?: Record<string, unknown> | null;
  created_at?: string | null;
}

const validateContext = (context: InstitutionAccessContext) => {
  if (context.sector !== 'STATE' || !context.ministry || !context.entity) {
    throw new Error('Contexte institutionnel invalide.');
  }
  return { ministry: context.ministry, entity: context.entity };
};

export async function listGovernmentRecords(
  context: InstitutionAccessContext,
  domain: GovernmentDomain,
): Promise<GovernmentRecord[]> {
  const { ministry, entity } = validateContext(context);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('government_module_records', {
    p_ministry: ministry,
    p_entity: entity,
    p_domain: domain,
  });
  if (error) throw new Error(error.message || 'Impossible de charger les dossiers.');
  const rows = data && typeof data === 'object' && Array.isArray((data as any).rows) ? (data as any).rows : [];
  return rows as GovernmentRecord[];
}

export async function saveGovernmentRecord(
  context: InstitutionAccessContext,
  domain: GovernmentDomain,
  record: GovernmentRecordDraft,
): Promise<GovernmentRecord> {
  const { ministry, entity } = validateContext(context);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('government_module_save', {
    p_ministry: ministry,
    p_entity: entity,
    p_domain: domain,
    p_record: record,
  });
  if (error) throw new Error(error.message || 'Impossible d’enregistrer le dossier.');
  if (!data || typeof data !== 'object') throw new Error('Réponse de sauvegarde invalide.');
  return data as GovernmentRecord;
}

export async function transitionGovernmentRecord(
  context: InstitutionAccessContext,
  domain: GovernmentDomain,
  id: number,
  status: string,
): Promise<GovernmentRecord> {
  const { ministry, entity } = validateContext(context);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('government_module_transition', {
    p_ministry: ministry,
    p_entity: entity,
    p_domain: domain,
    p_id: id,
    p_status: status,
  });
  if (error) throw new Error(error.message || 'Impossible de faire évoluer le dossier.');
  if (!data || typeof data !== 'object') throw new Error('Réponse de workflow invalide.');
  return data as GovernmentRecord;
}

export async function listGovernmentRecordHistory(
  context: InstitutionAccessContext,
  domain: GovernmentDomain,
  id: number,
): Promise<GovernmentRecordEvent[]> {
  const { ministry, entity } = validateContext(context);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('government_module_history', {
    p_ministry: ministry,
    p_entity: entity,
    p_domain: domain,
    p_id: id,
  });
  if (error) throw new Error(error.message || 'Impossible de charger l’historique.');
  const rows = data && typeof data === 'object' && Array.isArray((data as any).rows) ? (data as any).rows : [];
  return rows as GovernmentRecordEvent[];
}

export async function deleteGovernmentRecord(
  context: InstitutionAccessContext,
  domain: GovernmentDomain,
  id: number,
): Promise<void> {
  const { ministry, entity } = validateContext(context);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('government_module_delete', {
    p_ministry: ministry,
    p_entity: entity,
    p_domain: domain,
    p_id: id,
  });
  if (error) throw new Error(error.message || 'Impossible de supprimer le dossier.');
  if (data !== true) throw new Error('Dossier introuvable ou suppression non autorisée.');
}
