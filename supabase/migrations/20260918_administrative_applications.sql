-- Administrative service applications and official documents.
create table if not exists public.administrative_applications (
 id uuid primary key default gen_random_uuid(), service_code text not null references public.administrative_services(code),
 applicant_uid uuid not null default auth.uid(), applicant_name text, applicant_email text, ministry text not null,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','UNDER_REVIEW','MISSING_DOCUMENTS','APPROVED','REJECTED','PAYMENT_DUE','PAID','DOCUMENT_ISSUED')),
 form_data jsonb not null default '{}'::jsonb, submitted_at timestamptz, reviewed_at timestamptz,
 payment_reference text, payment_amount numeric(14,2), payment_currency text default 'XAF',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.administrative_application_files (
 id uuid primary key default gen_random_uuid(), application_id uuid not null references public.administrative_applications(id) on delete cascade,
 owner_uid uuid not null default auth.uid(), file_name text not null, storage_path text not null, mime_type text, size_bytes bigint,
 created_at timestamptz not null default now()
);
create table if not exists public.administrative_official_documents (
 id uuid primary key default gen_random_uuid(), application_id uuid not null unique references public.administrative_applications(id) on delete cascade,
 owner_uid uuid not null, document_number text unique not null, document_type text not null, storage_path text,
 verification_token uuid not null default gen_random_uuid(), issued_at timestamptz not null default now(), revoked_at timestamptz
);
alter table public.administrative_applications enable row level security;
alter table public.administrative_application_files enable row level security;
alter table public.administrative_official_documents enable row level security;
grant select,insert,update on public.administrative_applications to authenticated;
grant select,insert,delete on public.administrative_application_files to authenticated;
grant select on public.administrative_official_documents to authenticated;
create policy "applicant reads applications" on public.administrative_applications for select to authenticated using ((select auth.uid())=applicant_uid);
create policy "applicant creates applications" on public.administrative_applications for insert to authenticated with check ((select auth.uid())=applicant_uid and status='DRAFT');
create policy "applicant edits drafts" on public.administrative_applications for update to authenticated using ((select auth.uid())=applicant_uid and status in ('DRAFT','MISSING_DOCUMENTS')) with check ((select auth.uid())=applicant_uid);
create policy "owner reads files" on public.administrative_application_files for select to authenticated using ((select auth.uid())=owner_uid);
create policy "owner adds files" on public.administrative_application_files for insert to authenticated with check ((select auth.uid())=owner_uid);
create policy "owner deletes files" on public.administrative_application_files for delete to authenticated using ((select auth.uid())=owner_uid);
create policy "owner reads official documents" on public.administrative_official_documents for select to authenticated using ((select auth.uid())=owner_uid);
insert into storage.buckets(id,name,public) values ('administrative-applications','administrative-applications',false) on conflict(id) do update set public=false;
create policy "applicant uploads administrative files" on storage.objects for insert to authenticated with check (bucket_id='administrative-applications' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "applicant reads administrative files" on storage.objects for select to authenticated using (bucket_id='administrative-applications' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "applicant deletes administrative files" on storage.objects for delete to authenticated using (bucket_id='administrative-applications' and (storage.foldername(name))[1]=(select auth.uid())::text);

-- Harden submission and storage access.
-- Applicants cannot transition status directly: submission is exposed through a narrow RPC.
drop policy if exists "applicant edits drafts" on public.administrative_applications;
create policy "applicant edits drafts" on public.administrative_applications for update to authenticated
using ((select auth.uid())=applicant_uid and status in ('DRAFT','MISSING_DOCUMENTS'))
with check ((select auth.uid())=applicant_uid and status in ('DRAFT','MISSING_DOCUMENTS'));

create or replace function public.submit_administrative_application(p_id uuid)
returns public.administrative_applications
language plpgsql
security definer
set search_path=''
as $$
declare v_row public.administrative_applications;
begin
 update public.administrative_applications
 set status='SUBMITTED', submitted_at=now(), updated_at=now()
 where id=p_id and applicant_uid=(select auth.uid()) and status in ('DRAFT','MISSING_DOCUMENTS')
 returning * into v_row;
 if v_row.id is null then raise exception 'Dossier introuvable ou non soumissible'; end if;
 return v_row;
end $$;
revoke all on function public.submit_administrative_application(uuid) from public;
grant execute on function public.submit_administrative_application(uuid) to authenticated;

-- A file row must belong to an application owned by the same caller.
drop policy if exists "owner adds files" on public.administrative_application_files;
create policy "owner adds files" on public.administrative_application_files for insert to authenticated
with check ((select auth.uid())=owner_uid and exists (
 select 1 from public.administrative_applications a
 where a.id=application_id and a.applicant_uid=(select auth.uid()) and a.status in ('DRAFT','MISSING_DOCUMENTS')
));
