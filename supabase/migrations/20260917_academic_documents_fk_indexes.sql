-- EDUCO: covering indexes for academic documents foreign keys.
-- Keeps validation/printing lookups and FK maintenance efficient as document volume grows.

create index if not exists academic_documents_class_id_idx
  on public.academic_documents (class_id);
create index if not exists academic_documents_student_id_idx
  on public.academic_documents (student_id);
create index if not exists academic_documents_generated_by_idx
  on public.academic_documents (generated_by);
create index if not exists academic_documents_validated_by_idx
  on public.academic_documents (validated_by);
create index if not exists academic_documents_print_authorized_by_idx
  on public.academic_documents (print_authorized_by);
create index if not exists academic_document_prints_printed_by_idx
  on public.academic_document_prints (printed_by);
