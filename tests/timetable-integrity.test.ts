import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const routes = fs.readFileSync(new URL('../server/timetableRoutes.ts', import.meta.url), 'utf8');
const operations = fs.readFileSync(new URL('../server/operations.ts', import.meta.url), 'utf8');
const page = fs.readFileSync(new URL('../components/TimetablePage.tsx', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_timetable_integrity.sql', import.meta.url), 'utf8');

test('timetable writes use the durable table through an exact route', () => {
  assert.match(routes, /app\.post\('\/api\/operations\/timetable'/);
  assert.match(routes, /from\('timetable'\)/);
  assert.match(routes, /\.insert\(\[payload\]\)/);
  assert.match(routes, /\.update\(payload\)/);
  assert.match(routes, /\.delete\(\)/);
  const exactRoute = operations.indexOf('registerTimetableRoutes(app, requireAuth, getUser, getClient)');
  const genericRoute = operations.indexOf("app.post('/api/operations/:key'");
  assert.ok(exactRoute >= 0 && genericRoute > exactRoute, 'exact timetable route must register before generic operations route');
});

test('only school direction roles can mutate timetable', () => {
  assert.match(routes, /TIMETABLE_ROLES/);
  for (const role of ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire']) {
    assert.ok(routes.includes(`'${role}'`));
  }
  assert.doesNotMatch(routes, /TIMETABLE_ROLES[^\n]*Enseignant/);
  assert.doesNotMatch(routes, /TIMETABLE_ROLES[^\n]*Parent/);
  assert.doesNotMatch(routes, /TIMETABLE_ROLES[^\n]*Élève/);
});

test('timetable validates school ownership and teacher identity', () => {
  assert.match(routes, /from\('classes'\).*eq\('school_id', user\.schoolId\)/s);
  assert.match(routes, /from\('subjects'\).*eq\('school_id', user\.schoolId\)/s);
  assert.match(routes, /from\('users'\).*eq\('school_id', user\.schoolId\)/s);
  assert.match(routes, /canonicalizeRole\(teacher\.role\) !== 'Enseignant'/);
  assert.match(routes, /Enseignant invalide ou inactif/);
});

test('timetable rejects invalid times and class or teacher overlaps', () => {
  assert.match(routes, /startTime >= endTime/);
  assert.match(routes, /overlaps\(startTime, endTime/);
  assert.match(routes, /Number\(row\.class_id\) === classId \|\| Number\(row\.teacher_id\) === teacherId/);
  assert.match(routes, /Cette classe a déjà un cours sur ce créneau/);
  assert.match(routes, /Cet enseignant a déjà un cours sur ce créneau/);
});

test('operations reads durable timetable first and teacher visibility follows course teacher_id', () => {
  assert.match(operations, /const durableTimetable =/);
  assert.match(operations, /data\.timetable = durableTimetable\.length \? durableTimetable : \(saved\.timetable \|\| \[\]\)/);
  assert.match(operations, /data\.timetable = data\.timetable\.filter\(\(row: any\) => same\(row\.teacherId, user\.id\)\)/);
});

test('timetable UI aligns mutation rights and performs immediate conflict checks', () => {
  assert.match(page, /EDITABLE_ROLES = new Set\(\['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire'\]\)/);
  assert.doesNotMatch(page, /currentUserRole === 'Enseignant'/);
  assert.match(page, /u\.role !== 'Enseignant'/);
  assert.match(page, /formStartTime >= formEndTime/);
  assert.match(page, /overlaps\(formStartTime, formEndTime/);
  assert.match(page, /Number\(entry\.classId\) === Number\(selectedClassId\) \|\| Number\(entry\.teacherId\) === Number\(formTeacherId\)/);
  assert.match(page, /await onSave\(entryToSave\)/);
});

test('database migration enforces timetable day/time shape and indexes conflict queries', () => {
  assert.match(migration, /timetable_day_check/);
  assert.match(migration, /timetable_time_order_check/);
  assert.match(migration, /start_time < end_time/);
  assert.match(migration, /timetable_class_day_time_idx/);
  assert.match(migration, /timetable_teacher_day_time_idx/);
});
