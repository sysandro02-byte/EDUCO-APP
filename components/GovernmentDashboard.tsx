import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Database,
  FileText,
  GraduationCap,
  Home,
  Landmark,
  Loader2,
  Map,
  Menu,
  RefreshCw,
  School,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { LogoIcon } from './Icons';
import GovernmentModuleWorkspace from './GovernmentModuleWorkspace';
import InstitutionalAccountRequestsPanel from './InstitutionalAccountRequestsPanel';
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

const PUPIL_IMAGE = 'https://static.africa-press.net/congo-brazzaville/sites/51/2023/08/sm_1691172539.260659.jpg';
const STUDENT_IMAGE = 'https://www.adiac-congo.com/sites/default/files/033.jpg';

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

  useEffect(() => setActiveModule('Tableau de bord'), [context.ministry, context.entity]);

  if (!ministry || !entity) return null;

  const navModules = ['Tableau de bord', ...entity.modules];
  const isMES = ministry.code === 'MES';

  return (
    <div className="min-h-screen bg-[#eef6fb] text-slate-900">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-50 w-[258px] transform overflow-hidden bg-gradient-to-b from-[#0b4a6b] via-[#0c5676] to-[#073a58] text-white shadow-2xl transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="relative z-10 flex h-[90px] items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-2"><LogoIcon /></div>
              <div>
                <div className="text-xl font-black">EDUCO</div>
                <div className="text-[10px] leading-4 text-sky-100">Une éducation mieux gérée,<br />un avenir plus grand</div>
              </div>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-sky-100 lg:hidden" aria-label="Fermer le menu"><X className="h-5 w-5" /></button>
          </div>

          <nav className="relative z-10 max-h-[calc(100vh-250px)] space-y-1 overflow-y-auto px-3 py-4">
            {navModules.map((module, index) => {
              const Icon = iconForModule(module, index);
              const active = activeModule === module;
              return (
                <button
                  key={module}
                  type="button"
                  onClick={() => { setActiveModule(module); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-[13px] font-semibold transition ${active ? 'bg-gradient-to-r from-[#16b5b8] to-[#2496b6] text-white shadow-lg shadow-black/10' : 'text-sky-50/90 hover:bg-white/10 hover:text-white'}`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{module}</span>
                </button>
              );
            })}
          </nav>

          <div className="absolute inset-x-0 bottom-0 h-48 overflow-hidden">
            <img src={isMES ? STUDENT_IMAGE : PUPIL_IMAGE} alt={isMES ? 'Étudiant congolais' : 'Élèves congolais en tenue scolaire'} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#073a58] via-[#073a58]/30 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="text-center font-serif text-[18px] italic leading-5 text-white">L’éducation d’aujourd’hui,<br />les opportunités de demain !</div>
              <div className="mx-auto mt-3 h-px w-36 bg-white/50" />
            </div>
          </div>
        </aside>

        {sidebarOpen && <button type="button" aria-label="Fermer le menu" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label="Ouvrir le menu"><Menu className="h-5 w-5" /></button>
                <div className="rounded-xl bg-[#e9f5ff] p-2.5"><LogoIcon /></div>
                <div className="min-w-0">
                  <div className="truncate text-[29px] font-black tracking-[-0.035em] text-[#082c65]">EDUCO – Espace {ministry.label}</div>
                  <div className="truncate text-sm font-bold text-slate-600">{ministry.fullName}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">{entity.label} · {entity.description}</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 xl:justify-end">
                <CongoFlag />
                <button type="button" onClick={loadSnapshot} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm hover:bg-slate-50" aria-label="Actualiser"><RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} /></button>
                <button type="button" className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm" aria-label="Notifications"><Bell className="h-5 w-5" /><span className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[9px] font-black leading-4 text-white">!</span></button>
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dff1f8] text-xs font-black text-[#0b5676]">{String(user.name || 'U').slice(0, 2).toUpperCase()}</div>
                  <div className="hidden sm:block"><div className="text-xs font-black text-slate-800">{user.name || 'Utilisateur'}</div><div className="text-[10px] text-slate-500">{user.role || accessContextLabel(context)}</div></div>
                </div>
              </div>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-7">
            {error ? <DataError message={error} onRetry={loadSnapshot} /> : context.entity === 'CABINET' && activeModule === 'Dossiers à valider' ? (
              <InstitutionalAccountRequestsPanel context={context} />
            ) : activeModule === 'Tableau de bord' ? (
              <DashboardOverview entity={entity} snapshot={snapshot} loading={loading} isMES={isMES} />
            ) : (
              <GovernmentModuleWorkspace context={context} moduleName={activeModule} entityLabel={entity.shortLabel || entity.label} snapshot={snapshot} loading={loading} />
            )}
          </main>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-6 py-3 text-[11px] text-slate-400">
            <span>République du Congo · EDUCO</span>
            <div className="flex gap-2"><button type="button" onClick={onChangeSpace} className="font-bold text-[#0b5676]">Changer d’espace</button><span>·</span><button type="button" onClick={() => onLogout()} className="font-bold text-rose-500">Déconnexion</button></div>
          </footer>
        </div>
      </div>
    </div>
  );
};

const DashboardOverview = ({ entity, snapshot, loading, isMES }: {
  entity: NonNullable<ReturnType<typeof findInstitutionEntity>>;
  snapshot: GovernmentWorkspaceSnapshot | null;
  loading: boolean;
  isMES: boolean;
}) => {
  const summary = snapshot?.summary;
  const quickModules = entity.modules.slice(0, 12);
  const priorities = entity.workflows.slice(0, 5);
  const cards = [
    ['Établissements', summary?.schools, `${formatNumber(summary?.activeSchools)} actifs`, Building2, 'bg-[#dff0ff] text-[#1682e5]'],
    [isMES ? 'Étudiants / usagers' : 'Élèves', summary?.students, 'Données consolidées', Users, 'bg-[#dcf7ef] text-[#0aae82]'],
    ['Personnel', summary?.personnel, 'Personnel enregistré', UserRound, 'bg-[#efe6ff] text-[#8352d8]'],
    ['Classes / structures', summary?.classes, 'Enregistrements actifs', BookOpen, 'bg-[#dcf8f7] text-[#13aaa6]'],
  ] as const;

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[#d7ebf8] bg-gradient-to-r from-[#e8f6ff] via-[#f6fbff] to-[#def1f7] p-5 shadow-sm sm:p-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-[#0d5476] shadow-sm"><Landmark className="h-8 w-8" /></div>
          <div>
            <h1 className="text-2xl font-black tracking-[-0.025em] text-[#0b4d72]">Bienvenue dans l’espace {entity.shortLabel || entity.label}</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Une plateforme intégrée au service du pilotage, du suivi et de la coordination de cette structure institutionnelle.</p>
          </div>
        </div>
        <div className="absolute right-5 top-2 hidden max-w-[260px] text-right font-serif text-xl italic text-[#0b4d72]/70 lg:block">« Former aujourd’hui<br />le Congo de demain ! »</div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, detail, Icon, style]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style}`}><Icon className="h-6 w-6" /></div>
              <div><div className="text-xs font-black text-slate-600">{label}</div><div className="mt-1 text-2xl font-black text-[#082c65]">{loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-300" /> : formatNumber(value)}</div><div className="mt-1 text-[10px] font-semibold text-emerald-600">{detail}</div></div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-5 2xl:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-black text-[#082c65]">Accès rapide aux modules</h2><p className="mt-1 text-xs text-slate-400">Fonctions disponibles pour {entity.shortLabel || entity.label}.</p></div><span className="text-xs font-black text-[#1682e5]">Tous les modules →</span></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickModules.map((module, index) => {
              const Icon = iconForModule(module, index + 1);
              return (
                <div key={module} className="group min-h-[140px] rounded-xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-3"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${moduleAccent(index)}`}><Icon className="h-5 w-5" /></div><span className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-sky-500">›</span></div>
                  <div className="mt-3 text-sm font-black leading-5 text-[#0b4d72]">{module}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">Accéder aux données, dossiers, suivis et actions disponibles.</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><h2 className="text-sm font-black text-[#0b4d72]">Priorités de la structure</h2><Target className="h-4 w-4 text-[#1682e5]" /></div>
            <div className="mt-3 space-y-2">
              {priorities.length ? priorities.map((priority, index) => (
                <div key={priority} className="flex gap-3 rounded-xl border border-slate-100 p-3">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white ${priorityColor(index)}`}>{index + 1}</div>
                  <div><div className="text-xs font-black leading-4 text-slate-700">{priority}</div><div className="mt-1 text-[10px] leading-4 text-slate-400">Workflow institutionnel disponible dans EDUCO.</div></div>
                </div>
              )) : <EmptyState />}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-black text-[#0b4d72]"><Sparkles className="h-4 w-4 text-[#1682e5]" /> Fonctionnalités clés</div>
            <div className="mt-3 rounded-xl bg-[#eef8ff] p-3 text-[11px] leading-5 text-slate-600">L’espace centralise les données utiles à la gouvernance de la structure : établissements, effectifs, personnel, dossiers, activités, rapports et suivi opérationnel.</div>
            <div className="mt-3 space-y-2 text-[11px] text-slate-600">{['Données fiables et centralisées', 'Pilotage et aide à la décision', 'Suivi des politiques éducatives', 'Collaboration entre les acteurs'].map((item) => <div key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{item}</div>)}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Panel title="Établissements EDUCO"><SchoolTable schools={snapshot?.schools || []} loading={loading} /></Panel>
        <Panel title="Répartition des comptes"><ListPanel loading={loading} items={(snapshot?.roles || []).map((item) => ({ label: item.role, value: item.count }))} /></Panel>
        <Panel title="Activité récente"><div className="space-y-2">{loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-300" /> : snapshot?.recentActivity?.length ? snapshot.recentActivity.slice(0, 5).map((item, index) => <div key={`${item.createdAt}-${index}`} className="rounded-xl bg-slate-50 px-3 py-2.5"><div className="text-xs font-black text-slate-700">{item.action}</div><div className="mt-1 text-[10px] text-slate-400">{item.schoolName || 'EDUCO'}{item.createdAt ? ` · ${new Date(item.createdAt).toLocaleString('fr-FR')}` : ''}</div></div>) : <EmptyState />}</div></Panel>
      </section>
    </div>
  );
};

const iconForModule = (module: string, index: number) => {
  const value = module.toLowerCase();
  if (value.includes('carte')) return Map;
  if (value.includes('établissement') || value.includes('université') || value.includes('lycée') || value.includes('collège')) return School;
  if (value.includes('élève') || value.includes('étudiant') || value.includes('apprenant') || value.includes('personnel') || value.includes('enseignant')) return Users;
  if (value.includes('examen') || value.includes('diplôme') || value.includes('bepc') || value.includes('baccalauréat')) return GraduationCap;
  if (value.includes('inspection') || value.includes('audit') || value.includes('qualité')) return ShieldCheck;
  if (value.includes('budget') || value.includes('finance') || value.includes('subvention')) return Coins;
  if (value.includes('infrastructure') || value.includes('équipement') || value.includes('maintenance')) return Wrench;
  if (value.includes('rapport') || value.includes('document') || value.includes('archive')) return FileText;
  if (value.includes('calendrier') || value.includes('agenda')) return CalendarDays;
  if (value.includes('statistique') || value.includes('indicateur')) return BarChart3;
  if (index === 0) return Home;
  return index % 3 === 0 ? ClipboardCheck : Database;
};

const moduleAccent = (index: number) => ['bg-blue-50 text-blue-600', 'bg-emerald-50 text-emerald-600', 'bg-violet-50 text-violet-600', 'bg-orange-50 text-orange-600'][index % 4];
const priorityColor = (index: number) => ['bg-sky-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500', 'bg-indigo-500'][index % 5];
const formatNumber = (value?: number | null) => new Intl.NumberFormat('fr-FR').format(Number(value || 0));

const CongoFlag = () => (
  <div className="hidden items-center gap-3 md:flex">
    <div className="relative h-12 w-[76px] overflow-hidden rounded-sm border border-slate-200 shadow-sm">
      <div className="absolute inset-0 bg-[#dc241f]" />
      <div className="absolute -left-5 top-0 h-20 w-16 rotate-[32deg] bg-[#009543]" />
      <div className="absolute left-[22px] top-[-18px] h-24 w-10 rotate-[32deg] bg-[#fbde4a]" />
    </div>
    <div><div className="text-[10px] font-black uppercase text-[#0b3152]">République du Congo</div><div className="text-[9px] text-slate-400">Un peuple debout,<br />une nation plus forte</div></div>
  </div>
);

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-black text-[#0b4d72]">{title}</h3>{children}</div>;

const SchoolTable = ({ schools, loading }: { schools: GovernmentWorkspaceSnapshot['schools']; loading: boolean }) => {
  if (loading) return <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>;
  if (!schools.length) return <EmptyState />;
  return <div className="space-y-2">{schools.slice(0, 5).map((school) => <div key={school.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><div className="min-w-0"><div className="truncate text-xs font-black text-slate-700">{school.name}</div><div className="text-[10px] text-slate-400">{school.identifier || '—'}</div></div><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-600">{school.status || 'active'}</span></div>)}</div>;
};

const ListPanel = ({ loading, items }: { loading: boolean; items: Array<{ label: string; value: number }> }) => <div className="space-y-2">{loading ? <Loader2 className="h-5 w-5 animate-spin text-slate-300" /> : items.length ? items.slice(0, 6).map((item) => <div key={item.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="truncate text-xs font-semibold text-slate-600">{item.label}</span><span className="text-xs font-black text-[#082c65]">{formatNumber(item.value)}</span></div>) : <EmptyState />}</div>;
const EmptyState = () => <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-[11px] font-semibold text-slate-400">Aucune donnée enregistrée.</div>;
const DataError = ({ message, onRetry }: { message: string; onRetry: () => void }) => <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" /><div><div className="font-black text-rose-900">Données institutionnelles indisponibles</div><p className="mt-1 text-sm text-rose-700">{message}</p><button type="button" onClick={onRetry} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white"><RefreshCw className="h-4 w-4" />Réessayer</button></div></div></div>;

export default GovernmentDashboard;
