import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const collections = fs.readFileSync(new URL('../server/collections.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../supabase/migrations/20260917_harden_payment_integrity.sql', import.meta.url), 'utf8');

test('student collections have an explicit role and school boundary', () => {
  assert.match(collections, /collectionRoles/);
  assert.match(collections, /!user\?\.schoolId \|\| !collectionRoles\.has\(role\)/);
  assert.match(collections, /\.eq\('school_id', user\.schoolId\)/);
  assert.match(collections, /\.eq\('user_id', studentUserId\)/);
});

test('cashier permissions, unit ceiling and daily action limit are server enforced', () => {
  assert.match(collections, /allowStudentPayment !== true/);
  assert.match(collections, /allowRegistration !== true/);
  assert.match(collections, /maxUnitRevenue/);
  assert.match(collections, /maxDailyActions/);
  assert.match(collections, /recorded_by/);
  assert.match(collections, /Limite quotidienne de caisse atteinte/);
});

test('cashier payment methods are checked against configured methods', () => {
  assert.match(collections, /cashierMethodEnabled/);
  assert.match(collections, /methods\.cash !== false/);
  assert.match(collections, /methods\.mobileMoney === true/);
  assert.match(collections, /methods\.transfer === true/);
  assert.match(collections, /Ce mode de paiement n’est pas autorisé pour cette caisse/);
});

test('collection references are idempotent and payment write is rolled back safely', () => {
  assert.match(collections, /receipt_number', receipt/);
  assert.match(collections, /Cette référence appartient à un autre paiement/);
  assert.match(collections, /transactions'\)\.delete\(\)\.eq\('id', transaction\.id\)/);
  assert.match(collections, /paymentError\.code === '23505'/);
});

test('database enforces positive amounts and school-scoped unique receipt numbers', () => {
  assert.match(migration, /payments_amount_positive_check/);
  assert.match(migration, /amount is null or amount > 0/i);
  assert.match(migration, /payments_school_receipt_unique_idx/);
  assert.match(migration, /\(school_id, receipt_number\)/);
});

test('salary operations share the cashier daily-action boundary', () => {
  const salarySection = collections.slice(collections.indexOf('const createSalaryTransaction'));
  assert.match(salarySection, /allowSalaryPayment !== true/);
  assert.match(salarySection, /enforceDailyCashierLimit/);
  assert.match(salarySection, /maxUnitExpense/);
});
