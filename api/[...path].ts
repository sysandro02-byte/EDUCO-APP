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

  const targetUrl = `${backendUrl}${req.url || ''}`;
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || ['host', 'content-length', 'connection'].includes(key.toLowerCase())) continue;
    headers.set(key, Array.isArray(value) ? value.join(',') : value);
  }

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
