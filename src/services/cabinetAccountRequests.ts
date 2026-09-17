import { getApiUrl } from '../lib/apiConfig';

export interface CabinetAccountRequest {
  id: string;
  ministry: string;
  entity: string;
  requested_role: string;
  full_name: string;
  official_email: string;
  phone: string;
  employee_number: string;
  function_title: string;
  service_unit: string;
  appointment_reference: string;
  justification: string;
  extra_data: Record<string, unknown>;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewer_uid?: string | null;
  reviewer_role?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  account_uid?: string | null;
  notification_status?: 'PENDING' | 'SENT' | 'FAILED' | 'NOT_REQUIRED';
  notification_error?: string | null;
  notification_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HigherEducationCabinetRequest {
  id: string;
  institution_type: 'PUBLIC' | 'PRIVATE';
  request_type: 'CREATION' | 'OPENING' | 'REOPENING';
  official_name: string;
  legal_form?: string | null;
  promoter_or_initiator: string;
  legal_representative?: string | null;
  official_email: string;
  phone: string;
  department?: string | null;
  address: string;
  planned_capacity?: number | null;
  lmd_levels: string[];
  programs: Array<{ label?: string } | string>;
  dossier_data: Record<string, unknown>;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';
  reviewer_uid?: string | null;
  reviewer_role?: string | null;
  review_notes?: string | null;
  reviewed_at?: string | null;
  notification_status?: 'PENDING' | 'SENT' | 'FAILED' | 'NOT_REQUIRED';
  notification_error?: string | null;
  notification_sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

const authHeaders = () => {
  const token = localStorage.getItem('EDUCO_USER_TOKEN') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const requestJson = async (path: string, init: RequestInit = {}) => {
  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) throw new Error(data?.error || `Erreur serveur (${response.status}).`);
  return data;
};

export const listCabinetAccountRequests = async (): Promise<CabinetAccountRequest[]> => {
  const data = await requestJson('/api/government/account-requests');
  return Array.isArray(data?.requests) ? data.requests : [];
};

export const decideCabinetAccountRequest = async (
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  notes: string,
) => requestJson(`/api/government/account-requests/${encodeURIComponent(id)}/decision`, {
  method: 'POST',
  body: JSON.stringify({ decision, notes }),
});

export const resendCabinetAccountDecisionEmail = async (id: string) => requestJson(
  `/api/government/account-requests/${encodeURIComponent(id)}/resend-notification`,
  { method: 'POST', body: JSON.stringify({}) },
);

export const listHigherEducationCabinetRequests = async (): Promise<HigherEducationCabinetRequest[]> => {
  const data = await requestJson('/api/government/higher-education-requests');
  return Array.isArray(data?.requests) ? data.requests : [];
};

export const decideHigherEducationCabinetRequest = async (
  id: string,
  decision: 'APPROVED' | 'REJECTED',
  notes: string,
) => requestJson(`/api/government/higher-education-requests/${encodeURIComponent(id)}/decision`, {
  method: 'POST',
  body: JSON.stringify({ decision, notes }),
});
