import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  Home,
  Loader2,
  LogOut,
  Menu,
  Network,
  RefreshCw,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { LogoIcon } from './Icons';
import GovernmentModuleWorkspace from './GovernmentModuleWorkspace';
import {
  accessContextLabel,
  findInstitutionEntity,
  findMinistry,
  type InstitutionAccessContext,
} from '../src/institutional/accessConfig';
import {
  fetchGovernmentWorkspaceSnapshot,
  type GovernmentWorkspaceSnapshot,
} from '../src/services/governmentWorkspace';

interface GovernmentDashboardProps {
  context: InstitutionAccessContext;
  user: { name?: string; role?: string; email?: string };
  onLogout: () => void | Promise<void>;
  onChangeSpace: () => void;
}

const GovernmentDashboard: React.FC<GovernmentDashboardProps> = ({ context, user, onLogout, onChangeSpace }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState('Tableau de bord');
  const [snapshot, setSnapshot] = useState<GovernmentWorkspaceSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ministry = useMemo(() => findMinistry(context.ministry), [context.ministry]);
  const entity = useMemo(() => findInstitutionEntity(context.ministry, context.entity), [context.ministry, context.entity]);

  const loadSnapshot = async () => {
    setLoading(true);
    setError('');
    try {
      setSnapshot(await fetchGovernmentWorkspaceSnapshot(context));
    } catch (loadError: any) {
      setSnapshot(null);
      setError(loadError?.message || 'Impossible de charger les données institutionnelles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.ministry, context.entity]);

  useEffect(() => {
    setActiveModule('Tableau de bord');
  }, [context.ministry, context.entity]);

  if (!ministry || !entity) return null;
  const navModules = ['Tableau de bord', ...entity.modules];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-[#0b3152] text-white shadow-2xl transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-2"><LogoIcon /></div>
              <div className="min-w-0">
                <div className="text-lg font-black">EDUCO</div>
                <div className="truncate text-[11px] text-sky-100">{ministry.label} · {entity.shortLabel || entity.label}</div>
              </div>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-sky-100 lg:hidden" aria-label="Fermer le menu"><X className="h-5 w-5" /></button>
          </div>

          <nav className="max-h-[calc(100vh-150px)] space-y-1 overflow-y-auto p-3">
            {navModules.map((module, index) => {
              const Icon = index === 0 ? Home : index % 5 === 0 ? Database : index % 4 === 0 ? FileText : index % 3 === 0 ? Users : index % 2 === 0 ? BarChart3 : ClipboardCheck;
              const active = activeModule === module;
              return (
                <button key={module} type="button" onClick={() => { setActiveModule(module); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-sky-50/85 hover:bg-white/10 hover:text-white'}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{module}</span>
                </button>
              );
            })}
          </nav>

          <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#082844] p-3">
            <button type="button" onClick={onChangeSpace} className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-bold text-sky-100 hover:bg-white/10"><Network className="h-4 w-4" />Changer d’espace</button>
            <button type="button" onClick={() => onLogout()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-bold text-rose-200 hover:bg-rose-500/10"><LogOut className="h-4 w-4" />Déconnexion</button>
          </div>
        </aside>

        {sidebarOpen && <button type="button" aria-label="Fermer le menu" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button>
              <div className="min-w-0">
                <div className="truncate text-xs font-black uppercase tracking-[0.16em] text-blue-600">République du Congo · {ministry.label}</div>
                <div className="mt-1 truncate text-lg font-black text-slate-950 sm:text-xl">{entity.label}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <button type="button" onClick={loadSnapshot} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50" aria-label="Actualiser les données"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
              <button type="button" className="rounded-xl border border-slate-200 p-2.5 text-slate-500" aria-label="Notifications"><Bell className="h-5 w-5" /></button>
              <div className="hidden text-right sm:block"><div className="text-sm font-black text-slate-800">{user.name || 'Utilisateur'}</div><div className="text-xs text-slate-500">{user.role || accessContextLabel(context)}</div></div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">{String(user.name || 'U').charAt(0).toUpperCase()}</div>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8">
            {error ? <DataError message={error} onRetry={loadSnapshot} /> : activeModule === 'Tableau de bord' ? (
              <DashboardOverview ministry={ministry.label} entity={entity} snapshot={snapshot} loading={loading} />
            ) : (
              <GovernmentModuleWorkspace context={context} moduleName={activeModule} entityLabel={entity.shortLabel || entity.label} snapshot={snapshot} loading={loading} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

const formatNumber = (value?: number | null) => new Intl.NumberFormat('fr-FR').format(Number(value || 0));
const formatMoney = (value?: number | null) => `${formatNumber(value)} FCFA`;

const DashboardOverview = ({ ministry, entity, snapshot, loading }: {
  ministry: string;
  entity: NonNullable<ReturnType<typeof findInstitutionEntity>>;
  snapshot: GovernmentWorkspaceSnapshot | null;
  loading: boolean;
}) => {
  const summary = snapshot?.summary;
  const cards = [
    ['Établissements', summary?.schools, `${formatNumber(summary?.activeSchools)} actifs`, Building2],
    ['Utilisateurs actifs', summary?.users, 'Comptes EDUCO actifs', Users],
    ['Élèves enregistrés', summary?.students, 'Données consolidées', ClipboardCheck],
    ['Personnel', summary?.personnel, 'Personnel enregistré', ShieldCheck],
    ['Classes', summary?.classes, 'Classes actives', Database],
    ['Paiements', summary?.paymentsCount, formatMoney(summary?.paymentsTotal), Wallet],
    ['Présences', summary?.attendanceRecords, 'Enregistrements réels', CheckCircle2],
    ['Notes', summary?.gradesRecords, 'Enregistrements réels', BarChart3],
  ] as const;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white to-blue-50 p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div><div className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{ministry}</div><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{entity.shortLabel || entity.label}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{entity.description}</p>{snapshot?.generatedAt && <p className="mt-3 text-xs font-semibold text-slate-400">Dernière consolidation : {new Date(snapshot.generatedAt).toLocaleString('fr-FR')}</p>}</div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200"><ShieldCheck className="h-8 w-8" /></div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, detail, Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div><div className="rounded-xl bg-blue-50 p-2 text-blue-600"><Icon className="h-5 w-5" /></div></div><div className="mt-4 text-3xl font-black text-slate-950">{loading ? <Loader2 className="h-7 w-7 animate-spin text-slate-300" /> : formatNumber(value)}</div><div className="mt-2 text-xs leading-5 text-slate-500">{detail}</div></div>)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-lg font-black text-slate-950">Établissements EDUCO</h2><p className="mt-1 text-xs text-slate-500">Données réellement présentes dans la base centrale.</p></div><Building2 className="h-5 w-5 text-slate-400" /></div><SchoolTable schools={snapshot?.schools || []} loading={loading} /></div>
        <div className="space-y-6">
          <ListPanel title="Répartition des comptes" loading={loading} items={(snapshot?.roles || []).map((item) => ({ label: item.role, value: item.count }))} />
          <ListPanel title="Niveaux de classes" loading={loading} items={(snapshot?.classLevels || []).map((item) => ({ label: item.level, value: item.count }))} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-slate-950">Situation financière consolidée</h2><div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1"><FinancialRow label="Paiements encaissés" value={formatMoney(summary?.paymentsTotal)} /><FinancialRow label="Recettes enregistrées" value={formatMoney(summary?.incomeTotal)} /><FinancialRow label="Dépenses enregistrées" value={formatMoney(summary?.expenseTotal)} /></div></div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-slate-950">Activité récente</h2><div className="mt-4 space-y-3">{loading ? <Loader2 className="h-6 w-6 animate-spin text-slate-300" /> : snapshot?.recentActivity?.length ? snapshot.recentActivity.map((item, index) => <div key={`${item.createdAt}-${index}`} className="rounded-xl border border-slate-100 px-4 py-3"><div className="text-sm font-bold text-slate-800">{item.action}</div><div className="mt-1 text-xs text-slate-500">{item.schoolName || 'EDUCO'}{item.userRole ? ` · ${item.userRole}` : ''}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString('fr-FR')}` : ''}</div></div>) : <EmptyState />}</div></div>
      </section>

      <section className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50 p-5"><div className="flex gap-3"><Database className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /><div><div className="text-sm font-black text-emerald-950">Données réelles connectées</div><p className="mt-1 text-xs leading-5 text-emerald-800/80">Les indicateurs viennent des tables EDUCO de Supabase. Les modules métier spécialisés utilisent leurs propres registres sécurisés et leurs workflows audités.</p></div></div></section>
    </div>
  );
};

const SchoolTable = ({ schools, loading }: { schools: GovernmentWorkspaceSnapshot['schools']; loading: boolean }) => {
  if (loading) return <div className="flex min-h-44 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-slate-300" /></div>;
  if (!schools.length) return <EmptyState />;
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-3">Établissement</th><th className="px-3 py-3">Identifiant</th><th className="px-3 py-3">Statut</th></tr></thead><tbody>{schools.slice(0, 20).map((school) => <tr key={school.id} className="border-b border-slate-100 last:border-0"><td className="px-3 py-3 font-bold text-slate-800">{school.name}</td><td className="px-3 py-3 text-slate-500">{school.identifier || '—'}</td><td className="px-3 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{school.status || 'active'}</span></td></tr>)}</tbody></table></div>;
};

const ListPanel = ({ title, loading, items }: { title: string; loading: boolean; items: Array<{ label: string; value: number }> }) => <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black text-slate-950">{title}</h2><div className="mt-4 space-y-3">{loading ? <Loader2 className="h-6 w-6 animate-spin text-slate-300" /> : items.length ? items.map((item) => <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"><span className="text-sm font-semibold text-slate-700">{item.label}</span><span className="text-sm font-black text-slate-950">{formatNumber(item.value)}</span></div>) : <EmptyState />}</div></div>;

const FinancialRow = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-xl font-black text-slate-950">{value}</div></div>;

const EmptyState = () => <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs font-semibold text-slate-400">Aucune donnée enregistrée.</div>;

const DataError = ({ message, onRetry }: { message: string; onRetry: () => void }) => <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /><div><div className="font-black text-rose-900">Données institutionnelles indisponibles</div><p className="mt-1 text-sm text-rose-700">{message}</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white"><RefreshCw className="h-4 w-4" />Réessayer</button></div></div></div>;

export default GovernmentDashboard;
