import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, GraduationCap, Printer, ShieldCheck, X, ChevronLeft, ChevronRight, RefreshCw, CheckCircle2, LockKeyhole, Eye, AlertCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getApiUrl } from '../src/lib/apiConfig';
import { canonicalizeRole } from '../src/services/userAccountWorkflow';
import type { User } from './UserForm';

interface Props {
  currentUser: User;
  onClose: () => void;
}

type View = 'home' | 'reports' | 'bulletins' | 'cashier' | 'history';

type AcademicDocument = {
  id: string;
  kind: 'report' | 'bulletin';
  document_type: string;
  status: 'generated' | 'validated' | 'print_authorized' | 'printed';
  academic_year: string;
  term?: string | null;
  cycle?: string | null;
  snapshot: any;
  narrative?: any;
  verification_code?: string;
  generated_at?: string;
  validated_at?: string;
  print_authorized_at?: string;
  printed_at?: string;
};

const STATUS_LABELS: Record<string, string> = {
  generated: 'Généré',
  validated: 'Validé',
  print_authorized: 'Prêt à imprimer',
  printed: 'Imprimé',
};

const REPORT_LABELS: Record<string, string> = {
  report_start: 'Rapport de rentrée scolaire',
  report_flash: 'Rapport flash',
  report_term: 'Rapport de fin de trimestre',
  report_year_end: 'Rapport de fin d’année scolaire',
};

function statusClass(status: string) {
  if (status === 'printed') return 'bg-slate-900 text-white';
  if (status === 'print_authorized') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'validated') return 'bg-blue-100 text-blue-800 border-blue-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

function formatNumber(value: unknown, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return number.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

async function apiRequest(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('EDUCO_USER_TOKEN') || '';
  const response = await fetch(getApiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  let payload: any = null;
  try { payload = await response.json(); } catch { payload = {}; }
  if (!response.ok) throw new Error(payload?.error || `Erreur HTTP ${response.status}`);
  return payload;
}

const AcademicDocumentPaper: React.FC<{ document: AcademicDocument | any }> = ({ document }) => {
  const snapshot = document?.snapshot || document;
  const narrative = document?.narrative || {};
  const school = snapshot?.school || {};
  const verificationCode = document?.verification_code || document?.verificationCode;

  if (snapshot?.kind === 'report') {
    const metrics = snapshot.metrics || {};
    return (
      <article className="bg-white text-slate-900 w-[210mm] min-h-[297mm] mx-auto p-[15mm] shadow-xl print:shadow-none print:p-[10mm]">
        <header className="flex items-start justify-between gap-6 border-b-4 border-slate-900 pb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em]">République du Congo</p>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unité • Travail • Progrès</p>
            <h1 className="mt-4 text-2xl font-black uppercase">{school.name || 'Établissement'}</h1>
            <p className="text-xs font-semibold text-slate-600">{school.address}</p>
          </div>
          {school.logo ? <img src={school.logo} alt="Logo établissement" className="h-20 w-20 object-contain" /> : null}
        </header>

        <div className="text-center py-8">
          <h2 className="text-2xl font-black uppercase tracking-wider">{snapshot.title || REPORT_LABELS[snapshot.documentType] || 'Rapport scolaire'}</h2>
          <p className="mt-2 text-sm font-bold text-slate-500">Année scolaire {snapshot.academicYear}{snapshot.term ? ` — ${snapshot.term}` : ''}</p>
        </div>

        <section className="grid grid-cols-3 gap-3 mb-8">
          {[
            ['Élèves', metrics.students], ['Classes', metrics.classes], ['Enseignants', metrics.teachers],
            ['Personnel', metrics.staff], ['Matières', metrics.subjects], ['Notes saisies', metrics.gradeEntries],
            ['Présences', metrics.present], ['Absences', metrics.absent], ['Retards', metrics.late],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-xl border border-slate-200 p-3 text-center">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-black">{value ?? '—'}</p>
            </div>
          ))}
        </section>

        <section className="mb-8">
          <div className="flex items-end justify-between border-b-2 border-slate-900 pb-2 mb-3">
            <h3 className="text-sm font-black uppercase tracking-wider">Situation des effectifs par classe</h3>
            <span className="text-xs font-bold text-slate-500">Moyenne des notes disponibles : {formatNumber(metrics.averageGrade20)} / 20</span>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead><tr className="bg-slate-900 text-white"><th className="p-2 text-left">Classe</th><th className="p-2 text-left">Cycle</th><th className="p-2 text-right">Effectif</th></tr></thead>
            <tbody>{(snapshot.classes || []).map((row: any) => (
              <tr key={row.id} className="border-b border-slate-200"><td className="p-2 font-bold">{row.name}</td><td className="p-2 capitalize">{row.cycle}</td><td className="p-2 text-right font-black">{row.students}</td></tr>
            ))}</tbody>
          </table>
        </section>

        {[
          ['Observations', narrative.observations],
          ['Difficultés rencontrées', narrative.difficulties],
          ['Solutions / mesures prises', narrative.solutions],
          ['Recommandations', narrative.recommendations],
          ['Conclusion', narrative.conclusion],
        ].filter(([, value]) => Boolean(value)).map(([label, value]) => (
          <section key={String(label)} className="mb-5">
            <h3 className="text-xs font-black uppercase tracking-wider border-b border-slate-300 pb-1 mb-2">{label}</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
          </section>
        ))}

        <footer className="mt-14 grid grid-cols-2 gap-16 text-center text-xs font-bold">
          <div><p>Le Directeur des Études</p><div className="h-20 mt-2 border-b border-slate-300" /></div>
          <div><p>Le Directeur Général</p><div className="h-20 mt-2 border-b border-slate-300" /></div>
        </footer>
      </article>
    );
  }

  const scale = Number(snapshot?.displayScale || 20);
  const results = snapshot?.results || {};
  return (
    <article className="bg-white text-slate-900 w-[210mm] min-h-[297mm] mx-auto p-[12mm] shadow-xl print:shadow-none print:p-[8mm]">
      <header className="flex items-start justify-between gap-5 border-b-4 border-slate-900 pb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em]">République du Congo</p>
          <p className="text-[10px] font-bold text-slate-500 uppercase">Unité • Travail • Progrès</p>
          <h1 className="mt-3 text-2xl font-black uppercase">{school.name || 'Établissement'}</h1>
          <p className="text-xs font-semibold text-slate-600">{school.address} {school.contact ? `• ${school.contact}` : ''}</p>
        </div>
        {school.logo ? <img src={school.logo} alt="Logo établissement" className="h-20 w-20 object-contain" /> : null}
      </header>

      <div className="text-center py-6">
        <h2 className="text-2xl font-black uppercase tracking-[0.15em]">Bulletin de notes</h2>
        <p className="mt-2 text-sm font-black text-slate-500 uppercase">{snapshot.term} — {snapshot.academicYear}</p>
      </div>

      <section className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border-2 border-slate-900 p-4 text-xs mb-6">
        <div><span className="font-black uppercase text-slate-400">Élève</span><p className="text-base font-black uppercase">{snapshot.student?.name}</p></div>
        <div><span className="font-black uppercase text-slate-400">Classe</span><p className="text-base font-black uppercase">{snapshot.class?.name}</p></div>
        <div><span className="font-black uppercase text-slate-400">Matricule</span><p className="font-bold">{snapshot.student?.matricule || '—'}</p></div>
        <div><span className="font-black uppercase text-slate-400">Cycle</span><p className="font-bold capitalize">{snapshot.cycle}</p></div>
      </section>

      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="p-2 text-left">Matière</th><th className="p-2 text-center">Notes</th><th className="p-2 text-center">Moy.</th><th className="p-2 text-center">Coef.</th><th className="p-2 text-left">Appréciation</th>
          </tr>
        </thead>
        <tbody>{(snapshot.subjects || []).map((subject: any) => (
          <tr key={subject.subjectId || subject.name} className="border-b border-slate-200">
            <td className="p-2 font-black uppercase">{subject.name}</td>
            <td className="p-2 text-center font-semibold">{(subject.scores || []).map((score: any) => `${formatNumber(score.score, 1)}/${formatNumber(score.maxScore, 0)}`).join(' · ') || '—'}</td>
            <td className="p-2 text-center font-black">{subject.average == null ? '—' : `${formatNumber(subject.average)}/${scale}`}</td>
            <td className="p-2 text-center font-bold">{subject.coefficient}</td>
            <td className="p-2 font-semibold">{subject.appreciation}</td>
          </tr>
        ))}</tbody>
      </table>

      <section className="mt-6 grid grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-200 p-4 text-xs space-y-2">
          <div className="flex justify-between"><span>Moyenne de classe</span><b>{results.classAverage == null ? '—' : `${formatNumber(results.classAverage)}/${scale}`}</b></div>
          <div className="flex justify-between"><span>Meilleure moyenne</span><b>{results.bestAverage == null ? '—' : `${formatNumber(results.bestAverage)}/${scale}`}</b></div>
          <div className="flex justify-between"><span>Rang</span><b>{results.rank ? `${results.rank} / ${results.classSize}` : '—'}</b></div>
          <div className="flex justify-between"><span>Absences enregistrées</span><b>{results.absences ?? 0}</b></div>
          <div className="flex justify-between"><span>Retards enregistrés</span><b>{results.late ?? 0}</b></div>
        </div>
        <div className="rounded-xl border-4 border-slate-900 p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Moyenne générale</p>
          <p className="text-4xl font-black mt-1">{results.overall == null ? '—' : formatNumber(results.overall)}<span className="text-lg text-slate-400">/{scale}</span></p>
          <p className="mt-2 text-xs font-black uppercase">{results.appreciation || 'Non évalué'}</p>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 p-4 min-h-20">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Appréciation générale</p>
        <p className="mt-2 text-sm font-semibold italic whitespace-pre-wrap">{narrative.generalAppreciation || '—'}</p>
      </section>

      <footer className="mt-10 flex items-end justify-between gap-6">
        <div className="grid grid-cols-2 gap-10 flex-1 text-center text-xs font-bold">
          <div><p>Le Directeur des Études</p><div className="h-16 mt-2 border-b border-slate-300" /></div>
          <div><p>Le Directeur Général</p><div className="h-16 mt-2 border-b border-slate-300" /></div>
        </div>
        {verificationCode ? (
          <div className="text-center shrink-0">
            <QRCodeSVG value={`EDUCO:${verificationCode}`} size={64} level="M" />
            <p className="mt-1 text-[8px] font-bold text-slate-400">Vérification EDUCO</p>
          </div>
        ) : null}
      </footer>
    </article>
  );
};

const AcademicDocumentsModal: React.FC<Props> = ({ currentUser, onClose }) => {
  const role = canonicalizeRole(currentUser.role);
  const isManager = role === 'Directeur Général' || role === 'Directeur des Etudes';
  const isCashier = role === 'Caissière';
  const [view, setView] = useState<View>(isCashier ? 'cashier' : 'home');
  const [context, setContext] = useState<any>(null);
  const [documents, setDocuments] = useState<AcademicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<AcademicDocument | null>(null);
  const [reportType, setReportType] = useState('report_start');
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('1er trimestre');
  const [classId, setClassId] = useState('');
  const [studentId, setStudentId] = useState('all');
  const [reportPreview, setReportPreview] = useState<any>(null);
  const [bulletinPreviews, setBulletinPreviews] = useState<any[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [generatedIds, setGeneratedIds] = useState<string[]>([]);
  const [generalAppreciation, setGeneralAppreciation] = useState('');
  const [narrative, setNarrative] = useState({ observations: '', difficulties: '', solutions: '', recommendations: '', conclusion: '' });
  const [reprintReason, setReprintReason] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const selectedClassStudents = useMemo(() => {
    if (!context || !classId) return [];
    return (context.students || []).filter((student: any) => String(student.classId) === String(classId));
  }, [context, classId]);

  const loadDocuments = async () => {
    const payload = await apiRequest('/api/academic-documents');
    setDocuments(payload.documents || []);
  };

  const load = async () => {
    setLoading(true); setError('');
    try {
      if (isManager) {
        const [ctx] = await Promise.all([apiRequest('/api/academic-documents/context'), loadDocuments()]);
        setContext(ctx);
        const fallbackYear = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;
        setAcademicYear(ctx.academicYear || fallbackYear);
        if (ctx.classes?.length) setClassId(String(ctx.classes[0].id));
      } else if (isCashier) {
        await loadDocuments();
      } else {
        setError('Ce module n’est pas disponible pour votre rôle.');
      }
    } catch (err: any) {
      setError(err.message || 'Impossible de charger les documents scolaires.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const notify = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(''), 3500);
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (err: any) { setError(err.message || 'Une erreur est survenue.'); } finally { setBusy(false); }
  };

  const previewReport = () => run(async () => {
    const payload = await apiRequest('/api/academic-documents/reports/preview', {
      method: 'POST', body: JSON.stringify({ type: reportType, academicYear, term: reportType === 'report_term' ? term : undefined }),
    });
    setReportPreview(payload.preview);
    setSelectedDocument(null);
  });

  const generateReport = () => run(async () => {
    const payload = await apiRequest('/api/academic-documents/reports/generate', {
      method: 'POST', body: JSON.stringify({ type: reportType, academicYear, term: reportType === 'report_term' ? term : undefined, narrative }),
    });
    setSelectedDocument(payload.document);
    setReportPreview(null);
    setGeneratedIds([payload.document.id]);
    await loadDocuments();
    notify('Rapport généré et figé avec les données EDUCO actuelles.');
  });

  const previewBulletins = () => run(async () => {
    const payload = await apiRequest('/api/academic-documents/bulletins/preview', {
      method: 'POST', body: JSON.stringify({ classId: Number(classId), studentId: studentId === 'all' ? undefined : Number(studentId), term, academicYear }),
    });
    setBulletinPreviews(payload.previews || []);
    setPreviewIndex(0);
    setSelectedDocument(null);
  });

  const generateBulletins = () => run(async () => {
    const payload = await apiRequest('/api/academic-documents/bulletins/generate', {
      method: 'POST', body: JSON.stringify({ classId: Number(classId), studentId: studentId === 'all' ? undefined : Number(studentId), term, academicYear, generalAppreciation }),
    });
    const created: AcademicDocument[] = payload.documents || [];
    setGeneratedIds(created.map((doc) => doc.id));
    setSelectedDocument(created[0] || null);
    setBulletinPreviews([]);
    await loadDocuments();
    notify(`${created.length} bulletin(s) généré(s).`);
  });

  const transition = (ids: string[], action: 'validate' | 'authorize_print') => run(async () => {
    const payload = await apiRequest('/api/academic-documents/batch-transition', {
      method: 'POST', body: JSON.stringify({ ids, action }),
    });
    const updated: AcademicDocument[] = payload.documents || [];
    if (selectedDocument) {
      const replacement = updated.find((doc) => doc.id === selectedDocument.id);
      if (replacement) setSelectedDocument(replacement);
    }
    await loadDocuments();
    notify(action === 'validate' ? `${updated.length} document(s) validé(s).` : `${updated.length} bulletin(s) autorisé(s) pour impression.`);
  });

  const openDocument = async (doc: AcademicDocument) => run(async () => {
    const payload = await apiRequest(`/api/academic-documents/${doc.id}`);
    setSelectedDocument(payload.document);
    setReprintReason('');
  });

  const printCurrent = async (logCashierPrint = false) => {
    if (!selectedDocument || !printRef.current) return;
    if (logCashierPrint) {
      if (selectedDocument.status === 'printed' && reprintReason.trim().length < 3) {
        setError('Saisissez le motif de réimpression avant de continuer.');
        return;
      }
      try {
        const payload = await apiRequest(`/api/academic-documents/${selectedDocument.id}/print`, {
          method: 'POST', body: JSON.stringify({ reason: selectedDocument.status === 'printed' ? reprintReason : undefined }),
        });
        setSelectedDocument(payload.document);
        await loadDocuments();
      } catch (err: any) {
        setError(err.message || 'Impression non autorisée.');
        return;
      }
    }
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) {
      setError('Le navigateur a bloqué la fenêtre d’impression. Autorisez les fenêtres contextuelles pour EDUCO.');
      return;
    }
    printWindow.document.write(`<!doctype html><html><head>${document.head.innerHTML}<style>@page{size:A4 portrait;margin:0}body{background:white!important;margin:0}.educo-print-shell{padding:0!important;background:white!important}.educo-print-shell>article{box-shadow:none!important;margin:0 auto!important}@media print{button{display:none!important}}</style></head><body><div class="educo-print-shell">${printRef.current.innerHTML}</div></body></html>`);
    printWindow.document.close();
    window.setTimeout(() => { printWindow.focus(); printWindow.print(); }, 350);
  };

  const previewDocument = reportPreview
    ? { snapshot: reportPreview, narrative }
    : bulletinPreviews.length
      ? { snapshot: bulletinPreviews[previewIndex], narrative: { generalAppreciation } }
      : selectedDocument;

  const canValidateGenerated = generatedIds.length > 0 && documents.some((doc) => generatedIds.includes(doc.id) && doc.status === 'generated');
  const canAuthorizeGenerated = generatedIds.length > 0 && documents.some((doc) => generatedIds.includes(doc.id) && doc.status === 'validated' && doc.kind === 'bulletin');

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Documents scolaires">
      <div className="w-full max-w-[1500px] h-[96vh] bg-slate-50 dark:bg-slate-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/20">
        <header className="shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#1F4A59] text-white flex items-center justify-center"><FileText className="w-5 h-5" /></div>
            <div><h2 className="font-black text-lg text-slate-900 dark:text-white">Documents scolaires officiels</h2><p className="text-xs font-semibold text-slate-500">{isCashier ? 'Bulletins autorisés pour impression' : 'Rapports réglementaires, bulletins et validation'}</p></div>
          </div>
          <button onClick={onClose} className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </header>

        {error ? <div className="mx-5 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div> : null}
        {message ? <div className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{message}</div> : null}

        <main className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="h-full flex items-center justify-center"><RefreshCw className="w-7 h-7 animate-spin text-[#1F4A59]" /></div>
          ) : isCashier ? (
            <div className="h-full grid lg:grid-cols-[420px_1fr]">
              <aside className="overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div className="flex items-center justify-between mb-4"><h3 className="font-black text-slate-900 dark:text-white">Bulletins disponibles</h3><button onClick={() => void run(loadDocuments)} className="p-2 rounded-lg bg-slate-100"><RefreshCw className="w-4 h-4" /></button></div>
                <div className="space-y-2">
                  {documents.length === 0 ? <p className="p-5 text-sm text-center text-slate-500 border border-dashed rounded-xl">Aucun bulletin n’a encore été autorisé par la direction.</p> : documents.map((doc) => (
                    <button key={doc.id} onClick={() => void openDocument(doc)} className={`w-full text-left p-3 rounded-xl border transition ${selectedDocument?.id === doc.id ? 'border-[#1F4A59] bg-teal-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                      <div className="flex justify-between gap-2"><p className="font-black text-sm text-slate-900">{doc.snapshot?.student?.name || 'Élève'}</p><span className={`text-[10px] px-2 py-1 rounded-full border font-black ${statusClass(doc.status)}`}>{STATUS_LABELS[doc.status]}</span></div>
                      <p className="text-xs text-slate-500 mt-1">{doc.snapshot?.class?.name} • {doc.term} • {doc.academic_year}</p>
                    </button>
                  ))}
                </div>
              </aside>
              <section className="overflow-y-auto p-4 sm:p-6 bg-slate-200/50 dark:bg-slate-950">
                {selectedDocument ? <>
                  <div className="max-w-[900px] mx-auto mb-4 flex flex-col sm:flex-row justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm">
                    <div><p className="font-black text-slate-900 dark:text-white">{selectedDocument.status === 'printed' ? 'Réimpression contrôlée' : 'Impression autorisée'}</p><p className="text-xs text-slate-500">Le bulletin est en lecture seule. Les notes et calculs ne peuvent pas être modifiés ici.</p></div>
                    <div className="flex flex-col gap-2 min-w-64">
                      {selectedDocument.status === 'printed' ? <input value={reprintReason} onChange={(e) => setReprintReason(e.target.value)} placeholder="Motif obligatoire de réimpression" className="px-3 py-2 rounded-xl border border-slate-300 text-sm" /> : null}
                      <button onClick={() => void printCurrent(true)} disabled={busy} className="px-5 py-3 rounded-xl bg-[#1F4A59] text-white font-black text-xs uppercase flex items-center justify-center gap-2 disabled:opacity-50"><Printer className="w-4 h-4" />{selectedDocument.status === 'printed' ? 'Réimprimer' : 'Imprimer le bulletin'}</button>
                    </div>
                  </div>
                  <div ref={printRef}><AcademicDocumentPaper document={selectedDocument} /></div>
                </> : <div className="h-full flex items-center justify-center text-center text-slate-500"><div><Printer className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-bold">Sélectionnez un bulletin autorisé.</p></div></div>}
              </section>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <nav className="shrink-0 px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex gap-2 overflow-x-auto">
                {[['home', 'Accueil'], ['reports', 'Rapports'], ['bulletins', 'Bulletins'], ['history', 'Historique']].map(([key, label]) => <button key={key} onClick={() => { setView(key as View); setSelectedDocument(null); }} className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${view === key ? 'bg-[#1F4A59] text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{label}</button>)}
              </nav>

              {view === 'home' ? (
                <div className="flex-1 overflow-y-auto p-6 sm:p-10">
                  <div className="max-w-5xl mx-auto">
                    <div className="mb-8"><h3 className="text-2xl font-black text-slate-900 dark:text-white">Que voulez-vous produire ?</h3><p className="text-sm text-slate-500 mt-2">Les documents sont alimentés par les données réelles de l’établissement. Les valeurs calculées sont en lecture seule.</p></div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <button onClick={() => setView('reports')} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-[#1F4A59] text-left shadow-sm hover:shadow-lg transition-all"><div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mb-5"><FileText className="w-7 h-7" /></div><h4 className="text-xl font-black text-slate-900 dark:text-white">Rapports réglementaires</h4><p className="text-sm text-slate-500 mt-2">Rentrée, flash, fin de trimestre et fin d’année.</p></button>
                      <button onClick={() => setView('bulletins')} className="p-8 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-[#1F4A59] text-left shadow-sm hover:shadow-lg transition-all"><div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5"><GraduationCap className="w-7 h-7" /></div><h4 className="text-xl font-black text-slate-900 dark:text-white">Bulletins scolaires</h4><p className="text-sm text-slate-500 mt-2">Primaire, collège et lycée, avec coefficients, rangs et snapshot officiel.</p></button>
                    </div>
                    <div className="mt-8 p-5 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex gap-3"><ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" /><div><p className="font-black text-sm">Contrôle des rôles actif</p><p className="text-xs mt-1">Seuls le Directeur Général et le Directeur des Études peuvent générer et valider. La caissière n’accède qu’aux bulletins explicitement autorisés pour impression.</p></div></div>
                  </div>
                </div>
              ) : view === 'history' ? (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="max-w-6xl mx-auto space-y-3">
                    <div className="flex items-center justify-between"><h3 className="font-black text-xl text-slate-900 dark:text-white">Historique des documents</h3><button onClick={() => void run(loadDocuments)} className="px-3 py-2 rounded-xl bg-slate-100 text-xs font-black flex items-center gap-2"><RefreshCw className="w-4 h-4" />Actualiser</button></div>
                    {documents.map((doc) => <button key={doc.id} onClick={() => { void openDocument(doc); }} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-4 text-left"><div><p className="font-black text-sm text-slate-900 dark:text-white">{doc.kind === 'report' ? REPORT_LABELS[doc.document_type] : `Bulletin — ${doc.snapshot?.student?.name || 'Élève'}`}</p><p className="text-xs text-slate-500 mt-1">{doc.academic_year}{doc.term ? ` • ${doc.term}` : ''}{doc.snapshot?.class?.name ? ` • ${doc.snapshot.class.name}` : ''}</p></div><span className={`text-[10px] px-2 py-1 rounded-full border font-black ${statusClass(doc.status)}`}>{STATUS_LABELS[doc.status]}</span></button>)}
                    {selectedDocument ? <div className="mt-6"><div className="mb-3 flex flex-wrap gap-2"><button onClick={() => void printCurrent(false)} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-2"><Printer className="w-4 h-4" />Imprimer / PDF</button>{selectedDocument.status === 'generated' ? <button onClick={() => void transition([selectedDocument.id], 'validate')} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-black">Valider</button> : null}{selectedDocument.kind === 'bulletin' && selectedDocument.status === 'validated' ? <button onClick={() => void transition([selectedDocument.id], 'authorize_print')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black">Autoriser l’impression</button> : null}</div><div ref={printRef}><AcademicDocumentPaper document={selectedDocument} /></div></div> : null}
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-0 grid xl:grid-cols-[390px_1fr]">
                  <aside className="overflow-y-auto bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5">
                    {view === 'reports' ? <>
                      <h3 className="font-black text-lg text-slate-900 dark:text-white mb-5">Générer un rapport</h3>
                      <label className="block text-xs font-black text-slate-500 mb-1">Type de rapport</label><select value={reportType} onChange={(e) => { setReportType(e.target.value); setReportPreview(null); }} className="w-full px-3 py-3 rounded-xl border border-slate-300 bg-white mb-4">{(context?.reportTypes || []).map((item: any) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
                      <label className="block text-xs font-black text-slate-500 mb-1">Année scolaire</label><input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 mb-4" placeholder="2026-2027" />
                      {reportType === 'report_term' ? <><label className="block text-xs font-black text-slate-500 mb-1">Trimestre</label><select value={term} onChange={(e) => setTerm(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 bg-white mb-4">{(context?.terms || []).map((item: string) => <option key={item}>{item}</option>)}</select></> : null}
                      <div className="space-y-3 mt-5">{(['observations', 'difficulties', 'solutions', 'recommendations', 'conclusion'] as const).map((key) => <div key={key}><label className="block text-[10px] font-black text-slate-500 uppercase mb-1">{{ observations: 'Observations', difficulties: 'Difficultés', solutions: 'Solutions', recommendations: 'Recommandations', conclusion: 'Conclusion' }[key]}</label><textarea value={narrative[key]} onChange={(e) => setNarrative((old) => ({ ...old, [key]: e.target.value }))} rows={key === 'conclusion' ? 3 : 2} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm resize-y" /></div>)}</div>
                      <div className="grid grid-cols-2 gap-2 mt-5"><button onClick={() => void previewReport()} disabled={busy} className="px-3 py-3 rounded-xl bg-slate-100 text-slate-800 text-xs font-black flex justify-center items-center gap-2"><Eye className="w-4 h-4" />Aperçu</button><button onClick={() => void generateReport()} disabled={busy} className="px-3 py-3 rounded-xl bg-[#1F4A59] text-white text-xs font-black">Générer</button></div>
                    </> : <>
                      <h3 className="font-black text-lg text-slate-900 dark:text-white mb-5">Générer des bulletins</h3>
                      <label className="block text-xs font-black text-slate-500 mb-1">Année scolaire</label><input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 mb-4" />
                      <label className="block text-xs font-black text-slate-500 mb-1">Trimestre</label><select value={term} onChange={(e) => setTerm(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 bg-white mb-4">{(context?.terms || []).map((item: string) => <option key={item}>{item}</option>)}</select>
                      <label className="block text-xs font-black text-slate-500 mb-1">Classe</label><select value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId('all'); setBulletinPreviews([]); }} className="w-full px-3 py-3 rounded-xl border border-slate-300 bg-white mb-4">{(context?.classes || []).map((item: any) => <option key={item.id} value={item.id}>{item.name} — {item.cycle}</option>)}</select>
                      <label className="block text-xs font-black text-slate-500 mb-1">Élève</label><select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 bg-white mb-4"><option value="all">Tous les élèves de la classe</option>{selectedClassStudents.map((student: any) => <option key={student.id} value={student.id}>{student.name} — {student.matricule || 'sans matricule'}</option>)}</select>
                      <label className="block text-xs font-black text-slate-500 mb-1">Appréciation générale (optionnelle)</label><textarea value={generalAppreciation} onChange={(e) => setGeneralAppreciation(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm mb-4" />
                      <div className="grid grid-cols-2 gap-2"><button onClick={() => void previewBulletins()} disabled={busy || !classId} className="px-3 py-3 rounded-xl bg-slate-100 text-slate-800 text-xs font-black flex justify-center items-center gap-2"><Eye className="w-4 h-4" />Aperçu</button><button onClick={() => void generateBulletins()} disabled={busy || !classId} className="px-3 py-3 rounded-xl bg-[#1F4A59] text-white text-xs font-black">Générer</button></div>
                      {generatedIds.length ? <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200"><p className="text-xs font-black mb-3">Workflow de la série générée</p><div className="space-y-2">{canValidateGenerated ? <button onClick={() => void transition(generatedIds, 'validate')} disabled={busy} className="w-full px-3 py-3 rounded-xl bg-blue-600 text-white text-xs font-black flex items-center justify-center gap-2"><CheckCircle2 className="w-4 h-4" />Valider la série</button> : null}{canAuthorizeGenerated ? <button onClick={() => void transition(generatedIds, 'authorize_print')} disabled={busy} className="w-full px-3 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-2"><LockKeyhole className="w-4 h-4" />Autoriser l’impression</button> : null}</div></div> : null}
                    </>}
                  </aside>

                  <section className="overflow-y-auto bg-slate-200/50 dark:bg-slate-950 p-4 sm:p-6">
                    {bulletinPreviews.length > 1 ? <div className="max-w-[900px] mx-auto mb-3 bg-white rounded-xl p-3 flex items-center justify-between"><button onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))} disabled={previewIndex === 0} className="p-2 rounded-lg bg-slate-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button><p className="text-xs font-black">Aperçu {previewIndex + 1} / {bulletinPreviews.length}</p><button onClick={() => setPreviewIndex((index) => Math.min(bulletinPreviews.length - 1, index + 1))} disabled={previewIndex === bulletinPreviews.length - 1} className="p-2 rounded-lg bg-slate-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button></div> : null}
                    {selectedDocument ? <div className="max-w-[900px] mx-auto mb-3 bg-white rounded-xl p-3 flex flex-wrap gap-2 items-center"><span className={`text-[10px] px-2 py-1 rounded-full border font-black ${statusClass(selectedDocument.status)}`}>{STATUS_LABELS[selectedDocument.status]}</span>{selectedDocument.status === 'generated' ? <button onClick={() => void transition([selectedDocument.id], 'validate')} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-black">Valider</button> : null}{selectedDocument.kind === 'bulletin' && selectedDocument.status === 'validated' ? <button onClick={() => void transition([selectedDocument.id], 'authorize_print')} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-black">Autoriser l’impression</button> : null}<button onClick={() => void printCurrent(false)} className="ml-auto px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center gap-2"><Printer className="w-4 h-4" />Imprimer / PDF</button></div> : null}
                    {previewDocument ? <div ref={printRef}><AcademicDocumentPaper document={previewDocument} /></div> : <div className="h-full min-h-96 flex items-center justify-center text-center text-slate-500"><div><Eye className="w-12 h-12 mx-auto opacity-30 mb-3" /><p className="font-black">L’aperçu apparaîtra ici.</p><p className="text-xs mt-1">Les données calculées restent en lecture seule.</p></div></div>}
                  </section>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AcademicDocumentsModal;
