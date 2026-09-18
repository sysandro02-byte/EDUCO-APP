-- Authorized signer registry and trusted official-document issuance.
create table if not exists public.administrative_authorized_signers (
 id uuid primary key default gen_random_uuid(), user_uid uuid not null references auth.users(id) on delete restrict,
 ministry text not null, service_code text references public.administrative_services(code) on delete restrict,
 signer_name text not null, signer_title text not null, active boolean not null default true,
 valid_from timestamptz not null default now(), valid_until timestamptz, created_at timestamptz not null default now(),
 created_by uuid references auth.users(id), check (valid_until is null or valid_until > valid_from)
);
alter table public.administrative_authorized_signers enable row level security;
revoke all on public.administrative_authorized_signers from anon, authenticated;
grant select on public.administrative_authorized_signers to authenticated;
create policy "signers read own authorization" on public.administrative_authorized_signers for select to authenticated using (user_uid=auth.uid());
create index if not exists administrative_authorized_signers_lookup_idx on public.administrative_authorized_signers(user_uid,ministry,service_code,active);
alter table public.administrative_official_documents add column if not exists signer_authorization_id uuid references public.administrative_authorized_signers(id) on delete restrict;

create or replace function private.issue_administrative_document_secure(p_application_id uuid,p_storage_path text default null,p_sha256 text default null)
returns public.administrative_official_documents language plpgsql security definer set search_path=''
as $$
declare a public.administrative_applications; s public.administrative_services; sg public.administrative_authorized_signers; d public.administrative_official_documents; n text;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into a from public.administrative_applications where id=p_application_id for update;
 if a.id is null or not public.is_ministry_administrative_agent(coalesce(a.assigned_ministry,a.ministry)) then raise exception 'Accès non autorisé'; end if;
 if a.status not in ('APPROVED','PAID') then raise exception 'Le dossier doit être validé et, si requis, payé'; end if;
 select * into s from public.administrative_services where code=a.service_code;
 if s.code is null then raise exception 'Démarche introuvable'; end if;
 if s.payment_enabled and a.status<>'PAID' then raise exception 'Paiement officiel non confirmé'; end if;
 if s.publication_status<>'PUBLISHED' or s.legal_status<>'VERIFIED' then raise exception 'Démarche non publiable juridiquement'; end if;
 select * into sg from public.administrative_authorized_signers where user_uid=auth.uid() and ministry=a.ministry and active
 and (service_code is null or service_code=a.service_code) and valid_from<=now() and (valid_until is null or valid_until>now())
 order by (service_code is not null) desc,valid_from desc limit 1;
 if sg.id is null then raise exception 'Signataire non habilité pour cette démarche'; end if;
 if p_sha256 is not null and p_sha256 !~ '^[0-9a-fA-F]{64}$' then raise exception 'Empreinte SHA-256 invalide'; end if;
 n:=upper(a.ministry)||'-'||replace(a.service_code,'-','')||'-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.administrative_document_number_seq')::text,7,'0');
 insert into public.administrative_official_documents(application_id,owner_uid,document_number,document_type,storage_path,ministry,signer_name,signer_title,signer_authorization_id,sha256,legal_reference)
 values(a.id,a.applicant_uid,n,coalesce(s.output_document,s.name),p_storage_path,a.ministry,sg.signer_name,sg.signer_title,sg.id,lower(p_sha256),s.legal_reference) returning * into d;
 update public.administrative_applications set status='DOCUMENT_ISSUED',updated_at=now() where id=a.id;
 insert into public.administrative_application_events(application_id,action,from_status,to_status,note) values(a.id,'ISSUE_DOCUMENT',a.status,'DOCUMENT_ISSUED',n);
 return d;
end $$;
revoke all on function private.issue_administrative_document_secure(uuid,text,text) from public,anon;
grant execute on function private.issue_administrative_document_secure(uuid,text,text) to authenticated;
drop function if exists public.issue_administrative_document(uuid,text,text,text,text);
create or replace function public.issue_administrative_document(p_application_id uuid,p_storage_path text default null,p_sha256 text default null)
returns public.administrative_official_documents language sql security invoker set search_path=''
as $$ select private.issue_administrative_document_secure(p_application_id,p_storage_path,p_sha256) $$;
revoke all on function public.issue_administrative_document(uuid,text,text) from public,anon;
grant execute on function public.issue_administrative_document(uuid,text,text) to authenticated;

-- Preview deployment refresh: 2026-09-18
