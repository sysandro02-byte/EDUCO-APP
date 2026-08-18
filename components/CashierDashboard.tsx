import { useGoogleLogin } from "@react-oauth/google";
import React, { useState, useMemo, useEffect } from 'react';
import { DashboardStatCard, QuickActionsCard } from './Dashboard';
import Modal from './Modal';
import PaymentForm from './PaymentForm';
import UserForm, { User } from './UserForm';
import Receipt from './Receipt';
import SalaryPaymentForm, { SalaryPaymentData } from './SalaryPaymentForm';
import Payslip from './Payslip';
import { SalaryAnalytics } from './SalaryAnalytics';
import { studentPaymentsData } from '../constants';
import { Class } from './ClassForm';
import { Fee } from './FeeForm';
import { Transaction, Personnel, RafSettings, SchoolSettings, SinglePaymentData, SalaryPaymentData as AppSalaryPaymentData } from '../App';
import WeeklyAttendanceChartCard from './WeeklyAttendanceChartCard';
import { 
  AlertCircle, CheckCircle2, TrendingDown, UserX, GraduationCap, Clock, 
  Calendar as CalendarIcon, ArrowRight, Edit3, Lock, ShieldCheck,
  Search, Filter, RotateCcw, FileText, Printer, TrendingUp, Wallet, 
  DollarSign, Check, Calculator, AlertTriangle, FileSpreadsheet, History, 
  User as UserIcon, ArrowRightLeft, ShieldAlert, Plus, RefreshCw, Send, Save, Share2, Camera
} from 'lucide-react';

type Payment = typeof studentPaymentsData[0];

interface CashierDashboardProps {
  setActivePage: (page: string) => void;
  handleSaveSinglePayment: (paymentData: SinglePaymentData) => Transaction | null;
  handleSaveUser: (user: User) => void;
  handlePaySalary: (personnelId: number, paymentData: AppSalaryPaymentData) => Transaction | null;
  transactions: Transaction[];
  payments: Payment[];
  users: User[];
  classes: Class[];
  fees: Fee[];
  personnel: Personnel[];
  attendance?: any[];
  financialEvents?: any[];
  rafSettings: RafSettings;
  schoolSettings: SchoolSettings;
  isCaisseOpen: boolean;
  currentUserRole?: string;
  onEditTransaction?: (transactionId: string, updatedData: Partial<Transaction>) => void;
  cashierSettings?: any;
  communicationSettings?: any;
  onSaveCommunicationSettings?: (settings: any) => void;
}

interface CashierReport {
  id: string;
  date: string;
  time: string;
  cashierName: string;
  openingCash: number;
  totalCashRevenue: number;
  totalMobileMoneyRevenue: number;
  totalExpenses: number;
  expectedCash: number;
  physicalCash: number;
  discrepancy: number;
  transactionCount: number;
  notes: string;
}

const CashierDashboard: React.FC<CashierDashboardProps> = ({ 
    setActivePage, handleSaveSinglePayment, handleSaveUser, handlePaySalary,
    transactions, payments, users, classes, fees, personnel, attendance = [], financialEvents = [],
    rafSettings, schoolSettings, isCaisseOpen, currentUserRole, onEditTransaction,
    cashierSettings
}) => {
  // Navigation Tabs inside Dashboard
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'reports' | 'salaries'>('overview');

  // Modal States
  const [paymentModalState, setPaymentModalState] = useState<'closed' | 'form' | 'receipt'>('closed');
  const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
  const [isSalaryPaymentModalOpen, setIsSalaryPaymentModalOpen] = useState(false);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isEncaissementModalOpen, setIsEncaissementModalOpen] = useState(false);
  const [isDailyReportOpen, setIsDailyReportOpen] = useState(false);
  const [transactionForReceipt, setTransactionForReceipt] = useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Search & Filter States for Transactions tab
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'Tous' | 'Revenu' | 'Dépense'>('Tous');
  const [filterCategory, setFilterCategory] = useState<string>('Tous');
  const [filterMethod, setFilterMethod] = useState<string>('Tous');
  const [filterDatePreset, setFilterDatePreset] = useState<'all' | 'today' | 'week'>('all');

  // Cash Reconciliation & Closing Session States
  const [openingCash, setOpeningCash] = useState<number>(10000); // Default standard opening fund
  const [notes, setNotes] = useState('');
  
  // Bill Counting Tool (West African Francs - FCFA Denominations)
  const [bill10000, setBill10000] = useState<number>(0);
  const [bill5000, setBill5000] = useState<number>(0);
  const [bill2000, setBill2000] = useState<number>(0);
  const [bill1000, setBill1000] = useState<number>(0);
  const [bill500, setBill500] = useState<number>(0);
  const [coin250, setCoin250] = useState<number>(0);
  const [coin100, setCoin100] = useState<number>(0);
  const [coin50, setCoin50] = useState<number>(0);
  const [coin25, setCoin25] = useState<number>(0);
  const [coin10, setCoin10] = useState<number>(0);
  const [coin5, setCoin5] = useState<number>(0);
  const [coin1, setCoin1] = useState<number>(0);

  // Calculated physical cash count based on bill counting tool or direct input override
  const [useBillCounter, setUseBillCounter] = useState(true);
  const [manualPhysicalCash, setManualPhysicalCash] = useState<number>(0);

  // Saved Session Reports
  const [savedReports, setSavedReports] = useState<CashierReport[]>([]);

  // Load Saved Reports from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cashier_session_reports');
      if (stored) {
        setSavedReports(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load cashier reports", e);
    }
  }, []);

  const physicalCashCounted = useMemo(() => {
    if (useBillCounter) {
      return (
        bill10000 * 10000 +
        bill5000 * 5000 +
        bill2000 * 2000 +
        bill1000 * 1000 +
        bill500 * 500 +
        coin250 * 250 +
        coin100 * 100 +
        coin50 * 50 +
        coin25 * 25 +
        coin10 * 10 +
        coin5 * 5 +
        coin1 * 1
      );
    }
    return manualPhysicalCash;
  }, [
    useBillCounter, manualPhysicalCash,
    bill10000, bill5000, bill2000, bill1000, bill500,
    coin250, coin100, coin50, coin25, coin10, coin5, coin1
  ]);

  const resetBillCounter = () => {
    setBill10000(0);
    setBill5000(0);
    setBill2000(0);
    setBill1000(0);
    setBill500(0);
    setCoin250(0);
    setCoin100(0);
    setCoin50(0);
    setCoin25(0);
    setCoin10(0);
    setCoin5(0);
    setCoin1(0);
    setManualPhysicalCash(0);
  };

  const isRAFOrDG = currentUserRole === 'Responsable des finances' || currentUserRole === 'Promoteur' || currentUserRole === 'Admin';

  const handleAttemptEdit = (t: Transaction) => {
    if (!isRAFOrDG) {
      alert("Accès refusé : Seul le Responsable des Affaires Financières (RAF) ou le Directeur Général (DG) a le droit de modifier une transaction enregistrée.\n\nEn tant que caissière, vous pouvez uniquement saisir et modifier les montants des versements lors de l'encaissement selon les tarifs du RAF.");
      return;
    }
    setEditingTransaction(t);
  };

  const driveLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      if (!transactionForReceipt) return;

      const receiptContent = `
        RECU DE PAIEMENT - ${schoolSettings.name}
        Transaction ID: ${transactionForReceipt.id}
        Date: ${new Date(transactionForReceipt.date).toLocaleString('fr-FR')}
        Description: ${transactionForReceipt.description}
        Montant: ${transactionForReceipt.amount} ${schoolSettings.currency}
      `;

      try {
        const metadata = {
          name: `Recu_${transactionForReceipt.id}.txt`,
          mimeType: 'text/plain',
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', new Blob([receiptContent], { type: 'text/plain' }));

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
           method: 'POST',
           headers: {
             'Authorization': `Bearer ${token}`
           },
           body: form
        });

        if (res.ok) {
           alert("Reçu exporté vers Google Drive avec succès !");
        } else {
           console.error(await res.text());
           alert("Erreur lors de l'export.");
        }
      } catch(e) {
        console.error(e);
      }
    },
    scope: 'https://www.googleapis.com/auth/drive.file',
  });
  
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);

  const dailyTransactions = useMemo(() => {
    return (transactions || []).filter(t => {
      if (!t.date) return false;
      const tDate = new Date(t.date).toISOString().split('T')[0];
      return tDate === reportDate;
    });
  }, [transactions, reportDate]);

  const dailyRevenue = useMemo(() => {
    return dailyTransactions
      .filter(t => t.type === 'Revenu' && t.status === 'Approuvé')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);

  const dailyExpense = useMemo(() => {
    return dailyTransactions
      .filter(t => t.type === 'Dépense' && t.status === 'Approuvé')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [dailyTransactions]);
  
  const handlePrintDailyReport = () => {
    const printContent = document.getElementById('daily-report-content');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Rapport Journalier de Caisse</title>');
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write('<style>@media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; } } @page { size: A4; margin: 10mm; }</style>');
      printWindow.document.write('</head><body class="p-8 bg-white">');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };
  const [payslipData, setPayslipData] = useState<{ personnel: Personnel, netAmount: number, paymentDetails: any } | null>(null);
  const currency = schoolSettings.currency;

  const handleSaveAndShowReceipt = (paymentData: SinglePaymentData) => {
    const newTransaction = handleSaveSinglePayment(paymentData);
    if (newTransaction) {
        setTransactionForReceipt(newTransaction);
        setPaymentModalState('receipt');
    } else {
        setPaymentModalState('closed');
        alert("Erreur: L'élève sélectionné n'a pas été trouvé.");
    }
  };

  const onSaveRegistration = (userToSave: User) => {
    handleSaveUser(userToSave);
    setIsRegistrationModalOpen(false);
  };
  
  const onSaveSalary = (salaryData: SalaryPaymentData) => {
      const appSalaryData = { netAmount: salaryData.netAmount, details: { primes: salaryData.primes, deductions: salaryData.deductions }};
      const newTransaction = handlePaySalary(salaryData.personnel.id!, appSalaryData);
      if (newTransaction) {
          setPayslipData({ 
              personnel: salaryData.personnel, 
              netAmount: salaryData.netAmount,
              paymentDetails: { primes: salaryData.primes, deductions: salaryData.deductions, allowance: 0 }
          });
          setIsSalaryPaymentModalOpen(false);
          setIsPayslipModalOpen(true);
      } else {
          setIsSalaryPaymentModalOpen(false);
          alert("Une erreur est survenue lors de la création de la transaction de salaire.");
      }
  };


  const financialStats = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Collectes du jour
    const todayRevenue = (transactions || [])
      .filter(t => t.type === 'Revenu' && t.status === 'Approuvé' && new Date(t.date).getTime() >= today)
      .reduce((sum, t) => sum + t.amount, 0);

    // 1) Total Frais Impayés
    const totalUnpaidFees = (payments || []).reduce((sum, p) => sum + Math.max(0, (p.totalFees || 0) - (p.amountPaid || 0)), 0);

    // 2) Total Frais Encaissés
    const totalCollectedFees = (payments || []).reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    // 3) Total des Dépenses (Approuvées)
    const totalExpenses = (transactions || [])
      .filter(t => t.type === 'Dépense' && t.status === 'Approuvé')
      .reduce((sum, t) => sum + t.amount, 0);

    // 4) Total d'élèves qui n'ont pas payé les frais d'écolages (solde restant > 0)
    const unpaidStudentsCount = (payments || []).filter(p => ((p.totalFees || 0) - (p.amountPaid || 0)) > 0).length;

    // 5) Total d'enseignants
    const totalTeachers = (personnel || []).filter(p => p.role === 'Enseignant').length || 
                          (users || []).filter(u => u.role === 'Enseignant').length;

    const pendingTransactions = (transactions || []).filter(t => t.status === 'En attente').length;
    const totalStudents = (users || []).filter(u => u.role === 'Élève').length || payments.length;

    return { 
      todayRevenue, 
      totalUnpaidFees, 
      totalCollectedFees, 
      totalExpenses, 
      unpaidStudentsCount, 
      totalTeachers, 
      pendingTransactions, 
      totalStudents 
    };
  }, [transactions, payments, users, personnel]);

  // Session Statistics for the current day cashier reconciliation
  const sessionStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTXs = (transactions || []).filter(t => t.date && t.date.split('T')[0] === todayStr && t.status === 'Approuvé');
    
    const cashIn = todayTXs
      .filter(t => t.type === 'Revenu' && (t.paymentMethod === 'Espèce' || t.paymentMethod === 'Espèces' || !t.paymentMethod))
      .reduce((sum, t) => sum + t.amount, 0);

    const mobileIn = todayTXs
      .filter(t => t.type === 'Revenu' && t.paymentMethod === 'Mobile Money')
      .reduce((sum, t) => sum + t.amount, 0);

    const otherIn = todayTXs
      .filter(t => t.type === 'Revenu' && t.paymentMethod !== 'Mobile Money' && t.paymentMethod !== 'Espèce' && t.paymentMethod !== 'Espèces' && t.paymentMethod)
      .reduce((sum, t) => sum + t.amount, 0);

    const cashOut = todayTXs
      .filter(t => t.type === 'Dépense') // Expenses are assumed to be physical cash withdrawals from drawer
      .reduce((sum, t) => sum + t.amount, 0);

    const totalIn = cashIn + mobileIn + otherIn;
    const theoreticalCash = openingCash + cashIn - cashOut;
    const discrepancy = physicalCashCounted - theoreticalCash;

    return {
      cashIn,
      mobileIn,
      otherIn,
      totalIn,
      cashOut,
      theoreticalCash,
      discrepancy,
      txCount: todayTXs.length
    };
  }, [transactions, openingCash, physicalCashCounted]);

  // Save/Export official session closure report
  const handleSaveClosureReport = () => {
    if (confirm("Confirmez-vous la clôture de votre caisse et la génération du bordereau officiel de fin de session ?")) {
      const newReport: CashierReport = {
        id: `CLS-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        cashierName: currentUserRole === 'Caissière' ? "Caisse Centrale" : "Superviseur Finance",
        openingCash: openingCash,
        totalCashRevenue: sessionStats.cashIn,
        totalMobileMoneyRevenue: sessionStats.mobileIn,
        totalExpenses: sessionStats.cashOut,
        expectedCash: sessionStats.theoreticalCash,
        physicalCash: physicalCashCounted,
        discrepancy: sessionStats.discrepancy,
        transactionCount: sessionStats.txCount,
        notes: notes || 'Clôture de session quotidienne standard.'
      };

      const updated = [newReport, ...savedReports];
      setSavedReports(updated);
      localStorage.setItem('cashier_session_reports', JSON.stringify(updated));
      alert("Bordereau de Clôture enregistré avec succès dans l'historique ! Vous pouvez maintenant l'imprimer.");
      setNotes('');
      resetBillCounter();
    }
  };

  const handlePrintSpecificReport = (report: CashierReport) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>BORDEREAU DE CLÔTURE DE CAISSE - ${report.id}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print { body { -webkit-print-color-adjust: exact; } }
            @page { size: A4; margin: 15mm; }
          </style>
        </head>
        <body class="p-8 font-sans text-gray-800 bg-white">
          <div class="border-2 border-[#1F4A59] p-6 rounded-2xl max-w-4xl mx-auto space-y-6">
            <!-- Header -->
            <div class="flex justify-between items-start border-b-2 border-slate-200 pb-4">
              <div>
                <h1 class="text-2xl font-black text-[#1F4A59] tracking-tight">${schoolSettings.name || 'Établissement Scolaire'}</h1>
                <p class="text-xs text-gray-500">Service de la Comptabilité & Caisse</p>
                <p class="text-xs text-gray-500">Date d'édition: ${new Date().toLocaleDateString('fr-FR')}</p>
              </div>
              <div class="text-right">
                <span class="px-3 py-1 bg-[#1F4A59]/10 text-[#1F4A59] text-xs font-bold rounded-lg uppercase">Clôture de Caisse</span>
                <p class="text-sm font-bold text-gray-700 mt-2">Bordereau N°: ${report.id}</p>
              </div>
            </div>

            <!-- Meta Data Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
              <div>
                <span class="block text-gray-400 font-medium">Caissier(e) :</span>
                <span class="font-bold text-gray-800">${report.cashierName}</span>
              </div>
              <div>
                <span class="block text-gray-400 font-medium">Date de Session :</span>
                <span class="font-bold text-gray-800">${report.date}</span>
              </div>
              <div>
                <span class="block text-gray-400 font-medium font-semibold">Heure Clôture :</span>
                <span class="font-bold text-gray-800">${report.time}</span>
              </div>
              <div>
                <span class="block text-gray-400 font-medium">Statut :</span>
                <span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">Validé & Clôturé</span>
              </div>
            </div>

            <!-- Financial Summary -->
            <div class="space-y-3">
              <h3 class="text-sm font-bold text-gray-700 border-b pb-1">Réconciliation Financière</h3>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div class="p-3 bg-white border border-slate-200 rounded-lg text-xs">
                  <span class="text-gray-500">Fond d'Ouverture :</span>
                  <p class="text-base font-bold text-gray-800 mt-1">${report.openingCash.toLocaleString()} ${currency}</p>
                </div>
                <div class="p-3 bg-white border border-slate-200 rounded-lg text-xs">
                  <span class="text-emerald-600 font-medium">Recettes Espèces :</span>
                  <p class="text-base font-bold text-emerald-700 mt-1">+${report.totalCashRevenue.toLocaleString()} ${currency}</p>
                </div>
                <div class="p-3 bg-white border border-slate-200 rounded-lg text-xs">
                  <span class="text-emerald-600 font-medium">Recettes Mobile Money :</span>
                  <p class="text-base font-bold text-blue-700 mt-1">+${report.totalMobileMoneyRevenue.toLocaleString()} ${currency}</p>
                </div>
                <div class="p-3 bg-white border border-slate-200 rounded-lg text-xs">
                  <span class="text-rose-600 font-medium">Décaissements (Dépenses) :</span>
                  <p class="text-base font-bold text-rose-700 mt-1">-${report.totalExpenses.toLocaleString()} ${currency}</p>
                </div>
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <span class="text-slate-600 font-semibold">Encaisse Théorique Attendue :</span>
                  <p class="text-base font-bold text-slate-800 mt-1">${report.expectedCash.toLocaleString()} ${currency}</p>
                </div>
                <div class="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                  <span class="text-slate-600 font-semibold">Encaisse Physique Déclarée :</span>
                  <p class="text-base font-bold text-slate-800 mt-1">${report.physicalCash.toLocaleString()} ${currency}</p>
                </div>
              </div>
            </div>

            <!-- Discrepancy Box -->
            <div class="p-4 rounded-xl border ${
              report.discrepancy === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              report.discrepancy > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' :
              'bg-rose-50 border-rose-200 text-rose-800'
            } text-xs">
              <div class="flex justify-between items-center">
                <div>
                  <span class="block font-bold">Analyse d'Écart de Caisse :</span>
                  <p class="mt-1">
                    ${report.discrepancy === 0 ? "Aucun écart détecté. La caisse est parfaitement équilibrée." :
                      report.discrepancy > 0 ? "Surplus de caisse constaté. Des fonds supplémentaires sont présents." :
                      "Manquant de caisse constaté. Un déficit d'espèces est enregistré."
                    }
                  </p>
                </div>
                <div class="text-right">
                  <span class="text-sm font-semibold">Solde d'Écart :</span>
                  <p class="text-lg font-black">${report.discrepancy > 0 ? '+' : ''}${report.discrepancy.toLocaleString()} ${currency}</p>
                </div>
              </div>
            </div>

            <!-- Note section -->
            <div class="text-xs">
              <span class="block font-bold text-gray-700">Notes & Commentaires du Caissier :</span>
              <p class="p-3 bg-slate-50 rounded-lg border mt-1 italic text-gray-600">${report.notes}</p>
            </div>

            <!-- Signature block -->
            <div class="grid grid-cols-2 gap-8 pt-8 text-xs">
              <div class="border-t border-dashed border-slate-400 pt-3 text-center">
                <p class="font-bold text-gray-700">Signature Caissier(e)</p>
                <div class="h-16"></div>
                <p class="text-gray-400">Date et mention "Lu et Approuvé"</p>
              </div>
              <div class="border-t border-dashed border-slate-400 pt-3 text-center">
                <p class="font-bold text-gray-700">Validation Contrôle Financier / RAF</p>
                <div class="h-16"></div>
                <p class="text-gray-400">Date et signature autorisée</p>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            }
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleClearReportHistory = () => {
    if (confirm("Voulez-vous vraiment vider tout l'historique des clôtures de caisse enregistrées localement ?")) {
      localStorage.removeItem('cashier_session_reports');
      setSavedReports([]);
    }
  };

  // Transactions Search & Filtering Logic
  const filteredTransactions = useMemo(() => {
    return (transactions || []).filter(t => {
      // 1) Keyword search
      const keyword = searchQuery.toLowerCase();
      const matchKeyword = !searchQuery || 
        (t.id && t.id.toLowerCase().includes(keyword)) ||
        (t.description && t.description.toLowerCase().includes(keyword)) ||
        (t.category && t.category.toLowerCase().includes(keyword)) ||
        (t.approvedBy && t.approvedBy.toLowerCase().includes(keyword));

      // 2) Type Filter
      const matchType = filterType === 'Tous' || t.type === filterType;

      // 3) Category Filter
      const matchCategory = filterCategory === 'Tous' || t.category === filterCategory;

      // 4) Payment Method Filter
      const matchMethod = filterMethod === 'Tous' || 
        (filterMethod === 'Espèce' && (t.paymentMethod === 'Espèce' || t.paymentMethod === 'Espèces' || !t.paymentMethod)) ||
        (filterMethod === 'Mobile Money' && t.paymentMethod === 'Mobile Money');

      // 5) Date preset filter
      let matchDate = true;
      if (filterDatePreset === 'today') {
        const todayStr = new Date().toISOString().split('T')[0];
        matchDate = t.date && t.date.split('T')[0] === todayStr;
      } else if (filterDatePreset === 'week') {
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
        matchDate = t.date && new Date(t.date).getTime() >= oneWeekAgo;
      }

      return matchKeyword && matchType && matchCategory && matchMethod && matchDate;
    });
  }, [transactions, searchQuery, filterType, filterCategory, filterMethod, filterDatePreset]);

  // Unique categories helper
  const uniqueCategories = useMemo(() => {
    const cats = (transactions || []).map(t => t.category).filter(Boolean) as string[];
    return ['Tous', ...Array.from(new Set(cats))];
  }, [transactions]);

  return (
    <div className="space-y-6">
      
      {/* 3-Zone Top Bar Contract / Header with Sub-tabs for Professional density */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 transition-all">
        {/* Brand/title zone */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-[#1F4A59] dark:bg-sky-500 text-white rounded-xl shadow-inner shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight whitespace-nowrap truncate">Portail Caisse Centrée</h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-450 font-medium whitespace-nowrap truncate">Session Opérationnelle de la Caissière</p>
          </div>
        </div>

        {/* 4-6 Nav links/tabs single line */}
        <div className="flex bg-slate-55 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800/60 w-full lg:w-auto overflow-x-auto whitespace-nowrap scrollbar-none shrink-0">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'overview' ? 'bg-[#1F4A59] text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Tableau de Bord</span>
          </button>
          <button 
            onClick={() => setActiveTab('transactions')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'transactions' ? 'bg-[#1F4A59] text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Journal & Filtres</span>
            {filteredTransactions.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 dark:bg-amber-600 text-white font-black text-[9px] ml-1">
                {filteredTransactions.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'reports' ? 'bg-[#1F4A59] text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Clôture & Bordereaux</span>
          </button>
          <button 
            onClick={() => setActiveTab('salaries')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'salaries' ? 'bg-[#1F4A59] text-white dark:bg-sky-500 dark:text-slate-950 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-700/60'}`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Pilotage Salaires</span>
          </button>
        </div>

        {/* Primary action zone */}
        <div className="flex items-center gap-2 shrink-0 self-end lg:self-auto">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold rounded-full border ${
            isCaisseOpen 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/40' 
              : 'bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/40'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isCaisseOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span>Caisse : {isCaisseOpen ? 'OUVERTE' : 'FERMÉE'}</span>
          </span>
        </div>
      </div>

      {/* Main Container Layer */}
      <div className="relative">
        {/* Overlay Block if cash register is strictly locked/closed */}
        {!isCaisseOpen && (
          <div className="absolute inset-0 bg-slate-100/60 backdrop-blur-xs flex items-center justify-center z-10 rounded-2xl border border-slate-300">
            <div className="text-center p-6 bg-white rounded-xl shadow-xl border border-slate-200 max-w-sm">
              <div className="w-12 h-12 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-200">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-lg text-slate-800">CAISSE VERROUILLÉE</h4>
              <p className="text-xs text-slate-500 mt-2">
                Les heures de session de caisse réglementaires ont expiré ou le RAF a temporairement suspendu la session.
              </p>
              <div className="mt-4 pt-3 border-t">
                <span className="text-[10px] text-gray-400 font-semibold uppercase">Contacter le RAF pour une dérogation</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: OVERVIEW & GENERAL ACTIONS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Left Column: Instant actions for cash operations */}
              <div className="lg:col-span-1">
                <QuickActionsCard 
                  onInscription={() => {
                    if (currentUserRole === 'Caissière' && cashierSettings?.permissions?.allowRegistration === false) {
                      alert("Accès refusé : Le Responsable des finances (RAF) a désactivé votre droit d'inscription de nouveaux élèves.");
                      return;
                    }
                    setIsEncaissementModalOpen(true);
                  }}
                  onPaiement={() => {
                    if (currentUserRole === 'Caissière' && cashierSettings?.permissions?.allowStudentPayment === false) {
                      alert("Accès refusé : Le Responsable des finances (RAF) a désactivé votre droit d'enregistrement des paiements d'écolage.");
                      return;
                    }
                    setPaymentModalState('form');
                  }}
                  onDepense={() => {
                    if (currentUserRole === 'Caissière' && cashierSettings?.permissions?.allowGeneralExpense === false) {
                      alert("Accès refusé : Le Responsable des finances (RAF) a désactivé votre droit d'enregistrement des dépenses de fonctionnement.");
                      return;
                    }
                    setActivePage('Comptabilité');
                  }}
                  onSalaire={() => {
                    if (currentUserRole === 'Caissière' && cashierSettings?.permissions?.allowSalaryPayment === false) {
                      alert("Accès refusé : Le Responsable des finances (RAF) a désactivé votre droit de paiement de salaires.");
                      return;
                    }
                    setIsSalaryPaymentModalOpen(true);
                  }}
                  disabled={!isCaisseOpen}
                />
              </div>

              {/* Right Column: Key visual stats grid */}
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <DashboardStatCard 
                  title="Total Frais Impayés" 
                  value={`${financialStats.totalUnpaidFees.toLocaleString()} ${currency}`} 
                  subtitle="Reste global à recouvrer" 
                  valueColor="text-rose-600 font-extrabold"
                  icon={<AlertCircle className="w-5 h-5 text-rose-500" />}
                  onClick={() => setActivePage('Paiements')}
                />
                <DashboardStatCard 
                  title="Frais Encaissés (Annuel)" 
                  value={`${financialStats.totalCollectedFees.toLocaleString()} ${currency}`} 
                  subtitle="Total des versements perçus" 
                  valueColor="text-emerald-600 font-extrabold"
                  icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  onClick={() => setActivePage('Paiements')}
                />
                <DashboardStatCard 
                  title="Total des Dépenses" 
                  value={`${financialStats.totalExpenses.toLocaleString()} ${currency}`} 
                  subtitle="Charges décaissées approuvées" 
                  valueColor="text-slate-800 font-extrabold"
                  icon={<TrendingDown className="w-5 h-5 text-slate-500" />}
                  onClick={() => setActivePage('Comptabilité')}
                />
                <DashboardStatCard 
                  title="Rapport Débiteurs" 
                  value={`${financialStats.unpaidStudentsCount} / ${financialStats.totalStudents}`} 
                  subtitle="Élèves avec solde débiteur actif" 
                  valueColor="text-amber-600 font-extrabold"
                  icon={<UserX className="w-5 h-5 text-amber-500" />}
                  onClick={() => setActivePage('Paiements')}
                />
                <DashboardStatCard 
                  title="Dépôts du Jour (Session)" 
                  value={`${sessionStats.totalIn.toLocaleString()} ${currency}`} 
                  subtitle="Encaissements de la journée" 
                  valueColor="text-[#1F4A59] font-extrabold"
                  icon={<TrendingUp className="w-5 h-5 text-[#1F4A59]" />}
                />
                <DashboardStatCard 
                  title="Flux de caisse à valider" 
                  value={String(financialStats.pendingTransactions)} 
                  subtitle="Transactions en cours de validation" 
                  valueColor="text-gray-500 font-extrabold"
                  icon={<Clock className="w-5 h-5 text-gray-400" />}
                  onClick={() => setActivePage('Opérations à valider')}
                />
              </div>
            </div>

            {/* Requirement 6: Recharts Weekly Attendance Chart by Class for Cashier / Gestionnaire */}
            <WeeklyAttendanceChartCard
              attendance={attendance}
              classes={classes}
              users={users}
              title="Évolution Hebdomadaire des Présences par Classe (Vue Caisse & Gestion)"
              subtitle="Suivi de l'assiduité des élèves pour le pointage des cantines, transports et effectifs réels"
              userRole="Caissière"
            />

            {/* Middle Section: Financial Schedule Calendar & Quick daily report link */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Daily Shift Status Widget */}
              <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-[#1F4A59] dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 shrink-0" />
                    Synthèse de Caisse Journalière
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Consultez l'historique complet, imprimez le rapport certifié ou vérifiez les pièces comptables du jour.
                  </p>
                </div>
                
                <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Total Espèces :</span>
                    <span className="font-extrabold font-mono text-slate-800 dark:text-slate-200">{sessionStats.cashIn.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Total Mobile Money :</span>
                    <span className="font-extrabold font-mono text-[#1F4A59] dark:text-sky-300">{sessionStats.mobileIn.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-700/60 pt-2.5 mt-2 font-bold text-slate-900 dark:text-slate-100">
                    <span>Flux Net Total :</span>
                    <span className="font-mono">{(sessionStats.cashIn + sessionStats.mobileIn - sessionStats.cashOut).toLocaleString()} {currency}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsDailyReportOpen(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5 shrink-0" />
                    <span>Imprimer</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#1F4A59] hover:bg-[#163844] dark:bg-sky-500 dark:hover:bg-sky-600 text-white dark:text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Réconcilier</span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Deadlines list */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 bg-[#1F4A59]/10 dark:bg-sky-500/10 rounded-xl text-[#1F4A59] dark:text-sky-450 shrink-0">
                      <CalendarIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">Dates Limites & Échéances</h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-450 truncate">Limites de versement des tranches d'écolage</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActivePage('Calendrier des Échéances')}
                    className="flex items-center gap-1 text-xs text-[#1F4A59] hover:text-[#163844] dark:text-sky-400 dark:hover:text-sky-300 font-bold self-start sm:self-auto shrink-0"
                  >
                    <span>Voir tout</span>
                    <ArrowRight className="w-3 h-3 shrink-0" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(financialEvents.length > 0 ? financialEvents.slice(0, 4) : [
                    { id: '1', title: 'Échéance 1ère Tranche Écolage', start: '2026-08-15' },
                    { id: '2', title: 'Virement Salaires - Août 2026', start: '2026-08-28' },
                    { id: '3', title: 'Rentrée Scolaire 2026-2027', start: '2026-09-01' },
                    { id: '4', title: 'Frais de Cantine & Transport T1', start: '2026-09-15' },
                  ]).map((evt: any) => {
                    const eventDate = new Date(evt.start);
                    const formattedDate = isNaN(eventDate.getTime()) ? evt.start : eventDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
                    return (
                      <div key={evt.id} className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-150 dark:border-slate-800/80 flex items-center justify-between text-xs hover:bg-[#1F4A59]/5 dark:hover:bg-slate-800 transition-colors min-w-0">
                        <div className="flex items-center gap-2 overflow-hidden min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#1F4A59] dark:bg-sky-400 shrink-0" />
                          <span className="font-bold text-slate-700 dark:text-slate-300 truncate">{evt.title}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#1F4A59]/10 dark:bg-sky-500/15 text-[#1F4A59] dark:text-sky-300 font-extrabold text-[9px] shrink-0 ml-2 whitespace-nowrap">
                          {formattedDate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Quick overview transaction table */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex justify-between items-center gap-4">
                <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">Mouvements Récents de la caisse</h3>
                <button 
                  onClick={() => setActiveTab('transactions')} 
                  className="text-xs text-[#1F4A59] hover:text-[#163844] dark:text-sky-400 dark:hover:text-sky-300 font-bold flex items-center gap-1 shrink-0"
                >
                  <span>Recherche & Filtres</span>
                  <ArrowRight className="w-3 h-3 shrink-0" />
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-150 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/55">
                      <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description / Tiers</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Catégorie</th>
                      <th className="px-4 py-2.5 text-right text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Montant</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {(transactions || []).slice(0, 5).map((t, idx) => {
                      const isCash = t.paymentMethod === 'Espèce' || t.paymentMethod === 'Espèces' || !t.paymentMethod;
                      return (
                        <tr key={t.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors text-xs text-slate-700 dark:text-slate-300">
                          <td className="px-4 py-3 font-semibold text-slate-900 dark:text-slate-100">{t.id}</td>
                          <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200 max-w-xs truncate">{t.description}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isCash ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/40' : 'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/40'
                            }`}>
                              {isCash ? 'Espèce' : 'Mobile Money'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-medium truncate max-w-[120px]">{t.category || 'N/A'}</td>
                          <td className={`px-4 py-3 text-right font-black text-sm font-mono ${t.type === 'Revenu' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {t.type === 'Revenu' ? '+' : '-'}{t.amount.toLocaleString()} {currency}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2.5 py-0.5 inline-flex text-[10px] font-black rounded-full border ${
                              t.status === 'Approuvé' ? 'bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/35' :
                              t.status === 'En attente' ? 'bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/35' : 'bg-rose-50 text-rose-800 border-rose-100 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/35'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {(!transactions || transactions.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-slate-450">
                          Aucun mouvement à afficher pour le moment.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE TRANSACTION LEDGER & ADVANCED FILTERS */}
        {activeTab === 'transactions' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
            
            {/* Filter controls panel */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-[#1F4A59]" />
                  Filtres de Saisie & Recherche
                </span>
                <button 
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('Tous');
                    setFilterCategory('Tous');
                    setFilterMethod('Tous');
                    setFilterDatePreset('all');
                  }}
                  className="text-[11px] text-[#1F4A59] hover:underline font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  Réinitialiser
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                {/* Keyword search input */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-2.5 text-gray-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ID, description, tiers..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] border-slate-300"
                  />
                </div>

                {/* Filter Type */}
                <div>
                  <select 
                    value={filterType} 
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="w-full py-1.5 px-3 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] border-slate-300 font-semibold"
                  >
                    <option value="Tous">Type : Tous</option>
                    <option value="Revenu">Recettes / Revenus</option>
                    <option value="Dépense">Dépenses / Salaires</option>
                  </select>
                </div>

                {/* Filter Category */}
                <div>
                  <select 
                    value={filterCategory} 
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full py-1.5 px-3 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] border-slate-300"
                  >
                    <option value="Tous">Catégorie : Toutes</option>
                    {uniqueCategories.filter(cat => cat !== 'Tous').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Filter Payment Method */}
                <div>
                  <select 
                    value={filterMethod} 
                    onChange={(e) => setFilterMethod(e.target.value)}
                    className="w-full py-1.5 px-3 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] border-slate-300"
                  >
                    <option value="Tous">Mode : Tous</option>
                    <option value="Espèce">Espèces uniquement</option>
                    <option value="Mobile Money">Mobile Money uniquement</option>
                  </select>
                </div>

                {/* Filter Date Preset */}
                <div>
                  <select 
                    value={filterDatePreset} 
                    onChange={(e) => setFilterDatePreset(e.target.value as any)}
                    className="w-full py-1.5 px-3 text-xs bg-white border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] border-slate-300"
                  >
                    <option value="all">Période : Tout l'historique</option>
                    <option value="today">Aujourd'hui</option>
                    <option value="week">7 derniers jours</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Stats bar on filtered elements */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 bg-[#1F4A59]/5 border border-[#1F4A59]/10 rounded-xl text-xs gap-2">
              <div className="flex gap-4">
                <span>Transactions trouvées : <strong>{filteredTransactions.length}</strong></span>
                <span>Recettes totales : <strong className="text-emerald-700">{filteredTransactions.filter(t => t.type === 'Revenu').reduce((sum, t) => sum + t.amount, 0).toLocaleString()} {currency}</strong></span>
                <span>Dépenses totales : <strong className="text-rose-700">{filteredTransactions.filter(t => t.type === 'Dépense').reduce((sum, t) => sum + t.amount, 0).toLocaleString()} {currency}</strong></span>
              </div>
              
              {/* CSV Export directly here */}
              <button 
                onClick={() => {
                  if (currentUserRole === 'Caissière' && cashierSettings?.permissions?.allowCsvExport === false) {
                    alert("Accès refusé : Le Responsable des finances (RAF) a désactivé votre droit d'exportation des journaux de caisse.");
                    return;
                  }
                  // Run simple csv generation
                  const headers = ['ID', 'Date', 'Description', 'Categorie', 'Type', 'Montant', 'Mode', 'Statut'];
                  const rows = filteredTransactions.map(t => [
                    t.id, t.date, t.description, t.category, t.type, t.amount, 
                    (t.paymentMethod === 'Espèce' || t.paymentMethod === 'Espèces' || !t.paymentMethod) ? 'Espèce' : 'Mobile Money', 
                    t.status
                  ]);
                  const csvContent = "data:text/csv;charset=utf-8," 
                    + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `Journal_Caisse_${new Date().toISOString().split('T')[0]}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-[#1F4A59] hover:bg-[#163844] text-white rounded-md text-[11px] font-black"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exporter en CSV</span>
              </button>
            </div>

            {/* Large full transaction Table */}
            <div className="overflow-x-auto border rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-tight">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-tight">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-tight">Description / Tiers</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-tight">Catégorie</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-tight">Mode</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-tight">Montant</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-tight">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-tight">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-xs text-slate-700">
                  {filteredTransactions.map((t, index) => {
                    const isCash = t.paymentMethod === 'Espèce' || t.paymentMethod === 'Espèces' || !t.paymentMethod;
                    return (
                      <tr key={t.id || index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900">{t.id}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {t.date ? new Date(t.date).toLocaleDateString('fr-FR') : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-800">{t.description}</p>
                          {t.approvedBy && <span className="text-[10px] text-slate-400">Validateur: {t.approvedBy}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{t.category || 'N/A'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isCash ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}>
                            {isCash ? 'Espèce' : 'Mobile Money'}
                          </span>
                        </td>
                        <td className={`px-4 py-3 text-right font-black text-sm ${t.type === 'Revenu' ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === 'Revenu' ? '+' : '-'}{t.amount.toLocaleString()} {currency}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 inline-flex text-[10px] leading-5 font-black rounded-full ${
                            t.status === 'Approuvé' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' :
                            t.status === 'En attente' ? 'bg-amber-50 text-amber-800 border border-amber-100' : 'bg-rose-50 text-rose-800 border border-rose-100'
                          }`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            {/* Receipt button if revenue */}
                            {t.type === 'Revenu' && (
                              <button 
                                onClick={() => {
                                  setTransactionForReceipt(t);
                                  setPaymentModalState('receipt');
                                }}
                                className="px-2 py-1 bg-[#1F4A59]/10 text-[#1F4A59] rounded hover:bg-[#1F4A59]/20 font-bold text-[10px] transition-colors"
                              >
                                Reçu
                              </button>
                            )}

                            {/* RAF Edit restriction check */}
                            {isRAFOrDG ? (
                              <button 
                                onClick={() => handleAttemptEdit(t)}
                                className="inline-flex items-center gap-0.5 px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-bold transition-colors"
                                title="Éditer"
                              >
                                <Edit3 className="w-3 h-3 text-amber-700" />
                                <span>Éditer</span>
                              </button>
                            ) : (
                              <span className="p-1 text-slate-300" title="Modification restreinte au RAF">
                                <Lock className="w-4 h-4 mx-auto" />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                        Aucun mouvement ne correspond aux filtres de recherche actuels.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CASHIER RECONCILIATION & CLOSING SESSION */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            
            {/* Split layout: Calculator vs Past Sessions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Reconciliation Counter & Theory Calculator (Col 1 to 8) */}
              <div className="lg:col-span-8 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
                <div className="border-b pb-3 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[#1F4A59]" />
                  <h3 className="font-bold text-slate-800 text-base">Calculateur de Réconciliation & Clôture</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Left Parameter Inputs */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-tight border-b pb-1">Paramètres de caisse</h4>
                    
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Encaisse de départ (Fond d'ouverture)</label>
                      <div className="relative">
                        <input 
                          type="number"
                          value={openingCash}
                          onChange={(e) => setOpeningCash(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full text-xs font-bold pr-12 pl-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59]"
                        />
                        <span className="absolute right-3 inset-y-0 flex items-center text-slate-400 font-bold text-[10px] pointer-events-none">{currency}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 block mt-1">Montant d'espèces disponible en caisse au début du quart.</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border space-y-3">
                      <span className="text-xs font-bold text-slate-600 block border-b pb-1">Validation Théorique Automatique</span>
                      
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Recettes Espèces (Aujourd'hui) :</span>
                        <span className="font-bold text-emerald-700">+{sessionStats.cashIn.toLocaleString()} {currency}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-semibold">Décaissements (Aujourd'hui) :</span>
                        <span className="font-bold text-rose-700">-{sessionStats.cashOut.toLocaleString()} {currency}</span>
                      </div>
                      <div className="flex justify-between text-xs border-t pt-2 mt-2 font-bold text-slate-800">
                        <span>Solde Espèces Théorique Attendue :</span>
                        <span>{sessionStats.theoreticalCash.toLocaleString()} {currency}</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Observations / Notes de Clôture</label>
                      <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex: Différence de 500 FCFA due à un rendu de monnaie sur scolarité. Pièce justificative signée."
                        rows={3}
                        className="w-full text-xs p-2.5 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59]"
                      />
                    </div>
                  </div>

                  {/* Right Physical Bill Counter Tool (Extremely realistic!) */}
                  <div className="p-4 bg-[#1F4A59]/5 border border-[#1F4A59]/10 rounded-xl space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="text-xs font-bold text-[#1F4A59] uppercase tracking-wider flex items-center gap-1">
                        <Wallet className="w-3.5 h-3.5" />
                        Comptage des Espèces
                      </span>
                      <button 
                        onClick={resetBillCounter}
                        className="text-[10px] text-[#1F4A59] hover:underline font-bold"
                      >
                        Vider les billets
                      </button>
                    </div>

                    <div className="flex gap-4 border-b pb-3">
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                        <input 
                          type="radio" 
                          checked={useBillCounter} 
                          onChange={() => setUseBillCounter(true)} 
                        />
                        <span>Utiliser le compteur</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-slate-700">
                        <input 
                          type="radio" 
                          checked={!useBillCounter} 
                          onChange={() => setUseBillCounter(false)} 
                        />
                        <span>Saisie manuelle directe</span>
                      </label>
                    </div>

                    {useBillCounter ? (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {/* 10 000 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1.5 rounded-lg border">
                          <span className="font-bold text-slate-700">10 000 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">x</span>
                            <input 
                              type="number" 
                              value={bill10000 || ''} 
                              onChange={(e) => setBill10000(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs font-bold"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* 5 000 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1.5 rounded-lg border">
                          <span className="font-bold text-slate-700">5 000 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">x</span>
                            <input 
                              type="number" 
                              value={bill5000 || ''} 
                              onChange={(e) => setBill5000(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs font-bold"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* 2 000 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1.5 rounded-lg border">
                          <span className="font-bold text-slate-700">2 000 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">x</span>
                            <input 
                              type="number" 
                              value={bill2000 || ''} 
                              onChange={(e) => setBill2000(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs font-bold"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* 1 000 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1.5 rounded-lg border">
                          <span className="font-bold text-slate-700">1 000 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">x</span>
                            <input 
                              type="number" 
                              value={bill1000 || ''} 
                              onChange={(e) => setBill1000(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs font-bold"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* 500 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1.5 rounded-lg border">
                          <span className="font-bold text-slate-700">500 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-semibold">x</span>
                            <input 
                              type="number" 
                              value={bill500 || ''} 
                              onChange={(e) => setBill500(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs font-bold"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* Pieces & Monnaie */}
                        <div className="flex justify-between items-center text-xs bg-slate-100 p-1 rounded-lg">
                          <span className="font-bold text-slate-500 text-[10px] uppercase pl-1">Pièces & Monnaie</span>
                        </div>

                        {/* 250 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1 rounded-lg border">
                          <span className="text-gray-700">250 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">x</span>
                            <input 
                              type="number" 
                              value={coin250 || ''} 
                              onChange={(e) => setCoin250(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* 100 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1 rounded-lg border">
                          <span className="text-gray-700">100 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">x</span>
                            <input 
                              type="number" 
                              value={coin100 || ''} 
                              onChange={(e) => setCoin100(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* 50 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1 rounded-lg border">
                          <span className="text-gray-700">50 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">x</span>
                            <input 
                              type="number" 
                              value={coin50 || ''} 
                              onChange={(e) => setCoin50(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* 25 FCFA */}
                        <div className="flex justify-between items-center text-xs bg-white p-1 rounded-lg border">
                          <span className="text-gray-700">25 {currency}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">x</span>
                            <input 
                              type="number" 
                              value={coin25 || ''} 
                              onChange={(e) => setCoin25(Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 p-1 border text-center rounded focus:outline-none text-xs"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Montant global compté physiquement</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={manualPhysicalCash} 
                            onChange={(e) => setManualPhysicalCash(Math.max(0, parseInt(e.target.value) || 0))}
                            className="w-full text-sm font-bold pr-12 pl-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59]"
                            placeholder="0"
                          />
                          <span className="absolute right-3 inset-y-0 flex items-center text-slate-400 font-bold text-[10px] pointer-events-none">{currency}</span>
                        </div>
                      </div>
                    )}

                    {/* Auto-sum Physical Output Display */}
                    <div className="pt-3 border-t flex justify-between items-center text-xs font-bold text-[#1F4A59]">
                      <span>Montant Physique Total :</span>
                      <span className="text-lg font-black">{physicalCashCounted.toLocaleString()} {currency}</span>
                    </div>

                  </div>
                </div>

                {/* Instant Discrepancy Reconciliation Alert Banner */}
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
                  sessionStats.discrepancy === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                  sessionStats.discrepancy > 0 ? 'bg-amber-50 border-amber-200 text-amber-800' :
                  'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  <div className="mt-0.5 shrink-0">
                    {sessionStats.discrepancy === 0 ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> :
                     sessionStats.discrepancy > 0 ? <AlertTriangle className="w-5 h-5 text-amber-600" /> :
                     <ShieldAlert className="w-5 h-5 text-rose-600" />}
                  </div>
                  <div className="flex-1">
                    <span className="font-extrabold block">
                      {sessionStats.discrepancy === 0 ? "Félicitations! Caisse parfaitement équilibrée." :
                       sessionStats.discrepancy > 0 ? "Alerte : Surplus de Caisse détecté." :
                       "Alerte : Manquant de Caisse détecté !"}
                    </span>
                    <p className="mt-1">
                      {sessionStats.discrepancy === 0 ? "Le montant physique recompté correspond exactement au solde théorique de votre journal de caisse." :
                       sessionStats.discrepancy > 0 ? `Vous avez une plus-value physique de ${sessionStats.discrepancy.toLocaleString()} ${currency} par rapport aux écritures d'aujourd'hui. S'il vous plaît, vérifiez s'il n'y a pas un encaissement non enregistré.` :
                       `Il manque ${Math.abs(sessionStats.discrepancy).toLocaleString()} ${currency} dans la caisse physique. S'il vous plaît, contrôlez vos pièces de dépenses ou vérifiez d'éventuels écarts de rendu de monnaie.`}
                    </p>
                    <div className="mt-2 text-[10px] uppercase font-bold">
                      Différence : <span className="font-black text-xs">{sessionStats.discrepancy > 0 ? '+' : ''}{sessionStats.discrepancy.toLocaleString()} {currency}</span>
                    </div>
                  </div>
                </div>

                {/* Primary Report closing trigger */}
                <div className="flex justify-end pt-3 border-t">
                  <button 
                    onClick={handleSaveClosureReport}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-[#1F4A59] hover:bg-[#163844] text-white rounded-lg text-xs font-black shadow-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Sauvegarder & Générer le Bordereau de Caisse</span>
                  </button>
                </div>
              </div>

              {/* Saved Sessions & Report History (Col 9 to 12) */}
              <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                    <History className="w-4 h-4 text-[#1F4A59]" />
                    Historique des Clôtures
                  </span>
                  {savedReports.length > 0 && (
                    <button 
                      onClick={handleClearReportHistory}
                      className="text-[10px] text-rose-600 hover:underline"
                    >
                      Effacer tout
                    </button>
                  )}
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {savedReports.map((rep) => (
                    <div key={rep.id} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border text-xs space-y-2 transition-all">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-900">{rep.id}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border rounded-full font-bold">Signé</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1 font-medium text-[11px] text-slate-500">
                        <div>Date: <strong className="text-slate-800">{rep.date}</strong></div>
                        <div>Heure: <strong className="text-slate-800">{rep.time}</strong></div>
                        <div>Physique: <strong className="text-slate-800">{rep.physicalCash.toLocaleString()} {currency}</strong></div>
                        <div>Écart: <strong className={rep.discrepancy === 0 ? 'text-emerald-700 font-extrabold' : 'text-rose-700 font-extrabold'}>{rep.discrepancy.toLocaleString()}</strong></div>
                      </div>

                      <div className="flex gap-2 pt-2 border-t mt-1">
                        <button
                          onClick={() => handlePrintSpecificReport(rep)}
                          className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-200 text-slate-700 border rounded text-[10px] font-bold"
                        >
                          <Printer className="w-3 h-3 text-slate-500" />
                          <span>Bordereau</span>
                        </button>
                      </div>
                    </div>
                  ))}

                  {savedReports.length === 0 && (
                    <div className="p-8 text-center text-xs text-gray-400 space-y-1.5">
                      <FileText className="w-8 h-8 text-gray-300 mx-auto" />
                      <p>Aucun bordereau de caisse archivé localement.</p>
                      <p className="text-[10px] text-gray-400">Remplissez le formulaire de gauche pour clôturer votre session.</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: PILOTAGE ET ANALYSE DE LA MASSE SALARIALE */}
        {activeTab === 'salaries' && (
          <SalaryAnalytics 
            personnelList={personnel}
            transactions={transactions}
            schoolSettings={schoolSettings}
            rafSettings={rafSettings}
            currentUserRole={currentUserRole}
          />
        )}

      </div>

      {/* MODALS PERSISTED FROM STANDARD FLOW */}
      
      {/* 1) Encaissement selector */}
      <Modal isOpen={isEncaissementModalOpen} onClose={() => setIsEncaissementModalOpen(false)} title="Type d'Encaissement" size="sm">
        <div className="flex flex-col space-y-3 text-xs">
            <button 
              onClick={() => { setIsEncaissementModalOpen(false); setIsRegistrationModalOpen(true); }} 
              className="w-full text-left p-3 bg-gray-100 hover:bg-[#1F4A59]/10 rounded-lg transition-colors font-bold text-slate-800"
            >
              1. Nouvelle Inscription (Créer élève)
            </button>
            <button 
              onClick={() => { setIsEncaissementModalOpen(false); setPaymentModalState('form'); }} 
              className="w-full text-left p-3 bg-gray-100 hover:bg-[#1F4A59]/10 rounded-lg transition-colors font-bold text-slate-800"
            >
              2. Frais d'Écolage / Réinscription (Élève existant)
            </button>
        </div>
      </Modal>

      {/* 2) Payment forms and receipt */}
      <Modal 
        isOpen={paymentModalState !== 'closed'} 
        onClose={() => setPaymentModalState('closed')} 
        title={paymentModalState === 'form' ? "Enregistrer un Paiement" : "Aperçu du Reçu de Paiement"}
        size={paymentModalState === 'form' ? '2xl' : '4xl'}
      >
        {paymentModalState === 'form' && (
          <PaymentForm
            users={users}
            payments={payments}
            onSave={handleSaveAndShowReceipt}
            onCancel={() => setPaymentModalState('closed')}
            currency={currency}
            classes={classes}
            fees={fees}
            currentUserRole={currentUserRole}
          />
        )}
        {paymentModalState === 'receipt' && transactionForReceipt && (
          <div className="flex flex-col">
              <div className="flex justify-end mb-4 pr-4">
                  <button onClick={() => driveLogin()} className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors shadow-sm text-sm font-medium">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.36 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.64-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
                      </svg>
                      <span>Sauvegarder sur Google Drive</span>
                  </button>
              </div>
              <Receipt transaction={transactionForReceipt} onClose={() => setPaymentModalState('closed')} schoolSettings={schoolSettings} />
          </div>
        )}
      </Modal>

      {/* 3) Add new student */}
      <Modal isOpen={isRegistrationModalOpen} onClose={() => setIsRegistrationModalOpen(false)} title="Ajouter un nouvel élève" size="2xl">
        <UserForm 
          user={null}
          onSave={onSaveRegistration}
          onCancel={() => setIsRegistrationModalOpen(false)}
          defaultRole="Élève"
          classes={classes}
          fees={fees}
        />
      </Modal>

      {/* 4) Pay salary */}
      <Modal isOpen={isSalaryPaymentModalOpen} onClose={() => setIsSalaryPaymentModalOpen(false)} title="Payer un Salaire" size="lg">
        <SalaryPaymentForm
          personnelList={personnel}
          users={users}
          payments={payments}
          onSave={onSaveSalary}
          onCancel={() => setIsSalaryPaymentModalOpen(false)}
        />
      </Modal>

      {/* 5) Payslip preview */}
      <Modal isOpen={isPayslipModalOpen} onClose={() => setIsPayslipModalOpen(false)} title={`Aperçu du Bulletin de Paie`} size="4xl">
        {payslipData && (
          <Payslip 
            personnel={payslipData.personnel}
            netAmount={payslipData.netAmount}
            paymentDetails={payslipData.paymentDetails}
            onClose={() => setIsPayslipModalOpen(false)}
            rafSettings={rafSettings}
            schoolSettings={schoolSettings}
          />
        )}
      </Modal>

      {/* 6) Simple daily collections print modal */}
      <Modal isOpen={isDailyReportOpen} onClose={() => setIsDailyReportOpen(false)} title="Rapport Journalier de Caisse" size="4xl">
        <div id="daily-report-content" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-gray-50 p-4 rounded-lg border gap-3 text-xs">
            <div>
              <h4 className="font-bold text-base text-gray-800">{schoolSettings.name || 'Établissement Scolaire'}</h4>
              <p className="text-xs text-gray-500">Rapport de Caisse Journalier</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-gray-700">Date du rapport :</label>
              <input 
                type="date" 
                value={reportDate} 
                onChange={(e) => setReportDate(e.target.value)} 
                className="border rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1F4A59]" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-center">
              <p className="text-xs font-semibold text-green-700">Total Encaissements</p>
              <p className="text-xl font-bold text-green-800 mt-1">{dailyRevenue.toLocaleString()} {currency}</p>
              <p className="text-[10px] text-green-600 mt-1">Revenus approuvés</p>
            </div>
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center">
              <p className="text-xs font-semibold text-red-700">Total Dépenses</p>
              <p className="text-xl font-bold text-red-800 mt-1">{dailyExpense.toLocaleString()} {currency}</p>
              <p className="text-[10px] text-red-600 mt-1">Dépenses approuvées</p>
            </div>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center">
              <p className="text-xs font-semibold text-blue-700">Solde Net du Jour</p>
              <p className="text-xl font-bold text-blue-800 mt-1">{(dailyRevenue - dailyExpense).toLocaleString()} {currency}</p>
              <p className="text-[10px] text-blue-600 mt-1">Encaissements - Dépenses</p>
            </div>
          </div>

          <div>
            <h5 className="font-bold text-gray-800 text-xs mb-3">Détail des mouvements ({reportDate})</h5>
            <div className="overflow-x-auto border rounded-lg max-h-64 overflow-y-auto text-xs">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-xs text-slate-700">
                  {dailyTransactions.map((t, i) => (
                    <tr key={t.id || i} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-slate-900 font-semibold">{t.id}</td>
                      <td className="px-4 py-2 text-slate-800">{t.description}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${t.type === 'Revenu' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {t.type}
                        </span>
                      </td>
                      <td className={`px-4 py-2 text-right font-bold ${t.type === 'Revenu' ? 'text-green-600' : 'text-red-600'}`}>
                        {t.type === 'Revenu' ? '+' : '-'}{t.amount.toLocaleString()} {currency}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          t.status === 'Approuvé' ? 'bg-green-100 text-green-800' :
                          t.status === 'En attente' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {dailyTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                        Aucune transaction enregistrée pour cette date.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t no-print">
            <button
              type="button"
              onClick={() => setIsDailyReportOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handlePrintDailyReport}
              className="px-4 py-2 bg-[#1F4A59] text-white rounded-lg text-xs font-bold hover:bg-[#163642] transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Imprimer le rapport
            </button>
          </div>
        </div>
      </Modal>

      {/* 7) Editing transactions restricted to RAF/DG */}
      <Modal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)} title="✏️ Modification de Transaction (Autorisé RAF & DG)">
        {editingTransaction && (
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const desc = (form.elements.namedItem('description') as HTMLInputElement).value;
              const amt = parseFloat((form.elements.namedItem('amount') as HTMLInputElement).value);
              const cat = (form.elements.namedItem('category') as HTMLSelectElement).value;
              const notes = (form.elements.namedItem('notes') as HTMLTextAreaElement).value;

              if (onEditTransaction) {
                onEditTransaction(editingTransaction.id, { description: desc, amount: amt, category: cat, notes });
              }
              setEditingTransaction(null);
            }} 
            className="space-y-4 text-xs"
          >
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Privilège RAF / DG : Seul le Responsable des Affaires Financières peut modifier cette transaction.</span>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Description / Intitulé *</label>
              <input type="text" name="description" defaultValue={editingTransaction.description} required className="block w-full rounded-md border-gray-300 text-xs focus:ring-[#1F4A59]" />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Montant ({currency}) *</label>
              <input type="number" name="amount" defaultValue={editingTransaction.amount} required min="1" className="block w-full rounded-md border-gray-300 text-xs font-bold text-[#1F4A59] focus:ring-[#1F4A59]" />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Catégorie *</label>
              <select name="category" defaultValue={editingTransaction.category || 'Divers'} className="block w-full rounded-md border-gray-300 text-xs focus:ring-[#1F4A59]">
                <option value="Scolarité">Scolarité</option>
                <option value="Cantine">Cantine</option>
                <option value="Transport">Transport</option>
                <option value="Salaires">Salaires</option>
                <option value="Fournitures">Fournitures</option>
                <option value="Infrastructures">Infrastructures</option>
                <option value="Autres">Autres</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Motif de la modification (Notes RAF)</label>
              <textarea name="notes" defaultValue={editingTransaction.notes || ''} rows={2} className="block w-full rounded-md border-gray-300 text-xs focus:ring-[#1F4A59]" placeholder="Ex: Correction d'imputation ou d'erreur de saisie..." />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button type="button" onClick={() => setEditingTransaction(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-bold">
                Annuler
              </button>
              <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-lg font-bold shadow-sm hover:bg-[#163844]">
                Sauvegarder les modifications (RAF)
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default CashierDashboard;
