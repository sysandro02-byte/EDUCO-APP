import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const routes = fs.readFileSync(new URL('../server/attendanceRoutes.ts', import.meta.url), 'utf8');
const gradeRegistry = fs.readFileSync(new URL('../server/gradeGuard.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../components/TeacherClassesPage.tsx', import.meta.url), 'utf8');

test('attendance writes use the durable attendance table and an idempotent upsert', () => {
  assert.match(routes, /app\.post\('\/api\/operations\/attendance'/);
  assert.match(routes, /from\('attendance'\)/);
  assert.match(routes, /\.upsert\(rows, \{ onConflict: 'student_id,class_id,date' \}\)/);
  assert.match(gradeRegistry, /registerAttendanceRoutes\(app, requireAuth, getUser, getClient\)/);
});

test('attendance writer has an explicit role boundary', () => {
  assert.match(routes, /ATTENDANCE_ROLES/);
  assert.match(routes, /Vous n’êtes pas autorisé à enregistrer les présences/);
  assert.doesNotMatch(routes, /'Parent'/);
  assert.doesNotMatch(routes, /'Élève'/);
});

test('teacher class access is scoped to teacher_id', () => {
  assert.match(routes, /app\.get\('\/api\/classes'/);
  assert.match(routes, /canonicalizeRole\(actor\.role\) !== 'Enseignant'/);
  assert.match(routes, /\.eq\('teacher_id', actor\.id\)/);
  assert.match(routes, /Cette classe ne vous est pas affectée/);
});

test('attendance records must belong to the selected class', () => {
  assert.match(routes, /\.eq\('class_id', classId\)/);
  assert.match(routes, /\.in\('user_id', userIds\)/);
  assert.match(routes, /La feuille contient un élève qui n’est pas inscrit dans cette classe/);
  assert.match(routes, /Un élève apparaît plusieurs fois/);
});

test('attendance UI uses classId first and blocks empty or duplicate submissions', () => {
  assert.match(page, /student\.classId != null/);
  assert.match(page, /studentsInClass\.length === 0 \|\| isSaving/);
  assert.match(page, /recordsToSave\.length !== studentsInClass\.length/);
  assert.match(page, /Enregistrement…/);
  assert.match(page, /max=\{today\}/);
});
