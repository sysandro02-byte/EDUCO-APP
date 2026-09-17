import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MINISTRIES,
  SCHOOL_ACCESS_OPTIONS,
  UNIVERSITY_ACCESS_OPTIONS,
  accessContextLabel,
  findInstitutionEntity,
  type InstitutionAccessContext,
} from '../src/institutional/accessConfig.ts';
import {
  buildGovernmentRoleCode,
  canRoleAccessInstitutionContext,
  isValidInstitutionAccessContext,
} from '../src/institutional/accessContext.ts';
import { getInstitutionalAccountRequestConfig } from '../src/institutional/accountRequestConfig.ts';
import { getHigherEducationFields } from '../src/institutional/higherEducationRequestConfig.ts';
import { cabinetScopeForRole } from '../server/institutionalAccountReview.ts';

test('state portal exposes MEPSA, MES and METP using sigles', () => {
  assert.deepEqual(MINISTRIES.map((ministry) => ministry.code), ['MEPSA', 'MES', 'METP']);
});

test('school and university branches expose the requested two-level choices', () => {
  assert.deepEqual(SCHOOL_ACCESS_OPTIONS.map((item) => item.code), ['GENERAL', 'TECHNICAL']);
  assert.deepEqual(UNIVERSITY_ACCESS_OPTIONS.map((item) => item.code), ['PUBLIC', 'PRIVATE']);
});

test('each ministry provides a cabinet and specialized entities', () => {
  for (const ministry of MINISTRIES) {
    assert.ok(ministry.entities.some((entity) => entity.code === 'CABINET'));
    assert.ok(ministry.entities.length > 1);
    for (const entity of ministry.entities) {
      assert.ok(entity.modules.length > 0);
      assert.ok(entity.workflows.length > 0);
    }
  }

  assert.ok(findInstitutionEntity('MEPSA', 'DEP'));
  assert.ok(findInstitutionEntity('MES', 'DSIC'));
  assert.ok(findInstitutionEntity('METP', 'DGET'));
});

test('every state entity has contextual account-request fields', () => {
  const commonFieldKeys = new Set([
    'fullName',
    'officialEmail',
    'phone',
    'employeeNumber',
    'functionTitle',
    'serviceUnit',
    'appointmentReference',
    'justification',
  ]);

  for (const ministry of MINISTRIES) {
    for (const entity of ministry.entities) {
      const context: InstitutionAccessContext = {
        sector: 'STATE',
        ministry: ministry.code,
        entity: entity.code,
        label: `${entity.shortLabel || entity.label} / ${ministry.label}`,
      };
      const config = getInstitutionalAccountRequestConfig(context);
      assert.ok(config, `${ministry.code}/${entity.code} doit avoir un formulaire de demande de compte`);
      const keys = config!.fields.map((item) => item.key);
      for (const key of commonFieldKeys) assert.ok(keys.includes(key), `${ministry.code}/${entity.code} doit contenir ${key}`);
      assert.ok(
        keys.some((key) => !commonFieldKeys.has(key)),
        `${ministry.code}/${entity.code} doit avoir au moins un champ métier spécifique`,
      );
    }
  }
});

test('public and private higher-education dossiers use distinct state-adapted fields', () => {
  const publicKeys = new Set(getHigherEducationFields('PUBLIC').map((item) => item.key));
  const privateKeys = new Set(getHigherEducationFields('PRIVATE').map((item) => item.key));

  for (const common of ['officialName', 'promoterOrInitiator', 'officialEmail', 'department', 'plannedCapacity', 'programsSummary']) {
    assert.ok(publicKeys.has(common), `Le dossier public doit contenir ${common}`);
    assert.ok(privateKeys.has(common), `Le dossier privé doit contenir ${common}`);
  }
  for (const key of ['publicInterestStudy', 'creationRationale', 'nonDuplicationAnalysis', 'statutesDraft', 'initialEndowment']) {
    assert.ok(publicKeys.has(key), `Le dossier public doit contenir ${key}`);
    assert.equal(privateKeys.has(key), false, `${key} ne doit pas être imposé comme champ privé`);
  }
  for (const key of ['legalForm', 'institutionalEvaluation', 'accreditedPrograms', 'siteLegalBasis', 'financialCapacity']) {
    assert.ok(privateKeys.has(key), `Le dossier privé doit contenir ${key}`);
  }
});

test('cabinet review scope is ministry-bound and ETAT_ADMIN remains cross-ministry', () => {
  assert.deepEqual(cabinetScopeForRole('MEPSA_CABINET'), { all: false, ministry: 'MEPSA', cabinet: true });
  assert.deepEqual(cabinetScopeForRole('MES_ADMIN'), { all: false, ministry: 'MES', cabinet: false });
  assert.deepEqual(cabinetScopeForRole('ETAT_ADMIN'), { all: true, ministry: null, cabinet: false });
  assert.equal(cabinetScopeForRole('MEPSA_DGEB'), null);
  assert.equal(cabinetScopeForRole('Directeur Général'), null);
});

test('visual selection never grants government access to an unrelated role', () => {
  const context: InstitutionAccessContext = {
    sector: 'STATE',
    ministry: 'MES',
    entity: 'DEP',
    label: 'DEP / MES',
  };

  assert.equal(buildGovernmentRoleCode(context), 'MES_DEP');
  assert.equal(canRoleAccessInstitutionContext('MES_DEP', context), true);
  assert.equal(canRoleAccessInstitutionContext('MES_ADMIN', context), true);
  assert.equal(canRoleAccessInstitutionContext('ETAT_ADMIN', context), true);
  assert.equal(canRoleAccessInstitutionContext('MEPSA_DEP', context), false);
  assert.equal(canRoleAccessInstitutionContext('Directeur Général', context), false);
  assert.equal(accessContextLabel(context), 'DEP / MES');
});

test('institutional context validation rejects tampering and unknown destinations', () => {
  assert.equal(isValidInstitutionAccessContext({
    sector: 'STATE',
    ministry: 'MES',
    entity: 'CABINET',
    label: 'CABINET / MES',
  }), true);

  assert.equal(isValidInstitutionAccessContext({
    sector: 'STATE',
    ministry: 'MES',
    entity: 'DCEG',
    label: 'DCEG / MES',
  }), false);

  assert.equal(isValidInstitutionAccessContext({
    sector: 'STATE',
    ministry: 'METP',
    entity: 'DGET',
    label: 'DGET / METP',
  }), true);

  assert.equal(isValidInstitutionAccessContext({
    sector: 'SCHOOL',
    schoolType: 'GENERAL',
    label: 'Enseignement général',
  }), true);

  assert.equal(isValidInstitutionAccessContext({
    sector: 'SCHOOL',
    schoolType: 'INVENTED',
    label: 'Invalide',
  }), false);

  assert.equal(isValidInstitutionAccessContext({
    sector: 'UNIVERSITY',
    universityType: 'PUBLIC',
    label: 'Université publique',
  }), true);

  assert.equal(isValidInstitutionAccessContext({
    sector: 'UNIVERSITY',
    universityType: 'UNKNOWN',
    label: 'Invalide',
  }), false);
});

test('role building refuses a tampered government context', () => {
  const tampered = {
    sector: 'STATE',
    ministry: 'MES',
    entity: 'DCEG',
    label: 'DCEG / MES',
  } as InstitutionAccessContext;

  assert.equal(buildGovernmentRoleCode(tampered), null);
  assert.equal(canRoleAccessInstitutionContext('MES_DCEG', tampered), false);
});
