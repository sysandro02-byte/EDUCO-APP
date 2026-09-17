-- Add covering indexes for foreign keys reported by Supabase Performance Advisor.
CREATE INDEX IF NOT EXISTS attendance_class_id_idx ON public.attendance (class_id);
CREATE INDEX IF NOT EXISTS attendance_recorded_by_idx ON public.attendance (recorded_by);
CREATE INDEX IF NOT EXISTS financial_audit_logs_actor_user_id_idx ON public.financial_audit_logs (actor_user_id);
CREATE INDEX IF NOT EXISTS grades_class_id_idx ON public.grades (class_id);
CREATE INDEX IF NOT EXISTS grades_student_id_idx ON public.grades (student_id);
CREATE INDEX IF NOT EXISTS grades_subject_id_idx ON public.grades (subject_id);
CREATE INDEX IF NOT EXISTS grades_teacher_id_idx ON public.grades (teacher_id);
CREATE INDEX IF NOT EXISTS notifications_sender_id_idx ON public.notifications (sender_id);
CREATE INDEX IF NOT EXISTS students_school_id_idx ON public.students (school_id);
CREATE INDEX IF NOT EXISTS subscription_requests_school_id_idx ON public.subscription_requests (school_id);
CREATE INDEX IF NOT EXISTS survey_responses_survey_id_idx ON public.survey_responses (survey_id);
CREATE INDEX IF NOT EXISTS surveys_school_id_idx ON public.surveys (school_id);
CREATE INDEX IF NOT EXISTS timetable_subject_id_idx ON public.timetable (subject_id);

-- Keep unique-constraint-backed indexes and remove only redundant custom indexes.
DROP INDEX IF EXISTS public.students_student_id_idx;
DROP INDEX IF EXISTS public.subscriptions_code_idx;
DROP INDEX IF EXISTS public.users_uid_idx;
