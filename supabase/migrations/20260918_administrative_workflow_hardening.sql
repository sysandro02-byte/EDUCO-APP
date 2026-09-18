-- Security/performance follow-up for administrative workflows.
drop policy if exists "applicant edits drafts" on public.administrative_applications;
create policy "applicant edits own open applications" on public.administrative_applications for update to authenticated
using ((select auth.uid())=applicant_uid and status in ('DRAFT','MISSING_DOCUMENTS'))
with check ((select auth.uid())=applicant_uid and status in ('DRAFT','MISSING_DOCUMENTS','SUBMITTED'));

alter function public.submit_administrative_application(uuid) security invoker;
revoke all on function public.submit_administrative_application(uuid) from public, anon;
grant execute on function public.submit_administrative_application(uuid) to authenticated;

create index if not exists administrative_applications_service_code_idx on public.administrative_applications(service_code);
create index if not exists administrative_application_files_application_idx on public.administrative_application_files(application_id);
create index if not exists administrative_application_events_application_idx on public.administrative_application_events(application_id);
create index if not exists administrative_official_documents_replaced_by_idx on public.administrative_official_documents(replaced_by);
