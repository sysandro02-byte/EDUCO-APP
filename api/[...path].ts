import type { IncomingMessage, ServerResponse } from 'http';

const readBody = async (req: IncomingMessage): Promise<Buffer | undefined> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
};

const getBackendUrl = () => {
  const rawUrl = process.env.BACKEND_URL || process.env.VITE_BACKEND_URL || process.env.VITE_API_URL || '';
  return rawUrl.replace(/\/$/, '');
};

const isBrevoApiUrl = (url: string) => /(^|\.)brevo\.com(\/|$)/i.test(new URL(url).hostname);

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const backendUrl = getBackendUrl();

  if (!backendUrl) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: "Configuration Vercel manquante : BACKEND_URL doit pointer vers le backend Render pour envoyer le code OTP.",
    }));
    return;
  }

  if (!/^https?:\/\//i.test(backendUrl)) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: "Configuration Vercel invalide : BACKEND_URL doit etre une URL HTTP(S) vers le backend Render.",
    }));
    return;
  }

  if (isBrevoApiUrl(backendUrl)) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: "Configuration Vercel invalide : BACKEND_URL ne doit pas pointer vers Brevo. Utilisez l'URL du backend Render.",
    }));
    return;
  }

  const targetUrl = `${backendUrl}${req.url || ''}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || ['host', 'content-length', 'connection'].includes(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(',') : value);
  }

  // Render must validate WebAuthn against the public browser origin, not its
  // own internal host. Preserve Vercel's original host explicitly.
  const publicHost = req.headers['x-forwarded-host'] || req.headers.host;
  if (publicHost) headers.set('x-forwarded-host', Array.isArray(publicHost) ? publicHost[0] : publicHost);
  if (!headers.has('x-forwarded-proto')) headers.set('x-forwarded-proto', 'https');

  try {
    const method = req.method || 'GET';
    const body = ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : await readBody(req);
    const response = await fetch(targetUrl, { method, headers, body });

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const responseBody = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || '';
    const looksLikeHtml = /text\/html/i.test(contentType) || /^\s*</.test(responseBody.toString('utf8'));

    if (looksLikeHtml) {
      res.statusCode = response.ok ? 502 : response.status;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: false,
        error: `Le backend Render a renvoyé une page HTML au lieu de JSON (HTTP ${response.status}).`,
      }));
      return;
    }

    res.end(responseBody);
  } catch (error: any) {
    res.statusCode = 502;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      error: error?.message || "Impossible de joindre le backend Render pour envoyer le code OTP.",
    }));
  }
}
