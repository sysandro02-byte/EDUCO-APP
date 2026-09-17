import React, { useMemo, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, FileCheck2, KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';
import {
  getHigherEducationFields,
  type HigherEducationOwnership,
  type HigherEducationRequestField,
} from '../src/institutional/higherEducationRequestConfig';
import { brevoEmailService } from '../src/services/brevoEmailService';
import { getApiUrl } from '../src/lib/apiConfig';

interface HigherEducationRegistrationModalProps {
  ownership: HigherEducationOwnership;
  onClose: () => void;
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

const FieldControl = ({
  field,
  value,
  onChange,
}: {
  field: HigherEducationRequestField;
  value: string;
  onChange: (value: string) => void;
}) => {
  if (field.type === 'textarea') {
    return (
      <textarea
        rows={4}
        required={field.required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder}
        className={`${inputClass} resize-y`}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select required={field.required} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">Sélectionner…</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type}
      required={field.required}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      className={inputClass}
      min={field.type === 'number' ? 0 : undefined}
    />
  );
};

const HigherEducationRegistrationModal: React.FC<HigherEducationRegistrationModalProps> = ({ ownership, onClose }) => {
  const fields = useMemo(() => getHigherEducationFields(ownership), [ownership]);
  const [values, setValues] = useState<Record<string, string>>({
    requestType: 'CREATION',
    technicalTutelle: ownership === 'PUBLIC' ? 'Ministère chargé de l’enseignement supérieur' : '',
  });
  const [adminPassword, setAdminPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'FORM' | 'OTP' | 'DONE'>('FORM');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [institutionIdentifier, setInstitutionIdentifier] = useState('');

  const validateForm = () => {
    for (const field of fields) {
      if (field.required && !String(values[field.key] || '').trim()) {
        throw new Error(`Le champ « ${field.label} » est obligatoire.`);
      }
    }
    const email = String(values.officialEmail || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Adresse e-mail officielle invalide.');
    }
    if (adminPassword.length < 6) {
      throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
    }
  };

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      validateForm();
      setBusy(true);
      const response = await brevoEmailService.sendOtp({
        email: String(values.officialEmail).trim().toLowerCase(),
        name: String(values.legalRepresentative || values.promoterOrInitiator || values.officialName).trim(),
        purpose: 'school_registration',
      });
      if (!response.success) throw new Error(response.error || "Impossible d’envoyer le code OTP.");
      setStep('OTP');
    } catch (submitError: any) {
      setError(submitError?.message || "Impossible de préparer l'inscription.");
    } finally {
      setBusy(false);
    }
  };

  const finalizeRegistration = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) {
      setError('Saisissez le code OTP à 6 chiffres.');
      return;
    }

    setBusy(true);
    try {
      const email = String(values.officialEmail).trim().toLowerCase();
      const verified = await brevoEmailService.verifyOtp({
        email,
        otpCode: otp,
        purpose: 'school_registration',
      });
      if (!verified.success) throw new Error(verified.error || 'Code OTP invalide ou expiré.');

      const universityProfile = Object.fromEntries(
        Object.entries(values)
          .map(([key, value]) => [key, String(value || '').trim()])
          .filter(([, value]) => Boolean(value)),
      );

      const response = await fetch(getApiUrl('/api/auth/register-school'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: String(values.officialName).trim(),
          schoolAddress: String(values.address).trim(),
          schoolPhone: String(values.phone).trim(),
          creationDate: values.targetOpeningDate || null,
          promoterName: String(values.legalRepresentative || values.promoterOrInitiator).trim(),
          promoterContact: String(values.phone).trim(),
          promoterEmail: email,
          adminPassword,
          levels: {
            __ownershipType: ownership,
            __institutionType: 'UNIVERSITY',
            university: universityProfile,
          },
          openingAuthorizationDoc: values.openingAuthorizationRef || values.creationAuthorizationRef || values.legalActDraft || null,
          promoterIdDoc: null,
          statutesDoc: values.statutesDraft || values.legalForm || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) {
        throw new Error(data?.error || "Impossible d'inscrire l'établissement supérieur.");
      }
      const identifier = data?.schoolIdentifier || data?.school?.identifier;
      if (!identifier) throw new Error("L'établissement a été créé mais aucun identifiant EDUCO n'a été retourné.");

      setInstitutionIdentifier(identifier);
      setStep('DONE');
    } catch (finalError: any) {
      setError(finalError?.message || "Impossible de finaliser l'inscription.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[160] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto my-4 w-full max-w-5xl overflow-hidden rounded-[28px] bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-5 bg-[#0b3152] px-5 py-5 text-white sm:px-8">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><Building2 className="h-6 w-6" /></div>
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">EDUCO · inscription établissement supérieur</div>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">Création d’un compte pour un établissement supérieur {ownership === 'PUBLIC' ? 'public' : 'privé'}</h2>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-sky-50/80">
                L’inscription EDUCO est directe après vérification de l’e-mail. Elle ne nécessite pas de validation du cabinet ministériel et ne remplace pas les autorisations administratives exigibles hors EDUCO.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-sky-100 hover:bg-white/10" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>

        {step === 'DONE' ? (
          <div className="p-7 sm:p-10">
            <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-7 w-7" /></div>
              <h3 className="mt-4 text-xl font-black text-slate-950">Établissement supérieur inscrit</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Identifiant EDUCO : <strong>{institutionIdentifier}</strong> · Statut : <strong>{ownership === 'PUBLIC' ? 'Public' : 'Privé'}</strong>. Le compte peut maintenant utiliser le parcours normal de connexion EDUCO.
              </p>
              <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-[#1F4A59] px-5 py-3 text-sm font-black text-white">Continuer</button>
            </div>
          </div>
        ) : step === 'OTP' ? (
          <form onSubmit={finalizeRegistration} className="mx-auto max-w-xl p-7 sm:p-10">
            <div className="text-center">
              <KeyRound className="mx-auto h-10 w-10 text-blue-600" />
              <h3 className="mt-3 text-xl font-black">Vérification de l’e-mail</h3>
              <p className="mt-2 text-sm text-slate-500">Un code de vérification a été envoyé à {values.officialEmail}.</p>
            </div>
            {error && <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
            <input
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))}
              maxLength={6}
              inputMode="numeric"
              className={`${inputClass} mt-6 text-center font-mono text-2xl font-black tracking-[0.4em]`}
              placeholder="------"
            />
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => { setStep('FORM'); setOtp(''); setError(''); }} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black">Modifier</button>
              <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? 'Création…' : 'Valider & créer le compte'}</button>
            </div>
          </form>
        ) : (
          <form onSubmit={requestOtp} className="p-5 sm:p-8">
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" /><div><div className="text-sm font-black text-blue-950">Inscription directe · {ownership === 'PUBLIC' ? 'Public' : 'Privé'}</div><p className="mt-1 text-xs leading-5 text-blue-800/80">Comme pour les écoles, le compte est créé après vérification OTP de l’adresse e-mail. Aucun passage par le cabinet ministériel n’est requis.</p></div></div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><div className="text-sm font-black text-amber-950">Informations institutionnelles conservées</div><p className="mt-1 text-xs leading-5 text-amber-800/80">Les champs spécifiques au supérieur restent enregistrés dans le dossier EDUCO afin de conserver le profil académique et administratif de l’établissement.</p></div></div>
              </div>
            </div>

            {error && <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}

            <div className="grid gap-5 md:grid-cols-2">
              {fields.map((field) => (
                <label key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">{field.label}{field.required && <span className="text-rose-500"> *</span>}</span>
                  <FieldControl field={field} value={values[field.key] || ''} onChange={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
                  {field.helpText && <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{field.helpText}</span>}
                </label>
              ))}
            </div>

            <section className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
              <div className="text-sm font-black text-emerald-950">Compte administrateur de l’établissement</div>
              <p className="mt-1 text-xs leading-5 text-emerald-800/80">L’adresse e-mail officielle saisie ci-dessus devient l’adresse de connexion du compte responsable, comme dans le parcours d’inscription d’une école.</p>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">Mot de passe *</span>
                <input type="password" minLength={6} required autoComplete="new-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} className={inputClass} placeholder="6 caractères minimum" />
              </label>
            </section>

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">Annuler</button>
              <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Envoi du code…' : 'Continuer & vérifier l’e-mail'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default HigherEducationRegistrationModal;
