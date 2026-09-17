import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  GraduationCap,
  Landmark,
  School,
  ShieldCheck,
  Users,
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

const PUPIL_IMAGE = 'https://static.africa-press.net/congo-brazzaville/sites/51/2023/08/sm_1691172539.260659.jpg';
const STUDENT_IMAGE = 'https://www.adiac-congo.com/sites/default/files/033.jpg';

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

  const visualImage = step === 'UNIVERSITY' ? STUDENT_IMAGE : PUPIL_IMAGE;

  return (
    <div className="min-h-screen overflow-hidden bg-[#eaf5fc] text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[1fr_1.02fr]">
        <aside className="relative overflow-hidden bg-[linear-gradient(135deg,#f2fbff_0%,#d8eefb_58%,#cfe8f4_100%)] px-6 pb-0 pt-7 sm:px-10 lg:px-14 lg:pt-9">
          <div className="relative z-20 flex items-center gap-4">
            <div className="rounded-2xl bg-white/80 p-2 shadow-sm ring-1 ring-white"><LogoIcon /></div>
            <div>
              <div className="text-3xl font-black tracking-tight text-[#082c65] sm:text-4xl">EDUCO</div>
              <div className="mt-0.5 text-sm font-semibold leading-5 text-slate-500">Une éducation mieux gérée,<br />un avenir plus grand</div>
            </div>
          </div>

          <div className="relative z-20 mt-12 max-w-xl lg:mt-14">
            <h1 className="text-[42px] font-black leading-[0.98] tracking-[-0.04em] text-[#082c65] sm:text-5xl lg:text-[56px]">
              La plateforme éducative<br /><span className="text-[#0f7af3]">au service de tous</span>
            </h1>
            <p className="mt-6 max-w-lg text-base font-medium leading-7 text-slate-600 sm:text-lg">
              Une solution complète pour le Ministère, les universités, les écoles publiques et privées. Gestion scolaire, administrative, pédagogique et financière, en toute simplicité.
            </p>
          </div>

          <div className="relative z-20 mt-8 grid max-w-xl grid-cols-3 gap-4">
            <Feature icon={<Users className="h-7 w-7" />} title="Efficacité" detail="Une gestion centralisée" accent="emerald" />
            <Feature icon={<ShieldCheck className="h-7 w-7" />} title="Sécurité" detail="Vos données en toute confiance" accent="blue" />
            <Feature icon={<BarChart3 className="h-7 w-7" />} title="Performance" detail="Pour une éducation durable" accent="violet" />
          </div>

          <div className="relative z-10 mt-8 min-h-[440px] lg:mt-4">
            <div className="absolute inset-x-[-56px] bottom-0 h-[410px] overflow-hidden rounded-t-[48px]">
              <img
                src={visualImage}
                alt={step === 'UNIVERSITY' ? 'Étudiant congolais' : 'Élèves congolais en tenue scolaire'}
                className="h-full w-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a365a]/50 via-transparent to-[#eaf5fc]/15" />
            </div>

            <div className="absolute bottom-[122px] right-5 max-w-[250px] rotate-[-4deg] text-right font-serif text-[28px] italic leading-tight text-white drop-shadow-lg sm:right-12">
              L’éducation<br />d’aujourd’hui,<br />les opportunités<br />de demain !
              <div className="ml-auto mt-2 h-2 w-24 rounded-full bg-amber-400" />
            </div>

            <div className="absolute bottom-5 left-1/2 w-[88%] -translate-x-1/2 rounded-2xl border border-white/50 bg-white/88 px-4 py-4 shadow-xl backdrop-blur-md">
              <div className="grid grid-cols-3 gap-3 text-center">
                <MiniPillar icon={<Landmark className="h-5 w-5" />} title="Ministère" text="MEPSA · MES · METP" />
                <MiniPillar icon={<School className="h-5 w-5" />} title="Écoles" text="Publiques & privées" />
                <MiniPillar icon={<GraduationCap className="h-5 w-5" />} title="Universités" text="Pour l’excellence" />
              </div>
            </div>
          </div>
        </aside>

        <main className="flex items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#f6fbff,#dceef9_65%,#d5eaf6)] p-5 sm:p-8 lg:p-12">
          <section className="w-full max-w-[760px] rounded-[32px] border border-white/90 bg-white/95 p-6 shadow-[0_30px_80px_rgba(49,102,138,0.18)] backdrop-blur sm:p-10 lg:p-12">
            <div className="text-center">
              <div className="mx-auto inline-flex rounded-2xl bg-transparent p-2"><LogoIcon /></div>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[#073066] sm:text-5xl">Bienvenue sur EDUCO</h2>
              <p className="mt-3 text-lg text-slate-500">Connectez-vous pour accéder à votre espace</p>
            </div>

            <div className="mt-12 flex items-center justify-between gap-3">
              <div className="text-lg font-black text-[#0b3152]">
                {step === 'ROOT' && 'Je me connecte en tant que :'}
                {step === 'STATE' && 'Choisissez votre ministère :'}
                {step === 'SCHOOL' && 'Choisissez votre type d’école :'}
                {step === 'UNIVERSITY' && 'Choisissez votre type d’université :'}
              </div>
              {step !== 'ROOT' && (
                <button type="button" onClick={goBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50">
                  <ArrowLeft className="h-4 w-4" /> Retour
                </button>
              )}
            </div>

            {step === 'ROOT' && (
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <RoleCard title="État" subtitle="Administration publique" icon={<Landmark className="h-12 w-12" />} accent="blue" onClick={() => setStep('STATE')} />
                <RoleCard title="Écoles" subtitle="Publiques & Privées" icon={<School className="h-12 w-12" />} accent="emerald" onClick={() => setStep('SCHOOL')} />
                <RoleCard title="Université" subtitle="Enseignement supérieur" icon={<GraduationCap className="h-12 w-12" />} accent="violet" onClick={() => setStep('UNIVERSITY')} />
              </div>
            )}

            {step === 'STATE' && (
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {MINISTRIES.map((item) => (
                  <RoleCard
                    key={item.code}
                    title={item.label}
                    subtitle={item.fullName}
                    icon={<Landmark className="h-11 w-11" />}
                    accent={item.code === 'MEPSA' ? 'blue' : item.code === 'MES' ? 'violet' : 'amber'}
                    onClick={() => setOpenMinistry(item.code)}
                  />
                ))}
              </div>
            )}

            {step === 'SCHOOL' && (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {SCHOOL_ACCESS_OPTIONS.map((option) => (
                  <RoleCard
                    key={option.code}
                    title={option.label}
                    subtitle={option.description}
                    icon={<School className="h-11 w-11" />}
                    accent={option.code === 'GENERAL' ? 'emerald' : 'amber'}
                    onClick={() => onSelect({ sector: 'SCHOOL', schoolType: option.code, label: option.label })}
                  />
                ))}
              </div>
            )}

            {step === 'UNIVERSITY' && (
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {UNIVERSITY_ACCESS_OPTIONS.map((option) => (
                  <RoleCard
                    key={option.code}
                    title={option.label}
                    subtitle={option.description}
                    icon={<GraduationCap className="h-11 w-11" />}
                    accent={option.code === 'PUBLIC' ? 'blue' : 'violet'}
                    onClick={() => onSelect({ sector: 'UNIVERSITY', universityType: option.code, label: option.label })}
                  />
                ))}
              </div>
            )}

            <div className="mt-10 flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
              <span className="h-px w-12 bg-slate-200" /> Ensemble pour une éducation de qualité <span className="h-px w-12 bg-slate-200" />
            </div>
          </section>
        </main>
      </div>

      {ministry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Sélection ${ministry.label}`}>
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[30px] border border-white/20 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-[#f7fbff] px-6 py-5 sm:px-8">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-[#0b78ee]">{ministry.label}</div>
                <h3 className="mt-1 text-2xl font-black text-[#0b3152] sm:text-3xl">Sélectionnez votre structure</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{ministry.fullName}</p>
              </div>
              <button type="button" onClick={() => setOpenMinistry(null)} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[calc(92vh-120px)] overflow-y-auto p-5 sm:p-8">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {ministry.entities.map((entity) => (
                  <button
                    key={entity.code}
                    type="button"
                    onClick={() => onSelect({ sector: 'STATE', ministry: ministry.code, entity: entity.code, label: `${entity.shortLabel || entity.label} / ${ministry.label}` })}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#6fb5f7] hover:shadow-lg"
                  >
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf5ff] text-[#0b78ee]"><Building2 className="h-6 w-6" /></div>
                      <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-1 group-hover:text-[#0b78ee]" />
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

const Feature = ({ icon, title, detail, accent }: { icon: React.ReactNode; title: string; detail: string; accent: 'emerald' | 'blue' | 'violet' }) => {
  const style = accent === 'emerald' ? 'from-emerald-500 to-emerald-400' : accent === 'blue' ? 'from-blue-500 to-sky-400' : 'from-violet-600 to-fuchsia-500';
  return (
    <div className="text-center">
      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br ${style} text-white shadow-lg`}>{icon}</div>
      <div className="mt-3 text-lg font-black text-[#082c65]">{title}</div>
      <div className="mt-1 text-sm leading-5 text-slate-500">{detail}</div>
    </div>
  );
};

const MiniPillar = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <div className="min-w-0">
    <div className="mx-auto flex h-7 w-7 items-center justify-center text-[#0b3152]">{icon}</div>
    <div className="mt-1 truncate text-sm font-black text-[#0b3152]">{title}</div>
    <div className="truncate text-[11px] font-semibold text-slate-500">{text}</div>
  </div>
);

const RoleCard = ({ title, subtitle, icon, accent, onClick }: { title: string; subtitle: string; icon: React.ReactNode; accent: 'blue' | 'emerald' | 'violet' | 'amber'; onClick: () => void }) => {
  const styles = {
    blue: { border: 'border-blue-400/70', text: 'text-[#0d4b9f]', icon: 'text-[#0d4b9f]', bubble: 'bg-blue-50' },
    emerald: { border: 'border-emerald-300/80', text: 'text-emerald-600', icon: 'text-emerald-600', bubble: 'bg-emerald-50' },
    violet: { border: 'border-violet-300/80', text: 'text-violet-700', icon: 'text-violet-700', bubble: 'bg-violet-50' },
    amber: { border: 'border-amber-300/80', text: 'text-amber-700', icon: 'text-amber-700', bubble: 'bg-amber-50' },
  }[accent];

  return (
    <button type="button" onClick={onClick} className={`group min-h-[290px] rounded-2xl border ${styles.border} bg-white px-5 py-8 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-xl`}>
      <div className={`mx-auto flex h-20 w-20 items-center justify-center ${styles.icon}`}>{icon}</div>
      <div className={`mt-4 text-[27px] font-black tracking-[-0.03em] ${styles.text}`}>{title}</div>
      <div className="mx-auto mt-2 min-h-12 max-w-[180px] text-sm font-medium leading-6 text-slate-500">{subtitle}</div>
      <div className={`mx-auto mt-5 flex h-12 w-12 items-center justify-center rounded-full ${styles.bubble} ${styles.text} transition group-hover:translate-x-1`}><ArrowRight className="h-6 w-6" /></div>
    </button>
  );
};

export default InstitutionAccessPortal;
