import { askLuna } from './api';

export type LunaRequest = {
  message: string;
  model?: string;
  temperature?: number;
  context?: Record<string, string | number | boolean>;
};

const GROQ_MODEL_ALIAS = 'groq-llama-3';
const GEMINI_MODEL = 'gemini-2.5-flash';

const hasReply = (response: any) => Boolean(response?.success && String(response?.reply || '').trim());

/**
 * Calls Luna with a provider strategy that is safe for Render deployments.
 *
 * EDUCO historically defaulted to Gemini in the browser, which meant a valid
 * GROQ_API_KEY on Render was never used unless every browser had explicitly
 * saved the Groq model locally. We now prefer Groq when no model is stored and
 * transparently retry the other provider when an old browser preference cannot
 * answer because its server-side key is not configured.
 */
export async function askLunaResilient(payload: LunaRequest) {
  const requestedModel = String(payload.model || '').trim();
  const primaryModel = requestedModel || GROQ_MODEL_ALIAS;

  const models = [primaryModel];
  if (primaryModel !== GROQ_MODEL_ALIAS) {
    models.push(GROQ_MODEL_ALIAS);
  } else {
    models.push(GEMINI_MODEL);
  }

  let lastResponse: any = null;
  for (const model of Array.from(new Set(models))) {
    try {
      const response = await askLuna({ ...payload, model });
      lastResponse = response;
      if (hasReply(response)) return response;
    } catch (error: any) {
      lastResponse = { success: false, error: error?.message || 'Connexion au service IA impossible.' };
    }
  }

  return lastResponse || { success: false, error: 'Luna est momentanément indisponible.' };
}

export const DEFAULT_LUNA_MODEL = GROQ_MODEL_ALIAS;
