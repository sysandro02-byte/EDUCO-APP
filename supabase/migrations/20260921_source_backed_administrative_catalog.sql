-- Source-backed legal catalog enrichment. This migration does NOT publish or enable payment.
-- Sources:
-- MES creation/opening: https://www.sgg.cg/JO/2023/congo-jo-2023-25.pdf
-- Private education framework: https://www.sgg.cg/fr/recherche.html?page=5224&row=123399
-- Accreditation commissions: https://www.sgg.cg/fr/recherche.html?page=4812&row=123383
-- MFP equivalence procedure: https://fonction-publique.gouv.cg/fr/node/174

update public.administrative_services
set legal_status='VERIFIED',
    legal_reference='Décret n°96-221 du 13 mai 1996, modifié ; décret n°2008-127 du 23 juin 2008',
    legal_source_url='https://www.sgg.cg/fr/recherche.html?page=4812&row=123383',
    updated_at=now()
where code='MEPSA-AGR';

update public.administrative_services
set legal_status='VERIFIED',
    legal_reference='Arrêté n°7060 du 8 juin 2023 ; décret n°96-221 du 13 mai 1996 modifié ; décret n°2008-127 du 23 juin 2008',
    legal_source_url='https://www.sgg.cg/JO/2023/congo-jo-2023-25.pdf',
    updated_at=now()
where code='MES-CRE';

update public.administrative_services
set legal_status='VERIFIED',
    legal_reference='Arrêté n°7061 du 8 juin 2023 ; décret n°96-221 du 13 mai 1996 modifié ; décret n°2008-127 du 23 juin 2008',
    legal_source_url='https://www.sgg.cg/textes-officiels/arretes/2023/congo-arrete-2023-7061.pdf',
    updated_at=now()
where code='MES-OUV';

update public.administrative_services
set legal_status='VERIFIED',
    legal_reference='Loi n°021/89 du 14 novembre 1989 ; décret n°2012-714 du 12 juin 2012',
    legal_source_url='https://fonction-publique.gouv.cg/fr/node/174',
    updated_at=now()
where code='MFP-EQD';

insert into public.administrative_service_required_documents(
  service_code,document_code,label,required,verified,conditional_note,
  allowed_mime_types,max_size_bytes,sort_order,active
) values (
  'MFP-EQD','INSTITUTION_APPROVAL','Agrément de l’établissement',false,true,'Le cas échéant.',
  array['application/pdf','image/jpeg','image/png'],10485760,15,true
)
on conflict (service_code,document_code) do update set
  label=excluded.label,required=excluded.required,verified=true,
  conditional_note=excluded.conditional_note,active=true;

update public.administrative_service_required_documents
set verified=true,
    required=case document_code
      when 'DIPLOMA' then true
      when 'CURRICULUM' then true
      when 'REGISTRATION_CERT' then true
      when 'TRANSCRIPTS' then true
      when 'COMPLETION_CERT' then false
      when 'INSTITUTION_APPROVAL' then false
      else required end,
    conditional_note=case document_code
      when 'COMPLETION_CERT' then 'Le cas échéant.'
      when 'INSTITUTION_APPROVAL' then 'Le cas échéant.'
      else null end
where service_code='MFP-EQD'
  and document_code in ('DIPLOMA','CURRICULUM','REGISTRATION_CERT','TRANSCRIPTS','COMPLETION_CERT','INSTITUTION_APPROVAL');
