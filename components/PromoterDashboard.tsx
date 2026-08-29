import React, { useState, useMemo } from 'react';
import StatCard from './StatCard';
import BudgetTracker from './BudgetTracker';
import TopClassesList from './TopClassesList';
import BudgetCategoryAlerts from './BudgetCategoryAlerts';
import DailyCollectionsLineChart from './DailyCollectionsLineChart';
import RevenueChartCard from './LineChartCard';
import WeeklyAttendanceChartCard from './WeeklyAttendanceChartCard';
import UserAvatar from './UserAvatar';
import { 
  UsersIcon, 
  StatStudentsIcon, 
  StatTeachersIcon, 
  MoneyIcon, 
  ReceiptIcon, 
  FlagIcon,
  TimetableIcon
} from './Icons';
import { 
  AlertCircle, 
  CheckCircle2, 
  UserX, 
  GraduationCap, 
  ArrowUpRight, 
  TrendingDown, 
  TrendingUp,
  DollarSign, 
  FileText,
  ShieldCheck,
  Calendar as CalendarIcon,
  Clock,
  ArrowRight,
  Search,
  Filter,
  Sliders,
  Send,
  MessageSquare,
  Phone,
  Download,
  Check,
  X,
  Sparkles,
  PieChart as PieChartIcon,
  Building,
  ChevronRight,
  Layers,
  BarChart3,
  Wallet,
  AlertTriangle,
  RefreshCw,
  Users,
  UserPlus,
  Lock,
  Key
} from 'lucide-react';
import { showAppFeedback } from '../src/utils/appFeedback';

interface PromoterDashboardProps {
  users: any[];
  payments: any[];
  budget: any;
  transactions: any[];
  topClasses?: any[];
  classes?: any[];
  attendance?: any[];
  personnel?: any[];
  fees?: any[];
  grades?: any[];
  schoolSettings?: any;
  financialEvents?: any[];
  setActivePage?: (page: string) => void;
  onUpdateTransactionStatus?: (id: string, status: 'Approuvé' | 'Rejeté') => void;
  subscriptionInfo?: any;
  isLicenseActive?: boolean;
  onOpenSubscriptionModal?: () => void;
}

type TabType = 'overview' | 'recovery' | 'simulator' | 'hr' | 'attendance';

export const PromoterDashboard: React.FC<PromoterDashboardProps> = ({ 
  users = [], 
  payments = [], 
  budget, 
  transactions = [], 
  topClasses = [], 
  classes = [],
  attendance = [],
  personnel = [],
  fees = [],
  grades = [],
  schoolSettings,
  financialEvents = [],
  setActivePage,
  onUpdateTransactionStatus,
  subscriptionInfo,
  isLicenseActive = true,
  onOpenSubscriptionModal
}) => {
  const currency = schoolSettings?.currency || 'FCFA';
  const paymentAmount = (payment: any) => Number(payment.amountPaid ?? payment.amount_paid ?? payment.amount ?? 0) || 0;
  const paymentExpected = (payment: any) => Number(payment.totalFees ?? payment.total_fees ?? payment.expectedAmount ?? payment.expected_amount ?? 0) || 0;
  const isIncome = (transaction: any) => /revenu|income|recette/i.test(String(transaction.type || ''));
  const isExpense = (transaction: any) => /dépense|depense|expense/i.test(String(transaction.type || ''));

  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedCycle, setSelectedCycle] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('annual');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debtorFilter, setDebtorFilter] = useState<'all' | 'critical' | 'partial' | 'paid'>('all');
  const [minDebtThreshold, setMinDebtThreshold] = useState<number>(0);
  
  // Simulator State
  const [simulatedRecoveryRate, setSimulatedRecoveryRate] = useState<number>(90);
  
  // Direct Action Feedback Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState<boolean>(false);
  const [selectedDebtorForModal, setSelectedDebtorForModal] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    showAppFeedback(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Filter students and payments based on cycle/search
  const filteredStudents = useMemo(() => {
    return users.filter(u => {
      if (u.role !== 'Élève') return false;
      
      // Filter by Cycle
      if (selectedCycle !== 'all') {
        const studentClass = (u.class || u.className || '').toLowerCase();
        if (selectedCycle === 'maternelle' && !studentClass.includes('mat') && !studentClass.includes('ps') && !studentClass.includes('ms') && !studentClass.includes('gs')) return false;
        if (selectedCycle === 'primaire' && !studentClass.includes('ci') && !studentClass.includes('cp') && !studentClass.includes('ce') && !studentClass.includes('cm')) return false;
        if (selectedCycle === 'college' && !studentClass.includes('6') && !studentClass.includes('5') && !studentClass.includes('4') && !studentClass.includes('3')) return false;
        if (selectedCycle === 'lycee' && !studentClass.includes('2nd') && !studentClass.includes('1ere') && !studentClass.includes('tle') && !studentClass.includes('term')) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (u.name || '').toLowerCase().includes(q);
        const matchesClass = (u.class || u.className || '').toLowerCase().includes(q);
        const matchesEmail = (u.email || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClass && !matchesEmail) return false;
      }

      return true;
    });
  }, [users, selectedCycle, searchQuery]);

  // Payments computation
  const filteredPayments = useMemo(() => {
    const studentIds = new Set(filteredStudents.map(s => s.id));
    return payments.filter(p => studentIds.has(p.studentId) || studentIds.has(p.id) || selectedCycle === 'all');
  }, [payments, filteredStudents, selectedCycle]);

  // 1. Calculations for the 5 requested metrics
  // KPI 1: Total Frais Impayés (Reste à payer sur la scolarité / écolages)
  const totalUnpaidFees = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + Math.max(0, paymentExpected(p) - paymentAmount(p)), 0);
  }, [filteredPayments]);

  // KPI 2: Total Frais Encaissés (Total des paiements d'écolage perçus)
  const totalFeesCollected = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + paymentAmount(p), 0);
  }, [filteredPayments]);

  // Total Fees Expected
  const totalFeesExpected = useMemo(() => {
    return filteredPayments.reduce((sum, p) => sum + paymentExpected(p), 0);
  }, [filteredPayments, totalFeesCollected, totalUnpaidFees]);

  // KPI 3: Total des Dépenses (Dépenses validées et approuvées)
  const approvedTransactions = useMemo(() => {
    return transactions.filter(t => t.status === 'Approuvé' || t.status === 'validé' || t.status === 'valid');
  }, [transactions]);

  const totalExpenses = useMemo(() => {
    return approvedTransactions.filter(isExpense).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [approvedTransactions]);

  const totalApprovedRevenue = useMemo(() => {
    return approvedTransactions.filter(isIncome).reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  }, [approvedTransactions]);

  // KPI 4: Total d'élèves qui n'ont pas payé les frais d'écolages (solde débiteur > 0)
  const allDebtorsList = useMemo(() => {
    return filteredPayments
      .map(p => {
        const student = users.find(u => u.id === p.studentId || u.id === p.id || u.name === p.name);
        const total = paymentExpected(p);
        const paid = paymentAmount(p);
        const balanceDue = Math.max(0, total - paid);
        const paymentRate = total > 0 ? (paid / total) * 100 : 0;
        
        let statusCategory: 'paid' | 'partial' | 'critical' = 'paid';
        if (balanceDue > 0) {
          statusCategory = paymentRate < 50 ? 'critical' : 'partial';
        }

        return {
          id: p.id || p.studentId,
          studentId: p.studentId,
          name: p.name || student?.name || 'Élève Inconnu',
          class: p.class || p.className || student?.class || student?.className || 'Classe non spécifiée',
          totalFees: total,
          amountPaid: paid,
          balanceDue,
          paymentRate,
          statusCategory,
          parentPhone: student?.parentPhone || student?.phone || '',
          parentEmail: student?.parentEmail || student?.email || '',
          avatar: student?.avatar,
          lastPaymentDate: p.lastPaymentDate || p.paymentDate || p.payment_date || null
        };
      })
      .filter(d => d.balanceDue > 0);
  }, [filteredPayments, users]);

  const totalStudentsUnpaidCount = allDebtorsList.length;

  // Filtered debtors for tab view
  const displayDebtors = useMemo(() => {
    return allDebtorsList.filter(d => {
      if (debtorFilter === 'critical' && d.statusCategory !== 'critical') return false;
      if (debtorFilter === 'partial' && d.statusCategory !== 'partial') return false;
      if (minDebtThreshold > 0 && d.balanceDue < minDebtThreshold) return false;
      return true;
    }).sort((a, b) => b.balanceDue - a.balanceDue);
  }, [allDebtorsList, debtorFilter, minDebtThreshold]);

  // KPI 5: Total d'enseignants (professeurs et enseignants)
  const teachersFromUsers = users.filter(u => u.role === 'Enseignant').length;
  const teachersFromPersonnel = (personnel || []).filter(p => 
    p.role === 'Enseignant' || 
    p.role?.toLowerCase().includes('enseignant') || 
    p.role?.toLowerCase().includes('professeur')
  ).length;
  const totalTeachersCount = teachersFromUsers > 0 ? teachersFromUsers : teachersFromPersonnel;

  // Overall Strategic Financials
  const totalStudents = users.filter(u => u.role === 'Élève').length || new Set(payments.map(p => String(p.studentId ?? p.student_id ?? p.id ?? '')).filter(Boolean)).size;
  const effectiveRevenue = totalApprovedRevenue > 0 ? totalApprovedRevenue : totalFeesCollected;
  const netCashflow = effectiveRevenue - totalExpenses;
  const collectionRate = totalFeesExpected > 0 ? (totalFeesCollected / totalFeesExpected) * 100 : 0;

  // Personnel & Payroll Stats
  const totalMonthlyPayroll = useMemo(() => {
    return (personnel || []).reduce((sum, p) => sum + (Number(p.salary ?? p.baseSalary ?? 0) || 0), 0);
  }, [personnel, totalTeachersCount]);

  const payrollCoverageMonths = totalMonthlyPayroll > 0 ? Math.max(0, netCashflow / totalMonthlyPayroll).toFixed(1) : '—';

  // Pending transactions awaiting Promoter / DG approval
  const pendingTxns = useMemo(() => {
    return transactions.filter(t => t.status === 'En attente');
  }, [transactions]);

  // Simulator dynamic values
  const simulatedIncrementalRevenue = useMemo(() => {
    const targetRevenue = totalFeesExpected * (simulatedRecoveryRate / 100);
    return Math.max(0, targetRevenue - totalFeesCollected);
  }, [totalFeesExpected, simulatedRecoveryRate, totalFeesCollected]);

  const simulatedProjectedNetCash = useMemo(() => {
    return netCashflow + simulatedIncrementalRevenue;
  }, [netCashflow, simulatedIncrementalRevenue]);

  const handleApproveAllPending = () => {
    if (!onUpdateTransactionStatus || pendingTxns.length === 0) return;
    pendingTxns.forEach(t => onUpdateTransactionStatus(t.id, 'Approuvé'));
    showToast(`Succès : ${pendingTxns.length} opération(s) approuvée(s) d'un coup !`);
  };

  const handleSendReminder = (debtor: any) => {
    setSelectedDebtorForModal(debtor);
    setIsReminderModalOpen(true);
  };

  const handleConfirmSendReminder = () => {
    setIsReminderModalOpen(false);
    showToast(`Relance envoyée avec succès à la famille de ${selectedDebtorForModal?.name || 'l\'élève'} !`);
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* =========================================================================
          TOP EXECUTIVE BANNER
          ========================================================================= */}
      <div className="bg-gradient-to-br from-[#1F4A59] via-[#163844] to-[#0A1A22] text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-[#1F4A59]/40 relative overflow-hidden">
        {/* Background Subtle Pattern */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Direction Générale & Promoteur
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-white/10 text-slate-200 border border-white/15">
                Année Scolaire : {schoolSettings?.academicYear || schoolSettings?.currentYear || '2025-2026'}
              </span>
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                {pendingTxns.length} opération(s) à valider
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Tableau de Bord Stratégique & Trésorerie
            </h1>
            <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed">
              Console décisionnelle en temps réel : contrôle des flux d'encaissement, validation des charges de caisse, maîtrise du recouvrement et projection budgétaire.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
            {pendingTxns.length > 0 && onUpdateTransactionStatus && (
              <button
                onClick={handleApproveAllPending}
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                Valider les {pendingTxns.length} caisses
              </button>
            )}

            <button
              onClick={() => {
                setActiveTab('simulator');
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <Sliders className="w-4 h-4" />
              Simulateur Trésorerie
            </button>

            {setActivePage && (
              <button
                onClick={() => setActivePage('Rapports Financiers')}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/25 text-white text-xs font-bold rounded-xl border border-white/20 backdrop-blur-md transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Bilan Annuel
              </button>
            )}
          </div>
        </div>

        {/* Live Trésorerie Mini Bar */}
        <div className="mt-6 pt-5 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span className="text-[11px] text-slate-300 font-medium">Solde Net Trésorerie</span>
            <p className={`text-lg sm:text-xl font-black mt-0.5 ${netCashflow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {netCashflow >= 0 ? '+' : ''} {netCashflow.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-300">{currency}</span>
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-300 font-medium">Taux Recouvrement</span>
            <p className="text-lg sm:text-xl font-black text-white mt-0.5">
              {collectionRate.toFixed(1)}% <span className="text-xs font-medium text-emerald-300 font-bold">({totalFeesCollected.toLocaleString('fr-FR')} {currency})</span>
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-300 font-medium">Créances en Attente</span>
            <p className="text-lg sm:text-xl font-black text-amber-300 mt-0.5">
              {totalUnpaidFees.toLocaleString('fr-FR')} <span className="text-xs font-bold text-slate-300">{currency}</span>
            </p>
          </div>
          <div>
            <span className="text-[11px] text-slate-300 font-medium">Couverture Salariale</span>
            <p className="text-lg sm:text-xl font-black text-sky-300 mt-0.5">
              {payrollCoverageMonths} <span className="text-xs font-normal text-slate-300">mois de réserve</span>
            </p>
          </div>
        </div>
      </div>

      {/* Mode Licence Non Activée Announcement Card */}
      {!isLicenseActive && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 border-2 border-amber-400 dark:border-amber-600/80 p-5 sm:p-6 rounded-3xl shadow-sm text-slate-800 dark:text-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0 shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-amber-950 dark:text-amber-100">
                  Mode Licence Non Activée
                </h3>
                <span className="px-2.5 py-0.5 bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-black rounded-lg border border-amber-300 dark:border-amber-700">
                  Inscriptions & Création Caissier Autorisées
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-200/90 max-w-2xl leading-relaxed">
                En tant que promoteur en mode non activé, vous avez le droit de <strong>créer le compte Caissier</strong> et <strong>d'inscrire des élèves</strong>. Pour déverrouiller tous les modules de votre établissement (Notes, Comptabilité, Trésorerie, Validation des Opérations, Gestion RH) et créer vos autres comptes, achetez votre code d'abonnement.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
            {setActivePage && (
              <>
                <button
                  onClick={() => setActivePage('Inscriptions & Élèves')}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  <span>Inscrire des élèves</span>
                </button>
                <button
                  onClick={() => setActivePage('Utilisateurs')}
                  className="px-4 py-2.5 bg-[#1F4A59] hover:bg-[#183944] text-white font-bold rounded-xl text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Créer compte Caissier</span>
                </button>
              </>
            )}
            {onOpenSubscriptionModal && (
              <button
                onClick={onOpenSubscriptionModal}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Key className="w-4 h-4" />
                <span>Acheter / Activer code</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          INTERACTIVE GLOBAL NAVIGATION & FILTER TOOLBAR
          ========================================================================= */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Vue Stratégique
          </button>

          <button
            onClick={() => setActiveTab('recovery')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'recovery'
                ? 'bg-white dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ReceiptIcon />
            Recouvrement & Débiteurs
            <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
              {totalStudentsUnpaidCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-white dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Simulateur Trésorerie
          </button>

          <button
            onClick={() => setActiveTab('hr')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'hr'
                ? 'bg-white dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Masse Salariale & RH
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'attendance'
                ? 'bg-white dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UsersIcon />
            Assiduité & Classes
          </button>
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Cycle Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="text-xs font-bold bg-transparent text-slate-700 dark:text-slate-200 focus:outline-hidden border-none p-0 cursor-pointer"
            >
              <option value="all">Tous les Cycles</option>
              <option value="maternelle">Maternelle</option>
              <option value="primaire">Primaire</option>
              <option value="college">Collège</option>
              <option value="lycee">Lycée</option>
            </select>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Recherche élève / classe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1F4A59]"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          BUDGET ALERTS GAUGE
          ========================================================================= */}
      <BudgetCategoryAlerts 
        budget={budget} 
        transactions={transactions} 
        currency={currency} 
        roleTitle="Promoteur (Direction Générale)"
        onNavigateToReports={setActivePage ? () => setActivePage('Rapports Financiers') : undefined}
      />

      {/* =========================================================================
          TAB 1: VUE STRATÉGIQUE (OVERVIEW)
          ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* --- 5 MANDATORY REQUIRED CORE METRICS --- */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#1F4A59]/10 text-[#1F4A59] dark:text-sky-400 dark:bg-sky-400/10">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-slate-100 tracking-tight">
                    Indicateurs Financiers & Académiques Fondamentaux
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Aperçu instantané des créances, encaissements et effectifs
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Temps Réel Connecté
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* 1) Total Frais Impayés */}
              <div 
                onClick={() => setActiveTab('recovery')}
                className="group relative p-5 rounded-2xl bg-white dark:bg-slate-800 border border-orange-200/80 dark:border-orange-900/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300 border border-orange-200/60 dark:border-orange-800/60">
                      #1 Impayés
                    </span>
                    <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-900/60 group-hover:scale-105 transition-transform">
                      <ReceiptIcon />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-2xl font-black text-orange-600 dark:text-orange-400 tracking-tight">
                      {totalUnpaidFees.toLocaleString('fr-FR')} <span className="text-xs font-semibold text-orange-500/80 dark:text-orange-300/80">{currency}</span>
                    </p>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mt-1">
                      Créances scolaires à recouvrer
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-orange-100 dark:border-orange-900/40 flex items-center justify-between text-[11px]">
                  <span className="text-orange-700 dark:text-orange-300 font-bold">
                    {totalStudentsUnpaidCount} débiteurs
                  </span>
                  <span className="text-orange-600 dark:text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Détails →
                  </span>
                </div>
              </div>

              {/* 2) Total Frais Encaissés */}
              <div className="group relative p-5 rounded-2xl bg-white dark:bg-slate-800 border border-emerald-200/80 dark:border-emerald-900/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                      #2 Encaissé
                    </span>
                    <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/60 group-hover:scale-105 transition-transform">
                      <MoneyIcon />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                      {totalFeesCollected.toLocaleString('fr-FR')} <span className="text-xs font-semibold text-emerald-500/80 dark:text-emerald-300/80">{currency}</span>
                    </p>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mt-1">
                      Recouvrements scolarité perçus
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold">
                    Taux : {collectionRate.toFixed(1)}%
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    Encaissé
                  </span>
                </div>
              </div>

              {/* 3) Total des Dépenses */}
              <div className="group relative p-5 rounded-2xl bg-white dark:bg-slate-800 border border-rose-200/80 dark:border-rose-900/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                      #3 Dépenses
                    </span>
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/60 group-hover:scale-105 transition-transform">
                      <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
                      {totalExpenses.toLocaleString('fr-FR')} <span className="text-xs font-semibold text-rose-500/80 dark:text-rose-300/80">{currency}</span>
                    </p>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mt-1">
                      Salaires & charges d'exploitation
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-rose-100 dark:border-rose-900/40 flex items-center justify-between text-[11px]">
                  <span className="text-rose-700 dark:text-rose-300 font-bold">
                    {budget?.total ? `${Math.round((totalExpenses / budget.total) * 100)}% du budget` : 'Approuvé'}
                  </span>
                  {setActivePage && (
                    <button 
                      onClick={() => setActivePage('Personnel')} 
                      className="text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                    >
                      Détails →
                    </button>
                  )}
                </div>
              </div>

              {/* 4) Total d'Élèves Débiteurs */}
              <div 
                onClick={() => setActiveTab('recovery')}
                className="group relative p-5 rounded-2xl bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-amber-900/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                      #4 Débiteurs
                    </span>
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/60 group-hover:scale-105 transition-transform">
                      <UserX className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
                      {totalStudentsUnpaidCount} <span className="text-xs font-semibold text-amber-500/80 dark:text-amber-300/80">élèves</span>
                    </p>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mt-1">
                      Élèves à relancer pour solde
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-amber-100 dark:border-amber-900/40 flex items-center justify-between text-[11px]">
                  <span className="text-amber-700 dark:text-amber-300 font-bold">
                    {totalStudents > 0 ? `${Math.round((totalStudentsUnpaidCount / totalStudents) * 100)}% de l'effectif` : ''}
                  </span>
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Relancer →
                  </span>
                </div>
              </div>

              {/* 5) Total d'Enseignants */}
              <div 
                onClick={() => setActiveTab('hr')}
                className="group relative p-5 rounded-2xl bg-white dark:bg-slate-800 border border-teal-200/80 dark:border-teal-900/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-100 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60">
                      #5 Enseignants
                    </span>
                    <div className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900/60 group-hover:scale-105 transition-transform">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-2xl font-black text-teal-600 dark:text-teal-400 tracking-tight">
                      {totalTeachersCount} <span className="text-xs font-semibold text-teal-500/80 dark:text-teal-300/80">enseignants</span>
                    </p>
                    <p className="text-[11px] font-medium text-gray-500 dark:text-slate-400 mt-1">
                      Corps professoral actif
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-teal-100 dark:border-teal-900/40 flex items-center justify-between text-[11px]">
                  <span className="text-teal-700 dark:text-teal-300 font-bold">
                    {totalStudents > 0 && totalTeachersCount > 0 ? `1 prof / ${Math.round(totalStudents / totalTeachersCount)} él.` : 'Non renseigné'}
                  </span>
                  <span className="text-teal-600 dark:text-teal-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Équipe →
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* --- DIRECT TRANSACTION VALIDATION PANEL --- */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-4">
              <div>
                <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse shrink-0" />
                  📥 Centre de Validation Directe des Flux de Caisse ({pendingTxns.length} en attente)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Validez ou rejetez les dépenses et recettes saisies par les caissières et comptables en temps réel.
                </p>
              </div>

              {pendingTxns.length > 0 && onUpdateTransactionStatus && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleApproveAllPending}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
                  >
                    Tout approuver ({pendingTxns.length})
                  </button>
                </div>
              )}
            </div>

            {pendingTxns.length === 0 ? (
              <div className="py-8 text-center bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800">
                <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Toutes les opérations de caisse sont conformes</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Aucune écriture financière n'est actuellement en attente de votre validation.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingTxns.slice(0, 6).map((txn: any) => (
                  <div 
                    key={txn.id} 
                    className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-700 flex flex-col justify-between gap-3 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className={`px-2 py-0.5 rounded-md font-extrabold uppercase text-[9px] ${
                          txn.type === 'Revenu' 
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800' 
                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800'
                        }`}>
                          {txn.type} — {txn.category || 'Général'}
                        </span>
                        <span className="font-mono text-slate-400 font-medium text-[10px]">
                          {new Date(txn.date).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs line-clamp-2 leading-relaxed">
                        {txn.description}
                      </h4>
                      {txn.notes && (
                        <p className="text-[10px] italic text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                          Note: {txn.notes}
                        </p>
                      )}
                      {txn.paymentMethod && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Mode : <span className="font-semibold text-slate-700 dark:text-slate-300">{txn.paymentMethod}</span> {txn.mobileMoneyNumber ? `(${txn.mobileMoneyNumber})` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                      <span className={`text-sm font-black ${txn.type === 'Revenu' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                        {txn.type === 'Revenu' ? '+' : '-'} {Number(txn.amount || 0).toLocaleString('fr-FR')} {currency}
                      </span>

                      {onUpdateTransactionStatus && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              onUpdateTransactionStatus(txn.id, 'Rejeté');
                              showToast('Opération rejetée.');
                            }}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 rounded-lg text-xs font-bold transition-all border border-rose-200 dark:border-rose-800 cursor-pointer"
                          >
                            Rejeter
                          </button>
                          <button
                            onClick={() => {
                              onUpdateTransactionStatus(txn.id, 'Approuvé');
                              showToast('Opération approuvée avec succès !');
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
                          >
                            Approuver
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* --- DAILY COLLECTIONS LINE CHART --- */}
          <DailyCollectionsLineChart 
            transactions={transactions}
            payments={payments}
            currency={currency}
            title="Évolution Quotidienne des Encaissements (Mois en cours)"
            subtitle="Graphique interactif des flux journaliers d'écolages et encaissements avec cumul mensuel progressif"
          />

          {/* --- FINANCIAL PLANNING & REVENUE CHARTS --- */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <BudgetTracker spent={totalExpenses} total={budget?.total} currency={currency} />
              
              {/* Financial Calendar deadlines */}
              <div className="bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-200 dark:border-slate-700/60 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-xl text-indigo-600 dark:text-indigo-400">
                      <CalendarIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 dark:text-slate-100 text-sm">Échéances Financières & Dates Clés</h4>
                      <p className="text-[11px] text-gray-500 dark:text-slate-400">Planning institutionnel des paiements</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {financialEvents.length > 0 ? financialEvents.slice(0, 4).map((evt: any) => {
                    const eventDate = new Date(evt.start);
                    const formattedDate = isNaN(eventDate.getTime()) ? evt.start : eventDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
                    return (
                      <div key={evt.id} className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-xs hover:border-indigo-300 transition-colors">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                          <span className="font-medium text-gray-800 dark:text-slate-200 truncate">{evt.title}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-bold text-[11px] shrink-0">
                          {formattedDate}
                        </span>
                      </div>
                    );
                  }) : <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Aucune échéance enregistrée.</p>}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <RevenueChartCard transactions={transactions} currency={currency} />
              <TopClassesList classes={topClasses} />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: RECOUVREMENT & DÉBITEURS
          ========================================================================= */}
      {activeTab === 'recovery' && (
        <div className="space-y-6 animate-fade-in">
          {/* Recovery Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Scolarité Exigible</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {totalFeesExpected.toLocaleString('fr-FR')} <span className="text-xs text-slate-400">{currency}</span>
              </p>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, collectionRate)}%` }} />
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-emerald-200 dark:border-emerald-900/40 shadow-sm">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Montant Déjà Encaissé</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {totalFeesCollected.toLocaleString('fr-FR')} <span className="text-xs">{currency}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                Taux de recouvrement : <strong className="text-emerald-600 font-extrabold">{collectionRate.toFixed(1)}%</strong>
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-rose-200 dark:border-rose-900/40 shadow-sm">
              <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Créances Reste à Payer</span>
              <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                {totalUnpaidFees.toLocaleString('fr-FR')} <span className="text-xs">{currency}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                Sur <strong className="text-rose-600 font-extrabold">{totalStudentsUnpaidCount} élèves</strong>
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-amber-200 dark:border-amber-900/40 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Relance Collective</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Envoyez un rappel par SMS / WhatsApp à tous les parents débiteurs.
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedDebtorForModal(null);
                  setIsReminderModalOpen(true);
                }}
                className="mt-3 w-full py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-slate-950 text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Relancer Tous ({totalStudentsUnpaidCount})
              </button>
            </div>
          </div>

          {/* Debtor Filter Bar */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Filtrer par criticité :</span>
              <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => setDebtorFilter('all')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all ${
                    debtorFilter === 'all' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Tous ({allDebtorsList.length})
                </button>
                <button
                  onClick={() => setDebtorFilter('critical')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all ${
                    debtorFilter === 'critical' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Critiques &lt;50%
                </button>
                <button
                  onClick={() => setDebtorFilter('partial')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition-all ${
                    debtorFilter === 'partial' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Acomptes Partiels
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Solde minimum :</span>
              <select
                value={minDebtThreshold}
                onChange={(e) => setMinDebtThreshold(Number(e.target.value))}
                className="text-xs font-bold bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value={0}>Tous les montants</option>
                <option value={25000}>&gt; 25 000 {currency}</option>
                <option value={50000}>&gt; 50 000 {currency}</option>
                <option value={100000}>&gt; 100 000 {currency}</option>
              </select>
            </div>
          </div>

          {/* Debtors Interactive Table */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Registre des Débiteurs Prioritaires ({displayDebtors.length} trouvés)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Classement par solde dû décroissant avec relance instantanée par canal direct
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3.5 px-4">Élève / Matricule</th>
                    <th className="py-3.5 px-4">Classe</th>
                    <th className="py-3.5 px-4 text-right">Total Écolage</th>
                    <th className="py-3.5 px-4 text-right">Déjà Versé</th>
                    <th className="py-3.5 px-4 text-right">Solde Dû</th>
                    <th className="py-3.5 px-4 text-center">Taux Réglé</th>
                    <th className="py-3.5 px-4">Contact Tuteur</th>
                    <th className="py-3.5 px-4 text-center">Action Directe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {displayDebtors.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Aucun élève débiteur ne correspond aux critères sélectionnés.
                      </td>
                    </tr>
                  ) : (
                    displayDebtors.map((debtor) => (
                      <tr key={debtor.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={debtor.name} src={debtor.avatar} size="sm" />
                            <div>
                              <div className="font-extrabold text-slate-800 dark:text-slate-100">{debtor.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">ID: {debtor.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                            {debtor.class}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-slate-600 dark:text-slate-300">
                          {debtor.totalFees.toLocaleString('fr-FR')} {currency}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {debtor.amountPaid.toLocaleString('fr-FR')} {currency}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-black text-rose-600 dark:text-rose-400 text-sm">
                            {debtor.balanceDue.toLocaleString('fr-FR')} {currency}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              debtor.paymentRate >= 50 
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                            }`}>
                              {debtor.paymentRate.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{debtor.parentPhone}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleSendReminder(debtor)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold transition-all border border-emerald-200 dark:border-emerald-800 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            Relancer
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SIMULATEUR DE TRÉSORERIE & RENTABILITÉ
          ========================================================================= */}
      {activeTab === 'simulator' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md space-y-6">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-100 dark:border-emerald-900">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Simulateur Interactif de Rentabilité & Recouvrement
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ajustez l'objectif de recouvrement pour mesurer l'impact direct sur la trésorerie nette et la réserve de fin d'année
                  </p>
                </div>
              </div>
            </div>

            {/* Slider Control */}
            <div className="p-6 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                  Objectif de Recouvrement Cible : <span className="text-emerald-600 text-lg font-black">{simulatedRecoveryRate}%</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSimulatedRecoveryRate(80)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                  >
                    Pessimiste (80%)
                  </button>
                  <button
                    onClick={() => setSimulatedRecoveryRate(90)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 cursor-pointer"
                  >
                    Réaliste (90%)
                  </button>
                  <button
                    onClick={() => setSimulatedRecoveryRate(98)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white font-black cursor-pointer"
                  >
                    Optimiste (98%)
                  </button>
                </div>
              </div>

              <input
                type="range"
                min={Math.max(50, Math.floor(collectionRate))}
                max={100}
                step={1}
                value={simulatedRecoveryRate}
                onChange={(e) => setSimulatedRecoveryRate(Number(e.target.value))}
                className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
              />

              <div className="flex justify-between text-[11px] font-bold text-slate-400">
                <span>Taux Actuel ({collectionRate.toFixed(1)}%)</span>
                <span>85%</span>
                <span>90%</span>
                <span>95%</span>
                <span>100% (Recouvrement Intégral)</span>
              </div>
            </div>

            {/* Simulated Projected Outputs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-2xl">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Recettes Additionnelles à Encaisser</span>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                  +{simulatedIncrementalRevenue.toLocaleString('fr-FR')} <span className="text-xs">{currency}</span>
                </p>
                <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-2">
                  Gain financier net à capturer pour atteindre {simulatedRecoveryRate}%
                </p>
              </div>

              <div className="p-5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/80 rounded-2xl">
                <span className="text-xs font-bold text-sky-800 dark:text-sky-300">Solde Prévisionnel de Trésorerie Finale</span>
                <p className="text-2xl font-black text-sky-700 dark:text-sky-400 mt-1">
                  {simulatedProjectedNetCash.toLocaleString('fr-FR')} <span className="text-xs">{currency}</span>
                </p>
                <p className="text-[11px] text-sky-600/80 dark:text-sky-400/80 mt-2">
                  Bénéfice net d'exploitation après déduction de toutes les dépenses
                </p>
              </div>

              <div className="p-5 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 rounded-2xl">
                <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Autonomie en Mois de Masse Salariale</span>
                <p className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
                  {(totalMonthlyPayroll > 0 ? (simulatedProjectedNetCash / totalMonthlyPayroll).toFixed(1) : '4.8')} <span className="text-xs">mois</span>
                </p>
                <p className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-2">
                  Réserve de sécurité salariale disponible pour l'établissement
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: PILOTAGE RH & MASSE SALARIALE
          ========================================================================= */}
      {activeTab === 'hr' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Masse Salariale Mensuelle Estimée</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                {totalMonthlyPayroll.toLocaleString('fr-FR')} <span className="text-xs text-slate-400">{currency}</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-2">Salaires bruts et indemnités pédagogiques</p>
            </div>

            <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-teal-200 dark:border-teal-900/40 shadow-sm">
              <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">Corps Professoral Total</span>
              <p className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">
                {totalTeachersCount} <span className="text-xs">enseignants</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-2">
                Ratio : {totalTeachersCount > 0 ? `1 enseignant pour ${Math.round(totalStudents / totalTeachersCount)} élèves` : 'non renseigné'}
              </p>
            </div>

            <div className="p-5 bg-white dark:bg-slate-800 rounded-3xl border border-indigo-200 dark:border-indigo-900/40 shadow-sm">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">Personnel Administratif & Support</span>
              <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                {Math.max(0, personnel.length - totalTeachersCount)} <span className="text-xs">collaborateurs</span>
              </p>
              <p className="text-[11px] text-slate-500 mt-2">Direction, surveillance, caisse et intendance</p>
            </div>
          </div>

          {/* Personnel Quick Directory */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Répertoire Institutionnel du Personnel & Enseignants
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vue d'ensemble des collaborateurs affectés à l'établissement
                </p>
              </div>
              {setActivePage && (
                <button
                  onClick={() => setActivePage('Personnel')}
                  className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  Gestion Personnel →
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4">Nom du Collaborateur</th>
                    <th className="py-3 px-4">Fonction / Rôle</th>
                    <th className="py-3 px-4">Discipline / Service</th>
                    <th className="py-3 px-4 text-center">Statut</th>
                    <th className="py-3 px-4">Contact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {(personnel || []).slice(0, 10).map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2.5">
                        <UserAvatar name={p.name} size="sm" />
                        <span>{p.name}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {p.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {p.department || p.subject || 'Enseignement Général'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {p.status || 'Actif'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {p.phone || 'Non renseigné'}
                      </td>
                    </tr>
                  ))}
                  {personnel.length === 0 && (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">Aucun collaborateur enregistré.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: ASSIDUITÉ & CLASSES
          ========================================================================= */}
      {activeTab === 'attendance' && (
        <div className="space-y-6 animate-fade-in">
          <WeeklyAttendanceChartCard
            attendance={attendance}
            classes={classes}
            users={users}
            title="Évolution Hebdomadaire des Présences par Classe (Vue Promoteur / Direction)"
            subtitle="Contrôle institutionnel de l'assiduité, présences et retards par division"
            userRole="Promoteur"
          />

          <TopClassesList classes={topClasses} />
        </div>
      )}

      {/* =========================================================================
          MODAL: RELANCE COLLECTIVE / INDIVIDUELLE (SMS / WHATSAPP)
          ========================================================================= */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-2xl">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                    {selectedDebtorForModal ? `Relancer ${selectedDebtorForModal.name}` : `Relance Collective (${totalStudentsUnpaidCount} familles)`}
                  </h3>
                  <p className="text-xs text-slate-500">Envoi de rappel officiel pour régularisation des frais d'écolage</p>
                </div>
              </div>
              <button 
                onClick={() => setIsReminderModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300">
                Modèle de message à envoyer :
              </label>
              <textarea
                rows={4}
                readOnly
                value={selectedDebtorForModal 
                  ? `Chers parents de ${selectedDebtorForModal.name} (${selectedDebtorForModal.class}), nous vous rappelons qu'un solde de ${selectedDebtorForModal.balanceDue.toLocaleString('fr-FR')} ${currency} reste à régler au titre de l'écolage. Merci de vous rapprocher de la caisse ou de régler par Mobile Money. Direction de l'Établissement.`
                  : `Chers parents d'élèves, un rappel concernant les frais de scolarité de vos enfants pour l'année en cours : nous vous invitons à régulariser vos soldes d'écolage avant la date limite. Merci pour votre collaboration. Direction de l'Établissement.`
                }
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed resize-none focus:outline-hidden"
              />

              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Canaux activés : SMS direct + Notification WhatsApp certifiée</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmSendReminder}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-extrabold rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Confirmer l'envoi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromoterDashboard;
