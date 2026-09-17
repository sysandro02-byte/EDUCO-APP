import type { Express } from 'express';
import { canonicalizeRole } from '../src/services/userAccountWorkflow.ts';

const DOCUMENT_MANAGERS = new Set(['Directeur Général', 'Directeur des Etudes']);
const CASHIER_ROLE = 'Caissière';
const REPORT_TYPES = new Set(['report_flash', 'report_start', 'report_term', 'report_year_end']);
const BULLETIN_TERMS = ['1er trimestre', '2e trimestre', '3e trimestre'];
const MAX_NARRATIVE_LENGTH = 5000;

const same = (a: unknown, b: unknown) => a != null && b != null && String(a) === String(b);
const asNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const cleanText = (value: unknown, max = MAX_NARRATIVE_LENGTH) => String(value || '').trim().slice(0, max);
const normalize = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

function canonicalTerm(value: unknown) {
  const raw = normalize(value);
  if (!raw) return '';
  if (/^(t?1|1er|1ere|premier)/.test(raw) || raw.includes('trimestre 1') || raw.includes('1er trimestre')) return 'T1';
  if (/^(t?2|2e|2eme|deuxieme)/.test(raw) || raw.includes('trimestre 2') || raw.includes('2e trimestre')) return 'T2';
  if (/^(t?3|3e|3eme|troisieme)/.test(raw) || raw.includes('trimestre 3') || raw.includes('3e trimestre')) return 'T3';
  return raw;
}

function detectCycle(schoolClass: any) {
  const text = normalize(`${schoolClass?.level || ''} ${schoolClass?.name || ''}`);
  if (/\b(cp1|cp2|ce1|ce2|cm1|cm2|primaire)\b/.test(text)) return 'primaire';
  if (/\b(6e|6eme|5e|5eme|4e|4eme|3e|3eme|college)\b/.test(text)) return 'college';
  if (/\b(2nde|seconde|1ere|premiere|tle|terminale|lycee)\b/.test(text)) return 'lycee';
  return 'secondaire';
}

function appreciationFor(score20: number | null) {
  if (score20 == null || !Number.isFinite(score20)) return 'Non évalué';
  if (score20 >= 16) return 'Très bien';
  if (score20 >= 14) return 'Bien';
  if (score20 >= 12) return 'Assez bien';
  if (score20 >= 10) return 'Passable';
  return 'À renforcer';
}

function normalizedGrade20(grade: any) {
  const score = asNumber(grade?.score);
  const maxScore = asNumber(grade?.max_score ?? grade?.maxScore ?? 20) || 20;
  return Math.max(0, Math.min(20, (score / maxScore) * 20));
}

function academicYearBounds(academicYear: string) {
  const match = String(academicYear || '').match(/(20\d{2})\D+(20\d{2})/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  return {
    start: `${startYear}-08-01`,
    end: `${endYear}-07-31`,
  };
}

function inAcademicYear(dateValue: unknown, academicYear: string) {
  const bounds = academicYearBounds(academicYear);
  if (!bounds || !dateValue) return true;
  const date = String(dateValue).slice(0, 10);
  return date >= bounds.start && date <= bounds.end;
}

async function getContext(req: any, getUser: any, getClient: any) {
  const actor = await getUser(req);
  if (!actor?.schoolId) throw Object.assign(new Error('Aucun établissement associé au compte.'), { status: 403 });
  const client = getClient(req);
  if (!client) throw Object.assign(new Error('Supabase non configuré.'), { status: 503 });
  const { data: school, error } = await client.from('schools').select('*').eq('id', actor.schoolId).maybeSingle();
  if (error) throw error;
  if (!school) throw Object.assign(new Error('Établissement introuvable.'), { status: 404 });
  return { actor, client, school };
}

function assertManager(actor: any) {
  const role = canonicalizeRole(actor?.role);
  if (!DOCUMENT_MANAGERS.has(role)) {
    throw Object.assign(new Error('Seuls le Directeur Général et le Directeur des Études peuvent générer ou valider ces documents.'), { status: 403 });
  }
  return role;
}

function assertCashier(actor: any) {
  const role = canonicalizeRole(actor?.role);
  if (role !== CASHIER_ROLE) {
    throw Object.assign(new Error('Cette action est réservée à la caissière.'), { status: 403 });
  }
}

async function audit(client: any, actor: any, action: string, details: string) {
  try {
    await client.from('activity_logs').insert({
      school_id: actor.schoolId,
      user_name: actor.name || actor.email || 'Utilisateur',
      user_role: canonicalizeRole(actor.role),
      user_email: actor.email || null,
      action,
      details,
      page: 'Documents scolaires',
    });
  } catch {
    // Audit must never block the protected business operation.
  }
}

async function fetchAcademicData(client: any, schoolId: number) {
  const [classesRes, studentsRes, usersRes, subjectsRes, personnelRes] = await Promise.all([
    client.from('classes').select('*').eq('school_id', schoolId),
    client.from('students').select('*').eq('school_id', schoolId),
    client.from('users').select('*').eq('school_id', schoolId),
    client.from('subjects').select('*').eq('school_id', schoolId),
    client.from('personnel').select('*').eq('school_id', schoolId),
  ]);
  for (const result of [classesRes, studentsRes, usersRes, subjectsRes, personnelRes]) {
    if (result.error) throw result.error;
  }
  const classes = classesRes.data || [];
  const students = studentsRes.data || [];
  const classIds = classes.map((row: any) => row.id).filter(Boolean);
  const gradeRes = classIds.length
    ? await client.from('grades').select('*').in('class_id', classIds)
    : { data: [], error: null };
  const attendanceRes = classIds.length
    ? await client.from('attendance').select('*').in('class_id', classIds)
    : { data: [], error: null };
  if (gradeRes.error) throw gradeRes.error;
  if (attendanceRes.error) throw attendanceRes.error;
  return {
    classes,
    students,
    users: usersRes.data || [],
    subjects: subjectsRes.data || [],
    personnel: personnelRes.data || [],
    grades: gradeRes.data || [],
    attendance: attendanceRes.data || [],
  };
}

function schoolSnapshot(school: any) {
  const settings = school?.settings?.schoolSettings || school?.settings?.operations?.schoolSettings || {};
  return {
    id: school.id,
    name: school.name || settings.name || 'Établissement',
    address: school.address || settings.address || '',
    contact: school.phone || settings.contact || '',
    email: school.email || settings.email || '',
    logo: school.logo || settings.logo || '',
    identifier: school.identifier || '',
  };
}

function userForStudent(student: any, users: any[]) {
  return users.find((user: any) => same(user.id, student.user_id ?? student.userId));
}

function studentLabel(student: any, users: any[]) {
  const user = userForStudent(student, users);
  return {
    id: student.id,
    userId: student.user_id ?? student.userId,
    name: user?.name || student.name || `Élève #${student.id}`,
    matricule: student.student_id ?? student.studentId ?? user?.student_id ?? '',
    dateOfBirth: student.date_of_birth ?? student.dateOfBirth ?? '',
    parentName: student.parent_name ?? student.parentName ?? '',
  };
}

function filterGradesForTerm(grades: any[], requestedTerm: string) {
  const tagged = grades.some((grade: any) => canonicalTerm(grade.term ?? grade.assignment));
  if (!tagged) return grades;
  const target = canonicalTerm(requestedTerm);
  return grades.filter((grade: any) => canonicalTerm(grade.term ?? grade.assignment) === target);
}

function buildClassBulletins(data: any, school: any, classId: number, term: string, academicYear: string, onlyStudentId?: number) {
  const schoolClass = data.classes.find((row: any) => same(row.id, classId));
  if (!schoolClass) throw Object.assign(new Error('Classe introuvable dans cet établissement.'), { status: 404 });
  const cycle = detectCycle(schoolClass);
  const displayScale = cycle === 'primaire' ? 10 : 20;
  const classStudents = data.students.filter((row: any) => same(row.class_id ?? row.classId, classId));
  const subjectMap = new Map(data.subjects.map((subject: any) => [String(subject.id), subject]));
  const classGrades = filterGradesForTerm(
    data.grades.filter((grade: any) => same(grade.class_id ?? grade.classId, classId)),
    term,
  );
  const classAttendance = data.attendance.filter((row: any) =>
    same(row.class_id ?? row.classId, classId) && inAcademicYear(row.date, academicYear));

  const metrics = classStudents.map((student: any) => {
    const candidateIds = [student.id, student.user_id ?? student.userId].filter(Boolean);
    const studentGrades = classGrades.filter((grade: any) => candidateIds.some((id) => same(id, grade.student_id ?? grade.studentId)));
    const bySubject = new Map<string, any[]>();
    studentGrades.forEach((grade: any) => {
      const key = String(grade.subject_id ?? grade.subjectId ?? grade.subject ?? '');
      if (!bySubject.has(key)) bySubject.set(key, []);
      bySubject.get(key)!.push(grade);
    });

    const subjects = Array.from(bySubject.entries()).map(([subjectId, rows]) => {
      const subject: any = subjectMap.get(subjectId) || {};
      const values20 = rows.map(normalizedGrade20);
      const average20 = values20.length ? values20.reduce((sum, value) => sum + value, 0) / values20.length : null;
      const coefficient = cycle === 'primaire' ? 1 : Math.max(1, asNumber(subject.coefficient || 1));
      const averageDisplay = average20 == null ? null : (average20 / 20) * displayScale;
      return {
        subjectId,
        name: subject.name || rows[0]?.subject || `Matière #${subjectId}`,
        coefficient,
        scores: rows.map((row: any) => ({
          score: asNumber(row.score),
          maxScore: asNumber(row.max_score ?? row.maxScore ?? 20) || 20,
        })),
        average20,
        average: averageDisplay,
        weighted20: average20 == null ? 0 : average20 * coefficient,
        appreciation: appreciationFor(average20),
      };
    }).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

    const evaluated = subjects.filter((subject) => subject.average20 != null);
    const coefficientTotal = evaluated.reduce((sum, subject) => sum + subject.coefficient, 0);
    const overall20 = coefficientTotal
      ? evaluated.reduce((sum, subject) => sum + subject.weighted20, 0) / coefficientTotal
      : null;
    const attendanceRows = classAttendance.filter((row: any) => candidateIds.some((id) => same(id, row.student_id ?? row.studentId)));
    const absences = attendanceRows.filter((row: any) => /absent|absence/i.test(String(row.status || ''))).length;
    const late = attendanceRows.filter((row: any) => /retard|late/i.test(String(row.status || ''))).length;
    return {
      student,
      studentInfo: studentLabel(student, data.users),
      subjects,
      coefficientTotal,
      overall20,
      overall: overall20 == null ? null : (overall20 / 20) * displayScale,
      absences,
      late,
    };
  });

  const ranked = metrics
    .filter((row) => row.overall20 != null)
    .sort((a, b) => (b.overall20 || 0) - (a.overall20 || 0));
  const classAverage20 = ranked.length ? ranked.reduce((sum, row) => sum + (row.overall20 || 0), 0) / ranked.length : null;
  const best20 = ranked[0]?.overall20 ?? null;
  const lowest20 = ranked[ranked.length - 1]?.overall20 ?? null;

  return metrics
    .filter((row) => !onlyStudentId || same(row.student.id, onlyStudentId) || same(row.studentInfo.userId, onlyStudentId))
    .map((row) => {
      const rankIndex = ranked.findIndex((candidate) => same(candidate.student.id, row.student.id));
      return {
        kind: 'bulletin',
        documentType: `bulletin_${cycle}`,
        templateVersion: 1,
        academicYear,
        term,
        cycle,
        displayScale,
        school: schoolSnapshot(school),
        class: { id: schoolClass.id, name: schoolClass.name, level: schoolClass.level || '' },
        student: row.studentInfo,
        subjects: row.subjects,
        results: {
          overall: row.overall,
          overall20: row.overall20,
          coefficientTotal: row.coefficientTotal,
          rank: rankIndex >= 0 ? rankIndex + 1 : null,
          classSize: classStudents.length,
          classAverage: classAverage20 == null ? null : (classAverage20 / 20) * displayScale,
          bestAverage: best20 == null ? null : (best20 / 20) * displayScale,
          lowestAverage: lowest20 == null ? null : (lowest20 / 20) * displayScale,
          appreciation: appreciationFor(row.overall20),
          absences: row.absences,
          late: row.late,
        },
        generatedFrom: {
          gradeCount: row.subjects.reduce((sum, subject) => sum + subject.scores.length, 0),
          attendanceScope: 'année scolaire - données disponibles',
        },
      };
    });
}

function buildReportSnapshot(data: any, school: any, type: string, academicYear: string, term?: string) {
  const classes = data.classes.map((schoolClass: any) => {
    const students = data.students.filter((student: any) => same(student.class_id ?? student.classId, schoolClass.id));
    return {
      id: schoolClass.id,
      name: schoolClass.name,
      level: schoolClass.level || '',
      cycle: detectCycle(schoolClass),
      students: students.length,
    };
  });
  const teachers = data.users.filter((user: any) => canonicalizeRole(user.role) === 'Enseignant');
  const staff = data.users.filter((user: any) => canonicalizeRole(user.role) !== 'Élève');
  let grades = data.grades;
  if (type === 'report_term' && term) grades = filterGradesForTerm(grades, term);
  const gradeValues = grades.map(normalizedGrade20).filter(Number.isFinite);
  const averageGrade = gradeValues.length ? gradeValues.reduce((sum, value) => sum + value, 0) / gradeValues.length : null;
  const attendance = data.attendance.filter((row: any) => inAcademicYear(row.date, academicYear));
  const absent = attendance.filter((row: any) => /absent|absence/i.test(String(row.status || ''))).length;
  const late = attendance.filter((row: any) => /retard|late/i.test(String(row.status || ''))).length;
  const present = attendance.filter((row: any) => /present|présent/i.test(String(row.status || ''))).length;
  const reportLabels: Record<string, string> = {
    report_flash: 'Rapport flash',
    report_start: 'Rapport de rentrée scolaire',
    report_term: 'Rapport de fin de trimestre',
    report_year_end: 'Rapport de fin d’année scolaire',
  };
  return {
    kind: 'report',
    documentType: type,
    title: reportLabels[type],
    templateVersion: 1,
    academicYear,
    term: term || null,
    school: schoolSnapshot(school),
    metrics: {
      students: data.students.length,
      classes: data.classes.length,
      teachers: teachers.length,
      staff: staff.length,
      subjects: data.subjects.length,
      gradeEntries: grades.length,
      averageGrade20: averageGrade,
      attendanceEntries: attendance.length,
      present,
      absent,
      late,
    },
    classes,
    personnel: data.personnel.map((person: any) => ({
      id: person.id,
      matricule: person.matricule || '',
      role: person.role || '',
      hireDate: person.hire_date || person.hireDate || '',
    })),
    generatedFrom: {
      source: 'EDUCO live database',
      generatedAt: new Date().toISOString(),
    },
  };
}

function sanitizeNarrative(value: any) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    observations: cleanText(source.observations),
    difficulties: cleanText(source.difficulties),
    solutions: cleanText(source.solutions),
    recommendations: cleanText(source.recommendations),
    conclusion: cleanText(source.conclusion),
    generalAppreciation: cleanText(source.generalAppreciation, 1500),
  };
}

export function registerAcademicDocumentRoutes(app: Express, requireAuth: any, getUser: any, getClient: any) {
  app.get('/api/academic-documents/context', requireAuth, async (req: any, res) => {
    try {
      const { actor, client, school } = await getContext(req, getUser, getClient);
      assertManager(actor);
      const data = await fetchAcademicData(client, actor.schoolId);
      const settings = school?.settings?.schoolSettings || school?.settings?.operations?.schoolSettings || {};
      const academicYear = settings.academicYear || settings.currentYear || '';
      res.json({
        school: schoolSnapshot(school),
        academicYear,
        terms: BULLETIN_TERMS,
        reportTypes: [
          { key: 'report_start', label: 'Rapport de rentrée scolaire' },
          { key: 'report_flash', label: 'Rapport flash' },
          { key: 'report_term', label: 'Rapport de fin de trimestre' },
          { key: 'report_year_end', label: 'Rapport de fin d’année scolaire' },
        ],
        classes: data.classes.map((schoolClass: any) => ({
          id: schoolClass.id,
          name: schoolClass.name,
          level: schoolClass.level || '',
          cycle: detectCycle(schoolClass),
        })),
        students: data.students.map((student: any) => ({
          ...studentLabel(student, data.users),
          classId: student.class_id ?? student.classId,
        })),
      });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/academic-documents/reports/preview', requireAuth, async (req: any, res) => {
    try {
      const { actor, client, school } = await getContext(req, getUser, getClient);
      assertManager(actor);
      const type = String(req.body?.type || '');
      const academicYear = cleanText(req.body?.academicYear, 30);
      const term = cleanText(req.body?.term, 50);
      if (!REPORT_TYPES.has(type) || !academicYear) return res.status(400).json({ error: 'Type de rapport ou année scolaire invalide.' });
      if (type === 'report_term' && !term) return res.status(400).json({ error: 'Le trimestre est obligatoire.' });
      const data = await fetchAcademicData(client, actor.schoolId);
      res.json({ preview: buildReportSnapshot(data, school, type, academicYear, term) });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/academic-documents/reports/generate', requireAuth, async (req: any, res) => {
    try {
      const { actor, client, school } = await getContext(req, getUser, getClient);
      assertManager(actor);
      const type = String(req.body?.type || '');
      const academicYear = cleanText(req.body?.academicYear, 30);
      const term = cleanText(req.body?.term, 50);
      if (!REPORT_TYPES.has(type) || !academicYear) return res.status(400).json({ error: 'Type de rapport ou année scolaire invalide.' });
      const data = await fetchAcademicData(client, actor.schoolId);
      const snapshot = buildReportSnapshot(data, school, type, academicYear, term);
      const narrative = sanitizeNarrative(req.body?.narrative);
      const { data: created, error } = await client.from('academic_documents').insert({
        school_id: actor.schoolId,
        kind: 'report',
        document_type: type,
        status: 'generated',
        academic_year: academicYear,
        term: term || null,
        template_version: 1,
        snapshot,
        narrative,
        generated_by: actor.id,
      }).select('*').single();
      if (error) throw error;
      await audit(client, actor, 'ACADEMIC_REPORT_GENERATED', `${snapshot.title} — ${academicYear}${term ? ` — ${term}` : ''}`);
      res.status(201).json({ document: created });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/academic-documents/bulletins/preview', requireAuth, async (req: any, res) => {
    try {
      const { actor, client, school } = await getContext(req, getUser, getClient);
      assertManager(actor);
      const classId = Number(req.body?.classId);
      const studentId = req.body?.studentId ? Number(req.body.studentId) : undefined;
      const term = cleanText(req.body?.term, 50);
      const academicYear = cleanText(req.body?.academicYear, 30);
      if (!Number.isInteger(classId) || !term || !academicYear) return res.status(400).json({ error: 'Classe, trimestre et année scolaire sont obligatoires.' });
      const data = await fetchAcademicData(client, actor.schoolId);
      const previews = buildClassBulletins(data, school, classId, term, academicYear, studentId);
      res.json({ previews });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/academic-documents/bulletins/generate', requireAuth, async (req: any, res) => {
    try {
      const { actor, client, school } = await getContext(req, getUser, getClient);
      assertManager(actor);
      const classId = Number(req.body?.classId);
      const studentId = req.body?.studentId ? Number(req.body.studentId) : undefined;
      const term = cleanText(req.body?.term, 50);
      const academicYear = cleanText(req.body?.academicYear, 30);
      if (!Number.isInteger(classId) || !term || !academicYear) return res.status(400).json({ error: 'Classe, trimestre et année scolaire sont obligatoires.' });
      const data = await fetchAcademicData(client, actor.schoolId);
      const snapshots = buildClassBulletins(data, school, classId, term, academicYear, studentId);
      if (!snapshots.length) return res.status(404).json({ error: 'Aucun élève à traiter pour cette sélection.' });
      const generalAppreciation = cleanText(req.body?.generalAppreciation, 1500);
      const rows = snapshots.map((snapshot: any) => ({
        school_id: actor.schoolId,
        kind: 'bulletin',
        document_type: snapshot.documentType,
        status: 'generated',
        academic_year: academicYear,
        term,
        cycle: snapshot.cycle,
        class_id: classId,
        student_id: snapshot.student.id,
        template_version: snapshot.templateVersion,
        snapshot,
        narrative: { generalAppreciation },
        generated_by: actor.id,
      }));
      const { data: created, error } = await client.from('academic_documents').insert(rows).select('*');
      if (error) throw error;
      await audit(client, actor, 'BULLETINS_GENERATED', `${created?.length || 0} bulletin(s) — classe ${snapshots[0]?.class?.name || classId} — ${term}`);
      res.status(201).json({ documents: created || [] });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/academic-documents/batch-transition', requireAuth, async (req: any, res) => {
    try {
      const { actor, client } = await getContext(req, getUser, getClient);
      assertManager(actor);
      const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).filter(Boolean).slice(0, 250) : [];
      const action = String(req.body?.action || '');
      if (!ids.length || !['validate', 'authorize_print'].includes(action)) return res.status(400).json({ error: 'Transition ou liste de documents invalide.' });
      const { data: docs, error: readError } = await client.from('academic_documents').select('*').eq('school_id', actor.schoolId).in('id', ids);
      if (readError) throw readError;
      const expected = action === 'validate' ? 'generated' : 'validated';
      const eligible = (docs || []).filter((doc: any) => doc.status === expected && (action !== 'authorize_print' || doc.kind === 'bulletin'));
      if (!eligible.length) return res.status(409).json({ error: 'Aucun document n’est dans l’état requis pour cette action.' });
      const now = new Date().toISOString();
      const patch = action === 'validate'
        ? { status: 'validated', validated_by: actor.id, validated_at: now, updated_at: now }
        : { status: 'print_authorized', print_authorized_by: actor.id, print_authorized_at: now, updated_at: now };
      const eligibleIds = eligible.map((doc: any) => doc.id);
      const { data: updated, error } = await client.from('academic_documents').update(patch).eq('school_id', actor.schoolId).in('id', eligibleIds).select('*');
      if (error) throw error;
      await audit(client, actor, action === 'validate' ? 'ACADEMIC_DOCUMENTS_VALIDATED' : 'BULLETINS_PRINT_AUTHORIZED', `${updated?.length || 0} document(s)`);
      res.json({ documents: updated || [] });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get('/api/academic-documents', requireAuth, async (req: any, res) => {
    try {
      const { actor, client } = await getContext(req, getUser, getClient);
      const role = canonicalizeRole(actor.role);
      let query = client.from('academic_documents').select('*').eq('school_id', actor.schoolId).order('created_at', { ascending: false }).limit(300);
      if (DOCUMENT_MANAGERS.has(role)) {
        if (req.query?.kind === 'report' || req.query?.kind === 'bulletin') query = query.eq('kind', req.query.kind);
      } else if (role === CASHIER_ROLE) {
        query = query.eq('kind', 'bulletin').in('status', ['print_authorized', 'printed']);
      } else {
        return res.status(403).json({ error: 'Accès non autorisé aux documents scolaires.' });
      }
      const { data, error } = await query;
      if (error) throw error;
      res.json({ documents: data || [] });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.get('/api/academic-documents/:id', requireAuth, async (req: any, res) => {
    try {
      const { actor, client } = await getContext(req, getUser, getClient);
      const role = canonicalizeRole(actor.role);
      const { data: document, error } = await client.from('academic_documents').select('*').eq('school_id', actor.schoolId).eq('id', req.params.id).maybeSingle();
      if (error) throw error;
      if (!document) return res.status(404).json({ error: 'Document introuvable.' });
      if (!DOCUMENT_MANAGERS.has(role) && !(role === CASHIER_ROLE && document.kind === 'bulletin' && ['print_authorized', 'printed'].includes(document.status))) {
        return res.status(403).json({ error: 'Accès non autorisé à ce document.' });
      }
      const { data: prints, error: printError } = await client.from('academic_document_prints').select('*').eq('document_id', document.id).order('printed_at', { ascending: false });
      if (printError) throw printError;
      res.json({ document, prints: prints || [] });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/academic-documents/:id/transition', requireAuth, async (req: any, res) => {
    try {
      const { actor, client } = await getContext(req, getUser, getClient);
      assertManager(actor);
      const action = String(req.body?.action || '');
      const { data: document, error: readError } = await client.from('academic_documents').select('*').eq('school_id', actor.schoolId).eq('id', req.params.id).maybeSingle();
      if (readError) throw readError;
      if (!document) return res.status(404).json({ error: 'Document introuvable.' });
      const now = new Date().toISOString();
      let patch: any;
      if (action === 'validate' && document.status === 'generated') {
        patch = { status: 'validated', validated_by: actor.id, validated_at: now, updated_at: now };
      } else if (action === 'authorize_print' && document.kind === 'bulletin' && document.status === 'validated') {
        patch = { status: 'print_authorized', print_authorized_by: actor.id, print_authorized_at: now, updated_at: now };
      } else {
        return res.status(409).json({ error: 'Transition non autorisée depuis l’état actuel du document.' });
      }
      const { data: updated, error } = await client.from('academic_documents').update(patch).eq('school_id', actor.schoolId).eq('id', document.id).select('*').single();
      if (error) throw error;
      await audit(client, actor, action === 'validate' ? 'ACADEMIC_DOCUMENT_VALIDATED' : 'BULLETIN_PRINT_AUTHORIZED', `${document.id}`);
      res.json({ document: updated });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/academic-documents/:id/print', requireAuth, async (req: any, res) => {
    try {
      const { actor, client } = await getContext(req, getUser, getClient);
      assertCashier(actor);
      const { data: document, error: readError } = await client.from('academic_documents').select('*').eq('school_id', actor.schoolId).eq('id', req.params.id).maybeSingle();
      if (readError) throw readError;
      if (!document || document.kind !== 'bulletin') return res.status(404).json({ error: 'Bulletin introuvable.' });
      if (!['print_authorized', 'printed'].includes(document.status)) return res.status(403).json({ error: 'Ce bulletin n’est pas autorisé pour impression.' });
      const isReprint = document.status === 'printed';
      const reason = cleanText(req.body?.reason, 500);
      if (isReprint && reason.length < 3) return res.status(400).json({ error: 'Le motif de réimpression est obligatoire.' });
      const now = new Date().toISOString();
      const { error: logError } = await client.from('academic_document_prints').insert({
        document_id: document.id,
        school_id: actor.schoolId,
        printed_by: actor.id,
        print_type: isReprint ? 'reprint' : 'original',
        copies: 1,
        reason: isReprint ? reason : null,
        printed_at: now,
      });
      if (logError) throw logError;
      const { data: updated, error } = await client.from('academic_documents').update({ status: 'printed', printed_at: now, updated_at: now }).eq('school_id', actor.schoolId).eq('id', document.id).select('*').single();
      if (error) throw error;
      await audit(client, actor, isReprint ? 'BULLETIN_REPRINTED' : 'BULLETIN_PRINTED', `${document.id}${isReprint ? ` — ${reason}` : ''}`);
      res.json({ document: updated, printType: isReprint ? 'reprint' : 'original' });
    } catch (error: any) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });
}
