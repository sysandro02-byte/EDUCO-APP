import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudentPaymentLedger } from '../src/services/cashierWorkflow.ts';

test('RAF and cashier payment ledger supports registration, renewal payment, and receipt data', () => {
  const ledger = buildStudentPaymentLedger({
    schoolId: 7,
    users: [
      { id: 10, role: 'Élève', name: 'Grace Mbemba', student_id: 'MAT-2026-010', class: '6e A', school_id: 7 },
      { id: 20, role: 'Caissière', name: 'Caisse A', school_id: 7 },
      { id: 30, role: 'Responsable des finances', name: 'RAF A', school_id: 7 },
    ],
    students: [
      { id: 101, user_id: 10, student_id: 'MAT-2026-010', class: '6e A', school_id: 7 },
    ],
    fees: [
      { id: 1, class: '6e A', type: 'Scolarité', amount: 75000 },
      { id: 2, class: '6e A', type: 'Inscription', amount: 25000 },
    ],
    payments: [
      { id: 1001, student_id: 101, amount: 25000, payment_method: 'Espèce' },
      { id: 1002, student_id: 101, amount: 30000, payment_method: 'Mobile Money' },
    ],
  });

  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].id, 10);
  assert.equal(ledger[0].studentRecordId, 101);
  assert.equal(ledger[0].studentId, 'MAT-2026-010');
  assert.equal(ledger[0].name, 'Grace Mbemba');
  assert.equal(ledger[0].class, '6e A');
  assert.equal(ledger[0].totalFees, 100000);
  assert.equal(ledger[0].amountPaid, 55000);
  assert.equal(ledger[0].totalFees - ledger[0].amountPaid, 45000);
});
