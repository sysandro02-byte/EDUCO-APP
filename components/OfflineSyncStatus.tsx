import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Download, AlertTriangle, Cloud, Server } from 'lucide-react';
import { 
  getPendingQueue, 
  syncPendingOperationsToServer, 
  getLastSyncTime, 
  updateLastSyncTime,
  SyncQueueItem
} from '../utils/offlineStorage';

interface OfflineSyncStatusProps {
  onSyncComplete?: () => void;
}

export const OfflineSyncStatus: React.FC<OfflineSyncStatusProps> = ({ onSyncComplete }) => {
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingItems, setPendingItems] = useState<SyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSync, setLastSync] = useState<string | null>(() => getLastSyncTime());
  const [toastMessage, setToastMessage] = useState<{ title: string; body: string; type: 'success' | 'warning' | 'syncing' } | null>(null);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState<boolean>(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);

  const refreshPendingQueueState = () => {
    const queue = getPendingQueue();
    setPendingCount(queue.length);
    setPendingItems(queue);
  };

  useEffect(() => {
    refreshPendingQueueState();

    const handleOnline = async () => {
      setIsOnline(true);
      setToastMessage({
        title: "Connexion rétablie",
        body: "Connexion au serveur rétablie. Lancement de la synchronisation automatique...",
        type: "success"
      });
      await handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setToastMessage({
        title: "Mode Hors-Ligne Actif",
        body: "Les modifications sont enregistrées localement et seront synchronisées dès le retour de la connexion.",
        type: "warning"
      });
    };

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setToastMessage({
        title: "Application Installée",
        body: "🎉 L'application Educo a été installée avec succès sur votre appareil.",
        type: "success"
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstalled(true);
    }

    const interval = setInterval(() => {
      refreshPendingQueueState();
    }, 2500);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(interval);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setToastMessage({
        title: "Installation PWA",
        body: "Pour installer sur mobile : appuyez sur le bouton Partager de votre navigateur puis sur 'Sur l'écran d'accueil'.",
        type: "success"
      });
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  const handleSync = async () => {
    if (isSyncing) return;
    const queueSnapshot = [...pendingItems];
    setIsSyncing(true);
    setToastMessage({
      title: "Synchronisation Supabase en cours...",
      body: `Pousse en cours vers le cloud (${queueSnapshot.length} enregistrements en attente)...`,
      type: "syncing"
    });

    try {
      const result = await syncPendingOperationsToServer();
      if (result.success) {
        const nowTime = updateLastSyncTime();
        setLastSync(nowTime);
        refreshPendingQueueState();

        // Summarize exact types synced
        const typesSynced = Array.from(new Set(queueSnapshot.map(q => q.type))).join(', ');
        
        if (queueSnapshot.length > 0) {
          setToastMessage({
            title: "Synchronisation Réussie avec Supabase",
            body: `${queueSnapshot.length} enregistrement(s) (${typesSynced || 'Transactions, Paiements, Utilisateurs'}) poussés avec succès vers le cloud.`,
            type: "success"
          });
        } else {
          setToastMessage({
            title: "Données à jour",
            body: "Toutes les tables Supabase sont parfaitement à jour.",
            type: "success"
          });
        }
        if (onSyncComplete) onSyncComplete();
      } else {
        setToastMessage({
          title: "Échec de Synchronisation",
          body: `Synchronisation reportée : ${result.error || 'Serveur temporairement injoignable'}`,
          type: "warning"
        });
      }
    } catch (e: any) {
      setToastMessage({
        title: "Erreur de Synchronisation",
        body: e?.message || 'Erreur réseau vers Supabase',
        type: "warning"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      {/* Top Banner / Status Indicator in Header with Pulsing Sync Animation */}
      <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xs transition-all">
        {/* Pulsing Syncing State Badge */}
        {isSyncing ? (
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-300 dark:border-indigo-700 px-3 py-1 rounded-full animate-pulse shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-600"></span>
            </span>
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 dark:text-indigo-400" />
            <span className="font-extrabold tracking-tight">Synchro Supabase en cours...</span>
          </div>
        ) : isOnline ? (
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold">Connecté (Supabase)</span>
            {lastSync && <span className="text-[10px] text-emerald-600 dark:text-emerald-400 opacity-80 border-l border-emerald-200 dark:border-emerald-800 pl-1.5 ml-1">Synchro {lastSync}</span>}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 px-2.5 py-1 rounded-full font-semibold animate-pulse">
            <WifiOff className="w-3.5 h-3.5 text-amber-600" />
            <span>Mode Hors-Ligne (Stockage local)</span>
          </div>
        )}

        {/* PWA Install Button */}
        {!isInstalled && (
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1F4A59] text-white hover:bg-[#2a6275] active:scale-95 transition-all shadow-xs cursor-pointer"
            title="Installer Educo comme application autonome"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Installer l'application</span>
            <span className="sm:hidden">Installer</span>
          </button>
        )}

        {pendingCount > 0 && !isSyncing && (
          <button
            onClick={handleSync}
            disabled={!isOnline}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-transform active:scale-95 cursor-pointer"
            title="Cliquer pour pousser les modifications vers le serveur central"
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>{pendingCount} à synchroniser</span>
          </button>
        )}
      </div>

      {/* Floating Detailed Sync Notification Toast */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 max-w-md text-white text-xs font-medium p-4 rounded-2xl shadow-2xl border flex items-start gap-3.5 animate-slide-up ${
          toastMessage.type === 'success' 
            ? 'bg-slate-900 border-emerald-500/40 shadow-emerald-500/10' 
            : toastMessage.type === 'syncing'
            ? 'bg-indigo-950 border-indigo-500/50 shadow-indigo-500/20'
            : 'bg-amber-950 border-amber-500/40'
        }`}>
          <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${
            toastMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : toastMessage.type === 'syncing' ? 'bg-indigo-500/20 text-indigo-300 animate-spin' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : toastMessage.type === 'syncing' ? <RefreshCw className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <p className="font-bold text-sm tracking-tight">{toastMessage.title}</p>
            <p className="text-slate-300 mt-1 leading-relaxed text-xs">{toastMessage.body}</p>
          </div>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
};
export default OfflineSyncStatus;
