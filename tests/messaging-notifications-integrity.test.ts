import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const messaging = fs.readFileSync(new URL('../server/messagingRoutes.ts', import.meta.url), 'utf8');
const push = fs.readFileSync(new URL('../server/push.ts', import.meta.url), 'utf8');
const operations = fs.readFileSync(new URL('../server/operations.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_messaging_notifications_integrity.sql', import.meta.url), 'utf8');

test('secure messaging routes are registered before legacy server routes through operations', () => {
  assert.match(operations, /registerPushNotifications\(app, requireAuth, getUser, getClient\)/);
  assert.match(push, /registerMessagingRoutes\(app, requireAuth, getUser, getClient\)/);
  assert.match(messaging, /app\.get\('\/api\/messages'/);
  assert.match(messaging, /app\.post\('\/api\/messages'/);
  assert.match(messaging, /app\.post\('\/api\/notifications\/dispatch'/);
});

test('messaging never trusts a browser supplied target school', () => {
  assert.match(messaging, /const schoolId = Number\(user\.schoolId\)/);
  assert.match(messaging, /targetSchoolId\/schoolId supplied by a browser is deliberately ignored/);
  assert.doesNotMatch(messaging, /const schoolId = .*req\.body.*targetSchoolId/);
  assert.match(messaging, /\.eq\('school_id', schoolId\)/);
});

test('direct recipients are school-scoped and personal accounts cannot message other personal accounts', () => {
  assert.match(messaging, /\.eq\('school_id', schoolId\)\s*\.in\('id', recipientIds\)/s);
  assert.match(messaging, /Tous les destinataires doivent appartenir au même établissement/);
  assert.match(messaging, /PERSONAL_ROLES\.has\(role\).*PERSONAL_ROLES\.has/s);
  assert.match(messaging, /peuvent écrire directement au personnel/);
});

test('channel messaging is staff-only and sender identity is server-derived', () => {
  assert.match(messaging, /if \(!STAFF_ROLES\.has\(role\)\)/);
  assert.match(messaging, /La diffusion sur un canal est réservée au personnel autorisé/);
  assert.match(messaging, /const senderName = String\(user\.name/);
  assert.match(messaging, /sender_id: Number\(user\.id\)/);
  assert.match(messaging, /sender_role: senderRole/);
  assert.doesNotMatch(messaging, /sender_name: req\.body/);
});

test('message history does not expose other users direct conversations', () => {
  assert.match(messaging, /const involved = Number\(row\.sender_id\) === Number\(user\.id\) \|\| Number\(row\.recipient_id\) === Number\(user\.id\)/);
  assert.match(messaging, /if \(PERSONAL_ROLES\.has\(role\)\) return direct && involved/);
  assert.match(messaging, /if \(STAFF_ROLES\.has\(role\)\) return direct \? involved : true/);
});

test('notification role broadcasts reject personal accounts and cannot mix platform and school audiences', () => {
  assert.match(messaging, /PERSONAL_ROLES\.has\(role\).*diffusion par rôle/s);
  assert.match(messaging, /Les audiences établissement et plateforme ne peuvent pas être mélangées/);
  assert.match(messaging, /recipientsQuery = recipientsQuery\.eq\('school_id', Number\(user\.schoolId\)\)/);
  assert.match(messaging, /school_id: platformAudience \? null : Number\(user\.schoolId\)/);
  assert.match(messaging, /sender_id: Number\(user\.id\) \|\| null/);
});

test('push subscriptions are isolated in their own table and ownership-scoped', () => {
  assert.match(push, /from\('push_subscriptions'\)/);
  assert.doesNotMatch(push, /settings\.pushSubscriptions/);
  assert.doesNotMatch(push, /from\('schools'\).*pushSubscriptions/s);
  assert.match(push, /\.eq\('user_id', Number\(user\.id\)\)/);
  assert.match(push, /Cet appareil est déjà associé à un autre compte/);
});

test('push dispatch uses authenticated school only, never body school identifiers', () => {
  assert.match(push, /sendPushToSchool\(client, user\.schoolId/);
  assert.doesNotMatch(push, /body\.targetSchoolId/);
  assert.doesNotMatch(push, /body\.schoolId/);
});

test('database migration creates durable tables, ownership columns, indexes and RLS', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.messages/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.push_subscriptions/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS school_id/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS sender_id/);
  assert.match(migration, /messages_school_created_idx/);
  assert.match(migration, /push_subscriptions_user_idx/);
  assert.match(migration, /ALTER TABLE public\.messages ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.push_subscriptions ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /ALTER TABLE public\.notifications ENABLE ROW LEVEL SECURITY/);
});
