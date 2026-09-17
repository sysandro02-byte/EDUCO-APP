-- EDUCO: immutable academic reports/bulletins workflow.
-- Direct browser access is intentionally disabled: all reads/writes go through
-- authenticated EDUCO server routes which enforce school scope and role rules.

create table if not exists public.academic_documents (
  id uuid primary key default gen_random_uuid(),
  school_id integer not null references public.schools(id) on delete cascade,
  kind text not null check (kind in ('report', 'bulletin')),
  document_type text not null,
  status text not null default 'generated'
    check (status in ('generated', 'validated', 'print_authorized', 'printed')),
  academic_year text not null,
  term text,
  cycle text,
  class_id integer references public.classes(id) on delete set null,
  student_id integer references public.students(id) on delete set null,
  template_version integer not null default 1,
  snapshot jsonb not null default '{}'::jsonb,
  narrative jsonb not null default '{}'::jsonb,
  verification_code uuid not null default gen_random_uuid() unique,
  generated_by integer references public.users(id) on delete set null,
  generated_at timestamptz not null default now(),
  validated_by integer references public.users(id) on delete set null,
  validated_at timestamptz,
  print_authorized_by integer references public.users(id) on delete set null,
  print_authorized_at timestamptz,
  printed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academic_document_prints (
  id bigserial primary key,
  document_id uuid not null references public.academic_documents(id) on delete cascade,
  school_id integer not null references public.schools(id) on delete cascade,
  printed_by integer references public.users(id) on delete set null,
  print_type text not null default 'original' check (print_type in ('original', 'reprint')),
  copies integer not null default 1 check (copies between 1 and 10),
  reason text,
  printed_at timestamptz not null default now()
);

create index if not exists academic_documents_school_status_idx
  on public.academic_documents (school_id, status, created_at desc);
create index if not exists academic_documents_student_idx
  on public.academic_documents (school_id, student_id, academic_year, term);
create index if not exists academic_documents_class_idx
  on public.academic_documents (school_id, class_id, academic_year, term);
create index if not exists academic_document_prints_document_idx
  on public.academic_document_prints (document_id, printed_at desc);
create index if not exists academic_document_prints_school_idx
  on public.academic_document_prints (school_id, printed_at desc);

alter table public.academic_documents enable row level security;
alter table public.academic_document_prints enable row level security;

-- The EDUCO backend uses the server-side service role for these tables.
-- No policy is created for anon/authenticated, preventing direct Data API access.
revoke all on table public.academic_documents from anon, authenticated;
revoke all on table public.academic_document_prints from anon, authenticated;
revoke all on sequence public.academic_document_prints_id_seq from anon, authenticated;
