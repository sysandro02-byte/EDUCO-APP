drop policy if exists "signers read own authorization"
on public.administrative_authorized_signers;

create policy "signers read own authorization"
on public.administrative_authorized_signers
for select
to authenticated
using (user_uid = (select auth.uid()));

create index if not exists administrative_application_events_target_uid_idx
  on public.administrative_application_events(target_uid);
create index if not exists administrative_authorized_signers_created_by_idx
  on public.administrative_authorized_signers(created_by);
create index if not exists administrative_authorized_signers_service_code_idx
  on public.administrative_authorized_signers(service_code);
create index if not exists administrative_catalog_change_events_actor_uid_idx
  on public.administrative_catalog_change_events(actor_uid);
create index if not exists administrative_catalog_change_requests_control_approved_by_idx
  on public.administrative_catalog_change_requests(control_approved_by);
create index if not exists administrative_catalog_change_requests_created_by_idx
  on public.administrative_catalog_change_requests(created_by);
create index if not exists administrative_catalog_change_requests_final_approved_by_idx
  on public.administrative_catalog_change_requests(final_approved_by);
create index if not exists administrative_catalog_change_requests_rejected_by_idx
  on public.administrative_catalog_change_requests(rejected_by);
create index if not exists administrative_government_account_events_actor_uid_idx
  on public.administrative_government_account_events(actor_uid);
create index if not exists administrative_government_account_events_user_uid_idx
  on public.administrative_government_account_events(user_uid);
create index if not exists administrative_government_accounts_created_by_idx
  on public.administrative_government_accounts(created_by);
create index if not exists administrative_official_documents_signer_authorization_id_idx
  on public.administrative_official_documents(signer_authorization_id);
create index if not exists administrative_signer_events_actor_uid_idx
  on public.administrative_signer_events(actor_uid);
create index if not exists administrative_signer_events_signer_authorization_id_idx
  on public.administrative_signer_events(signer_authorization_id);
