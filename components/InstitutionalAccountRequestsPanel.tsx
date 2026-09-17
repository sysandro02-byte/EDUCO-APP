import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, GraduationCap, Loader2, Mail, RefreshCw, RotateCw, ShieldCheck, UserCheck, XCircle } from 'lucide-react';
import type { InstitutionAccessContext } from '../src/institutional/accessConfig';
import {
  decideCabinetAccountRequest,
  decideHigherEducationCabinetRequest,
  listCabinetAccountRequests,
  listHigherEducationCabinetRequests,
  resendCabinetAccountDecisionEmail,
  type CabinetAccountRequest,
  type HigherEducationCabinetRequest,
} from '../src/services/cabinetAccountRequests';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente', UNDER_REVIEW: 'En instruction', APPROVED: 'Validée', REJECTED: 'Rejetée', CANCELLED: 'Annulée',
};
const statusClass = (status: string) => status === 'APPROVED'
  ? 'bg-emerald-100 text-emerald-800'
  : status === 'REJECTED'
    ? 'bg-rose-100 text-rose-800'
    : status === 'UNDER_REVIEW'
      ? 'bg-blue-100 text-blue-800'
      : 'bg-amber-100 text-amber-800';

const dateFr = (value?: string | null) => value ? new Date(value).toLocaleString('fr-FR') : '—';

const Detail = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 break-words text-sm font-semibold text-slate-700">{value || '—'}</div></div>
);

const NotificationBadge = ({ status }: { status?: string | null }) => {
  if (status === 'SENT') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700"><Mail className="h-3.5 w-3.5" /> E-mail envoyé</span>;
  if (status === 'FAILED') return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700"><AlertCircle className="h-3.5 w-3.5" /> E-mail en échec</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600"><Clock3 className="h-3.5 w-3.5" /> Notification en attente</span>;
};

const InstitutionalAccountRequestsPanel: React.FC<{ context: InstitutionAccessContext }> = ({ context }) => {
  const [tab, setTab] = useState<'accounts' | 'higher'>('accounts');
  const [accounts, setAccounts] = useState<CabinetAccountRequest[]>([]);
  const [higher, setHigher] = useState<HigherEducationCabinetRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const canViewHigher = context.ministry === 'MES';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [accountRows, higherRows] = await Promise.all([
        listCabinetAccountRequests(),
        canViewHigher ? listHigherEducationCabinetRequests() : Promise.resolve([]),
      ]);
      setAccounts(accountRows);
      setHigher(higherRows);
    } catch (loadError: any) {
      setError(loadError?.message || 'Impossible de charger les dossiers à valider.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [context.ministry]);

  const counts = useMemo(() => ({
    pending: accounts.filter((row) => ['PENDING', 'UNDER_REVIEW'].includes(row.status)).length,
    approved: accounts.filter((row) => row.status === 'APPROVED').length,
    rejected: accounts.filter((row) => row.status === 'REJECTED').length,
  }), [accounts]);

  const decideAccount = async (row: CabinetAccountRequest, decision: 'APPROVED' | 'REJECTED') => {
    const decisionLabel = decision === 'APPROVED' ? 'valider' : 'rejeter';
    if (!window.confirm(`Confirmer : ${decisionLabel} la demande de ${row.full_name} ?`)) return;
    setBusyId(row.id); setError('');
    try {
      const result = await decideCabinetAccountRequest(row.id, decision, notes[row.id] || '');
      if (result?.emailSent === false) {
        setError(`Décision enregistrée, mais l’e-mail n’a pas pu être envoyé : ${result?.emailError || 'erreur de messagerie'}.`);
      }
      await load();
    } catch (decisionError: any) {
      setError(decisionError?.message || 'Impossible d’enregistrer la décision.');
    } finally { setBusyId(null); }
  };

  const decideHigher = async (row: HigherEducationCabinetRequest, decision: 'APPROVED' | 'REJECTED') => {
    const decisionLabel = decision === 'APPROVED' ? 'valider l’instruction' : 'rejeter le dossier';
    if (!window.confirm(`Confirmer : ${decisionLabel} pour « ${row.official_name} » ?`)) return;
    setBusyId(row.id); setError('');
    try {
      const result = await decideHigherEducationCabinetRequest(row.id, decision, notes[row.id] || '');
      if (result?.emailSent === false) setError(`Décision enregistrée, e-mail en échec : ${result?.emailError || 'erreur de messagerie'}.`);
      await load();
    } catch (decisionError: any) { setError(decisionError?.message || 'Impossible d’enregistrer la décision.'); }
    finally { setBusyId(null); }
  };

  const resend = async (row: CabinetAccountRequest) => {
    setBusyId(row.id); setError('');
    try { await resendCabinetAccountDecisionEmail(row.id); await load(); }
    catch (mailError: any) { setError(mailError?.message || 'Impossible de renvoyer l’e-mail.'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white to-blue-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div><div className="text-xs font-black uppercase tracking-[0.17em] text-blue-600">{context.ministry} · Cabinet ministériel</div><h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">Dossiers à valider</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Les demandes des directions sous tutelle arrivent ici. Le cabinet vérifie les informations, valide ou rejette, puis EDUCO notifie le demandeur par e-mail.</p></div>
          <button type="button" onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser</button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3"><Detail label="À traiter" value={counts.pending} /><Detail label="Comptes validés" value={counts.approved} /><Detail label="Demandes rejetées" value={counts.rejected} /></section>

      {canViewHigher && <div className="flex w-fit gap-1 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => setTab('accounts')} className={`rounded-lg px-4 py-2 text-xs font-black ${tab === 'accounts' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Comptes sous tutelle</button><button type="button" onClick={() => setTab('higher')} className={`rounded-lg px-4 py-2 text-xs font-black ${tab === 'higher' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Établissements supérieurs</button></div>}

      {error && <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

      {loading ? <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white"><Loader2 className="h-8 w-8 animate-spin text-blue-500" /></div> : tab === 'higher' && canViewHigher ? (
        <div className="space-y-4">{higher.length ? higher.map((row) => (
          <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><GraduationCap className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-black text-slate-950">{row.official_name}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}>{STATUS_LABELS[row.status] || row.status}</span></div><p className="mt-2 text-xs text-slate-500">{row.institution_type === 'PUBLIC' ? 'Public' : 'Privé'} · {row.request_type} · reçu le {dateFr(row.created_at)}</p></div><NotificationBadge status={row.notification_status} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Responsable" value={row.legal_representative || row.promoter_or_initiator} /><Detail label="E-mail" value={row.official_email} /><Detail label="Département" value={row.department} /><Detail label="Capacité prévue" value={row.planned_capacity} /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2"><Detail label="Adresse" value={row.address} /><Detail label="Programmes" value={(row.programs || []).map((p: any) => typeof p === 'string' ? p : p?.label).filter(Boolean).join(' · ')} /></div>
            {['PENDING', 'UNDER_REVIEW'].includes(row.status) && <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Observation du cabinet</label><textarea rows={3} value={notes[row.id] || ''} onChange={(e) => setNotes(n => ({ ...n, [row.id]: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-400" placeholder="Motif, réserve ou observation à notifier…" /><div className="mt-3 flex flex-wrap justify-end gap-2"><button disabled={busyId === row.id} onClick={() => decideHigher(row, 'REJECTED')} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-700"><XCircle className="h-4 w-4" /> Rejeter</button><button disabled={busyId === row.id} onClick={() => decideHigher(row, 'APPROVED')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white"><CheckCircle2 className="h-4 w-4" /> Valider l’instruction</button></div></div>}
          </article>
        )) : <Empty />}</div>
      ) : (
        <div className="space-y-4">{accounts.length ? accounts.map((row) => (
          <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><UserCheck className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-black text-slate-950">{row.full_name}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}>{STATUS_LABELS[row.status] || row.status}</span></div><p className="mt-2 text-xs text-slate-500">{row.entity} · rôle demandé {row.requested_role} · reçu le {dateFr(row.created_at)}</p></div><NotificationBadge status={row.notification_status} /></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="E-mail officiel" value={row.official_email} /><Detail label="Téléphone" value={row.phone} /><Detail label="Matricule" value={row.employee_number} /><Detail label="Fonction" value={row.function_title} /><Detail label="Service / unité" value={row.service_unit} /><Detail label="Réf. nomination / affectation" value={row.appointment_reference} /><Detail label="Justification" value={row.justification} /><Detail label="Compte créé" value={row.account_uid ? 'Oui' : 'Non'} /></div>
            {row.review_notes && <div className="mt-3"><Detail label="Observation du cabinet" value={row.review_notes} /></div>}
            {['PENDING', 'UNDER_REVIEW'].includes(row.status) ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><label className="text-xs font-black uppercase tracking-wide text-slate-500">Observation du cabinet</label><textarea rows={3} value={notes[row.id] || ''} onChange={(e) => setNotes(n => ({ ...n, [row.id]: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-400" placeholder="Motif de validation/rejet à notifier au demandeur…" /><div className="mt-3 flex flex-wrap justify-end gap-2"><button disabled={busyId === row.id} onClick={() => decideAccount(row, 'REJECTED')} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-black text-rose-700"><XCircle className="h-4 w-4" /> Rejeter</button><button disabled={busyId === row.id} onClick={() => decideAccount(row, 'APPROVED')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white"><ShieldCheck className="h-4 w-4" /> Valider & activer</button></div></div> : row.notification_status === 'FAILED' && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3"><div className="text-xs text-rose-800">La décision est enregistrée, mais la notification e-mail a échoué.</div><button disabled={busyId === row.id} onClick={() => resend(row)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-black text-rose-700 shadow-sm"><RotateCw className="h-3.5 w-3.5" /> Renvoyer</button></div>}
          </article>
        )) : <Empty />}</div>
      )}
    </div>
  );
};

const Empty = () => <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center"><CheckCircle2 className="h-9 w-9 text-emerald-300" /><div className="mt-3 text-sm font-black text-slate-700">Aucun dossier dans cette file</div><p className="mt-1 text-xs text-slate-500">Les nouvelles demandes apparaîtront automatiquement ici.</p></div>;

export default InstitutionalAccountRequestsPanel;
