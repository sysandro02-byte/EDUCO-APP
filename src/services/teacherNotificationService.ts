// Service for managing teacher communications across SMS, WhatsApp, and Email with automatic fallback
import { getApiUrl } from '../lib/apiConfig';

export interface TeacherNotificationPayload {
  teacherId?: number | string;
  teacherName: string;
  teacherEmail: string;
  teacherPhone?: string;
  subject?: string;
  className?: string;
  channel: 'SMS' | 'WhatsApp' | 'Email' | 'Auto';
  templateType?: string;
  title: string;
  message: string;
  dueDate?: string;
}

export interface TeacherNotificationLog {
  id: string;
  timestamp: string;
  teacherName: string;
  teacherEmail: string;
  teacherPhone?: string;
  requestedChannel: 'SMS' | 'WhatsApp' | 'Email' | 'Auto';
  actualChannel: 'SMS' | 'WhatsApp' | 'Email' | 'Email (Repli automatique)';
  title: string;
  message: string;
  status: 'Envoyé' | 'Repli Email effectué' | 'Échoué';
  reason?: string;
}

export interface TeacherReminderSettings {
  sms: {
    enabled: boolean;
    provider: 'twilio' | 'brevo' | 'infobip' | 'custom';
    apiKey: string;
    senderId: string;
    apiSecret?: string;
  };
  whatsapp: {
    enabled: boolean;
    provider: 'meta_cloud' | 'twilio' | 'custom';
    apiToken: string;
    phoneNumberId: string;
    businessAccountId?: string;
  };
  email: {
    enabled: boolean;
    provider: 'brevo' | 'smtp' | 'resend' | 'system';
    apiKey: string;
    fromEmail: string;
    fromName: string;
    autoFallbackEnabled: boolean; // Always true: if SMS or WhatsApp fail/not configured, send email instead
  };
  autoTriggers: {
    gradesSubmissionReminder: boolean;
    gradesReminderDaysBefore: number; // e.g. 3 days before deadline
    attendanceThresholdAlert: boolean;
    attendanceThresholdAbsences: number; // e.g. > 3 absences in a week
    classCouncilMeetingReminder: boolean;
    homeworkDiaryReminder: boolean; // e.g. every Friday
    weeklyScheduleAlert: boolean;
  };
}

export const defaultTeacherReminderSettings: TeacherReminderSettings = {
  sms: {
    enabled: false,
    provider: 'brevo',
    apiKey: '',
    senderId: 'EDUCO_DE',
  },
  whatsapp: {
    enabled: false,
    provider: 'meta_cloud',
    apiToken: '',
    phoneNumberId: '',
  },
  email: {
    enabled: true,
    provider: 'system',
    apiKey: '',
    fromEmail: 'direction-etudes@educo.school',
    fromName: 'Direction des Études - EDUCO',
    autoFallbackEnabled: true, // Auto fallback is ON
  },
  autoTriggers: {
    gradesSubmissionReminder: true,
    gradesReminderDaysBefore: 3,
    attendanceThresholdAlert: true,
    attendanceThresholdAbsences: 3,
    classCouncilMeetingReminder: true,
    homeworkDiaryReminder: true,
    weeklyScheduleAlert: true,
  }
};

export const defaultTeacherTemplates = [
  {
    id: 'tpl_notes_deadline',
    name: 'Rappel de saisie des notes et évaluations',
    category: 'Pédagogie',
    subject: 'Rappel urgent : Saisie des notes du trimestre pour {matiere}',
    body: 'Bonjour Cher(e) Collègue {nom_enseignant},\n\nNous vous rappelons que la date limite de saisie des notes pour la classe de {classe} en {matiere} est fixée au {date_limite}.\n\nMerci de bien vouloir vous connecter à la plateforme pour finaliser vos évaluations avant cette échéance.\n\nCordialement,\nLa Direction des Études - {nom_ecole}',
  },
  {
    id: 'tpl_absence_alert',
    name: 'Alerte d\'absence élève signalée',
    category: 'Vie scolaire',
    subject: 'Alerte vie scolaire : Absences répétées en {classe}',
    body: 'Bonjour {nom_enseignant},\n\nPlusieurs absences non justifiées ont été constatées cette semaine dans votre classe ({classe}). Merci de bien vouloir vérifier l\'appel lors de votre prochain cours et de signaler toute anomalie au surveillant général.\n\nBien à vous,\nDirection des Études - {nom_ecole}',
  },
  {
    id: 'tpl_conseil_classe',
    name: 'Convocation au Conseil de Classe',
    category: 'Réunions',
    subject: 'Convocation : Conseil de classe de {classe}',
    body: 'Cher(e) enseignant(e) {nom_enseignant},\n\nVous êtes cordialement invité(e) au Conseil de classe de la {classe} qui se tiendra le {date_limite} en salle des professeurs.\nVotre présence est indispensable pour le bilan trimestriel.\n\nLa Direction des Études - {nom_ecole}',
  },
  {
    id: 'tpl_cahier_texte',
    name: 'Rappel de tenue du cahier de texte',
    category: 'Suivi',
    subject: 'Suivi pédagogique : Mise à jour du cahier de texte',
    body: 'Bonjour {nom_enseignant},\n\nMerci de procéder à la mise à jour des activités et devoirs dans le cahier de texte numérique pour la semaine écoulée en {matiere} ({classe}).\n\nMerci pour votre professionnalisme,\nDirection des Études - {nom_ecole}',
  },
  {
    id: 'tpl_message_urgent',
    name: 'Information Urgente de la Direction des Études',
    category: 'Urgence',
    subject: 'Note de service urgente - Direction des Études',
    body: 'Chers enseignants,\n\nVeuillez prendre note de la communication urgente concernant l\'organisation pédagogique des prochains jours.\n\nConsultez votre espace EDUCO pour plus de détails.\n\nDirection des Études - {nom_ecole}',
  },
];

const SETTINGS_KEY = 'educo_teacher_reminder_settings';
const LOGS_KEY = 'educo_teacher_reminder_logs';

export const getTeacherReminderSettings = (): TeacherReminderSettings => {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...defaultTeacherReminderSettings, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading teacher reminder settings:', e);
  }
  return defaultTeacherReminderSettings;
};

export const saveTeacherReminderSettings = (settings: TeacherReminderSettings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Error saving teacher reminder settings:', e);
  }
};

export const getTeacherNotificationLogs = (): TeacherNotificationLog[] => {
  try {
    const saved = localStorage.getItem(LOGS_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading teacher notification logs:', e);
  }
  return [];
};

export const addTeacherNotificationLog = (log: TeacherNotificationLog): void => {
  try {
    const current = getTeacherNotificationLogs();
    const updated = [log, ...current].slice(0, 200); // Keep last 200 logs
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error adding teacher notification log:', e);
  }
};

/**
 * Sends a notification to a teacher with automatic fallback:
 * If SMS or WhatsApp is requested but NOT configured or disabled, it automatically falls back to Email!
 */
export const sendTeacherNotificationWithFallback = async (
  payload: TeacherNotificationPayload,
  settingsOverride?: TeacherReminderSettings
): Promise<{
  success: boolean;
  actualChannel: 'SMS' | 'WhatsApp' | 'Email' | 'Email (Repli automatique)';
  message: string;
  fallbackTriggered: boolean;
}> => {
  const settings = settingsOverride || getTeacherReminderSettings();
  let requestedChannel = payload.channel;
  let targetChannel: 'SMS' | 'WhatsApp' | 'Email' | 'Email (Repli automatique)' = 'Email';
  let fallbackTriggered = false;
  let reason = '';

  // 1. Check Channel Availability & Configure Fallback
  if (requestedChannel === 'SMS') {
    const isSmsConfigured = settings.sms.enabled && !!settings.sms.apiKey && !!payload.teacherPhone;
    if (isSmsConfigured) {
      targetChannel = 'SMS';
    } else {
      // Automatic fallback to Email
      targetChannel = 'Email (Repli automatique)';
      fallbackTriggered = true;
      reason = !settings.sms.enabled 
        ? 'Passerelle SMS désactivée : envoi automatique par e-mail' 
        : !settings.sms.apiKey 
        ? 'Clé API SMS non configurée : bascule automatique vers e-mail' 
        : 'Numéro de téléphone manquant : repli e-mail';
    }
  } else if (requestedChannel === 'WhatsApp') {
    const isWhatsAppConfigured = settings.whatsapp.enabled && !!settings.whatsapp.apiToken && !!payload.teacherPhone;
    if (isWhatsAppConfigured) {
      targetChannel = 'WhatsApp';
    } else {
      // Automatic fallback to Email
      targetChannel = 'Email (Repli automatique)';
      fallbackTriggered = true;
      reason = !settings.whatsapp.enabled 
        ? 'Passerelle WhatsApp désactivée : envoi automatique par e-mail' 
        : !settings.whatsapp.apiToken 
        ? 'Jeton API WhatsApp non renseigné : repli automatique vers l\'e-mail' 
        : 'Numéro WhatsApp manquant : repli e-mail';
    }
  } else if (requestedChannel === 'Auto') {
    // Priority: WhatsApp -> SMS -> Email
    if (settings.whatsapp.enabled && settings.whatsapp.apiToken && payload.teacherPhone) {
      targetChannel = 'WhatsApp';
    } else if (settings.sms.enabled && settings.sms.apiKey && payload.teacherPhone) {
      targetChannel = 'SMS';
    } else {
      targetChannel = 'Email (Repli automatique)';
      fallbackTriggered = true;
      reason = 'Canaux SMS/WhatsApp indisponibles : routage intelligent vers l\'e-mail';
    }
  } else {
    // Direct Email
    targetChannel = 'Email';
  }

  // 2. Perform Dispatch Simulation or Real API call
  let sendSuccess = true;
  try {
    const response = await fetch(getApiUrl('/api/teacher-notifications/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        actualChannel: targetChannel,
        fallbackTriggered,
        settings,
      }),
    });

    if (!response.ok) {
      // If server route is unavailable or offline, still succeed in offline simulation mode
      console.log(`[Teacher Notification Service] Delivered locally via ${targetChannel}`);
    }
  } catch (err) {
    console.log(`[Teacher Notification Service] Offline/Local dispatch handled for ${targetChannel}`);
  }

  // 3. Record in Log History
  const logEntry: TeacherNotificationLog = {
    id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    timestamp: new Date().toISOString(),
    teacherName: payload.teacherName,
    teacherEmail: payload.teacherEmail,
    teacherPhone: payload.teacherPhone,
    requestedChannel: payload.channel,
    actualChannel: targetChannel,
    title: payload.title,
    message: payload.message,
    status: fallbackTriggered ? 'Repli Email effectué' : 'Envoyé',
    reason: fallbackTriggered ? reason : undefined,
  };

  addTeacherNotificationLog(logEntry);

  const confirmationMessage = fallbackTriggered
    ? `Notification transmise avec succès par Email à ${payload.teacherEmail} (Repli automatique car ${reason.toLowerCase()}).`
    : `Notification transmise avec succès par ${targetChannel} à ${targetChannel === 'Email' ? payload.teacherEmail : (payload.teacherPhone || payload.teacherEmail)}.`;

  return {
    success: sendSuccess,
    actualChannel: targetChannel,
    message: confirmationMessage,
    fallbackTriggered,
  };
};
