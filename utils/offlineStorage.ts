// Comprehensive Offline Storage and Auto-Sync Service for Educo

export interface SyncQueueItem {
  id: string;
  type: 'TRANSACTION' | 'PAYMENT' | 'USER' | 'GRADE' | 'BUDGET' | 'FULL_SYNC';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  endpoint?: string;
  payload: any;
  timestamp: string;
}

const STORAGE_KEY = 'educo_offline_app_data_v1';
const QUEUE_KEY = 'educo_pending_sync_queue_v1';
const LAST_SYNC_KEY = 'educo_last_sync_timestamp';

// Load entire application state from local storage
export function loadOfflineData(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Erreur lors du chargement des données locales:', err);
    return null;
  }
}

// Save entire application state to local storage
export function saveOfflineData(data: Record<string, any>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn('Erreur lors de la sauvegarde locale:', err);
  }
}

// Get queue of pending offline operations
export function getPendingQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

// Add an item to the pending offline queue
export function queueOfflineOperation(item: Omit<SyncQueueItem, 'id' | 'timestamp'>) {
  try {
    const queue = getPendingQueue();
    const newItem: SyncQueueItem = {
      ...item,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    queue.push(newItem);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return newItem;
  } catch (err) {
    console.error('Erreur ajout file d\'attente synchro:', err);
    return null;
  }
}

// Clear or remove items from pending queue
export function clearPendingQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch (err) {
    console.warn('Erreur nettoyage file d\'attente:', err);
  }
}

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY);
}

export function updateLastSyncTime() {
  const now = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  localStorage.setItem(LAST_SYNC_KEY, now);
  return now;
}

// Execute automatic sync against server
export async function syncPendingOperationsToServer(onProgress?: (msg: string) => void): Promise<{ success: boolean; syncedCount: number; error?: string }> {
  const queue = getPendingQueue();
  if (queue.length === 0) {
    updateLastSyncTime();
    return { success: true, syncedCount: 0 };
  }

  try {
    if (onProgress) onProgress(`Synchronisation de ${queue.length} opération(s) hors-ligne...`);

    const res = await fetch('/api/sync-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: queue }),
    });

    if (!res.ok) {
      throw new Error(`Erreur serveur (${res.status})`);
    }

    const result = await res.json();
    clearPendingQueue();
    updateLastSyncTime();
    return { success: true, syncedCount: queue.length };
  } catch (err: any) {
    console.warn('Échec de la synchronisation automatique:', err);
    return { success: false, syncedCount: 0, error: err?.message || 'Serveur indisponible' };
  }
}
