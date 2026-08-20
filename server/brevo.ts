/**
 * Brevo (Sendinblue) Transactional Email Service for EDUCO
 * Handles sending real OTP codes, Welcome emails, Password reset emails,
 * Admin alerts, Subscription confirmations, and Teacher reminders.
 */

export interface BrevoRecipient {
  email: string;
  name?: string;
}

export interface BrevoSender {
  name: string;
  email: string;
}

export interface SendBrevoEmailOptions {
  apiKey?: string;
  sender?: BrevoSender;
  to: BrevoRecipient[];
  subject: string;
  templateId?: number | string | null;
  params?: Record<string, any>;
  htmlContent?: string;
  textContent?: string;
  replyTo?: BrevoSender;
  tags?: string[];
}

export interface BrevoEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  status?: number;
  mode?: 'brevo_live' | 'simulation_fallback';
  details?: any;
}

// In-Memory OTP Store with TTL (10 minutes) & rate limiting
export interface OtpRecord {
  code: string;
  email: string;
  purpose: 'school_registration' | 'login_2fa' | 'password_reset' | 'general';
  expiresAt: number; // timestamp in ms
  attempts: number;
  createdAt: number;
  metadata?: Record<string, any>;
}

class OtpManager {
  private store: Map<string, OtpRecord> = new Map();

  /**
   * Generate and store a secure 6-digit OTP for an email
   */
  generateOtp(
    email: string,
    purpose: 'school_registration' | 'login_2fa' | 'password_reset' | 'general' = 'general',
    metadata?: Record<string, any>
  ): string {
    const cleanEmail = email.toLowerCase().trim();
    // 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlMs = 10 * 60 * 1000; // 10 minutes

    this.store.set(cleanEmail, {
      code,
      email: cleanEmail,
      purpose,
      expiresAt: Date.now() + ttlMs,
      attempts: 0,
      createdAt: Date.now(),
      metadata,
    });

    return code;
  }

  /**
   * Verify an OTP code
   */
  verifyOtp(
    email: string,
    code: string,
    purpose?: 'school_registration' | 'login_2fa' | 'password_reset' | 'general'
  ): { valid: boolean; error?: string } {
    const cleanEmail = email.toLowerCase().trim();
    const record = this.store.get(cleanEmail);


    if (!record) {
      return { valid: false, error: "Aucun code OTP actif pour cette adresse email ou code expiré." };
    }

    if (Date.now() > record.expiresAt) {
      this.store.delete(cleanEmail);
      return { valid: false, error: "Le code OTP a expiré (durée de validité : 10 minutes). Veuillez en demander un nouveau." };
    }

    if (purpose && record.purpose !== purpose) {
      return { valid: false, error: "Code invalide pour cette opération." };
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      this.store.delete(cleanEmail);
      return { valid: false, error: "Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code." };
    }

    if (record.code !== code.trim()) {
      return { valid: false, error: `Code de vérification incorrect (${5 - record.attempts} tentative(s) restante(s)).` };
    }

    // Success -> consume OTP
    this.store.delete(cleanEmail);
    return { valid: true };
  }

  /**
   * Check active OTP record without consuming
   */
  getActiveRecord(email: string): OtpRecord | null {
    const cleanEmail = email.toLowerCase().trim();
    const record = this.store.get(cleanEmail);
    if (!record) return null;
    if (Date.now() > record.expiresAt) {
      this.store.delete(cleanEmail);
      return null;
    }
    return record;
  }
}

export interface DispatchedEmailLogItem {
  id: string;
  messageId: string;
  timestamp: string;
  toEmail: string;
  toName: string;
  subject: string;
  tag: string;
  mode: 'brevo_live' | 'simulation_fallback';
  status: 'Délivré' | 'Transmis' | 'Simulé' | 'Échec' | 'En attente';
  errorDetails?: string;
  templateIdUsed?: number | null;
}

const localDispatchedLogs: DispatchedEmailLogItem[] = [];

export function recordDispatchedEmailLog(item: Omit<DispatchedEmailLogItem, 'id'>): DispatchedEmailLogItem {
  const log: DispatchedEmailLogItem = {
    ...item,
    id: `log_${Date.now()}_${Math.random().toString(36).substring(7)}`,
  };
  localDispatchedLogs.unshift(log);
  if (localDispatchedLogs.length > 100) {
    localDispatchedLogs.pop();
  }
  return log;
}

export async function getBrevoEmailLogs(customApiKey?: string): Promise<{
  success: boolean;
  logs: DispatchedEmailLogItem[];
  liveBrevoEmails?: any[];
  mode: 'brevo_live' | 'local_fallback';
  error?: string;
}> {
  const apiKey = getBrevoApiKey(customApiKey);

  if (!apiKey) {
    return {
      success: true,
      logs: localDispatchedLogs,
      mode: 'local_fallback',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.brevo.com/v3/smtp/emails?limit=30&sort=desc", {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (response.ok) {
      const data: any = await response.json();
      const liveList = data?.transactionalEmails || [];
      
      // Convert live Brevo items to standard format
      const formattedLiveItems: DispatchedEmailLogItem[] = liveList.map((item: any) => ({
        id: item.uuid || `brevo_${item.messageId}`,
        messageId: item.messageId || item.uuid || 'N/A',
        timestamp: item.date || new Date().toISOString(),
        toEmail: item.email || 'Destinataire',
        toName: item.email?.split('@')[0] || 'Inconnu',
        subject: item.subject || 'E-mail Transactionnel Brevo',
        tag: item.tags?.[0] || 'Brevo API',
        mode: 'brevo_live',
        status: item.status === 'delivered' ? 'Délivré' : item.status === 'opened' ? 'Délivré' : item.status === 'sent' ? 'Transmis' : 'Transmis',
        templateIdUsed: item.templateId || null,
      }));

      // Combine live items with local dispatched logs avoiding duplicates
      const mergedLogs = [...formattedLiveItems];
      localDispatchedLogs.forEach(localLog => {
        if (!mergedLogs.some(m => m.messageId === localLog.messageId)) {
          mergedLogs.push(localLog);
        }
      });

      mergedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return {
        success: true,
        logs: mergedLogs,
        liveBrevoEmails: liveList,
        mode: 'brevo_live',
      };
    }
  } catch (err: any) {
    console.warn("[BREVO LOGS API WARNING]: Could not fetch live logs from Brevo API", err?.message);
  }

  return {
    success: true,
    logs: localDispatchedLogs,
    mode: 'local_fallback',
  };
}

export async function getBrevoSenders(customApiKey?: string): Promise<{
  success: boolean;
  configuredSenderEmail: string;
  isVerified: boolean;
  senders: Array<{ id: number; name: string; email: string; active: boolean }>;
  error?: string;
}> {
  const apiKey = getBrevoApiKey(customApiKey);
  const currentSender = getBrevoSender();

  if (!apiKey) {
    return {
      success: false,
      configuredSenderEmail: currentSender.email,
      isVerified: false,
      senders: [],
      error: "Clé API Brevo non configurée. Impossible de vérifier les expécuteurs.",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.brevo.com/v3/senders", {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const data: any = await response.json();

    if (!response.ok) {
      return {
        success: false,
        configuredSenderEmail: currentSender.email,
        isVerified: false,
        senders: [],
        error: data?.message || `Erreur API Brevo (${response.status})`,
      };
    }

    const sendersList = data?.senders || [];
    const targetEmail = currentSender.email.toLowerCase().trim();
    
    const matchingSender = sendersList.find((s: any) => s.email?.toLowerCase().trim() === targetEmail);
    const isVerified = Boolean(matchingSender && matchingSender.active !== false);

    return {
      success: true,
      configuredSenderEmail: currentSender.email,
      isVerified,
      senders: sendersList.map((s: any) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        active: s.active ?? true,
      })),
    };
  } catch (err: any) {
    return {
      success: false,
      configuredSenderEmail: currentSender.email,
      isVerified: false,
      senders: [],
      error: err.message || "Erreur de connexion lors de la récupération des expéditeurs.",
    };
  }
}

export async function checkBrevoApiKey(customApiKey?: string): Promise<{
  success: boolean;
  apiKeyConfigured: boolean;
  apiKeyValid: boolean;
  accountEmail?: string;
  companyName?: string;
  error?: string;
}> {
  const apiKey = getBrevoApiKey(customApiKey);

  if (!apiKey) {
    return {
      success: false,
      apiKeyConfigured: false,
      apiKeyValid: false,
      error: "Aucune clé API Brevo n'est configurée dans l'environnement ou les paramètres.",
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("https://api.brevo.com/v3/account", {
      method: "GET",
      headers: {
        "accept": "application/json",
        "api-key": apiKey,
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const data: any = await response.json();

    if (!response.ok) {
      return {
        success: false,
        apiKeyConfigured: true,
        apiKeyValid: false,
        error: data?.message || "La clé API Brevo fournie n'est pas valide.",
      };
    }

    return {
      success: true,
      apiKeyConfigured: true,
      apiKeyValid: true,
      accountEmail: data?.email,
      companyName: data?.companyName,
    };
  } catch (err: any) {
    return {
      success: false,
      apiKeyConfigured: true,
      apiKeyValid: false,
      error: err.message || "Impossible de contacter l'API Brevo.",
    };
  }
}

export const otpManager = new OtpManager();

/**
 * Get effective Brevo API key from env or settings
 */
export function getBrevoApiKey(customKey?: string): string {
  if (customKey && customKey.trim().length > 10) return customKey.trim();
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim().length > 10) {
    return process.env.BREVO_API_KEY.trim();
  }
  return "";
}

/**
 * Helper to clean and validate email addresses
 * Extracts pure email from strings like "EDUCO <contacts@loukatech.com>" or "<contacts@loukatech.com>"
 */
export function extractValidEmail(input: any): string | null {
  if (!input || typeof input !== 'string') return null;
  let str = input.trim();
  
  // Extract content inside angle brackets <...> if formatted as "Name <email@domain.com>"
  const matchBracket = str.match(/<([^>]+)>/);
  if (matchBracket && matchBracket[1]) {
    str = matchBracket[1].trim();
  }
  
  // Remove surrounding single or double quotes
  str = str.replace(/^["']|["']$/g, '').trim();
  
  // Standard email validation regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (emailRegex.test(str)) {
    return str.toLowerCase();
  }
  return null;
}

/**
 * Get default Brevo Sender Email & Name
 */
export function getBrevoSender(customSender?: BrevoSender): BrevoSender {
  const defaultFallbackEmail = "contacts@loukatech.com";
  let name = process.env.EMAIL_FROM_NAME || process.env.BREVO_SENDER_NAME || "EDUCO";

  // Check custom sender if provided
  if (customSender?.email) {
    const validCustomEmail = extractValidEmail(customSender.email);
    if (validCustomEmail) {
      return {
        name: customSender.name?.trim() || name,
        email: validCustomEmail
      };
    }
  }

  // Check process.env.EMAIL_FROM or process.env.BREVO_SENDER_EMAIL
  const rawFrom = process.env.EMAIL_FROM || process.env.BREVO_SENDER_EMAIL || defaultFallbackEmail;
  
  // Try extracting name if format is "EDUCO <contacts@loukatech.com>"
  const match = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    name = match[1].trim() || name;
  }

  const validEnvEmail = extractValidEmail(rawFrom);
  const email = validEnvEmail || defaultFallbackEmail;

  return { name, email };
}

/**
 * Primary function to send a transactional email via Brevo REST API v3
 * Endpoint: POST https://api.brevo.com/v3/smtp/email
 */
export async function sendBrevoEmail(options: SendBrevoEmailOptions): Promise<BrevoEmailResult> {
  const apiKey = getBrevoApiKey(options.apiKey);
  const sender = getBrevoSender(options.sender);

  // Guarantee clean and valid sender email
  const cleanSenderEmail = extractValidEmail(sender.email) || "contacts@loukatech.com";
  const cleanSenderName = sender.name?.trim() || "EDUCO";

  // Guarantee clean and valid recipients
  const sanitizedTo = (options.to || [])
    .map(r => ({
      email: extractValidEmail(r.email) || r.email?.trim() || '',
      name: r.name?.trim() || r.email?.split('@')[0] || 'Destinataire',
    }))
    .filter(r => r.email && r.email.includes('@'));

  if (sanitizedTo.length === 0) {
    return {
      success: false,
      error: "Aucune adresse e-mail destinataire valide fournie pour l'envoi Brevo.",
      status: 400,
    };
  }

  // Do not pretend to send transactional email without a real Brevo key.
  if (!apiKey) {
    return {
      success: false,
      error: "BREVO_API_KEY est requis pour envoyer un e-mail transactionnel réel.",
      status: 503,
    };
  }

  const endpoint = process.env.BREVO_API_URL || "https://api.brevo.com/v3/smtp/email";
  const timeoutMs = parseInt(process.env.EMAIL_TIMEOUT_MS || "30000", 10);

  const requestBody: any = {
    sender: {
      name: cleanSenderName,
      email: cleanSenderEmail,
    },
    to: sanitizedTo,
    subject: options.subject,
  };

  const templateIdValue = typeof options.templateId === 'string' ? options.templateId.trim() : options.templateId;
  const templateIdNum = templateIdValue ? Number(templateIdValue) : NaN;
  if (!isNaN(templateIdNum) && templateIdNum > 0) {
    requestBody.templateId = templateIdNum;
    if (options.params) {
      requestBody.params = options.params;
    }
  } else {
    requestBody.htmlContent = options.htmlContent || generateBaseHtml(options.subject, options.params?.message || options.subject);
    if (options.params) {
      requestBody.params = options.params;
    }
  }

  if (options.replyTo) {
    requestBody.replyTo = options.replyTo;
  }
  if (options.tags && options.tags.length > 0) {
    requestBody.tags = options.tags;
  }

  try {
    console.log(
      `[BREVO SEND] endpoint=${endpoint} sender=${cleanSenderEmail} to=${sanitizedTo.map(r => r.email).join(',')} mode=${requestBody.templateId ? `template:${requestBody.templateId}` : 'htmlContent'} apiKey=${apiKey ? 'present' : 'missing'}`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data?.message || data?.error || `Erreur Brevo ${response.status}`;
      console.warn(`[BREVO API NOTICE] (${response.status}): ${errMsg}`, data);
      
      recordDispatchedEmailLog({
        messageId: `failed_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        timestamp: new Date().toISOString(),
        toEmail: options.to[0]?.email || 'Inconnu',
        toName: options.to[0]?.name || options.to[0]?.email?.split('@')[0] || 'Destinataire',
        subject: options.subject,
        tag: options.tags?.[0] || 'Brevo',
        mode: 'brevo_live',
        status: 'Échec',
        errorDetails: errMsg,
        templateIdUsed: options.templateId ? Number(options.templateId) : null,
      });

      return {
        success: false,
        mode: 'brevo_live',
        status: response.status,
        error: errMsg,
        details: data,
      };
    }

    const msgId = data?.messageId || `msg_${Date.now()}`;
    console.log(`✅ [BREVO SENT] Message "${options.subject}" dispatched to ${options.to.map(t => t.email).join(', ')}. MessageId: ${msgId}`);

    recordDispatchedEmailLog({
      messageId: msgId,
      timestamp: new Date().toISOString(),
      toEmail: options.to[0]?.email || 'Inconnu',
      toName: options.to[0]?.name || options.to[0]?.email?.split('@')[0] || 'Destinataire',
      subject: options.subject,
      tag: options.tags?.[0] || 'Brevo Live',
      mode: 'brevo_live',
      status: 'Transmis',
      templateIdUsed: options.templateId ? Number(options.templateId) : null,
    });

    return {
      success: true,
      mode: 'brevo_live',
      messageId: msgId,
      details: data,
    };
  } catch (error: any) {
    console.warn("[BREVO NETWORK NOTICE]:", error?.message || error);
    const netFallbackId = `netfallback_${Date.now()}`;
    recordDispatchedEmailLog({
      messageId: netFallbackId,
      timestamp: new Date().toISOString(),
      toEmail: options.to[0]?.email || 'Inconnu',
      toName: options.to[0]?.name || 'Destinataire',
      subject: options.subject,
      tag: options.tags?.[0] || 'Brevo',
      mode: 'brevo_live',
      status: 'Échec',
      errorDetails: error.message || "Erreur de connexion réseau",
      templateIdUsed: options.templateId ? Number(options.templateId) : null,
    });

    return {
      success: false,
      mode: 'brevo_live',
      messageId: netFallbackId,
      error: error.message || "Erreur de connexion réseau Brevo.",
    };
  }
}

// =========================================================================
// HIGH-LEVEL TRANSACTIONAL EMAIL HELPERS
// =========================================================================

/**
 * 1. Send OTP Verification Email
 */
export async function sendOtpEmail(params: {
  email: string;
  name?: string;
  otpCode: string;
  purpose?: 'school_registration' | 'login_2fa' | 'password_reset' | 'general';
  templateId?: number | string | null;
  customApiKey?: string;
}): Promise<BrevoEmailResult> {
  const { email, name, otpCode, purpose = 'school_registration', templateId, customApiKey } = params;
  
  let purposeTitle = "Vérification de sécurité";
  let purposeDesc = "Pour finaliser votre inscription et valider votre établissement, veuillez renseigner le code à 6 chiffres ci-dessous.";
  
  if (purpose === 'password_reset') {
    purposeTitle = "Réinitialisation de votre mot de passe";
    purposeDesc = "Vous avez demandé la réinitialisation de votre mot de passe EDUCO. Utilisez ce code de sécurité à 6 chiffres pour choisir un nouveau mot de passe.";
  } else if (purpose === 'login_2fa') {
    purposeTitle = "Connexion sécurisée en deux étapes (2FA)";
    purposeDesc = "Une tentative de connexion a été initiée. Renseignez ce code OTP pour vous identifier.";
  }

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${purposeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1F4A59; padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">
                EDUCO
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #bae6fd; font-weight: 500;">
                Système Intégré de Gestion Scolaire & Universitaire
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #0f172a; text-align: center;">
                ${purposeTitle}
              </h2>
              
              <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #475569; text-align: center;">
                Bonjour <strong>${name || 'Cher utilisateur'}</strong>,<br>
                ${purposeDesc}
              </p>

              <!-- OTP Code Display Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #1F4A59; border-radius: 14px; padding: 18px 36px; text-align: center;">
                      <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #1F4A59; margin-left: 12px;">
                        ${otpCode}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 10px; padding: 14px 18px; margin: 20px 0 10px 0; text-align: center;">
                <p style="margin: 0; font-size: 13px; font-weight: 600; color: #92400e;">
                  ⏳ Ce code est strictement confidentiel et expire dans <strong>10 minutes</strong>.
                </p>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 12px; line-height: 1.5; color: #94a3b8; text-align: center;">
                Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail en toute sécurité.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500;">
                © ${new Date().getFullYear()} EDUCO. Tous droits réservés.
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                Message automatique envoyé via Brevo Transactional Email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendBrevoEmail({
    apiKey: customApiKey,
    to: [{ email, name }],
    subject: `Votre code de vérification EDUCO : ${otpCode}`,
    templateId: templateId || process.env.BREVO_TEMPLATE_OTP_ID || process.env.BREVO_OTP_TEMPLATE_ID || null,
    params: {
      otpCode,
      userName: name || email.split('@')[0],
      purpose,
      purposeTitle,
      expireMinutes: 10,
    },
    htmlContent: html,
    tags: ['otp', 'auth', purpose],
  });
}

/**
 * 2. Send Welcome Email (Promoter, School, Teacher, Parent)
 */
export async function sendWelcomeEmail(params: {
  email: string;
  name?: string;
  role: string;
  schoolName: string;
  schoolIdentifier: string;
  tempPassword?: string;
  loginUrl?: string;
  templateId?: number | string | null;
  customApiKey?: string;
}): Promise<BrevoEmailResult> {
  const {
    email,
    name,
    role,
    schoolName,
    schoolIdentifier,
    tempPassword,
    loginUrl = "https://educo-app.school/login",
    templateId,
    customApiKey,
  } = params;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenue sur EDUCO</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #1F4A59; padding: 36px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff;">
                🎉 Bienvenue sur EDUCO
              </h1>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #bae6fd;">
                Plateforme de Gestion Scolaire Nouvelle Génération
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 36px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #1e293b; line-height: 1.6;">
                Bonjour <strong>${name || 'Cher(e) utilisateur'}</strong>,
              </p>
              
              <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;">
                Votre compte <strong>${role}</strong> pour l'établissement <strong>${schoolName}</strong> a été créé et activé avec succès.
              </p>

              <!-- Credentials Card -->
              <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
                <h3 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 700; color: #1F4A59; text-transform: uppercase; letter-spacing: 0.5px;">
                  📋 Vos Informations de Connexion
                </h3>
                
                <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 13px; color: #334155;">
                  <tr>
                    <td style="font-weight: 600; width: 40%;">Établissement :</td>
                    <td style="font-weight: 700; color: #0f172a;">${schoolName}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">N° Matricule Établissement :</td>
                    <td style="font-weight: 700; color: #0284c7; font-family: monospace; font-size: 14px;">${schoolIdentifier}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Identifiant E-mail :</td>
                    <td style="font-weight: 700; color: #0f172a;">${email}</td>
                  </tr>
                  <tr>
                    <td style="font-weight: 600;">Rôle assigné :</td>
                    <td style="font-weight: 700; color: #059669;">${role}</td>
                  </tr>
                  ${tempPassword ? `
                  <tr>
                    <td style="font-weight: 600;">Mot de passe temporaire :</td>
                    <td style="font-weight: 700; color: #e11d48; font-family: monospace;">${tempPassword}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>

              <!-- Action Button -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 30px 0 20px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; background-color: #1F4A59; color: #ffffff; font-size: 14px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(31, 74, 89, 0.25);">
                      Accéder à mon espace EDUCO →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                Conservez précieusement le N° Matricule unique de votre établissement (<strong>${schoolIdentifier}</strong>) : il sera demandé aux parents d'élèves pour la création de leur compte et la consultation des notes et paiements.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                © ${new Date().getFullYear()} EDUCO - Système Intégré de Gestion Scolaire.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendBrevoEmail({
    apiKey: customApiKey,
    to: [{ email, name }],
    subject: `Bienvenue sur EDUCO - Accès pour ${schoolName}`,
    templateId: templateId || process.env.BREVO_TEMPLATE_WELCOME_ID || process.env.BREVO_WELCOME_TEMPLATE_ID || null,
    params: {
      userName: name || email.split('@')[0],
      role,
      schoolName,
      schoolIdentifier,
      loginUrl,
      tempPassword: tempPassword || '',
    },
    htmlContent: html,
    tags: ['welcome', 'onboarding'],
  });
}

/**
 * 3. Send Password Reset Email
 */
export async function sendPasswordResetEmail(params: {
  email: string;
  name?: string;
  resetCode: string;
  resetUrl?: string;
  templateId?: number | string | null;
  customApiKey?: string;
}): Promise<BrevoEmailResult> {
  const { email, name, resetCode, resetUrl, templateId, customApiKey } = params;

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Réinitialisation de votre mot de passe EDUCO</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.08); border: 1px solid #e2e8f0;">
          
          <tr>
            <td style="background-color: #1F4A59; padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">
                🔐 Réinitialisation de Mot de Passe
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155; line-height: 1.6;">
                Bonjour <strong>${name || 'Utilisateur'}</strong>,<br>
                Nous avons reçu une demande de réinitialisation du mot de passe pour votre compte <strong>${email}</strong>.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td align="center">
                    <div style="display: inline-block; background-color: #f8fafc; border: 2px dashed #1F4A59; border-radius: 14px; padding: 18px 36px;">
                      <span style="font-family: monospace; font-size: 34px; font-weight: 900; letter-spacing: 10px; color: #1F4A59; margin-left: 10px;">
                        ${resetCode}
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              ${resetUrl ? `
              <div style="text-align: center; margin: 20px 0;">
                <a href="${resetUrl}" style="display: inline-block; background-color: #1F4A59; color: #ffffff; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; text-decoration: none;">
                  Réinitialiser directement en ligne
                </a>
              </div>
              ` : ''}

              <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 10px; padding: 14px; text-align: center; margin: 20px 0 10px 0;">
                <p style="margin: 0; font-size: 12px; color: #991b1b; font-weight: 600;">
                  ⚠️ Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer ce message. Votre mot de passe restera inchangé.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #f8fafc; padding: 18px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                © ${new Date().getFullYear()} EDUCO. Sécurité & Authentification.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendBrevoEmail({
    apiKey: customApiKey,
    to: [{ email, name }],
    subject: `Réinitialisation de votre mot de passe EDUCO (Code : ${resetCode})`,
    templateId: templateId || process.env.BREVO_TEMPLATE_RESET_ID || process.env.BREVO_RESET_TEMPLATE_ID || null,
    params: {
      userName: name || email.split('@')[0],
      otpCode: resetCode,
      resetCode,
      resetUrl: resetUrl || '',
    },
    htmlContent: html,
    tags: ['password-reset', 'security'],
  });
}

/**
 * 4. Alert Super Admins on new School Registration
 */
export async function sendAdminSchoolAlertEmail(params: {
  adminEmails: string[];
  schoolName: string;
  schoolIdentifier: string;
  promoterName: string;
  promoterPhone?: string;
  promoterEmail?: string;
  customApiKey?: string;
}): Promise<BrevoEmailResult> {
  const {
    adminEmails,
    schoolName,
    schoolIdentifier,
    promoterName,
    promoterPhone,
    promoterEmail,
    customApiKey,
  } = params;

  if (!adminEmails || adminEmails.length === 0) {
    return { success: false, error: "Aucun administrateur destinataire configuré.", status: 400 };
  }

  const recipients = adminEmails.map(e => ({ email: e, name: 'Administrateur EDUCO' }));

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Nouvelle Inscription d'Établissement</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="background-color: #0f172a; padding: 28px 30px; text-align: center;">
              <h2 style="margin: 0; color: #ffffff; font-size: 20px;">
                🏛️ Nouvel Établissement Enregistré
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
                Un nouvel établissement scolaire vient de finaliser son inscription sur EDUCO :
              </p>
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px; margin: 16px 0;">
                <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #0f172a;">${schoolName}</p>
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;"><strong>N° Matricule :</strong> ${schoolIdentifier}</p>
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;"><strong>Promoteur :</strong> ${promoterName}</p>
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;"><strong>Contact :</strong> ${promoterPhone || 'N/A'}</p>
                <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Email :</strong> ${promoterEmail || 'N/A'}</p>
              </div>
              <p style="margin: 0; font-size: 13px; color: #64748b;">
                Vous pouvez valider les pièces justificatives et attribuer une licence depuis le panneau d'administration.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return sendBrevoEmail({
    apiKey: customApiKey,
    to: recipients,
    subject: `[ADMIN ALERT] Nouvelle Inscription : ${schoolName} (${schoolIdentifier})`,
    params: {
      schoolName,
      schoolIdentifier,
      promoterName,
      promoterPhone: promoterPhone || '',
      promoterEmail: promoterEmail || '',
    },
    htmlContent: html,
    tags: ['admin-alert', 'registration'],
  });
}

/**
 * 5. Send Subscription Activation Confirmation Email
 */
export async function sendSubscriptionConfirmationEmail(params: {
  email: string;
  name?: string;
  schoolName: string;
  planType: string;
  months: number;
  code: string;
  endDate: string;
  customApiKey?: string;
}): Promise<BrevoEmailResult> {
  const { email, name, schoolName, planType, months, code, endDate, customApiKey } = params;

  const planLabel = planType === 'ai_premium' ? 'Licence IA Premium (20 000 FCFA/mois)' : 'Licence Standard (10 000 FCFA/mois)';

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Confirmation Licence EDUCO</title></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:sans-serif;">
  <table width="100%" style="padding:30px 15px;"><tr><td align="center">
    <table width="100%" style="max-width:580px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background-color:#059669;padding:28px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:22px;">✅ Licence Activée avec Succès</h2>
      </td></tr>
      <tr><td style="padding:30px;">
        <p style="font-size:14px;color:#334155;">Bonjour <strong>${name || 'Promoteur'}</strong>,</p>
        <p style="font-size:14px;color:#334155;">Votre abonnement pour <strong>${schoolName}</strong> a été validé et activé.</p>
        <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:18px;margin:20px 0;">
          <p style="margin:0 0 6px 0;font-size:13px;"><strong>Formule :</strong> ${planLabel}</p>
          <p style="margin:0 0 6px 0;font-size:13px;"><strong>Durée :</strong> ${months} mois</p>
          <p style="margin:0 0 6px 0;font-size:13px;"><strong>Code d'activation :</strong> <span style="font-family:monospace;font-weight:bold;">${code}</span></p>
          <p style="margin:0;font-size:13px;"><strong>Date d'échéance :</strong> ${endDate}</p>
        </div>
        <p style="font-size:13px;color:#64748b;">Tous vos modules sont à présent déverrouillés.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>
  `;

  return sendBrevoEmail({
    apiKey: customApiKey,
    to: [{ email, name }],
    subject: `Confirmation d'activation de licence EDUCO - ${schoolName}`,
    params: {
      schoolName,
      planType,
      months,
      code,
      endDate,
    },
    htmlContent: html,
    tags: ['subscription', 'activation'],
  });
}

export interface SendBrevoSmsOptions {
  apiKey?: string;
  sender?: string;
  recipient: string;
  content: string;
  tag?: string;
}

export interface BrevoSmsResult {
  success: boolean;
  messageId?: string;
  smsCount?: number;
  mode?: 'brevo_live' | 'simulation_fallback';
  error?: string;
}

export async function sendBrevoSms(options: SendBrevoSmsOptions): Promise<BrevoSmsResult> {
  const apiKey = getBrevoApiKey(options.apiKey);
  const cleanRecipient = options.recipient ? options.recipient.replace(/[^\d+]/g, '') : '';
  const sender = (options.sender || 'EDUCO').substring(0, 11);

  if (!cleanRecipient || cleanRecipient.length < 8) {
    return {
      success: false,
      error: `Numéro de téléphone invalide : ${options.recipient}`
    };
  }

  if (!apiKey) {
    return {
      success: false,
      error: "BREVO_API_KEY est requis pour envoyer un SMS transactionnel réel."
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch("https://api.brevo.com/v3/transactionalSMS/send", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey
      },
      body: JSON.stringify({
        type: "transactional",
        sender,
        recipient: cleanRecipient,
        content: options.content,
        tag: options.tag || "EDUCO Bulk SMS"
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    const data: any = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg = data?.message || data?.error || `Erreur Brevo SMS (${response.status})`;
      console.warn(`[BREVO SMS NOTICE]: ${errMsg}`);
      return {
        success: false,
        error: errMsg
      };
    }

    return {
      success: true,
      messageId: data?.reference || data?.messageId || `sms_${Date.now()}`,
      smsCount: data?.smsCount || 1,
      mode: 'brevo_live'
    };
  } catch (err: any) {
    console.warn(`[BREVO SMS ERROR]:`, err?.message);
    return {
      success: false,
      error: err?.message
    };
  }
}

export interface BulkRecipientItem {
  id?: string | number;
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
  schoolName?: string;
}

export interface SendBulkBrevoOptions {
  apiKey?: string;
  channel: 'email' | 'sms' | 'whatsapp';
  recipients: BulkRecipientItem[];
  subject: string;
  messageTemplate: string;
  schoolName: string;
  senderName?: string;
  senderEmail?: string;
}

export async function sendBulkBrevoCampaign(options: SendBulkBrevoOptions): Promise<{
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    recipientName: string;
    target: string;
    success: boolean;
    channel: string;
    mode?: string;
    messageId?: string;
    error?: string;
    whatsappUrl?: string;
  }>;
}> {
  const { channel, recipients, subject, messageTemplate, schoolName, apiKey, senderName, senderEmail } = options;
  const results: any[] = [];
  let successful = 0;
  let failed = 0;

  for (const item of recipients) {
    const studentName = item.studentName || item.name;
    const parentName = item.parentName || item.name;
    const className = item.className || 'Non spécifiée';
    const balanceStr = (item.balance || 0).toLocaleString('fr-FR');
    const currencyStr = 'FCFA';

    // Replace dynamic variables
    let personalizedMessage = messageTemplate
      .replace(/{nom_eleve}|{eleve}|{nom}/gi, studentName)
      .replace(/{classe}|{classe_eleve}/gi, className)
      .replace(/{nom_parent}|{parent}/gi, parentName)
      .replace(/{reste_a_payer}|{solde}|{montant_du}|{impayes}/gi, `${balanceStr} ${currencyStr}`)
      .replace(/{etablissement}|{ecole}|{school}/gi, schoolName);

    if (channel === 'email') {
      const targetEmail = extractValidEmail(item.parentEmail || item.email);
      if (!targetEmail) {
        results.push({
          recipientName: studentName,
          target: item.parentEmail || item.email || 'Aucun e-mail',
          success: false,
          channel: 'email',
          error: 'Adresse email manquante ou invalide'
        });
        failed++;
        continue;
      }

      const emailHtml = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; padding: 24px 12px; margin: 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1F4A59 0%, #15343f 100%); padding: 30px 24px; text-align: center; color: #ffffff;">
              <h1 style="margin: 0 0 6px 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">${schoolName}</h1>
              <p style="margin: 0; font-size: 13px; opacity: 0.9;">Communication Administrative & Pédagogique</p>
            </td>
          </tr>
          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <p style="font-size: 15px; color: #1e293b; margin-top: 0; font-weight: 600;">
                Bonjour ${parentName ? `M./Mme <strong>${parentName}</strong>` : 'Madame, Monsieur'},
              </p>
              
              <!-- Recipient Metadata Box -->
              <div style="background-color: #f8fafc; border-left: 4px solid #1F4A59; border-radius: 8px; padding: 14px 18px; margin: 20px 0;">
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">
                  <strong>Élève concerné(e) :</strong> <span style="color: #0f172a; font-weight: bold;">${studentName}</span>
                </p>
                <p style="margin: 0 0 6px 0; font-size: 13px; color: #475569;">
                  <strong>Classe :</strong> <span style="color: #0f172a;">${className}</span>
                </p>
                ${(item.balance && item.balance > 0) ? `
                <p style="margin: 0; font-size: 13px; color: #dc2626;">
                  <strong>Solde restant dû :</strong> <span style="font-weight: bold; font-size: 14px;">${balanceStr} ${currencyStr}</span>
                </p>
                ` : ''}
              </div>

              <!-- Message Body -->
              <div style="font-size: 14px; color: #334155; line-height: 1.6; white-space: pre-line; margin-bottom: 24px;">
                ${personalizedMessage}
              </div>

              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 14px; text-align: center; margin-top: 24px;">
                <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">
                  Pour toute information complémentaire, merci de contacter le secrétariat ou le service financier de l'établissement.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                Message généré via le portail <strong>EDUCO</strong> pour <strong>${schoolName}</strong>
              </p>
              <p style="margin: 4px 0 0 0; font-size: 11px; color: #94a3b8;">
                Service de messagerie automatisée sécurisée Brevo API v3
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      try {
        const sendRes = await sendBrevoEmail({
          apiKey,
          sender: senderEmail ? { email: senderEmail, name: senderName || schoolName } : undefined,
          to: [{ email: targetEmail, name: parentName || studentName }],
          subject,
          htmlContent: emailHtml,
          tags: ['bulk-broadcast', 'admin-messaging', (item.balance && item.balance > 0) ? 'unpaid-fees-reminder' : 'general-notice']
        });

        results.push({
          recipientName: `${studentName} (${parentName || targetEmail})`,
          target: targetEmail,
          success: sendRes.success,
          channel: 'email',
          mode: sendRes.mode,
          messageId: sendRes.messageId,
          error: sendRes.error
        });

        if (sendRes.success) successful++;
        else failed++;
      } catch (err: any) {
        results.push({
          recipientName: studentName,
          target: targetEmail,
          success: false,
          channel: 'email',
          error: err?.message || 'Erreur lors de l\'envoi Brevo'
        });
        failed++;
      }
    } else if (channel === 'sms') {
      const rawPhone = item.parentPhone || item.phone;
      if (!rawPhone) {
        results.push({
          recipientName: studentName,
          target: 'Aucun numéro',
          success: false,
          channel: 'sms',
          error: 'Numéro de téléphone manquant'
        });
        failed++;
        continue;
      }

      const smsText = `[${schoolName}] ${personalizedMessage}`;
      const smsRes = await sendBrevoSms({
        apiKey,
        sender: senderName || 'EDUCO',
        recipient: rawPhone,
        content: smsText,
        tag: (item.balance && item.balance > 0) ? 'relance-frais' : 'communication-ecole'
      });

      results.push({
        recipientName: `${studentName} (${parentName || rawPhone})`,
        target: rawPhone,
        success: smsRes.success,
        channel: 'sms',
        mode: smsRes.mode,
        messageId: smsRes.messageId,
        error: smsRes.error
      });

      if (smsRes.success) successful++;
      else failed++;
    } else if (channel === 'whatsapp') {
      const rawPhone = item.parentPhone || item.phone;
      const cleanPhone = rawPhone ? rawPhone.replace(/[^\d]/g, '') : '';
      const whatsappMsg = `*${schoolName}*\n\n${personalizedMessage}`;
      const whatsappUrl = cleanPhone 
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`;

      results.push({
        recipientName: `${studentName} (${parentName || rawPhone || 'Contact'})`,
        target: rawPhone || 'WhatsApp Direct',
        success: true,
        channel: 'whatsapp',
        mode: 'whatsapp_direct_link',
        whatsappUrl
      });
      successful++;
    }
  }

  return {
    success: true,
    total: recipients.length,
    successful,
    failed,
    results
  };
}

function generateBaseHtml(title: string, message: string): string {
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family: sans-serif; background-color: #f8fafc; padding: 24px;">
  <div style="max-width: 560px; margin: 0 auto; background: white; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
    <h2 style="color: #1F4A59; margin-top: 0;">${title}</h2>
    <div style="color: #334155; line-height: 1.6; font-size: 14px;">${message}</div>
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="color: #94a3b8; font-size: 12px; margin: 0;">EDUCO - Gestion Scolaire Intelligente</p>
  </div>
</body>
</html>
  `;
}


