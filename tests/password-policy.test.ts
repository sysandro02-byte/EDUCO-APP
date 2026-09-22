import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  generateStrongPassword,
  getNewPasswordError,
  NEW_PASSWORD_MIN_LENGTH,
} from '../src/services/passwordPolicy.ts';

const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const studentEnrollment = fs.readFileSync(new URL('../server/studentEnrollment.ts', import.meta.url), 'utf8');
const governmentSetup = fs.readFileSync(new URL('../components/GovernmentPasswordSetupPage.tsx', import.meta.url), 'utf8');
const loginPage = fs.readFileSync(new URL('../components/LoginPage.tsx', import.meta.url), 'utf8');
const userForm = fs.readFileSync(new URL('../components/UserForm.tsx', import.meta.url), 'utf8');

test('new passwords require length and all four character classes', () => {
  assert.equal(NEW_PASSWORD_MIN_LENGTH, 12);
  assert.match(getNewPasswordError('Short1!') || '', /au moins 12 caractères/i);
  assert.match(getNewPasswordError('alllowercase123!') || '', /majuscule/i);
  assert.match(getNewPasswordError('ALLUPPERCASE123!') || '', /minuscule/i);
  assert.match(getNewPasswordError('NoDigitsHere!!') || '', /chiffre/i);
  assert.match(getNewPasswordError('NoSymbolHere123') || '', /symbole/i);
  assert.equal(getNewPasswordError('EducoSecure7!'), null);
});

test('generated passwords satisfy the shared policy', () => {
  for (let i = 0; i < 20; i += 1) {
    const password = generateStrongPassword(18);
    assert.ok(password.length >= 18);
    assert.equal(getNewPasswordError(password), null);
  }
});

test('server enforces shared policy for account creation and resets', () => {
  assert.match(server, /getNewPasswordError/);
  assert.match(server, /const parentPasswordError = getNewPasswordError\(password\)/);
  assert.match(server, /const passwordError = getNewPasswordError\(newPassword\)/);
  assert.match(server, /Educo!7\$\{crypto\.randomBytes\(24\)\.toString\('base64url'\)\}/);
  assert.doesNotMatch(server, /Parent123!/);
  assert.match(studentEnrollment, /getNewPasswordError\(password\)/);
});

test('client creation and government setup use the same policy', () => {
  assert.match(governmentSetup, /getNewPasswordError\(password\)/);
  assert.match(loginPage, /getNewPasswordError\(parentForm\.password\)/);
  assert.match(loginPage, /getNewPasswordError\(newPassword\)/);
  assert.match(userForm, /generateStrongPassword\(18\)/);
  assert.match(userForm, /getNewPasswordError\(formData\.password/);
});


test('legacy login compatibility never caches plaintext credentials or bypasses WebAuthn', () => {
  assert.doesNotMatch(server, /registeredAccountsStore/);
  assert.doesNotMatch(server, /entry\.password\s*===\s*password/);
  const start = server.indexOf("app.post('/api/users/login'");
  assert.ok(start >= 0, 'compatibility login route must exist');
  const route = server.slice(start, start + 5000);
  assert.match(route, /auth\.signInWithPassword/);
  assert.match(route, /isBiometric/);
  assert.match(route, /WebAuthn dédiée/);
  assert.match(route, /createLocalSessionToken\(user\)/);
});

test('parent registration is backend-authoritative and rolls back Auth on profile failure', () => {
  const start = server.indexOf("app.post('/api/auth/register-parent'");
  const end = server.indexOf('// Public Endpoint to Verify School Matricule', start);
  assert.ok(start >= 0 && end > start);
  const route = server.slice(start, end);
  assert.doesNotMatch(route, /req\.body\.uid/);
  assert.match(route, /auth\.admin\.createUser/);
  assert.match(route, /auth\.admin\.deleteUser\(uid\)/);
  assert.match(route, /existingParentEmail/);
  assert.match(route, /existingParentPhone/);

  const clientStart = loginPage.indexOf('const handleVerifyParentOtpAndSubmit');
  const clientEnd = loginPage.indexOf('const handleForgotPasswordSubmit', clientStart);
  const clientFlow = loginPage.slice(clientStart, clientEnd);
  assert.doesNotMatch(clientFlow, /auth\.signUp/);
  assert.doesNotMatch(clientFlow, /uid:\s*userUid/);
  assert.match(clientFlow, /\/api\/auth\/register-parent/);
});
