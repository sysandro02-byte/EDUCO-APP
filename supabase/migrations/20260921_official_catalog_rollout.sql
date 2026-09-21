-- Source-backed rollout of the official administrative catalogue.
-- Official sources:
-- METP: JO 2022-44, Arrêté n°25564 du 17 octobre 2022, arts. 69-79
-- Private education commissions: Décret n°2008-127 du 23 juin 2008
-- MEPSA private general education fees/procedures: Arrêté n°8409 du 22 octobre 2010
-- MFP equivalence commission: Loi n°68-2022 du 16 août 2022 + Décret n°2024-576 du 31 juillet 2024

-- 1) Official METP private-establishment directorate as an internal, source-backed entity.
insert into public.government_organizations(code,ministry,entity,label,level,parent_id)
select
  'METP:ETABLISSEMENTS_PRIVES',
  'METP',
  'ETABLISSEMENTS_PRIVES',
  'Direction des établissements privés de l’enseignement technique et professionnel',
  'ENTITY',
  p.id
from public.government_organizations p
where p.code='METP'
on conflict (code) do update set
  label=excluded.label,
  parent_id=excluded.parent_id,
  active=true,
  updated_at=now();

-- Route the METP procedures to the directorate expressly charged with them.
update public.administrative_services
set competent_direction='ETABLISSEMENTS_PRIVES',
    competent_service='AGREMENTS',
    legal_status='VERIFIED',
    legal_reference='Arrêté n°25564 du 17 octobre 2022, articles 69 à 79 ; décret n°2008-127 du 23 juin 2008',
    legal_source_url='https://www.sgg.cg/JO/2022/congo-jo-2022-44.pdf',
    updated_at=now()
where code in ('METP-CRE','METP-OUV','METP-MOD');

-- 2) Refresh MFP equivalence legal basis with the current commission framework.
update public.administrative_services
set competent_direction=coalesce(competent_direction,'DGFP'),
    legal_status='VERIFIED',
    legal_reference='Loi n°68-2022 du 16 août 2022 ; décret n°2024-576 du 31 juillet 2024',
    legal_source_url='https://www.sgg.cg/JO/2024/congo-jo-2024-37.pdf',
    updated_at=now()
where code='MFP-EQD';

-- 3) Extend the official MEPSA private-education catalogue.
-- These procedures are textually identified by Arrêté n°8409/2010.
-- They are not automatically published and historical amounts never enable payment.
insert into public.administrative_services(
  code,ministry,competent_direction,competent_service,name,audience,
  legal_status,legal_reference,legal_source_url,
  fee_amount,fee_currency,fee_status,fee_reference,fee_source_url,
  payment_enabled,output_document,publication_status,requirements_status,
  processing_days,processing_days_status,form_version,active
)
values
 ('MEPSA-CRE','MEPSA','AGREMENTS','AGREMENTS','Autorisation de créer un établissement privé d’enseignement général','Établissements privés',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010 ; décret n°96-221 du 13 mai 1996 modifié ; décret n°2008-127 du 23 juin 2008',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Autorisation de création','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true),

 ('MEPSA-OUV','MEPSA','AGREMENTS','AGREMENTS','Autorisation d’ouvrir un établissement privé d’enseignement général','Établissements privés',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010 ; décret n°96-221 du 13 mai 1996 modifié ; décret n°2008-127 du 23 juin 2008',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Autorisation d’ouverture','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true),

 ('MEPSA-DIR','MEPSA','AGREMENTS','AGREMENTS','Autorisation de diriger un établissement privé d’enseignement général','Particuliers / établissements privés',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010 ; décret n°96-221 du 13 mai 1996 modifié',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Autorisation de diriger','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true),

 ('MEPSA-ENS','MEPSA','AGREMENTS','AGREMENTS','Autorisation d’enseigner dans un établissement privé d’enseignement général','Particuliers / enseignants',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010 ; décret n°96-221 du 13 mai 1996 modifié',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Autorisation d’enseigner','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true),

 ('MEPSA-MOD','MEPSA','AGREMENTS','AGREMENTS','Autorisation d’étendre ou de modifier un établissement privé d’enseignement général','Établissements privés',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010 ; décret n°96-221 du 13 mai 1996 modifié',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Autorisation d’extension ou de modification','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true),

 ('MEPSA-EXAM','MEPSA','EXAMENS','EXAMENS','Autorisation d’inscrire des candidats aux examens d’État','Établissements privés',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Autorisation d’inscription aux examens d’État','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true),

 ('MEPSA-TRANS','MEPSA','AGREMENTS','AGREMENTS','Autorisation de transférer un établissement privé d’enseignement général','Établissements privés',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010 ; décret n°96-221 du 13 mai 1996 modifié',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Autorisation de transfert','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true),

 ('MEPSA-REN-DIR','MEPSA','AGREMENTS','AGREMENTS','Renouvellement de l’autorisation de diriger un établissement privé d’enseignement général','Particuliers / établissements privés',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Renouvellement de l’autorisation de diriger','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true),

 ('MEPSA-REN-ENS','MEPSA','AGREMENTS','AGREMENTS','Renouvellement de l’autorisation d’enseigner dans un établissement privé d’enseignement général','Particuliers / enseignants',
  'VERIFIED','Arrêté n°8409 du 22 octobre 2010',
  'https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  null,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf',
  false,'Renouvellement de l’autorisation d’enseigner','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,true)
on conflict (code) do update set
  ministry=excluded.ministry,
  competent_direction=excluded.competent_direction,
  competent_service=excluded.competent_service,
  name=excluded.name,
  audience=excluded.audience,
  legal_status=excluded.legal_status,
  legal_reference=excluded.legal_reference,
  legal_source_url=excluded.legal_source_url,
  fee_currency=excluded.fee_currency,
  fee_status=case
    when public.administrative_services.fee_status='VERIFIED_CURRENT' then public.administrative_services.fee_status
    else excluded.fee_status
  end,
  fee_reference=coalesce(public.administrative_services.fee_reference,excluded.fee_reference),
  fee_source_url=coalesce(public.administrative_services.fee_source_url,excluded.fee_source_url),
  output_document=excluded.output_document,
  active=true,
  updated_at=now();

-- 4) Variant fee registry: historical values are recorded without being treated as current/chargeable.
create table if not exists public.administrative_service_fee_variants (
  id uuid primary key default gen_random_uuid(),
  service_code text not null references public.administrative_services(code) on delete cascade,
  variant_code text not null,
  label text not null,
  attributes jsonb not null default '{}'::jsonb,
  amount numeric not null check (amount>=0),
  currency text not null default 'XAF',
  fee_status text not null check (fee_status in ('VERIFIED_CURRENT','HISTORICAL','TO_VERIFY','FREE')),
  legal_reference text,
  source_url text,
  valid_from date,
  valid_until date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(service_code,variant_code)
);
alter table public.administrative_service_fee_variants enable row level security;
revoke all on public.administrative_service_fee_variants from anon,authenticated;

-- Arrêté n°8409/2010 historical creation/opening amounts.
insert into public.administrative_service_fee_variants(
  service_code,variant_code,label,attributes,amount,currency,fee_status,legal_reference,source_url,valid_from
)
values
 ('MEPSA-CRE','URBAN_PRESCHOOL','Zone urbaine · Préscolaire','{"zone":"URBAN","level":"PRESCHOOL"}',100000,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf','2010-10-22'),
 ('MEPSA-CRE','URBAN_PRIMARY','Zone urbaine · Primaire','{"zone":"URBAN","level":"PRIMARY"}',150000,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf','2010-10-22'),
 ('MEPSA-CRE','URBAN_LOWER_SECONDARY','Zone urbaine · Secondaire 1er cycle','{"zone":"URBAN","level":"LOWER_SECONDARY"}',200000,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf','2010-10-22'),
 ('MEPSA-CRE','URBAN_UPPER_SECONDARY','Zone urbaine · Secondaire 2e cycle','{"zone":"URBAN","level":"UPPER_SECONDARY"}',300000,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf','2010-10-22'),
 ('MEPSA-CRE','RURAL_PRESCHOOL','Zone rurale · Préscolaire','{"zone":"RURAL","level":"PRESCHOOL"}',50000,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf','2010-10-22'),
 ('MEPSA-CRE','RURAL_PRIMARY','Zone rurale · Primaire','{"zone":"RURAL","level":"PRIMARY"}',75000,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf','2010-10-22'),
 ('MEPSA-CRE','RURAL_LOWER_SECONDARY','Zone rurale · Secondaire 1er cycle','{"zone":"RURAL","level":"LOWER_SECONDARY"}',100000,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf','2010-10-22'),
 ('MEPSA-CRE','RURAL_UPPER_SECONDARY','Zone rurale · Secondaire 2e cycle','{"zone":"RURAL","level":"UPPER_SECONDARY"}',150000,'XAF','HISTORICAL','Arrêté n°8409 du 22 octobre 2010','https://www.sgg.cg/JO/2010/congo-jo-2010-43.pdf','2010-10-22')
on conflict (service_code,variant_code) do update set
  label=excluded.label,attributes=excluded.attributes,amount=excluded.amount,currency=excluded.currency,
  fee_status=excluded.fee_status,legal_reference=excluded.legal_reference,source_url=excluded.source_url,
  valid_from=excluded.valid_from,active=true,updated_at=now();

-- Mirror creation variants to opening because the source expressly treats them as distinct files with the same schedule.
insert into public.administrative_service_fee_variants(
  service_code,variant_code,label,attributes,amount,currency,fee_status,legal_reference,source_url,valid_from
)
select
  'MEPSA-OUV',variant_code,label,attributes,amount,currency,fee_status,legal_reference,source_url,valid_from
from public.administrative_service_fee_variants
where service_code='MEPSA-CRE'
on conflict (service_code,variant_code) do update set
  label=excluded.label,attributes=excluded.attributes,amount=excluded.amount,currency=excluded.currency,
  fee_status=excluded.fee_status,legal_reference=excluded.legal_reference,source_url=excluded.source_url,
  valid_from=excluded.valid_from,active=true,updated_at=now();

create or replace function private.list_administrative_service_fee_variants_secure(p_service_code text)
returns table(
  variant_code text,label text,attributes jsonb,amount numeric,currency text,fee_status text,
  legal_reference text,source_url text,valid_from date,valid_until date
)
language sql
security definer
set search_path=''
stable
as $$
  select f.variant_code,f.label,f.attributes,f.amount,f.currency,f.fee_status,
         f.legal_reference,f.source_url,f.valid_from,f.valid_until
  from public.administrative_service_fee_variants f
  where f.service_code=p_service_code and f.active
  order by f.label
$$;
revoke all on function private.list_administrative_service_fee_variants_secure(text) from public,anon;
grant execute on function private.list_administrative_service_fee_variants_secure(text) to authenticated;

create or replace function public.list_administrative_service_fee_variants(p_service_code text)
returns table(
  variant_code text,label text,attributes jsonb,amount numeric,currency text,fee_status text,
  legal_reference text,source_url text,valid_from date,valid_until date
)
language sql
security invoker
set search_path=''
stable
as $$ select * from private.list_administrative_service_fee_variants_secure(p_service_code) $$;
revoke all on function public.list_administrative_service_fee_variants(text) from public,anon;
grant execute on function public.list_administrative_service_fee_variants(text) to authenticated;
