import React, { useState, useEffect } from 'react';
import { Fingerprint, Scan, Loader2, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { isWebAuthnSupported, isPlatformAuthenticatorAvailable } from '../../src/services/webauthnService';

interface BiometricLoginButtonProps {
  onBiometricClick: () => void;
  isLoading?: boolean;
  userEmail?: string;
}

export const BiometricLoginButton: React.FC<BiometricLoginButtonProps> = ({
  onBiometricClick,
  isLoading = false,
  userEmail
}) => {
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [hasPlatformAuth, setHasPlatformAuth] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAvailability = async () => {
      const supported = isWebAuthnSupported();
      setIsSupported(supported);
      if (supported) {
        const platformAuth = await isPlatformAuthenticatorAvailable();
        setHasPlatformAuth(platformAuth);
      } else {
        setHasPlatformAuth(false);
      }
    };
    checkAvailability();
  }, []);

  if (isSupported === false) {
    return (
      <div className="p-3.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2.5">
        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          La connexion biométrique (Passkeys) n'est pas prise en charge par ce navigateur. Utilisez votre mot de passe ci-dessous.
        </span>
      </div>
    );
  }

  const description = userEmail
    ? `Continuer avec la clé biométrique enregistrée pour ${userEmail}.`
    : "Utilisez une passkey, l'empreinte, la reconnaissance faciale ou le verrouillage sécurisé de votre appareil.";
  const availabilityLabel = hasPlatformAuth === null
    ? 'Vérification...'
    : hasPlatformAuth
    ? 'Passkey disponible'
    : 'Passkey / clé';

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        disabled={isLoading}
        onClick={onBiometricClick}
        className="group relative w-full p-4 bg-gradient-to-r from-emerald-600 via-teal-600 to-[#1F4A59] hover:from-emerald-500 hover:via-teal-500 hover:to-[#183944] active:scale-[0.99] text-white rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed overflow-hidden"
      >
        {/* Ambient subtle glow background */}
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md text-white flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-200">
            {isLoading ? (
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            ) : (
              <Fingerprint className="w-6 h-6 text-emerald-200 group-hover:text-white transition-colors" />
            )}
          </div>

          <div className="text-left min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
                Se connecter avec la biométrie
              </span>
              <span className="px-2 py-0.5 bg-emerald-400/20 border border-emerald-300/30 text-emerald-100 font-extrabold text-[10px] rounded-full hidden sm:inline-block">
                Passkeys / Touch ID
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/90 font-medium truncate mt-0.5">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-xs font-bold text-white shrink-0 border border-white/20">
          <Scan className="w-3.5 h-3.5 animate-pulse text-emerald-200" />
          <span className="hidden xs:inline">{availabilityLabel}</span>
        </div>
      </button>

      {hasPlatformAuth === false && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center font-medium">
          Note : Votre appareil utilisera votre méthode de verrouillage système (PIN, mot de passe ou clé matérielle).
        </p>
      )}
    </div>
  );
};
