import React, { useState } from 'react';
import { ArrowLeft, Building2, GraduationCap, Landmark, LockKeyhole, School, UserPlus } from 'lucide-react';
import LegacyApp from '../App';
import InstitutionalAccountRequestModal from './InstitutionalAccountRequestModal';
import SchoolEstablishmentRegistrationModal from './SchoolEstablishmentRegistrationModal';
import HigherEducationRegistrationModal from './HigherEducationRegistrationModal';
import {
  accessContextLabel,
  findInstitutionEntity,
  findMinistry,
  type InstitutionAccessContext,
} from '../src/institutional/accessConfig';

interface InstitutionalLoginModalProps {
  context: InstitutionAccessContext;
  onChangeSpace: () => void;
}

const InstitutionalLoginModal: React.FC<InstitutionalLoginModalProps> = ({ context, onChangeSpace }) => {
  const [showAccountRequest, setShowAccountRequest] = useState(false);
  const [showEstablishmentRegistration, setShowEstablishmentRegistration] = useState(false);
  const ministry = context.ministry ? findMinistry(context.ministry) : null;
  const entity = context.ministry && context.entity
    ? findInstitutionEntity(context.ministry, context.entity)
    : null;

  const ContextIcon = context.sector === 'STATE'
    ? Landmark
    : context.sector === 'SCHOOL'
      ? School
      : GraduationCap;

  const eyebrow = context.sector === 'STATE'
    ? `ÉTAT · ${ministry?.label || context.ministry || ''}`
    : context.sector === 'SCHOOL'
      ? 'ÉCOLES'
      : 'UNIVERSITÉ';

  const detail = context.sector === 'STATE'
    ? entity?.description || ministry?.description || 'Espace institutionnel sécurisé.'
    : context.sector === 'SCHOOL'
      ? context.schoolType === 'GENERAL'
        ? 'Connexion à un établissement d’enseignement général.'
        : 'Connexion à un établissement d’enseignement technique.'
      : context.universityType === 'PUBLIC'
        ? 'Connexion à une université publique.'
        : 'Connexion à une université privée.';

  return (
    <>
      <main className="fixed inset-0 z-[110] overflow-x-hidden overflow-y-auto bg-slate-950/80 px-2 py-3 backdrop-blur-md sm:px-6 sm:py-8">
        <style>{`
          .educo-institution-login,
          .educo-institution-login > div,
          .educo-institution-login .min-h-screen {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
          }
          .educo-institution-login .min-h-screen { min-height: 0 !important; }
          .educo-institution-login > div,
          .educo-institution-login .min-h-screen { background: transparent !important; }
          .educo-institution-login .min-h-screen { padding: 0 !important; }
          .educo-institution-login .max-w-md { max-width: 100% !important; }
          .educo-institution-login .shadow-xl { box-shadow: none !important; }
          .educo-institution-login input,
          .educo-institution-login select,
          .educo-institution-login textarea,
          .educo-institution-login button {
            max-width: 100% !important;
          }
        `}</style>

        <div className="mx-auto flex min-h-full w-full max-w-6xl min-w-0 items-center justify-center">
          <section
            className="w-full min-w-0 max-w-full overflow-hidden rounded-[22px] border border-white/20 bg-white shadow-2xl shadow-black/30 sm:rounded-[30px]"
            role="dialog"
            aria-modal="true"
            aria-label={`Connexion ${accessContextLabel(context)}`}
          >
            <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
              <aside className="relative min-w-0 overflow-hidden bg-gradient-to-br from-[#0b3152] via-[#104b72] to-[#146c78] p-4 text-white sm:p-8 lg:p-10">
                <div className="relative z-10 flex h-full min-h-[260px] min-w-0 flex-col justify-between">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={onChangeSpace}
                      className="mb-6 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white/15 sm:mb-8"
                    >
                      <ArrowLeft className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 whitespace-normal text-left">Changer d’espace</span>
                    </button>

                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                      <ContextIcon className="h-7 w-7" />
                    </div>

                    <div className="mt-6 break-words text-xs font-black uppercase tracking-[0.16em] text-sky-100 sm:mt-7 sm:tracking-[0.2em]">{eyebrow}</div>
                    <h1 className="mt-2 max-w-full break-words text-[clamp(1.8rem,8vw,2.5rem)] font-black leading-[1.08] sm:text-4xl">{accessContextLabel(context)}</h1>
                    <p className="mt-4 max-w-full break-words text-sm leading-6 text-sky-50/85 sm:max-w-md">{detail}</p>
                  </div>

                  <div className="mt-7 min-w-0 space-y-3 sm:mt-9">
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-white/10 p-4">
                      <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                      <div className="min-w-0">
                        <div className="break-words text-sm font-black">Accès sécurisé</div>
                        <div className="mt-1 break-words text-xs leading-5 text-sky-50/75">
                          La sélection de cet espace n’accorde aucun droit supplémentaire. Les permissions du compte sont contrôlées après authentification.
                        </div>
                      </div>
                    </div>

                    {context.sector === 'STATE' && ministry && (
                      <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                        <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-sky-200" />
                        <div className="min-w-0">
                          <div className="break-words text-xs font-black uppercase tracking-wider text-sky-100">{ministry.label}</div>
                          <div className="mt-1 break-words text-xs leading-5 text-sky-50/70">{ministry.fullName}</div>
                        </div>
                      </div>
                    )}

                    {context.sector === 'STATE' && ministry && entity && entity.code !== 'CABINET' && (
                      <button
                        type="button"
                        onClick={() => setShowAccountRequest(true)}
                        className="flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-center text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300"
                      >
                        <UserPlus className="h-4.5 w-4.5 shrink-0" />
                        <span className="min-w-0 whitespace-normal break-words">Demander un compte sous tutelle</span>
                      </button>
                    )}

                    {context.sector === 'SCHOOL' && (
                      <button
                        type="button"
                        onClick={() => setShowEstablishmentRegistration(true)}
                        className="flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-center text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300"
                      >
                        <Building2 className="h-4.5 w-4.5 shrink-0" />
                        <span className="min-w-0 whitespace-normal break-words">Créer le compte de l’établissement</span>
                      </button>
                    )}

                    {context.sector === 'UNIVERSITY' && (
                      <button
                        type="button"
                        onClick={() => setShowEstablishmentRegistration(true)}
                        className="flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-center text-sm font-black text-emerald-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300"
                      >
                        <GraduationCap className="h-4.5 w-4.5 shrink-0" />
                        <span className="min-w-0 whitespace-normal break-words">Créer le compte de l’établissement</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-emerald-300/15 blur-3xl" />
                <div className="absolute -left-20 top-20 h-52 w-52 rounded-full bg-sky-300/10 blur-3xl" />
              </aside>

              <div className="min-w-0 overflow-hidden bg-[#eef5f8] p-2 sm:p-5 lg:p-7">
                <div className="mx-auto w-full min-w-0 max-w-2xl overflow-hidden rounded-[20px] border border-slate-200 bg-white p-1 shadow-sm sm:rounded-[26px] sm:p-4">
                  <div className="educo-institution-login min-w-0 overflow-hidden">
                    <LegacyApp />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {showAccountRequest && (
        <InstitutionalAccountRequestModal context={context} onClose={() => setShowAccountRequest(false)} />
      )}
      {showEstablishmentRegistration && context.sector === 'SCHOOL' && (
        <SchoolEstablishmentRegistrationModal onClose={() => setShowEstablishmentRegistration(false)} />
      )}
      {showEstablishmentRegistration && context.sector === 'UNIVERSITY' && (
        <HigherEducationRegistrationModal
          ownership={context.universityType === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE'}
          onClose={() => setShowEstablishmentRegistration(false)}
        />
      )}
    </>
  );
};

export default InstitutionalLoginModal;
