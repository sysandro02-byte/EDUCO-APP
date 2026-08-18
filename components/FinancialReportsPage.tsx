

import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Cell, PieChart, Pie, AreaChart, Area } from 'recharts';
import { PrinterIcon, FileDownloadIcon, SparklesIcon } from './Icons';
import { FileText, Download, Calendar, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import { Transaction, SchoolSettings, Personnel } from '../App';
import { usersData } from '../constants';
import ClassFinancialOverview from './ClassFinancialOverview'; // New import
import MonthlyOverview from './MonthlyOverview';
import TopDebtorsList from './TopDebtorsList';
import AnnualConsolidatedReport from './AnnualConsolidatedReport';
import { computeAnnualFinancialData, generateAnnualConsolidatedPdf } from '../utils/annualFinancialReportPdf';
import { SalaryAnalytics } from './SalaryAnalytics';

type Payment = { id: number; studentId: string; name: string; class: string; totalFees: number; amountPaid: number; };

// --- SUB-COMPONENT: BudgetComparisonChart ---
const BudgetComparisonChart = ({ budget, transactions, currency } : { budget: any, transactions: Transaction[], currency: string }) => {
  const data = useMemo(() => {
    const spendingByCategory = transactions
      .filter(t => t.type === 'Dépense' && t.status === 'Approuvé')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as {[key: string]: number});

    return (budget?.categories || []).map((cat: {name: string, amount: number}) => ({
      name: cat.name,
      Prévu: cat.amount,
      Réalisé: spendingByCategory[cat.name] || 0,
    }));
  }, [budget, transactions]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border h-[450px]">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Analyse Budgétaire: Prévu vs. Réalisé</h3>
      <ResponsiveContainer width="100%" height="90%">
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={100} tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(value) => `${Number(value) / 1000}k ${currency}`} />
          <Tooltip formatter={(value: number) => `${value.toLocaleString()} ${currency}`} />
          <Legend />
          <Bar dataKey="Prévu" fill="#a7f3d0" name="Budget Prévu" />
          <Bar dataKey="Réalisé" fill="#1F4A59" name="Dépenses Réalisées" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- SUB-COMPONENT: CollectionRateChart ---
const CollectionRateChart = ({ payments, classes } : { payments: Payment[], classes: any[] }) => {
    const data = useMemo(() => {
        return classes.map(c => {
            const paymentsForClass = payments.filter(p => p.class === c.name);
            const totalFees = paymentsForClass.reduce((sum, p) => sum + p.totalFees, 0);
            const totalPaid = paymentsForClass.reduce((sum, p) => sum + p.amountPaid, 0);
            const rate = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;
            return { name: c.name, Taux: rate };
        });
    }, [payments, classes]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border h-[450px]">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Taux de Recouvrement par Classe</h3>
            <ResponsiveContainer width="100%" height="90%">
                 <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => `${value}%`} />
                    <Bar dataKey="Taux" name="Taux de Recouvrement">
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.Taux < 75 ? '#ef4444' : entry.Taux < 90 ? '#f59e0b' : '#22c55e'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

// --- SUB-COMPONENT: ExpensePieChart ---
const COLORS = ['#1F4A59', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const ExpensePieChart = ({ transactions, currency }: { transactions: Transaction[], currency: string }) => {
  const data = useMemo(() => {
    const expenseMap = transactions
      .filter(t => t.type === 'Dépense' && t.status === 'Approuvé')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {} as {[key: string]: number});

    return Object.keys(expenseMap).map(category => ({
      name: category,
      value: expenseMap[category],
    }));
  }, [transactions]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border h-[450px]">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Répartition des Dépenses par Catégorie Budgétaire</h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={130}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${value.toLocaleString()} ${currency}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          Aucune dépense approuvée enregistrée.
        </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENT: PaymentMethodPieChart ---
const PaymentMethodPieChart = ({ transactions, currency }: { transactions: Transaction[], currency: string }) => {
  const data = useMemo(() => {
    const methodMap = transactions
      .filter(t => t.type === 'Revenu' && t.status === 'Approuvé')
      .reduce((acc, t) => {
        const method = t.paymentMethod || 'Autre';
        acc[method] = (acc[method] || 0) + t.amount;
        return acc;
      }, {} as {[key: string]: number});

    return Object.keys(methodMap).map(method => ({
      name: method,
      value: methodMap[method],
    }));
  }, [transactions]);

  const METHOD_COLORS: Record<string, string> = {
    'Espèce': '#10b981',      // Emerald
    'Mobile Money': '#f59e0b', // Amber
    'Autre': '#3b82f6'         // Blue
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border h-[450px]">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Répartition des Revenus par Mode de Paiement</h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={130}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={METHOD_COLORS[entry.name] || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number) => `${value.toLocaleString()} ${currency}`} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-64 text-gray-500">
          Aucun revenu approuvé enregistré.
        </div>
      )}
    </div>
  );
};

// --- SUB-COMPONENT: RevenueExpenseAreaChart ---
const RevenueExpenseAreaChart = ({ transactions, currency }: { transactions: Transaction[], currency: string }) => {
  const data = useMemo(() => {
    const monthlyData: Record<string, { month: string; revenus: number; depenses: number }> = {};
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    
    months.forEach(m => {
        monthlyData[m] = { month: m, revenus: 0, depenses: 0 };
    });

    transactions.filter(t => t.status === 'Approuvé').forEach(t => {
      const date = new Date(t.date);
      const monthLabel = months[date.getMonth()];
      if (t.type === 'Revenu') {
        monthlyData[monthLabel].revenus += t.amount;
      } else if (t.type === 'Dépense') {
        monthlyData[monthLabel].depenses += t.amount;
      }
    });

    // Academic year order
    const academicOrder = ['Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû'];
    return academicOrder.map(m => monthlyData[m]);
  }, [transactions]);

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border h-[450px]">
      <h3 className="text-xl font-bold text-gray-800 mb-4">Corrélation Mensuelle (Revenus vs Dépenses)</h3>
      <ResponsiveContainer width="100%" height="90%">
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="month" />
          <YAxis />
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <Tooltip formatter={(value: number) => `${value.toLocaleString()} ${currency}`} />
          <Legend />
          <Area type="monotone" dataKey="revenus" name="Revenus" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenus)" />
          <Area type="monotone" dataKey="depenses" name="Dépenses" stroke="#ef4444" fillOpacity={1} fill="url(#colorDepenses)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

// --- SUB-COMPONENT: FinancialForecasts ---
const FinancialForecasts = ({ transactions, payments, users, currency } : { transactions: Transaction[], payments: Payment[], users: any[], currency: string }) => {
    const [loading, setLoading] = useState(false);
    const [forecast, setForecast] = useState('');
    
    const totalRevenue = transactions.filter(t => t.type === 'Revenu' && t.status === 'Approuvé').reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'Dépense' && t.status === 'Approuvé').reduce((sum, t) => sum + t.amount, 0);
    const unpaidFees = payments.reduce((sum, p) => sum + (p.totalFees - p.amountPaid), 0);
    const studentCount = users.filter(u => u.role === 'Élève').length;

    const simulationLoss = unpaidFees * 0.10;

    const generateForecast = async () => {
        setLoading(true);
        setForecast('');
        try {
            const prompt = `En tant qu'analyste financier pour une école, analyse les données suivantes (devise: ${currency}):
- Revenus annuels actuels : ${totalRevenue.toLocaleString()}
- Dépenses annuelles actuelles : ${totalExpenses.toLocaleString()}
- Total des frais de scolarité impayés : ${unpaidFees.toLocaleString()}
- Nombre total d'élèves : ${studentCount}

Fournis une brève prévision financière pour le prochain trimestre. Mets en évidence 1 à 2 risques potentiels et 1 à 2 opportunités. Le ton doit être professionnel et concis. Formate la réponse en utilisant des titres et des listes à puces.`;

            const res = await fetch('/api/ai/groq/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            setForecast(data.text.replace(/\*/g, '•'));
        } catch (error: any) {
            console.error("Error generating forecast:", error);
            const errStr = String(error?.message || error);
            if (errStr.includes('resource_exhausted') || errStr.includes('quota') || errStr.includes('429')) {
                setForecast(`• **Résumé Analytique (Mode Hors-Ligne - Quota API Dépassé)** :\n• Revenus actuels : ${totalRevenue.toLocaleString()} ${currency}\n• Dépenses actuelles : ${totalExpenses.toLocaleString()} ${currency}\n• Impayés globaux : ${unpaidFees.toLocaleString()} ${currency}\n• **Risque principal** : Un taux d'impayés élevé nécessite de renforcer les relances de paiement.\n• **Opportunité** : Optimiser la gestion des catégories budgétaires pour dégager un excédent net.`);
            } else {
                setForecast("Une erreur est survenue lors de la génération des prévisions. Veuillez vérifier la configuration de l'API.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-md border">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Prévisions et Simulations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-semibold text-gray-700 mb-2">🤖 Prévisions par IA</h4>
                    <button onClick={generateForecast} disabled={loading} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-indigo-400">
                        {loading ? 'Génération en cours...' : "Générer des prévisions avec l'IA"}
                    </button>
                    {forecast && (
                        <div className="mt-4 p-3 bg-indigo-50 rounded-md text-sm text-gray-800 whitespace-pre-wrap font-sans">
                            {forecast}
                        </div>
                    )}
                </div>
                 <div className="p-4 bg-gray-50 rounded-lg border">
                    <h4 className="font-semibold text-gray-700 mb-2">🔍 Simulation de Perte</h4>
                    <p className="text-sm text-gray-600">
                        Si <strong>10%</strong> des frais actuellement impayés ne sont pas recouvrés, la perte estimée serait de :
                    </p>
                    <p className="text-2xl font-bold text-red-600 mt-2">{simulationLoss.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}</p>
                </div>
            </div>
        </div>
    );
};


interface FinancialReportsPageProps {
    transactions: Transaction[];
    payments: any[];
    budget: any;
    classes: any[];
    users: any[];
    personnel: Personnel[];
    schoolSettings: SchoolSettings;
}

const FinancialReportsPage: React.FC<FinancialReportsPageProps> = ({ transactions, payments, budget, classes, users, personnel, schoolSettings }) => {
    const [activeTab, setActiveTab] = useState('consolidated_annual');
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiReportContent, setAiReportContent] = useState('');
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfYear, setPdfYear] = useState<number>(new Date().getFullYear());
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const currency = schoolSettings.currency;

    const approvedTransactions = useMemo(() => transactions.filter(t => t.status === 'Approuvé'), [transactions]);

    const handleQuickDownloadPdf = (yearToDownload?: number) => {
        const targetYear = yearToDownload || pdfYear || new Date().getFullYear();
        setIsGeneratingPdf(true);
        try {
            const data = computeAnnualFinancialData(
                transactions, 
                payments, 
                targetYear, 
                schoolSettings.academicYear || `${targetYear}-${targetYear + 1}`
            );
            generateAnnualConsolidatedPdf(data, schoolSettings);
            setIsPdfModalOpen(false);
        } catch (err) {
            console.error('Erreur génération PDF:', err);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('financial-report-content');
        if (!printContent) return;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Rapport & Analyse Financière</title>');
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

    const handleExportCSV = () => {
        const headers = ["Date", "Description", "Catégorie", "Type", "Montant", "Statut", "Approuvé Par"];
        const csvRows = [
            headers.join(','),
            ...approvedTransactions.map(t => {
                const row = [
                    new Date(t.date).toLocaleDateString('fr-FR'),
                    `"${t.description.replace(/"/g, '""')}"`,
                    t.category,
                    t.type,
                    t.amount,
                    t.status,
                    `"${(t.approvedBy || 'Direction / RAF').replace(/"/g, '""')}"`
                ];
                return row.join(',');
            })
        ];

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'journal_transactions.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const generateAiReport = async () => {
        setIsAiModalOpen(true);
        setIsAiLoading(true);
        setAiReportContent('');

        const totalRevenue = approvedTransactions.filter(t => t.type === 'Revenu').reduce((sum, t) => sum + t.amount, 0);
        const totalExpenses = approvedTransactions.filter(t => t.type === 'Dépense').reduce((sum, t) => sum + t.amount, 0);
        const unpaidFees = payments.reduce((sum, p) => sum + (p.totalFees - p.amountPaid), 0);
        const collectionRate = (payments.reduce((sum, p) => sum + p.amountPaid, 0) / payments.reduce((sum, p) => sum + p.totalFees, 1)) * 100;

        try {

            const prompt = `En tant qu'analyste financier expert pour un établissement scolaire, génère un rapport stratégique basé sur les données suivantes (devise: ${currency}):
            - Revenus totaux (approuvés): ${totalRevenue.toLocaleString()}
            - Dépenses totales (approuvées): ${totalExpenses.toLocaleString()}
            - Bénéfice net: ${(totalRevenue - totalExpenses).toLocaleString()}
            - Budget total annuel: ${budget.total.toLocaleString()}
            - Dépenses par rapport au budget: ${((totalExpenses / budget.total) * 100).toFixed(2)}%
            - Total des frais de scolarité impayés: ${unpaidFees.toLocaleString()}
            - Taux de recouvrement global: ${collectionRate.toFixed(2)}%

            Le rapport doit inclure les sections suivantes, formatées en Markdown:
            1. **Résumé Exécutif:** Un aperçu de la santé financière actuelle.
            2. **Analyse de la Performance:** Points forts et points faibles (ex: rentabilité, gestion des dépenses, recouvrement).
            3. **Identification des Risques:** Quels sont les 2-3 principaux risques financiers (ex: dépassement budgétaire, faible recouvrement, etc.)?
            4. **Recommandations Stratégiques:** Propose 2-3 actions concrètes pour améliorer la situation (ex: optimiser les dépenses, améliorer le suivi des paiements, etc.).

            Le ton doit être professionnel, concis et orienté vers l'action.`;
            
            const res = await fetch('/api/ai/gemini/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });
            const data = await res.json();
            
            if (data.error) throw new Error(data.error);
            setAiReportContent(data.text);

        } catch (error: any) {
            console.error("Erreur lors de la génération du rapport IA:", error);
            const errStr = String(error?.message || error);
            if (errStr.includes('resource_exhausted') || errStr.includes('quota') || errStr.includes('429')) {
                setAiReportContent(`### Rapport Financier Stratégique (Mode Hors-Ligne - Quota API Dépassé)

#### 1. Résumé Exécutif
L'établissement maintient une activité financière stable malgré un volume de créances impayées à surveiller. Les revenus approuvés s'élèvent à **${totalRevenue.toLocaleString()} ${currency}** pour des dépenses de **${totalExpenses.toLocaleString()} ${currency}**.

#### 2. Analyse de la Performance
- **Rentabilité** : Bénéfice net positif de **${(totalRevenue - totalExpenses).toLocaleString()} ${currency}**.
- **Gestion budgétaire** : Utilisation maîtrisée du budget annuel de ${budget.total.toLocaleString()} ${currency}.

#### 3. Identification des Risques
- **Retards de recouvrement** : Le total des frais impayés (${unpaidFees.toLocaleString()} ${currency}) représente un risque de trésorerie à court terme si les relances ne sont pas intensifiées.
- **Inflation des charges** : Surveillance requise sur les postes de dépenses opérationnelles.

#### 4. Recommandations Stratégiques
- **Accélération des recouvrements** : Mettre en place un plan de relance automatisé pour les familles en retard de paiement.
- **Pilotage rigoureux** : Maintenir le suivi hebdomadaire des décaissements via le tableau de bord de la caisse.`);
            } else {
                setAiReportContent("Désolé, une erreur est survenue lors de la communication avec l'IA. Veuillez réessayer plus tard.");
            }
        } finally {
            setIsAiLoading(false);
        }
    };

    const TabButton: React.FC<{ tabKey: string, label: string }> = ({ tabKey, label }) => (
        <button
            onClick={() => setActiveTab(tabKey)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors duration-200 ${activeTab === tabKey ? 'bg-white border-b-0 border-gray-200 border-l border-r border-t text-[#1F4A59]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
            {label}
        </button>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-slate-100">Rapports & Analyse Financière</h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Suivi budgétaire, états consolidés et bilan comptable annuel</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 no-print">
                    <button 
                        onClick={() => setIsPdfModalOpen(true)} 
                        className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-all"
                    >
                        <FileText className="w-4 h-4" /> <span>Bilan Annuel PDF</span>
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700">
                        <PrinterIcon className="w-4 h-4" /> <span>Imprimer</span>
                    </button>
                    <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                        <FileDownloadIcon className="w-4 h-4" /> <span>Exporter CSV</span>
                    </button>
                    <button onClick={generateAiReport} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
                        <SparklesIcon className="w-4 h-4" /> <span>Rapport IA</span>
                    </button>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-2 overflow-x-auto" aria-label="Tabs">
                    <TabButton tabKey="consolidated_annual" label="📊 Bilan Annuel Consolidé" />
                    <TabButton tabKey="salary_analytics" label="💼 Analyse Salariale & RH" />
                    <TabButton tabKey="analysis" label="Analyse Budgétaire" />
                    <TabButton tabKey="revenue_expense_trend" label="Tendance Revenus/Dépenses" />
                    <TabButton tabKey="collection" label="Analyse des Recouvrements" />
                    <TabButton tabKey="payment_methods" label="Modes de Paiement" />
                    <TabButton tabKey="expenses_pie" label="Répartition Dépenses" />
                    <TabButton tabKey="class_overview" label="Aperçu par Classe" />
                    <TabButton tabKey="monthly" label="Aperçu Mensuel" />
                    <TabButton tabKey="debtors" label="Soldes Importants" />
                    <TabButton tabKey="forecasts" label="Prévisions" />
                    <TabButton tabKey="journal" label="Journal des Transactions" />
                </nav>
            </div>
            
            <div className="mt-4" id="financial-report-content">
                {activeTab === 'consolidated_annual' && (
                    <AnnualConsolidatedReport 
                        transactions={transactions} 
                        payments={payments} 
                        budget={budget} 
                        classes={classes} 
                        personnel={personnel} 
                        schoolSettings={schoolSettings} 
                    />
                )}
                {activeTab === 'salary_analytics' && (
                    <SalaryAnalytics 
                        personnelList={personnel} 
                        transactions={transactions} 
                        schoolSettings={schoolSettings} 
                    />
                )}
                {activeTab === 'analysis' && <BudgetComparisonChart budget={budget} transactions={approvedTransactions} currency={currency} />}
                {activeTab === 'revenue_expense_trend' && <RevenueExpenseAreaChart transactions={approvedTransactions} currency={currency} />}
                {activeTab === 'collection' && <CollectionRateChart payments={payments} classes={classes} />}
                {activeTab === 'payment_methods' && <PaymentMethodPieChart transactions={approvedTransactions} currency={currency} />}
                {activeTab === 'expenses_pie' && <ExpensePieChart transactions={approvedTransactions} currency={currency} />}
                {activeTab === 'class_overview' && <ClassFinancialOverview payments={payments} classes={classes} currency={currency} />}
                {activeTab === 'monthly' && <div className="bg-white p-6 rounded-xl shadow-md border"><MonthlyOverview personnel={personnel} payments={payments} currency={currency} /></div>}
                {activeTab === 'debtors' && <TopDebtorsList payments={payments} currency={currency} />}
                {activeTab === 'forecasts' && <FinancialForecasts transactions={approvedTransactions} payments={payments} users={users} currency={currency} />}
                {activeTab === 'journal' && (
                     <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Catégorie</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {approvedTransactions.map((t) => (
                                        <tr key={t.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{t.description}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.category}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${t.type === 'Revenu' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {t.type}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${t.type === 'Revenu' ? 'text-green-600' : 'text-red-600'}`}>
                                                {t.type === 'Dépense' ? '-' : '+'} {t.amount.toLocaleString()} {currency}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Quick Annual Report PDF Generator */}
            <Modal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} title="Générateur du Bilan Financier Annuel (PDF)" size="lg">
                <div className="space-y-5">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
                        <FileText className="w-6 h-6 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">Génération du Bilan Annuel Consolidé</h4>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                                Le document officiel consolide 12 mois de flux financiers (revenus de scolarité, dépenses d'exploitation, masse salariale, résultat net mensuel et solde cumulé) avec en-tête de l'école et signatures comptables.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Exercice Comptable / Année Civile
                            </label>
                            <select
                                value={pdfYear}
                                onChange={(e) => setPdfYear(Number(e.target.value))}
                                className="w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-700 font-medium"
                            >
                                {[new Date().getFullYear() + 1, new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((yr) => (
                                    <option key={yr} value={yr}>Année {yr}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                                Année Scolaire de Référence
                            </label>
                            <input
                                type="text"
                                disabled
                                value={schoolSettings.academicYear || `${pdfYear}-${pdfYear + 1}`}
                                className="w-full px-3 py-2 text-sm border rounded-lg bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600 text-gray-600 dark:text-gray-300 font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={() => setIsPdfModalOpen(false)}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 font-medium"
                        >
                            Annuler
                        </button>
                        <button
                            type="button"
                            onClick={() => handleQuickDownloadPdf(pdfYear)}
                            disabled={isGeneratingPdf}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-colors disabled:opacity-50"
                        >
                            {isGeneratingPdf ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Génération...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    <span>Télécharger le Bilan PDF</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} title="Rapport Stratégique par IA" size="xl">
                {isAiLoading ? (
                    <div className="text-center p-8">
                        <p>Analyse des données en cours...</p>
                        <p className="text-sm text-gray-500">L'IA génère votre rapport stratégique.</p>
                    </div>
                ) : (
                    <div className="p-4 bg-gray-50 rounded-md max-h-[60vh] overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans text-sm">{aiReportContent}</pre>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default FinancialReportsPage;