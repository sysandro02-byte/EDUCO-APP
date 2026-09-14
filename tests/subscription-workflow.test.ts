import assert from 'node:assert/strict';
import test from 'node:test';
import { ensureActivationBelongsToSchool, isSubscriptionExpired, pickCurrentActiveSubscription } from '../src/services/subscriptionWorkflow.ts';

test('paid legacy licence statuses unlock a valid subscription', () => {
  const now = new Date('2026-09-11T12:00:00.000Z');
  const subscription = { status: 'Payé', endDate: '2026-10-11T12:00:00.000Z' };
  assert.equal(isSubscriptionExpired(subscription, now), false);
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
