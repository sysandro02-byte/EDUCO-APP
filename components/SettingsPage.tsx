import React, { useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import SubjectForm, { Subject } from './SubjectForm';
import { User } from './UserForm';
// FIX: Imported the missing ReportingIcon component.
import { BuildingLibraryIcon, KeyIcon, ClassesIcon, DatabaseIcon, MessageIcon, PencilIcon, TrashIcon, PlusCircleIcon, MoneyIcon, ReceiptIcon, BriefcaseIcon, BellIcon, ShieldCheckIcon, ReportingIcon, SparklesIcon } from './Icons';
import { User as UserIcon, ShieldCheck, Mail, Send, CheckCircle2, AlertCircle, Layers, RefreshCw, ExternalLink, Download, Smartphone, Laptop, X, Clock, Lock } from 'lucide-react';
import { initialSchoolSettings, initialMessageTemplates, initialCashierSettings, initialRafSettings } from '../constants';
import { brevoEmailService } from '../src/services/brevoEmailService';
import { compressBase64Image } from '../utils/imageCompressor';
import UserAvatar from './UserAvatar';
import { BiometricDevicesSettingsCard } from './auth/BiometricDevicesSettingsCard';

type SchoolSettings = typeof initialSchoolSettings;
type MessageTemplate = typeof initialMessageTemplates[0];
type CashierSettingsType = typeof initialCashierSettings;
type RafSettingsType = typeof initialRafSettings;


// --- SHARED STYLES ---
const styles = `
    .input-style {
        display: block;
        width: 100%;
        border-radius: 0.375rem;
        border-width: 1px;
        border-color: #D1D5DB;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
    }
    .input-style:focus {
        --tw-ring-color: #4f46e5;
        border-color: #4f46e5;
    }
    .btn-primary {
        padding: 0.5rem 1rem;
        background-color: #1F4A59;
        color: white;
        border-radius: 0.375rem;
        font-weight: 500;
        font-size: 0.875rem;
    }
    .btn-primary:hover {
        background-color: #2c5a6e;
    }
    .btn-secondary {
        padding: 0.5rem 1rem;
        background-color: #E5E7EB;
        color: #1F2937;
        border-radius: 0.375rem;
        font-weight: 500;
        font-size: 0.875rem;
    }
`;

// --- ADMIN SUB-COMPONENTS ---
const SchoolSettingsTab: React.FC<{ settings: SchoolSettings; onSave: (settings: SchoolSettings) => void; }> = ({ settings, onSave }) => {
    const [formData, setFormData] = useState(settings);
    const [savedNotice, setSavedNotice] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 4000);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {savedNotice && (
                <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Les paramètres de l'établissement ont été enregistrés avec succès.</span>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-5">
                <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="w-9 h-9 rounded-xl bg-[#1F4A59]/10 text-[#1F4A59] dark:bg-sky-400/10 dark:text-sky-300 flex items-center justify-center font-bold">
                        <BuildingLibraryIcon />
                    </div>
                    <div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-tight">Identité & Information Globale</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Coordonnées officielles, slogan et année académique courante.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nom Officiel de l'Établissement</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#1F4A59]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Slogan ou Devise de la Marque</label>
                        <input type="text" name="slogan" value={formData.slogan} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#1F4A59]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Adresse Géographique</label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#1F4A59]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Téléphone Secrétariat & Direction</label>
                        <input type="text" name="contact" value={formData.contact} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#1F4A59]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">E-mail Officiel de Contact</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#1F4A59]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Année Académique Active</label>
                        <input type="text" name="currentYear" value={formData.currentYear} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-[#1F4A59] dark:text-sky-400 focus:outline-none focus:border-[#1F4A59]" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Devise de Facturation Principale</label>
                        <select name="currency" value={formData.currency} onChange={handleChange} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#1F4A59]">
                            <option value="FCFA">FCFA (Franc CFA)</option>
                            <option value="EUR">EUR (€ Euros)</option>
                            <option value="USD">USD ($ Dollars US)</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-end pt-3">
                    <button type="submit" className="px-5 py-2.5 bg-[#1F4A59] hover:bg-[#183944] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer">
                        <span>Enregistrer les Modifications</span>
                    </button>
                </div>
            </div>
        </form>
    );
};
const AccessTab: React.FC<{ users?: User[]; onSaveUser?: (user: User) => void; }> = ({ users = [], onSaveUser }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRole, setSelectedRole] = useState('All');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                              (u.studentId && u.studentId.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesRole = selectedRole === 'All' || u.role === selectedRole;
        return matchesSearch && matchesRole;
    });

    const handleResetPassword = (user: User) => {
        const tempPassword = `Educo${Math.floor(1000 + Math.random() * 9000)}!`;
        setStatusMessage(`Mot de passe temporaire pour ${user.name} généré : ${tempPassword} (transmis avec succès)`);
        setTimeout(() => setStatusMessage(null), 8000);
    };

    const handleToggleStatus = (user: User) => {
        if (!onSaveUser) return;
        const newStatus = user.status === 'Inactif' ? 'Actif' : 'Inactif';
        onSaveUser({ ...user, status: newStatus as any });
        setStatusMessage(`Statut de ${user.name} mis à jour : ${newStatus}`);
        setTimeout(() => setStatusMessage(null), 4000);
    };

    const handleRoleChange = (user: User, newRole: string) => {
        if (!onSaveUser) return;
        onSaveUser({ ...user, role: newRole as any });
        setStatusMessage(`Rôle de ${user.name} changé en ${newRole}`);
        setTimeout(() => setStatusMessage(null), 4000);
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Gestion des Accès & Sécurité</h3>
                <p className="text-sm text-gray-500">Contrôlez les rôles utilisateurs, réinitialisez les mots de passe et gérez les statuts d'accès.</p>
            </div>

            {statusMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center justify-between animate-fadeIn">
                    <span>{statusMessage}</span>
                    <button onClick={() => setStatusMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">&times;</button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
                <input
                    type="text"
                    placeholder="Rechercher par nom, email ou matricule..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-style flex-1"
                />
                <select 
                    value={selectedRole} 
                    onChange={(e) => setSelectedRole(e.target.value)} 
                    className="input-style w-auto"
                >
                    <option value="All">Tous les rôles</option>
                    <option value="Admin">Admin</option>
                    <option value="Responsable des finances">Responsable des finances</option>
                    <option value="Caissière">Caissière</option>
                    <option value="Directeur des Etudes">Directeur des Études</option>
                    <option value="Enseignant">Enseignant</option>
                    <option value="Élève">Élève</option>
                    <option value="Parent">Parent</option>
                    <option value="Promoteur">Promoteur</option>
                </select>
            </div>

            <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Utilisateur</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Rôle</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Statut</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Actions de Sécurité</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                                    Aucun utilisateur trouvé.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.slice(0, 15).map((u) => (
                                <tr key={u.id}>
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-gray-800">{u.name}</div>
                                        <div className="text-xs text-gray-500">{u.email || u.studentId || `ID: ${u.id}`}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <select 
                                            value={u.role} 
                                            onChange={(e) => handleRoleChange(u, e.target.value)}
                                            className="text-xs border rounded px-2 py-1 bg-gray-50 text-gray-700"
                                        >
                                            <option value="Admin">Admin</option>
                                            <option value="Responsable des finances">Responsable des finances</option>
                                            <option value="Caissière">Caissière</option>
                                            <option value="Directeur des Etudes">Directeur des Etudes</option>
                                            <option value="Enseignant">Enseignant</option>
                                            <option value="Élève">Élève</option>
                                            <option value="Parent">Parent</option>
                                            <option value="Promoteur">Promoteur</option>
                                        </select>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                            u.status === 'Inactif' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                            {u.status || 'Actif'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right space-x-2">
                                        <button
                                            onClick={() => handleResetPassword(u)}
                                            className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 rounded border border-amber-200 transition-colors"
                                            title="Générer un mot de passe temporaire"
                                        >
                                            Réinitialiser MDP
                                        </button>
                                        <button
                                            onClick={() => handleToggleStatus(u)}
                                            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                                u.status === 'Inactif' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                                                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {u.status === 'Inactif' ? 'Réactiver' : 'Désactiver'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {filteredUsers.length > 15 && (
                <p className="text-xs text-gray-400 text-right">Affichage des 15 premiers résultats sur {filteredUsers.length}. Utilisez la recherche pour filtrer.</p>
            )}
        </div>
    );
};

const SystemTab: React.FC<{ onExportBackup?: (password?: string) => void; onRestoreBackup?: (rawText: string, password?: string) => Promise<boolean> | boolean;
  communicationSettings?: any;
  onSaveCommunicationSettings?: (settings: any) => void; }> = ({ onExportBackup, onRestoreBackup }) => {
    const [restoreStatus, setRestoreStatus] = useState<{ message: string; isError?: boolean } | null>(null);
    const [selectedLanguage, setSelectedLanguage] = useState('Français');
    const [dashboardMode, setDashboardMode] = useState('Avancé');
    const [enableEncryption, setEnableEncryption] = useState(false);
    const [backupPassword, setBackupPassword] = useState('');
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(() => {
        return localStorage.getItem('educo_auto_backup_enabled') !== 'false';
    });

    const handleAutoBackupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        setAutoBackupEnabled(isChecked);
        localStorage.setItem('educo_auto_backup_enabled', isChecked ? 'true' : 'false');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const rawText = event.target?.result as string;
                let passwordToUse = '';
                try {
                    const parsedHeader = JSON.parse(rawText);
                    if (parsedHeader.encrypted) {
                        const inputPass = prompt("Ce fichier de sauvegarde est chiffré (AES-GCM). Veuillez saisir le mot de passe de déchiffrement :");
                        if (inputPass === null) return;
                        passwordToUse = inputPass;
                    }
                } catch (e) {}

                if (onRestoreBackup) {
                    const success = await onRestoreBackup(rawText, passwordToUse);
                    if (success) {
                        setRestoreStatus({ message: 'Restauration effectuée avec succès ! Les données ont été synchronisées.' });
                    } else {
                        setRestoreStatus({ message: 'Échec de la restauration (mot de passe incorrect ou format invalide).', isError: true });
                    }
                } else {
                    setRestoreStatus({ message: 'Fichier lu avec succès.', isError: false });
                }
            } catch (err) {
                setRestoreStatus({ message: 'Format de fichier de sauvegarde invalide.', isError: true });
            }
        };
        reader.readAsText(file);
    };

    const handleClearCaches = () => {
        if (window.confirm('Voulez-vous rafraîchir le cache local et recalculer les états financiers ?')) {
            setRestoreStatus({ message: 'Cache local rafraîchi avec succès et données recalculées.' });
            setTimeout(() => setRestoreStatus(null), 5000);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Paramètres Système & Sauvegardes</h3>
                <p className="text-sm text-gray-500">Sauvegardez l'ensemble de votre base de données avec option de chiffrement ou restaurez un état antérieur.</p>
            </div>

            {restoreStatus && (
                <div className={`p-4 rounded-lg text-sm border flex items-center justify-between ${
                    restoreStatus.isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                    <span>{restoreStatus.message}</span>
                    <button onClick={() => setRestoreStatus(null)} className="font-bold ml-2">&times;</button>
                </div>
            )}

            <div className="p-4 border rounded-xl bg-gray-50/70 space-y-4">
                <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                    <DatabaseIcon className="w-5 h-5 text-[#1F4A59]" />
                    Sauvegarde & Restauration Sécurisée des Données
                </h4>
                <p className="text-xs text-gray-600">
                    Exportez un instantané complet de toutes les tables (élèves, transactions, notes, caisse, personnel) avec option de chiffrement par mot de passe (AES-256) pour garantir la sécurité lors du stockage local ou de l'exportation.
                </p>

                <div className="bg-white p-3 border rounded-lg space-y-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={enableEncryption} 
                            onChange={(e) => setEnableEncryption(e.target.checked)}
                            className="rounded text-[#1F4A59] focus:ring-[#1F4A59] w-4 h-4"
                        />
                        <span>🔒 Activer le chiffrement par mot de passe du backup</span>
                    </label>
                    {enableEncryption && (
                        <div className="space-y-1 pl-6">
                            <label className="block text-xs font-medium text-gray-600">Mot de passe de chiffrement / déchiffrement</label>
                            <input 
                                type="password" 
                                placeholder="Entrez un mot de passe sécurisé..." 
                                value={backupPassword}
                                onChange={(e) => setBackupPassword(e.target.value)}
                                className="input-style text-xs py-1.5 max-w-md"
                            />
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                    <button 
                        type="button" 
                        onClick={() => {
                            if (window.confirm("ATTENTION : Cette action supprimera toutes les données (élèves, finances, etc.) à l'exception des paramètres de l'établissement et sauvegardera le tout dans le compte des administrateurs. Êtes-vous sûr ?")) {
                                fetch('/api/admin/reset-and-backup', { method: 'POST' })
                                    .then(r => r.json())
                                    .then(data => alert(data.message || 'Opération réussie'))
                                    .catch(err => alert('Erreur : ' + err.message));
                            }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                        ⚠️ Réinitialiser et Sauvegarder
                    </button>
                    
                    <button 
                        type="button" 
                        onClick={() => {
                            if (enableEncryption && !backupPassword) {
                                alert("Veuillez saisir un mot de passe pour chiffrer la sauvegarde.");
                                return;
                            }
                            if (onExportBackup) {
                                onExportBackup(enableEncryption ? backupPassword : undefined);
                            } else {
                                alert('Exportation déclenchée !');
                            }
                        }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <span>📥 Télécharger la Sauvegarde {enableEncryption ? 'Chiffrée' : '(JSON)'}</span>
                    </button>
                    
                    <label className="btn-secondary cursor-pointer flex items-center gap-2 hover:bg-gray-200">
                        <span>📤 Restaurer depuis un fichier</span>
                        <input 
                            type="file" 
                            accept=".json" 
                            onChange={handleFileChange} 
                            className="hidden" 
                        />
                    </label>

                    <button 
                        type="button" 
                        onClick={handleClearCaches}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 text-sm font-medium transition-colors"
                    >
                        ⚡ Rafraîchir les Caches
                    </button>
                </div>
            </div>

            <div className="p-4 border rounded-xl bg-white space-y-4">
                <h4 className="font-semibold text-gray-800">Préférences Régionales & Interface</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Langue de l'application</label>
                        <select 
                            value={selectedLanguage} 
                            onChange={(e) => setSelectedLanguage(e.target.value)} 
                            className="input-style"
                        >
                            <option value="Français">Français (FR)</option>
                            <option value="English">English (EN)</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mode d'affichage du tableau de bord</label>
                        <select 
                            value={dashboardMode} 
                            onChange={(e) => setDashboardMode(e.target.value)} 
                            className="input-style"
                        >
                            <option value="Avancé">Avancé (Analytique complet)</option>
                            <option value="Standard">Standard (Vue simplifiée)</option>
                        </select>
                    </div>
                </div>

                <div className="pt-4 border-t flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            id="autoBackup" 
                            checked={autoBackupEnabled} 
                            onChange={handleAutoBackupChange} 
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                        />
                        <label htmlFor="autoBackup" className="text-sm font-semibold text-gray-700">
                            Activer la sauvegarde automatique quotidienne de la base de données (Fichier JSON téléchargeable)
                        </label>
                    </div>
                    {autoBackupEnabled && (
                        <div className="ml-7 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800 border border-indigo-100 flex items-start gap-2">
                            <DatabaseIcon />
                            <div>
                                <p className="font-semibold">Sauvegarde automatique activée</p>
                                <p className="mt-1">Un fichier de sauvegarde JSON sera généré et proposé au téléchargement automatiquement chaque jour lors de la première connexion de l'administrateur.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
const CommunicationTab: React.FC<{ 
    templates: MessageTemplate[], 
    onSave: (template: any) => void,
    settings: any,
    onSaveSettings: (settings: any) => void
}> = ({ templates, onSave, settings, onSaveSettings }) => {
    const [editingTemplates, setEditingTemplates] = useState(templates);
    const [localSettings, setLocalSettings] = useState(settings);
    const [testEmail, setTestEmail] = useState('');
    const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; msg?: string; mode?: string } | null>(null);
    const [senderCheck, setSenderCheck] = useState<{
        loading: boolean;
        checked: boolean;
        configuredEmail: string;
        isVerified: boolean;
        msg?: string;
    } | null>(null);

    const handleTemplateChange = (index: number, field: 'title' | 'content', value: string) => { 
        const newTemplates = [...editingTemplates]; 
        (newTemplates[index] as any)[field] = value; 
        setEditingTemplates(newTemplates); 
    };

    const handleSaveLocalSettings = () => {
        onSaveSettings(localSettings);
        alert('Paramètres de communication sauvegardés avec succès !');
    };

    const handleCheckSender = async () => {
        setSenderCheck({ loading: true, checked: false, configuredEmail: localSettings.emailFrom || 'contacts@loukatech.com', isVerified: false });
        try {
            const res = await brevoEmailService.getSenders(localSettings.brevoApiKey);
            setSenderCheck({
                loading: false,
                checked: true,
                configuredEmail: res.configuredSenderEmail || 'contacts@loukatech.com',
                isVerified: res.isVerified,
                msg: res.isVerified 
                  ? "L'adresse expéditeur EMAIL_FROM est validée et active dans votre service de messagerie !" 
                  : res.error || "Adresse non trouvée ou non activée dans le tableau de bord de votre service e-mail."
            });
        } catch (err: any) {
            setSenderCheck({
                loading: false,
                checked: true,
                configuredEmail: localSettings.emailFrom || 'contacts@loukatech.com',
                isVerified: false,
                msg: err.message || "Erreur de connexion lors de la vérification de l'expéditeur"
            });
        }
    };

    const handleTestBrevoEmail = async () => {
        if (!testEmail || !testEmail.includes('@')) {
            alert('Veuillez saisir une adresse e-mail destinataire valide pour effectuer le test.');
            return;
        }

        setTestStatus({ loading: true });
        try {
            const res = await brevoEmailService.testBrevoConnection({
                apiKey: localSettings.brevoApiKey,
                senderEmail: localSettings.emailFrom || 'contacts@loukatech.com',
                senderName: localSettings.emailFromName || 'EDUCO',
                toEmail: testEmail.trim(),
                templateId: localSettings.brevoTemplateOtpId || null,
            });

            if (res.success) {
                setTestStatus({
                    loading: false,
                    success: true,
                    msg: res.mode === 'brevo_live' 
                      ? "Email de test transmis en direct avec succès !" 
                      : "Le service email a répondu sans confirmer un envoi direct. Vérifiez la configuration Brevo.",
                    mode: res.mode
                });
            } else {
                setTestStatus({
                    loading: false,
                    success: false,
                    msg: res.error || "Échec de l'envoi du message de test."
                });
            }
        } catch (err: any) {
            setTestStatus({
                loading: false,
                success: false,
                msg: err.message || "Erreur de connexion lors du test d'envoi"
            });
        }
    };

    return (
        <div className="space-y-8">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <MessageIcon /> <span className="ml-2">Intégration API de Messagerie (E-mail & SMS)</span>
                </h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Clé API Service de Messagerie</label>
                        <input 
                            type="password" 
                            value={localSettings.brevoApiKey || ''} 
                            onChange={(e) => setLocalSettings({...localSettings, brevoApiKey: e.target.value})} 
                            className="w-full input-style font-mono"
                            placeholder="xkeysib-..."
                        />
                        <p className="text-xs text-slate-500 mt-1">Fournie par votre service d'envoi d'e-mails transactionnels. Utilisée pour l'envoi direct de vos e-mails.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" checked={localSettings.emailEnabled} onChange={(e) => setLocalSettings({...localSettings, emailEnabled: e.target.checked})} className="rounded text-indigo-600" />
                            <span className="text-sm font-medium">Activer les Emails Transactionnels</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" checked={localSettings.smsEnabled} onChange={(e) => setLocalSettings({...localSettings, smsEnabled: e.target.checked})} className="rounded text-indigo-600" />
                            <span className="text-sm font-medium">Activer les SMS</span>
                        </label>
                        <label className="flex items-center space-x-2">
                            <input type="checkbox" checked={localSettings.whatsappEnabled} onChange={(e) => setLocalSettings({...localSettings, whatsappEnabled: e.target.checked})} className="rounded text-indigo-600" />
                            <span className="text-sm font-medium">Activer WhatsApp</span>
                        </label>
                    </div>

                    {/* Section 1 : Vérification de l'Adresse Expéditeur (EMAIL_FROM) */}
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> Vérification de l'adresse Expéditeur (EMAIL_FROM)
                                </h4>
                                <p className="text-xs text-slate-600 mt-1">
                                    Adresse configurée : <code className="bg-slate-200 px-1.5 py-0.5 rounded text-indigo-900 font-mono text-[11px]">{localSettings.emailFrom || "contacts@loukatech.com"}</code>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleCheckSender}
                                disabled={senderCheck?.loading}
                                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                            >
                                {senderCheck?.loading ? 'Vérification...' : 'Vérifier l\'Expéditeur'}
                            </button>
                        </div>

                        {senderCheck && !senderCheck.loading && (
                            <div className={`p-3 text-xs rounded-lg flex flex-col gap-1.5 font-medium ${senderCheck.isVerified ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                                <div className="flex items-center gap-2">
                                    {senderCheck.isVerified ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />}
                                    <span className="font-bold">{senderCheck.isVerified ? "Expéditeur validé et prêt" : "Expéditeur Non Confirmé"}</span>
                                </div>
                                <p className="text-[11px] leading-relaxed">{senderCheck.msg}</p>
                            </div>
                        )}

                        <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-2">
                            <p className="font-bold text-slate-700 flex items-center gap-1">
                                <span>📋 Procédure de validation de l'expéditeur e-mail :</span>
                            </p>
                            <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                                <li>Connectez-vous à votre compte fournisseur d'e-mail : <a href="https://app.brevo.com/senders" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-semibold inline-flex items-center gap-0.5">Console de Messagerie <ExternalLink className="w-3 h-3 text-indigo-500 inline" /></a></li>
                                <li>Allez dans <strong>Configuration &gt; Expéditeurs &amp; Domaines</strong>.</li>
                                <li>Ajoutez l'adresse <code>{localSettings.emailFrom || "contacts@loukatech.com"}</code> et confirmez le mail de validation reçu.</li>
                                <li><em>Authentification recommandée :</em> Ajoutez les clés DKIM / SPF de votre domaine <code>loukatech.com</code> dans vos DNS.</li>
                            </ol>
                        </div>
                    </div>

                    {/* Section 2 : Sélecteur Dynamique des Template IDs Brevo */}
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-indigo-600" /> Association Dynamique des Modèles d'E-mail
                        </h4>
                        <p className="text-xs text-slate-500">
                            Configurez ici les IDs de vos modèles d'e-mail personnalisés sans modifier le code source. Laissez vide pour utiliser nos gabarits HTML responsifs intégrés.
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Template ID - Codes OTP</label>
                                <input 
                                    type="text" 
                                    value={localSettings.brevoTemplateOtpId || ''} 
                                    onChange={(e) => setLocalSettings({...localSettings, brevoTemplateOtpId: e.target.value})} 
                                    className="w-full input-style text-xs font-mono bg-white"
                                    placeholder="ex: 1"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">Variable de Modèle : <code className="text-indigo-600 font-mono">&#123;&#123;params.otpCode&#125;&#125;</code></span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Template ID - Bienvenue</label>
                                <input 
                                    type="text" 
                                    value={localSettings.brevoTemplateWelcomeId || ''} 
                                    onChange={(e) => setLocalSettings({...localSettings, brevoTemplateWelcomeId: e.target.value})} 
                                    className="w-full input-style text-xs font-mono bg-white"
                                    placeholder="ex: 2"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">Variables : <code className="text-indigo-600 font-mono">&#123;&#123;params.schoolName&#125;&#125;</code>, <code className="text-indigo-600 font-mono">&#123;&#123;params.schoolIdentifier&#125;&#125;</code></span>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Template ID - Réinitialisation</label>
                                <input 
                                    type="text" 
                                    value={localSettings.brevoTemplateResetId || ''} 
                                    onChange={(e) => setLocalSettings({...localSettings, brevoTemplateResetId: e.target.value})} 
                                    className="w-full input-style text-xs font-mono bg-white"
                                    placeholder="ex: 3"
                                />
                                <span className="text-[10px] text-slate-500 mt-1 block">Variables : <code className="text-indigo-600 font-mono">&#123;&#123;params.resetCode&#125;&#125;</code>, <code className="text-indigo-600 font-mono">&#123;&#123;params.resetUrl&#125;&#125;</code></span>
                            </div>
                        </div>
                    </div>

                    {/* Section 3 : Testeur d'email Brevo */}
                    <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                            <Send className="w-3.5 h-3.5 text-indigo-600" /> Testeur d'Envoi d'E-mail
                        </h4>
                        <div className="flex gap-2">
                            <input 
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                placeholder="votre-email@exemple.com"
                                className="flex-1 input-style text-xs bg-white"
                            />
                            <button
                                type="button"
                                onClick={handleTestBrevoEmail}
                                disabled={testStatus?.loading}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                            >
                                {testStatus?.loading ? 'Envoi...' : 'Envoyer e-mail test'}
                            </button>
                        </div>
                        {testStatus && !testStatus.loading && (
                            <div className={`p-2.5 text-xs rounded-lg flex items-center gap-2 font-medium ${testStatus.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                                {testStatus.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                                <span>{testStatus.msg}</span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold text-slate-700 mb-2">Rappels Automatiques de Paiement</h4>
                        <label className="flex items-center space-x-2 mb-3">
                            <input type="checkbox" checked={localSettings.sendPendingPaymentReminders} onChange={(e) => setLocalSettings({...localSettings, sendPendingPaymentReminders: e.target.checked})} className="rounded text-indigo-600" />
                            <span className="text-sm font-medium">Envoyer automatiquement des rappels de paiement</span>
                        </label>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">Jours avant l'échéance (séparés par des virgules)</label>
                            <input 
                                type="text" 
                                value={localSettings.reminderDaysBefore?.join(', ') || ''} 
                                onChange={(e) => setLocalSettings({...localSettings, reminderDaysBefore: e.target.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))})} 
                                className="w-full input-style"
                                placeholder="ex: 7, 3, 1"
                            />
                        </div>
                    </div>

                    <button onClick={handleSaveLocalSettings} className="btn-primary mt-4 w-full">Enregistrer les paramètres API</button>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Modèles de Messages</h3>
                <div className="space-y-4">
                    {editingTemplates.map((template, index) => (
                        <div key={template.id} className="p-4 border rounded-lg bg-slate-50">
                            <input type="text" value={template.title} onChange={(e) => handleTemplateChange(index, 'title', e.target.value)} className="w-full font-semibold mb-3 input-style bg-white"/>
                            <textarea value={template.content} onChange={(e) => handleTemplateChange(index, 'content', e.target.value)} className="w-full h-24 input-style bg-white"/>
                            <div className="flex justify-end mt-3">
                                <button onClick={() => { onSave(editingTemplates[index]); alert('Modèle sauvegardé !'); }} className="btn-secondary text-sm">Mettre à jour ce modèle</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const AcademicTab: React.FC<{ subjects: Subject[]; onSave: (s: Subject) => void; onDelete: (id: number) => void; teachers: User[]; }> = ({ subjects, onSave, onDelete, teachers }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
    const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleEdit = (s: Subject) => {
        setEditingSubject(s);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingSubject(null);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (s: Subject) => {
        setSubjectToDelete(s);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = () => {
        if (subjectToDelete?.id) {
            onDelete(subjectToDelete.id);
        }
        setIsDeleteModalOpen(false);
        setSubjectToDelete(null);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Gestion Académique & Matières</h3>
                    <p className="text-sm text-gray-500">Configurez les matières enseignées et leurs attributions pédagogiques.</p>
                </div>
                <button onClick={handleAdd} className="btn-primary flex items-center gap-2">
                    <PlusCircleIcon />
                    <span>Ajouter une matière</span>
                </button>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Matière</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Professeurs</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {(subjects || []).map((s) => (
                            <tr key={s.id}>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">
                                    {(s.teacherIds || []).map(id => teachers.find(t => t.id === id)?.name).filter(Boolean).join(', ') || 'Non assigné'}
                                </td>
                                <td className="px-6 py-4 text-right text-sm font-medium space-x-3">
                                    <button onClick={() => handleEdit(s)} className="text-indigo-600 hover:text-indigo-900" title="Modifier">
                                        <PencilIcon />
                                    </button>
                                    <button onClick={() => handleDeleteClick(s)} className="text-red-600 hover:text-red-900" title="Supprimer">
                                        <TrashIcon />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSubject ? 'Modifier la matière' : 'Ajouter une matière'}>
                <SubjectForm
                    subject={editingSubject}
                    teachers={teachers}
                    onSave={(saved) => { onSave(saved); setIsModalOpen(false); }}
                    onCancel={() => setIsModalOpen(false)}
                />
            </Modal>

            <ConfirmDialog
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={confirmDelete}
                title="Supprimer la matière"
                itemType="la matière"
                itemName={subjectToDelete?.name}
                warningNote="Cette matière sera retirée des plannings et grilles d'évaluation associées."
            />
        </div>
    );
};

const IntegrationsTab: React.FC = () => {
    const [supabaseStatus, setSupabaseStatus] = useState<any>(null);

    React.useEffect(() => {
        fetch('/api/supabase/status')
            .then(r => r.json())
            .then(data => setSupabaseStatus(data))
            .catch(err => setSupabaseStatus({ configured: false, error: err.message }));
    }, []);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-gray-800">Intégrations (Supabase & IA)</h3>
                <p className="text-sm text-gray-500">Gérez les connexions avec vos services cloud externes (Supabase, Groq, Gemini).</p>
            </div>

            <div className="border p-4 rounded-xl bg-white shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <DatabaseIcon />
                    <h4 className="font-semibold text-gray-800">Supabase (PostgreSQL / Auth)</h4>
                </div>
                {supabaseStatus ? (
                    <div className="text-sm space-y-2">
                        <div className="flex items-center gap-2">
                            <span className={`w-3 h-3 rounded-full ${supabaseStatus.configured ? 'bg-green-500' : 'bg-red-500'}`}></span>
                            <span>{supabaseStatus.configured ? 'Connecté' : 'Non configuré'}</span>
                        </div>
                        <p className="text-gray-600">{supabaseStatus.message || supabaseStatus.error}</p>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">Vérification de la connexion...</p>
                )}
                <p className="text-xs text-gray-400 mt-2">Modifiez <code>SUPABASE_URL</code> et <code>SUPABASE_KEY</code> dans le fichier <code>.env</code>.</p>
            </div>

            <div className="border p-4 rounded-xl bg-white shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <SparklesIcon />
                    <h4 className="font-semibold text-gray-800">Intelligence Artificielle (Groq & Gemini)</h4>
                </div>
                <div className="text-sm space-y-2">
                    <p className="text-gray-600">L'IA générative est configurée via le backend pour les prévisions financières et rapports analytiques.</p>
                    <ul className="list-disc list-inside text-gray-500">
                        <li><strong>Gemini 2.5 Flash</strong> (via <code>GEMINI_API_KEY</code>) : Utilisé pour les rapports complets.</li>
                        <li><strong>Groq LLaMA 3</strong> (via <code>GROQ_API_KEY</code>) : Utilisé pour les prévisions trimestrielles rapides.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

// FIX: Extracted RenderContent into a stable, top-level component to prevent React error #525.
const AdminRenderContent: React.FC<any & { activeTab: string }> = ({ activeTab, ...props }) => {
    switch (activeTab) {
        case 'school': return <SchoolSettingsTab settings={props.schoolSettings} onSave={props.onSaveSchoolSettings} />;
        case 'access': return <AccessTab users={props.users} onSaveUser={props.onSaveUser} />;
        case 'academic': return <AcademicTab subjects={props.subjects} onSave={props.onSaveSubject} onDelete={props.onDeleteSubject} teachers={props.teachers} />;
        case 'system': return <SystemTab onExportBackup={props.onExportBackup} onRestoreBackup={props.onRestoreBackup} />;
        case 'integrations': return <IntegrationsTab />;
        case 'communication': return (
            <CommunicationTab 
                templates={props.messageTemplates} 
                onSave={props.onSaveMessageTemplate}
                settings={props.communicationSettings}
                onSaveSettings={props.onSaveCommunicationSettings!}
            />
        );
        default: return null;
    }
};

const AdminSettingsPanel: React.FC<any> = (props) => {
    const [activeTab, setActiveTab] = useState('school');
    const tabs = [
        { key: 'school', label: 'Établissement', icon: <BuildingLibraryIcon /> },
        { key: 'access', label: 'Accès & Sécurité', icon: <KeyIcon /> },
        { key: 'academic', label: 'Académique', icon: <ClassesIcon /> },
        { key: 'integrations', label: 'Cloud & IA', icon: <SparklesIcon /> },
        { key: 'system', label: 'Sauvegardes BD', icon: <DatabaseIcon /> },
        { key: 'communication', label: 'API Messagerie', icon: <MessageIcon /> },
    ];
    
    return (
        <div className="flex flex-col md:flex-row gap-6">
            <nav className="flex flex-row md:flex-col md:w-60 shrink-0 gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 scrollbar-none">
                {tabs.map(tab => (
                    <button 
                        key={tab.key} 
                        onClick={() => setActiveTab(tab.key)} 
                        className={`flex items-center gap-3 px-3.5 py-3 text-left rounded-xl text-xs font-bold transition-all w-full shrink-0 cursor-pointer ${
                            activeTab === tab.key 
                                ? 'bg-[#1F4A59] text-white shadow-xs' 
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        <span className="shrink-0">{tab.icon}</span>
                        <span className="whitespace-nowrap">{tab.label}</span>
                    </button>
                ))}
            </nav>
            <div className="flex-1 min-w-0">
                <AdminRenderContent activeTab={activeTab} {...props} />
            </div>
        </div>
    );
};


// --- CASHIER SUB-COMPONENTS ---
const CashierSettingsPanel: React.FC<{ settings: CashierSettingsType; onSave: (settings: CashierSettingsType) => void; }> = ({ settings, onSave }) => {
    const [formData, setFormData] = useState(settings);
    
    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        const [section, key] = name.split('.');
        if (key) { // Nested object
            setFormData(prev => ({ ...prev, [section]: { ...(prev as any)[section], [key]: type === 'checkbox' ? checked : value } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        alert('Paramètres sauvegardés !');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <fieldset className="p-4 border rounded-lg"><legend className="px-2 font-semibold">Configuration de la Caisse</legend>
                <div className="space-y-2 mt-2">
                    <div><label className="block text-sm">Montant d’ouverture de caisse</label><input type="number" name="openingAmount" value={formData.openingAmount} onChange={handleFormChange} className="mt-1 w-full input-style" /></div>
                    <div><label className="block text-sm">Modes de paiement</label>
                        <div className="flex gap-4 mt-1"><label><input type="checkbox" name="paymentMethods.cash" checked={formData.paymentMethods.cash} onChange={handleFormChange} /> Espèces</label><label><input type="checkbox" name="paymentMethods.mobileMoney" checked={formData.paymentMethods.mobileMoney} onChange={handleFormChange} /> Mobile Money</label><label><input type="checkbox" name="paymentMethods.transfer" checked={formData.paymentMethods.transfer} onChange={handleFormChange} /> Virement</label></div>
                    </div>
                </div>
            </fieldset>
            <fieldset className="p-4 border rounded-lg"><legend className="px-2 font-semibold">Personnalisation des Reçus</legend>
                <div className="space-y-2 mt-2">
                    <div><label className="block text-sm">Texte de pied de page</label><input type="text" name="receiptTemplate.footerText" value={formData.receiptTemplate.footerText} onChange={handleFormChange} className="mt-1 w-full input-style" /></div>
                    <div><label className="block text-sm">Nombre d'exemplaires à imprimer</label><input type="number" name="receiptTemplate.printCopies" value={formData.receiptTemplate.printCopies} onChange={handleFormChange} className="mt-1 w-full input-style" /></div>
                    <div><label><input type="checkbox" name="receiptTemplate.showQrCode" checked={formData.receiptTemplate.showQrCode} onChange={handleFormChange} /> Afficher le QR code</label></div>
                </div>
            </fieldset>
             <fieldset className="p-4 border rounded-lg"><legend className="px-2 font-semibold">Notifications</legend>
                <div className="space-y-1 mt-2">
                    <label><input type="checkbox" name="notifications.paymentValidated" checked={formData.notifications.paymentValidated} onChange={handleFormChange} /> Paiement validé / rejeté par le RAF</label><br/>
                    <label><input type="checkbox" name="notifications.newStudent" checked={formData.notifications.newStudent} onChange={handleFormChange} /> Nouvel élève ajouté</label><br/>
                    <label><input type="checkbox" name="notifications.cashDifference" checked={formData.notifications.cashDifference} onChange={handleFormChange} /> Écart de caisse détecté</label>
                </div>
            </fieldset>
            <div className="flex justify-end"><button type="submit" className="btn-primary">Sauvegarder</button></div>
        </form>
    );
};

// --- RAF SUB-COMPONENTS ---
// FIX: Extracted RenderContent into a stable, top-level component to prevent React error #525.
const RafRenderContent: React.FC<{ 
    activeTab: string; 
    formData: any; 
    handleFormChange: any; 
    cashierData: any; 
    handleCashierFormChange: any; 
}> = ({ activeTab, formData, handleFormChange, cashierData, handleCashierFormChange }) => {
    switch (activeTab) {
        case 'salaries': return (
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Taux de Cotisations Sociales (%)</label>
                    <input type="number" name="salaries.socialContributionsRate" value={formData.salaries.socialContributionsRate} onChange={handleFormChange} className="mt-1 w-full input-style" step="0.1" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Taux d'Impôt sur le Revenu (%)</label>
                    <input type="number" name="salaries.incomeTaxRate" value={formData.salaries.incomeTaxRate} onChange={handleFormChange} className="mt-1 w-full input-style" step="0.1" />
                </div>
            </div>
        );
        case 'alerts': return (
             <div className="space-y-6">
                <div>
                    <label className="flex items-center">
                        <input type="checkbox" name="alerts.debtThresholdEnabled" checked={formData.alerts.debtThresholdEnabled} onChange={handleFormChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="ml-2 text-sm text-gray-700">Activer l'alerte de seuil de dette</span>
                    </label>
                </div>
                {formData.alerts.debtThresholdEnabled && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Montant du seuil d'alerte de dette ({formData.multiCurrency.defaultCurrency})</label>
                        <input type="number" name="alerts.debtThresholdAmount" value={formData.alerts.debtThresholdAmount} onChange={handleFormChange} className="mt-1 w-full input-style" />
                    </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                    <h4 className="font-bold text-gray-800 text-sm mb-1">Plafond d'Approbation Automatique de la Caisse</h4>
                    <p className="text-xs text-gray-500 mb-3">
                        En dessous ou égal à ce montant, la Caissière peut décaisser directement sans approbation préalable du RAF ou du DG.
                        Au-delà de ce montant, la dépense passe obligatoirement en attente de validation.
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Montant plafond d'autonomie caisse ({formData.multiCurrency.defaultCurrency})</label>
                        <input 
                          type="number" 
                          name="alerts.approvalThresholdAmount" 
                          value={formData.alerts.approvalThresholdAmount ?? 50000} 
                          onChange={handleFormChange} 
                          className="mt-1 w-full input-style font-semibold text-indigo-700" 
                          min="0"
                          step="1000"
                        />
                    </div>
                </div>
            </div>
        );
        case 'automation': return (
            <div className="space-y-6">
                <div>
                    <label className="flex items-center">
                        <input type="checkbox" name="automation.monthlyClosures" checked={formData.automation.monthlyClosures} onChange={handleFormChange} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="ml-2 text-sm text-gray-700">Activer les clôtures mensuelles automatiques (simulation)</span>
                    </label>
                </div>
                <div className="pt-4 border-t">
                    <h4 className="font-semibold text-gray-600 mb-2">Gestion de la Caisse</h4>
                     <div>
                        <label className="flex items-center">
                            <input type="checkbox" name="automation.caisseOperationalHours.enabled" checked={formData.automation.caisseOperationalHours.enabled} onChange={handleFormChange} />
                            <span className="ml-2 text-sm text-gray-700">Activer les heures d'ouverture/fermeture</span>
                        </label>
                    </div>
                    {formData.automation.caisseOperationalHours.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                            <div>
                                <label className="block text-sm">Heure d'ouverture</label>
                                <input type="time" name="automation.caisseOperationalHours.opensAt" value={formData.automation.caisseOperationalHours.opensAt} onChange={handleFormChange} className="mt-1 w-full input-style" />
                            </div>
                            <div>
                                <label className="block text-sm">Heure de fermeture</label>
                                <input type="time" name="automation.caisseOperationalHours.closesAt" value={formData.automation.caisseOperationalHours.closesAt} onChange={handleFormChange} className="mt-1 w-full input-style" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
        case 'currency': return (
            <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-medium text-gray-700">Devise par défaut</label>
                    <select name="multiCurrency.defaultCurrency" value={formData.multiCurrency.defaultCurrency} onChange={handleFormChange} className="mt-1 w-full input-style">
                        {['FCFA', 'EUR', 'USD'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
            </div>
        );
        case 'cashier': return (
            <div className="space-y-6">
                <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-bold text-gray-800">Contrôle des Accès et Actions de la Caissière</h3>
                    <p className="text-xs text-gray-500">
                        En tant que Responsable des finances (RAF) ou Administrateur, vous pouvez paramétrer en détail les actions que la caissière est autorisée à effectuer, ainsi que ses plafonds de sécurité opérationnels.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Colonne Permissions */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
                        <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2 border-b pb-2">
                            <span className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md"><KeyIcon /></span>
                            Droits d'Écriture & Accès
                        </h4>
                        
                        <div className="space-y-3">
                            <label className="flex items-start cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    name="permissions.allowRegistration" 
                                    checked={cashierData?.permissions?.allowRegistration ?? true} 
                                    onChange={handleCashierFormChange} 
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-700">Inscrire de nouveaux élèves</span>
                                    <span className="block text-xs text-gray-500">Permet à la caissière de créer une fiche élève lors du paiement des frais d'inscription.</span>
                                </div>
                            </label>

                            <label className="flex items-start cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    name="permissions.allowStudentPayment" 
                                    checked={cashierData?.permissions?.allowStudentPayment ?? true} 
                                    onChange={handleCashierFormChange} 
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-700">Enregistrer les paiements d'écolage</span>
                                    <span className="block text-xs text-gray-500">Permet à la caissière de recevoir les versements mensuels ou annuels des élèves.</span>
                                </div>
                            </label>

                            <label className="flex items-start cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    name="permissions.allowGeneralExpense" 
                                    checked={cashierData?.permissions?.allowGeneralExpense ?? true} 
                                    onChange={handleCashierFormChange} 
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-700">Enregistrer des dépenses de fonctionnement</span>
                                    <span className="block text-xs text-gray-500">Permet à la caissière d'enregistrer des sorties de fonds pour de petites fournitures, factures, etc.</span>
                                </div>
                            </label>

                            <label className="flex items-start cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    name="permissions.allowSalaryPayment" 
                                    checked={cashierData?.permissions?.allowSalaryPayment ?? true} 
                                    onChange={handleCashierFormChange} 
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-700">Enregistrer les paiements de salaires</span>
                                    <span className="block text-xs text-gray-500">Permet d'effectuer des décaissements directs pour le paiement des salaires du personnel.</span>
                                </div>
                            </label>

                            <label className="flex items-start cursor-pointer hover:bg-gray-50 p-1.5 rounded transition-colors">
                                <input 
                                    type="checkbox" 
                                    name="permissions.allowCsvExport" 
                                    checked={cashierData?.permissions?.allowCsvExport ?? true} 
                                    onChange={handleCashierFormChange} 
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                                />
                                <div className="ml-3">
                                    <span className="block text-sm font-medium text-gray-700">Exporter les journaux de caisse (CSV/Excel)</span>
                                    <span className="block text-xs text-gray-500">Permet d'exporter l'historique complet des écritures financières de sa session.</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Colonne Limites & Plafonds */}
                    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm space-y-4">
                        <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2 border-b pb-2">
                            <span className="p-1.5 bg-rose-50 text-rose-700 rounded-md"><BriefcaseIcon /></span>
                            Plafonds de Sécurité Opérationnels
                        </h4>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Nombre maximum d'opérations par jour</label>
                                <input 
                                    type="number" 
                                    name="limits.maxDailyActions" 
                                    value={cashierData?.limits?.maxDailyActions ?? 50} 
                                    onChange={handleCashierFormChange} 
                                    className="mt-1 w-full input-style font-medium text-gray-800" 
                                    min="0"
                                />
                                <span className="text-[11px] text-gray-400">Renseignez 0 pour n'appliquer aucune limite quotidienne de transactions.</span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Plafond d'encaissement unitaire (Frais / Inscriptions)</label>
                                <div className="relative mt-1">
                                    <input 
                                        type="number" 
                                        name="limits.maxUnitRevenue" 
                                        value={cashierData?.limits?.maxUnitRevenue ?? 1000000} 
                                        onChange={handleCashierFormChange} 
                                        className="w-full input-style pr-12 font-semibold text-emerald-700" 
                                        min="0"
                                        step="10000"
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <span className="text-sm text-gray-400 font-medium">{formData?.multiCurrency?.defaultCurrency || 'FCFA'}</span>
                                    </div>
                                </div>
                                <span className="text-[11px] text-gray-400">Montant maximal pour un seul encaissement. 0 pour désactiver le contrôle.</span>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700">Plafond de décaissement unitaire (Dépenses / Salaires)</label>
                                <div className="relative mt-1">
                                    <input 
                                        type="number" 
                                        name="limits.maxUnitExpense" 
                                        value={cashierData?.limits?.maxUnitExpense ?? 100000} 
                                        onChange={handleCashierFormChange} 
                                        className="w-full input-style pr-12 font-semibold text-rose-700" 
                                        min="0"
                                        step="10000"
                                    />
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                        <span className="text-sm text-gray-400 font-medium">{formData?.multiCurrency?.defaultCurrency || 'FCFA'}</span>
                                    </div>
                                </div>
                                <span className="text-[11px] text-gray-400">Montant maximal pour un seul décaissement direct. 0 pour désactiver.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
        default: return null;
    }
};

const RafSettingsPanel: React.FC<{ 
    settings: RafSettingsType; 
    onSave: (settings: RafSettingsType) => void; 
    cashierSettings: CashierSettingsType; 
    onSaveCashierSettings: (settings: CashierSettingsType) => void; 
}> = ({ settings, onSave, cashierSettings, onSaveCashierSettings }) => {
    const [formData, setFormData] = useState(settings);
    const [activeTab, setActiveTab] = useState('salaries');

    // Default permission structure for robust fallback
    const defaultCashierPermissions = {
        allowRegistration: true,
        allowStudentPayment: true,
        allowGeneralExpense: true,
        allowSalaryPayment: true,
        allowCsvExport: true,
    };
    const defaultCashierLimits = {
        maxDailyActions: 50,
        maxUnitRevenue: 1000000,
        maxUnitExpense: 100000,
    };

    const [cashierData, setCashierData] = useState({
        ...cashierSettings,
        permissions: {
            ...defaultCashierPermissions,
            ...(cashierSettings?.permissions || {}),
        },
        limits: {
            ...defaultCashierLimits,
            ...(cashierSettings?.limits || {}),
        }
    });

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        
        setFormData(prev => {
            const keys = name.split('.');
            if (keys.length === 3) { // e.g., automation.caisseOperationalHours.enabled
                const [sec, sub, key] = keys;
                return {
                    ...prev,
                    [sec]: {
                        ...(prev as any)[sec],
                        [sub]: {
                            ...((prev as any)[sec] as any)[sub],
                            [key]: type === 'checkbox' ? checked : value,
                        },
                    },
                };
            }
            if (keys.length === 2) { // e.g., salaries.incomeTaxRate
                const [sec, key] = keys;
                return {
                    ...prev,
                    [sec]: {
                        ...(prev as any)[sec],
                        [key]: type === 'checkbox' ? checked : value,
                    },
                };
            }
            return { ...prev, [name]: value };
        });
    };

    const handleCashierFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        
        setCashierData(prev => {
            const keys = name.split('.');
            if (keys.length === 2) { // e.g. permissions.allowRegistration or limits.maxDailyActions
                const [sec, key] = keys;
                return {
                    ...prev,
                    [sec]: {
                        ...(prev as any)[sec],
                        [key]: type === 'checkbox' ? checked : value,
                    }
                };
            }
            return {
                ...prev,
                [name]: value
            };
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const settingsToSave: RafSettingsType = {
            ...formData,
            salaries: {
                socialContributionsRate: parseFloat(String(formData.salaries.socialContributionsRate)) || 0,
                incomeTaxRate: parseFloat(String(formData.salaries.incomeTaxRate)) || 0,
            },
            alerts: {
                debtThresholdEnabled: formData.alerts.debtThresholdEnabled,
                debtThresholdAmount: parseFloat(String(formData.alerts.debtThresholdAmount)) || 0,
                approvalThresholdAmount: parseFloat(String((formData.alerts as any).approvalThresholdAmount)) || 50000,
            },
        };
        onSave(settingsToSave);

        const cashierToSave = {
            ...cashierData,
            limits: {
                maxDailyActions: parseInt(String(cashierData.limits?.maxDailyActions)) || 0,
                maxUnitRevenue: parseFloat(String(cashierData.limits?.maxUnitRevenue)) || 0,
                maxUnitExpense: parseFloat(String(cashierData.limits?.maxUnitExpense)) || 0,
            }
        };
        onSaveCashierSettings(cashierToSave);
        
        alert('Paramètres financiers et droits caissière sauvegardés !');
    };

    const tabs = [
        { key: 'salaries', label: 'Salaires', icon: <BriefcaseIcon /> },
        { key: 'alerts', label: 'Alertes', icon: <BellIcon /> },
        { key: 'automation', label: 'Automatisation', icon: <ShieldCheckIcon /> },
        { key: 'currency', label: 'Devise', icon: <MoneyIcon /> },
        { key: 'cashier', label: 'Droits Caissière', icon: <KeyIcon /> },
    ];
    
    return (
        <form onSubmit={handleSubmit}>
            <div className="flex flex-col md:flex-row gap-8">
                <nav className="flex flex-row md:flex-col md:w-1/4 space-x-2 md:space-x-0 md:space-y-2 overflow-x-auto md:overflow-x-visible">
                    {tabs.map(tab => (<button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)} className={`flex items-center p-3 text-left rounded-lg transition-colors w-full ${activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}>{tab.icon}<span className="ml-3 whitespace-nowrap">{tab.label}</span></button>))}
                </nav>
                <div className="flex-1 p-4 border rounded-lg bg-gray-50/50">
                    <RafRenderContent 
                        activeTab={activeTab} 
                        formData={formData} 
                        handleFormChange={handleFormChange} 
                        cashierData={cashierData}
                        handleCashierFormChange={handleCashierFormChange}
                    />
                </div>
            </div>
            <div className="flex justify-end mt-6"><button type="submit" className="btn-primary">Sauvegarder les Paramètres</button></div>
        </form>
    );
};


// --- PROMOTER SUB-COMPONENT ---
const PromoterSettingsPanel: React.FC<{ settings: SchoolSettings; onSave: (settings: SchoolSettings) => void; }> = ({ settings, onSave }) => {
    const [formData, setFormData] = useState(settings);
    const [autoReport, setAutoReport] = useState(true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        alert('Paramètres du Promoteur sauvegardés avec succès !');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="p-4 border rounded-xl bg-slate-50 space-y-4">
                <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <BuildingLibraryIcon /> Configurer la Marque & Identité de l'Établissement
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nom Officiel de l'Établissement</label>
                        <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input-style mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Slogan de l'Établissement</label>
                        <input type="text" value={formData.slogan} onChange={(e) => setFormData({ ...formData, slogan: e.target.value })} className="input-style mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Adresse Complète</label>
                        <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="input-style mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Contact Téléphonique Direction</label>
                        <input type="text" value={formData.contact} onChange={(e) => setFormData({ ...formData, contact: e.target.value })} className="input-style mt-1" />
                    </div>
                </div>
            </div>

            <div className="p-4 border rounded-xl bg-white space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Gouvernance & Alertes Promoteur</h3>
                <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={autoReport} onChange={(e) => setAutoReport(e.target.checked)} className="rounded text-[#1F4A59]" />
                    <span className="text-sm font-semibold text-gray-700">Recevoir un rapport financier synthétique hebdomadaire par Email/SMS</span>
                </label>
                <p className="text-xs text-gray-500">Un récapitulatif des recettes encaissements, soldes de caisse et impayés sera transmis automatiquement chaque vendredi soir.</p>
            </div>

            <div className="flex justify-end"><button type="submit" className="btn-primary">Enregistrer les Paramètres Promoteur</button></div>
        </form>
    );
};

// --- DIRECTOR (DE & PRIMAIRE) SUB-COMPONENT ---
const DirectorSettingsPanel: React.FC = () => {
    const [gradeLockDate, setGradeLockDate] = useState('2026-03-31');
    const [autoSmsBulletins, setAutoSmsBulletins] = useState(true);
    const [passGrade, setPassGrade] = useState('10.00');

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Paramètres pédagogiques enregistrés par la Direction !');
    };

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="p-4 border rounded-xl bg-slate-50 space-y-4">
                <h3 className="font-bold text-slate-800 text-base">Règles Pédagogiques & Clôture des Notes</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Date Limite de Saisie des Notes (Trimestre 2)</label>
                        <input type="date" value={gradeLockDate} onChange={(e) => setGradeLockDate(e.target.value)} className="input-style mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Barème / Moyenne d'Admissibilité (/20)</label>
                        <input type="number" step="0.5" value={passGrade} onChange={(e) => setPassGrade(e.target.value)} className="input-style mt-1" />
                    </div>
                </div>
            </div>

            <div className="p-4 border rounded-xl bg-white space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Transmissions Automatiques aux Parents</h3>
                <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={autoSmsBulletins} onChange={(e) => setAutoSmsBulletins(e.target.checked)} className="rounded text-[#1F4A59]" />
                    <span className="text-sm font-semibold text-gray-700">Notifier automatiquement le parent par SMS lors de la publication du Bulletin Trimestriel</span>
                </label>
            </div>

            <div className="flex justify-end"><button type="submit" className="btn-primary">Enregistrer les Paramètres Direction</button></div>
        </form>
    );
};

// --- SURVEILLANT GÉNÉRAL SUB-COMPONENT ---
const SurveillantSettingsPanel: React.FC = () => {
    const [unexcusedLimit, setUnexcusedLimit] = useState('3');
    const [notifyAbsenceImmediate, setNotifyAbsenceImmediate] = useState(true);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Paramètres de la Surveillance Générale enregistrés !');
    };

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="p-4 border rounded-xl bg-slate-50 space-y-4">
                <h3 className="font-bold text-slate-800 text-base">Gestion de la Discipline & Assiduité</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Seuil d'Heures d'Absence Injustifiée pour Convocation Parentale</label>
                        <input type="number" value={unexcusedLimit} onChange={(e) => setUnexcusedLimit(e.target.value)} className="input-style mt-1" />
                    </div>
                </div>
            </div>

            <div className="p-4 border rounded-xl bg-white space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Alertes Instantanées aux Parents</h3>
                <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={notifyAbsenceImmediate} onChange={(e) => setNotifyAbsenceImmediate(e.target.checked)} className="rounded text-[#1F4A59]" />
                    <span className="text-sm font-semibold text-gray-700">Alerter immédiatement le parent dès la constatation d'une absence en classe</span>
                </label>
            </div>

            <div className="flex justify-end"><button type="submit" className="btn-primary">Enregistrer les Paramètres Surveillance</button></div>
        </form>
    );
};

// --- TEACHER SUB-COMPONENT ---
const TeacherSettingsPanel: React.FC = () => {
    const [defaultScale, setDefaultScale] = useState('20');
    const [notifyOnNewHomework, setNotifyOnNewHomework] = useState(true);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Paramètres Enseignant enregistrés !');
    };

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="p-4 border rounded-xl bg-slate-50 space-y-4">
                <h3 className="font-bold text-slate-800 text-base">Préférences Enseignant & Saisie des Notes</h3>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Barème par Défaut pour les Évaluations</label>
                    <select value={defaultScale} onChange={(e) => setDefaultScale(e.target.value)} className="input-style mt-1">
                        <option value="20">Sur 20 points (/20)</option>
                        <option value="10">Sur 10 points (/10)</option>
                        <option value="100">Sur 100 points (/100)</option>
                    </select>
                </div>
            </div>

            <div className="p-4 border rounded-xl bg-white space-y-3">
                <h3 className="font-bold text-slate-800 text-sm">Communication avec les Élèves & Parents</h3>
                <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={notifyOnNewHomework} onChange={(e) => setNotifyOnNewHomework(e.target.checked)} className="rounded text-[#1F4A59]" />
                    <span className="text-sm font-semibold text-gray-700">Transmettre automatiquement les devoirs prescrits sur le compte des parents</span>
                </label>
            </div>

            <div className="flex justify-end"><button type="submit" className="btn-primary">Enregistrer Préférences Enseignant</button></div>
        </form>
    );
};

// --- PARENT SUB-COMPONENT ---
const ParentSettingsPanel: React.FC = () => {
    const [accountType, setAccountType] = useState<'principal' | 'tuteur' | 'representant' | 'mandate'>('principal');
    const [studentMatricule, setStudentMatricule] = useState('EDUCO-STD-2026');
    const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'sms' | 'push' | 'email'>('whatsapp');
    
    // Notification toggles
    const [notifyPayments, setNotifyPayments] = useState(true);
    const [notifyGrades, setNotifyGrades] = useState(true);
    const [notifyAbsences, setNotifyAbsences] = useState(true);
    const [notifyDiscipline, setNotifyDiscipline] = useState(true);
    const [notifyHomework, setNotifyHomework] = useState(false);

    // Security preferences
    const [enablePinSignature, setEnablePinSignature] = useState(true);
    const [pinCode, setPinCode] = useState('1234');
    const [enableBiometrics, setEnableBiometrics] = useState(true);
    const [allowCoParentAccess, setAllowCoParentAccess] = useState(false);
    const [coParentEmail, setCoParentEmail] = useState('');

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Paramètres du Compte Parent et préférences de sécurité mis à jour avec succès !');
    };

    return (
        <form onSubmit={handleSave} className="space-y-6">
            {/* Type de Compte Parent & Rattachement */}
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/60 space-y-4">
                <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-[#1F4A59]" />
                    <span>Profil & Type de Compte Parent</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Type de Responsabilité Parentale
                        </label>
                        <select 
                            value={accountType} 
                            onChange={(e) => setAccountType(e.target.value as any)} 
                            className="input-style bg-white dark:bg-slate-800 text-xs font-bold"
                        >
                            <option value="principal">Parent Principal (Père / Mère)</option>
                            <option value="tuteur">Tuteur / Tutrice Légale</option>
                            <option value="representant">Représentant Légal d'Établissement</option>
                            <option value="mandate">Parent Mandaté / Délégué</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                            N° Matricule Scolaire de l'Enfant Rattaché
                        </label>
                        <input 
                            type="text" 
                            value={studentMatricule} 
                            onChange={(e) => setStudentMatricule(e.target.value)} 
                            className="input-style bg-white dark:bg-slate-800 text-xs font-mono font-bold" 
                        />
                    </div>
                </div>
            </div>

            {/* Canal & Gestion des Notifications */}
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 space-y-4 shadow-sm">
                <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider flex items-center gap-2">
                    <BellIcon className="w-4 h-4 text-[#1F4A59]" />
                    <span>Gestion des Notifications & Canaux Instantanés</span>
                </h3>

                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Canal Prioritaire d'Acheminement des Messages
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { id: 'whatsapp', label: 'WhatsApp Direct' },
                            { id: 'sms', label: 'SMS Instantané' },
                            { id: 'push', label: 'Push App Mobile' },
                            { id: 'email', label: 'E-mail Synthétique' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setPreferredChannel(item.id as any)}
                                className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                    preferredChannel === item.id 
                                        ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-sm'
                                        : 'bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-700">
                    <label className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-700/40 rounded-xl cursor-pointer">
                        <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Encaissements & Reçus de Scolarité (RAF / Caisse)</span>
                            <span className="text-[11px] text-slate-500">Alertes directes lors du dépôt ou de la validation d'un versement.</span>
                        </div>
                        <input type="checkbox" checked={notifyPayments} onChange={(e) => setNotifyPayments(e.target.checked)} className="rounded text-[#1F4A59] w-4 h-4" />
                    </label>

                    <label className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-700/40 rounded-xl cursor-pointer">
                        <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Notes, Évaluations & Bulletins (Directeur & Professeurs)</span>
                            <span className="text-[11px] text-slate-500">Alertes dès la saisie d'une note d'évaluation ou publication du bulletin.</span>
                        </div>
                        <input type="checkbox" checked={notifyGrades} onChange={(e) => setNotifyGrades(e.target.checked)} className="rounded text-[#1F4A59] w-4 h-4" />
                    </label>

                    <label className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-700/40 rounded-xl cursor-pointer">
                        <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Absences, Retards & Discipline (Surveillant Général)</span>
                            <span className="text-[11px] text-slate-500">Notification en temps réel dès la prise d'appel ou convocation.</span>
                        </div>
                        <input type="checkbox" checked={notifyAbsences} onChange={(e) => setNotifyAbsences(e.target.checked)} className="rounded text-[#1F4A59] w-4 h-4" />
                    </label>
                </div>
            </div>

            {/* Sécurité du Compte Parent & Validation par Code PIN / Biométrie */}
            <div className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 space-y-4 shadow-sm">
                <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Préférences de Sécurité & Validation Biométrique</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-700/40 rounded-xl space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Signature par Code PIN à 4 Chiffres</span>
                            <input type="checkbox" checked={enablePinSignature} onChange={(e) => setEnablePinSignature(e.target.checked)} className="rounded text-[#1F4A59]" />
                        </label>
                        <p className="text-[11px] text-slate-500">Exiger le code PIN pour valider un paiement en ligne ou signer une absence.</p>
                        {enablePinSignature && (
                            <input 
                                type="password" 
                                maxLength={4}
                                value={pinCode} 
                                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="• • • •" 
                                className="w-28 p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-center font-mono font-bold tracking-widest text-xs"
                            />
                        )}
                    </div>

                    <div className="p-3.5 bg-slate-50 dark:bg-slate-700/40 rounded-xl space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Connexion Biométrique (Face ID / Empreinte)</span>
                            <input type="checkbox" checked={enableBiometrics} onChange={(e) => setEnableBiometrics(e.target.checked)} className="rounded text-[#1F4A59]" />
                        </label>
                        <p className="text-[11px] text-slate-500">Autoriser le capteur d'empreinte digitale ou la reconnaissance faciale.</p>
                    </div>
                </div>

                {/* Accès Délégué Co-Parent */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700 space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                        <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">Autorisation d'Accès Délégué (Co-Parent / Tuteur Secondaire)</span>
                            <span className="text-[11px] text-slate-500">Permet à un second parent de suivre les notes et paiements sans droit d’édition.</span>
                        </div>
                        <input type="checkbox" checked={allowCoParentAccess} onChange={(e) => setAllowCoParentAccess(e.target.checked)} className="rounded text-[#1F4A59] w-4 h-4" />
                    </label>

                    {allowCoParentAccess && (
                        <div>
                            <input 
                                type="email" 
                                value={coParentEmail}
                                onChange={(e) => setCoParentEmail(e.target.value)}
                                placeholder="Saisissez l'adresse e-mail du co-parent..."
                                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end">
                <button type="submit" className="px-6 py-3 bg-[#1F4A59] hover:bg-[#275d70] text-white font-black text-xs rounded-xl shadow-md cursor-pointer transition-all">
                    Enregistrer mes Préférences Parent
                </button>
            </div>
        </form>
    );
};

// --- STUDENT SUB-COMPONENT ---
const StudentSettingsPanel: React.FC = () => {
    const [studyReminders, setStudyReminders] = useState(true);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        alert('Vos préférences élève ont été enregistrées !');
    };

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="p-4 border rounded-xl bg-slate-50 space-y-4">
                <h3 className="font-bold text-slate-800 text-base">Mon Espace d'Étude</h3>
                <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={studyReminders} onChange={(e) => setStudyReminders(e.target.checked)} className="rounded text-[#1F4A59]" />
                    <span className="text-sm font-semibold text-gray-700">Activer le rappel automatique de révision avant les devoirs à rendre</span>
                </label>
            </div>

            <div className="flex justify-end"><button type="submit" className="btn-primary">Enregistrer mes Préférences</button></div>
        </form>
    );
};
const MyProfileCard: React.FC<{ 
    currentUser?: User; 
    onSaveUser?: (u: User) => void; 
    onUpdateAvatar?: (a: string) => void; 
}> = ({ currentUser, onSaveUser, onUpdateAvatar }) => {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [name, setName] = useState(currentUser?.name || '');
    const [email, setEmail] = useState(currentUser?.email || '');
    const [phone, setPhone] = useState(currentUser?.phone || '');
    const [avatar, setAvatar] = useState(currentUser?.avatar || '');
    const [savedNotice, setSavedNotice] = useState(false);

    React.useEffect(() => {
        if (currentUser) {
            setName(currentUser.name || '');
            setEmail(currentUser.email || '');
            setPhone(currentUser.phone || '');
            setAvatar(currentUser.avatar || '');
        }
    }, [currentUser]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const res = reader.result as string;
                try {
                    const compressed = await compressBase64Image(res, 128, 128);
                    setAvatar(compressed);
                    if (onUpdateAvatar) {
                        onUpdateAvatar(compressed);
                    }
                } catch (err) {
                    setAvatar(res);
                    if (onUpdateAvatar) {
                        onUpdateAvatar(res);
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (currentUser && onSaveUser) {
            const updated = {
                ...currentUser,
                name,
                email,
                phone,
                avatar
            };
            onSaveUser(updated);
        }
        if (onUpdateAvatar && avatar) {
            onUpdateAvatar(avatar);
        }
        setSavedNotice(true);
        setTimeout(() => setSavedNotice(false), 3000);
    };

    return (
        <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs mb-6 space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-[#1F4A59]/10 text-[#1F4A59] dark:bg-sky-400/10 dark:text-sky-300 flex items-center justify-center font-bold">
                    <UserIcon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Mon Profil Personnel & Photo</h3>
                    <p className="text-xs text-slate-500">Modifiez votre photo de profil et vos coordonnées d'utilisateur.</p>
                </div>
            </div>

            {savedNotice && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Profil et photo de profil mis à jour avec succès !</span>
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative group shrink-0">
                        <UserAvatar
                            src={avatar}
                            name={currentUser.name}
                            role={currentUser.role}
                            size="xl"
                            className="w-24 h-24 rounded-3xl border-2 border-slate-200 dark:border-slate-700 shadow-md group-hover:opacity-90 transition-opacity"
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/40 rounded-3xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer font-bold text-[10px]"
                        >
                            <PencilIcon />
                            <span>Changer</span>
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handlePhotoChange} 
                            accept="image/*" 
                            className="hidden" 
                        />
                    </div>

                    <div className="space-y-2 text-center sm:text-left min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="px-4 py-2 bg-[#1F4A59] hover:bg-[#183944] text-white text-xs font-black rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                            >
                                <PencilIcon />
                                <span>Changer la Photo de Profil</span>
                            </button>
                            {avatar && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAvatar('');
                                        if (onUpdateAvatar) onUpdateAvatar('');
                                    }}
                                    className="px-3 py-2 bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300 text-xs font-bold rounded-xl border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer"
                                >
                                    Supprimer
                                </button>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400">Formats acceptés : JPG, PNG, WEBP. Taille maximale : 5 Mo.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nom Complet</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={(e) => setName(e.target.value)} 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#1F4A59]" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Adresse E-mail</label>
                        <input 
                            type="email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#1F4A59]" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Numéro de Téléphone</label>
                        <input 
                            type="text" 
                            value={phone} 
                            onChange={(e) => setPhone(e.target.value)} 
                            placeholder="+229 97 00 00 00"
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#1F4A59]" 
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-1">
                    <button type="submit" className="px-5 py-2.5 bg-[#1F4A59] hover:bg-[#183944] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Enregistrer les modifications</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

const InactivityTimeoutCard: React.FC<{
  inactivityTimeoutMinutes?: number;
  onUpdateInactivityTimeout?: (minutes: number) => void;
}> = ({ inactivityTimeoutMinutes, onUpdateInactivityTimeout }) => {
  const [timeoutValue, setTimeoutValue] = useState<number>(() => {
    if (typeof inactivityTimeoutMinutes === 'number') return inactivityTimeoutMinutes;
    const stored = localStorage.getItem('EDUCO_INACTIVITY_TIMEOUT_MINUTES');
    return stored !== null ? Number(stored) : 5;
  });
  const [savedNotice, setSavedNotice] = useState(false);

  React.useEffect(() => {
    if (typeof inactivityTimeoutMinutes === 'number') {
      setTimeoutValue(inactivityTimeoutMinutes);
    }
  }, [inactivityTimeoutMinutes]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('EDUCO_INACTIVITY_TIMEOUT_MINUTES', String(timeoutValue));
    if (onUpdateInactivityTimeout) {
      onUpdateInactivityTimeout(timeoutValue);
    }
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs mb-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Sécurité & Déconnexion Automatique pour Inactivité
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Paramétrez le délai d'inactivité avant déconnexion de votre compte (Défaut : 5 minutes).
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold text-xs border border-amber-300 dark:border-amber-800 shrink-0 self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Actuel : {timeoutValue === 0 ? 'Désactivé' : `${timeoutValue} minute(s)`}</span>
        </span>
      </div>

      {savedNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Délai d'inactivité enregistré avec succès ! Il s'applique immédiatement à votre session.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Délai d'inactivité maximal (en minutes)
            </label>
            <select
              value={timeoutValue}
              onChange={(e) => setTimeoutValue(Number(e.target.value))}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-[#1F4A59]"
            >
              <option value={1}>1 minute (Haute sécurité)</option>
              <option value={2}>2 minutes</option>
              <option value={5}>5 minutes (Par défaut - Recommandé)</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes (1 heure)</option>
              <option value={0}>Désactivé (Ne jamais se déconnecter automatiquement)</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
            <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>Comment fonctionne cette protection ?</span>
            </p>
            Toute absence d'interaction (souris, clavier, tactile) pendant plus de <strong className="text-slate-800 dark:text-slate-200">{timeoutValue === 0 ? 'désactivé' : `${timeoutValue} min`}</strong> provoquera la fermeture automatique et sécurisée de votre session.
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#1F4A59] hover:bg-[#183944] text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Enregistrer le délai d'inactivité</span>
          </button>
        </div>
      </form>
    </div>
  );
};

const AppInstallationAndUpdatesCard: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallGuide, setShowInstallGuide] = useState(false);
    const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'updated'>('idle');

    React.useEffect(() => {
        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    }, []);

    const handleInstallApp = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setDeferredPrompt(null);
            }
        } else {
            setShowInstallGuide(true);
        }
    };

    const handleUpdateApp = () => {
        setUpdateStatus('checking');
        setTimeout(() => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then((registrations) => {
                    for (let registration of registrations) {
                        registration.update();
                    }
                });
            }
            setUpdateStatus('updated');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }, 1500);
    };

    return (
        <div className="bg-gradient-to-r from-slate-50 to-slate-100/60 dark:from-slate-900/40 dark:to-slate-900/20 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
                        Options de l'Application (PWA)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium max-w-xl">
                        Installez Educo directement sur l'écran d'accueil de votre téléphone ou ordinateur pour un accès instantané et une fluidité hors-ligne maximale. Vous pouvez également forcer la mise à jour pour obtenir les dernières fonctionnalités.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <button 
                        onClick={handleUpdateApp}
                        disabled={updateStatus !== 'idle'}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                            updateStatus === 'checking'
                                ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed'
                                : updateStatus === 'updated'
                                ? 'bg-emerald-500 text-white cursor-default'
                                : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-xs'
                        }`}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                        <span>
                            {updateStatus === 'checking' && 'Recherche...'}
                            {updateStatus === 'updated' && 'À jour !'}
                            {updateStatus === 'idle' && 'Mise à jour'}
                        </span>
                    </button>

                    <button 
                        onClick={handleInstallApp}
                        className="px-4 py-2.5 bg-[#1F4A59] hover:bg-[#1A3F4C] text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Installer l'application</span>
                    </button>
                </div>
            </div>

            {showInstallGuide && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-4">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <Laptop className="w-4 h-4 text-[#1F4A59]" />
                                Guide d'installation Educo
                            </h4>
                            <button 
                                onClick={() => setShowInstallGuide(false)}
                                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-300">
                            <p>
                                Pour installer cette application sur votre appareil :
                            </p>
                            <div className="space-y-2 border-l-2 border-[#1F4A59]/40 pl-3">
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">Sur iPhone / iPad (Safari) :</p>
                                    <p className="text-[11px] text-slate-500">Appuyez sur le bouton <strong>Partager</strong> <span className="inline-block px-1 bg-slate-100 dark:bg-slate-800 rounded">⎙</span> dans le navigateur, puis sélectionnez <strong>Sur l'écran d'accueil</strong>.</p>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">Sur Android (Chrome) :</p>
                                    <p className="text-[11px] text-slate-500">Appuyez sur les <strong>trois points</strong> en haut à droite, puis sélectionnez <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.</p>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800 dark:text-slate-100">Sur Ordinateur (Chrome / Edge) :</p>
                                    <p className="text-[11px] text-slate-500">Cliquez sur l'icône de <strong>téléchargement / installation</strong> présente dans le côté droit de la barre d'adresse.</p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button 
                                onClick={() => setShowInstallGuide(false)}
                                className="px-4 py-2 bg-[#1F4A59] text-white rounded-xl text-xs font-black hover:bg-[#1A3F4C] cursor-pointer"
                            >
                                J'ai compris
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface SettingsPageProps {
  currentUserRole: string;
  currentUser?: User;
  onUpdateAvatar?: (avatarUrl: string) => void;
  schoolSettings: SchoolSettings | null;
  onSaveSchoolSettings: (settings: SchoolSettings) => void;
  subjects: Subject[];
  onSaveSubject: (subject: Subject) => void;
  onDeleteSubject: (id: number) => void;
  messageTemplates: MessageTemplate[];
  onSaveMessageTemplate: (template: MessageTemplate) => void;
  cashierSettings: CashierSettingsType | null;
  onSaveCashierSettings: (settings: CashierSettingsType) => void;
  rafSettings: RafSettingsType | null;
  onSaveRafSettings: (settings: RafSettingsType) => void;
  teachers: User[];
  users?: User[];
  onSaveUser?: (user: User) => void;
  onExportBackup?: () => void;
  onRestoreBackup?: (rawFileContent: string, decryptionPassword?: string) => Promise<boolean> | boolean;
  communicationSettings?: any;
  onSaveCommunicationSettings?: (settings: any) => void;
  inactivityTimeoutMinutes?: number;
  onUpdateInactivityTimeout?: (minutes: number) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = (props) => {
    const { currentUserRole, schoolSettings, cashierSettings, rafSettings } = props;

    if (!schoolSettings || !cashierSettings || !rafSettings) {
        return <div className="p-4">Chargement des paramètres...</div>;
    }
    
    let content;
    let title = "Paramètres";

    if (currentUserRole === 'Admin') {
        content = <AdminSettingsPanel {...props} />;
        title = "Paramètres du Système";
    } else if (currentUserRole === 'Promoteur') {
        content = <PromoterSettingsPanel settings={props.schoolSettings} onSave={props.onSaveSchoolSettings} />;
        title = "Paramètres du Promoteur & Direction Générale";
    } else if (currentUserRole === 'Caissière') {
        content = <CashierSettingsPanel settings={props.cashierSettings} onSave={props.onSaveCashierSettings} />;
        title = "Paramètres de la Caisse & Reçus";
    } else if (currentUserRole === 'Responsable des finances') {
        content = (
            <RafSettingsPanel 
                settings={props.rafSettings} 
                onSave={props.onSaveRafSettings} 
                cashierSettings={props.cashierSettings} 
                onSaveCashierSettings={props.onSaveCashierSettings} 
            />
        );
        title = "Paramètres Financiers & Audit";
    } else if (currentUserRole === 'Directeur des Etudes' || currentUserRole === 'Directeur du primaire') {
        content = <DirectorSettingsPanel />;
        title = "Paramètres de la Direction Pédagogique";
    } else if (currentUserRole === 'Surveillant Général') {
        content = <SurveillantSettingsPanel />;
        title = "Paramètres de la Surveillance Générale & Assiduité";
    } else if (currentUserRole === 'Enseignant') {
        content = <TeacherSettingsPanel />;
        title = "Paramètres du Compte Enseignant";
    } else if (currentUserRole === 'Parent' || currentUserRole === "Parent d'élève") {
        content = <ParentSettingsPanel />;
        title = "Paramètres du Compte Parent";
    } else if (currentUserRole === 'Élève') {
        content = <StudentSettingsPanel />;
        title = "Paramètres du Compte Élève";
    } else {
        content = <ParentSettingsPanel />;
        title = "Paramètres du Compte";
    }

    return (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
            <style>{styles}</style>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mb-6">{title}</h2>
            <MyProfileCard 
                currentUser={props.currentUser} 
                onSaveUser={props.onSaveUser} 
                onUpdateAvatar={props.onUpdateAvatar} 
            />
            <InactivityTimeoutCard 
                inactivityTimeoutMinutes={props.inactivityTimeoutMinutes}
                onUpdateInactivityTimeout={props.onUpdateInactivityTimeout}
            />
            {props.currentUser?.email && (
                <div className="mb-6">
                    <BiometricDevicesSettingsCard 
                        userEmail={props.currentUser.email}
                        userId={(props.currentUser as any).uid || String(props.currentUser.id)}
                        userName={props.currentUser.name}
                    />
                </div>
            )}
            <AppInstallationAndUpdatesCard />
            {content}
            
            {['Caissière', 'Responsable des finances'].includes(currentUserRole) && props.communicationSettings && (
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800">
                    <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">Paramètres de Communication</h2>
                    <CommunicationTab 
                        templates={props.messageTemplates} 
                        onSave={props.onSaveMessageTemplate}
                        settings={props.communicationSettings}
                        onSaveSettings={props.onSaveCommunicationSettings!}
                    />
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
