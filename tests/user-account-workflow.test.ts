import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDuplicateEmailMessage,
  buildSchoolAcronym,
  buildStaffMatricule,
  buildStudentMatricule,
  canDeleteAccount,
  canonicalizeRole,
  getAccountCreationKind,
  normalizeAccountStatus,
  makeStudentTechnicalEmail,
  normalizeEmail,
} from '../src/services/userAccountWorkflow.ts';
import { mutateOperations, operationRoles } from '../server/operations.ts';

test('account creation workflow separates roles and enforces a single normalized email identity', () => {
  assert.equal(normalizeEmail('  Promoteur@Educo.CG '), 'promoteur@educo.cg');
  assert.match(
    buildDuplicateEmailMessage('  Promoteur@Educo.CG '),
    /promoteur@educo\.cg/,
  );

  assert.equal(getAccountCreationKind('Élève'), 'student');
  assert.equal(getAccountCreationKind('Enseignant'), 'teacher');
  assert.equal(getAccountCreationKind('Caissière'), 'staff');
  assert.equal(getAccountCreationKind('Parent'), 'parent');
  assert.equal(getAccountCreationKind('Parent d’élève'), 'parent');

  assert.equal(normalizeAccountStatus('active'), 'Actif');
  assert.equal(normalizeAccountStatus('Actif'), 'Actif');
  assert.equal(normalizeAccountStatus('inactive'), 'Inactif');
  assert.equal(normalizeAccountStatus('suspended'), 'Suspendu');
  assert.equal(canonicalizeRole('Caissier'), 'Caissière');
  assert.equal(canonicalizeRole('RAF'), 'Responsable des finances');
  assert.equal(canonicalizeRole('DE'), 'Directeur des Etudes');
  assert.equal(canonicalizeRole('Professeur'), 'Enseignant');
  assert.equal(buildSchoolAcronym('Groupe Scolaire Mboté Talents'), 'GSMT');
  assert.equal(
    buildStudentMatricule({ schoolAcronym: 'Groupe Scolaire Mboté Talents', idOrSeed: 456 }),
    `GSMT-ELV-${new Date().getFullYear()}-00456`,
  );

  const studentEmail = makeStudentTechnicalEmail({
    name: 'Ada Lovelace',
    studentId: 'MAT 2026/001',
    schoolId: 42,
  });
  assert.equal(studentEmail, 'ada.lovelace.42.mat-2026-001@eleves.educo.local');

  assert.match(
    buildStaffMatricule({ schoolAcronym: 'Louka Tech', role: 'Enseignant', idOrSeed: 123 }),
    /^LT-ENS-\d{4}-00123$/,
  );
  assert.match(
    buildStaffMatricule({ schoolAcronym: 'Louka Tech', role: 'Responsable des finances', idOrSeed: 987 }),
    /^LT-PER-\d{4}-00987$/,
  );
});

test('account deletion permissions restrict the DE to teachers and students', () => {
  assert.equal(canDeleteAccount('DE', 'Enseignant'), true);
  assert.equal(canDeleteAccount('Directeur des Etudes', 'Élève'), true);
  assert.equal(canDeleteAccount('DE', 'Parent'), false);
  assert.equal(canDeleteAccount('DE', 'Responsable des finances'), false);
  assert.equal(canDeleteAccount('RAF', 'Parent'), true);
  assert.equal(canDeleteAccount('Directeur Général', 'Enseignant'), true);
  assert.equal(canDeleteAccount('Promoteur', 'Admin'), false);
  assert.equal(canDeleteAccount('Enseignant', 'Élève'), false);
});

test('school operations persist settings and collection entries consistently', () => {
  assert.ok(operationRoles.rafSettings.includes('Responsable des finances'));

  const savedSettings = mutateOperations({}, 'rafSettings', {
    value: { alerts: { approvalThresholdAmount: 50000 } },
  });
  assert.deepEqual(savedSettings.rafSettings, { alerts: { approvalThresholdAmount: 50000 } });

  const savedEvents = mutateOperations({ financialEvents: [] }, 'financialEvents', {
    value: { title: 'Échéance scolarité', start: '2026-09-30' },
  });
  assert.equal(savedEvents.financialEvents.length, 1);
  assert.equal(savedEvents.financialEvents[0].title, 'Échéance scolarité');

  const afterDelete = mutateOperations(savedEvents, 'financialEvents', {
    action: 'delete',
    id: savedEvents.financialEvents[0].id,
  });
  assert.equal(afterDelete.financialEvents.length, 0);
});
