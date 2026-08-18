import React, { useState, useMemo, useEffect } from 'react';
import { ActivityLog, Transaction } from '../App';
import { InfoIcon, SearchIcon, ShieldCheckIcon } from './Icons';
import { fetchActivityLogsFromDb } from '../src/services/api';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Globe, 
  Smartphone, 
  Monitor, 
  Search, 
  Download, 
  RefreshCw, 
  UserCheck, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Filter,
  FileSpreadsheet,
  Mail,
  Send,
  Layers,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { brevoEmailService } from '../src/services/brevoEmailService';

type Payment = { id: number; studentId: string; name: string; class: string; totalFees: number; amountPaid: number; };
type User = { id: number | null; name: string; role: string; email: string; status: string; };

export interface SecurityLoginEvent {
  id: string;
  timestamp: string;
  userName: string;
  userRole: string;
  userEmail: string;
  schoolName?: string;
  ipAddress: string;
  location: string;
  device: string;
  browser: string;
  page?: string;
  status: 'Succès' | 'Échec' | 'Bloqué' | 'Session active';
  riskLevel: 'Faible' | 'Moyen' | 'Élevé';
  failureReason?: string;
}

const INITIAL_SECURITY_EVENTS: SecurityLoginEvent[] = [
  {
    id: 'SEC-1008',
    timestamp: '2026-08-15T09:14:22',
    userName: 'Mme MBOUNGOU Clarisse',
    userRole: 'Directrice Générale',
    userEmail: 'admin@ecole.cg',
    schoolName: "Groupe Scolaire Les Hirondelles d'Excellence",
    ipAddress: '197.218.45.12',
    location: 'Brazzaville, CG',
    device: 'Windows PC (x64)',
    browser: 'Chrome 127.0',
    status: 'Succès',
    riskLevel: 'Faible',
  },
  {
    id: 'SEC-1007',
    timestamp: '2026-08-15T08:52:10',
    userName: 'M. LOUBOU Michel',
    userRole: 'Responsable Financier',
    userEmail: 'finance@ecole.cg',
    schoolName: "Groupe Scolaire Les Hirondelles d'Excellence",
    ipAddress: '197.218.45.88',
    location: 'Brazzaville, CG',
    device: 'macOS Sonoma',
    browser: 'Safari 17.4',
    status: 'Session active',
    riskLevel: 'Faible',
  },
  {
    id: 'SEC-1006',
    timestamp: '2026-08-15T07:30:45',
    userName: 'M. KOUMBA Alain',
    userRole: 'Enseignant Principal',
    userEmail: 'koumba@ecole.cg',
    schoolName: "Complexe Scolaire La Renaissance",
    ipAddress: '102.64.12.204',
    location: 'Pointe-Noire, CG',
    device: 'iPhone 15 Pro',
    browser: 'Mobile Safari',
    status: 'Succès',
    riskLevel: 'Faible',
  },
  {
    id: 'SEC-1005',
    timestamp: '2026-08-14T23:45:00',
    userName: 'Tentative Anonyme',
    userRole: 'Inconnu',
    userEmail: 'admin.test@ecole.cg',
    schoolName: "Portail Général",
    ipAddress: '185.220.101.5',
    location: 'Francfort, DE (VPN/Proxy)',
    device: 'Linux / Script',
    browser: 'Python-requests',
    status: 'Bloqué',
    riskLevel: 'Élevé',
    failureReason: 'Brute-force détecté (5 essais infructueux)',
  },
  {
    id: 'SEC-1004',
    timestamp: '2026-08-14T18:20:15',
    userName: 'Mme DIALLO Amina',
    userRole: 'Parent d\'élève',
    userEmail: 'parent.diallo@gmail.com',
    schoolName: "Complexe Scolaire La Renaissance",
    ipAddress: '41.202.207.15',
    location: 'Brazzaville, CG',
    device: 'Android 14',
    browser: 'WhatsApp Web Browser',
    status: 'Succès',
    riskLevel: 'Faible',
  },
  {
    id: 'SEC-1003',
    timestamp: '2026-08-14T14:10:05',
    userName: 'M. BIKINDOU Paul',
    userRole: 'Administrateur Système',
    userEmail: 'paul.bikindou@ecole.cg',
    ipAddress: '197.218.46.10',
    location: 'Brazzaville, CG',
    device: 'Windows PC (x64)',
    browser: 'Edge 126.0',
    status: 'Session active',
    riskLevel: 'Faible',
  },
  {
    id: 'SEC-1002',
    timestamp: '2026-08-13T21:05:30',
    userName: 'M. LOUTALA Marc',
    userRole: 'Administrateur',
    userEmail: 'm.loutala@gmail.com',
    ipAddress: '102.64.99.11',
    location: 'Dolisie, CG',
    device: 'Windows PC',
    browser: 'Opera 110.0',
    status: 'Échec',
    riskLevel: 'Moyen',
    failureReason: 'Mot de passe erroné (1ère tentative)',
  },
  {
    id: 'SEC-1001',
    timestamp: '2026-08-13T10:15:00',
    userName: 'Mme MBOUNGOU Clarisse',
    userRole: 'Directrice Générale',
    userEmail: 'admin@ecole.cg',
    ipAddress: '197.218.45.12',
    location: 'Brazzaville, CG',
    device: 'iPadOS 17',
    browser: 'Mobile Safari',
    status: 'Succès',
    riskLevel: 'Faible',
  },
];

// --- SUB-COMPONENT: TabButton ---
const TabButton: React.FC<{ tabKey: string, label: string, activeTab: string, setActiveTab: (key: string) => void }> = ({ tabKey, label, activeTab, setActiveTab }) => (
    <button
        onClick={() => setActiveTab(tabKey)}
        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200 ${activeTab === tabKey ? 'bg-white dark:bg-slate-800 border-b-0 border-gray-200 dark:border-slate-700 border-l border-r border-t text-[#1F4A59] dark:text-sky-400 font-bold' : 'bg-gray-100 dark:bg-slate-900 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800'}`}
    >
        {label}
    </button>
);


// --- SUB-COMPONENT: SmartAlerts ---
const SmartAlerts: React.FC<{ payments: Payment[], budget: any, transactions: Transaction[], addNotification: Function }> = ({ payments, budget, transactions, addNotification }) => {
    
    useEffect(() => {
        const lateStudents = payments.filter(p => p.totalFees > p.amountPaid);
        if (lateStudents.length > 0) {
            const notifiedKey = 'smart_alert_notified';
            if (!sessionStorage.getItem(notifiedKey)) {
                addNotification(
                    `${lateStudents.length} élève(s) ont des soldes de paiement en attente.`,
                    'Alerte',
                    ['Finance Manager'],
                    'Audit & Contrôle'
                );
                sessionStorage.setItem(notifiedKey, 'true');
            }
        }
    }, [payments, addNotification]);
    
    const latePaymentCount = payments.filter(p => p.totalFees > p.amountPaid).length;

    const budgetOverruns = useMemo(() => {
        const spendingByCategory = transactions
            .filter(t => t.type === 'Dépense' && t.status === 'Approuvé')
            .reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + t.amount;
                return acc;
            }, {} as { [key: string]: number });

        return budget.categories
            .map((cat: { name: string, amount: number }) => ({
                name: cat.name,
                spent: spendingByCategory[cat.name] || 0,
                budget: cat.amount,
                overrun: Math.max(0, (spendingByCategory[cat.name] || 0) - cat.amount)
            }))
            .filter((item: any) => item.overrun > 0);
    }, [budget, transactions]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 mb-6">
            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Alertes Intelligentes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-orange-50 dark:bg-amber-950/40 border border-orange-200 dark:border-amber-800">
                    <h4 className="font-semibold text-orange-800 dark:text-amber-300">Retards de Paiement</h4>
                    <p className="text-2xl font-bold text-orange-600 dark:text-amber-400">{latePaymentCount}</p>
                    <p className="text-sm text-orange-700 dark:text-amber-300">élèves avec un solde impayé.</p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-800">
                    <h4 className="font-semibold text-red-800 dark:text-rose-300">Dépassements Budgétaires</h4>
                    <p className="text-2xl font-bold text-red-600 dark:text-rose-400">{budgetOverruns.length}</p>
                    <p className="text-sm text-red-700 dark:text-rose-300">catégories de dépenses ont dépassé leur budget.</p>
                </div>
            </div>
        </div>
    );
};


// --- SUB-COMPONENT: AutomaticAudit ---
const AutomaticAudit: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const [duplicates, setDuplicates] = useState<Transaction[][]>([]);
    
    const findDuplicates = () => {
        const potentialDuplicates = new Map<string, Transaction[]>();
        transactions.forEach(t => {
            if(t.type === 'Revenu' && t.category === 'Scolarité') {
                const key = `${t.description}-${t.amount}-${new Date(t.date).toISOString().split('T')[0]}`;
                if (!potentialDuplicates.has(key)) {
                    potentialDuplicates.set(key, []);
                }
                potentialDuplicates.get(key)!.push(t);
            }
        });

        const found = Array.from(potentialDuplicates.values()).filter(group => group.length > 1);
        setDuplicates(found);
    };

    const approvedTransactions = transactions.filter(t => t.status === 'Approuvé');
    const totalRevenue = approvedTransactions.filter(t => t.type === 'Revenu').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = approvedTransactions.filter(t => t.type === 'Dépense').reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100 mb-4">Contrôle & Réconciliation Automatique</h3>
            <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Total Entrées Approuvées</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{totalRevenue.toLocaleString()} FCFA</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Total Sorties Approuvées</p>
                        <p className="text-lg font-black text-rose-600 dark:text-rose-400">{totalExpenses.toLocaleString()} FCFA</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Solde Net Audit</p>
                        <p className="text-lg font-black text-[#1F4A59] dark:text-sky-400">{(totalRevenue - totalExpenses).toLocaleString()} FCFA</p>
                    </div>
                    <button 
                        onClick={findDuplicates}
                        className="px-4 py-2 bg-[#1F4A59] text-white rounded-xl text-xs font-bold hover:bg-[#285d70] transition-colors"
                    >
                        Détecter les Doublons
                    </button>
                </div>

                {duplicates.length > 0 ? (
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                            ⚠️ {duplicates.length} groupe(s) de paiements potentiellement identiques détectés :
                        </p>
                        {duplicates.map((group, idx) => (
                            <div key={idx} className="text-xs text-amber-900 dark:text-amber-200 font-mono pl-3 border-l-2 border-amber-500">
                                {group.length}x - {group[0].description} ({group[0].amount.toLocaleString()} FCFA) le {new Date(group[0].date).toLocaleDateString('fr-FR')}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-xs text-slate-500 italic">Aucune anomalie critique détectée dans les transactions récentes.</p>
                )}
            </div>
        </div>
    );
};


// --- SUB-COMPONENT: ActivityLogTable ---
const ActivityLogTable: React.FC<{ log: ActivityLog[] }> = ({ log }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [schoolFilter, setSchoolFilter] = useState('Tous');
    const [roleFilter, setRoleFilter] = useState('Tous');

    const filteredLog = useMemo(() => {
        return log.filter(entry => {
            const matchesSearch = 
                entry.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                entry.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ((entry as any).schoolName && (entry as any).schoolName.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesSchool = schoolFilter === 'Tous' || ((entry as any).schoolName && (entry as any).schoolName === schoolFilter);
            const matchesRole = roleFilter === 'Tous' || entry.role.toLowerCase().includes(roleFilter.toLowerCase());

            return matchesSearch && matchesSchool && matchesRole;
        });
    }, [log, searchTerm, schoolFilter, roleFilter]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h3 className="text-xl font-black text-gray-800 dark:text-slate-100">Journal d'Activité & Mouvements par Compte</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Historique des saisies, modifications et actions par établissement et type de compte.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Rechercher une action, nom..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-100 placeholder-gray-400 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#1F4A59] text-xs font-medium"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <SearchIcon />
                  </div>
                </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Établissement
                </label>
                <select
                  value={schoolFilter}
                  onChange={(e) => setSchoolFilter(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                >
                  <option value="Tous">Tous les établissements</option>
                  <option value="Groupe Scolaire Les Hirondelles d'Excellence">GS Les Hirondelles</option>
                  <option value="Complexe Scolaire La Renaissance">CS La Renaissance</option>
                  <option value="Lycée Scientifique d'Excellence">Lycée Scientifique</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
                  Rôle / Type de Compte
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                >
                  <option value="Tous">Tous les comptes</option>
                  <option value="Admin">Administrateur</option>
                  <option value="Directeur">Directeur / Promoteur</option>
                  <option value="Finance">RAF / Comptable</option>
                  <option value="Caissier">Caissier / Secrétaire</option>
                  <option value="Enseignant">Enseignant</option>
                  <option value="Parent">Parent d'élève</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[60vh] rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Horodatage Précis</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Compte & Établissement</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Mouvement / Action</th>
                      <th className="px-4 py-3 text-left font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Détails de la Modification</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {filteredLog.map(entry => (
                        <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 dark:text-slate-300 font-mono">
                              <div className="font-bold">{new Date(entry.timestamp).toLocaleDateString('fr-FR')}</div>
                              <div className="text-[10px] text-slate-400">{new Date(entry.timestamp).toLocaleTimeString('fr-FR')}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs">
                              <div className="font-black text-gray-900 dark:text-slate-100 flex items-center gap-1.5">
                                <span>{entry.user}</span>
                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded text-[9px]">
                                  {entry.role}
                                </span>
                              </div>
                              <div className="text-[10px] text-sky-600 dark:text-sky-400 font-medium mt-0.5">
                                {(entry as any).schoolName || "Groupe Scolaire Les Hirondelles d'Excellence"}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-800 dark:text-slate-200 font-bold">
                              <span className="px-2 py-0.5 bg-sky-50 dark:bg-sky-950/60 text-[#1F4A59] dark:text-sky-300 rounded-md border border-sky-200/50 dark:border-sky-800/50">
                                {entry.action}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-slate-300 font-medium max-w-md">
                              {entry.details}
                            </td>
                        </tr>
                    ))}
                    {filteredLog.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                          Aucun mouvement ne correspond aux filtres d'établissement ou de compte.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
            </div>
        </div>
    );
};


// --- SUB-COMPONENT: TransactionsAuditTable ---
const TransactionsAuditTable: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('Tous');
    const [filterCategory, setFilterCategory] = useState('Toutes');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');

    const categories = useMemo(() => {
        const cats = new Set(transactions.map(t => t.category));
        return ['Toutes', ...Array.from(cats)];
    }, [transactions]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  t.category.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesType = filterType === 'Tous' || t.type === filterType;
            const matchesCategory = filterCategory === 'Toutes' || t.category === filterCategory;
            
            let matchesDate = true;
            if (filterDateFrom && filterDateTo) {
                const tDate = new Date(t.date).toISOString().split('T')[0];
                matchesDate = tDate >= filterDateFrom && tDate <= filterDateTo;
            } else if (filterDateFrom) {
                const tDate = new Date(t.date).toISOString().split('T')[0];
                matchesDate = tDate >= filterDateFrom;
            } else if (filterDateTo) {
                const tDate = new Date(t.date).toISOString().split('T')[0];
                matchesDate = tDate <= filterDateTo;
            }

            return matchesSearch && matchesType && matchesCategory && matchesDate;
        });
    }, [transactions, searchTerm, filterType, filterCategory, filterDateFrom, filterDateTo]);

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-md border border-slate-200 dark:border-slate-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h3 className="text-xl font-bold text-gray-800 dark:text-slate-100">Audit des Transactions</h3>
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    placeholder="Rechercher une transaction..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-slate-900 text-gray-700 dark:text-slate-100 placeholder-gray-400 rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <SearchIcon />
                  </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-100 dark:border-slate-700">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 dark:text-slate-400">Type de transaction</label>
                    <select 
                        value={filterType} 
                        onChange={(e) => setFilterType(e.target.value)}
                        className="p-2 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                    >
                        <option value="Tous">Tous les types</option>
                        <option value="Revenu">Revenu</option>
                        <option value="Dépense">Dépense</option>
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 dark:text-slate-400">Catégorie</label>
                    <select 
                        value={filterCategory} 
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="p-2 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm max-w-[200px]"
                    >
                        {categories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 dark:text-slate-400">Période (Du)</label>
                    <input 
                        type="date" 
                        value={filterDateFrom} 
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="p-2 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-600 dark:text-slate-400">Période (Au)</label>
                    <input 
                        type="date" 
                        value={filterDateTo} 
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="p-2 border dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                    />
                </div>
                <div className="flex items-end">
                    <button 
                        onClick={() => {
                            setFilterType('Tous');
                            setFilterCategory('Toutes');
                            setFilterDateFrom('');
                            setFilterDateTo('');
                            setSearchTerm('');
                        }}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                        Réinitialiser
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto max-h-[60vh]">
                 <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-900 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Catégorie</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Montant</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {filteredTransactions.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400 font-mono">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100 font-medium">{t.description}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">{t.category}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.type === 'Revenu' ? 'bg-green-100 text-green-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-rose-950 dark:text-rose-300'}`}>
                                    {t.type}
                                </span>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${t.type === 'Revenu' ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}`}>
                                {t.type === 'Revenu' ? '+' : '-'}{t.amount.toLocaleString()} FCFA
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                    t.status === 'Approuvé' ? 'bg-green-100 text-green-800 dark:bg-emerald-950 dark:text-emerald-300' : 
                                    t.status === 'Rejeté' ? 'bg-red-100 text-red-800 dark:bg-rose-950 dark:text-rose-300' : 
                                    'bg-yellow-100 text-yellow-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}>
                                    {t.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {filteredTransactions.length === 0 && (
                        <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">
                                Aucune transaction ne correspond à vos filtres.
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
            </div>
        </div>
    );
};


// --- SUB-COMPONENT: SecurityAuditTable (NOUVEL ONGLET SÉCURITÉ & CONNEXIONS) ---
const SecurityAuditTable: React.FC = () => {
  const [events, setEvents] = useState<SecurityLoginEvent[]>(INITIAL_SECURITY_EVENTS);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [schoolFilter, setSchoolFilter] = useState<string>('Tous');
  const [statusFilter, setStatusFilter] = useState<string>('Tous');
  const [riskFilter, setRiskFilter] = useState<string>('Tous');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await fetchActivityLogsFromDb();
      if (res && res.length > 0) {
        const mapped: SecurityLoginEvent[] = res.map((item: any) => {
          let riskLevel: 'Faible' | 'Moyen' | 'Élevé' = 'Faible';
          const act = (item.action || '').toLowerCase();
          const det = (item.details || '').toLowerCase();
          
          if (act.includes('erreur') || act.includes('échec') || act.includes('refus') || det.includes('incorrect') || det.includes('refusé')) {
            riskLevel = 'Moyen';
          }
          if (act.includes('bloqué') || act.includes('suspect') || act.includes('intrusion') || det.includes('admin bloqu') || det.includes('restreint')) {
            riskLevel = 'Élevé';
          }

          let status: 'Succès' | 'Échec' | 'Bloqué' | 'Session active' = 'Succès';
          if (act.includes('échec') || act.includes('refus') || det.includes('incorrect') || det.includes('refusé')) {
            status = 'Échec';
          } else if (act.includes('bloqu') || det.includes('bloqu') || det.includes('restreint')) {
            status = 'Bloqué';
          } else if (act.includes('connexion') || act.includes('accès')) {
            status = 'Session active';
          }

          return {
            id: `DB-${item.id}`,
            timestamp: item.timestamp || new Date().toISOString(),
            userName: item.user || 'Inconnu',
            userRole: item.role || 'Utilisateur',
            userEmail: item.email || '',
            schoolName: item.schoolName || 'Portail Général',
            ipAddress: item.ipAddress || '127.0.0.1',
            location: item.location || 'Brazzaville, Congo',
            device: item.device || 'PC / Terminal',
            browser: item.browser || 'Chrome',
            page: item.page || 'Tableau de bord',
            status,
            riskLevel,
            failureReason: item.details || ''
          };
        });
        
        // Dedup and merge: database logs first, then fallback initial events
        setEvents([...mapped, ...INITIAL_SECURITY_EVENTS]);
      }
    } catch (err) {
      console.warn('Error fetching db logs in SecurityAuditTable:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const matchSearch = 
        e.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.schoolName && e.schoolName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.ipAddress.includes(searchTerm) ||
        e.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (e.page && e.page.toLowerCase().includes(searchTerm.toLowerCase())) ||
        e.device.toLowerCase().includes(searchTerm.toLowerCase());

      const matchSchool = schoolFilter === 'Tous' || e.schoolName === schoolFilter;
      const matchStatus = statusFilter === 'Tous' || e.status === statusFilter;
      const matchRisk = riskFilter === 'Tous' || e.riskLevel === riskFilter;

      return matchSearch && matchSchool && matchStatus && matchRisk;
    });
  }, [events, searchTerm, schoolFilter, statusFilter, riskFilter]);

  const totalLogins = events.length;
  const activeSessions = events.filter(e => e.status === 'Session active').length;
  const failedOrBlocked = events.filter(e => e.status === 'Échec' || e.status === 'Bloqué').length;
  const uniqueIPs = new Set(events.map(e => e.ipAddress)).size;

  const handleExportSecurityCSV = () => {
    const lines: string[] = [];
    lines.push(`"HISTORIQUE ET SÉCURITÉ DES CONNEXIONS - COMPTE ADMIN & UTILISATEURS"`);
    lines.push(`"Date d'extraction";"${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')}"`);
    lines.push(`"Établissement";"EduCo Administration System"`);
    lines.push(``);
    lines.push(`"N° ID";"Horodatage";"Utilisateur";"Rôle";"E-mail";"Adresse IP";"Localisation";"Appareil / Navigateur";"Page Visitée";"Statut Connexion";"Niveau de Risque";"Motif / Observation"`);

    filteredEvents.forEach(e => {
      const formattedDate = new Date(e.timestamp).toLocaleString('fr-FR');
      lines.push(
        `"${e.id}";"${formattedDate}";"${e.userName.replace(/"/g, '""')}";"${e.userRole.replace(/"/g, '""')}";"${e.userEmail}";"${e.ipAddress}";"${e.location.replace(/"/g, '""')}";"${e.device} - ${e.browser}";"${(e.page || 'Tableau de bord').replace(/"/g, '""')}";"${e.status}";"${e.riskLevel}";"${(e.failureReason || '').replace(/"/g, '""')}"`
      );
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_securite_connexions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* KPI Cards for Security */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-950/60 text-[#1F4A59] dark:text-sky-300 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Connexions Totales</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{totalLogins}</p>
            <p className="text-[10px] text-slate-500">Tracées en base</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sessions Actives</span>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{activeSessions}</p>
            <p className="text-[10px] text-slate-500">En cours d'utilisation</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alertes / Échecs</span>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{failedOrBlocked}</p>
            <p className="text-[10px] text-slate-500">Tentatives bloquées</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">IP Distincst</span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{uniqueIPs}</p>
            <p className="text-[10px] text-slate-500">Adresses de réseau</p>
          </div>
        </div>

      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-6">
        
        {/* Header and Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1F4A59] dark:text-sky-400" />
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Historique des Connexions & Sécurité IP
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Traçabilité complète des accès par adresse IP, terminal, géolocalisation et statut d'authentification.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={loadLogs}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Rafraîchir les logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Chargement...' : 'Rafraîchir'}</span>
            </button>
            <button
              onClick={handleExportSecurityCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exporter Journal Sécurité (CSV)</span>
            </button>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Établissement
            </label>
            <select
              value={schoolFilter}
              onChange={(e) => setSchoolFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
            >
              <option value="Tous">Tous les établissements</option>
              <option value="Groupe Scolaire Les Hirondelles d'Excellence">GS Les Hirondelles</option>
              <option value="Complexe Scolaire La Renaissance">CS La Renaissance</option>
              <option value="Portail Général">Portail Général / Admin</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Rechercher (Nom, Email, IP, Ville)
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ex: 197.218 ou Directrice..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Statut d'accès
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
            >
              <option value="Tous">Tous les statuts</option>
              <option value="Succès">Succès</option>
              <option value="Session active">Session active</option>
              <option value="Échec">Échec (Mot de passe)</option>
              <option value="Bloqué">Bloqué / Suspect</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">
              Niveau de Risque
            </label>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
            >
              <option value="Tous">Tous les niveaux</option>
              <option value="Faible">Faible (Accès normal)</option>
              <option value="Moyen">Moyen (Saisie erronée)</option>
              <option value="Élevé">Élevé (Intrusion/VPN)</option>
            </select>
          </div>

        </div>

        {/* Security Table */}
        <div className="overflow-x-auto max-h-[60vh] rounded-xl border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase">Horodatage</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase">Utilisateur & Compte</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase">Adresse IP & Localisation</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase">Appareil & Navigateur</th>
                <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase">Page Consultée</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 dark:text-slate-400 uppercase">Statut Accès</th>
                <th className="px-4 py-3 text-center font-bold text-slate-500 dark:text-slate-400 uppercase">Niveau Risque</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredEvents.map(event => {
                const eventDate = new Date(event.timestamp);
                
                return (
                  <tr key={event.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    
                    {/* Date */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-300">
                      <div className="font-bold">{eventDate.toLocaleDateString('fr-FR')}</div>
                      <div className="text-[10px] text-slate-400">{eventDate.toLocaleTimeString('fr-FR')}</div>
                    </td>

                    {/* User & Establishment */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{event.userName}</span>
                        {event.schoolName && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-bold rounded-md">
                            {event.schoolName}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="font-semibold text-[#1F4A59] dark:text-sky-300">{event.userRole}</span>
                        <span>•</span>
                        <span className="font-mono">{event.userEmail}</span>
                      </div>
                    </td>

                    {/* IP & Location */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                        <span>{event.ipAddress}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {event.location}
                      </div>
                    </td>

                    {/* Device & Browser */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">
                        {event.device}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {event.browser}
                      </div>
                    </td>

                    {/* Page Consultée */}
                    <td className="px-4 py-3 whitespace-nowrap text-left">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-[11px] font-semibold rounded-md border border-slate-200 dark:border-slate-600">
                        {event.page || 'Tableau de bord'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`inline-flex flex-col items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        event.status === 'Succès'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : event.status === 'Session active'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          : event.status === 'Échec'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        <span>{event.status}</span>
                        {event.failureReason && (
                          <span className="text-[9px] font-normal opacity-90 max-w-[140px] truncate mt-0.5">
                            {event.failureReason}
                          </span>
                        )}
                      </span>
                    </td>

                    {/* Risk */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        event.riskLevel === 'Faible'
                          ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                          : event.riskLevel === 'Moyen'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-600 text-white animate-pulse'
                      }`}>
                        {event.riskLevel === 'Élevé' && <ShieldAlert className="w-3 h-3" />}
                        <span>{event.riskLevel}</span>
                      </span>
                    </td>

                  </tr>
                );
              })}

              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    <ShieldCheck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Aucune donnée de sécurité ne correspond à votre filtre</p>
                    <p className="text-xs text-slate-400 mt-1">Essayez de réinitialiser vos termes de recherche.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>

    </div>
  );
};


// --- SUB-COMPONENT: Brevo Email Audit Table ---
const BrevoEmailAuditTable: React.FC = () => {
  const [logs, setLogs] = useState<Array<{
    id: string;
    messageId: string;
    timestamp: string;
    toEmail: string;
    toName: string;
    subject: string;
    tag: string;
    mode: 'brevo_live' | 'simulation_fallback';
    status: 'Délivré' | 'Transmis' | 'Simulé' | 'Échec' | 'En attente';
    errorDetails?: string;
    templateIdUsed?: number | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [liveMode, setLiveMode] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await brevoEmailService.getEmailLogs();
      if (res.success && res.logs) {
        setLogs(res.logs);
        setLiveMode(res.mode === 'brevo_live');
      }
    } catch (err) {
      console.error('Error fetching Brevo email logs:', err);
    } finally {
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString('fr-FR'));
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = 
        log.toEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.toName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.messageId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.tag.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || 
        log.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [logs, searchTerm, statusFilter]);

  const totalSent = logs.length;
  const deliveredCount = logs.filter(l => l.status === 'Délivré' || l.status === 'Transmis').length;
  const simulatedCount = logs.filter(l => l.status === 'Simulé').length;
  const failedCount = logs.filter(l => l.status === 'Échec').length;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-6">
      {/* Header & Status Cards */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-700">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Audit des E-mails Transactionnels</h3>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              liveMode 
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
            }`}>
              {liveMode ? '🟢 Service API E-mail Direct' : '🟡 Mode Simulation / Local'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Traçabilité en temps réel des codes OTP, mails de bienvenue, alertes administrateur et réinitialisations de mot de passe.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Actualiser les statuts E-mail</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Mails</span>
          <span className="text-xl font-extrabold text-slate-800 dark:text-white mt-1 block">{totalSent}</span>
          <span className="text-[10px] text-slate-400">Dernier envoi récent</span>
        </div>

        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Transmis / Livrés</span>
          <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-300 mt-1 block">{deliveredCount}</span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium">Validés Serveur SMTP</span>
        </div>

        <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Mode Simulation</span>
          <span className="text-xl font-extrabold text-amber-800 dark:text-amber-300 mt-1 block">{simulatedCount}</span>
          <span className="text-[10px] text-amber-600 dark:text-amber-500 font-medium">Dev / Démo local</span>
        </div>

        <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-xl border border-rose-200/60 dark:border-rose-800/40">
          <span className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Échecs / Rejets</span>
          <span className="text-xl font-extrabold text-rose-800 dark:text-rose-300 mt-1 block">{failedCount}</span>
          <span className="text-[10px] text-rose-600 dark:text-rose-500 font-medium">{failedCount === 0 ? 'Aucune erreur' : 'Nécessite vérification'}</span>
        </div>
      </div>

      {/* Toolbar: Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par e-mail, destinataire, sujet, ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Statut :</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="délivré">Délivrés / Livrés</option>
            <option value="transmis">Transmis</option>
            <option value="simulé">Simulés</option>
            <option value="échec">Échecs</option>
          </select>

          {lastUpdated && (
            <span className="text-[10px] text-slate-400 ml-2 hidden lg:inline">
              Mise à jour : {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Email Logs Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
          <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="px-4 py-3 text-left">Horodatage / Date</th>
              <th className="px-4 py-3 text-left">Destinataire</th>
              <th className="px-4 py-3 text-left">Type / Tag</th>
              <th className="px-4 py-3 text-left">Sujet de l'E-mail</th>
              <th className="px-4 py-3 text-left">Message ID Serveur</th>
              <th className="px-4 py-3 text-center">Statut API</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                  <p className="font-semibold text-xs">Interrogation du service e-mail en cours...</p>
                </td>
              </tr>
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log) => {
                const dateStr = new Date(log.timestamp).toLocaleString('fr-FR', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                });

                return (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{dateStr}</span>
                      </div>
                    </td>

                    {/* Recipient */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-bold text-slate-800 dark:text-white">{log.toName}</div>
                      <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-mono">{log.toEmail}</div>
                    </td>

                    {/* Tag / Purpose */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50">
                        {log.tag}
                        {log.templateIdUsed && <span className="text-[9px] opacity-75">(Tpl #{log.templateIdUsed})</span>}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium max-w-[220px] truncate" title={log.subject}>
                      {log.subject}
                    </td>

                    {/* Message ID */}
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-slate-500 dark:text-slate-400 max-w-[180px] truncate" title={log.messageId}>
                      {log.messageId}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                        log.status === 'Délivré' 
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                          : log.status === 'Transmis'
                          ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                          : log.status === 'Simulé'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}>
                        {log.status === 'Délivré' || log.status === 'Transmis' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        ) : log.status === 'Échec' ? (
                          <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <InfoIcon className="w-3 h-3 text-amber-600" />
                        )}
                        <span>{log.status}</span>
                      </span>
                      {log.errorDetails && (
                        <div className="text-[9px] text-rose-600 mt-0.5 truncate max-w-[120px]" title={log.errorDetails}>
                          {log.errorDetails}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400">
                  <Mail className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Aucun e-mail trouvé dans les journaux d'envoi</p>
                  <p className="text-xs text-slate-400 mt-1">Effectuez un envoi de test dans les paramètres pour voir apparaître le statut ici.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// --- MAIN PAGE COMPONENT ---
interface AuditPageProps {
    activityLog: ActivityLog[];
    transactions: Transaction[];
    payments: Payment[];
    budget: any;
    users: User[];
    addNotification: (message: string, type: string, roles: string[], link?: string) => void;
}

const AuditPage: React.FC<AuditPageProps> = (props) => {
    const [activeTab, setActiveTab] = useState('audit');

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Audit, Sécurité & Contrôle</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Surveillance financière, réconciliation et traçabilité des accès administrateur</p>
                </div>
            </div>
            <div className="border-b border-gray-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabKey="audit" label="Alertes & Audit" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton tabKey="transactions" label="Audit des Transactions" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton tabKey="emails" label="Journal des E-mails" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton tabKey="security" label="Sécurité & Connexions IP" activeTab={activeTab} setActiveTab={setActiveTab} />
                    <TabButton tabKey="log" label="Journal d'Activité" activeTab={activeTab} setActiveTab={setActiveTab} />
                </nav>
            </div>
            
            <div className="mt-4">
                {activeTab === 'audit' && (
                    <div className="space-y-6">
                        <SmartAlerts {...props} />
                        <AutomaticAudit {...props} />
                    </div>
                )}
                {activeTab === 'transactions' && <TransactionsAuditTable transactions={props.transactions} />}
                {activeTab === 'emails' && <BrevoEmailAuditTable />}
                {activeTab === 'security' && <SecurityAuditTable />}
                {activeTab === 'log' && <ActivityLogTable log={props.activityLog} />}
            </div>
        </div>
    );
};

export default AuditPage;
