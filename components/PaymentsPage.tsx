import React, { useState, useMemo } from 'react';
import { studentPaymentsData as initialPayments } from '../constants';
import Modal from './Modal';
import PaymentForm from './PaymentForm';
import Receipt from './Receipt';
import { SearchIcon, PlusCircleIcon, PrinterIcon, FileDownloadIcon, UsersIcon } from './Icons';
import { Transaction, SchoolSettings, SinglePaymentData } from '../App';
import { User } from './UserForm';
import { Class } from './ClassForm';
import { generateReceiptPdf } from '../utils/receiptPdfGenerator';
import { 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  List, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  GraduationCap,
  Eye,
  FileSpreadsheet,
  X,
  Filter,
  Calendar
} from 'lucide-react';

type PaymentStatus = 'Tous' | 'Payé' | 'Partiel' | 'Impayé';
type PeriodFilter = 'Toutes' | 'Jour' | 'Semaine' | 'Mois' | 'Année';
type Payment = typeof initialPayments[0];

interface PaymentsPageProps {
  payments: Payment[];
  onSavePayment: (paymentData: SinglePaymentData) => Transaction | null;
  currentUserRole: string;
  transactions: Transaction[];
  users: User[];
  classes: Class[];
  schoolSettings: SchoolSettings;
  isCaisseOpen: boolean;
}

const isDateInPeriod = (dateStr: string | undefined, period: PeriodFilter): boolean => {
  if (period === 'Toutes' || !dateStr) return true;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return true;

  const now = new Date();

  if (period === 'Jour') {
    return date.toDateString() === now.toDateString();
  }

  if (period === 'Semaine') {
    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return date >= startOfWeek && date < endOfWeek;
  }

  if (period === 'Mois') {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }

  if (period === 'Année') {
    return date.getFullYear() === now.getFullYear();
  }

  return true;
};

const PaymentsPage: React.FC<PaymentsPageProps> = ({ 
  payments, 
  onSavePayment, 
  currentUserRole, 
  transactions, 
  users, 
  classes, 
  schoolSettings, 
  isCaisseOpen 
}) => {
  const [paymentModalState, setPaymentModalState] = useState<'closed' | 'form' | 'receipt'>('closed');
  const [transactionForReceipt, setTransactionForReceipt] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentStatus>('Tous');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('Toutes');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('Toutes');
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  
  // Track collapsed/expanded classes in grouped mode
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({});

  const currency = schoolSettings?.currency || 'FCFA';

  // Role permissions - Seul le caissier, le RAF et le directeur général peuvent encaisser les paiements et inscrire/réinscrire
  const canManagePayments = 
    currentUserRole === 'Admin' || 
    currentUserRole === 'Co-admin' || 
    currentUserRole === 'Caissière' || 
    currentUserRole === 'Responsable des finances' || 
    currentUserRole === 'Directeur Général';
  
  const isCaisseClosedForCashier = currentUserRole === 'Caissière' && !isCaisseOpen;
  
  // Authorization check for CSV Export (Administrateurs, DG / Promoteur, RAF)
  const normalizedRole = (currentUserRole || '').toLowerCase();
  const canExportCSV = 
    normalizedRole.includes('admin') || 
    normalizedRole.includes('promoteur') || 
    normalizedRole.includes('dg') || 
    normalizedRole.includes('directeur') || 
    normalizedRole.includes('finances') || 
    normalizedRole.includes('raf');

  const toggleClassCollapse = (className: string) => {
    setCollapsedClasses(prev => ({
      ...prev,
      [className]: !prev[className]
    }));
  };

  const expandAllClasses = () => setCollapsedClasses({});
  const collapseAllClasses = () => {
    const allCollapsed: Record<string, boolean> = {};
    Object.keys(paymentsByClass).forEach(cName => {
      allCollapsed[cName] = true;
    });
    setCollapsedClasses(allCollapsed);
  };

  /**
   * Helper: Find existing transaction OR synthesize a valid receipt transaction for student
   */
  const getReceiptTransaction = (payment: Payment): Transaction => {
    const studentNameLower = payment.name.toLowerCase().trim();
    const studentIdLower = payment.studentId ? payment.studentId.toLowerCase().trim() : '';

    const matchedTx = transactions.find(t => {
      if (t.type !== 'Revenu') return false;
      const descLower = t.description.toLowerCase();
      return descLower.includes(studentNameLower) || (studentIdLower && descLower.includes(studentIdLower));
    });

    if (matchedTx) {
      return matchedTx;
    }

    return {
      id: `REC-${payment.studentId || payment.id}-${Date.now().toString().slice(-4)}`,
      description: `Frais de scolarité - ${payment.name} (${payment.studentId || 'N/A'})`,
      type: 'Revenu',
      amount: payment.amountPaid > 0 ? payment.amountPaid : payment.totalFees,
      date: new Date().toISOString(),
      status: 'Approuvé',
      category: 'Scolarité',
      paymentMethod: 'Espèce',
      approvedBy: 'Caisse Principale',
    };
  };

  const handleSaveAndShowReceipt = (paymentData: SinglePaymentData) => {
    const newTransaction = onSavePayment(paymentData);
    if (newTransaction) {
      setTransactionForReceipt(newTransaction);
      setPaymentModalState('receipt');
    } else {
      setPaymentModalState('closed');
      alert("Erreur lors de l'enregistrement du paiement.");
    }
  };

  const handlePrintReceipt = (payment: Payment) => {
    const tx = getReceiptTransaction(payment);
    setTransactionForReceipt(tx);
    setPaymentModalState('receipt');
  };

  const handleDownloadReceiptPDF = (payment: Payment) => {
    const tx = getReceiptTransaction(payment);
    generateReceiptPdf(tx, schoolSettings);
  };

  // Unique list of classes from payments & school classes
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>();
    payments.forEach(p => { if (p.class) classSet.add(p.class); });
    classes.forEach(c => { if (c.name) classSet.add(c.name); });
    return Array.from(classSet).sort();
  }, [payments, classes]);

  // Filtered payments list based on Search, Status, Class filter, and Period (Jour, Semaine, Mois, Année)
  const filteredPayments = useMemo(() => {
    return payments
      .filter(p => {
        if (selectedClassFilter !== 'Toutes' && p.class !== selectedClassFilter) {
          return false;
        }
        const balance = p.totalFees - p.amountPaid;
        if (statusFilter === 'Payé' && balance > 0) return false;
        if (statusFilter === 'Partiel' && (balance <= 0 || p.amountPaid === 0)) return false;
        if (statusFilter === 'Impayé' && p.amountPaid > 0) return false;

        if (periodFilter !== 'Toutes') {
          const studentNameLower = p.name.toLowerCase().trim();
          const studentIdLower = p.studentId ? p.studentId.toLowerCase().trim() : '';

          const studentTxs = transactions.filter(t => {
            if (t.type !== 'Revenu') return false;
            const descLower = t.description.toLowerCase();
            return descLower.includes(studentNameLower) || (studentIdLower && descLower.includes(studentIdLower));
          });

          const hasTxInPeriod = studentTxs.some(t => isDateInPeriod(t.date, periodFilter));
          const paymentDateMatches = isDateInPeriod((p as any).date || (p as any).lastPaymentDate, periodFilter);

          if (!hasTxInPeriod && !paymentDateMatches) {
            const rx = getReceiptTransaction(p);
            if (!isDateInPeriod(rx?.date, periodFilter)) {
              return false;
            }
          }
        }

        return true;
      })
      .filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.class && p.class.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }, [payments, searchTerm, statusFilter, selectedClassFilter, periodFilter, transactions]);

  // Group payments by class with summary metrics
  const paymentsByClass = useMemo(() => {
    const groups: Record<string, {
      className: string;
      payments: Payment[];
      totalFees: number;
      amountPaid: number;
      balance: number;
      recoveryRate: number;
      paidCount: number;
      partialCount: number;
      unpaidCount: number;
    }> = {};

    filteredPayments.forEach(p => {
      const cName = p.class || 'Classe Non Spécifiée';
      if (!groups[cName]) {
        groups[cName] = {
          className: cName,
          payments: [],
          totalFees: 0,
          amountPaid: 0,
          balance: 0,
          recoveryRate: 0,
          paidCount: 0,
          partialCount: 0,
          unpaidCount: 0,
        };
      }
      groups[cName].payments.push(p);
      groups[cName].totalFees += p.totalFees;
      groups[cName].amountPaid += p.amountPaid;
      const bal = p.totalFees - p.amountPaid;
      groups[cName].balance += bal;

      if (bal <= 0) groups[cName].paidCount++;
      else if (p.amountPaid > 0) groups[cName].partialCount++;
      else groups[cName].unpaidCount++;
    });

    // Calculate rates
    Object.keys(groups).forEach(cName => {
      const g = groups[cName];
      g.recoveryRate = g.totalFees > 0 ? Math.round((g.amountPaid / g.totalFees) * 100) : 0;
    });

    return groups;
  }, [filteredPayments]);

  // Global summary statistics
  const globalStats = useMemo(() => {
    let totalFees = 0;
    let totalPaid = 0;
    filteredPayments.forEach(p => {
      totalFees += p.totalFees;
      totalPaid += p.amountPaid;
    });
    const balance = totalFees - totalPaid;
    const recoveryRate = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;
    return { totalFees, totalPaid, balance, recoveryRate, studentCount: filteredPayments.length };
  }, [filteredPayments]);

  /**
   * CSV Export functionality for Admin, DG, Promoteur and RAF
   * Downloads formatted CSV grouped by class
   */
  const handleExportCSV = () => {
    let csv = "\uFEFF"; // UTF-8 BOM for Microsoft Excel compatibility
    csv += `"EXPORTATION DU TABLEAU DE GESTION DES PAIEMENTS - ${schoolSettings?.name || 'ÉTABLISSEMENT'}"\n`;
    csv += `"Généré le : ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}"\n\n`;

    csv += `"Classe";"Élève";"Matricule";"Famille Nombreuse";"Réduction (${currency})";"Frais d'écolage (${currency})";"Montant Payé (${currency})";"Solde Restant (${currency})";"Frais Totaux (${currency})";"Statut"\n`;

    (Object.values(paymentsByClass) as any[]).forEach((group) => {
      group.payments.forEach((p: any) => {
        const balance = p.totalFees - p.amountPaid;
        const baseTuition = p.baseTuition || p.totalFees;
        const reductionAmount = Math.max(0, baseTuition - p.totalFees);
        let statusText = 'Impayé';
        if (balance <= 0) statusText = 'Payé';
        else if (p.amountPaid > 0) statusText = 'Partiel';

        const row = [
          `"${group.className}"`,
          `"${p.name.replace(/"/g, '""')}"`,
          `"${p.studentId}"`,
          `"${p.isLargeFamily ? 'Oui' : 'Non'}"`,
          `"${reductionAmount > 0 ? `-${reductionAmount}` : '0'}"`,
          `"${baseTuition}"`,
          `"${p.amountPaid}"`,
          `"${balance}"`,
          `"${p.totalFees}"`,
          `"${statusText}"`
        ];
        csv += row.join(';') + '\n';
      });

      // Subtotal line for class
      csv += `"TOTAL CLASSE ${group.className}";"";"";"";"";"";"${group.amountPaid}";"${group.balance}";"${group.totalFees}";"Taux: ${group.recoveryRate}%"\n`;
    });

    // Global summary
    csv += `\n"TOTAL GÉNÉRAL ÉTABLISSEMENT";"";"";"";"";"";"${globalStats.totalPaid}";"${globalStats.balance}";"${globalStats.totalFees}";"Taux Général: ${globalStats.recoveryRate}%"\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Paiements_Groupes_Par_Classe_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (total: number, paid: number) => {
    const balance = total - paid;
    if (balance <= 0) {
      return { 
        text: 'Payé', 
        className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
        icon: <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
      };
    }
    if (paid > 0) {
      return { 
        text: 'Partiel', 
        className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
        icon: <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
      };
    }
    return { 
      text: 'Impayé', 
      className: 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
      icon: <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-600" />
    };
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-gray-100 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100 flex items-center gap-2">
              <GraduationCap className="w-7 h-7 text-[#1F4A59] dark:text-sky-400" />
              <span>Gestion des Paiements & Écolages</span>
            </h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Suivi individuel et regroupé par classe des encaissements, solde des élèves, réductions et édition des reçus de caisse.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* CSV Export Button for Admin, DG, Promoteur & RAF */}
            {canExportCSV && (
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl transition-all shadow-sm active:scale-98 text-xs shrink-0"
                title="Télécharger le tableau groupé par classe au format CSV"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exporter en CSV</span>
              </button>
            )}

            {canManagePayments && (
              <button 
                onClick={() => setPaymentModalState('form')} 
                disabled={isCaisseClosedForCashier}
                title={isCaisseClosedForCashier ? "La caisse est actuellement fermée" : "Enregistrer un nouveau paiement"}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#1F4A59] hover:bg-[#2c5a6e] text-white font-semibold rounded-xl transition-all shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed shrink-0 text-xs sm:text-sm"
              >
                <PlusCircleIcon />
                <span>Enregistrer un Paiement</span>
              </button>
            )}
          </div>
        </div>

        {/* Global Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-slate-700/60">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <span className="text-xs text-gray-500 dark:text-slate-400 font-medium block">Effectif concerné</span>
            <span className="text-lg font-bold text-gray-900 dark:text-slate-100">{globalStats.studentCount} élèves</span>
          </div>
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium block">Total Encaissé</span>
            <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
              {globalStats.totalPaid.toLocaleString()} {currency}
            </span>
          </div>
          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium block">Reste à Recouvrer</span>
            <span className="text-lg font-bold text-amber-800 dark:text-amber-300">
              {globalStats.balance.toLocaleString()} {currency}
            </span>
          </div>
          <div className="p-3 bg-sky-50/60 dark:bg-sky-950/30 rounded-xl border border-sky-200/60 dark:border-sky-800/40">
            <span className="text-xs text-sky-700 dark:text-sky-400 font-medium block">Taux de Recouvrement</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-lg font-bold text-sky-800 dark:text-sky-300">{globalStats.recoveryRate}%</span>
              <div className="flex-1 bg-sky-200 dark:bg-sky-900 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-sky-600 h-full rounded-full transition-all" 
                  style={{ width: `${Math.min(100, globalStats.recoveryRate)}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Search Bar and Quick Class Selector */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-md border border-gray-100 dark:border-slate-700 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-slate-300">
              Recherche & Filtrage Rapide
            </h3>
          </div>
          {(searchTerm || selectedClassFilter !== 'Toutes' || statusFilter !== 'Tous' || periodFilter !== 'Toutes') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedClassFilter('Toutes');
                setStatusFilter('Tous');
                setPeriodFilter('Toutes');
              }}
              className="text-xs text-rose-600 dark:text-rose-400 font-bold hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Réinitialiser les filtres
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 1. Instant Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Rechercher par Nom d'élève, Matricule ou Classe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-900 text-gray-800 dark:text-slate-200 placeholder-gray-400 rounded-xl py-2.5 pl-10 pr-9 focus:outline-none focus:ring-2 focus:ring-[#1F4A59] border border-gray-200 dark:border-slate-700 text-sm font-medium"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <SearchIcon />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* 2. Quick Class Selector Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700 dark:text-slate-300 whitespace-nowrap">
              Classe :
            </label>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="rounded-xl border border-gray-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-gray-800 dark:text-slate-100 text-xs py-2.5 px-3 font-bold focus:ring-2 focus:ring-[#1F4A59] cursor-pointer"
            >
              <option value="Toutes">🏫 Toutes ({availableClasses.length})</option>
              {availableClasses.map(c => (
                <option key={c} value={c}>Classe : {c}</option>
              ))}
            </select>
          </div>

          {/* 3. Period Triage Selector Dropdown (Jour, Semaine, Mois, Année) */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700 dark:text-slate-300 whitespace-nowrap flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#1F4A59] dark:text-sky-400" />
              Période :
            </label>
            <select 
              value={periodFilter} 
              onChange={e => setPeriodFilter(e.target.value as PeriodFilter)}
              className="rounded-xl border border-gray-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-gray-800 dark:text-slate-100 text-xs py-2.5 px-3 font-bold focus:ring-2 focus:ring-[#1F4A59] cursor-pointer"
            >
              <option value="Toutes">🗓️ Toutes les périodes</option>
              <option value="Jour">📅 Jour (Aujourd'hui)</option>
              <option value="Semaine">📆 Semaine (Cette semaine)</option>
              <option value="Mois">📊 Mois (Ce mois-ci)</option>
              <option value="Année">🎓 Année (Cette année)</option>
            </select>
          </div>

          {/* 4. Status Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-700 dark:text-slate-300 whitespace-nowrap">
              Statut :
            </label>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value as PaymentStatus)}
              className="rounded-xl border border-gray-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-gray-800 dark:text-slate-100 text-xs py-2.5 px-3 font-bold focus:ring-2 focus:ring-[#1F4A59] cursor-pointer"
            >
              <option value="Tous">Tous les statuts</option>
              <option value="Payé">✅ Payé</option>
              <option value="Partiel">⏳ Partiel</option>
              <option value="Impayé">❌ Impayé</option>
            </select>
          </div>

          {/* View Mode Toggle Button Group */}
          <div className="flex items-center bg-gray-100 dark:bg-slate-900 p-1 rounded-xl border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'grouped' 
                  ? 'bg-white dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800 dark:text-slate-400'
              }`}
              title="Regrouper les paiements par classe"
            >
              <Layers className="w-4 h-4" />
              <span>Par Classe</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'list' 
                  ? 'bg-white dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 shadow-xs' 
                  : 'text-gray-500 hover:text-gray-800 dark:text-slate-400'
              }`}
              title="Afficher sous forme de liste continue"
            >
              <List className="w-4 h-4" />
              <span>Liste Globale</span>
            </button>
          </div>
        </div>

        {/* Quick Period Triage Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-2 pb-1 text-xs no-scrollbar border-t border-gray-100 dark:border-slate-700/60">
          <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 shrink-0 mr-1 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Triage Période :
          </span>
          {(['Toutes', 'Jour', 'Semaine', 'Mois', 'Année'] as PeriodFilter[]).map(per => {
            const labels: Record<PeriodFilter, string> = {
              Toutes: 'Toutes les périodes',
              Jour: "Aujourd'hui (Jour)",
              Semaine: 'Cette Semaine',
              Mois: 'Ce Mois-ci',
              Année: 'Cette Année'
            };
            return (
              <button
                key={per}
                onClick={() => setPeriodFilter(per)}
                className={`px-3 py-1 rounded-full font-bold text-xs transition-all shrink-0 ${
                  periodFilter === per
                    ? 'bg-[#1F4A59] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {labels[per]}
              </button>
            );
          })}
        </div>

        {/* Quick Class Pills / Chips for fast 1-tap selection by cashiers */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-1 text-xs no-scrollbar">
          <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 shrink-0 mr-1">Classes :</span>
          <button
            onClick={() => setSelectedClassFilter('Toutes')}
            className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 ${
              selectedClassFilter === 'Toutes'
                ? 'bg-[#1F4A59] text-white shadow-xs'
                : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
            }`}
          >
            Toutes
          </button>
          {availableClasses.map(c => (
            <button
              key={c}
              onClick={() => setSelectedClassFilter(c)}
              className={`px-3 py-1 rounded-full font-bold transition-all shrink-0 ${
                selectedClassFilter === c
                  ? 'bg-[#1F4A59] text-white shadow-xs'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Main View Content */}
      {viewMode === 'grouped' ? (
        /* MODE REGROUPÉ PAR CLASSE */
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
              {Object.keys(paymentsByClass).length} Classe(s) Répertoriée(s)
            </span>
            <div className="flex gap-2">
              <button 
                onClick={expandAllClasses}
                className="text-xs text-[#1F4A59] dark:text-sky-400 font-bold hover:underline"
              >
                Tout développer
              </button>
              <span className="text-gray-300">|</span>
              <button 
                onClick={collapseAllClasses}
                className="text-xs text-gray-500 dark:text-slate-400 font-bold hover:underline"
              >
                Tout réduire
              </button>
            </div>
          </div>

          {Object.keys(paymentsByClass).length === 0 ? (
            <div className="bg-white dark:bg-slate-800 p-8 text-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-500 italic text-sm">
              Aucun résultat ne correspond à vos critères de recherche.
            </div>
          ) : (
            (Object.values(paymentsByClass) as any[]).map(group => {
              const isCollapsed = !!collapsedClasses[group.className];
              return (
                <div 
                  key={group.className}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 overflow-hidden transition-all"
                >
                  {/* Class Group Banner */}
                  <div 
                    onClick={() => toggleClassCollapse(group.className)}
                    className="p-4 bg-slate-50 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-900 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#1F4A59] text-white rounded-lg shadow-xs font-bold text-xs shrink-0">
                        {group.className}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 flex items-center gap-2">
                          Classe : {group.className}
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {group.payments.length} élève(s)
                          </span>
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Solde à recouvrer: <strong className="text-amber-700 dark:text-amber-400">{group.balance.toLocaleString()} {currency}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Summary Badges for Class */}
                      <div className="hidden lg:flex items-center gap-3 text-xs">
                        <div className="text-right">
                          <span className="text-gray-400 block text-[10px]">Encaissé</span>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {group.amountPaid.toLocaleString()} {currency}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 block text-[10px]">Taux</span>
                          <span className="font-bold text-sky-700 dark:text-sky-400">
                            {group.recoveryRate}%
                          </span>
                        </div>
                      </div>

                      <div className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300">
                        {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                      </div>
                    </div>
                  </div>

                  {/* Class Student Payments Table */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-xs">
                        <thead className="bg-gray-50/80 dark:bg-slate-900/60">
                          <tr>
                            <th className="px-4 py-3 text-left font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Élève</th>
                            <th className="px-4 py-3 text-left font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Classe</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Famille nombreuse</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Réduction</th>
                            <th className="px-4 py-3 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Frais d'écolage</th>
                            <th className="px-4 py-3 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Montant Payé</th>
                            <th className="px-4 py-3 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Solde Restant</th>
                            <th className="px-4 py-3 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Frais Totaux</th>
                            <th className="px-4 py-3 text-center font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Statut</th>
                            <th className="px-4 py-3 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-100 dark:divide-slate-700/60">
                          {group.payments.map(p => {
                            const balance = p.totalFees - p.amountPaid;
                            const status = getStatusBadge(p.totalFees, p.amountPaid);
                            const baseTuition = p.baseTuition || p.totalFees;
                            const reductionAmount = Math.max(0, baseTuition - p.totalFees);
                            const reductionPercent = baseTuition > 0 ? Math.round((reductionAmount / baseTuition) * 100) : 0;
                            return (
                              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                {/* 1. Élève */}
                                <td className="px-4 py-3.5 font-bold text-gray-900 dark:text-slate-100">
                                  <div>{p.name}</div>
                                  <div className="text-[11px] text-gray-500 dark:text-slate-400 font-mono font-normal">{p.studentId}</div>
                                </td>
                                {/* 2. Classe */}
                                <td className="px-4 py-3.5 text-gray-700 dark:text-slate-300">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700/80 font-bold text-slate-800 dark:text-slate-200">
                                    {p.class}
                                  </span>
                                </td>
                                {/* 3. Famille nombreuse */}
                                <td className="px-4 py-3.5 text-center">
                                  {p.isLargeFamily ? (
                                    <span className="px-2 py-0.5 inline-flex items-center text-[11px] font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                      Oui
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-slate-500 font-medium text-[11px]">
                                      Non
                                    </span>
                                  )}
                                </td>
                                {/* 4. Réduction */}
                                <td className="px-4 py-3.5 text-center text-gray-700 dark:text-slate-300">
                                  {reductionAmount > 0 ? (
                                    <span className="px-2 py-0.5 inline-flex items-center text-[11px] font-bold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                      -{reductionAmount.toLocaleString()} {currency} {reductionPercent > 0 ? `(-${reductionPercent}%)` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 dark:text-slate-500 font-medium text-[11px]">
                                      Aucune
                                    </span>
                                  )}
                                </td>
                                {/* 5. Frais d'écolage */}
                                <td className="px-4 py-3.5 text-right font-medium text-gray-700 dark:text-slate-300">
                                  {baseTuition.toLocaleString()} {currency}
                                </td>
                                {/* 6. Montant Payé */}
                                <td className="px-4 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                  {p.amountPaid.toLocaleString()} {currency}
                                </td>
                                {/* 7. Solde Restant */}
                                <td className={`px-4 py-3.5 text-right font-bold ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
                                  {balance.toLocaleString()} {currency}
                                </td>
                                {/* 8. Frais Totaux */}
                                <td className="px-4 py-3.5 text-right font-bold text-gray-800 dark:text-slate-200">
                                  {p.totalFees.toLocaleString()} {currency}
                                </td>
                                {/* 9. Statut */}
                                <td className="px-4 py-3.5 text-center">
                                  <span className={`px-2.5 py-1 inline-flex items-center text-[11px] font-bold rounded-full ${status.className}`}>
                                    {status.icon}
                                    {status.text}
                                  </span>
                                </td>
                                {/* 10. Action */}
                                <td className="px-4 py-3.5 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button 
                                      onClick={() => handlePrintReceipt(p)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 bg-[#1F4A59]/10 hover:bg-[#1F4A59]/20 text-[#1F4A59] dark:text-sky-300 rounded-lg text-xs font-semibold transition-colors"
                                      title="Aperçu et impression du reçu de caisse"
                                    >
                                      <PrinterIcon />
                                      <span className="hidden sm:inline">Aperçu & Reçu</span>
                                    </button>
                                    <button 
                                      onClick={() => handleDownloadReceiptPDF(p)}
                                      className="p-1.5 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                                      title="Télécharger le reçu (PDF)"
                                    >
                                      <FileDownloadIcon className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* MODE LISTE GLOBALE CONTINUE */
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700 text-xs">
              <thead className="bg-gray-50 dark:bg-slate-900/60">
                <tr>
                  <th className="px-4 py-3.5 text-left font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Élève</th>
                  <th className="px-4 py-3.5 text-left font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Classe</th>
                  <th className="px-4 py-3.5 text-center font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Famille nombreuse</th>
                  <th className="px-4 py-3.5 text-center font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Réduction</th>
                  <th className="px-4 py-3.5 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Frais d'écolage</th>
                  <th className="px-4 py-3.5 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Montant Payé</th>
                  <th className="px-4 py-3.5 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Solde Restant</th>
                  <th className="px-4 py-3.5 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Frais Totaux</th>
                  <th className="px-4 py-3.5 text-center font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3.5 text-right font-bold text-gray-600 dark:text-slate-300 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-8 text-center text-sm text-gray-500 italic">
                      Aucun paiement trouvé pour les filtres sélectionnés.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((p) => {
                    const balance = p.totalFees - p.amountPaid;
                    const status = getStatusBadge(p.totalFees, p.amountPaid);
                    const baseTuition = p.baseTuition || p.totalFees;
                    const reductionAmount = Math.max(0, baseTuition - p.totalFees);
                    const reductionPercent = baseTuition > 0 ? Math.round((reductionAmount / baseTuition) * 100) : 0;
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors">
                        {/* 1. Élève */}
                        <td className="px-4 py-4 whitespace-nowrap font-bold text-gray-900 dark:text-slate-100">
                          <div>{p.name}</div>
                          <div className="text-xs text-gray-500 dark:text-slate-400 font-mono font-normal">{p.studentId}</div>
                        </td>
                        {/* 2. Classe */}
                        <td className="px-4 py-4 whitespace-nowrap text-gray-600 dark:text-slate-300 font-medium">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold">
                            {p.class}
                          </span>
                        </td>
                        {/* 3. Famille nombreuse */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          {p.isLargeFamily ? (
                            <span className="px-2.5 py-1 inline-flex items-center text-xs font-bold rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              Oui
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500 text-xs font-medium">
                              Non
                            </span>
                          )}
                        </td>
                        {/* 4. Réduction */}
                        <td className="px-4 py-4 whitespace-nowrap text-center text-gray-700 dark:text-slate-300 text-xs font-medium">
                          {reductionAmount > 0 ? (
                            <span className="px-2.5 py-1 inline-flex items-center text-xs font-bold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              -{reductionAmount.toLocaleString()} {currency} {reductionPercent > 0 ? `(-${reductionPercent}%)` : ''}
                            </span>
                          ) : (
                            <span className="text-gray-400 dark:text-slate-500 text-xs font-medium">
                              Aucune
                            </span>
                          )}
                        </td>
                        {/* 5. Frais d'écolage */}
                        <td className="px-4 py-4 whitespace-nowrap text-right font-medium text-gray-700 dark:text-slate-300">
                          {baseTuition.toLocaleString()} {currency}
                        </td>
                        {/* 6. Montant Payé */}
                        <td className="px-4 py-4 whitespace-nowrap text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {p.amountPaid.toLocaleString()} {currency}
                        </td>
                        {/* 7. Solde Restant */}
                        <td className={`px-4 py-4 whitespace-nowrap text-right font-bold ${balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-400'}`}>
                          {balance.toLocaleString()} {currency}
                        </td>
                        {/* 8. Frais Totaux */}
                        <td className="px-4 py-4 whitespace-nowrap text-right font-bold text-gray-800 dark:text-slate-200">
                          {p.totalFees.toLocaleString()} {currency}
                        </td>
                        {/* 9. Statut */}
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className={`px-2.5 py-1 inline-flex items-center text-xs font-bold rounded-full ${status.className}`}>
                            {status.icon}
                            {status.text}
                          </span>
                        </td>
                        {/* 10. Action */}
                        <td className="px-4 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => handlePrintReceipt(p)} 
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F4A59] hover:bg-[#2c5a6e] text-white rounded-lg text-xs font-semibold transition-colors shadow-xs"
                              title="Aperçu et impression du reçu de caisse"
                            >
                              <PrinterIcon />
                              <span>Reçu</span>
                            </button>
                            <button 
                              onClick={() => handleDownloadReceiptPDF(p)} 
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                              title="Télécharger le reçu (PDF)"
                            >
                              <FileDownloadIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal for Payment Form & Receipt Preview */}
      <Modal 
        isOpen={paymentModalState !== 'closed'} 
        onClose={() => setPaymentModalState('closed')} 
        title={paymentModalState === 'form' ? "Enregistrer un Paiement" : "Aperçu du Reçu de Caisse"}
        size={paymentModalState === 'form' ? 'lg' : '4xl'}
      >
        {paymentModalState === 'form' && (
          <PaymentForm
            users={users}
            classes={classes}
            payments={payments}
            onSave={handleSaveAndShowReceipt}
            onCancel={() => setPaymentModalState('closed')}
            currency={currency}
          />
        )}
        {paymentModalState === 'receipt' && transactionForReceipt && (
          <Receipt 
            transaction={transactionForReceipt} 
            onClose={() => setPaymentModalState('closed')} 
            schoolSettings={schoolSettings}
          />
        )}
      </Modal>
    </div>
  );
};

export default PaymentsPage;

