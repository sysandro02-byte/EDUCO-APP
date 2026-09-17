import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileText,
  Home,
  LogOut,
  Menu,
  Network,
  Settings,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { LogoIcon } from './Icons';
import {
  accessContextLabel,
  findInstitutionEntity,
  findMinistry,
  type InstitutionAccessContext,
} from '../src/institutional/accessConfig';

interface GovernmentDashboardProps {
  context: InstitutionAccessContext;
  user: { name?: string; role?: string; email?: string };
  onLogout: () => void | Promise<void>;
  onChangeSpace: () => void;
}

const GovernmentDashboard: React.FC<GovernmentDashboardProps> = ({
  context,
  user,
  onLogout,
  onChangeSpace,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeModule, setActiveModule] = useState('Tableau de bord');
  const ministry = useMemo(() => findMinistry(context.ministry), [context.ministry]);
  const entity = useMemo(() => findInstitutionEntity(context.ministry, context.entity), [context.ministry, context.entity]);

  if (!ministry || !entity) return null;

  const navModules = ['Tableau de bord', ...entity.modules];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-[#0b3152] text-white shadow-2xl transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white p-2"><LogoIcon /></div>
              <div>
                <div className="text-lg font-black">EDUCO</div>
                <div className="text-[11px] text-sky-100">{ministry.label} · {entity.shortLabel || entity.label}</div>
              </div>
            </div>
            <button type="button" onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-sky-100 lg:hidden" aria-label="Fermer le menu"><X className="h-5 w-5" /></button>
          </div>

          <nav className="max-h-[calc(100vh-150px)] space-y-1 overflow-y-auto p-3">
            {navModules.map((module, index) => {
              const Icon = index === 0 ? Home : index % 5 === 0 ? Database : index % 4 === 0 ? FileText : index % 3 === 0 ? Users : index % 2 === 0 ? BarChart3 : ClipboardCheck;
              const active = activeModule === module;
              return (
                <button
                  key={module}
                  type="button"
                  onClick={() => { setActiveModule(module); setSidebarOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-sky-50/85 hover:bg-white/10 hover:text-white'}`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
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
              <button type="button" className="relative rounded-xl border border-slate-200 p-2.5 text-slate-500" aria-label="Notifications"><Bell className="h-5 w-5" /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white" /></button>
              <div className="hidden text-right sm:block">
                <div className="text-sm font-black text-slate-800">{user.name || 'Utilisateur'}</div>
                <div className="text-xs text-slate-500">{user.role || accessContextLabel(context)}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">{String(user.name || 'U').charAt(0).toUpperCase()}</div>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8">
            {activeModule === 'Tableau de bord' ? (
              <DashboardOverview ministry={ministry.label} entity={entity} />
            ) : (
              <ModuleWorkspace moduleName={activeModule} entityLabel={entity.shortLabel || entity.label} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

const DashboardOverview = ({ ministry, entity }: { ministry: string; entity: NonNullable<ReturnType<typeof findInstitutionEntity>> }) => (
  <div className="space-y-6">
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-white to-blue-50 p-6 shadow-sm sm:p-8">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{ministry}</div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{entity.shortLabel || entity.label}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{entity.description}</p>
        </div>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200"><ShieldCheck className="h-8 w-8" /></div>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ['Données métier', '—', 'Branchées sur les sources EDUCO'],
        ['Dossiers actifs', '—', 'Selon les droits de la structure'],
        ['Alertes', '—', 'Calculées depuis les flux réels'],
        ['Rapports', '—', 'Générés depuis les données disponibles'],
      ].map(([label, value, detail], index) => {
        const Icon = [Database, ClipboardCheck, Bell, FileText][index];
        return (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div><div className="rounded-xl bg-blue-50 p-2 text-blue-600"><Icon className="h-5 w-5" /></div></div>
            <div className="mt-4 text-3xl font-black text-slate-950">{value}</div>
            <div className="mt-2 text-xs leading-5 text-slate-500">{detail}</div>
          </div>
        );
      })}
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Modules disponibles</h2>
            <p className="mt-1 text-xs text-slate-500">Les modules affichés sont déterminés par la structure sélectionnée et ses permissions.</p>
          </div>
          <Settings className="h-5 w-5 text-slate-400" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {entity.modules.map((module) => (
            <div key={module} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></div>
              <span className="text-sm font-bold text-slate-700">{module}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-violet-100 p-2 text-violet-700"><ClipboardCheck className="h-5 w-5" /></div>
          <div><h2 className="text-lg font-black text-slate-950">Actions métier</h2><p className="text-xs text-slate-500">Workflows prévus pour cette structure.</p></div>
        </div>
        <div className="space-y-3">
          {entity.workflows.map((workflow, index) => (
            <div key={workflow} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-black text-blue-700">{index + 1}</div>
              <span className="text-sm font-semibold text-slate-700">{workflow}</span>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="rounded-3xl border border-dashed border-blue-300 bg-blue-50 p-5">
      <div className="flex gap-3"><Building2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" /><div><div className="text-sm font-black text-blue-950">Aucune statistique fictive</div><p className="mt-1 text-xs leading-5 text-blue-800/80">Les cartes numériques restent volontairement à « — » tant que les agrégations nationales réelles ne sont pas raccordées aux API et aux vues Supabase correspondantes. Cela évite d’afficher des chiffres de démonstration comme s’ils étaient officiels.</p></div></div>
    </section>
  </div>
);

const ModuleWorkspace = ({ moduleName, entityLabel }: { moduleName: string; entityLabel: string }) => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <div className="flex items-start gap-4">
      <div className="rounded-2xl bg-blue-50 p-3 text-blue-700"><Database className="h-6 w-6" /></div>
      <div>
        <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-600">{entityLabel}</div>
        <h1 className="mt-1 text-2xl font-black text-slate-950">{moduleName}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Ce module est intégré au nouveau shell institutionnel. Les écrans opérationnels peuvent être raccordés progressivement aux services EDUCO existants sans dupliquer l’authentification ni les composants métier.</p>
      </div>
    </div>
  </section>
);

export default GovernmentDashboard;
