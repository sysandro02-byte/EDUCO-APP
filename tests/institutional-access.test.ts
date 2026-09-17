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

  // Une direction MEPSA ne peut pas être injectée sous le MES.
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
