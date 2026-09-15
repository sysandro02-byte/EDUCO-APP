import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server = fs.readFileSync('server.ts', 'utf8');
const api = fs.readFileSync('src/services/api.ts', 'utf8');
const app = fs.readFileSync('App.tsx', 'utf8');

test('Supabase server configuration never comes from request headers', () => {
  assert.doesNotMatch(server, /headers\?\.\['x-supabase-(?:key|url)'\]/i);
  assert.doesNotMatch(server, /VITE_SUPABASE_ANON_KEY/);
});

test('browser API auth does not send Supabase configuration or uid/email bearer fallbacks', () => {
  assert.doesNotMatch(api, /x-supabase-(?:key|url)/i);
  assert.doesNotMatch(api, /token\s*=\s*parsed\.(?:uid|email)/);
});

test('cached user is not accepted without backend session validation', () => {
  assert.match(app, /const storedToken = localStorage\.getItem\('EDUCO_USER_TOKEN'\)/);
  assert.match(app, /const userResult = await getCurrentUser\(\)/);
  assert.doesNotMatch(app, /setCurrentUser\(parsedUser\)/);
});

test('login no longer authenticates from local users or public find-user lookup', () => {
  const start = app.indexOf('const handleLogin = async');
  const end = app.indexOf('const handleLogout', start);
  const login = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(login, /users\.find/);
  assert.doesNotMatch(login, /findUserByEmail/);
  assert.doesNotMatch(login, /signInWithPassword/);
  assert.doesNotMatch(login, /x-supabase-(?:key|url)/i);
  assert.match(login, /if \(isBiometric\)[\s\S]*getCurrentUser\(\)/);
  assert.match(login, /!data\?\.token/);
});
