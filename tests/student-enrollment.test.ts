import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const enrollment = fs.readFileSync(new URL('../server/studentEnrollment.ts', import.meta.url), 'utf8');
const operations = fs.readFileSync(new URL('../server/operations.ts', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_student_enrollment_integrity.sql', import.meta.url), 'utf8');

test('new student creation uses a dedicated authenticated enrollment endpoint', () => {
  assert.match(enrollment, /app\.post\('\/api\/enrollments\/students', requireAuth/);
  assert.match(operations, /registerStudentEnrollment/);
  assert.match(api, /\/api\/enrollments\/students/);
  assert.match(api, /isNewStudent/);
});

test('enrollment validates identity and school-scoped class before creating auth user', () => {
  const classValidation = enrollment.indexOf("from('classes')");
  const authCreation = enrollment.indexOf('auth.admin.createUser');
  assert.ok(classValidation > -1 && authCreation > classValidation, 'class must be validated before Auth creation');
  assert.match(enrollment, /phone\.length < 7/);
  assert.match(enrollment, /phone_normalized/);
  assert.match(enrollment, /existingEmail/);
  assert.match(enrollment, /existingStudent/);
  assert.match(enrollment, /eq\('school_id', schoolId\)/);
});

test('cashier enrollment respects the school allowRegistration permission', () => {
  assert.match(enrollment, /actorRole === 'Caissière'/);
  assert.match(enrollment, /allowRegistration === true/);
});

test('failed enrollment compensates both public profile and auth identity', () => {
  assert.match(enrollment, /from\('users'\)\.delete\(\)/);
  assert.match(enrollment, /auth\.admin\.deleteUser\(createdAuthUid\)/);
});

test('database protects student dossier and class identity integrity', () => {
  assert.match(migration, /drop constraint if exists classes_name_unique/i);
  assert.match(migration, /classes_school_name_unique_idx/i);
  assert.match(migration, /students_user_id_unique_idx/i);
  assert.match(migration, /on public\.students \(user_id\)/i);
});
