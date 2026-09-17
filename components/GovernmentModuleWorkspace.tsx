import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { InstitutionAccessContext } from '../src/institutional/accessConfig';
import {
  GOVERNMENT_DOMAIN_CONFIG,
  getGovernmentDomainForModule,
  type GovernmentDomain,
  type GovernmentDomainField,
} from '../src/institutional/governmentDomains';
import {
  deleteGovernmentRecord,
  listGovernmentRecordHistory,
  listGovernmentRecords,
  saveGovernmentRecord,
  transitionGovernmentRecord,
  type GovernmentRecord,
  type GovernmentRecordEvent,
} from '../src/services/governmentRecords';
import type { GovernmentWorkspaceSnapshot } from '../src/services/governmentWorkspace';

interface GovernmentModuleWorkspaceProps {
  context: InstitutionAccessContext;
  moduleName: string;
  entityLabel: string;
  snapshot: GovernmentWorkspaceSnapshot | null;
  loading: boolean;
}

type EditorState = {
  id?: number;
  status: string;
  title: string;
  reference: string;
  description: string;
  schoolId: string;
  dueDate: string;
  data: Record<string, string>;
};

const NEXT_STATUS: Record<string, string[]> = {
  Brouillon: ['Soumis'],
  Soumis: ['En cours', 'Rejeté'],
  'En cours': ['À valider', 'Rejeté'],
  'À valider': ['Validé', 'Rejeté'],
  Validé: ['Clôturé'],
  Rejeté: ['Brouillon'],
  Clôturé: [],
};

const emptyEditor = (): EditorState => ({
  status: 'Brouillon',
  title: '',
  reference: '',
  description: '',
  schoolId: '',
  dueDate: '',
  data: {},
});

const normalize = (value: unknown) => String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const statusClasses = (status: string) => {
  if (status === 'Validé' || status === 'Clôturé') return 'bg-emerald-100 text-emerald-800';
  if (status === 'Rejeté') return 'bg-rose-100 text-rose-800';
  if (status === 'À valider' || status === 'Soumis') return 'bg-amber-100 text-amber-800';
  if (status === 'En cours') return 'bg-blue-100 text-blue-800';
  return 'bg-slate-100 text-slate-700';
};

const toEditor = (record: GovernmentRecord): EditorState => ({
  id: record.id,
  status: record.status || 'Brouillon',
  title: record.title || '',
  reference: record.reference || '',
  description: record.description || '',
  schoolId: record.school_id == null ? '' : String(record.school_id),
  dueDate: record.due_date || '',
  data: Object.fromEntries(Object.entries(record.data || {}).map(([key, value]) => [key, value == null ? '' : String(value)])),
});

const castFieldValue = (field: GovernmentDomainField, value: string) => {
  if (!value.trim()) return undefined;
  if (field.type === 'number') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return value;
};

const GovernmentModuleWorkspace: React.FC<GovernmentModuleWorkspaceProps> = (props) => {
  const domain = getGovernmentDomainForModule(props.moduleName);
  if (!domain) return <ReadOnlyModuleWorkspace {...props} />;
  return <DomainWorkspace {...props} domain={domain} />;
};

const DomainWorkspace: React.FC<GovernmentModuleWorkspaceProps & { domain: GovernmentDomain }> = ({
  context,
  moduleName,
  entityLabel,
  snapshot,
  domain,
}) => {
  const config = GOVERNMENT_DOMAIN_CONFIG[domain];
  const [records, setRecords] = useState<GovernmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tous');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [history, setHistory] = useState<GovernmentRecordEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    try {
      setRecords(await listGovernmentRecords(context, domain));
    } catch (loadError: any) {
      setRecords([]);
      setError(loadError?.message || 'Impossible de charger les dossiers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
    setEditor(null);
    setHistory([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.ministry, context.entity, domain]);

  const filtered = useMemo(() => {
    const needle = normalize(query);
    return records.filter((record) => {
      if (statusFilter !== 'Tous' && record.status !== statusFilter) return false;
      if (!needle) return true;
      const school = snapshot?.schools.find((item) => Number(item.id) === Number(record.school_id));
      return [record.title, record.reference, record.description, record.status, school?.name]
        .some((value) => normalize(value).includes(needle));
    });
  }, [query, records, snapshot?.schools, statusFilter]);

  const statuses = useMemo(() => ['Tous', ...Array.from(new Set(records.map((record) => record.status).filter(Boolean)))], [records]);
  const counts = useMemo(() => ({
    total: records.length,
    draft: records.filter((record) => record.status === 'Brouillon').length,
    active: records.filter((record) => ['Soumis', 'En cours', 'À valider'].includes(record.status)).length,
    validated: records.filter((record) => ['Validé', 'Clôturé'].includes(record.status)).length,
  }), [records]);

  const openNew = () => {
    setEditor(emptyEditor());
    setHistory([]);
  };

  const openEdit = async (record: GovernmentRecord) => {
    setEditor(toEditor(record));
    setHistory([]);
    setHistoryLoading(true);
    try {
      setHistory(await listGovernmentRecordHistory(context, domain, record.id));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editor?.title.trim()) return;
    setSaving(true);
    setError('');
    try {
      const data: Record<string, unknown> = {};
      for (const field of config.fields) {
        const value = castFieldValue(field, editor.data[field.key] || '');
        if (value !== undefined) data[field.key] = value;
      }
      await saveGovernmentRecord(context, domain, {
        id: editor.id,
        title: editor.title.trim(),
        reference: editor.reference.trim(),
        description: editor.description.trim(),
        schoolId: editor.schoolId ? Number(editor.schoolId) : null,
        dueDate: editor.dueDate,
        data,
      });
      setEditor(null);
      await loadRecords();
    } catch (saveError: any) {
      setError(saveError?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (record: GovernmentRecord, status: string) => {
    setBusyId(record.id);
    setError('');
    try {
      await transitionGovernmentRecord(context, domain, record.id, status);
      await loadRecords();
      if (editor?.id === record.id) {
        const refreshed = (await listGovernmentRecords(context, domain)).find((item) => item.id === record.id);
        if (refreshed) setEditor(toEditor(refreshed));
        setHistory(await listGovernmentRecordHistory(context, domain, record.id));
      }
    } catch (transitionError: any) {
      setError(transitionError?.message || 'Transition impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (record: GovernmentRecord) => {
    if (!window.confirm(`Supprimer le dossier « ${record.title} » ?`)) return;
    setBusyId(record.id);
    setError('');
    try {
      await deleteGovernmentRecord(context, domain, record.id);
      if (editor?.id === record.id) setEditor(null);
      await loadRecords();
    } catch (deleteError: any) {
      setError(deleteError?.message || 'Suppression impossible.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{entityLabel}</div>
            <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">{moduleName}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{config.description}</p>
          </div>
          <button type="button" onClick={openNew} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Nouveau dossier
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Total" value={counts.total} />
        <Metric label="Brouillons" value={counts.draft} />
        <Metric label="En traitement" value={counts.active} />
        <Metric label="Validés / clôturés" value={counts.validated} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1 md:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher un dossier, une référence, un établissement…" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white" />
          </div>
          <div className="flex gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700">
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
            <button type="button" onClick={loadRecords} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50" aria-label="Actualiser"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
        </div>

        {error && <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

        <div className="mt-5 overflow-x-auto">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-blue-500" /></div>
          ) : filtered.length ? (
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-3">Dossier</th><th className="px-3 py-3">Établissement</th><th className="px-3 py-3">Échéance</th><th className="px-3 py-3">Statut</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {filtered.map((record) => {
                  const school = snapshot?.schools.find((item) => Number(item.id) === Number(record.school_id));
                  const nextStatuses = NEXT_STATUS[record.status] || [];
                  return (
                    <tr key={record.id} className="border-b border-slate-100 align-top last:border-0">
                      <td className="px-3 py-4"><button type="button" onClick={() => openEdit(record)} className="text-left"><div className="font-black text-slate-900 hover:text-blue-700">{record.title}</div><div className="mt-1 text-xs text-slate-500">{record.reference || `#${record.id}`}</div></button></td>
                      <td className="px-3 py-4 text-slate-600">{school?.name || '—'}</td>
                      <td className="px-3 py-4 text-slate-600">{record.due_date ? new Date(`${record.due_date}T00:00:00`).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-3 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${statusClasses(record.status)}`}>{record.status}</span></td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" onClick={() => openEdit(record)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" title="Modifier"><Pencil className="h-4 w-4" /></button>
                          {nextStatuses.map((status) => (
                            <button key={status} type="button" disabled={busyId === record.id} onClick={() => handleTransition(record, status)} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-black text-blue-700 hover:bg-blue-100 disabled:opacity-50">{status}<ArrowRight className="h-3.5 w-3.5" /></button>
                          ))}
                          {['Brouillon', 'Rejeté'].includes(record.status) && <button type="button" disabled={busyId === record.id} onClick={() => handleDelete(record)} className="rounded-lg border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Supprimer"><Trash2 className="h-4 w-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center"><ClipboardList className="h-8 w-8 text-slate-300" /><div className="mt-3 text-sm font-black text-slate-700">Aucun dossier</div><p className="mt-1 text-xs text-slate-500">Créez le premier dossier métier de ce module.</p></div>
          )}
        </div>
      </section>

      {editor && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true">
          <div className="max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
              <div><div className="text-xs font-black uppercase tracking-[0.15em] text-blue-600">{config.label}</div><h2 className="mt-1 text-xl font-black text-slate-950">{editor.id ? 'Modifier le dossier' : 'Nouveau dossier'}</h2></div>
              <button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Titre *"><input value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} className="input" placeholder="Intitulé du dossier" /></Field>
                  <Field label="Référence"><input value={editor.reference} onChange={(event) => setEditor({ ...editor, reference: event.target.value })} className="input" placeholder="Référence administrative" /></Field>
                  <Field label="Établissement associé"><select value={editor.schoolId} onChange={(event) => setEditor({ ...editor, schoolId: event.target.value })} className="input"><option value="">Aucun</option>{(snapshot?.schools || []).map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></Field>
                  <Field label="Échéance"><input type="date" value={editor.dueDate} onChange={(event) => setEditor({ ...editor, dueDate: event.target.value })} className="input" /></Field>
                </div>

                <Field label="Description"><textarea value={editor.description} onChange={(event) => setEditor({ ...editor, description: event.target.value })} className="input min-h-28 resize-y" placeholder="Résumé, objet et informations utiles…" /></Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  {config.fields.map((field) => (
                    <Field key={field.key} label={field.label}>
                      <input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'} value={editor.data[field.key] || ''} onChange={(event) => setEditor({ ...editor, data: { ...editor.data, [field.key]: event.target.value } })} className="input" placeholder={field.placeholder || field.label} />
                    </Field>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                  <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-500">Statut :</span><span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClasses(editor.status)}`}>{editor.status}</span></div>
                  <div className="flex gap-2"><button type="button" onClick={() => setEditor(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700">Annuler</button><button type="button" disabled={saving || !editor.title.trim()} onClick={handleSave} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button></div>
                </div>
              </div>

              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex items-center gap-2"><History className="h-4 w-4 text-blue-600" /><h3 className="text-sm font-black text-slate-900">Historique du workflow</h3></div>
                {!editor.id ? <p className="mt-4 text-xs leading-5 text-slate-500">L’historique apparaîtra après le premier enregistrement.</p> : historyLoading ? <Loader2 className="mt-5 h-5 w-5 animate-spin text-blue-500" /> : history.length ? <div className="mt-4 space-y-3">{history.map((event) => <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-3"><div className="text-xs font-black text-slate-800">{event.action}</div>{event.from_status !== event.to_status && <div className="mt-1 text-xs text-slate-500">{event.from_status || '—'} → {event.to_status || '—'}</div>}<div className="mt-1 text-[11px] text-slate-400">{event.created_at ? new Date(event.created_at).toLocaleString('fr-FR') : ''}</div></div>)}</div> : <p className="mt-4 text-xs text-slate-500">Aucun événement enregistré.</p>}

                {editor.id && (NEXT_STATUS[editor.status] || []).length > 0 && <div className="mt-5 border-t border-slate-200 pt-4"><div className="text-xs font-black uppercase tracking-wide text-slate-500">Étape suivante</div><div className="mt-3 flex flex-wrap gap-2">{(NEXT_STATUS[editor.status] || []).map((status) => <button key={status} type="button" disabled={busyId === editor.id} onClick={() => handleTransition({ id: editor.id!, ministry: context.ministry || '', entity: context.entity || '', title: editor.title, status: editor.status, reference: editor.reference, description: editor.description, school_id: editor.schoolId ? Number(editor.schoolId) : null, due_date: editor.dueDate, data: editor.data }, status)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50">{status}<ArrowRight className="h-3.5 w-3.5" /></button>)}</div></div>}
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReadOnlyModuleWorkspace: React.FC<GovernmentModuleWorkspaceProps> = ({ moduleName, entityLabel, snapshot, loading }) => {
  const summary = snapshot?.summary;
  const moduleKey = normalize(moduleName);
  const cards = moduleKey.includes('eleve') || moduleKey.includes('apprenant') || moduleKey.includes('etudiant')
    ? [['Élèves / apprenants', summary?.students || 0], ['Classes', summary?.classes || 0]]
    : moduleKey.includes('enseignant') || moduleKey.includes('personnel') || moduleKey.includes('agent') || moduleKey.includes('formateur')
      ? [['Personnel', summary?.personnel || 0], ['Utilisateurs actifs', summary?.users || 0]]
      : [['Établissements', summary?.schools || 0], ['Utilisateurs actifs', summary?.users || 0], ['Classes', summary?.classes || 0]];

  return <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"><div className="flex items-start gap-4"><div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><FileText className="h-6 w-6" /></div><div className="min-w-0 flex-1"><div className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{entityLabel}</div><h1 className="mt-1 text-2xl font-black text-slate-950">{moduleName}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Ce module exploite les données EDUCO déjà disponibles. Les registres métier spécialisés sont activés automatiquement sur les modules inspections, examens, agréments, RH, infrastructures, patrimoine, validations, projets, décisions et carte scolaire.</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{cards.map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : Number(value || 0).toLocaleString('fr-FR')}</div></div>)}</div></div></div></section>;
};

const Metric = ({ label, value }: { label: string; value: number }) => <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div><div className="mt-3 text-3xl font-black text-slate-950">{value.toLocaleString('fr-FR')}</div></div>;

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block"><span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>{children}</label>;

export default GovernmentModuleWorkspace;
