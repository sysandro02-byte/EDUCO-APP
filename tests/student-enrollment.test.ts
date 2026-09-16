import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const enrollment = fs.readFileSync(new URL('../server/studentEnrollment.ts', import.meta.url), 'utf8');
const operations = fs.readFileSync(new URL('../server/operations.ts', import.meta.url), 'utf8');
const studentApi = fs.readFileSync(new URL('../src/services/studentApi.ts', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_student_enrollment_integrity.sql', import.meta.url), 'utf8');

test('new student accounts use the dedicated enrollment endpoint', () => {
  assert.match(studentApi, /isNewStudent/);
  assert.match(studentApi, /\/api\/enrollments\/students/);
  assert.match(studentApi, /phone: user\?\.phone \|\| user\?\.contact/);
  assert.match(api, /export \{ saveUserToDb \} from '\.\/studentApi'/);
});

test('enrollment validates class ownership inside the target school', () => {
  assert.match(enrollment, /from\('classes'\)/);
  assert.match(enrollment, /eq\('school_id', schoolId\)/);
  assert.match(enrollment, /Sélectionnez une classe valide appartenant à cet établissement/);
});

test('phone, email and student matricule are preflighted before auth creation', () => {
  const emailCheck = enrollment.indexOf("from('users').select('id').ilike('email', email)");
  const phoneCheck = enrollment.indexOf("eq('phone_normalized', phone)");
  const matriculeCheck = enrollment.indexOf("eq('student_id', scopedMatricule)");
  const authCreate = enrollment.indexOf('client.auth.admin.createUser');
  assert.ok(emailCheck >= 0 && emailCheck < authCreate);
  assert.ok(phoneCheck >= 0 && phoneCheck < authCreate);
  assert.ok(matriculeCheck >= 0 && matriculeCheck < authCreate);
  assert.match(enrollment, /Ce numéro de téléphone est déjà associé à un autre compte/);
  assert.match(enrollment, /Ce matricule élève est déjà utilisé/);
});

test('student enrollment persists the account phone and never reassigns an existing student', () => {
  assert.match(enrollment, /phone: phone \|\| null/);
  assert.match(enrollment, /from\('students'\)\.insert\(\[studentPayload\]\)/);
  assert.doesNotMatch(enrollment, /from\('students'\)\.update\(studentPayload\)/);
});

test('failed enrollment rolls back both profile and auth identity', () => {
  assert.match(enrollment, /createdUserId/);
  assert.match(enrollment, /from\('users'\)\.delete\(\)\.eq\('id', createdUserId\)/);
  assert.match(enrollment, /client\.auth\.admin\.deleteUser\(createdAuthUid\)/);
});

test('operations wrapper preserves legacy routes and registers student enrollment', () => {
  assert.match(operations, /registerLegacyOperations/);
  assert.match(operations, /registerStudentEnrollment/);
});

test('database makes class names school-scoped and student profile one-to-one', () => {
  assert.match(migration, /drop constraint if exists classes_name_key/);
  assert.match(migration, /drop index if exists public\.classes_name_unique/);
  assert.match(migration, /classes_school_name_unique_idx/);
  assert.match(migration, /school_id, lower\(btrim\(name\)\)/);
  assert.match(migration, /students_user_id_unique_idx/);
  assert.match(migration, /where user_id is not null/);
});
