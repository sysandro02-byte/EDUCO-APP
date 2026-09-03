import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildIssuedSubscriptionStatus,
  calculateSubscriptionEndDate,
  ensureActivationBelongsToSchool,
  getSubscriptionMonthlyRate,
  normalizeSubscriptionPlan,
  pickCurrentActiveSubscription,
} from '../src/services/subscriptionWorkflow.ts';

test('renewal code stays isolated to its school until the school activates it', () => {
  const schoolA = { id: 101, identifier: 'educo-sch-a' };
  const schoolB = { id: 202, identifier: 'EDUCO-SCH-B' };
  const request = {
    id: 1,
    schoolId: schoolA.id,
    schoolIdentifier: schoolA.identifier,
    schoolName: 'Complexe A',
    promoterName: 'Promoteur A',
    promoterContact: 'promoteur-a@example.com',
    requestedPlan: 'ai_premium',
    requestedMonths: 3,
    status: 'pending',
  };

  const issuedAt = new Date('2026-09-03T10:00:00.000Z');
  const generatedSubscription = {
    code: 'EDUCO-AI-2026-TEST-FLOW',
    schoolId: request.schoolId,
    schoolIdentifier: request.schoolIdentifier,
    schoolName: request.schoolName,
    promoterName: request.promoterName,
    promoterContact: request.promoterContact,
    planType: normalizeSubscriptionPlan(request.requestedPlan),
    amountPaid: getSubscriptionMonthlyRate(request.requestedPlan) * request.requestedMonths,
    months: request.requestedMonths,
    status: buildIssuedSubscriptionStatus(),
    startDate: issuedAt,
    endDate: calculateSubscriptionEndDate(issuedAt, request.requestedMonths),
  };

  assert.equal(generatedSubscription.status, 'pending');
  assert.equal(generatedSubscription.amountPaid, 60000);
  assert.equal(pickCurrentActiveSubscription([generatedSubscription], issuedAt), null);
  assert.equal(ensureActivationBelongsToSchool(generatedSubscription, schoolB), false);
  assert.equal(ensureActivationBelongsToSchool(generatedSubscription, schoolA), true);

  const activatedAt = new Date('2026-09-04T08:30:00.000Z');
  const activatedSubscription = {
    ...generatedSubscription,
    status: 'active',
    startDate: activatedAt,
    endDate: calculateSubscriptionEndDate(activatedAt, generatedSubscription.months),
  };

  assert.equal(pickCurrentActiveSubscription([generatedSubscription, activatedSubscription], activatedAt), activatedSubscription);
  assert.equal(activatedSubscription.endDate.toISOString(), '2026-12-03T08:30:00.000Z');
});
