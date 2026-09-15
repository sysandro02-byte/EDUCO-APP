import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { createWebAuthnRouter } from '../server/webauthn.ts';

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth/webauthn', createWebAuthnRouter());
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server failed to start');
  try { await run(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve())); }
}

test('passkey registration and device management reject unauthenticated callers', async () => {
  await withServer(async baseUrl => {
    const cases: Array<[string, string, unknown?]> = [
      ['POST', '/api/auth/webauthn/register/options', { email: 'victim@example.com' }],
      ['POST', '/api/auth/webauthn/register/verify', { email: 'victim@example.com', registrationResponse: {} }],
      ['GET', '/api/auth/webauthn/devices?email=victim@example.com'],
      ['PATCH', '/api/auth/webauthn/devices/credential-id', { deviceName: 'renamed' }],
      ['DELETE', '/api/auth/webauthn/devices/credential-id'],
    ];
    for (const [method, path, body] of cases) {
      const response = await fetch(`${baseUrl}${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      assert.equal(response.status, 401, `${method} ${path} must require authentication`);
    }
  });
});
