import type { Express } from 'express';
import {
  buildSchoolAcronym,
  buildStudentMatricule,
  canonicalizeRole,
  normalizeAccountStatus,
  normalizeEmail,
} from '../src/services/userAccountWorkflow.ts';

const STUDENT_ROLES = new Set(['Élève']);
const CREATOR_ROLES = new Set([
  'Admin',
  'Co-admin',
  'Promoteur',
  'Directeur Général',
  'Directeur des Etudes',
  'Directeur du Primaire',
  'Responsable des finances',
  'Caissière',
]);

const cleanPhone = (value: unknown) => String(value || '').replace(/[^0-9+]/g, '');
const isDuplicateError = (error: any) => error?.code === '23505' || /duplicate|unique|already exists/i.test(error?.message || '');

const mapStudentUser = (user: any, student: any, classRow: any) => ({
  id: user.id,
  uid: user.uid,
  schoolId: user.school_id ?? null,
  licenseSchoolId: user.school_id ?? null,
  name: user.name,
  email: user.email,
  phone: user.phone || '',
  contact: user.phone || '',
  role: canonicalizeRole(user.role),
  avatar: user.avatar,
  status: normalizeAccountStatus(user.status),
  createdAt: user.created_at,
  studentId: student.student_id,
  matricule: student.student_id,
  classId: student.class_id,
  class: classRow?.name || '',
  parentName: student.parent_name || '',
  parentPhone: student.parent_phone || '',
  address: student.address || '',
  dob: student.date_of_birth || '',
});

export function registerStudentEnrollment(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.post('/api/enrollments/students', requireAuth, async (req: any, res) => {
    const client = getClient(req);
    let createdAuthUid: string | null = null;
    let createdUserId: number | null = null;

    try {
      const actor = await getUser(req);
      const actorRole = canonicalizeRole(actor?.role);
      if (!actor || !CREATOR_ROLES.has(actorRole)) {
        return res.status(403).json({ error: 'Vous n’êtes pas autorisé à inscrire un élève.' });
      }
      if (!client?.auth?.admin) {
        return res.status(503).json({ error: 'Service d’inscription indisponible.' });
      }

      const requestedRole = canonicalizeRole(req.body?.role || 'Élève');
      if (!STUDENT_ROLES.has(requestedRole)) {
        return res.status(400).json({ error: 'Ce parcours est réservé à l’inscription des élèves.' });
      }

      const requestedSchoolId = Number(req.body?.schoolId || req.body?.school_id || 0);
      const isCentralAdmin = actorRole === 'Admin' || actorRole === 'Co-admin';
      const schoolId = isCentralAdmin && Number.isInteger(requestedSchoolId) && requestedSchoolId > 0
        ? requestedSchoolId
        : Number(actor.schoolId || actor.school_id || 0);
      if (!schoolId) return res.status(403).json({ error: 'Aucun établissement associé à cette inscription.' });

      const name = String(req.body?.name || '').trim();
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.tempPassword || req.body?.password || '');
      const phone = cleanPhone(req.body?.phone || req.body?.contact);
      if (!name) return res.status(400).json({ error: 'Le nom complet de l’élève est obligatoire.' });
      if (!email) return res.status(400).json({ error: 'Une adresse e-mail de connexion valide est obligatoire.' });
      if (password.length < 6) return res.status(400).json({ error: 'Le mot de passe initial doit contenir au moins 6 caractères.' });
      if (phone && phone.length < 7) return res.status(400).json({ error: 'Le numéro de téléphone principal est invalide.' });

      const { data: school, error: schoolError } = await client
        .from('schools')
        .select('id,name,identifier')
        .eq('id', schoolId)
        .maybeSingle();
      if (schoolError) throw schoolError;
      if (!school) return res.status(404).json({ error: 'Établissement introuvable.' });

      let classRow: any = null;
      const classId = Number(req.body?.classId || req.body?.class_id || 0);
      const className = String(req.body?.class || '').trim();
      if (classId > 0) {
        const result = await client.from('classes').select('id,name,school_id').eq('id', classId).eq('school_id', schoolId).maybeSingle();
        if (result.error) throw result.error;
        classRow = result.data;
      } else if (className) {
        const result = await client.from('classes').select('id,name,school_id').eq('school_id', schoolId).ilike('name', className).limit(1).maybeSingle();
        if (result.error) throw result.error;
        classRow = result.data;
      }
      if (!classRow) return res.status(400).json({ error: 'Sélectionnez une classe valide appartenant à cet établissement.' });

      const schoolAcronym = buildSchoolAcronym(school.name || school.identifier || 'EDUCO');
      const requestedMatricule = String(req.body?.studentId || req.body?.matricule || '').trim();
      const scopedMatricule = requestedMatricule.toUpperCase().startsWith(`${schoolAcronym}-`)
        ? requestedMatricule
        : '';

      const { data: existingEmail, error: emailError } = await client.from('users').select('id').ilike('email', email).limit(1).maybeSingle();
      if (emailError) throw emailError;
      if (existingEmail?.id) return res.status(409).json({ error: `L’adresse e-mail ${email} est déjà associée à un compte.` });

      if (phone) {
        const { data: existingPhone, error: phoneError } = await client.from('users').select('id').eq('phone_normalized', phone).limit(1).maybeSingle();
        if (phoneError) throw phoneError;
        if (existingPhone?.id) return res.status(409).json({ error: 'Ce numéro de téléphone est déjà associé à un autre compte.' });
      }

      if (scopedMatricule) {
        const { data: existingStudent, error: matriculeError } = await client.from('students').select('id').eq('student_id', scopedMatricule).limit(1).maybeSingle();
        if (matriculeError) throw matriculeError;
        if (existingStudent?.id) return res.status(409).json({ error: 'Ce matricule élève est déjà utilisé.' });
      }

      const { data: authResult, error: authError } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: 'Élève', schoolId },
      });
      if (authError || !authResult?.user?.id) {
        if (isDuplicateError(authError)) return res.status(409).json({ error: `L’adresse e-mail ${email} est déjà associée à un compte.` });
        throw authError || new Error('Impossible de créer l’identité de connexion de l’élève.');
      }
      createdAuthUid = authResult.user.id;

      const userPayload: any = {
        uid: createdAuthUid,
        school_id: schoolId,
        name,
        email,
        phone: phone || null,
        role: 'Élève',
        status: req.body?.status === 'Inactif' ? 'inactive' : 'active',
        ...(req.body?.avatar !== undefined && { avatar: req.body.avatar }),
      };
      const userInsert = await client.from('users').insert([userPayload]).select('*').single();
      if (userInsert.error || !userInsert.data) {
        if (isDuplicateError(userInsert.error)) {
          const message = /phone/i.test(userInsert.error?.message || '')
            ? 'Ce numéro de téléphone est déjà associé à un autre compte.'
            : `L’adresse e-mail ${email} est déjà associée à un compte.`;
          throw Object.assign(new Error(message), { status: 409 });
        }
        throw userInsert.error || new Error('Impossible de créer le profil de l’élève.');
      }
      createdUserId = Number(userInsert.data.id);

      const matricule = scopedMatricule || buildStudentMatricule({ schoolAcronym, idOrSeed: createdUserId });
      const studentPayload = {
        user_id: createdUserId,
        school_id: schoolId,
        student_id: matricule,
        class_id: classRow.id,
        parent_name: req.body?.parentName || req.body?.guardian || req.body?.parentTuteur || '',
        parent_phone: req.body?.parentPhone || req.body?.guardianPhone || req.body?.fatherPhone || req.body?.motherPhone || '',
        address: req.body?.address || '',
        date_of_birth: req.body?.dob || req.body?.dateOfBirth || '',
        enrollment_date: new Date().toISOString(),
        status: req.body?.status === 'Inactif' ? 'inactive' : 'active',
      };
      const studentInsert = await client.from('students').insert([studentPayload]).select('*').single();
      if (studentInsert.error || !studentInsert.data) {
        if (isDuplicateError(studentInsert.error)) {
          throw Object.assign(new Error('Ce matricule élève est déjà utilisé.'), { status: 409 });
        }
        throw studentInsert.error || new Error('Impossible de créer le dossier scolaire de l’élève.');
      }

      return res.status(201).json(mapStudentUser(userInsert.data, studentInsert.data, classRow));
    } catch (error: any) {
      // Roll back both data layers when a later enrollment step fails. This
      // prevents orphaned Auth identities and half-created student accounts.
      try {
        if (createdUserId && client) await client.from('users').delete().eq('id', createdUserId).throwOnError();
      } catch (rollbackUserError) {
        console.error('Student enrollment profile rollback failed:', rollbackUserError);
      }
      try {
        if (createdAuthUid && client?.auth?.admin) await client.auth.admin.deleteUser(createdAuthUid);
      } catch (rollbackAuthError) {
        console.error('Student enrollment Auth rollback failed:', rollbackAuthError);
      }
      const status = Number(error?.status) || (isDuplicateError(error) ? 409 : 500);
      return res.status(status).json({ error: error?.message || 'Impossible de finaliser l’inscription de l’élève.' });
    }
  });
}
