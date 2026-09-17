import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';
import { getCashierSettingsForUser } from './operations.ts';

const salaryRoles = new Set(['Caissière', 'Responsable des finances', 'Directeur Général', 'Promoteur']);
const collectionRoles = new Set(['Caissière', 'Responsable des finances', 'Directeur Général', 'Promoteur', 'Admin', 'Co-admin']);
const allowedSalaryMethods = new Set(['Espèce', 'Espèces', 'Mobile Money', 'Virement', 'Chèque']);
const allowedCollectionMethods = new Set(['Espèce', 'Espèces', 'Mobile Money', 'Virement', 'Chèque']);
const salaryPeriodPattern = /^(Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)\s+20\d{2}$/;

const isRegistrationCollection = (description: unknown) => /\b(réinscription|reinscription|inscription)\b/i.test(String(description || ''));

const cashierMethodEnabled = (cashier: any, paymentMethod: string) => {
  const methods = cashier?.paymentMethods || {};
  if (paymentMethod === 'Espèce' || paymentMethod === 'Espèces') return methods.cash !== false;
  if (paymentMethod === 'Mobile Money') return methods.mobileMoney === true;
  if (paymentMethod === 'Virement') return methods.transfer === true;
  return false;
};

const enforceDailyCashierLimit = async (client: any, user: any, cashier: any) => {
  const maxDailyActions = Number(cashier?.limits?.maxDailyActions || 0);
  if (!(maxDailyActions > 0)) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { count, error } = await client
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', user.schoolId)
    .eq('recorded_by', user.id)
    .gte('date', start.toISOString())
    .lt('date', end.toISOString());
  if (error) throw error;
  return Number(count || 0) >= maxDailyActions ? maxDailyActions : null;
};

export function registerCollections(app: Express, requireAuth: any, getUser: any, getClient: any, mapTransaction: any) {
  app.post('/api/collections', requireAuth, async (req, res) => {
    try {
      const user = await getUser(req);
      const role = canonicalizeRole(user?.role || '');
      if (!user?.schoolId || !collectionRoles.has(role)) return res.status(403).json({ error: 'Encaissement non autorisé.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });

      const amount = Number(req.body.amount);
      const receipt = String(req.body.receiptNumber || '').trim();
      const paymentMethod = String(req.body.paymentMethod || 'Espèce').trim();
      const tx = req.body.transaction || {};
      if (!Number.isFinite(amount) || amount <= 0 || !/^[a-zA-Z0-9_-]{1,120}$/.test(receipt)) {
        return res.status(400).json({ error: 'Montant ou référence de reçu invalide.' });
      }
      if (!allowedCollectionMethods.has(paymentMethod)) {
        return res.status(400).json({ error: 'Mode de paiement invalide.' });
      }

      if (role === 'Caissière') {
        const cashier = await getCashierSettingsForUser(client, user);
        if (cashier.permissions.allowStudentPayment !== true) {
          return res.status(403).json({ error: "Le RAF ou le DG n'a pas autorisé les paiements d'écolage." });
        }
        if (isRegistrationCollection(tx.description) && cashier.permissions.allowRegistration !== true) {
          return res.status(403).json({ error: "Le RAF ou le DG n'a pas autorisé les inscriptions ou réinscriptions." });
        }
        if (!cashierMethodEnabled(cashier, paymentMethod)) {
          return res.status(403).json({ error: 'Ce mode de paiement n’est pas autorisé pour cette caisse.' });
        }
        const ceiling = Number(cashier.limits?.maxUnitRevenue || 0);
        if (ceiling > 0 && amount > ceiling) {
          return res.status(403).json({ error: `Montant supérieur au plafond d'encaissement autorisé (${ceiling}).` });
        }
        const dailyLimit = await enforceDailyCashierLimit(client, user, cashier);
        if (dailyLimit) {
          return res.status(403).json({ error: `Limite quotidienne de caisse atteinte (${dailyLimit} opérations).` });
        }
      }

      const studentUserId = Number(req.body.studentUserId || 0);
      if (!Number.isSafeInteger(studentUserId) || studentUserId <= 0) {
        return res.status(400).json({ error: 'Élève invalide.' });
      }
      const { data: student, error: studentError } = await client
        .from('students')
        .select('id')
        .eq('school_id', user.schoolId)
        .eq('user_id', studentUserId)
        .maybeSingle();
      if (studentError) throw studentError;
      if (!student) return res.status(400).json({ error: 'Le dossier élève doit être enregistré avant le paiement.' });

      const { data: existing, error: lookupError } = await client
        .from('payments')
        .select('*')
        .eq('school_id', user.schoolId)
        .eq('receipt_number', receipt)
        .maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        if (Number(existing.student_id) !== Number(student.id) || Number(existing.amount) !== amount) {
          return res.status(409).json({ error: 'Cette référence appartient à un autre paiement.' });
        }
        const { data: transaction, error } = await client
          .from('transactions')
          .select('*')
          .eq('school_id', user.schoolId)
          .like('description', `%[${receipt}]%`)
          .single();
        if (error) throw error;
        return res.json({ success: true, transaction: { ...mapTransaction(transaction), paymentMethod: existing.payment_method || paymentMethod } });
      }

      const now = new Date().toISOString();
      const { data: transaction, error: txError } = await client
        .from('transactions')
        .insert({
          school_id: user.schoolId,
          type: 'Revenu',
          amount,
          description: `(Status: En attente) [${receipt}] ${String(tx.description || '').slice(0, 500)}`,
          category: String(tx.category || 'Scolarité').slice(0, 120),
          date: now,
          recorded_by: user.id,
        })
        .select('*')
        .single();
      if (txError) throw txError;

      const { error: paymentError } = await client.from('payments').insert({
        school_id: user.schoolId,
        student_id: student.id,
        amount,
        payment_date: now,
        receipt_number: receipt,
        payment_method: paymentMethod,
        status: 'paid',
      });
      if (paymentError) {
        const rollback = await client.from('transactions').delete().eq('id', transaction.id).eq('school_id', user.schoolId);
        if (rollback.error) {
          throw new Error(`Paiement refusé. La transaction ${transaction.id} doit être rapprochée par le RAF : ${rollback.error.message}`);
        }
        if (paymentError.code === '23505') {
          return res.status(409).json({ error: 'Cette référence de reçu existe déjà dans cet établissement.' });
        }
        throw paymentError;
      }
      return res.json({ success: true, transaction: { ...mapTransaction(transaction), paymentMethod } });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Encaissement impossible.' });
    }
  });

  const createSalaryTransaction = async (req: any, res: any, input: { personnelId?: number; employeeName?: string; salaryPeriod: string; paymentMethod?: string; notes?: string }) => {
    const user = await getUser(req);
    const role = canonicalizeRole(user?.role || '');
    if (!user?.schoolId || !salaryRoles.has(role)) return res.status(403).json({ error: 'Paiement de salaire non autorisé.' });
    const client = getClient(req);
    if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
    let cashier: any = null;
    if (role === 'Caissière') {
      cashier = await getCashierSettingsForUser(client, user);
      if (cashier.permissions.allowSalaryPayment !== true) return res.status(403).json({ error: "Le RAF ou le DG n'a pas autorisé le paiement des salaires." });
      const dailyLimit = await enforceDailyCashierLimit(client, user, cashier);
      if (dailyLimit) return res.status(403).json({ error: `Limite quotidienne de caisse atteinte (${dailyLimit} opérations).` });
    }
    const salaryPeriod = String(input.salaryPeriod || '').trim();
    const paymentMethod = String(input.paymentMethod || 'Espèce').trim();
    if (!salaryPeriodPattern.test(salaryPeriod)) return res.status(400).json({ error: 'Période salariale invalide.' });
    if (!allowedSalaryMethods.has(paymentMethod)) return res.status(400).json({ error: 'Mode de paiement invalide.' });
    let employeeQuery = client.from('personnel').select('id,name,base_salary,salary,school_id').eq('school_id', user.schoolId);
    if (Number.isSafeInteger(input.personnelId) && Number(input.personnelId) > 0) employeeQuery = employeeQuery.eq('id', input.personnelId);
    else if (input.employeeName) employeeQuery = employeeQuery.eq('name', input.employeeName);
    else return res.status(400).json({ error: 'Personnel invalide.' });
    const { data: employees, error: employeeError } = await employeeQuery.limit(2);
    if (employeeError) throw employeeError;
    if (!employees?.length) return res.status(404).json({ error: 'Personnel introuvable dans cet établissement.' });
    if (employees.length !== 1) return res.status(409).json({ error: 'Nom de personnel ambigu. Utilisez le dossier personnel identifié.' });
    const employee = employees[0];
    const contractualSalary = Number(employee.base_salary ?? employee.salary ?? 0);
    if (!Number.isFinite(contractualSalary) || contractualSalary <= 0) return res.status(409).json({ error: 'Le salaire contractuel doit être défini avant le paiement.' });
    if (role === 'Caissière') {
      const ceiling = Number(cashier?.limits?.maxUnitExpense || 0);
      if (ceiling > 0 && contractualSalary > ceiling) return res.status(403).json({ error: `Salaire supérieur au plafond de décaissement autorisé (${ceiling}).` });
    }
    const marker = `[SALARY:${employee.id}:${salaryPeriod}]`;
    const { data: duplicate, error: duplicateError } = await client.from('transactions').select('id').eq('school_id', user.schoolId).like('description', `%${marker}%`).limit(1);
    if (duplicateError) throw duplicateError;
    if (duplicate?.length) return res.status(409).json({ error: 'Un paiement existe déjà pour ce personnel et cette période.' });
    const notes = String(input.notes || '').trim().slice(0, 500);
    const description = `(Status: En attente) ${marker} Salaire - ${String(employee.name || `Personnel #${employee.id}`)} (${salaryPeriod})${notes ? ` — ${notes}` : ''}`;
    const { data: transaction, error: transactionError } = await client.from('transactions').insert({ school_id: user.schoolId, type: 'Dépense', category: 'Salaires', amount: contractualSalary, description, date: new Date().toISOString(), recorded_by: user.id }).select('*').single();
    if (transactionError) throw transactionError;
    return res.json({ ...mapTransaction(transaction), paymentMethod, salaryPeriod, personnelId: employee.id, authoritativeAmount: contractualSalary });
  };

  app.post('/api/transactions', requireAuth, async (req, res, next) => {
    if (String(req.body?.category || '') !== 'Salaires') return next();
    try {
      const description = String(req.body?.description || '');
      const match = description.match(/^Salaire\s*-\s*(.+?)\s*\(([^()]+)\)\s*$/i);
      if (!match) return res.status(400).json({ error: 'Référence salariale invalide.' });
      return await createSalaryTransaction(req, res, { employeeName: match[1].trim(), salaryPeriod: match[2].trim(), paymentMethod: req.body?.paymentMethod, notes: req.body?.notes });
    } catch (error: any) { return res.status(500).json({ error: error?.message || 'Paiement de salaire impossible.' }); }
  });
  app.post('/api/salaries/pay', requireAuth, async (req, res) => {
    try { return await createSalaryTransaction(req, res, { personnelId: Number(req.body?.personnelId), salaryPeriod: req.body?.salaryPeriod, paymentMethod: req.body?.paymentMethod, notes: req.body?.notes }); }
    catch (error: any) { return res.status(500).json({ error: error?.message || 'Paiement de salaire impossible.' }); }
  });
}
