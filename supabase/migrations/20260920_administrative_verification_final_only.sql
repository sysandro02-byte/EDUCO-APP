create or replace function private.verify_administrative_document_public(p_token uuid)
returns table(document_number text,document_type text,ministry text,status text,issued_at timestamptz,expires_at timestamptz,signer_name text,signer_title text,legal_reference text,sha256 text)
language sql
security definer
set search_path=''
stable
as $$
 select d.document_number,d.document_type,d.ministry,
 case when d.status='VALID' and d.expires_at is not null and d.expires_at<=now() then 'EXPIRED' else d.status end,
 d.issued_at,d.expires_at,d.signer_name,d.signer_title,d.legal_reference,d.sha256
 from public.administrative_official_documents d
 where d.verification_token=p_token and d.issuance_state='FINAL'
 limit 1
$$;
