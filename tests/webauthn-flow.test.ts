import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { createWebAuthnRouter } from '../server/webauthn.ts';
import { readApiJson } from '../src/services/webauthnService.ts';

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth/webauthn', createWebAuthnRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address === 'object');

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('login options are JSON and each attempt gets its own challenge id', async () => {
  await withServer(async (baseUrl) => {
    const requestOptions = () => fetch(`${baseUrl}/api/auth/webauthn/login/options`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-host': 'educo-test.vercel.app',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const [firstResponse, secondResponse] = await Promise.all([requestOptions(), requestOptions()]);
    assert.match(firstResponse.headers.get('content-type') || '', /application\/json/);
    const first = await firstResponse.json() as any;
    const second = await secondResponse.json() as any;
    assert.ok(first.options?.challenge);
    assert.ok(first.challengeId);
    assert.ok(second.challengeId);
    assert.notEqual(first.challengeId, second.challengeId);
  });
});

test('API JSON reader reports HTML responses without leaking JSON.parse errors', async () => {
  const response = new Response('<!doctype html><title>Vercel fallback</title>', {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

  await assert.rejects(readApiJson(response), /proxy API a renvoyé une page HTML au lieu de JSON/);
});

test('invalid verification requests still return structured JSON', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/webauthn/login/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const body = await response.json() as any;
    assert.equal(response.status, 400);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    assert.match(body.error, /absente/);
  });
});
