import React, { useState, useMemo } from 'react';
import { DashboardStatCard, QuickActionsCard } from './Dashboard';
import RevenueChartCard from './LineChartCard';
import BudgetTracker from './BudgetTracker';
import BudgetCategoryAlerts from './BudgetCategoryAlerts';
import Modal from './Modal';
import BudgetForm from './BudgetForm';
import ExpenseForm from './ExpenseForm';
import UserForm, { User } from './UserForm';
import PaymentForm from './PaymentForm';
import Receipt from './Receipt';
import SalaryPaymentForm, { SalaryPaymentData as SalaryPaymentModalData } from './SalaryPaymentForm';
import Payslip from './Payslip';
import { Transaction, SchoolSettings, RafSettings, SalaryPaymentData, SinglePaymentData } from '../App';
import { personnelData } from '../constants';
import { Class } from './ClassForm';
import { Fee } from './FeeForm';
import ClassFinancialOverview from './ClassFinancialOverview';
import { AlertCircle, CheckCircle2, TrendingDown, UserX, GraduationCap, Clock, TrendingUp } from 'lucide-react';


type Personnel = typeof personnelData[0];
type Payment = { id: number; studentId: string; name: string; class: string; totalFees: number; amountPaid: number; familyId?: number };
type FilterType = 'day' | 'week' | 'month' | 'year';

interface FinanceManagerDashboardProps {
    transactions: Transaction[];
    payments: Payment[];
    users: User[];
    budget?: number;
    budgetObject?: any;
    onUpdateBudget: (newBudget: number) => void;
    currentUserRole: string;
    classes: Class[];
    personnel: Personnel[];
    handlePaySalary: (personnelId: number, paymentData: SalaryPaymentData) => Transaction | null;
    handleSaveExpense: (description: string, amount: number, category: string, justification?: File) => void;
    setActivePage: (page: string) => void;
    handleSaveUser: (user: User) => void;
    handleSaveSinglePayment: (paymentData: SinglePaymentData) => Transaction | null;
    fees: Fee[];
    schoolSettings: SchoolSettings;
    rafSettings: RafSettings;
    communicationSettings?: any;
    onSaveCommunicationSettings?: (settings: any) => void;
}

const FinanceManagerDashboard: React.FC<FinanceManagerDashboardProps> = ({ 
    transactions, payments, budget = 0, budgetObject, onUpdateBudget, currentUserRole,
    classes, personnel, handlePaySalary, handleSaveExpense, setActivePage,
    handleSaveUser, handleSaveSinglePayment, fees, users, schoolSettings, rafSettings
}) => {
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isRegistrationModalOpen, setIsRegistrationModalOpen] = useState(false);
    const [isSalaryPaymentModalOpen, setIsSalaryPaymentModalOpen] = useState(false);
    const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
    const [paymentModalState, setPaymentModalState] = useState<'closed' | 'form' | 'receipt'>('closed');
    const [isEncaissementModalOpen, setIsEncaissementModalOpen] = useState(false);
    
    const [transactionForReceipt, setTransactionForReceipt] = useState<Transaction | null>(null);
    const [payslipData, setPayslipData] = useState<{ personnel: Personnel, netAmount: number, paymentDetails: any } | null>(null);
    const [periodFilter, setPeriodFilter] = useState<FilterType>('week');
    
    const currency = schoolSettings.currency;

    const approvedTransactions = useMemo(() => transactions.filter(t => t.status === 'Approuvé'), [transactions]);

    const filteredTransactions = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(startOfDay);
        startOfWeek.setDate(startOfWeek.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1)); // Monday as start of week
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        return approvedTransactions.filter(t => {
            const transactionDate = new Date(t.date);
            switch (periodFilter) {
                case 'day': return transactionDate >= startOfDay;
                case 'week': return transactionDate >= startOfWeek;
                case 'month': return transactionDate >= startOfMonth;
                case 'year': return transactionDate >= startOfYear;
                default: return true;
            }
        });
    }, [approvedTransactions, periodFilter]);

    const getFilterLabel = () => {
        const labels = { day: 'jour', week: 'semaine', month: 'mois', year: 'année' };
        return labels[periodFilter];
    }

    const totalRevenue = filteredTransactions.filter(t => t.type === 'Revenu').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = filteredTransactions.filter(t => t.type === 'Dépense').reduce((sum, t) => sum + t.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    // 1) Total Frais Impayés
    const totalUnpaidFees = (payments || []).reduce((sum, p) => sum + Math.max(0, (p.totalFees || 0) - (p.amountPaid || 0)), 0);

    // 2) Total Frais Encaissés
    const totalCollectedFees = (payments || []).reduce((sum, p) => sum + (p.amountPaid || 0), 0);

    // 3) Total des Dépenses (Approuvées Globales)
    const totalExpensesApproved = approvedTransactions.filter(t => t.type === 'Dépense').reduce((sum, t) => sum + t.amount, 0);

    // 4) Total d'élèves qui n'ont pas payé les frais d'écolages
    const unpaidStudentsCount = (payments || []).filter(p => ((p.totalFees || 0) - (p.amountPaid || 0)) > 0).length;
    const totalStudentsCount = (users || []).filter(u => u.role === 'Élève').length || (payments || []).length;

    // 5) Total d'enseignants
    const totalTeachers = (personnel || []).filter(p => p.role === 'Enseignant').length || 
                          (users || []).filter(u => u.role === 'Enseignant').length;

    const pendingOperations = transactions.filter(t => t.status === 'En attente').length;
    const averageFee = fees.length > 0 ? fees.filter(f => f.type === 'Scolarité').reduce((sum, f) => sum + f.amount, 0) / fees.filter(f => f.type === 'Scolarité').length : 0;
    
    const handleSaveBudget = (newBudget: number) => {
        onUpdateBudget(newBudget);
        setIsBudgetModalOpen(false);
    };

    const handleSaveNewExpense = (description: string, amount: number, category: string, justification?: File) => {
        handleSaveExpense(description, amount, category, justification);
        setIsExpenseModalOpen(false);
    };
    
    const onSaveRegistration = (userToSave: User) => {
        handleSaveUser(userToSave);
        setIsRegistrationModalOpen(false);
    };

    const handleSaveAndShowReceipt = (paymentData: SinglePaymentData) => {
        const newTransaction = handleSaveSinglePayment(paymentData);
        if (newTransaction) {
            setTransactionForReceipt(newTransaction);
            setPaymentModalState('receipt');
        } else {
            setPaymentModalState('closed');
            alert("Erreur lors de l'enregistrement du paiement.");
        }
    };
    
    const onSaveSalary = (salaryData: SalaryPaymentModalData) => {
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


    const FilterButton: React.FC<{ type: FilterType, label: string }> = ({ type, label }) => (
        <button
            onClick={() => setPeriodFilter(type)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${periodFilter === type ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/80 text-gray-700 hover:bg-white'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-[#1F4A59]">Tableau de Bord</h1>
                <div className="flex items-center gap-1 p-1 bg-gray-200/50 rounded-xl">
                    <FilterButton type="day" label="Jour" />
                    <FilterButton type="week" label="Semaine" />
                    <FilterButton type="month" label="Mois" />
                    <FilterButton type="year" label="Année" />
                </div>
            </div>

            {/* Alerte Budgétaire (Vérification seuil 90%) pour RAF */}
            <BudgetCategoryAlerts
                budget={budgetObject || { total: budget }}
                transactions={transactions}
                currency={currency}
                roleTitle="RAF (Responsable Administratif et Financier)"
                onAdjustBudget={() => setIsBudgetModalOpen(true)}
                onNavigateToReports={() => setActivePage('Rapports Financiers')}
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <QuickActionsCard 
                  onInscription={() => setIsEncaissementModalOpen(true)}
                  onPaiement={() => setPaymentModalState('form')}
                  onDepense={() => setIsExpenseModalOpen(true)}
                  onSalaire={() => setIsSalaryPaymentModalOpen(true)}
                />
              </div>
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* 1) Total Frais Impayés */}
                <DashboardStatCard 
                  title="1) Total Frais Impayés" 
                  value={`${totalUnpaidFees.toLocaleString()} ${currency}`} 
                  subtitle="Somme des soldes restants à recouvrer" 
                  valueColor="text-red-600"
                  icon={<AlertCircle className="w-5 h-5 text-red-500" />}
                  onClick={() => setActivePage('Paiements')} 
                />

                {/* 2) Total Frais Encaissés */}
                <DashboardStatCard 
                  title="2) Total Frais Encaissés" 
                  value={`${totalCollectedFees.toLocaleString()} ${currency}`} 
                  subtitle="Total des versements scolarité perçus" 
                  valueColor="text-emerald-600"
                  icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  onClick={() => setActivePage('Paiements')} 
                />

                {/* 3) Total des Dépenses */}
                <DashboardStatCard 
                  title="3) Total des Dépenses" 
                  value={`${totalExpensesApproved.toLocaleString()} ${currency}`} 
                  subtitle="Dépenses totales approuvées" 
                  valueColor="text-rose-600"
                  icon={<TrendingDown className="w-5 h-5 text-rose-500" />}
                  onClick={() => setActivePage('Comptabilité')} 
                />

                {/* 4) Total d'élèves qui n'ont pas payé les frais d'écolages */}
                <DashboardStatCard 
                  title="4) Élèves avec Frais Impayés" 
                  value={`${unpaidStudentsCount} / ${totalStudentsCount}`} 
                  subtitle="Élèves avec solde d'écolage impayé" 
                  valueColor="text-amber-600"
                  icon={<UserX className="w-5 h-5 text-amber-500" />}
                  onClick={() => setActivePage('Paiements')} 
                />

                {/* 5) Total d'enseignants */}
                <DashboardStatCard 
                  title="5) Total Enseignants" 
                  value={String(totalTeachers)} 
                  subtitle="Enseignants actifs enregistrés" 
                  valueColor="text-indigo-600"
                  icon={<GraduationCap className="w-5 h-5 text-indigo-500" />}
                  onClick={() => setActivePage('Personnel')} 
                />

                {/* KPI contextuel: Période sélectionnée / Opérations */}
                <DashboardStatCard 
                  title={`Flux Période (${getFilterLabel()})`} 
                  value={`${netProfit >= 0 ? '+' : ''}${netProfit.toLocaleString()} ${currency}`} 
                  subtitle={`Revenus: ${totalRevenue.toLocaleString()} | Dépenses: ${totalExpenses.toLocaleString()}`} 
                  valueColor={netProfit >= 0 ? 'text-blue-700' : 'text-rose-600'} 
                  icon={<TrendingUp className="w-5 h-5 text-blue-500" />}
                  onClick={() => setActivePage('Comptabilité')} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <RevenueChartCard transactions={transactions} />
                </div>
                <div className="space-y-6">
                    <BudgetTracker 
                        spent={approvedTransactions.filter(t => t.type === 'Dépense').reduce((acc, t) => acc + t.amount, 0)} 
                        total={budget} 
                        onEdit={() => setIsBudgetModalOpen(true)}
                        currentUserRole={currentUserRole}
                        currency={currency}
                    />
                </div>
            </div>
            
            <div>
                <h2 className="text-2xl font-bold text-gray-800 my-6">Aperçu Financier par Classe</h2>
                <ClassFinancialOverview 
                    payments={payments as any[]}
                    classes={classes}
                    currency={currency}
                />
            </div>


            {/* MODALS */}
            <Modal isOpen={isEncaissementModalOpen} onClose={() => setIsEncaissementModalOpen(false)} title="Type d'Encaissement" size="sm">
                <div className="flex flex-col space-y-3">
                    <button onClick={() => { setIsEncaissementModalOpen(false); setIsRegistrationModalOpen(true); }} className="w-full text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium">Inscription</button>
                    <button onClick={() => { setIsEncaissementModalOpen(false); setPaymentModalState('form'); }} className="w-full text-left p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium">Réinscription / Frais d'écolage</button>
                </div>
            </Modal>
            <Modal isOpen={isBudgetModalOpen} onClose={() => setIsBudgetModalOpen(false)} title="Modifier le Budget Annuel">
                <BudgetForm currentBudget={budget} onSave={handleSaveBudget} onCancel={() => setIsBudgetModalOpen(false)} currency={currency} />
            </Modal>
             <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Enregistrer une Nouvelle Dépense">
                <ExpenseForm onSave={handleSaveNewExpense} onCancel={() => setIsExpenseModalOpen(false)} currency={currency} />
            </Modal>
            <Modal isOpen={isRegistrationModalOpen} onClose={() => setIsRegistrationModalOpen(false)} title="Ajouter un nouvel élève" size="2xl">
                <UserForm user={null} onSave={onSaveRegistration} onCancel={() => setIsRegistrationModalOpen(false)} defaultRole="Élève" classes={classes} fees={fees} />
            </Modal>
            <Modal isOpen={paymentModalState !== 'closed'} onClose={() => setPaymentModalState('closed')} title={paymentModalState === 'form' ? "Enregistrer un nouveau paiement" : "Aperçu du Reçu"} size={paymentModalState === 'form' ? 'lg' : '4xl'}>
                {paymentModalState === 'form' && <PaymentForm users={users} payments={payments} onSave={handleSaveAndShowReceipt} onCancel={() => setPaymentModalState('closed')} currency={currency} classes={classes}/>}
                {paymentModalState === 'receipt' && transactionForReceipt && <Receipt transaction={transactionForReceipt} onClose={() => setPaymentModalState('closed')} schoolSettings={schoolSettings} />}
            </Modal>
            <Modal isOpen={isSalaryPaymentModalOpen} onClose={() => setIsSalaryPaymentModalOpen(false)} title="Payer un Salaire" size="lg">
              <SalaryPaymentForm personnelList={personnel} users={users} payments={payments} onSave={onSaveSalary} onCancel={() => setIsSalaryPaymentModalOpen(false)} />
            </Modal>
            <Modal isOpen={isPayslipModalOpen} onClose={() => setIsPayslipModalOpen(false)} title={`Aperçu du Bulletin de Paie`} size="4xl">
              {payslipData && <Payslip personnel={payslipData.personnel} netAmount={payslipData.netAmount} paymentDetails={payslipData.paymentDetails} onClose={() => setIsPayslipModalOpen(false)} rafSettings={rafSettings} schoolSettings={schoolSettings} />}
            </Modal>
        </div>
    );
};

export default FinanceManagerDashboard;