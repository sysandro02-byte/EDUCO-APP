-- Atomic two-phase issuance: reserve canonical number/token before server-side PDF generation.
alter table public.administrative_official_documents
  add column if not exists issuance_state text not null default 'FINAL'
  check (issuance_state in ('RESERVED','FINAL','FAILED'));

create or replace function private.reserve_administrative_document_secure(p_application_id uuid)
returns public.administrative_official_documents
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.administrative_applications;
  s public.administrative_services;
  sg public.administrative_authorized_signers;
  d public.administrative_official_documents;
  n text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select * into a
  from public.administrative_applications
  where id=p_application_id
  for update;

  if a.id is null or not public.is_ministry_administrative_agent(coalesce(a.assigned_ministry,a.ministry)) then
    raise exception 'Accès non autorisé';
  end if;

  if a.status not in ('APPROVED','PAID') then
    raise exception 'Dossier non éligible à émission';
  end if;

  select * into s from public.administrative_services where code=a.service_code;
  if s.code is null or s.publication_status<>'PUBLISHED' or s.legal_status<>'VERIFIED' then
    raise exception 'Démarche non publiable juridiquement';
  end if;

  if s.payment_enabled and a.status<>'PAID' then
    raise exception 'Paiement officiel non confirmé';
  end if;

  select * into sg
  from public.administrative_authorized_signers
  where user_uid=auth.uid()
    and ministry=a.ministry
    and active
    and (service_code is null or service_code=a.service_code)
    and valid_from<=now()
    and (valid_until is null or valid_until>now())
  order by (service_code is not null) desc, valid_from desc
  limit 1;

  if sg.id is null then raise exception 'Signataire non habilité'; end if;

  select * into d
  from public.administrative_official_documents
  where application_id=a.id and issuance_state='RESERVED'
  order by issued_at desc
  limit 1;

  if d.id is not null then return d; end if;

  n:=upper(a.ministry)||'-'||replace(a.service_code,'-','')||'-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.administrative_document_number_seq')::text,7,'0');

  insert into public.administrative_official_documents(
    application_id,owner_uid,document_number,document_type,ministry,
    signer_name,signer_title,signer_authorization_id,legal_reference,issuance_state
  )
  values(
    a.id,a.applicant_uid,n,coalesce(s.output_document,s.name),a.ministry,
    sg.signer_name,sg.signer_title,sg.id,s.legal_reference,'RESERVED'
  )
  returning * into d;

  return d;
end $$;

revoke all on function private.reserve_administrative_document_secure(uuid) from public,anon;
grant execute on function private.reserve_administrative_document_secure(uuid) to authenticated;

create or replace function public.reserve_administrative_document(p_application_id uuid)
returns public.administrative_official_documents
language sql
security invoker
set search_path=''
as $$ select private.reserve_administrative_document_secure(p_application_id) $$;

revoke all on function public.reserve_administrative_document(uuid) from public,anon;
grant execute on function public.reserve_administrative_document(uuid) to authenticated;

create or replace function private.finalize_administrative_document_secure(
  p_document_id uuid,
  p_storage_path text,
  p_sha256 text
)
returns public.administrative_official_documents
language plpgsql
security definer
set search_path=''
as $$
declare
  d public.administrative_official_documents;
  a public.administrative_applications;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select * into d
  from public.administrative_official_documents
  where id=p_document_id
  for update;

  if d.id is null or d.issuance_state<>'RESERVED' then
    raise exception 'Réservation invalide';
  end if;

  select * into a
  from public.administrative_applications
  where id=d.application_id
  for update;

  if not public.is_ministry_administrative_agent(d.ministry) then
    raise exception 'Accès non autorisé';
  end if;

  if p_storage_path is null or p_sha256 !~ '^[0-9a-fA-F]{64}$' then
    raise exception 'PDF ou empreinte invalide';
  end if;

  update public.administrative_official_documents
  set storage_path=p_storage_path,
      sha256=lower(p_sha256),
      issuance_state='FINAL'
  where id=d.id
  returning * into d;

  update public.administrative_applications
  set status='DOCUMENT_ISSUED',updated_at=now()
  where id=a.id;

  insert into public.administrative_application_events(
    application_id,action,from_status,to_status,note
  )
  values(a.id,'ISSUE_DOCUMENT',a.status,'DOCUMENT_ISSUED',d.document_number);

  return d;
end $$;

revoke all on function private.finalize_administrative_document_secure(uuid,text,text) from public,anon;
grant execute on function private.finalize_administrative_document_secure(uuid,text,text) to authenticated;

create or replace function public.finalize_administrative_document(
  p_document_id uuid,
  p_storage_path text,
  p_sha256 text
)
returns public.administrative_official_documents
language sql
security invoker
set search_path=''
as $$ select private.finalize_administrative_document_secure(p_document_id,p_storage_path,p_sha256) $$;

revoke all on function public.finalize_administrative_document(uuid,text,text) from public,anon;
grant execute on function public.finalize_administrative_document(uuid,text,text) to authenticated;
