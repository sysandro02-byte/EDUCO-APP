// Cloud SQL / Supabase REST Client Integration

export interface DbStatus {
  connected: boolean;
  message?: string;
  tablesConfigured?: boolean;
  recordCount?: number;
  error?: string;
}

import { getSupabaseClient, getStoredSupabaseConfig, isPlaceholderSupabaseUrl } from '../lib/supabase';
import { getApiUrl } from '../lib/apiConfig';

async function getAuthHeaders() {
  try {
    const sbConfig = getStoredSupabaseConfig();
    let session = null;
    let token = localStorage.getItem('EDUCO_USER_TOKEN') || '';

    // Skip Supabase auth check if using a placeholder URL to avoid DNS timeouts
    if (!isPlaceholderSupabaseUrl(sbConfig.url)) {
      const supabase = getSupabaseClient();
      try {
        const sessionRes = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
        ]) as any;
        session = sessionRes?.data?.session;
        if (session?.access_token) {
          token = session.access_token;
        }
      } catch (err) {
        console.warn('Supabase getSession timeout/error, skipping:', err);
      }
    }
    if (!token) {
      const savedUserStr = localStorage.getItem('EDUCO_CURRENT_USER');
      if (savedUserStr) {
        try {
          const parsed = JSON.parse(savedUserStr);
          token = parsed.uid || parsed.email || '';
        } catch (e) {}
      }
    }
    const sbHeaders: Record<string, string> = {};
    if (!isPlaceholderSupabaseUrl(sbConfig.url)) {
      sbHeaders['x-supabase-url'] = sbConfig.url;
    }
    if (sbConfig.key && !sbConfig.key.includes('placeholder')) {
      sbHeaders['x-supabase-key'] = sbConfig.key;
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...sbHeaders
    };
  } catch (e) {
    return { 
      'Content-Type': 'application/json',
      'Authorization': ''
    };
  }
}

async function safeJson(res: Response, fallback: any = null) {
  try {
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    if (!text) return fallback;
    try {
      return JSON.parse(text);
    } catch (e) {
      return { error: text };
    }
  } catch (error: any) {
    return { error: error?.message || 'Erreur de traitement' };
  }
}

export async function checkDbConnection(): Promise<DbStatus> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/db/status'), { headers });
    return await safeJson(res, { connected: false, message: 'Support local actif' });
  } catch (error: any) {
    return {
      connected: false,
      message: 'Support local actif',
    };
  }
}

export async function registerSchool(data: {
  schoolName: string;
  schoolAddress: string;
  schoolPhone?: string;
  creationDate?: string;
  promoterName: string;
  promoterContact?: string;
  promoterEmail?: string;
  levels?: any;
  openingAuthorizationDoc?: string | null;
  promoterIdDoc?: string | null;
  statutesDoc?: string | null;
  adminPassword?: string;
}) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/auth/register-school'), {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error) {
    console.error('Failed to register school:', error);
    return null;
  }
}

export async function getCurrentUser() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/auth/me'), { headers });
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch current user:', error);
    return null;
  }
}

export async function findUserByEmail(email: string) {
  try {
    const res = await fetch(getApiUrl(`/api/auth/find-user?email=${encodeURIComponent(email)}`));
    return await res.json();
  } catch (error) {
    console.error('Failed to find user by email:', error);
    return null;
  }
}

export async function saveUserToDb(user: any) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/users'), {
      method: 'POST',
      headers,
      body: JSON.stringify(user),
    });
    return await res.json();
  } catch (error) {
    console.warn('Error saving user to DB:', error);
    return null;
  }
}

export async function deleteUserFromDb(userId: number) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/users/${userId}`), {
      method: 'DELETE',
      headers,
    });
    return await res.json();
  } catch (error) {
    console.warn('Error deleting user from DB:', error);
    return null;
  }
}

export async function getSchoolSettings() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/school'), { headers });
    return await safeJson(res);
  } catch (error) {
    console.error('Failed to fetch school settings:', error);
    return null;
  }
}

export async function saveTransactionToDb(transaction: any) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/transactions'), {
      method: 'POST',
      headers,
      body: JSON.stringify(transaction),
    });
    return await res.json();
  } catch (error) {
    console.warn('Error saving transaction to DB:', error);
    return null;
  }
}

export async function updateTransactionStatusInDb(txnId: string, status: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/transactions/${txnId}/status`), {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status }),
    });
    return await res.json();
  } catch (error) {
    console.warn('Error updating transaction in DB:', error);
    return null;
  }
}

export async function savePaymentToDb(payment: any) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/payments'), {
      method: 'POST',
      headers,
      body: JSON.stringify(payment),
    });
    return await res.json();
  } catch (error) {
    console.warn('Error saving payment to DB:', error);
    return null;
  }
}

export async function syncInitialData(data: any) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/db/init-seed'), {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error) {
    console.warn('Error syncing initial data:', error);
    return null;
  }
}

export async function updateBudgetInDb(total: number, categories?: any[]) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/budget'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ total, categories }),
    });
    return await res.json();
  } catch (error) {
    console.warn('Error saving budget to DB:', error);
    return null;
  }
}

// ==========================================
// SUBSCRIPTION & LICENSING API METHODS
// ==========================================

export interface SchoolSubscriptionInfo {
  isActive: boolean;
  isPreSubscription: boolean;
  planType: 'standard' | 'ai_premium' | null;
  planName?: string;
  isAiEnabled: boolean;
  daysRemaining: number;
  endDate?: string;
  startDate?: string;
  months?: number;
  amountPaid?: number;
  code?: string;
  autoRenew?: boolean;
  autoRenewFrequency?: string;
  status?: string;
  schoolIdentifier: string;
  schoolName: string;
  promoterName?: string;
  promoterContact?: string;
}

export async function fetchCurrentSubscription(): Promise<SchoolSubscriptionInfo | null> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/subscriptions/current'), { headers });
    if (!res.ok) throw new Error('Erreur réseau');
    return await res.json();
  } catch (error) {
    // Return local stored subscription if any
    const saved = localStorage.getItem('educo_local_subscription');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return null;
  }
}

export async function activateSubscriptionCode(code: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/subscriptions/activate'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    if (res.ok && data.subscription) {
      localStorage.setItem('educo_local_subscription', JSON.stringify({
        isActive: true,
        isPreSubscription: false,
        planType: data.subscription.planType,
        isAiEnabled: data.subscription.planType === 'ai_premium',
        daysRemaining: (data.subscription.months || 1) * 30,
        endDate: data.subscription.endDate,
        schoolIdentifier: data.subscription.schoolIdentifier,
        schoolName: data.subscription.schoolName,
      }));
    }
    return data;
  } catch (error: any) {
    console.error('Error activating subscription:', error);
    return { error: error.message || 'Erreur lors de l\'activation' };
  }
}

export async function requestSubscriptionRenewal(data: {
  requestedPlan: 'standard' | 'ai_premium';
  requestedMonths: number;
  notes?: string;
}) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/subscriptions/request-renewal'), {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error requesting renewal:', error);
    return { error: error.message || 'Erreur lors de la demande' };
  }
}

export async function fetchAdminSubscriptions() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/admin/subscriptions'), { headers });
    return await res.json();
  } catch (error: any) {
    console.error('Error fetching admin subscriptions:', error);
    return { subscriptions: [], requests: [], schools: [] };
  }
}

export async function adminGenerateSubscription(data: {
  schoolName: string;
  schoolIdentifier: string;
  promoterName: string;
  promoterContact?: string;
  planType: 'standard' | 'ai_premium';
  months: number;
  amountPaid?: number;
  autoRenew?: boolean;
  autoRenewFrequency?: 'monthly' | 'before_expiry';
}) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/admin/subscriptions/generate'), {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error generating subscription:', error);
    return { error: error.message || 'Erreur lors de la génération' };
  }
}

export async function adminExtendSubscription(subscriptionId: number, additionalMonths: number) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/admin/subscriptions/extend'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ subscriptionId, additionalMonths }),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error extending subscription:', error);
    return { error: error.message || 'Erreur lors de la prolongation' };
  }
}

export async function adminToggleAutoRenew(subscriptionId: number, autoRenew: boolean, autoRenewFrequency?: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/admin/subscriptions/toggle-auto-renew'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ subscriptionId, autoRenew, autoRenewFrequency }),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error updating auto renew:', error);
    return { error: error.message || 'Erreur lors de la mise à jour' };
  }
}

export async function adminFulfillRequest(requestId: number, autoRenew?: boolean, autoRenewFrequency?: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/admin/subscriptions/fulfill-request'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ requestId, autoRenew, autoRenewFrequency }),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error fulfilling request:', error);
    return { error: error.message || 'Erreur lors du traitement' };
  }
}

// Admin Schools Directory
export async function fetchAdminRegisteredSchools() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/admin/registered-schools'), { headers });
    return await safeJson(res, { success: false, schools: [] });
  } catch (error: any) {
    console.warn('Error fetching admin registered schools:', error?.message || error);
    return { success: false, schools: [], error: error.message || 'Erreur lors du chargement des établissements' };
  }
}

// Admin Consolidated Data Export
export async function fetchAdminExportData() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/admin/export-data'), { headers });
    return await safeJson(res, { success: false, schools: [], users: [], students: [], personnel: [], classes: [], payments: [], transactions: [], attendance: [] });
  } catch (error: any) {
    console.warn('Error fetching admin export data:', error?.message || error);
    return { 
      success: false, 
      schools: [], 
      users: [], 
      students: [], 
      personnel: [], 
      classes: [], 
      payments: [], 
      transactions: [], 
      attendance: [],
      error: error.message || 'Erreur lors du chargement des données d\'exportation' 
    };
  }
}

// Bulk Messaging Brevo API Dispatcher
export async function sendBrevoBulkMessages(payload: {
  recipients: Array<{
    name: string;
    email?: string;
    phone?: string;
    studentName?: string;
    className?: string;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
    balance?: number;
    totalFees?: number;
    amountPaid?: number;
    role?: string;
  }>;
  channel: 'email' | 'sms' | 'whatsapp';
  subject?: string;
  message: string;
  schoolName: string;
  apiKey?: string;
  senderName?: string;
  senderEmail?: string;
}) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/messaging/brevo-bulk'), {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error sending Brevo bulk messages:', error);
    return { error: error.message || 'Erreur lors de l\'envoi groupé Brevo' };
  }
}

// Parent Surveys API
export async function fetchSurveys() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/surveys'), { headers });
    return await res.json();
  } catch (error: any) {
    console.error('Error fetching surveys:', error);
    return { error: error.message || 'Erreur lors du chargement des sondages' };
  }
}

export async function createSurvey(data: {
  title: string;
  description?: string;
  category: string;
  targetAudience: string;
  deadline?: string;
  questions: any[];
}) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/surveys/create'), {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error creating survey:', error);
    return { error: error.message || 'Erreur lors de la création du sondage' };
  }
}

export async function submitSurveyResponse(surveyId: number, data: {
  parentName: string;
  parentPhone?: string;
  parentEmail?: string;
  studentName?: string;
  studentClass?: string;
  channel?: string;
  answers: Record<string, any>;
  comment?: string;
}) {
  try {
    const res = await fetch(getApiUrl(`/api/surveys/${surveyId}/respond`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error submitting survey response:', error);
    return { error: error.message || 'Erreur lors de l\'enregistrement de votre réponse' };
  }
}

export async function fetchSurveyReport(surveyId: number) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/surveys/${surveyId}/report`), { headers });
    return await res.json();
  } catch (error: any) {
    console.error('Error fetching survey report:', error);
    return { error: error.message || 'Erreur lors du chargement du rapport' };
  }
}

export async function broadcastSurvey(surveyId: number, data: { channel?: string; customMessage?: string }) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/surveys/${surveyId}/broadcast`), {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (error: any) {
    console.error('Error broadcasting survey:', error);
    return { error: error.message || 'Erreur lors de la diffusion du sondage' };
  }
}

export async function runSupabaseDeepDiagnostic() {
  console.log('=== DÉBUT DIAGNOSTIC DEEP ===');
  const logs: string[] = [];
  
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/admin/diagnostic'), { headers });
    if (res.ok) {
      const data = await res.json();
      if (data && data.success) {
        logs.push(`Diagnostic serveur: Succès`);
        logs.push(`Connexion PostgreSQL active: OK`);
        logs.push(`Table students: OK (${data.studentsCount} élèves)`);
        logs.push(`Table users: OK (${data.usersCount} utilisateurs)`);
        logs.push(`Table schools: OK (${data.schoolsCount} établissements)`);
        return {
          success: true,
          studentsCount: data.studentsCount,
          studentsError: null,
          usersCount: data.usersCount,
          usersError: null,
          logs,
          timestamp: data.timestamp || new Date().toISOString()
        };
      }
    } else {
      logs.push(`Diagnostic serveur non disponible (Status: ${res.status}). Authentification requise.`);
    }
  } catch (err: any) {
    logs.push(`Diagnostic serveur échoué: ${err.message || err}`);
  }

  // Graceful local failure instead of raw browser-to-Supabase direct REST fetch.
  logs.push(`Note: Requêtes directes Supabase désactivées pour prévenir les restrictions de sandbox du navigateur.`);
  logs.push(`Résolution: reconnectez-vous avec une session valide pour lire les données réelles.`);
  
  return {
    success: false,
    studentsCount: 0,
    studentsError: "Connexion sécurisée requise ou session expirée.",
    usersCount: 0,
    usersError: "Connexion sécurisée requise ou session expirée.",
    logs,
    timestamp: new Date().toISOString()
  };
}

export async function deleteSchoolFromDb(schoolId: number, schoolName?: string) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/schools/${schoolId}`), {
      method: 'DELETE',
      headers,
      body: JSON.stringify({ schoolName }),
    });
    return await res.json();
  } catch (error) {
    console.warn('Error deleting school from DB:', error);
    return null;
  }
}

export async function saveActivityLogToDb(logEntry: {
  action: string;
  details?: string;
  userName?: string;
  userRole?: string;
  userEmail?: string;
  schoolName?: string;
  schoolId?: number;
  ipAddress?: string;
  location?: string;
  device?: string;
  browser?: string;
  page?: string;
}) {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/activity-logs'), {
      method: 'POST',
      headers,
      body: JSON.stringify(logEntry),
    });
    return await res.json();
  } catch (error) {
    console.warn('Error saving activity log to DB:', error);
    return null;
  }
}

export async function fetchActivityLogsFromDb() {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl('/api/activity-logs'), { headers });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    console.warn('Error fetching activity logs from DB:', error);
    return [];
  }
}

export async function fetchConsolidatedFinancials(schoolId: string = 'all') {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(getApiUrl(`/api/admin/consolidated-financials?schoolId=${schoolId}`), { headers });
    return await safeJson(res, { success: false, monthlyData: [] });
  } catch (error) {
    console.warn('Error fetching consolidated financials:', error);
    return { success: false, monthlyData: [] };
  }
}
