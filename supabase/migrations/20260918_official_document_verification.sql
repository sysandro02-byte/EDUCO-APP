-- Official document issuance and public authenticity verification.
alter table public.administrative_official_documents add column if not exists status text not null default 'VALID'
 check(status in ('VALID','SUSPENDED','REVOKED','REPLACED','CANCELLED'));
alter table public.administrative_official_documents add column if not exists ministry text;
alter table public.administrative_official_documents add column if not exists signer_name text;
alter table public.administrative_official_documents add column if not exists signer_title text;
alter table public.administrative_official_documents add column if not exists sha256 text;
alter table public.administrative_official_documents add column if not exists legal_reference text;
alter table public.administrative_official_documents add column if not exists replaced_by uuid references public.administrative_official_documents(id);
create index if not exists administrative_official_documents_verification_idx on public.administrative_official_documents(verification_token);

create sequence if not exists public.administrative_document_number_seq;

create or replace function public.issue_administrative_document(p_application_id uuid,p_signer_name text,p_signer_title text,p_storage_path text default null,p_sha256 text default null)
returns public.administrative_official_documents language plpgsql security invoker set search_path=public as $$
declare a public.administrative_applications; s public.administrative_services; d public.administrative_official_documents; n text;
begin
 select * into a from public.administrative_applications where id=p_application_id for update;
 if a.id is null or not public.is_ministry_administrative_agent(coalesce(a.assigned_ministry,a.ministry)) then raise exception 'Accès non autorisé'; end if;
 if a.status not in ('APPROVED','PAID') then raise exception 'Le dossier doit être validé et, si requis, payé'; end if;
 select * into s from public.administrative_services where code=a.service_code;
 if s.payment_enabled and a.status<>'PAID' then raise exception 'Paiement officiel non confirmé'; end if;
 if s.publication_status<>'PUBLISHED' or s.legal_status<>'VERIFIED' then raise exception 'Démarche non publiable juridiquement'; end if;
 n:=upper(a.ministry)||'-'||replace(a.service_code,'-','')||'-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.administrative_document_number_seq')::text,7,'0');
 insert into public.administrative_official_documents(application_id,owner_uid,document_number,document_type,storage_path,ministry,signer_name,signer_title,sha256,legal_reference)
 values(a.id,a.applicant_uid,n,coalesce(s.output_document,s.name),p_storage_path,a.ministry,p_signer_name,p_signer_title,p_sha256,s.legal_reference) returning * into d;
 update public.administrative_applications set status='DOCUMENT_ISSUED',updated_at=now() where id=a.id;
 insert into public.administrative_application_events(application_id,action,from_status,to_status,note) values(a.id,'ISSUE_DOCUMENT',a.status,'DOCUMENT_ISSUED',n);
 return d;
end $$;
revoke all on function public.issue_administrative_document(uuid,text,text,text,text) from public;
grant execute on function public.issue_administrative_document(uuid,text,text,text,text) to authenticated;

create or replace function public.verify_administrative_document(p_token uuid)
returns table(document_number text,document_type text,ministry text,status text,issued_at timestamptz,signer_name text,signer_title text,legal_reference text)
language sql stable security invoker set search_path=public as $$
 select d.document_number,d.document_type,d.ministry,d.status,d.issued_at,d.signer_name,d.signer_title,d.legal_reference
 from public.administrative_official_documents d where d.verification_token=p_token;
$$;
revoke all on function public.verify_administrative_document(uuid) from public;
grant execute on function public.verify_administrative_document(uuid) to authenticated;
