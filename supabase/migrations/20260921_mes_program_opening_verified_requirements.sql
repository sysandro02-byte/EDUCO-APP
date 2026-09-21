
-- Source-backed MES program-opening procedures from Decree 2022-1300 (JO 2022-40).
-- Publication remains LEGAL_REVIEW until the applicable fee regime is confirmed.

insert into public.administrative_services(
  code,ministry,competent_direction,competent_service,name,audience,
  legal_status,legal_reference,legal_source_url,
  fee_amount,fee_currency,fee_status,fee_reference,fee_source_url,fee_mode,
  payment_enabled,output_document,publication_status,requirements_status,
  processing_days,processing_days_status,form_version
)
values
('MES-PROG-BTS-DUT','MES','DGES','AGREMENTS','Autorisation d’ouverture d’un programme BTS ou DUT','Établissements privés d’enseignement supérieur',
 'VERIFIED','Décret n°2022-1300 du 21 septembre 2022, articles 2 à 9',
 'https://www.sgg.cg/JO/2022/congo-jo-2022-40.pdf',
 null,'XAF','TO_VERIFY',null,null,'UNVERIFIED',false,
 'Autorisation d’ouverture de programme BTS/DUT','LEGAL_REVIEW','VERIFIED',null,'TO_VERIFY',1),

('MES-PROG-LIC','MES','DGES','AGREMENTS','Autorisation d’ouverture d’un programme de Licence','Établissements privés d’enseignement supérieur',
 'VERIFIED','Décret n°2022-1300 du 21 septembre 2022, articles 10 à 17',
 'https://www.sgg.cg/JO/2022/congo-jo-2022-40.pdf',
 null,'XAF','TO_VERIFY',null,null,'UNVERIFIED',false,
 'Autorisation d’ouverture de programme de Licence','LEGAL_REVIEW','VERIFIED',null,'TO_VERIFY',1),

('MES-PROG-MAS','MES','DGES','AGREMENTS','Autorisation d’ouverture d’un programme de Master','Établissements privés d’enseignement supérieur',
 'VERIFIED','Décret n°2022-1300 du 21 septembre 2022, articles 18 à 28',
 'https://www.sgg.cg/JO/2022/congo-jo-2022-40.pdf',
 null,'XAF','TO_VERIFY',null,null,'UNVERIFIED',false,
 'Autorisation d’ouverture de programme de Master','LEGAL_REVIEW','VERIFIED',null,'TO_VERIFY',1)
on conflict(code) do update set
  name=excluded.name,audience=excluded.audience,
  competent_direction=excluded.competent_direction,competent_service=excluded.competent_service,
  legal_status=excluded.legal_status,legal_reference=excluded.legal_reference,legal_source_url=excluded.legal_source_url,
  fee_mode='UNVERIFIED',fee_status='TO_VERIFY',payment_enabled=false,
  output_document=excluded.output_document,
  publication_status=case when public.administrative_services.publication_status='PUBLISHED'
    then public.administrative_services.publication_status else 'LEGAL_REVIEW' end,
  requirements_status='VERIFIED',updated_at=now();

-- Explicit bank-account attestation required by Law 77-2022 article 20
-- for creation, opening and renewal of accreditation.
insert into public.administrative_service_required_documents(
 service_code,document_code,label,required,verified,conditional_note,
 allowed_mime_types,max_size_bytes,sort_order,active
)
select code,'BANK_ACCOUNT_ATTESTATION','Attestation de compte bancaire',true,true,
       'Exigée par l’article 20 de la loi n°77-2022 pour la création, l’ouverture et le renouvellement.',
       array['application/pdf','image/jpeg','image/png'],10485760,5,true
from public.administrative_services
where code in ('MES-CRE','MES-OUV','MES-REN-AGR')
on conflict(service_code,document_code) do update set
 label=excluded.label,required=true,verified=true,conditional_note=excluded.conditional_note,active=true;

-- Common requirement templates for BTS/DUT and Licence.
with svc(code,base_doc,report_label,report_note) as (
 values
 ('MES-PROG-BTS-DUT','CREATION_AUTHORIZATION','Rapports d’évaluation requis',
  'Rapport d’évaluation initiale/ex ante BTS-DUT et rapport d’évaluation institutionnelle ex post, fournis par l’inspection générale.'),
 ('MES-PROG-LIC','CREATION_AUTHORIZATION','Rapports d’évaluation requis',
  'Rapport d’évaluation initiale/ex ante Licence et rapport d’évaluation institutionnelle ex post, fournis par l’inspection générale.')
)
insert into public.administrative_service_required_documents(
 service_code,document_code,label,required,verified,conditional_note,
 allowed_mime_types,max_size_bytes,sort_order,active
)
select s.code,x.document_code,x.label,true,true,x.note,
       array['application/pdf'],52428800,x.ord,true
from svc s
cross join lateral (values
 (s.base_doc,'Autorisation de création de l’établissement','Copie de l’autorisation de création.',10),
 ('PROGRAM_DOSSIER','Dossier détaillé du programme','Programme conforme au modèle réglementaire : fondement, débouchés, objectifs, accès, compétences, maquette UE/crédits/heures, plans de cours, contenus, stages et modalités d’évaluation/validation.',20),
 ('PEDAGOGICAL_APPOINTMENTS','Décisions de nomination des responsables pédagogiques','Décisions de nomination des responsables pédagogiques des programmes.',30),
 ('TEACHER_CV_PACK','Liste des enseignants et curriculum vitae signés','Identité, diplômes et expérience professionnelle de chaque enseignant.',40),
 ('TEACHER_EVIDENCE','Pièces justificatives des enseignants','Dernier diplôme certifié conforme, inscription sur liste d’aptitude le cas échéant, justificatifs d’expérience pour les professionnels.',50),
 ('TEACHER_APPOINTMENTS','Décisions de nomination des enseignants','Décisions de nomination des enseignants.',60),
 ('STUDENT_COUNTS_RATIOS','Effectifs et ratios d’encadrement','Effectifs par programme, ratio formateurs/étudiants et ratio enseignants/professionnels.',70),
 ('FACILITIES_EQUIPMENT','Locaux, ateliers et équipements','Salles, ateliers, laboratoires, bibliothèque, informatique, logiciels et couverture réseau nécessaires au programme.',80),
 ('INTERNSHIP_PARTNERSHIPS','Stages et conventions de partenariat','Sites de stage ou conventions d’accueil, plus conventions avec le monde socio-professionnel et établissements partenaires.',90),
 ('INSPECTION_REPORTS',s.report_label,s.report_note,100)
) as x(document_code,label,note,ord)
on conflict(service_code,document_code) do update set
 label=excluded.label,required=true,verified=true,conditional_note=excluded.conditional_note,
 allowed_mime_types=excluded.allowed_mime_types,max_size_bytes=excluded.max_size_bytes,
 sort_order=excluded.sort_order,active=true;

-- Master-specific requirements.
insert into public.administrative_service_required_documents(
 service_code,document_code,label,required,verified,conditional_note,
 allowed_mime_types,max_size_bytes,sort_order,active
)
values
('MES-PROG-MAS','FINAL_ACCREDITATION','Agrément définitif de l’établissement',true,true,'Copie de l’agrément définitif.',array['application/pdf'],10485760,10,true),
('MES-PROG-MAS','PROGRAM_DOSSIER','Dossier détaillé du programme de Master',true,true,'Programme conforme au modèle réglementaire : fondement, débouchés, objectifs, accès, compétences, maquette UE/crédits/heures, plans de cours, contenus, stages et modalités d’évaluation/validation.',array['application/pdf'],52428800,20,true),
('MES-PROG-MAS','PEDAGOGICAL_SCIENTIFIC_APPOINTMENTS','Décisions de nomination des responsables pédagogiques et scientifiques',true,true,'Responsables pédagogiques et scientifiques du programme.',array['application/pdf'],10485760,30,true),
('MES-PROG-MAS','TEACHER_CV_PACK','Liste des enseignants et curriculum vitae signés',true,true,'Enseignants de rang magistral, maîtres-assistants et professionnels avec identité, diplômes et expérience.',array['application/pdf'],52428800,40,true),
('MES-PROG-MAS','TEACHER_EVIDENCE','Pièces justificatives des enseignants',true,true,'Dernier diplôme certifié conforme, liste d’aptitude le cas échéant et justificatifs d’expérience professionnelle.',array['application/pdf'],52428800,50,true),
('MES-PROG-MAS','SUPERVISOR_LIST','Liste des enseignants superviseurs',true,true,'Enseignants de rang magistral superviseurs des maîtres-assistants et professionnels.',array['application/pdf'],10485760,60,true),
('MES-PROG-MAS','TEACHER_APPOINTMENTS','Décisions de nomination des enseignants',true,true,'Décisions de nomination des enseignants.',array['application/pdf'],10485760,70,true),
('MES-PROG-MAS','STUDENT_COUNTS_RATIOS','Effectifs et ratios d’encadrement',true,true,'Effectifs par programme et ratios réglementaires d’encadrement.',array['application/pdf'],10485760,80,true),
('MES-PROG-MAS','FACILITIES_EQUIPMENT','Locaux, laboratoires et équipements',true,true,'Salles, laboratoires de travaux pratiques, langues et recherche, bibliothèque, informatique, logiciels et réseau.',array['application/pdf'],52428800,90,true),
('MES-PROG-MAS','PARTNERSHIP_CONVENTIONS','Conventions de partenariat',true,true,'Conventions avec le monde socio-professionnel et établissements de formation/recherche nationaux ou étrangers.',array['application/pdf'],52428800,100,true),
('MES-PROG-MAS','INSPECTION_REPORTS','Rapports d’évaluation requis',true,true,'Rapport ex ante Master, rapport ex post Licence et rapport d’évaluation institutionnelle ex post, fournis par l’inspection générale.',array['application/pdf'],52428800,110,true)
on conflict(service_code,document_code) do update set
 label=excluded.label,required=true,verified=true,conditional_note=excluded.conditional_note,
 allowed_mime_types=excluded.allowed_mime_types,max_size_bytes=excluded.max_size_bytes,
 sort_order=excluded.sort_order,active=true;
