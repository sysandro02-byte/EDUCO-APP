import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const migration = fs.readFileSync(
  new URL('../supabase/migrations/20260917_optimize_foreign_key_indexes.sql', import.meta.url),
  'utf8',
);

const requiredIndexes = [
  ['attendance_class_id_idx', 'attendance', 'class_id'],
  ['attendance_recorded_by_idx', 'attendance', 'recorded_by'],
  ['financial_audit_logs_actor_user_id_idx', 'financial_audit_logs', 'actor_user_id'],
  ['grades_class_id_idx', 'grades', 'class_id'],
  ['grades_student_id_idx', 'grades', 'student_id'],
  ['grades_subject_id_idx', 'grades', 'subject_id'],
  ['grades_teacher_id_idx', 'grades', 'teacher_id'],
  ['notifications_sender_id_idx', 'notifications', 'sender_id'],
  ['students_school_id_idx', 'students', 'school_id'],
  ['subscription_requests_school_id_idx', 'subscription_requests', 'school_id'],
  ['survey_responses_survey_id_idx', 'survey_responses', 'survey_id'],
  ['surveys_school_id_idx', 'surveys', 'school_id'],
  ['timetable_subject_id_idx', 'timetable', 'subject_id'],
] as const;

test('migration adds every advisor-reported foreign-key covering index', () => {
  for (const [indexName, tableName, columnName] of requiredIndexes) {
    assert.match(
      migration,
      new RegExp(`CREATE INDEX IF NOT EXISTS ${indexName} ON public\\.${tableName} \\(${columnName}\\);`),
    );
  }
});

test('migration drops only redundant custom unique indexes', () => {
  for (const indexName of ['students_student_id_idx', 'subscriptions_code_idx', 'users_uid_idx']) {
    assert.match(migration, new RegExp(`DROP INDEX IF EXISTS public\\.${indexName};`));
  }

  for (const constraintIndex of ['students_student_id_key', 'subscriptions_code_key', 'users_uid_unique']) {
    assert.doesNotMatch(migration, new RegExp(`DROP INDEX IF EXISTS public\\.${constraintIndex};`));
  }
});
