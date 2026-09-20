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

  if a.workflow_stage_code='SIGNATURE' and a.assigned_agent_uid is distinct from auth.uid() then
    raise exception 'Ce dossier est affecté à un autre signataire';
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
  order by (service_code is not null) desc,valid_from desc
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
