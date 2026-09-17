import { getSupabaseClient } from '../lib/supabase';
import type { InstitutionAccessContext } from '../institutional/accessConfig';

export interface GovernmentWorkspaceSummary {
  schools: number;
  activeSchools: number;
  users: number;
  students: number;
  personnel: number;
  classes: number;
  paymentsCount: number;
  paymentsTotal: number;
  incomeTotal: number;
  expenseTotal: number;
  attendanceRecords: number;
  gradesRecords: number;
}

export interface GovernmentWorkspaceSnapshot {
  generatedAt: string;
  summary: GovernmentWorkspaceSummary;
  schools: Array<{
    id: number;
    name: string;
    identifier?: string | null;
    status?: string | null;
    address?: string | null;
    levels?: Record<string, unknown> | null;
    createdAt?: string | null;
  }>;
  roles: Array<{ role: string; count: number }>;
  classLevels: Array<{ level: string; count: number }>;
  recentActivity: Array<{
    action: string;
    schoolName?: string | null;
    userRole?: string | null;
    createdAt?: string | null;
  }>;
}

export async function fetchGovernmentWorkspaceSnapshot(
  context: InstitutionAccessContext,
): Promise<GovernmentWorkspaceSnapshot> {
  if (context.sector !== 'STATE' || !context.ministry || !context.entity) {
    throw new Error('Contexte institutionnel invalide.');
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('government_workspace_snapshot', {
    p_ministry: context.ministry,
    p_entity: context.entity,
  });

  if (error) throw new Error(error.message || 'Impossible de charger les données institutionnelles.');
  if (!data || typeof data !== 'object') throw new Error('Réponse institutionnelle invalide.');
  return data as GovernmentWorkspaceSnapshot;
}
