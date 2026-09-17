import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Send, ShieldCheck, X } from 'lucide-react';
import {
  accessContextLabel,
  findInstitutionEntity,
  findMinistry,
  type InstitutionAccessContext,
} from '../src/institutional/accessConfig';
import {
  getInstitutionalAccountRequestConfig,
  type InstitutionalAccountField,
} from '../src/institutional/accountRequestConfig';
import { submitInstitutionalAccountRequest } from '../src/services/institutionalAccountRequests';

interface InstitutionalAccountRequestModalProps {
  context: InstitutionAccessContext;
  onClose: () => void;
}

const initialValuesFor = (fields: InstitutionalAccountField[]) =>
  Object.fromEntries(fields.map((item) => [item.key, '']));

const InstitutionalAccountRequestModal: React.FC<InstitutionalAccountRequestModalProps> = ({ context, onClose }) => {
  const config = useMemo(() => getInstitutionalAccountRequestConfig(context), [context]);
  const ministry = context.ministry ? findMinistry(context.ministry) : null;
  const entity = context.ministry && context.entity ? findInstitutionEntity(context.ministry, context.entity) : null;
  const [values, setValues] = useState<Record<string, string>>(() => initialValuesFor(config?.fields || []));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attested, setAttested] = useState(false);

  if (!config || !ministry || !entity) return null;

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const missing = config.fields.find((item) => item.required && !String(values[item.key] || '').trim());
    if (missing) {
      setError(`Le champ « ${missing.label} » est obligatoire.`);
      return;
    }
    if (!attested) {
      setError('Veuillez confirmer l’exactitude des informations administratives fournies.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await submitInstitutionalAccountRequest({ context, values });
      setSubmitted(true);
    } catch (submitError: any) {
      setError(submitError?.message || 'Impossible d’enregistrer la demande.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[140] overflow-y-auto bg-slate-950/80 px-3 py-5 backdrop-blur-md sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-full w-full max-w-4xl items-center justify-center">
        <section className="w-full overflow-hidden rounded-[28px] border border-white/20 bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label={config.title}>
          <header className="flex items-start justify-between gap-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-5 sm:px-8">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">{ministry.label} · {entity.shortLabel || entity.label}</div>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{config.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{config.description}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50" aria-label="Fermer">
              <X className="h-5 w-5" />
            </button>
          </header>

          {submitted ? (
            <div className="p-6 sm:p-10">
              <div className="mx-auto max-w-xl rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
                <h3 className="mt-4 text-xl font-black text-emerald-950">Demande enregistrée</h3>
                <p className="mt-3 text-sm leading-6 text-emerald-900/80">
                  Votre demande pour l’espace <strong>{accessContextLabel(context)}</strong> est en attente de vérification. Aucun rôle privilégié n’est activé automatiquement.
                </p>
                <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-black text-white hover:bg-emerald-800">Retour à la connexion</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="p-5 sm:p-8">
              <div className="mb-6 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <div>
                  <div className="text-sm font-black text-blue-950">Vérification administrative obligatoire</div>
                  <p className="mt-1 text-xs leading-5 text-blue-900/75">
                    EDUCO collecte uniquement les informations nécessaires pour rapprocher la demande de votre fonction administrative. Ne saisissez aucun mot de passe, clé API ni donnée secrète dans ce formulaire.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                {config.fields.map((item) => (
                  <FieldControl key={item.key} field={item} value={values[item.key] || ''} onChange={(value) => setValue(item.key, value)} />
                ))}
              </div>

              <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input type="checkbox" checked={attested} onChange={(event) => setAttested(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300" />
                <span className="text-xs leading-5 text-slate-600">
                  Je confirme que les informations fournies correspondent à ma fonction réelle au sein de <strong>{entity.shortLabel || entity.label}</strong> et pourront être vérifiées avant activation du compte.
                </span>
              </label>

              {error && (
                <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50">Annuler</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Soumettre la demande
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
};

const FieldControl = ({
  field,
  value,
  onChange,
}: {
  field: InstitutionalAccountField;
  value: string;
  onChange: (value: string) => void;
}) => {
  const common = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100';
  const fullWidth = field.type === 'textarea' ? 'md:col-span-2' : '';

  return (
    <label className={`block ${fullWidth}`}>
      <span className="mb-1.5 block text-xs font-black text-slate-700">
        {field.label}{field.required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {field.type === 'select' ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} className={common} required={field.required}>
          <option value="">Sélectionner…</option>
          {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : field.type === 'textarea' ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} className={`${common} min-h-28 resize-y`} required={field.required} placeholder={field.placeholder} maxLength={2000} />
      ) : (
        <input type={field.type} value={value} onChange={(event) => onChange(event.target.value)} className={common} required={field.required} placeholder={field.placeholder} maxLength={500} />
      )}
      {field.helpText ? <span className="mt-1.5 block text-[11px] leading-4 text-slate-500">{field.helpText}</span> : null}
    </label>
  );
};

export default InstitutionalAccountRequestModal;
