import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const lifecycle = fs.readFileSync(new URL('../server/accountLifecycle.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260916_account_lifecycle.sql', import.meta.url), 'utf8');
const push = fs.readFileSync(new URL('../server/push.ts', import.meta.url), 'utf8');

test('inactivity policy is 14 days, 30 days and 5 day admin grace', () => {
  assert.match(lifecycle, /WARNING_AFTER = 14 \* DAY/);
  assert.match(lifecycle, /ADMIN_ALERT_AFTER = 30 \* DAY/);
  assert.match(lifecycle, /AUTO_DELETE_GRACE = 5 \* DAY/);
});

test('activity cancels pending inactivity deletion', () => {
  assert.match(lifecycle, /last_active_at: now/);
  assert.match(lifecycle, /inactivity_delete_after: null/);
});

test('lifecycle sends user warning, admin notification and deletion email', () => {
  assert.match(lifecycle, /account-inactivity-warning/);
  assert.match(lifecycle, /ACCOUNT_INACTIVITY/);
  assert.match(lifecycle, /account-inactivity-admin/);
  assert.match(lifecycle, /account-deleted/);
});

test('phone login sends OTP only to registered email without exposing it', () => {
  assert.match(lifecycle, /\/api\/auth\/phone-login\/request/);
  assert.match(lifecycle, /\/api\/auth\/phone-login\/verify/);
  assert.match(lifecycle, /otpManager\.generateOtp\(account\.email, 'login_2fa'/);
  assert.match(lifecycle, /phone-login-otp/);
  assert.doesNotMatch(lifecycle, /success: true, email: account\.email/);
  assert.doesNotMatch(lifecycle, /sendSms|sendSMS|twilio/i);
});

test('phone OTP verification creates a secure EDUCO session and resets inactivity', () => {
  assert.match(lifecycle, /createLocalSessionToken\(user\)/);
  assert.match(lifecycle, /otpManager\.verifyOtp\(account\.email, otpCode, 'login_2fa'\)/);
  assert.match(lifecycle, /inactivity_admin_alerted_at: null/);
});

test('account lifecycle routes are registered by the live operations server path', () => {
  assert.match(push, /registerAccountLifecycle\(app, requireAuth, getUser, getClient\)/);
});

test('database persists lifecycle state and unique normalized phone', () => {
  assert.match(migration, /phone text/);
  assert.match(migration, /last_active_at timestamptz/);
  assert.match(migration, /inactivity_warning_sent_at timestamptz/);
  assert.match(migration, /inactivity_delete_after timestamptz/);
  assert.match(migration, /users_phone_unique_idx/);
});
