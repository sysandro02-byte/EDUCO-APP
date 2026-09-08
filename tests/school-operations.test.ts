import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateOperations, selectPersonalStudents, operationRoles, registerOperations } from '../server/operations';
import { registerCollections } from '../server/collections';

function database(seed: Record<string, any[]>, failTable?: string) {
  const tables = structuredClone(seed);
  return { tables, from(table: string) {
    let mode = 'read', payload: any, one = false;
    const filters: ((row: any) => boolean)[] = [];
    const query: any = {
      select() { return query; },
      eq(key: string, value: any) { filters.push(row => typeof row[key] === 'object' ? JSON.stringify(row[key]) === value : String(row[key]) === String(value)); return query; },
      is(key: string, value: any) { filters.push(row => row[key] === value); return query; },
      in(key: string, values: any[]) { filters.push(row => values.map(String).includes(String(row[key]))); return query; },
      like(key: string, value: string) { filters.push(row => String(row[key]).includes(value.replaceAll('%', ''))); return query; },
      single() { one = true; return query; }, maybeSingle() { one = true; return query; },
      insert(value: any) { mode = 'insert'; payload = value; return query; },
      update(value: any) { mode = 'update'; payload = value; return query; },
      delete() { mode = 'delete'; return query; },
      then(resolve: any, reject: any) {
        if (table === failTable && mode === 'insert') return Promise.resolve({ data: null, error: new Error('Storage unavailable') }).then(resolve, reject);
        tables[table] ||= [];
        let rows = tables[table].filter(row => filters.every(filter => filter(row)));
        if (mode === 'insert') { rows = (Array.isArray(payload) ? payload : [payload]).map((row: any, i: number) => ({ id: tables[table].length + i + 1, ...row })); tables[table].push(...rows); }
        if (mode === 'update') rows.forEach(row => Object.assign(row, structuredClone(payload)));
        if (mode === 'delete') tables[table] = tables[table].filter(row => !rows.includes(row));
        return Promise.resolve({ data: structuredClone(one ? rows[0] || null : rows), error: null }).then(resolve, reject);
      },
    };
    return query;
  }};
}

function routes(client: any, user: any) {
  const handlers = new Map<string, any>();
  const app: any = { get(path: string, ...fn: any[]) { handlers.set('GET ' + path, fn.at(-1)); }, post(path: string, ...fn: any[]) { handlers.set('POST ' + path, fn.at(-1)); } };
  registerOperations(app, () => {}, async () => user, () => client);
  registerCollections(app, () => {}, async () => user, () => client, (row: any) => row);
  return async (route: string, body = {}, params = {}) => {
    let status = 200, data: any;
    const res: any = { status(value: number) { status = value; return res; }, json(value: any) { data = value; return res; } };
    await handlers.get(route)({ body, params }, res);
    return { status, data };
  };
}

test('parent linkage requires a reliable identifier and the same school', () => {
  const user = { id: 3, schoolId: 1, role: 'Parent', name: 'Same Name', email: 'p@example.test' };
  const students = [
    { id: 10, school_id: 1, parent_email: user.email },
    { id: 11, school_id: 2, parent_email: user.email },
    { id: 12, school_id: 1, parentName: user.name },
  ];
  assert.deepEqual(selectPersonalStudents(user, students).map(s => s.id), [10]);
  assert.deepEqual(selectPersonalStudents({ id: 7, schoolId: 1, role: 'Élève' }, [{ id: 10, school_id: 1, user_id: 7 }, { id: 7, school_id: 1, user_id: 9 }]).map(s => s.id), [10]);
});

test('attendance updates one class and day without losing other dates', () => {
  const old = { attendance: [{ classId: 1, date: '2026-09-07', studentId: 10 }, { classId: 2, date: '2026-09-07', studentId: 11 }], budget: { total: 40 } };
  const next = mutateOperations(old, 'attendance', { classId: 1, date: '2026-09-07', records: [{ studentId: 10, status: 'Absent' }] });
  assert.equal(next.attendance.length, 2);
  assert.equal(next.attendance.find((a: any) => a.studentId === 10).status, 'Absent');
  assert.deepEqual(next.budget, old.budget);
  assert.equal((old.attendance[0] as any).status, undefined);
});

test('report comments are distinct by school year and edits do not duplicate them', () => {
  let data = mutateOperations({}, 'reportCardComments', { value: { studentId: 10, year: '2025', period: 'T1' } });
  data = mutateOperations(data, 'reportCardComments', { value: { studentId: 10, year: '2026', period: 'T1' } });
  data = mutateOperations(data, 'reportCardComments', { value: { studentId: 10, year: '2026', period: 'T1', teacherComment: 'Updated' } });
  assert.equal(data.reportCardComments.length, 2);
  assert.equal(data.reportCardComments[1].teacherComment, 'Updated');
});

test('legacy subjects survive additions, and deleted subjects stay deleted after reload', async () => {
  const client = database({ schools: [{ id: 1, settings: { otherSetting: true } }], subjects: [{ id: 1, school_id: 1, name: 'Maths' }], classes: [], students: [] });
  const call = routes(client, { schoolId: 1, role: 'Directeur des Etudes' });
  assert.equal((await call('POST /api/operations/:key', { value: { name: 'Français' } }, { key: 'subjects' })).status, 200);
  await call('POST /api/operations/:key', { action: 'delete', id: 1 }, { key: 'subjects' });
  const result = await call('GET /api/operations');
  assert.deepEqual(result.data.subjects.map((s: any) => s.name), ['Français']);
  assert.equal(client.tables.schools[0].settings.otherSetting, true);
});

test('parents cannot mutate school data and supervisors cannot change finance settings', async () => {
  const client = database({ schools: [{ id: 1, settings: {} }] });
  for (const role of ['Parent', 'Élève', 'Surveillant Général', 'Caissière']) {
    const result = await routes(client, { schoolId: 1, role })('POST /api/operations/:key', { value: { total: 999 } }, { key: 'budget' });
    assert.equal(result.status, 403);
  }
  assert.ok(operationRoles.attendance.includes('Surveillant Général'));
  assert.deepEqual(client.tables.schools[0].settings, {});
});

test('failed payment compensates the transaction and never reports success', async () => {
  const client = database({ students: [{ id: 10, school_id: 1, user_id: 7 }], payments: [], transactions: [] }, 'payments');
  const result = await routes(client, { schoolId: 1, id: 8, role: 'Caissière' })('POST /api/collections', { studentUserId: 7, amount: 50, receiptNumber: 'REC-1', transaction: {} });
  assert.equal(result.status, 500);
  assert.equal(client.tables.transactions.length, 0);
});

test('collection retries use the same receipt without charging twice', async () => {
  const client = database({ students: [{ id: 10, school_id: 1, user_id: 7 }], payments: [], transactions: [] });
  const call = routes(client, { schoolId: 1, id: 8, role: 'Caissière' });
  const payment = { studentUserId: 7, amount: 50, receiptNumber: 'REC-1', transaction: { description: 'Scolarité' } };
  assert.equal((await call('POST /api/collections', payment)).status, 200);
  assert.equal((await call('POST /api/collections', payment)).status, 200);
  assert.equal(client.tables.payments.length, 1);
  assert.equal(client.tables.transactions.length, 1);
  assert.equal((await call('POST /api/collections', { ...payment, amount: 60 })).status, 409);
});
