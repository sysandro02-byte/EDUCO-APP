-- Use authoritative service metadata when creating applications and expose catalog provenance.

drop function if exists public.list_administrative_service_catalog();
drop function if exists private.list_administrative_service_catalog_secure();

create or replace function private.list_administrative_service_catalog_secure()
returns table(
  code text,ministry text,competent_direction text,competent_service text,name text,audience text,
  legal_status text,legal_reference text,legal_source_url text,
  fee_amount numeric,fee_currency text,fee_status text,fee_reference text,fee_source_url text,
  payment_enabled boolean,processing_days integer,processing_days_status text,
  output_document text,publication_status text,requirements_status text,
  request_enabled boolean,form_version integer,form_fields jsonb,required_documents jsonb
)
language sql security definer set search_path='' stable
as $$
 select
   s.code,s.ministry,s.competent_direction,s.competent_service,s.name,s.audience,
   s.legal_status,s.legal_reference,s.legal_source_url,
   s.fee_amount,s.fee_currency,s.fee_status,s.fee_reference,s.fee_source_url,
   s.payment_enabled,s.processing_days,s.processing_days_status,
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
  code text,ministry text,competent_direction text,competent_service text,name text,audience text,
  legal_status text,legal_reference text,legal_source_url text,
  fee_amount numeric,fee_currency text,fee_status text,fee_reference text,fee_source_url text,
  payment_enabled boolean,processing_days integer,processing_days_status text,
  output_document text,publication_status text,requirements_status text,
  request_enabled boolean,form_version integer,form_fields jsonb,required_documents jsonb
)
language sql security invoker set search_path='' stable
as $$ select * from private.list_administrative_service_catalog_secure() $$;
revoke all on function public.list_administrative_service_catalog() from public,anon;
grant execute on function public.list_administrative_service_catalog() to authenticated;

create or replace function private.create_administrative_application_secure(
  p_service_code text,p_applicant_name text,p_applicant_email text,p_form_data jsonb default '{}'::jsonb
)
returns public.administrative_applications
language plpgsql security definer set search_path=''
as $$
declare
  s public.administrative_services;
  a public.administrative_applications;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if p_form_data is null or jsonb_typeof(p_form_data)<>'object' then raise exception 'Formulaire invalide'; end if;

  select * into s from public.administrative_services
  where code=p_service_code and publication_status<>'SUSPENDED';
  if s.code is null then raise exception 'Démarche introuvable ou suspendue'; end if;

  insert into public.administrative_applications(
    service_code,applicant_uid,applicant_name,applicant_email,ministry,status,form_data
  ) values(
    s.code,auth.uid(),left(nullif(trim(p_applicant_name),''),200),
    left(nullif(trim(p_applicant_email),''),254),s.ministry,'DRAFT',p_form_data
  ) returning * into a;

  insert into public.administrative_application_events(
    application_id,actor_uid,action,from_status,to_status,note
  ) values(a.id,auth.uid(),'DRAFT_CREATED',null,'DRAFT',
    case when s.publication_status='PUBLISHED' and s.legal_status='VERIFIED' and s.requirements_status='VERIFIED'
      then 'Brouillon d’une démarche ouverte'
      else 'Brouillon de préparation — soumission officielle verrouillée' end);

  return a;
end $$;
revoke all on function private.create_administrative_application_secure(text,text,text,jsonb) from public,anon;
grant execute on function private.create_administrative_application_secure(text,text,text,jsonb) to authenticated;

create or replace function public.create_administrative_application(
  p_service_code text,p_applicant_name text,p_applicant_email text,p_form_data jsonb default '{}'::jsonb
)
returns public.administrative_applications
language sql security invoker set search_path=''
as $$ select private.create_administrative_application_secure(p_service_code,p_applicant_name,p_applicant_email,p_form_data) $$;
revoke all on function public.create_administrative_application(text,text,text,jsonb) from public,anon;
grant execute on function public.create_administrative_application(text,text,text,jsonb) to authenticated;

revoke insert on public.administrative_applications from authenticated;
