import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const gradeGuard = fs.readFileSync(new URL('../server/gradeGuard.ts', import.meta.url), 'utf8');
const enrollmentRegistry = fs.readFileSync(new URL('../server/studentEnrollment.ts', import.meta.url), 'utf8');
const gradePage = fs.readFileSync(new URL('../components/TeacherGradesPage.tsx', import.meta.url), 'utf8');
const gradeForm = fs.readFileSync(new URL('../components/GradeForm.tsx', import.meta.url), 'utf8');
const bulletin = fs.readFileSync(new URL('../components/Bulletin.tsx', import.meta.url), 'utf8');
const comments = fs.readFileSync(new URL('../components/ReportCardCommentsForm.tsx', import.meta.url), 'utf8');

test('grade mutations are protected by an explicit writer-role guard', () => {
  assert.match(gradeGuard, /GRADE_WRITER_ROLES/);
  assert.match(gradeGuard, /Vous n’êtes pas autorisé à saisir ou modifier des notes/);
  assert.doesNotMatch(gradeGuard, /'Parent'/);
  assert.doesNotMatch(gradeGuard, /'Élève'/);
  assert.match(enrollmentRegistry, /registerGradeMutationGuard\(app, requireAuth, getUser, getClient\)/);
});

test('grade guard requires a real school subject and validates teacher assignment', () => {
  assert.match(gradeGuard, /from\('subjects'\)/);
  assert.match(gradeGuard, /Cette matière n’existe pas dans cet établissement/);
  assert.match(gradeGuard, /teacher_ids/);
  assert.match(gradeGuard, /Cette matière ne vous est pas affectée/);
});

test('grade score remains constrained to the official 0-20 scale', () => {
  assert.match(gradeGuard, /score < 0 \|\| score > 20/);
  assert.match(gradeForm, /min="0"/);
  assert.match(gradeForm, /max="20"/);
});

test('teacher grade screen only exposes assigned classes and compatible subjects', () => {
  assert.match(gradePage, /schoolClass\.teacherId \?\? schoolClass\.teacher_id/);
  assert.match(gradePage, /assigned\.length === 0 \|\| assigned\.some/);
  assert.match(gradePage, /Aucune classe ne vous est affectée/);
  assert.doesNotMatch(gradePage, /assume a teacher can see any class/i);
});

test('bulletin overall average is calculated from subject averages, not raw grade count', () => {
  assert.match(bulletin, /evaluatedSubjectAverages/);
  assert.match(bulletin, /overallAverageValue/);
  assert.match(bulletin, /Moyenne ≥ 10\/20/);
  assert.match(bulletin, /Moyenne < 10\/20/);
  assert.match(bulletin, /Non évalué/);
  assert.doesNotMatch(bulletin, />Admis</);
});

test('bulletin period and academic year are explicit and no longer frozen to 2023-2024', () => {
  assert.match(comments, /getCurrentAcademicYear/);
  assert.match(comments, /id="report-period"/);
  assert.match(comments, /id="report-year"/);
  assert.doesNotMatch(comments, /2023-2024/);
});
