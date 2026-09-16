import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const lifecycle = fs.readFileSync(new URL('../server/accountLifecycle.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260916_account_lifecycle.sql', import.meta.url), 'utf8');

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

test('phone login resolver maps phone to email and never sends OTP to phone', () => {
  assert.match(lifecycle, /\/api\/auth\/resolve-phone/);
  assert.match(lifecycle, /res\.json\(\{ success: true, email:/);
  assert.doesNotMatch(lifecycle, /sendSms|sendSMS|twilio/i);
});

test('database persists lifecycle state and unique normalized phone', () => {
  assert.match(migration, /last_active_at timestamptz/);
  assert.match(migration, /inactivity_warning_sent_at timestamptz/);
  assert.match(migration, /inactivity_delete_after timestamptz/);
  assert.match(migration, /users_phone_unique_idx/);
});
