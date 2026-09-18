-- EDUCO administrative services registry (additive, payments locked by default)
create table if not exists public.administrative_services (
 id bigserial primary key, code text unique not null, ministry text not null, competent_direction text, competent_service text,
 name text not null, audience text not null, legal_status text not null default 'TO_VERIFY' check (legal_status in ('VERIFIED','TO_VERIFY','OBSOLETE')),
 legal_reference text, legal_source_url text, fee_amount numeric(14,2), fee_currency text not null default 'XAF',
 fee_status text not null default 'TO_VERIFY' check (fee_status in ('VERIFIED_CURRENT','HISTORICAL','TO_VERIFY','FREE')),
 payment_enabled boolean not null default false, output_document text, publication_status text not null default 'DRAFT'
 check (publication_status in ('DRAFT','LEGAL_REVIEW','MINISTRY_APPROVED','PUBLISHED','SUSPENDED')),
 required_documents jsonb not null default '[]'::jsonb, workflow jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.administrative_services enable row level security;
revoke all on table public.administrative_services from anon, authenticated;
create index if not exists administrative_services_ministry_status_idx on public.administrative_services(ministry,publication_status);
-- Payment safety invariant: a payable service must have a currently verified non-null fee.
alter table public.administrative_services drop constraint if exists administrative_services_payment_guard;
alter table public.administrative_services add constraint administrative_services_payment_guard check (
 not payment_enabled or (fee_status='VERIFIED_CURRENT' and fee_amount is not null and fee_amount >= 0 and publication_status='PUBLISHED')
);

-- Initial catalog. These records remain non-payable until legal/tariff validation is completed.
insert into public.administrative_services(code,ministry,name,audience,legal_status,legal_reference,fee_status,payment_enabled,output_document,publication_status)
values
('MES-CRE','MES','Agrément de création d''un établissement privé','Établissement / Promoteur','TO_VERIFY','Décret n°96-221 ; textes MES','TO_VERIFY',false,'Agrément / acte administratif','LEGAL_REVIEW'),
('MES-OUV','MES','Agrément d''ouverture d''un établissement privé','Établissement','TO_VERIFY','Arrêté n°7061 du 8 juin 2023','TO_VERIFY',false,'Agrément / acte administratif','LEGAL_REVIEW'),
('MES-REN-ENS','MES','Renouvellement de l''autorisation d''enseigner','Enseignant','TO_VERIFY','Référentiel financier historique 2023','HISTORICAL',false,'Autorisation renouvelée','LEGAL_REVIEW'),
('METP-CRE','METP','Création d''un établissement privé','Établissement / Promoteur','TO_VERIFY','Service des agréments du METP','TO_VERIFY',false,'Décision / agrément','LEGAL_REVIEW'),
('METP-OUV','METP','Ouverture d''un établissement privé','Établissement','TO_VERIFY','Service des agréments du METP','TO_VERIFY',false,'Décision / agrément','LEGAL_REVIEW'),
('METP-MOD','METP','Modification d''un établissement privé','Établissement','TO_VERIFY','Service des agréments du METP','TO_VERIFY',false,'Décision administrative','LEGAL_REVIEW'),
('MEPSA-AGR','MEPSA','Agrément d''un établissement privé','Établissement / Promoteur','TO_VERIFY','Décret n°96-221 ; décret n°2008-127','TO_VERIFY',false,'Agrément','LEGAL_REVIEW'),
('MFP-EQD','MFP','Équivalence administrative de diplôme','Particulier','TO_VERIFY','Procédure DGFP publiée','TO_VERIFY',false,'PV de commission / acte de classement','LEGAL_REVIEW')
on conflict(code) do nothing;
