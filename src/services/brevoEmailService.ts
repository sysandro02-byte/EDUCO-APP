import { getApiUrl } from '../lib/apiConfig';

/**
 * Client-side Brevo Email Service
 * Provides helper functions for invoking Brevo backend endpoints
 */

export interface SendOtpRequest {
  email: string;
  name?: string;
  purpose?: 'school_registration' | 'login_2fa' | 'password_reset' | 'general';
  templateId?: number | string | null;
  customApiKey?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otpCode: string;
  purpose?: 'school_registration' | 'login_2fa' | 'password_reset' | 'general';
}

export interface SendWelcomeRequest {
  email: string;
  name?: string;
  role: string;
  schoolName: string;
  schoolIdentifier: string;
  tempPassword?: string;
  loginUrl?: string;
  templateId?: number | string | null;
  customApiKey?: string;
}

export interface SendPasswordResetRequest {
  email: string;
  name?: string;
  resetUrl?: string;
  templateId?: number | string | null;
  customApiKey?: string;
}

export interface ConfirmPasswordResetRequest {
  email: string;
  otpCode: string;
  newPassword: string;
}

export interface TestBrevoRequest {
  apiKey?: string;
  senderEmail?: string;
  senderName?: string;
  toEmail: string;
  templateId?: number | string | null;
}

async function safeFetchJson(url: string, init?: RequestInit): Promise<any> {
  try {
    const response = await fetch(url, init);
    const contentType = response.headers.get("content-type");
    
    if (!response.ok) {
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Erreur serveur (${response.status})`);
      } else {
        const text = await response.text().catch(() => '');
        const excerpt = text.length > 80 ? `${text.substring(0, 80)}...` : text;
        throw new Error(`Erreur serveur (${response.status}): ${excerpt || 'Service indisponible'}`);
      }
    }

    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    
    const text = await response.text().catch(() => '');
    try {
      return JSON.parse(text);
    } catch {
      return { success: true, message: text || "OK" };
    }
  } catch (err: any) {
    throw err;
  }
}

class BrevoEmailServiceClient {
  /**
   * Request a 6-digit OTP email to be dispatched via Brevo
   */
  async sendOtp(params: SendOtpRequest): Promise<{
    success: boolean;
    message?: string;
    messageId?: string;
    mode?: 'brevo_live' | 'simulation_fallback';
    error?: string;
  }> {
    try {
      const res = await safeFetchJson(getApiUrl('/api/email/send-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (res && (res.success !== false)) {
        return {
          success: true,
          message: res.message || "Code de vérification généré avec succès.",
          mode: res.mode || 'brevo_live',
          messageId: res.messageId || `otp_${Date.now()}`,
        };
      }

      return { 
        success: false, 
        error: res?.error || res?.message || "Impossible d'envoyer le code OTP.",
      };
    } catch (err: any) {
      console.warn("sendOtp failed:", err?.message);
      return { 
        success: false, 
        error: err?.message || "Impossible d'envoyer le code OTP.",
      };
    }
  }

  /**
   * Verify an entered OTP code
   */
  async verifyOtp(params: VerifyOtpRequest): Promise<{
    success: boolean;
    verified?: boolean;
    error?: string;
  }> {

    try {
      const data = await safeFetchJson(getApiUrl('/api/email/verify-otp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (data && data.success) {
        return { success: true, verified: true };
      }
      
      if (data && data.error) {
        return { success: false, verified: false, error: data.error };
      }


      return { success: false, verified: false, error: "Code OTP invalide ou expiré." };
    } catch (err: any) {
      return { success: false, verified: false, error: err.message || "Erreur lors de la validation du code" };
    }
  }

  /**
   * Send a Welcome email with account details via Brevo
   */
  async sendWelcome(params: SendWelcomeRequest): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      return await safeFetchJson(getApiUrl('/api/email/send-welcome'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch (err: any) {
      console.error("sendWelcome error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Send Password Reset OTP email
   */
  async sendPasswordReset(params: SendPasswordResetRequest): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      return await safeFetchJson(getApiUrl('/api/email/send-reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch (err: any) {
      console.error("sendPasswordReset error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Confirm password reset with OTP & new password
   */
  async confirmPasswordReset(params: ConfirmPasswordResetRequest): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    try {
      return await safeFetchJson(getApiUrl('/api/email/confirm-reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch (err: any) {
      console.error("confirmPasswordReset error:", err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Test Brevo API Connection & send test transactional email
   */
  async testBrevoConnection(params: TestBrevoRequest): Promise<{
    success: boolean;
    messageId?: string;
    mode?: string;
    error?: string;
    details?: any;
    keyCheck?: any;
  }> {
    try {
      return await safeFetchJson(getApiUrl('/api/email/test-brevo'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
    } catch (err: any) {
      return { success: false, error: err.message || "Erreur de connexion" };
    }
  }

  /**
   * Fetch transactional email audit logs from Brevo API and server memory
   */
  async getEmailLogs(apiKey?: string): Promise<{
    success: boolean;
    logs: Array<{
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
    }>;
    mode?: 'brevo_live' | 'local_fallback';
    error?: string;
  }> {
    try {
      const url = apiKey ? `/api/email/logs?apiKey=${encodeURIComponent(apiKey)}` : '/api/email/logs';
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (err: any) {
      return { success: false, logs: [], error: err.message || "Impossible de charger les journaux d'email" };
    }
  }

  /**
   * Verify sender email address status in Brevo dashboard
   */
  async getSenders(apiKey?: string): Promise<{
    success: boolean;
    configuredSenderEmail: string;
    isVerified: boolean;
    senders: Array<{ id: number; name: string; email: string; active: boolean }>;
    error?: string;
  }> {
    try {
      const url = apiKey ? `/api/email/senders?apiKey=${encodeURIComponent(apiKey)}` : '/api/email/senders';
      const response = await fetch(url);
      const data = await response.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        configuredSenderEmail: 'contacts@loukatech.com',
        isVerified: false,
        senders: [],
        error: err.message || "Erreur lors de la vérification de l'expéditeur"
      };
    }
  }
}

export const brevoEmailService = new BrevoEmailServiceClient();

