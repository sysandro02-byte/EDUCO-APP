
-- Final go-live pricing model: fixed or variant fees with immutable application snapshots.
-- MES source: Loi n°77-2022 du 27 décembre 2022 (LF 2023), official SGG PDF.
-- Legal currentness check performed 2026-09-21 against SGG corpus; no replacement of this fee schedule identified.

alter table public.administrative_services
  add column if not exists fee_mode text not null default 'UNVERIFIED',
  add column if not exists fee_verified_at timestamptz,
  add column if not exists fee_verification_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='administrative_services_fee_mode_check'
  ) then
    alter table public.administrative_services
      add constraint administrative_services_fee_mode_check
      check (fee_mode in ('FIXED','VARIANT','FREE','UNVERIFIED'));
  end if;
end $$;

update public.administrative_services
set fee_mode=case
  when fee_status='FREE' then 'FREE'
  when fee_status='VERIFIED_CURRENT' and fee_amount is not null then 'FIXED'
  else 'UNVERIFIED'
end
where fee_mode='UNVERIFIED';

alter table public.administrative_service_fee_variants
  add column if not exists verified_at timestamptz,
  add column if not exists verification_note text;

alter table public.administrative_applications
  add column if not exists fee_variant_code text,
  add column if not exists fee_reference_snapshot text,
  add column if not exists fee_source_url_snapshot text,
  add column if not exists fee_verified_at_snapshot timestamptz;

create index if not exists administrative_applications_fee_variant_idx
  on public.administrative_applications(service_code,fee_variant_code)
  where fee_variant_code is not null;

create or replace function private.resolve_administrative_fee_secure(
  p_service_code text,
  p_form_data jsonb default '{}'::jsonb
)
returns table(
  fee_variant_code text,
  amount numeric,
  currency text,
  fee_reference text,
  fee_source_url text,
  verified_at timestamptz
)
language plpgsql
security definer
set search_path=''
stable
as $$
declare
  s public.administrative_services;
  requested_variant text:=nullif(trim(coalesce(p_form_data->>'fee_variant_code','')),'');
  variant_count integer;
begin
  select * into s
  from public.administrative_services
  where code=p_service_code;

  if s.code is null then raise exception 'Démarche introuvable'; end if;
  if s.fee_status<>'VERIFIED_CURRENT' then
    raise exception 'Tarif courant non vérifié';
  end if;

  if s.fee_mode='FIXED' then
    if s.fee_amount is null
       or nullif(trim(coalesce(s.fee_reference,'')),'') is null
       or nullif(trim(coalesce(s.fee_source_url,'')),'') is null
       or s.fee_verified_at is null then
      raise exception 'Tarif fixe incomplet ou non vérifié';
    end if;
    return query
      select null::text,s.fee_amount,upper(s.fee_currency),
             s.fee_reference,s.fee_source_url,s.fee_verified_at;
    return;
  end if;

  if s.fee_mode<>'VARIANT' then
    raise exception 'Cette démarche ne possède pas de tarif payable';
  end if;

  select count(*) into variant_count
  from public.administrative_service_fee_variants f
  where f.service_code=s.code
    and f.active
    and f.fee_status='VERIFIED_CURRENT'
    and f.verified_at is not null
    and nullif(trim(coalesce(f.legal_reference,'')),'') is not null
    and nullif(trim(coalesce(f.source_url,'')),'') is not null
    and (f.valid_from is null or f.valid_from<=current_date)
    and (f.valid_until is null or f.valid_until>=current_date);

  if variant_count=0 then raise exception 'Aucun barème courant vérifié'; end if;

  if requested_variant is null and variant_count=1 then
    select f.variant_code into requested_variant
    from public.administrative_service_fee_variants f
    where f.service_code=s.code
      and f.active and f.fee_status='VERIFIED_CURRENT'
      and f.verified_at is not null
      and (f.valid_from is null or f.valid_from<=current_date)
      and (f.valid_until is null or f.valid_until>=current_date)
    limit 1;
  end if;

  if requested_variant is null then
    raise exception 'Sélectionnez le cycle ou barème applicable';
  end if;

  return query
    select f.variant_code,f.amount,upper(f.currency),
           f.legal_reference,f.source_url,f.verified_at
    from public.administrative_service_fee_variants f
    where f.service_code=s.code
      and f.variant_code=requested_variant
      and f.active
      and f.fee_status='VERIFIED_CURRENT'
      and f.verified_at is not null
      and nullif(trim(coalesce(f.legal_reference,'')),'') is not null
      and nullif(trim(coalesce(f.source_url,'')),'') is not null
      and (f.valid_from is null or f.valid_from<=current_date)
      and (f.valid_until is null or f.valid_until>=current_date)
    limit 1;

  if not found then
    raise exception 'Barème sélectionné invalide, expiré ou non vérifié';
  end if;
end $$;
revoke all on function private.resolve_administrative_fee_secure(text,jsonb) from public,anon,authenticated;

-- Official MES service catalogue.
insert into public.administrative_services(
  code,ministry,competent_direction,competent_service,name,audience,
  legal_status,legal_reference,legal_source_url,
  fee_amount,fee_currency,fee_status,fee_reference,fee_source_url,
  payment_enabled,output_document,publication_status,requirements_status,
  processing_days,processing_days_status,form_version,
  fee_mode,fee_verified_at,fee_verification_note
)
values
('MES-DEP-AGR','MES','DGES','AGREMENTS','Dépôt de dossier de demande d’agrément d’un établissement privé d’enseignement supérieur','Établissements privés',
 'VERIFIED','Loi n°77-2022 du 27 décembre 2022, titre relatif aux frais d’étude, article 4',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 250000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 4',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 false,'Quittance / récépissé de dépôt','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,
 'FIXED',now(),'Contrôle SGG effectué le 2026-09-21 ; aucun remplacement du barème identifié dans les textes 2024-2026 consultés.'),

('MES-REN-AGR','MES','DGES','AGREMENTS','Renouvellement de l’agrément d’un établissement privé d’enseignement supérieur','Établissements privés',
 'VERIFIED','Loi n°77-2022 du 27 décembre 2022, article 7',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 null,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 7',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 false,'Renouvellement d’agrément','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,
 'VARIANT',now(),'Contrôle SGG effectué le 2026-09-21 ; barème par cycle.'),

('MES-REOUV','MES','DGES','AGREMENTS','Autorisation de réouverture d’un établissement privé d’enseignement supérieur','Établissements privés',
 'VERIFIED','Loi n°77-2022 du 27 décembre 2022, article 8',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 null,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 8',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 false,'Autorisation de réouverture','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,
 'VARIANT',now(),'Contrôle SGG effectué le 2026-09-21 ; barème par cycle.'),

('MES-MOD','MES','DGES','AGREMENTS','Modification des infrastructures, statuts ou types de formation d’un établissement privé d’enseignement supérieur','Établissements privés',
 'VERIFIED','Loi n°77-2022 du 27 décembre 2022, article 9',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 null,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 9',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 false,'Autorisation de modification','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,
 'VARIANT',now(),'Contrôle SGG effectué le 2026-09-21 ; barème par cycle.'),

('MES-TRANS-EXT','MES','DGES','AGREMENTS','Transfert ou extension d’un établissement privé d’enseignement supérieur','Établissements privés',
 'VERIFIED','Loi n°77-2022 du 27 décembre 2022, article 10',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 null,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 10',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 false,'Autorisation de transfert ou d’extension','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,
 'VARIANT',now(),'Contrôle SGG effectué le 2026-09-21 ; barème par cycle.'),

('MES-DIR','MES','DGES','AGREMENTS','Autorisation de diriger un établissement privé d’enseignement supérieur','Particuliers / responsables d’établissement',
 'VERIFIED','Loi n°77-2022 du 27 décembre 2022, articles 11 et 15',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 null,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 11 et 15',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 false,'Autorisation de diriger','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,
 'VARIANT',now(),'Le cycle le plus élevé couvre les cycles inférieurs conformément à l’article 15.'),

('MES-REN-DIR','MES','DGES','AGREMENTS','Renouvellement de l’autorisation de diriger un établissement privé d’enseignement supérieur','Particuliers / responsables d’établissement',
 'VERIFIED','Loi n°77-2022 du 27 décembre 2022, articles 12 et 15',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 null,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 12 et 15',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 false,'Renouvellement de l’autorisation de diriger','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,
 'VARIANT',now(),'Le cycle le plus élevé couvre les cycles inférieurs conformément à l’article 15.'),

('MES-ENS','MES','DGES','AGREMENTS','Autorisation d’enseigner dans un établissement privé d’enseignement supérieur','Particuliers / enseignants',
 'VERIFIED','Loi n°77-2022 du 27 décembre 2022, articles 13 et 15',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 null,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 13 et 15',
 'https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
 false,'Autorisation d’enseigner','LEGAL_REVIEW','TO_VERIFY',null,'TO_VERIFY',1,
 'VARIANT',now(),'Le cycle le plus élevé couvre les cycles inférieurs conformément à l’article 15.')
on conflict(code) do update set
  ministry=excluded.ministry,
  competent_direction=excluded.competent_direction,
  competent_service=excluded.competent_service,
  name=excluded.name,
  audience=excluded.audience,
  legal_status=excluded.legal_status,
  legal_reference=excluded.legal_reference,
  legal_source_url=excluded.legal_source_url,
  fee_amount=excluded.fee_amount,
  fee_currency=excluded.fee_currency,
  fee_status=excluded.fee_status,
  fee_reference=excluded.fee_reference,
  fee_source_url=excluded.fee_source_url,
  output_document=excluded.output_document,
  fee_mode=excluded.fee_mode,
  fee_verified_at=excluded.fee_verified_at,
  fee_verification_note=excluded.fee_verification_note,
  updated_at=now();

update public.administrative_services set
  competent_direction='DGES',
  competent_service='AGREMENTS',
  legal_status='VERIFIED',
  legal_reference='Arrêté n°7060 du 8 juin 2023 ; loi n°77-2022 du 27 décembre 2022, article 5',
  legal_source_url='https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
  fee_mode='FIXED',
  fee_status='VERIFIED_CURRENT',
  fee_amount=850000,
  fee_currency='XAF',
  fee_reference='Loi n°77-2022 du 27 décembre 2022, article 5',
  fee_source_url='https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
  fee_verified_at=now(),
  fee_verification_note='Contrôle SGG effectué le 2026-09-21 ; montant identique pour les trois cycles.',
  payment_enabled=false,
  updated_at=now()
where code='MES-CRE';

update public.administrative_services set
  competent_direction='DGES',
  competent_service='AGREMENTS',
  legal_status='VERIFIED',
  legal_reference='Arrêté n°7061 du 8 juin 2023 ; loi n°77-2022 du 27 décembre 2022, article 6',
  legal_source_url='https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
  fee_mode='VARIANT',
  fee_status='VERIFIED_CURRENT',
  fee_amount=null,
  fee_currency='XAF',
  fee_reference='Loi n°77-2022 du 27 décembre 2022, article 6',
  fee_source_url='https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
  fee_verified_at=now(),
  fee_verification_note='Contrôle SGG effectué le 2026-09-21 ; montant variable selon le cycle.',
  payment_enabled=false,
  updated_at=now()
where code='MES-OUV';

update public.administrative_services set
  competent_direction='DGES',
  competent_service='AGREMENTS',
  legal_status='VERIFIED',
  legal_reference='Loi n°77-2022 du 27 décembre 2022, article 14',
  legal_source_url='https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
  fee_mode='VARIANT',
  fee_status='VERIFIED_CURRENT',
  fee_amount=null,
  fee_currency='XAF',
  fee_reference='Loi n°77-2022 du 27 décembre 2022, article 14',
  fee_source_url='https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf',
  fee_verified_at=now(),
  fee_verification_note='Contrôle SGG effectué le 2026-09-21 ; montant variable selon le cycle.',
  payment_enabled=false,
  updated_at=now()
where code='MES-REN-ENS';

-- Cycle-based verified schedules.
insert into public.administrative_service_fee_variants(
  service_code,variant_code,label,attributes,amount,currency,fee_status,
  legal_reference,source_url,valid_from,active,verified_at,verification_note
)
values
('MES-OUV','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',650000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 6','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-OUV','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',550000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 6','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-OUV','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',450000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 6','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),

('MES-REN-AGR','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',200000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 7','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-REN-AGR','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',240000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 7','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-REN-AGR','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',280000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 7','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),

('MES-REOUV','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',1350000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 8','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-REOUV','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',1200000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 8','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-REOUV','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',1050000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 8','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),

('MES-MOD','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',260000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 9','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-MOD','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',220000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 9','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-MOD','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',160000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 9','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),

('MES-TRANS-EXT','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',280000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 10','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-TRANS-EXT','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',240000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 10','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-TRANS-EXT','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',200000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 10','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),

('MES-DIR','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',50000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 11 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Le cycle le plus élevé couvre les cycles inférieurs.'),
('MES-DIR','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',60000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 11 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Le cycle le plus élevé couvre les cycles inférieurs.'),
('MES-DIR','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',70000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 11 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Le cycle le plus élevé couvre les cycles inférieurs.'),

('MES-REN-DIR','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',25000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 12 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-REN-DIR','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',35500,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 12 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-REN-DIR','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',50000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 12 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),

('MES-ENS','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',15000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 13 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Le cycle le plus élevé couvre les cycles inférieurs.'),
('MES-ENS','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',20000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 13 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Le cycle le plus élevé couvre les cycles inférieurs.'),
('MES-ENS','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',25000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, articles 13 et 15','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Le cycle le plus élevé couvre les cycles inférieurs.'),

('MES-REN-ENS','CYCLE_1','Premier cycle (Licence)','{"cycle":"LICENCE","cycle_order":1}',10000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 14','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-REN-ENS','CYCLE_2','Deuxième cycle (Master)','{"cycle":"MASTER","cycle_order":2}',15000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 14','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21'),
('MES-REN-ENS','CYCLE_3','Troisième cycle (Doctorat)','{"cycle":"DOCTORAT","cycle_order":3}',20000,'XAF','VERIFIED_CURRENT','Loi n°77-2022 du 27 décembre 2022, article 14','https://www.sgg.cg/textes-officiels/lois/2022/congo-loi-2022-77.pdf','2023-01-01',true,now(),'Contrôle SGG 2026-09-21')
on conflict(service_code,variant_code) do update set
  label=excluded.label,
  attributes=excluded.attributes,
  amount=excluded.amount,
  currency=excluded.currency,
  fee_status=excluded.fee_status,
  legal_reference=excluded.legal_reference,
  source_url=excluded.source_url,
  valid_from=excluded.valid_from,
  valid_until=null,
  active=true,
  verified_at=excluded.verified_at,
  verification_note=excluded.verification_note,
  updated_at=now();

-- Submission validates the selected current variant before a dossier can enter the official workflow.
create or replace function private.submit_administrative_application_secure(p_id uuid)
returns public.administrative_applications
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.administrative_applications;
  s public.administrative_services;
  missing_field text;
  missing_document text;
  resolved record;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;

  select * into a
  from public.administrative_applications
  where id=p_id and applicant_uid=auth.uid()
  for update;
  if a.id is null or a.status<>'DRAFT' then raise exception 'Dossier introuvable ou non soumissible'; end if;

  select * into s from public.administrative_services where code=a.service_code;
  if s.code is null then raise exception 'Démarche introuvable'; end if;

  if s.publication_status<>'PUBLISHED' or s.legal_status<>'VERIFIED' or s.requirements_status<>'VERIFIED' then
    raise exception 'Cette démarche est encore en validation juridique et ne peut pas être soumise officiellement';
  end if;

  if s.fee_status='VERIFIED_CURRENT' and s.fee_mode in ('FIXED','VARIANT') then
    select * into resolved from private.resolve_administrative_fee_secure(a.service_code,a.form_data);
    if resolved.amount is null then raise exception 'Tarif applicable introuvable'; end if;
  end if;

  select f.label into missing_field
  from public.administrative_service_form_fields f
  where f.service_code=a.service_code
    and f.active and f.required and f.verified
    and (
      not (a.form_data ? f.field_key)
      or nullif(trim(coalesce(a.form_data->>f.field_key,'')),'') is null
    )
  order by f.sort_order
  limit 1;
  if missing_field is not null then raise exception 'Champ obligatoire manquant : %',missing_field; end if;

  select d.label into missing_document
  from public.administrative_service_required_documents d
  where d.service_code=a.service_code
    and d.active and d.required and d.verified
    and not exists(
      select 1 from public.administrative_application_files af
      where af.application_id=a.id and af.document_code=d.document_code
    )
  order by d.sort_order
  limit 1;
  if missing_document is not null then raise exception 'Pièce obligatoire manquante : %',missing_document; end if;

  update public.administrative_applications
  set status='SUBMITTED',submitted_at=now(),updated_at=now()
  where id=a.id
  returning * into a;

  insert into public.administrative_application_events(application_id,action,from_status,to_status,note)
  values(a.id,'SUBMIT','DRAFT','SUBMITTED','Dossier soumis après validation du catalogue et du barème applicable');

  return a;
end $$;
revoke all on function private.submit_administrative_application_secure(uuid) from public,anon;
grant execute on function private.submit_administrative_application_secure(uuid) to authenticated;

-- Server-side LoukaPay intent compares the immutable approved snapshot with the still-current official fee.
create or replace function private.create_administrative_payment_intent_server_secure(
  p_application_id uuid,
  p_provider_code text,
  p_applicant_uid uuid
)
returns public.administrative_payment_transactions
language plpgsql
security definer
set search_path=''
as $$
declare
  a public.administrative_applications;
  s public.administrative_services;
  p public.administrative_payment_providers;
  t public.administrative_payment_transactions;
  resolved record;
begin
  if current_user<>'service_role' then raise exception 'Service fournisseur requis'; end if;
  if p_applicant_uid is null then raise exception 'Identité demandeur requise'; end if;

  select * into a
  from public.administrative_applications
  where id=p_application_id and applicant_uid=p_applicant_uid
  for update;
  if a.id is null then raise exception 'Dossier introuvable'; end if;
  if a.status<>'PAYMENT_DUE' then raise exception 'Ce dossier n’est pas en attente de paiement'; end if;

  select * into s from public.administrative_services where code=a.service_code;
  if s.code is null or not s.payment_enabled
     or s.fee_status<>'VERIFIED_CURRENT'
     or s.publication_status<>'PUBLISHED'
     or s.legal_status<>'VERIFIED'
     or s.requirements_status<>'VERIFIED' then
    raise exception 'Paiement bloqué : la démarche ou son tarif n’est pas officiellement validé';
  end if;

  select * into resolved from private.resolve_administrative_fee_secure(a.service_code,a.form_data);

  if a.payment_amount is distinct from resolved.amount
     or upper(coalesce(a.payment_currency,''))<>upper(resolved.currency)
     or a.fee_variant_code is distinct from resolved.fee_variant_code
     or a.fee_reference_snapshot is distinct from resolved.fee_reference
     or a.fee_source_url_snapshot is distinct from resolved.fee_source_url then
    raise exception 'Le barème officiel a changé depuis l’approbation : nouvelle validation requise';
  end if;

  select * into p
  from public.administrative_payment_providers
  where code=upper(trim(p_provider_code))
    and active and config_status='READY'
  for share;
  if p.code is null then raise exception 'Canal de paiement officiel indisponible'; end if;
  if upper(p.currency)<>upper(resolved.currency) then
    raise exception 'Devise non prise en charge par ce canal';
  end if;

  select * into t
  from public.administrative_payment_transactions
  where application_id=a.id and status='PENDING'
  order by initiated_at desc limit 1;

  if t.id is not null then
    if t.provider_code<>p.code or t.amount<>a.payment_amount
       or upper(t.currency)<>upper(a.payment_currency) then
      raise exception 'Une transaction incompatible est déjà en attente';
    end if;
    return t;
  end if;

  insert into public.administrative_payment_transactions(
    application_id,applicant_uid,provider_code,amount,currency
  ) values(
    a.id,a.applicant_uid,p.code,a.payment_amount,a.payment_currency
  ) returning * into t;

  insert into public.administrative_application_events(
    application_id,actor_uid,action,from_status,to_status,note
  ) values(
    a.id,p_applicant_uid,'PAYMENT_INTENT',a.status,a.status,t.internal_reference
  );

  return t;
end $$;
revoke all on function private.create_administrative_payment_intent_server_secure(uuid,text,uuid)
from public,anon,authenticated;
grant execute on function private.create_administrative_payment_intent_server_secure(uuid,text,uuid)
to service_role;
