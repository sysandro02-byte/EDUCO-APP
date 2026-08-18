import React, { useState } from 'react';
import { Fingerprint, ShieldCheck, CheckCircle2, AlertCircle, X, Sparkles, Smartphone, Laptop } from 'lucide-react';
import { registerWebAuthnCredential, detectDeviceName } from '../../src/services/webauthnService';

interface PasskeyRegisterPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userId?: string;
  userName?: string;
  onSuccess?: () => void;
}

export const PasskeyRegisterPromptModal: React.FC<PasskeyRegisterPromptModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  userId,
  userName,
  onSuccess
}) => {
  const [deviceName, setDeviceName] = useState(() => detectDeviceName());
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRegister = async () => {
    setIsRegistering(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await registerWebAuthnCredential(userEmail, userId, userName, deviceName);
      if (res.success) {
        setSuccessMsg(res.message);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1800);
      } else {
        const message = res.error || 'Erreur lors de la configuration biométrique.';
        setError(message);
        alert(message);
      }
    } catch (err: any) {
      const message = err.message || 'Échec de la configuration.';
      setError(message);
      alert(message);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex p-3.5 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-2xl shadow-lg mb-1">
            <Fingerprint className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            🔐 Activer la connexion biométrique sur cet appareil ?
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Gagnez du temps lors de vos prochaines connexions à EDUCO APP en utilisant votre empreinte digitale, Face ID ou déverrouillage sécurisé.
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nom de cet appareil
            </label>
            <div className="relative">
              <input
                type="text"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-white outline-none focus:border-[#1F4A59]"
                placeholder="Ex: iPhone de Marc, MacBook Pro, PC Bureau"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Sécurité garantie : Vos données biométriques restent exclusivement sur votre appareil et ne sont jamais transmises.</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-extrabold rounded-xl transition-colors cursor-pointer text-center"
          >
            Plus tard
          </button>
          <button
            type="button"
            disabled={isRegistering}
            onClick={handleRegister}
            className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Fingerprint className="w-4 h-4" />
            <span>{isRegistering ? 'Configuration...' : 'Activer maintenant'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
