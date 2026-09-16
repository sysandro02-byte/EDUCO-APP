import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const lifecycle = fs.readFileSync(new URL('../server/accountLifecycle.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260916_account_lifecycle.sql', import.meta.url), 'utf8');
const push = fs.readFileSync(new URL('../server/push.ts', import.meta.url), 'utf8');
const operations = fs.readFileSync(new URL('../server/operations.ts', import.meta.url), 'utf8');
const auth = fs.readFileSync(new URL('../src/middleware/auth.ts', import.meta.url), 'utf8');
const loginPage = fs.readFileSync(new URL('../components/LoginPage.tsx', import.meta.url), 'utf8');

test('inactivity policy is 14 days, 30 days and 5 day admin grace', () => {
  assert.match(lifecycle, /WARNING_AFTER = 14 \* DAY/);
  assert.match(lifecycle, /ADMIN_ALERT_AFTER = 30 \* DAY/);
  assert.match(lifecycle, /AUTO_DELETE_GRACE = 5 \* DAY/);
});

test('activity cancels pending inactivity deletion', () => {
  assert.match(lifecycle, /last_active_at: now/);
  assert.match(lifecycle, /inactivity_delete_after: null/);
  assert.match(auth, /AUTH_ACTIVITY_REFRESH_MS = 15 \* 60 \* 1000/);
  assert.match(auth, /Authenticated activity refresh failed/);
  assert.match(auth, /inactivity_warning_sent_at: null/);
  assert.match(auth, /inactivity_admin_alerted_at: null/);
  assert.match(auth, /inactivity_delete_after: null/);
});

test('lifecycle sends user warning, admin notification and deletion email', () => {
  assert.match(lifecycle, /account-inactivity-warning/);
  assert.match(lifecycle, /ACCOUNT_INACTIVITY/);
  assert.match(lifecycle, /account-inactivity-admin/);
  assert.match(lifecycle, /account-deleted/);
});

test('automatic deletion removes auth identity before deleting the profile and checks errors', () => {
  const authDelete = lifecycle.indexOf('client.auth.admin.deleteUser(account.uid)');
  const profileDelete = lifecycle.indexOf("client.from('users').delete().eq('id', account.id)");
  assert.ok(authDelete >= 0, 'Supabase Auth deletion must be present');
  assert.ok(profileDelete > authDelete, 'profile deletion must happen after Auth deletion');
  assert.match(lifecycle, /authDeleteError/);
  assert.match(lifecycle, /authDeleteError\.status !== 404/);
});

test('phone login verifies phone and password before sending OTP to registered email', () => {
  assert.match(lifecycle, /\/api\/auth\/phone-login\/request/);
  assert.match(lifecycle, /const password = String\(req\.body\?\.password \|\| ''\)/);
  assert.match(lifecycle, /signInWithPassword\(\{[\s\S]*email: account\.email,[\s\S]*password/);
  const passwordCheck = lifecycle.indexOf('signInWithPassword');
  const otpGeneration = lifecycle.indexOf("otpManager.generateOtp(account.email, 'login_2fa'");
  assert.ok(passwordCheck >= 0 && otpGeneration > passwordCheck, 'password must be verified before OTP generation');
  assert.match(lifecycle, /PHONE_CREDENTIALS_ERROR/);
  assert.match(lifecycle, /phone-login-otp/);
  assert.doesNotMatch(lifecycle, /success: true, email: account\.email/);
  assert.doesNotMatch(lifecycle, /sendSms|sendSMS|twilio/i);
  assert.match(lifecycle, /GENERIC_PHONE_MESSAGE/);
  assert.match(lifecycle, /Phone login OTP delivery failed/);
  assert.match(lifecycle, /allowPhoneRequest/);
});

test('phone login UI requires password before requesting OTP', () => {
  assert.match(loginPage, /JSON\.stringify\(\{ phone: phone\.trim\(\), password \}\)/);
  assert.match(loginPage, /id="phone-password"/);
  assert.match(loginPage, /autoComplete="current-password"/);
  assert.match(loginPage, /Vérifier et recevoir le code/);
});

test('phone OTP verification creates a secure EDUCO session and resets inactivity', () => {
  assert.match(lifecycle, /createLocalSessionToken\(user\)/);
  assert.match(lifecycle, /activeOtp\.metadata\?\.userId/);
  assert.match(lifecycle, /otpManager\.verifyOtp\(account\.email, otpCode, 'login_2fa'\)/);
  assert.match(lifecycle, /inactivity_admin_alerted_at: null/);
});

test('account lifecycle routes are registered by the live operations server path', () => {
  assert.match(operations, /registerAccountLifecycle\(app, requireAuth, getUser, getClient\)/);
  assert.doesNotMatch(push, /registerAccountLifecycle/);
});

test('lifecycle processes every account and keeps school alerts tenant-scoped', () => {
  assert.match(lifecycle, /\.range\(from, from \+ 999\)/);
  assert.match(lifecycle, /adminsQuery\.eq\('school_id', account\.school_id\)/);
  assert.match(lifecycle, /delete\(\)\.eq\('user_id', account\.id\)\.throwOnError\(\)/);
});

test('database persists lifecycle state and indexes normalized phone without unsafe uniqueness', () => {
  assert.match(migration, /phone text/);
  assert.match(migration, /last_active_at timestamptz/);
  assert.match(migration, /inactivity_warning_sent_at timestamptz/);
  assert.match(migration, /inactivity_delete_after timestamptz/);
  assert.match(migration, /users_phone_lookup_idx/);
  assert.match(migration, /drop index if exists public\.users_phone_unique_idx/);
  assert.match(migration, /phone_normalized text[\s\S]*generated always/);
  assert.match(lifecycle, /\.eq\('phone_normalized', phone\)/);
  assert.match(lifecycle, /matches\.length === 1/);
});
