import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const app = fs.readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const portal = fs.readFileSync(new URL('../server/portalRoutes.ts', import.meta.url), 'utf8');
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

test('legacy personal export entry point is redirected to the minimal portal', () => {
  assert.match(portal, /app\.get\('\/api\/admin\/export-data'/);
  assert.match(portal, /PERSONAL_ROLES\.has\(role\).*?res\.redirect\(307, '\/api\/portal'\)/s);
  assert.match(portal, /PLATFORM_ADMIN_ROLES\.has\(role\).*?next\(\)/s);
  assert.match(portal, /Accès réservé à l’administration centrale/);
});

test('all historical /api/admin routes have an early central-admin boundary', () => {
  assert.match(portal, /app\.use\('\/api\/admin'/);
  assert.match(portal, /const PLATFORM_ADMIN_ROLES = new Set\(\['Admin', 'Co-admin'\]\)/);
  assert.match(portal, /if \(!PLATFORM_ADMIN_ROLES\.has\(role\)\)/);
});

test('school deletion prevents a promoter from deleting another establishment', () => {
  assert.match(portal, /app\.delete\('\/api\/schools\/:id'/);
  assert.match(portal, /role === 'Promoteur' && Number\(user\?\.schoolId\) === targetSchoolId/);
  assert.match(portal, /Vous ne pouvez administrer que votre propre établissement/);
  assert.match(server, /dbUser\?\.role === 'Promoteur' && Number\(dbUser\.schoolId\) !== targetSchoolId/);
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
