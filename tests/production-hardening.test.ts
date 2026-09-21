import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const government = fs.readFileSync(new URL('../supabase/migrations/20260921_production_government_authorization_hardening.sql', import.meta.url), 'utf8');
const jurisdiction = fs.readFileSync(new URL('../supabase/migrations/20260921_government_assignment_and_jurisdiction_management.sql', import.meta.url), 'utf8');
const payments = fs.readFileSync(new URL('../supabase/migrations/20260921_verified_catalog_payments_document_audit.sql', import.meta.url), 'utf8');
const drafts = fs.readFileSync(new URL('../supabase/migrations/20260921_administrative_catalog_provenance_and_secure_drafts.sql', import.meta.url), 'utf8');
const adminService = fs.readFileSync(new URL('../src/services/administrativeServices.ts', import.meta.url), 'utf8');
const paymentClient = fs.readFileSync(new URL('../src/services/administrativePayments.ts', import.meta.url), 'utf8');
const paymentInit = fs.readFileSync(new URL('../supabase/functions/initiate-administrative-payment/index.ts', import.meta.url), 'utf8');
const paymentWebhook = fs.readFileSync(new URL('../supabase/functions/administrative-payment-webhook/index.ts', import.meta.url), 'utf8');
const officialDocument = fs.readFileSync(new URL('../supabase/functions/generate-official-document/index.ts', import.meta.url), 'utf8');
const accountProvision = fs.readFileSync(new URL('../supabase/functions/provision-government-account/index.ts', import.meta.url), 'utf8');
const sessionGuard = fs.readFileSync(new URL('../src/services/sessionExpiryGuard.ts', import.meta.url), 'utf8');
const appEntry = fs.readFileSync(new URL('../index.tsx', import.meta.url), 'utf8');

test('government public RPCs are invoker wrappers over private capability checks', () => {
  for (const fn of [
    'government_module_records','government_module_save','government_module_transition',
    'government_module_history','government_module_delete','government_workspace_snapshot'
  ]) {
    assert.match(government, new RegExp('public\\.'+fn+'[\\s\\S]*?security invoker','i'));
  }
  assert.match(government, /government_actor_has_capability_secure/);
  assert.match(government, /government_assignments/);
});

test('government statistics require explicit school jurisdictions', () => {
  assert.match(government, /government_school_jurisdictions/);
  assert.match(government, /v_school_ids/);
  assert.match(government, /where s\.id=any\(v_school_ids\)/);
  assert.match(jurisdiction, /jurisdictions\.manage/);
  assert.match(jurisdiction, /MANUAL_ASSIGNMENT/);
});

test('government account provisioning validates known entity codes and keeps authorization in app_metadata', () => {
  assert.match(accountProvision, /const entities:Record<string,string\[]>/);
  assert.match(accountProvision, /entityScopedSuffixes/);
  assert.match(accountProvision, /app_metadata:\{account_type:"government"/);
  assert.doesNotMatch(accountProvision, /user_metadata:\{name,account_type:"government"/);
});

test('administrative applications are created via an authoritative RPC instead of direct client insert', () => {
  assert.match(drafts, /create_administrative_application_secure/);
  assert.match(drafts, /revoke insert on public\.administrative_applications from authenticated/i);
  assert.match(adminService, /rpc\('create_administrative_application'/);
  assert.doesNotMatch(adminService, /from\('administrative_applications'\)\.insert/);
});

test('published paid services require source-backed legal and tariff verification', () => {
  assert.match(payments, /source juridique officielle est requise/i);
  assert.match(payments, /source tarifaire officielle est requise/i);
  assert.match(payments, /payment_enabled and \(fee_status<>'VERIFIED_CURRENT'/);
  assert.match(payments, /publication_status='PUBLISHED'/);
  assert.match(payments, /requirements_status<>'VERIFIED'/);
});

test('payment confirmation is service-role only and exact amount/currency are enforced', () => {
  assert.match(payments, /auth\.role\(\)<>'service_role'/);
  assert.match(payments, /revoke all on function public\.confirm_administrative_payment_provider[\s\S]*authenticated/i);
  assert.match(payments, /p_amount is distinct from t\.amount/);
  assert.match(payments, /upper\(trim\(p_currency\)\)<>upper\(t\.currency\)/);
  assert.match(paymentClient, /functions\.invoke\('initiate-administrative-payment'/);
});

test('payment gateway stays server-side and provider callbacks require HMAC', () => {
  assert.match(paymentInit, /ADMIN_PAYMENT_GATEWAY_URL/);
  assert.match(paymentInit, /ADMIN_PAYMENT_GATEWAY_TOKEN/);
  assert.match(paymentInit, /x-educo-idempotency-key/);
  assert.match(paymentWebhook, /ADMIN_PAYMENT_WEBHOOK_SECRET/);
  assert.match(paymentWebhook, /HMAC/);
  assert.match(paymentWebhook, /x-educo-signature/);
  assert.match(paymentWebhook, /confirm_administrative_payment_provider/);
});

test('official document generation closes failed reservations and keeps a lifecycle audit', () => {
  assert.match(payments, /administrative_document_events/);
  assert.match(payments, /fail_administrative_document_secure/);
  assert.match(payments, /Habilitation du signataire expirée ou révoquée/);
  assert.match(officialDocument, /failReservation/);
  assert.match(officialDocument, /fail_administrative_document/);
});


test('installed PWA restores a session only after server-side identity verification', () => {
  assert.match(sessionGuard, /restorePersistentSession/);
  assert.match(sessionGuard, /getSecureAuthHeaders/);
  assert.match(sessionGuard, /getApiUrl\('\/api\/auth\/me'\)/);
  assert.match(sessionGuard, /if \(!response\.ok\) return false/);
  assert.match(sessionGuard, /if \(!data\?\.user\) return false/);
  assert.match(sessionGuard, /sessionStorage\.setItem\('EDUCO_SESSION_ACTIVE', 'true'\)/);
  assert.match(appEntry, /await restorePersistentSession\(\)/);
  assert.doesNotMatch(appEntry, /restoreInstalledPwaSessionMarker/);
});
