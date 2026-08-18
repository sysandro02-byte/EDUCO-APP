import React, { useState, useEffect } from 'react';
import { Fingerprint, Smartphone, Laptop, Trash2, Edit2, Plus, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Key, Sparkles } from 'lucide-react';
import { 
  fetchUserDevices, 
  registerWebAuthnCredential, 
  renameUserDevice, 
  revokeUserDevice, 
  WebAuthnDevice, 
  isWebAuthnSupported,
  detectDeviceName 
} from '../../src/services/webauthnService';

interface BiometricDevicesSettingsCardProps {
  userEmail: string;
  userId?: string;
  userName?: string;
}

export const BiometricDevicesSettingsCard: React.FC<BiometricDevicesSettingsCardProps> = ({
  userEmail,
  userId,
  userName
}) => {
  const [devices, setDevices] = useState<WebAuthnDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const list = await fetchUserDevices(userEmail);
      setDevices(list);
    } catch (err) {
      console.error('Error loading devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userEmail) {
      loadDevices();
    }
  }, [userEmail]);

  const handleRegisterNewDevice = async () => {
    setActionLoading(true);
    setNotice(null);
    try {
      const defaultName = detectDeviceName();
      const res = await registerWebAuthnCredential(userEmail, userId, userName, defaultName);
      if (res.success) {
        setNotice({ type: 'success', message: res.message });
        await loadDevices();
      } else {
        const message = res.error || 'Impossible d\'enregistrer cet appareil.';
        setNotice({ type: 'error', message });
        alert(message);
      }
    } catch (err: any) {
      const message = err.message || 'Erreur d\'association.';
      setNotice({ type: 'error', message });
      alert(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartRename = (device: WebAuthnDevice) => {
    setEditingId(device.id);
    setEditName(device.deviceName);
  };

  const handleSaveRename = async (id: string) => {
    if (!editName.trim()) return;
    setActionLoading(true);
    try {
      const ok = await renameUserDevice(id, editName.trim());
      if (ok) {
        setNotice({ type: 'success', message: 'Nom d\'appareil mis à jour.' });
        setEditingId(null);
        await loadDevices();
      } else {
        setNotice({ type: 'error', message: 'Erreur lors du renommage.' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir révoquer la clé biométrique de "${name}" ?`)) return;
    setActionLoading(true);
    try {
      const ok = await revokeUserDevice(id);
      if (ok) {
        setNotice({ type: 'success', message: `L'appareil "${name}" a été révoqué avec succès.` });
        await loadDevices();
      } else {
        setNotice({ type: 'error', message: 'Erreur lors de la révocation.' });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const supported = isWebAuthnSupported();

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
              <span>Connexion Biométrique & Passkeys</span>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-black rounded-full border border-emerald-300 dark:border-emerald-800">
                WebAuthn
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gérez les appareils autorisés à se connecter à votre compte EDUCO via Touch ID, Face ID ou Windows Hello.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={!supported || actionLoading}
          onClick={handleRegisterNewDevice}
          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          <span>Associer cet appareil</span>
        </button>
      </div>

      {notice && (
        <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
          notice.type === 'success' 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
            <span>{notice.message}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Chargement de vos clés biométriques...</span>
        </div>
      ) : devices.length === 0 ? (
        <div className="p-8 text-center space-y-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
          <div className="inline-flex p-3 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl">
            <Key className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-200">Aucun appareil biométrique configuré</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Associez votre appareil actuel pour pouvoir vous connecter instantanément sans taper votre mot de passe.
            </p>
          </div>
          <button
            type="button"
            disabled={!supported || actionLoading}
            onClick={handleRegisterNewDevice}
            className="px-4 py-2 bg-[#1F4A59] hover:bg-[#285f72] text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span>Activer la biométrie maintenant</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {devices.map((device) => {
            const isEditing = editingId === device.id;
            const isMobile = /iPhone|iPad|Android/i.test(device.deviceName);

            return (
              <div
                key={device.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                    {isMobile ? <Smartphone className="w-5 h-5 text-emerald-600" /> : <Laptop className="w-5 h-5 text-sky-600" />}
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    {isEditing ? (
                      <div className="flex items-center gap-2 max-w-xs">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-800 dark:text-white outline-none w-full"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(device.id)}
                          className="px-2.5 py-1 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 cursor-pointer"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                          {device.deviceName}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleStartRename(device)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                          title="Renommer l'appareil"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Ajouté le : {new Date(device.createdAt).toLocaleDateString('fr-FR')}</span>
                      {device.lastUsedAt && (
                        <span>• Dernier accès : {new Date(device.lastUsedAt).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleRevoke(device.id, device.deviceName)}
                  className="p-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer shrink-0"
                  title="Révoquer cet appareil"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
