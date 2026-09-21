import crypto from 'node:crypto';
import express, { type Express } from 'express';

const PROVIDER_CODE = 'LOUKAPAY';
const FINAL_EVENT_STATUS: Record<string, string> = {
  'payment.succeeded': 'PAID',
  'payment.failed': 'FAILED',
  'payment.cancelled': 'CANCELLED',
  'payment.refunded': 'REFUNDED',
};

const loukaPayBaseUrl = () => String(process.env.LOUKAPAY_API_URL || 'https://loukapay.onrender.com').replace(/\/$/, '');
const publicAppUrl = () => String(
  process.env.PUBLIC_APP_URL || process.env.APP_URL || 'https://educo.loukatech.com'
).replace(/\/$/, '');

const safeEqualHex = (left: string, right: string) => {
  if (!/^[0-9a-f]+$/i.test(left) || !/^[0-9a-f]+$/i.test(right)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const verifyLoukaPaySignature = (rawBody: Buffer, header: string, secret: string) => {
  const parts = Object.fromEntries(
    String(header || '').split(',').map(part => part.trim().split('=', 2)).filter(pair => pair.length === 2)
  );
  const timestamp = Number(parts.t);
  const supplied = String(parts.v1 || '').toLowerCase();
  if (!Number.isFinite(timestamp) || !supplied) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return false;
  const expected = crypto.createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  return safeEqualHex(supplied, expected);
};

const sha256 = (value: Buffer) => crypto.createHash('sha256').update(value).digest('hex');

async function fetchLoukaPay(path: string, init: RequestInit = {}) {
  const apiKey = String(process.env.LOUKAPAY_EDUCO_API_KEY || '').trim();
  if (!apiKey.startsWith('lp_sk_live_')) throw new Error('LoukaPay EDUCO n’est pas configuré.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetch(`${loukaPayBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { 'content-type': 'application/json' } : {}),
        authorization: `Bearer ${apiKey}`,
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function getLoukaPayReadiness() {
  try {
    const response = await fetchLoukaPay('/v1/providers');
    if (!response.ok) {
      return { ready: false, providers: [], reason: `LoukaPay HTTP ${response.status}` };
    }
    const payload: any = await response.json();
    const providers = Array.isArray(payload?.providers) ? payload.providers : [];
    return {
      ready: payload?.mode === 'live' && payload?.live_allowed === true && payload?.ready === true && providers.length > 0,
      providers,
      reason: payload?.ready ? null : 'Aucun rail Live LoukaPay disponible.',
    };
  } catch (error: any) {
    return { ready: false, providers: [], reason: error?.message || 'LoukaPay indisponible.' };
  }
}

export function registerLoukaPayWebhook(app: Express, getSupabaseAdmin: (req?: any) => any) {
  app.post(
    '/api/webhooks/loukapay',
    express.raw({ type: 'application/json', limit: '256kb' }),
    async (req: any, res: any) => {
      const secret = String(process.env.LOUKAPAY_EDUCO_WEBHOOK_SECRET || '').trim();
      if (!secret.startsWith('whsec_')) return res.status(503).json({ error: 'webhook_not_configured' });
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      if (!verifyLoukaPaySignature(rawBody, String(req.header('x-loukapay-signature') || ''), secret)) {
        return res.status(401).json({ error: 'invalid_webhook_signature' });
      }

      let event: any;
      try { event = JSON.parse(rawBody.toString('utf8')); }
      catch { return res.status(400).json({ error: 'invalid_json' }); }

      const eventId = String(event?.id || '').trim();
      const eventType = String(event?.type || '').trim();
      const payment = event?.data?.payment;
      const targetStatus = FINAL_EVENT_STATUS[eventType];
      if (!eventId || !payment || !targetStatus) {
        return res.status(400).json({ error: 'unsupported_webhook_event' });
      }
      if (String(payment.mode || '').toLowerCase() !== 'live') {
        return res.status(400).json({ error: 'non_live_payment_event' });
      }

      const providerReference = String(payment.id || '').trim();
      const externalReference = String(payment.external_reference || '').trim();
      const amount = Number(payment.amount);
      const currency = String(payment.currency || '').trim().toUpperCase();
      if (!providerReference || !externalReference || !Number.isFinite(amount) || amount <= 0 || !currency) {
        return res.status(400).json({ error: 'invalid_payment_event' });
      }

      const client = getSupabaseAdmin(req);
      if (!client) return res.status(503).json({ error: 'supabase_unavailable' });
      const payloadHash = sha256(rawBody);

      try {
        const { data: eventState, error: eventError } = await client.rpc('record_administrative_payment_webhook', {
          p_event_id: eventId,
          p_provider_code: PROVIDER_CODE,
          p_provider_reference: providerReference,
          p_external_reference: externalReference,
          p_event_type: eventType,
          p_payload_hash: payloadHash,
        });
        if (eventError) throw eventError;
        if (eventState === 'ALREADY_PROCESSED') return res.json({ received: true, replay: true });

        const { data: transaction, error: transactionError } = await client
          .from('administrative_payment_transactions')
          .select('id,internal_reference,provider_reference,amount,currency,status')
          .eq('provider_code', PROVIDER_CODE)
          .eq('internal_reference', externalReference)
          .limit(1)
          .maybeSingle();
        if (transactionError) throw transactionError;
        if (!transaction) throw new Error('Transaction EDUCO introuvable pour cette référence LoukaPay.');
        if (Number(transaction.amount) !== amount || String(transaction.currency).toUpperCase() !== currency) {
          throw new Error('Montant ou devise LoukaPay non conforme à la transaction EDUCO.');
        }
        if (transaction.provider_reference && transaction.provider_reference !== providerReference) {
          throw new Error('Référence LoukaPay incompatible avec la transaction EDUCO.');
        }

        if (!transaction.provider_reference) {
          const { error: bindError } = await client.rpc('bind_administrative_payment_provider_reference', {
            p_transaction_id: transaction.id,
            p_provider_reference: providerReference,
          });
          if (bindError) throw bindError;
        }

        const { error: confirmationError } = await client.rpc('confirm_administrative_payment_provider', {
          p_provider_code: PROVIDER_CODE,
          p_provider_reference: providerReference,
          p_status: targetStatus,
          p_amount: amount,
          p_currency: currency,
          p_payload_hash: payloadHash,
          p_failure_code: targetStatus === 'FAILED' ? String(payment.provider_raw_status || 'LOUKAPAY_FAILED') : null,
          p_failure_message: targetStatus === 'FAILED' ? 'Paiement LoukaPay non abouti.' : null,
        });
        if (confirmationError) throw confirmationError;

        await client.rpc('complete_administrative_payment_webhook', {
          p_event_id: eventId,
          p_error: null,
        });
        return res.json({ received: true });
      } catch (error: any) {
        await client.rpc('complete_administrative_payment_webhook', {
          p_event_id: eventId,
          p_error: String(error?.message || error).slice(0, 1000),
        }).catch(() => undefined);
        console.error('LoukaPay webhook processing failed:', error?.message || error);
        return res.status(409).json({ error: 'webhook_processing_failed' });
      }
    },
  );
}

export function registerAdministrativePaymentRoutes(
  app: Express,
  requireAuth: any,
  getUser: (req: any) => Promise<any>,
  getSupabaseAdmin: (req?: any) => any,
) {
  app.get('/api/administrative-payments/providers', requireAuth, async (req: any, res: any) => {
    const readiness = await getLoukaPayReadiness();
    if (!readiness.ready) return res.json({ providers: [], ready: false, reason: readiness.reason });
    return res.json({
      ready: true,
      providers: [{
        code: PROVIDER_CODE,
        display_name: 'LoukaPay',
        currency: 'XAF',
        rails: readiness.providers,
      }],
    });
  });

  app.post('/api/administrative-payments/:applicationId/initiate', requireAuth, async (req: any, res: any) => {
    const client = getSupabaseAdmin(req);
    if (!client) return res.status(503).json({ error: 'Supabase indisponible.' });

    const user = await getUser(req);
    const applicantUid = String(user?.uid || req.user?.uid || '').trim();
    if (!applicantUid) return res.status(401).json({ error: 'Identité EDUCO introuvable.' });

    const readiness = await getLoukaPayReadiness();
    if (!readiness.ready) {
      return res.status(503).json({ error: readiness.reason || 'Aucun rail LoukaPay Live disponible.' });
    }

    try {
      const applicationId = String(req.params.applicationId || '').trim();
      const { data: application, error: applicationError } = await client
        .from('administrative_applications')
        .select('id,service_code,applicant_uid,applicant_email,status,payment_amount,payment_currency')
        .eq('id', applicationId)
        .eq('applicant_uid', applicantUid)
        .limit(1)
        .maybeSingle();
      if (applicationError) throw applicationError;
      if (!application) return res.status(404).json({ error: 'Dossier administratif introuvable.' });

      const { data: service, error: serviceError } = await client
        .from('administrative_services')
        .select('code,name')
        .eq('code', application.service_code)
        .single();
      if (serviceError) throw serviceError;

      const { data: intentData, error: intentError } = await client.rpc('create_administrative_payment_intent_server', {
        p_application_id: application.id,
        p_provider_code: PROVIDER_CODE,
        p_applicant_uid: applicantUid,
      });
      if (intentError) throw intentError;
      const intent = Array.isArray(intentData) ? intentData[0] : intentData;
      if (!intent?.id || !intent?.internal_reference) throw new Error('Intent EDUCO incomplet.');

      const appUrl = publicAppUrl();
      const loukaPayResponse = await fetchLoukaPay('/v1/payment-intents', {
        method: 'POST',
        headers: { 'Idempotency-Key': intent.internal_reference },
        body: JSON.stringify({
          amount: Number(intent.amount),
          currency: String(intent.currency || 'XAF').toUpperCase(),
          external_reference: intent.internal_reference,
          description: `EDUCO · ${service?.name || application.service_code}`,
          customer_reference: application.id,
          customer_email: application.applicant_email || user?.email || undefined,
          return_url: `${appUrl}/?page=my-administrative-applications&payment=return&application=${encodeURIComponent(application.id)}`,
          cancel_url: `${appUrl}/?page=my-administrative-applications&payment=cancel&application=${encodeURIComponent(application.id)}`,
          metadata: {
            educo_application_id: application.id,
            educo_transaction_id: intent.id,
            educo_service_code: application.service_code,
          },
        }),
      });

      const loukaPay: any = await loukaPayResponse.json().catch(() => ({}));
      if (!loukaPayResponse.ok) {
        console.error('LoukaPay initiation failed:', loukaPayResponse.status, loukaPay?.error);
        return res.status(502).json({ error: 'La passerelle LoukaPay a refusé l’initialisation du paiement.' });
      }
      const providerReference = String(loukaPay?.id || '').trim();
      const checkoutUrl = String(loukaPay?.checkout_url || '').trim();
      if (!providerReference || !/^https:\/\//i.test(checkoutUrl)) {
        return res.status(502).json({ error: 'Réponse LoukaPay incomplète.' });
      }

      if (intent.provider_reference && intent.provider_reference !== providerReference) {
        return res.status(409).json({ error: 'Une autre référence fournisseur est déjà liée à ce paiement.' });
      }
      if (!intent.provider_reference) {
        const { error: bindError } = await client.rpc('bind_administrative_payment_provider_reference', {
          p_transaction_id: intent.id,
          p_provider_reference: providerReference,
        });
        if (bindError) throw bindError;
      }

      return res.json({
        transaction_id: intent.id,
        internal_reference: intent.internal_reference,
        provider_reference: providerReference,
        checkout_url: checkoutUrl,
        amount: intent.amount,
        currency: intent.currency,
        rails: readiness.providers,
      });
    } catch (error: any) {
      console.error('Administrative LoukaPay initiation failed:', error?.message || error);
      return res.status(400).json({ error: error?.message || 'Initialisation du paiement impossible.' });
    }
  });
}
