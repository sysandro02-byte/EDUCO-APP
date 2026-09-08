import type { Express } from 'express';

export function registerCollections(app: Express, requireAuth: any, getUser: any, getClient: any, mapTransaction: any) {
  app.post('/api/collections', requireAuth, async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user?.schoolId || !['Caissière', 'Responsable des finances', 'Directeur Général', 'Promoteur'].includes(user.role)) return res.status(403).json({ error: 'Encaissement non autorisé.' });
      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });
      const amount = Number(req.body.amount);
      const receipt = String(req.body.receiptNumber || '');
      if (!Number.isFinite(amount) || amount <= 0 || !/^[a-zA-Z0-9_-]{1,120}$/.test(receipt)) return res.status(400).json({ error: 'Montant ou référence de reçu invalide.' });
      const { data: student, error: studentError } = await client.from('students').select('id').eq('school_id', user.schoolId).eq('user_id', req.body.studentUserId).maybeSingle();
      if (studentError) throw studentError;
      if (!student) return res.status(400).json({ error: 'Le dossier élève doit être enregistré avant le paiement.' });
      const { data: existing, error: lookupError } = await client.from('payments').select('*').eq('school_id', user.schoolId).eq('receipt_number', receipt).maybeSingle();
      if (lookupError) throw lookupError;
      if (existing) {
        if (Number(existing.student_id) !== Number(student.id) || Number(existing.amount) !== amount) return res.status(409).json({ error: 'Cette référence appartient à un autre paiement.' });
        const { data: transaction, error } = await client.from('transactions').select('*').eq('school_id', user.schoolId).like('description', `%[${receipt}]%`).single();
        if (error) throw error;
        return res.json({ success: true, transaction: mapTransaction(transaction) });
      }
      const tx = req.body.transaction || {};
      const { data: transaction, error: txError } = await client.from('transactions').insert({
        school_id: user.schoolId, type: 'Revenu', amount,
        description: `(Status: En attente) [${receipt}] ${String(tx.description || '')}`,
        category: tx.category || 'Scolarité', date: new Date().toISOString(), recorded_by: user.id,
      }).select('*').single();
      if (txError) throw txError;
      const { error: paymentError } = await client.from('payments').insert({
        school_id: user.schoolId, student_id: student.id, amount,
        receipt_number: receipt, payment_method: req.body.paymentMethod || 'Espèce', status: 'paid',
      });
      if (paymentError) {
        // Compensate a rejected payment so it cannot inflate the cash journal.
        const rollback = await client.from('transactions').delete().eq('id', transaction.id).eq('school_id', user.schoolId);
        if (rollback.error) throw new Error(`Paiement refusé. La transaction ${transaction.id} doit être rapprochée par le RAF : ${rollback.error.message}`);
        throw paymentError;
      }
      res.json({ success: true, transaction: { ...mapTransaction(transaction), paymentMethod: req.body.paymentMethod } });
    } catch (error: any) { res.status(500).json({ error: error.message }); }
  });
}
