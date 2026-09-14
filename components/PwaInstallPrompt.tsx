import React, { useEffect, useState } from 'react';
import { BellRing, Download, LoaderCircle, Share, Smartphone, X } from 'lucide-react';
import {
  enablePushNotifications,
  getPushPermissionState,
  sendTestPushNotification,
  syncExistingPushSubscription,
} from '../src/services/pushNotifications';

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const DISMISS_KEY = 'educo_pwa_install_dismissed_at';
const PUSH_DISMISS_KEY = 'educo_push_prompt_dismissed_at';
const DISMISS_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);
const isIosSafari = () => {
  const userAgent = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIos && /Safari/.test(userAgent) && !/CriOS|FxiOS|EdgiOS/.test(userAgent);
};

/** Handles both PWA installation and the explicit opt-in required for Web Push. */
export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPrompt | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(() => isInstalled());
  const [isInstalling, setIsInstalling] = useState(false);
  const [ios, setIos] = useState(false);
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    setIos(isIosSafari());
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const recentlyDismissed = Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DELAY_MS;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPrompt);
      if (!recentlyDismissed && !isInstalled()) setShowPrompt(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
      localStorage.removeItem(DISMISS_KEY);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    let iosTimer: number | undefined;
    if (!isInstalled() && isIosSafari() && !recentlyDismissed) {
      iosTimer = window.setTimeout(() => setShowPrompt(true), 1800);
    }

    return () => {
      if (iosTimer) window.clearTimeout(iosTimer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const checkPush = async () => {
      if (cancelled || !isInstalled()) return;
      setInstalled(true);
      const sessionActive = sessionStorage.getItem('EDUCO_SESSION_ACTIVE') === 'true';
      if (!sessionActive) return;

      const permission = getPushPermissionState();
      if (permission === 'unsupported' || permission === 'denied') return;

      if (permission === 'granted') {
        const synced = await syncExistingPushSubscription().catch(() => false);
        if (synced) {
          setShowPushPrompt(false);
          return;
        }
      }

      const dismissedAt = Number(localStorage.getItem(PUSH_DISMISS_KEY) || 0);
      const recentlyDismissed = Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_DELAY_MS;
      if (!recentlyDismissed) setShowPushPrompt(true);
    };

    void checkPush();
    const interval = window.setInterval(() => void checkPush(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowPrompt(false);
  };

  const dismissPush = () => {
    localStorage.setItem(PUSH_DISMISS_KEY, String(Date.now()));
    setShowPushPrompt(false);
    setPushError(null);
    setPushMessage(null);
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

  const activatePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    setPushMessage(null);
    try {
      const result = await enablePushNotifications();
      if (!result.success) {
        setPushError(result.message);
        return;
      }
      localStorage.removeItem(PUSH_DISMISS_KEY);
      setPushMessage(result.message);
      await sendTestPushNotification().catch(() => null);
      window.setTimeout(() => setShowPushPrompt(false), 2200);
    } finally {
      setPushBusy(false);
    }
  };

  if (installed && showPushPrompt) {
    return (
      <aside role="dialog" aria-label="Activer les notifications EDUCO" className="fixed left-4 right-4 bottom-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-[380px] z-[70] rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl p-4 animate-fade-slide-up">
        <button onClick={dismissPush} className="absolute top-3 right-3 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Rappeler plus tard"><X className="w-4 h-4" /></button>
        <div className="flex gap-3 pr-5">
          <div className="shrink-0 rounded-xl bg-[#1F4A59] p-2.5 text-white"><BellRing className="w-5 h-5" /></div>
          <div>
            <p className="text-sm font-black text-slate-900 dark:text-white">Recevoir les alertes EDUCO</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Activez les notifications pour recevoir les messages importants même quand EDUCO est fermé ou que l’écran du téléphone est verrouillé.
            </p>
          </div>
        </div>
        {pushError && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{pushError}</div>}
        {pushMessage && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-700">{pushMessage}</div>}
        <button onClick={activatePush} disabled={pushBusy} className="mt-3 w-full rounded-xl bg-[#1F4A59] hover:bg-[#183944] disabled:opacity-60 py-2.5 text-xs font-black text-white flex items-center justify-center gap-2">
          {pushBusy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
          {pushBusy ? 'Activation…' : 'Activer les notifications'}
        </button>
      </aside>
    );
  }

  if (!showPrompt || installed || (!deferredPrompt && !ios)) return null;
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
