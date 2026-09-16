import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const form = fs.readFileSync(new URL('../components/UserForm.tsx', import.meta.url), 'utf8');
const login = fs.readFileSync(new URL('../components/LoginPage.tsx', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_enforce_unique_user_phone.sql', import.meta.url), 'utf8');

test('primary phone is persisted as users.phone and required by account forms', () => {
  assert.match(schema, /phone: text\('phone'\)/);
  assert.match(form, /name="phone"/);
  assert.match(form, /formErrors\.phone/);
  assert.match(form, /finalData\.phone/);
  assert.match(login, /parentPhone\.replace\(\/\[\^0-9\+\]\//);
});

test('server normalizes and rejects duplicate primary phone identities', () => {
  assert.match(server, /normalizePhoneIdentity/);
  assert.match(server, /phone_normalized/);
  assert.match(server, /Ce numéro de téléphone est déjà associé à un autre compte/);
  assert.match(server, /phone: requestPhone/);
  assert.match(server, /phone: normalizedParentPhone/);
});

test('database enforces one normalized phone per user account', () => {
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique_idx/i);
  assert.match(migration, /GROUP BY phone_normalized[\s\S]*HAVING COUNT\(\*\) > 1/i);
});
