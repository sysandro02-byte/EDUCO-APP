import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../server/collections.ts', import.meta.url), 'utf8');

test('salary payment uses a dedicated authenticated server endpoint', () => {
  assert.match(source, /app\.post\('\/api\/salaries\/pay', requireAuth/);
  assert.match(source, /salaryRoles\.has/);
});

test('salary ownership and amount are derived from the authenticated school record', () => {
  assert.match(source, /\.eq\('school_id', user\.schoolId\)/);
  assert.match(source, /employee\.base_salary \?\? employee\.salary/);
  assert.match(source, /amount: contractualSalary/);
  assert.doesNotMatch(source, /amount:\s*Number\(req\.body\?\.netAmount/);
});

test('salary period is validated and duplicate payroll is rejected server-side', () => {
  assert.match(source, /salaryPeriodPattern\.test\(salaryPeriod\)/);
  assert.match(source, /\[SALARY:\$\{personnelId\}:\$\{salaryPeriod\}\]/);
  assert.match(source, /Un paiement existe déjà/);
});
