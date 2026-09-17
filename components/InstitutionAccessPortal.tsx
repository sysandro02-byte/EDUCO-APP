import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  GraduationCap,
  Landmark,
  School,
  ShieldCheck,
  X,
} from 'lucide-react';
import { LogoIcon } from './Icons';
import {
  MINISTRIES,
  SCHOOL_ACCESS_OPTIONS,
  UNIVERSITY_ACCESS_OPTIONS,
  type InstitutionAccessContext,
  type MinistryCode,
} from '../src/institutional/accessConfig';

type PortalStep = 'ROOT' | 'STATE' | 'SCHOOL' | 'UNIVERSITY';

interface InstitutionAccessPortalProps {
  onSelect: (context: InstitutionAccessContext) => void;
}

const InstitutionAccessPortal: React.FC<InstitutionAccessPortalProps> = ({ onSelect }) => {
  const [step, setStep] = useState<PortalStep>('ROOT');
  const [openMinistry, setOpenMinistry] = useState<MinistryCode | null>(null);

  const ministry = useMemo(
    () => MINISTRIES.find((item) => item.code === openMinistry) || null,
    [openMinistry],
  );

  const goBack = () => {
    if (openMinistry) {
      setOpenMinistry(null);
      return;
    }
    setStep('ROOT');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eff8ff,_#e7f2f8_45%,_#dbeaf3)] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1500px] grid-cols-1 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-100 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
          <div className="relative z-10 flex h-full min-h-[380px] flex-col justify-between">
            <div>
              <div className="mb-10 flex items-center gap-4">
                <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200"><LogoIcon /></div>
                <div>
                  <div className="text-3xl font-black tracking-tight text-blue-950">EDUCO</div>
                  <div className="text-sm font-medium text-slate-500">Une éducation mieux gérée, un avenir plus grand</div>
                </div>
              </div>

              <h1 className="max-w-2xl text-4xl font-black leading-tight text-blue-950 sm:text-5xl">
                La plateforme éducative <span className="text-blue-600">au service de tous</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                Un point d’accès commun pour l’État, les écoles et les universités, sans modifier les mécanismes d’authentification et les fonctionnalités métier déjà présents dans EDUCO.
              </p>

              <div className="mt-10 grid max-w-xl grid-cols-3 gap-3">
                {[
                  ['Pilotage', 'Données consolidées'],
                  ['Sécurité', 'Accès contrôlés'],
                  ['Interopérabilité', 'Un système unifié'],
                ].map(([title, description]) => (
                  <div key={title} className="rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm backdrop-blur">
                    <ShieldCheck className="mb-3 h-6 w-6 text-blue-600" />
                    <div className="text-sm font-extrabold text-blue-950">{title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 text-sm font-semibold text-slate-500">République du Congo · Portail institutionnel EDUCO</div>
          </div>

          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-blue-300/20 blur-3xl" />
          <div className="absolute right-10 top-20 h-48 w-48 rounded-full bg-emerald-200/20 blur-3xl" />
        </aside>

        <main className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
          <section className="w-full max-w-4xl rounded-[32px] border border-white/80 bg-white/95 p-6 shadow-2xl shadow-slate-300/40 backdrop-blur sm:p-9 lg:p-12">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700"><LogoIcon /></div>
                <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Bienvenue sur EDUCO</h2>
                <p className="mt-2 text-sm text-slate-500 sm:text-base">
                  {step === 'ROOT' && 'Choisissez votre espace avant de vous connecter.'}
                  {step === 'STATE' && 'Choisissez votre ministère.'}
                  {step === 'SCHOOL' && 'Choisissez le type d’enseignement de votre établissement.'}
                  {step === 'UNIVERSITY' && 'Choisissez le type d’université.'}
                </p>
              </div>
              {step !== 'ROOT' && (
                <button
                  type="button"
                  onClick={goBack}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  <ArrowLeft className="h-4 w-4" /> Retour
                </button>
              )}
            </div>

            {step === 'ROOT' && (
              <div className="grid gap-4 md:grid-cols-3">
                <PortalCard
                  title="État"
                  subtitle="Administration publique"
                  icon={<Landmark className="h-10 w-10" />}
                  accent="blue"
                  onClick={() => setStep('STATE')}
                />
                <PortalCard
                  title="Écoles"
                  subtitle="Publiques & privées"
                  icon={<School className="h-10 w-10" />}
                  accent="emerald"
                  onClick={() => setStep('SCHOOL')}
                />
                <PortalCard
                  title="Université"
                  subtitle="Enseignement supérieur"
                  icon={<GraduationCap className="h-10 w-10" />}
                  accent="violet"
                  onClick={() => setStep('UNIVERSITY')}
                />
              </div>
            )}

            {step === 'STATE' && (
              <div className="grid gap-4 md:grid-cols-3">
                {MINISTRIES.map((item) => (
                  <PortalCard
                    key={item.code}
                    title={item.label}
                    subtitle={item.description}
                    icon={<Landmark className="h-9 w-9" />}
                    accent={item.code === 'MEPSA' ? 'blue' : item.code === 'MES' ? 'violet' : 'amber'}
                    onClick={() => setOpenMinistry(item.code)}
                  />
                ))}
              </div>
            )}

            {step === 'SCHOOL' && (
              <div className="grid gap-4 md:grid-cols-2">
                {SCHOOL_ACCESS_OPTIONS.map((option) => (
                  <PortalCard
                    key={option.code}
                    title={option.label}
                    subtitle={option.description}
                    icon={<School className="h-9 w-9" />}
                    accent={option.code === 'GENERAL' ? 'emerald' : 'amber'}
                    onClick={() => onSelect({
                      sector: 'SCHOOL',
                      schoolType: option.code,
                      label: option.label,
                    })}
                  />
                ))}
              </div>
            )}

            {step === 'UNIVERSITY' && (
              <div className="grid gap-4 md:grid-cols-2">
                {UNIVERSITY_ACCESS_OPTIONS.map((option) => (
                  <PortalCard
                    key={option.code}
                    title={option.label}
                    subtitle={option.description}
                    icon={<GraduationCap className="h-9 w-9" />}
                    accent={option.code === 'PUBLIC' ? 'blue' : 'violet'}
                    onClick={() => onSelect({
                      sector: 'UNIVERSITY',
                      universityType: option.code,
                      label: option.label,
                    })}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {ministry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Sélection ${ministry.label}`}>
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/20 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:px-8">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{ministry.label}</div>
                <h3 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">Sélectionnez votre structure</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{ministry.fullName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenMinistry(null)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[calc(92vh-120px)] overflow-y-auto p-5 sm:p-8">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ministry.entities.map((entity) => (
                  <button
                    key={entity.code}
                    type="button"
                    onClick={() => onSelect({
                      sector: 'STATE',
                      ministry: ministry.code,
                      entity: entity.code,
                      label: `${entity.shortLabel || entity.label} / ${ministry.label}`,
                    })}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg"
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Building2 className="h-6 w-6" /></div>
                      <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600" />
                    </div>
                    <div className="text-base font-black text-slate-950">{entity.shortLabel || entity.label}</div>
                    {entity.shortLabel && <div className="mt-1 text-xs font-semibold text-slate-500">{entity.label}</div>}
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-500">{entity.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PortalCard = ({
  title,
  subtitle,
  icon,
  accent,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: 'blue' | 'emerald' | 'violet' | 'amber';
  onClick: () => void;
}) => {
  const accentClasses = {
    blue: 'border-blue-200 bg-blue-50/50 text-blue-700 hover:border-blue-400',
    emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:border-emerald-400',
    violet: 'border-violet-200 bg-violet-50/50 text-violet-700 hover:border-violet-400',
    amber: 'border-amber-200 bg-amber-50/50 text-amber-700 hover:border-amber-400',
  }[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group min-h-52 rounded-3xl border p-6 text-left shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-xl ${accentClasses}`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">{icon}</div>
      <div className="mt-7 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-black text-slate-950">{title}</div>
          <div className="mt-2 text-sm font-medium leading-6 text-slate-500">{subtitle}</div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition group-hover:translate-x-1"><ArrowRight className="h-5 w-5" /></div>
      </div>
    </button>
  );
};

export default InstitutionAccessPortal;
