alter table public.administrative_services
  add column if not exists requirements_status text not null default 'TO_VERIFY'
    check (requirements_status in ('TO_VERIFY','VERIFIED','SUSPENDED')),
  add column if not exists form_version integer not null default 1 check (form_version > 0);

create table if not exists public.administrative_service_form_fields (
  service_code text not null references public.administrative_services(code) on delete cascade,
  field_key text not null,
  label text not null,
  input_type text not null default 'text'
    check (input_type in ('text','email','tel','date','textarea','select','number')),
  required boolean not null default false,
  verified boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  help_text text,
  sort_order integer not null default 0,
  active boolean not null default true,
  primary key(service_code,field_key)
);
alter table public.administrative_service_form_fields enable row level security;
revoke all on public.administrative_service_form_fields from anon,authenticated;

create table if not exists public.administrative_service_required_documents (
  service_code text not null references public.administrative_services(code) on delete cascade,
  document_code text not null,
  label text not null,
  required boolean not null default true,
  verified boolean not null default false,
  conditional_note text,
  allowed_mime_types text[] not null default array['application/pdf','image/jpeg','image/png']::text[],
  max_size_bytes bigint not null default 10485760 check (max_size_bytes between 1 and 52428800),
  sort_order integer not null default 0,
  active boolean not null default true,
  primary key(service_code,document_code)
);
alter table public.administrative_service_required_documents enable row level security;
revoke all on public.administrative_service_required_documents from anon,authenticated;

alter table public.administrative_application_files add column if not exists document_code text;
create index if not exists administrative_application_files_document_code_idx
on public.administrative_application_files(application_id,document_code);

insert into public.administrative_service_form_fields(service_code,field_key,label,input_type,required,verified,help_text,sort_order)
select s.code,'request_subject','Objet / précision de la demande','textarea',false,false,
       'Champ de préparation interne EDUCO ; la liste officielle doit être validée par le ministère.',10
from public.administrative_services s
on conflict do nothing;

insert into public.administrative_service_form_fields(service_code,field_key,label,input_type,required,verified,help_text,sort_order)
values
 ('MFP-EQD','diploma_title','Intitulé du diplôme','text',true,false,'À valider par le ministère avant activation officielle.',20),
 ('MFP-EQD','institution_name','Établissement ayant délivré le diplôme','text',true,false,'À valider par le ministère avant activation officielle.',30),
 ('MFP-EQD','graduation_year','Année d’obtention','number',true,false,'À valider par le ministère avant activation officielle.',40),
 ('MFP-EQD','country','Pays de délivrance','text',true,false,'À valider par le ministère avant activation officielle.',50),
 ('MES-CRE','establishment_name','Nom projeté de l’établissement','text',true,false,'Structure de préparation ; exigence officielle à valider.',20),
 ('MES-OUV','establishment_name','Nom de l’établissement','text',true,false,'Structure de préparation ; exigence officielle à valider.',20),
 ('METP-CRE','establishment_name','Nom projeté de l’établissement','text',true,false,'Structure de préparation ; exigence officielle à valider.',20),
 ('METP-OUV','establishment_name','Nom de l’établissement','text',true,false,'Structure de préparation ; exigence officielle à valider.',20),
 ('METP-MOD','establishment_name','Nom de l’établissement','text',true,false,'Structure de préparation ; exigence officielle à valider.',20),
 ('MEPSA-AGR','establishment_name','Nom de l’établissement','text',true,false,'Structure de préparation ; exigence officielle à valider.',20),
 ('MES-REN-ENS','teaching_field','Discipline / domaine d’enseignement','text',true,false,'Structure de préparation ; exigence officielle à valider.',20)
on conflict do nothing;

insert into public.administrative_service_required_documents(
  service_code,document_code,label,required,verified,conditional_note,sort_order
)
values
 ('MFP-EQD','DIPLOMA','Copie légalisée du diplôme',true,false,'À valider officiellement avant activation.',10),
 ('MFP-EQD','TRANSCRIPTS','Relevés de notes',true,false,'À valider officiellement avant activation.',20),
 ('MFP-EQD','CURRICULUM','Programme / volume horaire de formation',true,false,'À valider officiellement avant activation.',30),
 ('MFP-EQD','REGISTRATION_CERT','Attestation ou certificat d’inscription',false,false,'Selon le dossier et la formation.',40),
 ('MFP-EQD','COMPLETION_CERT','Attestation de fin de formation',false,false,'Si applicable.',50)
on conflict do nothing;

create or replace function private.list_administrative_service_catalog_secure()
returns table(
  code text,ministry text,name text,audience text,legal_status text,legal_reference text,
  fee_amount numeric,fee_currency text,fee_status text,payment_enabled boolean,
  output_document text,publication_status text,requirements_status text,
  request_enabled boolean,form_version integer,form_fields jsonb,required_documents jsonb
)
language sql security definer set search_path='' stable
as $$
 select
   s.code,s.ministry,s.name,s.audience,s.legal_status,s.legal_reference,
   s.fee_amount,s.fee_currency,s.fee_status,s.payment_enabled,
   s.output_document,s.publication_status,s.requirements_status,
   (s.publication_status='PUBLISHED' and s.legal_status='VERIFIED' and s.requirements_status='VERIFIED') as request_enabled,
   s.form_version,
   coalesce((select jsonb_agg(jsonb_build_object(
     'field_key',f.field_key,'label',f.label,'input_type',f.input_type,'required',f.required,
     'verified',f.verified,'options',f.options,'help_text',f.help_text,'sort_order',f.sort_order
   ) order by f.sort_order,f.field_key)
   from public.administrative_service_form_fields f
   where f.service_code=s.code and f.active),'[]'::jsonb),
   coalesce((select jsonb_agg(jsonb_build_object(
     'document_code',d.document_code,'label',d.label,'required',d.required,'verified',d.verified,
     'conditional_note',d.conditional_note,'allowed_mime_types',d.allowed_mime_types,
     'max_size_bytes',d.max_size_bytes,'sort_order',d.sort_order
   ) order by d.sort_order,d.document_code)
   from public.administrative_service_required_documents d
   where d.service_code=s.code and d.active),'[]'::jsonb)
 from public.administrative_services s
 where s.publication_status<>'SUSPENDED'
 order by s.ministry,s.name
$$;
revoke all on function private.list_administrative_service_catalog_secure() from public,anon;
grant execute on function private.list_administrative_service_catalog_secure() to authenticated;

create or replace function public.list_administrative_service_catalog()
returns table(
  code text,ministry text,name text,audience text,legal_status text,legal_reference text,
  fee_amount numeric,fee_currency text,fee_status text,payment_enabled boolean,
  output_document text,publication_status text,requirements_status text,
  request_enabled boolean,form_version integer,form_fields jsonb,required_documents jsonb
)
language sql security invoker set search_path='' stable
as $$ select * from private.list_administrative_service_catalog_secure() $$;
revoke all on function public.list_administrative_service_catalog() from public,anon;
grant execute on function public.list_administrative_service_catalog() to authenticated;

create or replace function private.update_administrative_application_draft_secure(p_id uuid,p_form_data jsonb)
returns public.administrative_applications
language plpgsql security definer set search_path=''
as $$
declare a public.administrative_applications;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if p_form_data is null or jsonb_typeof(p_form_data)<>'object' then raise exception 'Formulaire invalide'; end if;
  update public.administrative_applications
  set form_data=p_form_data,updated_at=now()
  where id=p_id and applicant_uid=auth.uid() and status='DRAFT'
  returning * into a;
  if a.id is null then raise exception 'Brouillon introuvable ou non modifiable'; end if;
  return a;
end $$;
revoke all on function private.update_administrative_application_draft_secure(uuid,jsonb) from public,anon;
grant execute on function private.update_administrative_application_draft_secure(uuid,jsonb) to authenticated;

create or replace function public.update_administrative_application_draft(p_id uuid,p_form_data jsonb)
returns public.administrative_applications
language sql security invoker set search_path=''
as $$ select private.update_administrative_application_draft_secure(p_id,p_form_data) $$;
revoke all on function public.update_administrative_application_draft(uuid,jsonb) from public,anon;
grant execute on function public.update_administrative_application_draft(uuid,jsonb) to authenticated;

create or replace function private.submit_administrative_application_secure(p_id uuid)
returns public.administrative_applications
language plpgsql security definer set search_path=''
as $$
declare
  a public.administrative_applications;
  s public.administrative_services;
  missing_field text;
  missing_document text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into a from public.administrative_applications
  where id=p_id and applicant_uid=auth.uid() for update;
  if a.id is null or a.status<>'DRAFT' then raise exception 'Dossier introuvable ou non soumissible'; end if;

  select * into s from public.administrative_services where code=a.service_code;
  if s.code is null then raise exception 'Démarche introuvable'; end if;
  if s.publication_status<>'PUBLISHED' or s.legal_status<>'VERIFIED' or s.requirements_status<>'VERIFIED' then
    raise exception 'Cette démarche est encore en validation juridique et ne peut pas être soumise officiellement';
  end if;

  select f.label into missing_field
  from public.administrative_service_form_fields f
  where f.service_code=a.service_code and f.active and f.required and f.verified
    and (not (a.form_data ? f.field_key) or nullif(trim(coalesce(a.form_data->>f.field_key,'')),'') is null)
  order by f.sort_order limit 1;
  if missing_field is not null then raise exception 'Champ obligatoire manquant : %',missing_field; end if;

  select d.label into missing_document
  from public.administrative_service_required_documents d
  where d.service_code=a.service_code and d.active and d.required and d.verified
    and not exists(select 1 from public.administrative_application_files af
      where af.application_id=a.id and af.document_code=d.document_code)
  order by d.sort_order limit 1;
  if missing_document is not null then raise exception 'Pièce obligatoire manquante : %',missing_document; end if;

  update public.administrative_applications
  set status='SUBMITTED',submitted_at=now(),updated_at=now()
  where id=a.id returning * into a;

  insert into public.administrative_application_events(application_id,action,from_status,to_status,note)
  values(a.id,'SUBMIT','DRAFT','SUBMITTED','Dossier soumis après validation du catalogue de la démarche');
  return a;
end $$;
