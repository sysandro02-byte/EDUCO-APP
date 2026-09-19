-- Public minimal QR verification and official-document lifecycle.
alter table public.administrative_official_documents add column if not exists expires_at timestamptz;
alter table public.administrative_official_documents drop constraint if exists administrative_official_documents_status_check;
alter table public.administrative_official_documents add constraint administrative_official_documents_status_check check(status in ('VALID','EXPIRED','SUSPENDED','REVOKED','REPLACED','CANCELLED'));

create or replace function private.verify_administrative_document_public(p_token uuid)
returns table(document_number text,document_type text,ministry text,status text,issued_at timestamptz,expires_at timestamptz,signer_name text,signer_title text,legal_reference text,sha256 text)
language sql security definer set search_path='' stable
as $$ select d.document_number,d.document_type,d.ministry,case when d.status='VALID' and d.expires_at is not null and d.expires_at<=now() then 'EXPIRED' else d.status end,d.issued_at,d.expires_at,d.signer_name,d.signer_title,d.legal_reference,d.sha256 from public.administrative_official_documents d where d.verification_token=p_token limit 1 $$;
revoke all on function private.verify_administrative_document_public(uuid) from public,anon,authenticated;
grant execute on function private.verify_administrative_document_public(uuid) to anon,authenticated;

drop function if exists public.verify_administrative_document(uuid);
create or replace function public.verify_administrative_document(p_token uuid)
returns table(document_number text,document_type text,ministry text,status text,issued_at timestamptz,expires_at timestamptz,signer_name text,signer_title text,legal_reference text,sha256 text)
language sql security invoker set search_path='' stable
as $$ select * from private.verify_administrative_document_public(p_token) $$;
revoke all on function public.verify_administrative_document(uuid) from public;
grant execute on function public.verify_administrative_document(uuid) to anon,authenticated;

create or replace function private.change_administrative_document_status_secure(p_document_id uuid,p_action text,p_replacement_id uuid default null)
returns public.administrative_official_documents language plpgsql security definer set search_path=''
as $$
declare d public.administrative_official_documents; ns text;
begin
 if auth.uid() is null then raise exception 'Authentification requise'; end if;
 select * into d from public.administrative_official_documents where id=p_document_id for update;
 if d.id is null or not public.is_ministry_administrative_agent(d.ministry) then raise exception 'Accès non autorisé'; end if;
 ns:=case upper(p_action) when 'SUSPEND' then 'SUSPENDED' when 'REVOKE' then 'REVOKED' when 'CANCEL' then 'CANCELLED' when 'REPLACE' then 'REPLACED' else null end;
 if ns is null then raise exception 'Action invalide'; end if;
 if d.status not in ('VALID','SUSPENDED') then raise exception 'Transition interdite depuis %',d.status; end if;
 if ns='REPLACED' and p_replacement_id is null then raise exception 'Document de remplacement requis'; end if;
 update public.administrative_official_documents set status=ns,revoked_at=case when ns in ('REVOKED','CANCELLED') then now() else revoked_at end,replaced_by=case when ns='REPLACED' then p_replacement_id else replaced_by end where id=d.id returning * into d;
 return d;
end $$;
revoke all on function private.change_administrative_document_status_secure(uuid,text,uuid) from public,anon;
grant execute on function private.change_administrative_document_status_secure(uuid,text,uuid) to authenticated;
create or replace function public.change_administrative_document_status(p_document_id uuid,p_action text,p_replacement_id uuid default null)
returns public.administrative_official_documents language sql security invoker set search_path=''
as $$ select private.change_administrative_document_status_secure(p_document_id,p_action,p_replacement_id) $$;
revoke all on function public.change_administrative_document_status(uuid,text,uuid) from public,anon;
grant execute on function public.change_administrative_document_status(uuid,text,uuid) to authenticated;
