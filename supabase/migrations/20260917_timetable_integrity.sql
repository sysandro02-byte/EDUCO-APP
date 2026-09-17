-- EDUCO timetable integrity: validate school-day/time shapes and index conflict lookups.
ALTER TABLE public.timetable
  DROP CONSTRAINT IF EXISTS timetable_day_check,
  DROP CONSTRAINT IF EXISTS timetable_time_order_check;

ALTER TABLE public.timetable
  ADD CONSTRAINT timetable_day_check
  CHECK (day_of_week IN ('Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'));

ALTER TABLE public.timetable
  ADD CONSTRAINT timetable_time_order_check
  CHECK (
    start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND start_time < end_time
  );

CREATE INDEX IF NOT EXISTS timetable_class_day_time_idx
  ON public.timetable(class_id, day_of_week, start_time, end_time);

CREATE INDEX IF NOT EXISTS timetable_teacher_day_time_idx
  ON public.timetable(teacher_id, day_of_week, start_time, end_time);
