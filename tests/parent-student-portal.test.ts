import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const portal = fs.readFileSync(new URL('../server/portalRoutes.ts', import.meta.url), 'utf8');
const push = fs.readFileSync(new URL('../server/push.ts', import.meta.url), 'utf8');
const api = fs.readFileSync(new URL('../src/services/api.ts', import.meta.url), 'utf8');

test('personal legacy export is intercepted by the scoped portal', () => {
  assert.match(portal, /app\.get\('\/api\/admin\/export-data'/);
  assert.match(portal, /PERSONAL_ROLES\.has\(role\)/);
  assert.match(portal, /res\.redirect\(307, '\/api\/portal'\)/);
  assert.match(push, /registerPortalRoutes\(app, requireAuth, getUser, getClient\)/);
  assert.match(api, /requestSchoolApi\('\/api\/admin\/export-data'\)/);
});

test('portal is restricted to Parent and Student accounts and authenticated school', () => {
  assert.match(portal, /app\.get\('\/api\/portal'/);
  assert.match(portal, /!user\?\.schoolId \|\| !user\?\.id \|\| !PERSONAL_ROLES\.has\(role\)/);
  assert.match(portal, /const schoolId = Number\(user\.schoolId\)/);
  assert.doesNotMatch(portal, /req\.(body|query).*schoolId/);
});

test('Parent child linkage uses normalized parent phone from authoritative records', () => {
  assert.match(portal, /const normalizePhone/);
  assert.match(portal, /const accountPhone = normalizePhone\(user\.phone \|\| user\.contact \|\| user\.parentPhone\)/);
  assert.match(portal, /const studentParentPhone = normalizePhone\(student\.parent_phone\)/);
  assert.match(portal, /accountPhone === studentParentPhone/);
  assert.doesNotMatch(portal, /student\.parent_email/);
});

test('Student portal can only link its own student record', () => {
  assert.match(portal, /if \(role === 'Élève'\) return same\(student\.user_id, user\.id\)/);
});

test('portal never exposes school-wide personnel or transaction tables', () => {
  assert.doesNotMatch(portal, /from\('personnel'\)/);
  assert.doesNotMatch(portal, /from\('transactions'\)/);
  assert.doesNotMatch(portal, /from\('activity_logs'\)/);
  assert.doesNotMatch(portal, /from\('subscriptions'\)/);
  assert.match(portal, /const personalTransactions = paymentRows\.map/);
});

test('inactive student accounts keep finances visible but hide pedagogical data', () => {
  assert.match(portal, /const activeRecordIds/);
  assert.match(portal, /const visibleGrades = gradeRows\.filter/);
  assert.match(portal, /const visibleAttendance = attendanceRows\.filter/);
  assert.match(portal, /const visibleTimetable = timetableRows\.filter/);
  assert.match(portal, /payments: paymentRows\.map/);
  assert.match(portal, /homeworkDiary: Array\.isArray\(operations\.homeworkDiary\).*activeClassIds/s);
  assert.match(portal, /reportCardComments: Array\.isArray\(operations\.reportCardComments\).*activeStudentRefs/s);
});

test('fees are limited to global fees or linked class names', () => {
  assert.match(portal, /const linkedClassNames/);
  assert.match(portal, /const className = String\(fee\.class_name \|\| ''\)\.trim\(\)/);
  assert.match(portal, /return !className \|\| linkedClassNames\.has\(className\)/);
});

test('portal only returns direct messages involving the authenticated personal account', () => {
  assert.match(portal, /Number\(row\.sender_id\) === Number\(user\.id\) \|\| Number\(row\.recipient_id\) === Number\(user\.id\)/);
  assert.match(portal, /row\.message_type === 'direct' \|\| row\.recipient_id != null/);
});

test('school settings returned to personal accounts are explicitly whitelisted', () => {
  assert.match(portal, /const publicSchoolSettings = \{/);
  assert.match(portal, /currency:/);
  assert.match(portal, /themeColor:/);
  assert.match(portal, /defaultLanguage:/);
  assert.doesNotMatch(portal, /schoolSettings: \{ \.\.\.school/);
  assert.doesNotMatch(portal, /cashierSettings/);
  assert.doesNotMatch(portal, /rafSettings/);
});
