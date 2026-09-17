import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { ROLE_NAV_ITEMS } from '../constants.ts';
import {
  canManageAttendance,
  canManageFinance,
  canonicalizeRole,
} from '../src/services/userAccountWorkflow.ts';
import { operationRoles } from '../server/operations.ts';

const labelsFor = (role: string) => (ROLE_NAV_ITEMS[role] || []).map((item) => item.label);

test('school registration migration durably materializes selected classes', () => {
  const migration = readFileSync(
    new URL('../supabase/migrations/20260917_sync_school_selected_classes.sql', import.meta.url),
    'utf8',
  );

  assert.match(migration, /classes_school_name_unique_idx/);
  assert.match(migration, /sync_school_selected_classes/);
  assert.match(migration, /AFTER INSERT OR UPDATE OF levels ON public\.schools/);
  assert.match(migration, /ON CONFLICT DO NOTHING/);
  assert.match(migration, /secondaireCollege/);
  assert.match(migration, /secondaireLycee/);
  assert.match(migration, /UPDATE public\.schools\s+SET levels = levels/s);
});

test('management role aliases resolve to the canonical EDUCO roles', () => {
  assert.equal(canonicalizeRole('DG'), 'Directeur Général');
  assert.equal(canonicalizeRole('DE'), 'Directeur des Etudes');
  assert.equal(canonicalizeRole('Directeur primaire'), 'Directeur du Primaire');
  assert.equal(canonicalizeRole('DP'), 'Directeur du Primaire');
  assert.equal(canonicalizeRole('RAF'), 'Responsable des finances');
  assert.equal(canonicalizeRole('Surveillant'), 'Surveillant Général');
  assert.equal(canonicalizeRole('SG'), 'Surveillant Général');
  assert.equal(canonicalizeRole('Surveillant adjoint'), 'Surveillant Général Adjoint');
  assert.equal(canonicalizeRole('SGA'), 'Surveillant Général Adjoint');
});

test('direction and surveillance accounts expose the workflows their API permissions already allow', () => {
  for (const role of ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Directeur du Primaire', 'Surveillant Général', 'Surveillant Général Adjoint']) {
    assert.equal(canManageAttendance(role), true, `${role} should manage attendance`);
    assert.ok(operationRoles.attendance.includes(role), `${role} should be accepted by attendance API`);
    assert.ok(labelsFor(role).includes('Présences'), `${role} should see Présences in navigation`);
  }

  assert.ok(labelsFor('Directeur Général').includes('Validation Opérations'));
  assert.ok(labelsFor('Responsable des finances').includes('Validation Opérations'));
  assert.ok(labelsFor('Directeur Général').includes('Utilisateurs & Comptes'));
  assert.ok(labelsFor('Responsable des finances').includes('Utilisateurs & Comptes'));
});

test('finance capabilities stay scoped to RAF and the authorized direction chain', () => {
  for (const role of ['Promoteur', 'Directeur Général', 'Responsable des finances']) {
    assert.equal(canManageFinance(role), true);
    assert.ok(operationRoles.budget.includes(role));
    assert.ok(operationRoles.rafSettings.includes(role));
  }

  for (const role of ['Directeur des Etudes', 'Directeur du Primaire', 'Surveillant Général', 'Surveillant Général Adjoint']) {
    assert.equal(canManageFinance(role), false);
    assert.ok(!operationRoles.budget.includes(role));
  }
});
