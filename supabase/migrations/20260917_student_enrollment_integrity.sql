-- EDUCO student enrollment integrity hardening
-- 1) Class names are unique per school, not globally.
-- 2) One users row can own at most one students row.
-- 3) Preserve the existing globally unique student matricule.

alter table public.classes
  drop constraint if exists classes_name_key;

alter table public.classes
  drop constraint if exists classes_name_unique;

drop index if exists public.classes_name_unique;

create unique index if not exists classes_school_name_unique_idx
  on public.classes (school_id, lower(btrim(name)));

create unique index if not exists students_user_id_unique_idx
  on public.students (user_id)
  where user_id is not null;
