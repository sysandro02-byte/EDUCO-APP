import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';

const GRADE_WRITER_ROLES = new Set([
  'Promoteur',
  'Directeur Général',
  'Directeur des Etudes',
  'Directeur du Primaire',
  'Enseignant',
]);

const includesTeacher = (value: unknown, teacherId: number) => {
  if (!Array.isArray(value) || value.length === 0) return true;
  return value.some((id) => Number(id) === Number(teacherId));
};

/**
 * Pre-validates grade mutations before the legacy /api/grades handler runs.
 * It calls next() on success so the existing persistence path remains the
 * single writer for the grades table.
 */
export function registerGradeMutationGuard(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.post('/api/grades', requireAuth, async (req: any, res, next) => {
    try {
      const actor = await getUser(req);
      const role = canonicalizeRole(actor?.role);
      if (!actor?.schoolId || !GRADE_WRITER_ROLES.has(role)) {
        return res.status(403).json({ error: 'Vous n’êtes pas autorisé à saisir ou modifier des notes.' });
      }

      const score = Number(req.body?.score);
      if (!Number.isFinite(score) || score < 0 || score > 20) {
        return res.status(400).json({ error: 'La note doit être comprise entre 0 et 20.' });
      }

      const subjectName = String(req.body?.subject || '').trim();
      if (!subjectName) {
        return res.status(400).json({ error: 'La matière est obligatoire.' });
      }

      const client = getClient(req);
      if (!client) return res.status(503).json({ error: 'Supabase non configuré.' });

      const { data: subject, error: subjectError } = await client
        .from('subjects')
        .select('id,name,teacher_ids,school_id')
        .eq('school_id', actor.schoolId)
        .ilike('name', subjectName)
        .limit(1)
        .maybeSingle();
      if (subjectError) throw subjectError;
      if (!subject) {
        return res.status(400).json({ error: 'Cette matière n’existe pas dans cet établissement.' });
      }

      if (role === 'Enseignant' && !includesTeacher(subject.teacher_ids, Number(actor.id))) {
        return res.status(403).json({ error: 'Cette matière ne vous est pas affectée.' });
      }

      return next();
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Impossible de vérifier la saisie de note.' });
    }
  });
}
