import React, { useMemo, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, KeyRound, Loader2, ShieldCheck, Upload, X } from 'lucide-react';
import { brevoEmailService } from '../src/services/brevoEmailService';
import { getApiUrl } from '../src/lib/apiConfig';
import { getNewPasswordError, NEW_PASSWORD_MIN_LENGTH } from '../src/services/passwordPolicy';

type Ownership = 'PUBLIC' | 'PRIVATE';

type SchoolLevels = {
  garderie: boolean;
  prescolaire: Record<string, boolean>;
  primaire: Record<string, boolean>;
  secondaireCollege: Record<string, boolean>;
  secondaireLycee: Record<string, boolean>;
};

const initialLevels = (): SchoolLevels => ({
  garderie: false,
  prescolaire: { 'Petite Section': false, 'Moyenne Section': false, 'Grande Section': false },
  primaire: { CP1: false, CP2: false, CE1: false, CE2: false, CM1: false, CM2: false },
  secondaireCollege: { '6ème': false, '5ème': false, '4ème': false, '3ème': false },
  secondaireLycee: { Seconde: false, Première: false, Terminale: false },
});

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100';

const SchoolEstablishmentRegistrationModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [ownership, setOwnership] = useState<Ownership | ''>('');
  const [values, setValues] = useState({
    schoolName: '', schoolAddress: '', schoolPhone: '', creationDate: '',
    promoterName: '', promoterContact: '', adminEmail: '', adminPassword: '',
  });
  const [levels, setLevels] = useState<SchoolLevels>(() => initialLevels());
  const [files, setFiles] = useState<{ openingAuthorization: File | null; promoterId: File | null; statutes: File | null }>({
    openingAuthorization: null, promoterId: null, statutes: null,
  });
  const [step, setStep] = useState<'FORM' | 'OTP' | 'DONE'>('FORM');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [schoolIdentifier, setSchoolIdentifier] = useState('');

  const selectedLevels = useMemo(() => {
    let count = levels.garderie ? 1 : 0;
    for (const key of ['prescolaire', 'primaire', 'secondaireCollege', 'secondaireLycee'] as const) {
      count += Object.values(levels[key]).filter(Boolean).length;
    }
    return count;
  }, [levels]);

  const updateLevel = (cycle: keyof SchoolLevels, className?: string) => {
    setLevels((current) => {
      if (cycle === 'garderie') return { ...current, garderie: !current.garderie };
      const group = current[cycle] as Record<string, boolean>;
      return { ...current, [cycle]: { ...group, [className || '']: !group[className || ''] } } as SchoolLevels;
    });
  };

  const requestOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!ownership) return setError('Choisissez obligatoirement si l’établissement est public ou privé.');
    if (!values.schoolName.trim() || !values.schoolAddress.trim() || !values.schoolPhone.trim()) return setError('Renseignez le nom, l’adresse et le téléphone de l’établissement.');
    if (!selectedLevels) return setError('Sélectionnez au moins un cycle ou une classe.');
    if (!files.openingAuthorization) return setError("L’autorisation ministérielle d’ouverture est obligatoire.");
    if (!files.promoterId) return setError("La pièce du responsable légal / promoteur est obligatoire.");
    if (!values.promoterName.trim() || !values.adminEmail.trim()) return setError('Renseignez le responsable et son adresse e-mail.');
    const passwordError = getNewPasswordError(values.adminPassword);
    if (passwordError) return setError(passwordError);

    setBusy(true);
    try {
      const response = await brevoEmailService.sendOtp({
        email: values.adminEmail.trim(),
        name: values.promoterName.trim(),
        purpose: 'school_registration',
      });
      if (!response.success) throw new Error(response.error || "Impossible d’envoyer le code OTP.");
      setStep('OTP');
    } catch (otpError: any) {
      setError(otpError?.message || "Impossible d’envoyer le code OTP.");
    } finally {
      setBusy(false);
    }
  };

  const finalize = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(otp)) return setError('Saisissez le code OTP à 6 chiffres.');
    setBusy(true);
    try {
      const response = await fetch(getApiUrl('/api/auth/register-school'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName: values.schoolName.trim(),
          schoolAddress: values.schoolAddress.trim(),
          schoolPhone: values.schoolPhone.trim(),
          creationDate: values.creationDate || null,
          promoterName: values.promoterName.trim(),
          promoterContact: values.promoterContact.trim(),
          promoterEmail: values.adminEmail.trim().toLowerCase(),
          adminPassword: values.adminPassword,
          otpCode: otp,
          levels: { ...levels, __ownershipType: ownership },
          openingAuthorizationDoc: files.openingAuthorization?.name || null,
          promoterIdDoc: files.promoterId?.name || null,
          statutesDoc: files.statutes?.name || null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data?.error) throw new Error(data?.error || "Impossible d’inscrire l’établissement.");
      const identifier = data?.schoolIdentifier || data?.school?.identifier;
      if (!identifier) throw new Error("L’établissement a été créé mais aucun matricule n’a été retourné.");
      setSchoolIdentifier(identifier);
      setStep('DONE');
    } catch (finalError: any) {
      setError(finalError?.message || "Impossible de finaliser l’inscription.");
    } finally {
      setBusy(false);
    }
  };

  const levelGroups: Array<[keyof SchoolLevels, string, string[]]> = [
    ['prescolaire', 'Préscolaire', Object.keys(levels.prescolaire)],
    ['primaire', 'Primaire', Object.keys(levels.primaire)],
    ['secondaireCollege', 'Collège', Object.keys(levels.secondaireCollege)],
    ['secondaireLycee', 'Lycée', Object.keys(levels.secondaireLycee)],
  ];

  return (
    <div className="fixed inset-0 z-[160] overflow-y-auto bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true">
      <div className="mx-auto my-4 w-full max-w-5xl overflow-hidden rounded-[28px] bg-slate-50 shadow-2xl">
        <header className="flex items-start justify-between gap-5 bg-[#0b3152] px-5 py-5 text-white sm:px-8">
          <div className="flex gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Building2 className="h-6 w-6" /></div><div><div className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">EDUCO · inscription établissement</div><h2 className="mt-1 text-xl font-black sm:text-2xl">Dossier d’inscription d’une école</h2><p className="mt-2 text-xs text-sky-50/80">La nature <strong>publique ou privée</strong> est maintenant obligatoire et enregistrée avec le dossier.</p></div></div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-white/10" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>

        {step === 'DONE' ? (
          <div className="p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-7 w-7" /></div><h3 className="mt-4 text-xl font-black">Établissement inscrit</h3><p className="mt-2 text-sm text-slate-600">Matricule EDUCO : <strong>{schoolIdentifier}</strong> · Statut : <strong>{ownership === 'PUBLIC' ? 'Public' : 'Privé'}</strong></p><button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-[#1F4A59] px-5 py-3 text-sm font-black text-white">Continuer</button></div>
        ) : step === 'OTP' ? (
          <form onSubmit={finalize} className="mx-auto max-w-xl p-7 sm:p-10">
            <div className="text-center"><KeyRound className="mx-auto h-10 w-10 text-blue-600" /><h3 className="mt-3 text-xl font-black">Vérification de l’e-mail</h3><p className="mt-2 text-sm text-slate-500">Code envoyé à {values.adminEmail}.</p></div>
            {error && <div className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ''))} maxLength={6} inputMode="numeric" className={`${inputClass} mt-6 text-center font-mono text-2xl font-black tracking-[0.4em]`} placeholder="------" />
            <div className="mt-5 flex gap-3"><button type="button" onClick={() => { setStep('FORM'); setOtp(''); setError(''); }} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black">Modifier</button><button type="submit" disabled={busy} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? 'Validation…' : 'Valider & inscrire'}</button></div>
          </form>
        ) : (
          <form onSubmit={requestOtp} className="p-5 sm:p-8">
            {error && <div className="mb-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" /><div><div className="text-sm font-black text-blue-950">Nature de l’établissement *</div><p className="mt-1 text-xs text-blue-800/80">Ce choix est obligatoire pour distinguer les établissements publics et privés dans EDUCO.</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{(['PUBLIC', 'PRIVATE'] as Ownership[]).map((option) => <button key={option} type="button" onClick={() => setOwnership(option)} className={`rounded-xl border px-4 py-3 text-sm font-black ${ownership === option ? 'border-blue-600 bg-blue-600 text-white' : 'border-blue-200 bg-white text-blue-900'}`}>{option === 'PUBLIC' ? 'Établissement public' : 'Établissement privé'}</button>)}</div></div></div></div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label><span className="mb-1 block text-xs font-black text-slate-600">Nom officiel *</span><input className={inputClass} value={values.schoolName} onChange={(e) => setValues(v => ({ ...v, schoolName: e.target.value }))} /></label>
              <label><span className="mb-1 block text-xs font-black text-slate-600">Téléphone officiel *</span><input type="tel" className={inputClass} value={values.schoolPhone} onChange={(e) => setValues(v => ({ ...v, schoolPhone: e.target.value }))} /></label>
              <label className="md:col-span-2"><span className="mb-1 block text-xs font-black text-slate-600">Adresse / localisation *</span><textarea rows={2} className={inputClass} value={values.schoolAddress} onChange={(e) => setValues(v => ({ ...v, schoolAddress: e.target.value }))} /></label>
              <label><span className="mb-1 block text-xs font-black text-slate-600">Date de création</span><input type="date" className={inputClass} value={values.creationDate} onChange={(e) => setValues(v => ({ ...v, creationDate: e.target.value }))} /></label>
            </div>

            <div className="mt-6"><div className="text-xs font-black uppercase tracking-wide text-slate-600">Cycles & niveaux *</div><div className="mt-3 space-y-3"><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-bold"><input type="checkbox" checked={levels.garderie} onChange={() => updateLevel('garderie')} /> Garderie / crèche</label>{levelGroups.map(([cycle, label, classes]) => <div key={String(cycle)} className="rounded-xl border border-slate-200 bg-white p-3"><div className="mb-2 text-sm font-black">{label}</div><div className="flex flex-wrap gap-2">{classes.map((className) => <label key={className} className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs font-bold"><input className="mr-2" type="checkbox" checked={(levels[cycle] as Record<string, boolean>)[className]} onChange={() => updateLevel(cycle, className)} />{className}</label>)}</div></div>)}</div></div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">{([
              ['openingAuthorization', 'Autorisation d’ouverture *'], ['promoterId', 'Pièce responsable *'], ['statutes', 'Statuts / acte (optionnel)'],
            ] as const).map(([key, label]) => <label key={key} className="rounded-xl border border-dashed border-slate-300 bg-white p-4"><span className="flex items-center gap-2 text-xs font-black text-slate-700"><Upload className="h-4 w-4" />{label}</span><input type="file" className="mt-3 block w-full text-xs" onChange={(e) => setFiles(current => ({ ...current, [key]: e.target.files?.[0] || null }))} /></label>)}</div>

            <div className="mt-6 grid gap-4 md:grid-cols-2"><label><span className="mb-1 block text-xs font-black text-slate-600">Responsable / promoteur *</span><input className={inputClass} value={values.promoterName} onChange={(e) => setValues(v => ({ ...v, promoterName: e.target.value }))} /></label><label><span className="mb-1 block text-xs font-black text-slate-600">Téléphone responsable</span><input type="tel" className={inputClass} value={values.promoterContact} onChange={(e) => setValues(v => ({ ...v, promoterContact: e.target.value }))} /></label><label><span className="mb-1 block text-xs font-black text-slate-600">E-mail de connexion *</span><input type="email" className={inputClass} value={values.adminEmail} onChange={(e) => setValues(v => ({ ...v, adminEmail: e.target.value }))} /></label><label><span className="mb-1 block text-xs font-black text-slate-600">Mot de passe initial *</span><input type="password" minLength={NEW_PASSWORD_MIN_LENGTH} className={inputClass} value={values.adminPassword} onChange={(e) => setValues(v => ({ ...v, adminPassword: e.target.value }))} /></label></div>

            <div className="mt-7 flex justify-end gap-3 border-t border-slate-200 pt-5"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black">Annuler</button><button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Envoi du code…' : 'Vérifier l’e-mail & continuer'}</button></div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SchoolEstablishmentRegistrationModal;
