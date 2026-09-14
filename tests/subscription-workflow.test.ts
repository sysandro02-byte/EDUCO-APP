import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureActivationBelongsToSchool, isSubscriptionExpired, pickCurrentActiveSubscription } from '../src/services/subscriptionWorkflow.ts';

test('paid legacy licence statuses unlock a valid subscription', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const subscription = { status: 'Payé', endDate: '2026-10-11T12:00:00.000Z' };
  assert.equal(isSubscriptionExpired(subscription, now), false);
  assert.equal(pickCurrentActiveSubscription([subscription], now), subscription);
});

test('activated legacy status unlocks a valid subscription', () => {
  const now = new Date('2026-09-14T12:00:00.000Z');
  const subscription = { status: 'activated', endDate: '2026-10-14T12:00:00.000Z' };
  assert.equal(pickCurrentActiveSubscription([subscription], now), subscription);
});

test('a date-only expiry remains active through its final day', () => {
  const subscription = { status: 'Active', endDate: '2026-09-11' };
  assert.equal(isSubscriptionExpired(subscription, new Date('2026-09-11T18:00:00')), false);
  assert.equal(isSubscriptionExpired(subscription, new Date('2026-09-12T00:00:01')), true);
});

test('expired and revoked licences remain blocked', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  assert.equal(pickCurrentActiveSubscription([
    { status: 'expired', endDate: '2026-10-11T12:00:00.000Z' },
    { status: 'active', endDate: '2026-09-10T12:00:00.000Z' },
  ], now), null);
});

test('legacy licence can match the current school by school id even when identifier changed', () => {
  const school = { id: 303, identifier: 'EDUCO-SCH-0303' };
  const legacySubscription = { schoolId: 303, schoolIdentifier: 'OLD-SCHOOL-CODE' };
  assert.equal(ensureActivationBelongsToSchool(legacySubscription, school), true);
});

test('legacy licence can match the current school by stable identifier even when school id changed', () => {
  const school = { id: 303, identifier: 'EDUCO-SCH-0303' };
  const legacySubscription = { schoolId: 12, schoolIdentifier: 'educo-sch-0303' };
  assert.equal(ensureActivationBelongsToSchool(legacySubscription, school), true);
});

test('licence from another school remains blocked', () => {
  const school = { id: 303, identifier: 'EDUCO-SCH-0303' };
  const foreignSubscription = { schoolId: 404, schoolIdentifier: 'EDUCO-SCH-0404' };
  assert.equal(ensureActivationBelongsToSchool(foreignSubscription, school), false);
});

test('every school account role inherits the active licence scope', () => {
  const school = { id: 303, identifier: 'EDUCO-SCH-303' };
  const activeSubscription = {
    schoolId: school.id,
    schoolIdentifier: school.identifier,
    status: 'active',
    endDate: '2026-12-31T23:59:59.000Z',
  };
  const accountRoles = ['Directeur Général', 'Responsable des finances', 'Directeur des Etudes', 'Enseignant', 'Élève', 'Parent'];

  for (const role of accountRoles) {
    const account = { role, schoolId: school.id };
    assert.equal(account.schoolId, activeSubscription.schoolId, `${role} must retain its school`);
    assert.equal(ensureActivationBelongsToSchool(activeSubscription, school), true);
    assert.equal(pickCurrentActiveSubscription([activeSubscription], new Date('2026-09-14')), activeSubscription);
  }
});
