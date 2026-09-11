import React, { useEffect, useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'educo_pwa_install_dismissed_at';
const DISMISS_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);
const isIosSafari = () => {
  const userAgent = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIos && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
};

/** A single, polite install invitation. The browser still owns the actual install flow. */
export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isInstalled()) return;
    setIos(isIosSafari());
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DELAY_MS;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
      if (!recentlyDismissed) setShowPrompt(true);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      localStorage.removeItem(DISMISS_KEY);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    // iOS does not expose beforeinstallprompt; give Safari users the native path.
    if (isIosSafari() && !recentlyDismissed) {
      const timer = window.setTimeout(() => setShowPrompt(true), 1800);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
        window.removeEventListener('appinstalled', onInstalled);
      };
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowPrompt(false);
  };

  const install = async () => {
    if (!deferredPrompt || isInstalling) return;
    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome !== 'accepted') dismiss();
    } finally {
      setIsInstalling(false);
      setDeferredPrompt(null);
    }
  };

  if (!showPrompt || isInstalled() || (!deferredPrompt && !ios)) return null;
  return (
    <aside role="dialog" aria-label="Installer EDUCO" className="fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[360px] z-[70] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 animate-fade-slide-up">
      <button onClick={dismiss} className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Ne pas afficher pendant une semaine"><X className="w-4 h-4" /></button>
      <div className="flex gap-3 pr-5">
        <div className="shrink-0 rounded-xl bg-[#1F4A59] p-2.5 text-white"><Smartphone className="w-5 h-5" /></div>
        <div>
          <p className="text-sm font-black text-slate-900 dark:text-white">Installer EDUCO</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {ios ? <>Ajoutez EDUCO à votre écran d’accueil pour l’ouvrir comme une application.</> : <>Accédez plus rapidement à EDUCO et utilisez-la comme une application indépendante.</>}
          </p>
        </div>
      </div>
      {ios ? <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800 px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200"><Share className="inline w-3.5 h-3.5 mr-1 text-[#1F4A59] dark:text-sky-300" /> Touchez <strong>Partager</strong>, puis <strong>Sur l’écran d’accueil</strong>.</div> : <button onClick={install} disabled={isInstalling} className="mt-3 w-full rounded-xl bg-[#1F4A59] hover:bg-[#183944] disabled:opacity-60 py-2.5 text-xs font-black text-white flex items-center justify-center gap-2"><Download className="w-4 h-4" />{isInstalling ? 'Ouverture…' : 'Installer maintenant'}</button>}
    </aside>
  );
};

export default PwaInstallPrompt;
