import React, { useMemo, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, FileCheck2, Loader2, ShieldCheck, X } from 'lucide-react';
import {
  getHigherEducationFields,
  type HigherEducationOwnership,
  type HigherEducationRequestField,
} from '../src/institutional/higherEducationRequestConfig';
import { submitHigherEducationEstablishmentRequest } from '../src/services/higherEducationRequests';

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successId, setSuccessId] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      for (const field of fields) {
        if (field.required && !String(values[field.key] || '').trim()) {
          throw new Error(`Le champ « ${field.label} » est obligatoire.`);
        }
      }
      const result = await submitHigherEducationEstablishmentRequest({ ownership, values });
      setSuccessId(result.id || 'DOSSIER-ENREGISTRE');
    } catch (submitError: any) {
      setError(submitError?.message || "Impossible d'enregistrer le dossier.");
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
              <div className="text-xs font-black uppercase tracking-[0.18em] text-sky-200">MES · Dossier de création / ouverture</div>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">Établissement d’enseignement supérieur {ownership === 'PUBLIC' ? 'public' : 'privé'}</h2>
              <p className="mt-2 max-w-3xl text-xs leading-5 text-sky-50/80">
                Le dépôt dans EDUCO constitue un dossier d’instruction. Il ne vaut ni création juridique, ni autorisation d’ouverture, ni accréditation.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-sky-100 hover:bg-white/10" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>

        {successId ? (
          <div className="p-7 sm:p-10">
            <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><CheckCircle2 className="h-7 w-7" /></div>
              <h3 className="mt-4 text-xl font-black text-slate-950">Dossier transmis au MES</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">Référence technique : <strong>{successId}</strong>. Le dossier reste en attente d’instruction et aucune autorisation n’est présumée.</p>
              <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-[#1F4A59] px-5 py-3 text-sm font-black text-white">Fermer</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 sm:p-8">
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" /><div><div className="text-sm font-black text-blue-950">Dossier adapté au statut {ownership === 'PUBLIC' ? 'public' : 'privé'}</div><p className="mt-1 text-xs leading-5 text-blue-800/80">Les champs sont séparés selon le cadre de création des établissements publics et la procédure d’autorisation des établissements privés.</p></div></div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><div className="text-sm font-black text-amber-950">Pièces et références vérifiables</div><p className="mt-1 text-xs leading-5 text-amber-800/80">EDUCO collecte ici les informations structurées. Les pièces originales restent soumises au contrôle de l’administration compétente.</p></div></div>
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

            <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">Annuler</button>
              <button type="submit" disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white disabled:opacity-60">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy ? 'Transmission…' : 'Transmettre le dossier au MES'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default HigherEducationRegistrationModal;
