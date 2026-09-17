import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const webauthn = fs.readFileSync(new URL('../server/webauthn.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_admin_server_only_legacy_tables.sql', import.meta.url), 'utf8');

test('platform registered-schools endpoint is Admin/Co-admin only', () => {
  assert.match(server, /app\.get\('\/api\/admin\/registered-schools'/);
  assert.match(server, /userRole !== 'Admin' && userRole !== 'Co-admin'/);
  assert.match(server, /Accès réservé aux administrateurs/);
});

test('global admin export is only loaded by the Admin/Co-admin application path', () => {
  assert.match(app, /if \(userRole === 'Admin' \|\| userRole === 'Co-admin'\) \{[\s\S]*?fetchAdminExportData\(\)/);
});

test('school deletion prevents a promoter from deleting another establishment', () => {
  assert.match(server, /app\.delete\('\/api\/schools\/:id'/);
  assert.match(server, /dbUser\?\.role === 'Promoteur' && Number\(dbUser\.schoolId\) !== targetSchoolId/);
  assert.match(server, /Vous ne pouvez administrer que votre propre établissement/);
});

test('Admin and Co-admin account boundaries protect platform roles', () => {
  assert.match(server, /canonicalizeRole\(targetUser\.role\) === 'Admin'/);
  assert.match(server, /canonicalizeRole\(targetUser\.role\) === 'Co-admin' && actorRole !== 'Admin'/);
});

test('WebAuthn credentials are accessed through the server-side admin client', () => {
  assert.match(webauthn, /createWebAuthnRouter\(getSupabaseAdmin/);
  assert.match(webauthn, /supabaseAdmin\.from\('webauthn_credentials'\)/);
});

test('legacy administrative tables are removed from anon/authenticated Data API privileges', () => {
  for (const table of ['budget_settings', 'school_settings', 'webauthn_credentials']) {
    assert.ok(migration.includes(`REVOKE ALL PRIVILEGES ON TABLE public.${table} FROM anon, authenticated;`));
    assert.ok(migration.includes(`GRANT ALL PRIVILEGES ON TABLE public.${table} TO service_role;`));
  }
});
