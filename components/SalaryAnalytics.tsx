import React, { useState, useMemo } from 'react';
import { Transaction, Personnel, SchoolSettings, RafSettings } from '../App';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, Search, Filter, 
  ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, Printer, FileSpreadsheet, 
  Users, Briefcase, RefreshCw, Layers, Sparkles, BarChart2, ShieldCheck, History
} from 'lucide-react';

interface SalaryAnalyticsProps {
  personnelList: Personnel[];
  transactions: Transaction[];
  schoolSettings: SchoolSettings;
  rafSettings?: RafSettings;
  currentUserRole?: string;
}

export const SalaryAnalytics: React.FC<SalaryAnalyticsProps> = ({
  personnelList = [],
  transactions = [],
  schoolSettings,
  rafSettings,
  currentUserRole
}) => {
  const currency = schoolSettings?.currency || 'FCFA';

  // State controls
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'forecast' | 'sustainability'>('sustainability');
  
  // Historical filters
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [historyMonth, setHistoryMonth] = useState<number>(new Date().getMonth() + 1); // 1-indexed
  const [historySearch, setHistorySearch] = useState<string>('');

  // Forecast state
  const [forecastAdjustmentType, setForecastAdjustmentType] = useState<'none' | 'percent' | 'flat'>('none');
  const [forecastAdjustmentValue, setForecastAdjustmentValue] = useState<number>(0);
  const [newHiresCount, setNewHiresCount] = useState<number>(0);
  const [avgHireSalary, setAvgHireSalary] = useState<number>(0);

  // Month names helper
  const monthsList = [
    { value: 1, label: 'Janvier' },
    { value: 2, label: 'Février' },
    { value: 3, label: 'Mars' },
    { value: 4, label: 'Avril' },
    { value: 5, label: 'Mai' },
    { value: 6, label: 'Juin' },
    { value: 7, label: 'Juillet' },
    { value: 8, label: 'Août' },
    { value: 9, label: 'Septembre' },
    { value: 10, label: 'Octobre' },
    { value: 11, label: 'Novembre' },
    { value: 12, label: 'Décembre' }
  ];

  // ----------------------------------------------------
  // DATA COMPUTATION: HISTORICAL TRACKING
  // ----------------------------------------------------
  const salaryTransactions = useMemo(() => {
    return transactions.filter(t => {
      const isExpense = t.type === 'Dépense';
      const isApproved = t.status === 'Approuvé';
      const cat = (t.category || '').toLowerCase();
      const isSalaryCat = cat.includes('salaire') || cat.includes('paye') || cat.includes('personnel') || cat.includes('rémunération');
      return isExpense && isApproved && isSalaryCat;
    });
  }, [transactions]);

  // Grouped historical overview of salaries paid per month/year
  const historicalPaymentsGrouped = useMemo(() => {
    const groups: Record<string, { year: number; month: number; total: number; count: number; txs: Transaction[] }> = {};
    
    salaryTransactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const key = `${year}-${month}`;
      
      if (!groups[key]) {
        groups[key] = { year, month, total: 0, count: 0, txs: [] };
      }
      groups[key].total += t.amount;
      groups[key].count += 1;
      groups[key].txs.push(t);
    });

    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [salaryTransactions]);

  // Selected historical month details
  const selectedHistoryDetails = useMemo(() => {
    const targetKey = `${historyYear}-${historyMonth}`;
    const txsInMonth = salaryTransactions.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === historyYear && (d.getMonth() + 1) === historyMonth;
    });

    // Apply name search filter
    const filteredTxs = txsInMonth.filter(t => {
      if (!historySearch) return true;
      const desc = (t.description || '').toLowerCase();
      const query = historySearch.toLowerCase();
      return desc.includes(query);
    });

    const totalPaid = txsInMonth.reduce((sum, t) => sum + t.amount, 0);

    return {
      txs: filteredTxs,
      allTxsInMonth: txsInMonth,
      totalPaid,
      count: txsInMonth.length
    };
  }, [salaryTransactions, historyYear, historyMonth, historySearch]);

  // Available Years in Transactions for historical filters
  const availableYears = useMemo(() => {
    const years = new Set<number>([new Date().getFullYear(), new Date().getFullYear() - 1]);
    transactions.forEach(t => {
      if (t.date) {
        years.add(new Date(t.date).getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);


  // ----------------------------------------------------
  // DATA COMPUTATION: NEXT MONTH FORECASTS
  // ----------------------------------------------------
  // Current structural payroll base computed from Personnel active profiles
  const baseStructuralPayroll = useMemo(() => {
    let baseSalaryTotal = 0;
    let primesTotal = 0;
    let deductionsTotal = 0;
    let netTotal = 0;

    personnelList.forEach(p => {
      const base = p.baseSalary || 0;
      const primesSum = (p.primes || []).reduce((sum, pr) => sum + (pr.amount || 0), 0);
      const deductionsSum = (p.deductions || []).reduce((sum, d) => sum + (d.amount || 0), 0);
      
      baseSalaryTotal += base;
      primesTotal += primesSum;
      deductionsTotal += deductionsSum;
      netTotal += (base + primesSum - deductionsSum);
    });

    return {
      baseSalaryTotal,
      primesTotal,
      deductionsTotal,
      netTotal,
      count: personnelList.length
    };
  }, [personnelList]);

  // Simulated Next Month Payroll based on structural adjustments
  const nextMonthForecast = useMemo(() => {
    let simulatedNet = baseStructuralPayroll.netTotal;
    let simulatedBase = baseStructuralPayroll.baseSalaryTotal;
    let simulatedPrimes = baseStructuralPayroll.primesTotal;

    // Apply percentage change on base salaries or flat change
    if (forecastAdjustmentType === 'percent' && forecastAdjustmentValue !== 0) {
      const multiplier = (1 + forecastAdjustmentValue / 100);
      simulatedBase = baseStructuralPayroll.baseSalaryTotal * multiplier;
      // Re-estimate net with structural adjustments
      simulatedNet = simulatedBase + baseStructuralPayroll.primesTotal - baseStructuralPayroll.deductionsTotal;
    } else if (forecastAdjustmentType === 'flat' && forecastAdjustmentValue !== 0) {
      // Apply flat bonus/malus to each active personnel
      const totalFlatChange = forecastAdjustmentValue * personnelList.length;
      simulatedPrimes = baseStructuralPayroll.primesTotal + totalFlatChange;
      simulatedNet = baseStructuralPayroll.baseSalaryTotal + simulatedPrimes - baseStructuralPayroll.deductionsTotal;
    }

    // Add estimated new hires
    const newHiresCost = newHiresCount * avgHireSalary;
    const finalExpectedNet = simulatedNet + newHiresCost;
    const finalExpectedHeadcount = baseStructuralPayroll.count + newHiresCount;

    const varianceNet = finalExpectedNet - baseStructuralPayroll.netTotal;
    const variancePercent = baseStructuralPayroll.netTotal > 0 
      ? (varianceNet / baseStructuralPayroll.netTotal) * 100 
      : 0;

    return {
      expectedNet: finalExpectedNet,
      expectedBase: simulatedBase,
      expectedPrimes: simulatedPrimes,
      expectedHeadcount: finalExpectedHeadcount,
      varianceNet,
      variancePercent,
      newHiresCost
    };
  }, [baseStructuralPayroll, forecastAdjustmentType, forecastAdjustmentValue, newHiresCount, avgHireSalary, personnelList]);


  // ----------------------------------------------------
  // DATA COMPUTATION: VIABILITY & COVERAGE RATIO
  // ----------------------------------------------------
  const currentMonthFinancials = useMemo(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1; // 1-indexed

    // Collect revenues for current calendar month
    const revenuesThisMonth = transactions.filter(t => {
      if (t.type !== 'Revenu' || t.status !== 'Approuvé' || !t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth;
    });

    // Sum of revenue this month
    const totalRevenuesCurrentMonth = revenuesThisMonth.reduce((sum, t) => sum + t.amount, 0);

    // Categorized breakdown of current month's revenues
    let scolariteTotal = 0;
    let inscriptionTotal = 0;
    let reinscriptionTotal = 0;
    let autresRevenuesTotal = 0;

    revenuesThisMonth.forEach(t => {
      const cat = (t.category || '').toLowerCase();
      const desc = (t.description || '').toLowerCase();
      
      const isReinscription = cat.includes('reinscrip') || cat.includes('réinscrip') || desc.includes('reinscrip') || desc.includes('réinscrip');
      const isInscription = (cat.includes('inscrip') || desc.includes('inscrip')) && !isReinscription;
      const isScolarite = cat.includes('scolar') || cat.includes('pens') || cat.includes('mensual') || cat.includes('écol') || cat.includes('ecol') || desc.includes('scolar') || desc.includes('pens') || desc.includes('mensual') || desc.includes('écol') || desc.includes('ecol');
      
      if (isReinscription) {
        reinscriptionTotal += t.amount;
      } else if (isInscription) {
        inscriptionTotal += t.amount;
      } else if (isScolarite) {
        scolariteTotal += t.amount;
      } else {
        autresRevenuesTotal += t.amount;
      }
    });

    // Collect all expenses for current calendar month
    const expensesThisMonth = transactions.filter(t => {
      if (t.type !== 'Dépense' || t.status !== 'Approuvé' || !t.date) return false;
      const d = new Date(t.date);
      return d.getFullYear() === currentYear && (d.getMonth() + 1) === currentMonth;
    });

    const totalExpensesCurrentMonth = expensesThisMonth.reduce((sum, t) => sum + t.amount, 0);

    // Filter non-salary expenses
    const nonSalaryExpensesThisMonth = expensesThisMonth.filter(t => {
      const cat = (t.category || '').toLowerCase();
      const isSalaryCat = cat.includes('salaire') || cat.includes('paye') || cat.includes('personnel') || cat.includes('rémunération');
      return !isSalaryCat;
    });

    const totalNonSalaryExpensesCurrentMonth = nonSalaryExpensesThisMonth.reduce((sum, t) => sum + t.amount, 0);

    // Sum of actually paid salaries this month
    const paidSalariesThisMonth = expensesThisMonth.filter(t => {
      const cat = (t.category || '').toLowerCase();
      const isSalaryCat = cat.includes('salaire') || cat.includes('paye') || cat.includes('personnel') || cat.includes('rémunération');
      return isSalaryCat;
    }).reduce((sum, t) => sum + t.amount, 0);

    // Structural payroll commitment due for this month (from Personnel list)
    const payrollCommitment = baseStructuralPayroll.netTotal;

    // Le reste après dépenses opérationnelles (non salariales)
    const resteApresDepenses = totalRevenuesCurrentMonth - totalNonSalaryExpensesCurrentMonth;

    // Coverage ratio: comparison of Reste après dépenses vs Payroll commitment
    const coverageRatio = payrollCommitment > 0 
      ? (resteApresDepenses / payrollCommitment) * 100 
      : 100;

    // Remaining required revenue to pay current month salaries safely
    const deficitAmount = Math.max(0, payrollCommitment - resteApresDepenses);

    // Status diagnostics
    let statusLabel = 'Excellente Viabilité';
    let statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    let statusIcon = <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    let statusDesc = "Trésorerie robuste. Le reste après dépenses opérationnelles couvre largement la masse salariale théorique du mois.";

    if (resteApresDepenses <= 0) {
      statusLabel = 'Trésorerie Critique';
      statusColor = 'text-rose-700 bg-rose-50 border-rose-200';
      statusIcon = <ShieldAlert className="w-5 h-5 text-rose-500" />;
      statusDesc = "Danger : Le reste de trésorerie après dépenses de fonctionnement est nul ou négatif. Impossible de payer la masse salariale ce mois-ci sans facilités de caisse ou injections externes.";
    } else if (coverageRatio < 100) {
      statusLabel = 'Trésorerie Insuffisante';
      statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
      statusIcon = <AlertTriangle className="w-5 h-5 text-amber-500" />;
      statusDesc = `Alerte : Le reste après dépenses (${resteApresDepenses.toLocaleString()} ${currency}) est positif mais insuffisant pour couvrir l'entièreté de la masse salariale théorique (${payrollCommitment.toLocaleString()} ${currency}). Déficit de ${deficitAmount.toLocaleString()} ${currency}.`;
    } else if (coverageRatio >= 100 && coverageRatio < 125) {
      statusLabel = 'Équilibre Fragile';
      statusColor = 'text-amber-700 bg-amber-50 border-amber-200';
      statusIcon = <AlertTriangle className="w-5 h-5 text-amber-500" />;
      statusDesc = `Tension modérée : Les salaires théoriques sont tout juste couverts après paiement des autres charges opérationnelles (Taux de couverture de ${coverageRatio.toFixed(1)}%). La marge de sécurité est faible.`;
    }

    return {
      totalRevenuesCurrentMonth,
      scolariteTotal,
      inscriptionTotal,
      reinscriptionTotal,
      autresRevenuesTotal,
      totalExpensesCurrentMonth,
      totalNonSalaryExpensesCurrentMonth,
      paidSalariesThisMonth,
      payrollCommitment,
      resteApresDepenses,
      coverageRatio,
      deficitAmount,
      statusLabel,
      statusColor,
      statusIcon,
      statusDesc,
      currentYear,
      currentMonthLabel: monthsList.find(m => m.value === currentMonth)?.label || ''
    };
  }, [transactions, baseStructuralPayroll]);


  // ----------------------------------------------------
  // PRINT ACTION FOR ANALYTICS
  // ----------------------------------------------------
  const handlePrintSheet = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>RAPPORT DE PILOTAGE ET ADÉQUATION TRÉSORERIE/SALAIRES - ${schoolSettings.name}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print { body { -webkit-print-color-adjust: exact; } }
            @page { size: A4 portrait; margin: 15mm; }
          </style>
        </head>
        <body class="p-6 font-sans text-slate-800 bg-white">
          <div class="max-w-4xl mx-auto space-y-6">
            <!-- Header -->
            <div class="flex justify-between items-start border-b-2 border-[#1F4A59] pb-4">
              <div>
                <h1 class="text-2xl font-black text-[#1F4A59]">${schoolSettings.name}</h1>
                <p class="text-xs text-gray-500">Service de Contrôle Financier & Pilotage Budgétaire</p>
              </div>
              <div class="text-right">
                <span class="px-2.5 py-1 bg-slate-100 text-[#1F4A59] text-[10px] font-bold rounded-md">BILAN D'ADÉQUATION RH & TRÉSORERIE</span>
                <p class="text-xs text-slate-400 mt-1">Date d'édition : ${new Date().toLocaleDateString('fr-FR')}</p>
              </div>
            </div>

            <!-- Viability & Cash Flow Coverage -->
            <div class="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <h3 class="text-sm font-bold text-[#1F4A59] uppercase tracking-tight">1. Équilibre des Recettes et Dépenses de ${currentMonthFinancials.currentMonthLabel} ${currentMonthFinancials.currentYear}</h3>
              
              <div class="grid grid-cols-2 gap-4 text-xs">
                <div class="bg-white p-3 rounded-lg border">
                  <p class="font-bold text-slate-700 border-b pb-1 mb-2">📥 RECETTES ENCAISSÉES RÉELLES</p>
                  <ul class="space-y-1 text-slate-600">
                    <li class="flex justify-between"><span>• Scolarités & Écolages:</span> <span class="font-bold">${currentMonthFinancials.scolariteTotal.toLocaleString()} ${currency}</span></li>
                    <li class="flex justify-between"><span>• Inscriptions:</span> <span class="font-bold">${currentMonthFinancials.inscriptionTotal.toLocaleString()} ${currency}</span></li>
                    <li class="flex justify-between"><span>• Réinscriptions:</span> <span class="font-bold">${currentMonthFinancials.reinscriptionTotal.toLocaleString()} ${currency}</span></li>
                    <li class="flex justify-between"><span>• Autres Recettes:</span> <span class="font-bold">${currentMonthFinancials.autresRevenuesTotal.toLocaleString()} ${currency}</span></li>
                    <li class="flex justify-between border-t pt-1 font-bold text-emerald-700"><span>TOTAL RECETTES:</span> <span>${currentMonthFinancials.totalRevenuesCurrentMonth.toLocaleString()} ${currency}</span></li>
                  </ul>
                </div>

                <div class="bg-white p-3 rounded-lg border">
                  <p class="font-bold text-slate-700 border-b pb-1 mb-2">💸 CHARGES OPÉRATIONNELLES RÉELLES</p>
                  <ul class="space-y-1 text-slate-600">
                    <li class="flex justify-between"><span>• Dépenses de fonctionnement:</span> <span class="font-bold">${currentMonthFinancials.totalNonSalaryExpensesCurrentMonth.toLocaleString()} ${currency}</span></li>
                    <li class="flex justify-between"><span>• Masse salariale déjà payée:</span> <span class="font-bold">${currentMonthFinancials.paidSalariesThisMonth.toLocaleString()} ${currency}</span></li>
                    <li class="flex justify-between border-t pt-1 font-bold text-rose-700"><span>TOTAL CHARGES:</span> <span>${currentMonthFinancials.totalExpensesCurrentMonth.toLocaleString()} ${currency}</span></li>
                  </ul>
                </div>
              </div>

              <!-- Reste apres depenses & comparison with Salary commitments -->
              <div class="bg-white p-4 rounded-lg border border-slate-200 text-xs space-y-2">
                <div class="flex justify-between items-center text-sm">
                  <span class="font-bold text-slate-700">💰 Solde Disponible après charges de fonctionnement :</span>
                  <span class="font-black text-emerald-700">${currentMonthFinancials.resteApresDepenses.toLocaleString()} ${currency}</span>
                </div>
                <div class="flex justify-between items-center text-sm">
                  <span class="font-bold text-slate-700">👔 Engagement Salarial Net Théorique Dû :</span>
                  <span class="font-black text-[#1F4A59]">${currentMonthFinancials.payrollCommitment.toLocaleString()} ${currency}</span>
                </div>
                <div class="flex justify-between items-center text-sm border-t pt-2">
                  <span class="font-bold text-slate-800">📊 Capacité de Couverture des Salaires :</span>
                  <span class="font-black ${currentMonthFinancials.coverageRatio >= 100 ? 'text-emerald-600' : 'text-rose-600'}">
                    ${currentMonthFinancials.coverageRatio.toFixed(1)}%
                  </span>
                </div>
              </div>

              <p class="text-xs text-slate-600 italic font-medium pt-1">
                <strong>Diagnostic de Direction :</strong> ${currentMonthFinancials.statusLabel} - ${currentMonthFinancials.statusDesc}
              </p>
            </div>

            <!-- Future Month Projection -->
            <div class="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-tight">2. Simulation Masse Salariale Mensuelle Future</h3>
              <div class="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span class="text-gray-500">Masse Salariale Net de Base :</span>
                  <p class="text-sm font-bold text-slate-800">${baseStructuralPayroll.netTotal.toLocaleString()} ${currency} (pour ${baseStructuralPayroll.count} employés)</p>
                </div>
                <div>
                  <span class="text-gray-500">Simulation Prochain Mois (avec ajustements) :</span>
                  <p class="text-sm font-bold text-indigo-700">${nextMonthForecast.expectedNet.toLocaleString()} ${currency} (pour ${nextMonthForecast.expectedHeadcount} employés)</p>
                </div>
              </div>
            </div>

            <!-- Historical paid salaries of the month -->
            <div class="space-y-2">
              <h3 class="text-sm font-bold text-slate-800 uppercase tracking-tight">3. Traces & Émargements des Salaires (${monthsList.find(m => m.value === historyMonth)?.label} ${historyYear})</h3>
              <table class="min-w-full divide-y divide-slate-200 border text-xs">
                <thead class="bg-slate-100">
                  <tr>
                    <th class="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Réf Transaction</th>
                    <th class="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Employé & Libellé</th>
                    <th class="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Date</th>
                    <th class="px-3 py-2 text-left text-[10px] font-bold text-gray-500 uppercase">Mode de Paye</th>
                    <th class="px-3 py-2 text-right text-[10px] font-bold text-gray-500 uppercase">Montant Net</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${selectedHistoryDetails.txs.map(t => `
                    <tr>
                      <td class="px-3 py-2 font-mono font-bold text-slate-800">${t.id}</td>
                      <td class="px-3 py-2 font-medium text-slate-900">${t.description}</td>
                      <td class="px-3 py-2 text-gray-500">${t.date ? new Date(t.date).toLocaleDateString('fr-FR') : 'N/A'}</td>
                      <td class="px-3 py-2 text-gray-500">${t.paymentMethod || 'Espèce'}</td>
                      <td class="px-3 py-2 text-right font-bold text-slate-800">${t.amount.toLocaleString()} ${currency}</td>
                    </tr>
                  `).join('')}
                  ${selectedHistoryDetails.txs.length === 0 ? `
                    <tr>
                      <td colspan="5" class="px-3 py-6 text-center text-gray-400 italic">Aucune transaction de salaire correspondante ce mois.</td>
                    </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            <!-- Signatures -->
            <div class="grid grid-cols-2 gap-12 pt-8 text-xs">
              <div class="border-t border-dashed border-slate-300 pt-3 text-center">
                <p class="font-bold">Visa Contrôleur Financier / RAF</p>
                <div class="h-20"></div>
                <p class="text-gray-400">Date et signature</p>
              </div>
              <div class="border-t border-dashed border-slate-300 pt-3 text-center">
                <p class="font-bold">Approbation Direction Générale</p>
                <div class="h-20"></div>
                <p class="text-gray-400">Date et signature</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  return (
    <div className="space-y-6">
      
      {/* Upper sub-header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
        <div>
          <h3 className="text-base font-extrabold text-[#1F4A59] dark:text-sky-300 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-slate-500" />
            Module de Pilotage & Analyse de la Masse Salariale
          </h3>
          <p className="text-xs text-slate-500 mt-1">Traces salariales passées, prévisions du mois prochain, et adéquation de trésorerie en temps réel.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto shrink-0">
          <button 
            onClick={handlePrintSheet}
            className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-[#1F4A59] hover:bg-[#16343F] dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer la Planification</span>
          </button>
        </div>
      </div>

      {/* Internal Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 no-print space-x-1">
        <button
          onClick={() => setActiveSubTab('sustainability')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 -mb-px ${
            activeSubTab === 'sustainability' 
              ? 'border-[#1F4A59] text-[#1F4A59] dark:border-sky-400 dark:text-sky-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Trésorerie vs Salaires (Mois en cours)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('forecast')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 -mb-px ${
            activeSubTab === 'forecast' 
              ? 'border-[#1F4A59] text-[#1F4A59] dark:border-sky-400 dark:text-sky-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Prévisions & Simulation (Mois prochain)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 -mb-px ${
            activeSubTab === 'history' 
              ? 'border-[#1F4A59] text-[#1F4A59] dark:border-sky-400 dark:text-sky-400' 
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Traces Salariales (Mois & Années passés)</span>
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs">
        
        {/* SUBTAB 1: TREASURY COVERAGE / VIABILITY */}
        {activeSubTab === 'sustainability' && (
          <div className="space-y-6">
            
            {/* Status alert card banner */}
            <div className={`p-4 rounded-xl border flex items-start gap-3.5 transition-all ${
              currentMonthFinancials.coverageRatio >= 100 
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300' 
                : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 text-amber-900 dark:text-amber-300'
            }`}>
              <div className="p-2 bg-white/90 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-xs shrink-0">
                {currentMonthFinancials.statusIcon}
              </div>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider">État d'Adéquation Financière • {currentMonthFinancials.statusLabel}</h4>
                <p className="text-xs mt-1 leading-relaxed opacity-95 text-slate-600 dark:text-slate-300">{currentMonthFinancials.statusDesc}</p>
              </div>
            </div>

            {/* Main Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs space-y-2">
                <span className="text-slate-500 dark:text-slate-400 uppercase font-bold tracking-tight block">Recettes Réelles Encaissées</span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{currentMonthFinancials.totalRevenuesCurrentMonth.toLocaleString()} {currency}</p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Scolarités, inscriptions & réinscriptions</span>
              </div>
              <div className="p-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs space-y-2">
                <span className="text-slate-500 dark:text-slate-400 uppercase font-bold tracking-tight block">Dépenses (Hors Salaires)</span>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{currentMonthFinancials.totalNonSalaryExpensesCurrentMonth.toLocaleString()} {currency}</p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Charges d'exploitation approuvées</span>
              </div>
              <div className="p-5 bg-emerald-50/30 dark:bg-emerald-950/20 rounded-xl border border-emerald-100/60 dark:border-emerald-900/30 text-xs space-y-2">
                <span className="text-emerald-800 dark:text-emerald-300 uppercase font-bold tracking-tight block">Solde Disponible</span>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{currentMonthFinancials.resteApresDepenses.toLocaleString()} {currency}</p>
                <span className="text-[10px] text-emerald-600/80 dark:text-emerald-500 block">Disponible après fonctionnement</span>
              </div>
              <div className="p-5 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs space-y-2">
                <span className="text-slate-500 dark:text-slate-400 uppercase font-bold tracking-tight block">Masse Salariale Théorique</span>
                <p className="text-2xl font-black text-slate-800 dark:text-slate-200">{currentMonthFinancials.payrollCommitment.toLocaleString()} {currency}</p>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block">Rémunération totale théorique due</span>
              </div>
            </div>

            {/* Recettes and Dépenses breakdown list */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              
              {/* Left Column: Breakdown details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4" />
                  Détail Analytique des Flux de {currentMonthFinancials.currentMonthLabel}
                </h4>
                
                {/* Categorized Revenues Breakdown */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800 p-5 text-xs space-y-3.5">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block border-b border-slate-100 dark:border-slate-800 pb-2">📥 Répartition des Recettes Encaissées</span>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Frais de Scolarité / Pensions :</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{currentMonthFinancials.scolariteTotal.toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Inscriptions Administratives :</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{currentMonthFinancials.inscriptionTotal.toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Réinscriptions Annuelles :</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{currentMonthFinancials.reinscriptionTotal.toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Autres Recettes & Divers :</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{currentMonthFinancials.autresRevenuesTotal.toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <span>Total des Encaissements :</span>
                      <span>{currentMonthFinancials.totalRevenuesCurrentMonth.toLocaleString()} {currency}</span>
                    </div>
                  </div>
                </div>

                {/* Operational expenses Breakdown */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800 p-5 text-xs space-y-3.5">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block border-b border-slate-100 dark:border-slate-800 pb-2">💸 Répartition des Décaissements</span>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Charges d'exploitation & Fonctionnement :</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{currentMonthFinancials.totalNonSalaryExpensesCurrentMonth.toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 dark:text-slate-400">Salaires payés (décaissés réels) :</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{currentMonthFinancials.paidSalariesThisMonth.toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2.5 font-bold text-rose-600 dark:text-rose-400">
                      <span>Total des Décaissements réels :</span>
                      <span>{currentMonthFinancials.totalExpensesCurrentMonth.toLocaleString()} {currency}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Comparative viability and action proposals */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  Comparaison avec l'Engagement Salarial Net Théorique
                </h4>

                <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Solde restant après fonctionnement :</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{currentMonthFinancials.resteApresDepenses.toLocaleString()} {currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Engagement Salarial Théorique :</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{currentMonthFinancials.payrollCommitment.toLocaleString()} {currency}</span>
                  </div>
                  
                  <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-3">
                    <span className="font-extrabold text-slate-700 dark:text-slate-300">Capacité de Couverture des Salaires :</span>
                    <span className={`text-xl font-black ${currentMonthFinancials.coverageRatio >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {currentMonthFinancials.coverageRatio.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${currentMonthFinancials.coverageRatio >= 100 ? 'bg-emerald-500' : 'bg-rose-500'}`} 
                      style={{ width: `${Math.min(100, Math.max(0, currentMonthFinancials.coverageRatio))}%` }}
                    />
                  </div>
                  
                  {currentMonthFinancials.coverageRatio < 100 && (
                    <div className="p-3 bg-rose-50/60 dark:bg-rose-950/10 text-rose-800 dark:text-rose-300 rounded-lg border border-rose-100 dark:border-rose-900/30 text-xs leading-relaxed">
                      🚨 Le solde restant après charges opérationnelles ne permet pas de couvrir la totalité de la masse salariale théorique. Il manque <strong>{currentMonthFinancials.deficitAmount.toLocaleString()} {currency}</strong> pour honorer les salaires à 100%.
                    </div>
                  )}
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs space-y-3">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block border-b border-slate-100 dark:border-slate-800 pb-2">📋 Plan d'Action & Mesures de Pilotage</span>
                  {currentMonthFinancials.coverageRatio < 100 ? (
                    <>
                      <p className="font-bold text-rose-800 dark:text-rose-400 flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> Mesures Correctives Recommandées
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                        <li><strong>Relance intensive des écolages impayés</strong> auprès des élèves débiteurs pour combler le manque de {currentMonthFinancials.deficitAmount.toLocaleString()} {currency}.</li>
                        <li><strong>Gel temporaire des dépenses de fonctionnement non indispensables</strong>.</li>
                        <li>Mobilisation d'une facilité de caisse à court terme.</li>
                      </ul>
                    </>
                  ) : currentMonthFinancials.coverageRatio >= 100 && currentMonthFinancials.coverageRatio < 125 ? (
                    <>
                      <p className="font-bold text-amber-800 dark:text-amber-400 flex items-center gap-1.5 pt-1">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> Surveillance Budgétaire Active
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                        <li>Limiter l'approbation de nouvelles lignes d'achats non urgents.</li>
                        <li>Négocier des délais de paiement avec les fournisseurs externes.</li>
                        <li>Prévoir le paiement prioritaire des enseignants et personnels pédagogiques clés.</li>
                      </ul>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5 pt-1">
                        <CheckCircle2 className="w-4 h-4 shrink-0" /> Gestion Optimale de Trésorerie
                      </p>
                      <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                        <li><strong>Procéder au versement anticipé des salaires</strong> en toute confiance.</li>
                        <li>Allouer une fraction de l'excédent aux réserves d'investissement ou provisions de maintenance de rentrée scolaire.</li>
                        <li>Poursuivre le suivi automatisé pour préserver cette dynamique positive.</li>
                      </ul>
                    </>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* SUBTAB 2: FORECASTS & SIMULATION FOR THE NEXT MONTH */}
        {activeSubTab === 'forecast' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Form: Parameters adjustment */}
              <div className="lg:col-span-5 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs space-y-4">
                <h4 className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  Paramètres de Simulation
                </h4>
                
                {/* Structural Adjustments */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Modification Structurelle de Salaire :</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => { setForecastAdjustmentType('none'); setForecastAdjustmentValue(0); }}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                        forecastAdjustmentType === 'none' 
                          ? 'bg-[#1F4A59] text-white border-[#1F4A59] dark:bg-sky-500 dark:border-sky-500' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                      }`}
                    >
                      Aucune
                    </button>
                    <button 
                      onClick={() => { setForecastAdjustmentType('percent'); setForecastAdjustmentValue(5); }}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                        forecastAdjustmentType === 'percent' 
                          ? 'bg-[#1F4A59] text-white border-[#1F4A59] dark:bg-sky-500 dark:border-sky-500' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                      }`}
                    >
                      Pourcentage (%)
                    </button>
                    <button 
                      onClick={() => { setForecastAdjustmentType('flat'); setForecastAdjustmentValue(10000); }}
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-all ${
                        forecastAdjustmentType === 'flat' 
                          ? 'bg-[#1F4A59] text-white border-[#1F4A59] dark:bg-sky-500 dark:border-sky-500' 
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                      }`}
                    >
                      Montant fixe
                    </button>
                  </div>
                </div>

                {forecastAdjustmentType !== 'none' && (
                  <div className="space-y-1.5 animate-fadeIn">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {forecastAdjustmentType === 'percent' 
                        ? 'Taux de revalorisation salariale (%) :' 
                        : 'Montant de la prime / retenue générale :'
                      }
                    </label>
                    <input 
                      type="number" 
                      value={forecastAdjustmentValue}
                      onChange={(e) => setForecastAdjustmentValue(Number(e.target.value))}
                      className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                      placeholder={forecastAdjustmentType === 'percent' ? "Ex: 5 pour +5%" : "Ex: 10000"}
                    />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                      {forecastAdjustmentType === 'percent' 
                        ? 'Applique une hausse ou baisse en % sur le salaire de base de tous les employés.' 
                        : 'Ajoute (valeur positive) ou retire (valeur négative) ce montant net à chaque bulletin.'
                      }
                    </p>
                  </div>
                )}

                <hr className="my-3 border-slate-100 dark:border-slate-800" />

                {/* Recrutements previsions */}
                <div className="space-y-3">
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">Recrutements Planifiés pour le mois prochain :</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Nombre d'embauches :</label>
                      <input 
                        type="number" 
                        min="0"
                        value={newHiresCount || ''}
                        onChange={(e) => setNewHiresCount(Math.max(0, Number(e.target.value)))}
                        className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                        placeholder="Ex: 2"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">Salaire net moyen :</label>
                      <input 
                        type="number" 
                        min="0"
                        value={avgHireSalary || ''}
                        onChange={(e) => setAvgHireSalary(Math.max(0, Number(e.target.value)))}
                        className="w-full py-2 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                        placeholder={`FCFA / mois`}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => {
                      setForecastAdjustmentType('none');
                      setForecastAdjustmentValue(0);
                      setNewHiresCount(0);
                      setAvgHireSalary(0);
                    }}
                    className="w-full py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    Réinitialiser les simulations
                  </button>
                </div>
              </div>

              {/* Right Results: simulated stats & comparison */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 uppercase tracking-wider">Masse Salariale Prévisionnelle</h4>
                
                {/* Result KPI Blocks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs space-y-1">
                    <span className="text-slate-500 dark:text-slate-400 font-medium block">Effectif Budgétisé :</span>
                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{nextMonthForecast.expectedHeadcount} personnes</p>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">({baseStructuralPayroll.count} actuels + {newHiresCount} recrutements)</span>
                  </div>
                  <div className="p-4 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/60 dark:border-indigo-900/30 rounded-xl text-xs space-y-1">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium block">Budget Masse Salariale Net :</span>
                    <p className="text-lg font-black text-indigo-700 dark:text-indigo-400">{nextMonthForecast.expectedNet.toLocaleString()} {currency}</p>
                    <span className="text-[10px] text-indigo-500/80 dark:text-indigo-400/60">Masse de base : {baseStructuralPayroll.netTotal.toLocaleString()} {currency}</span>
                  </div>
                </div>

                {/* Variance and Impact report */}
                <div className="p-5 rounded-xl border border-slate-200/50 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3.5 text-xs">
                  <span className="block font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">Analyse de l'écart budgétaire mensuel</span>
                  
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Écart net constaté :</span>
                      <p className={`text-lg font-black ${nextMonthForecast.varianceNet > 0 ? 'text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {nextMonthForecast.varianceNet > 0 ? '+' : ''}{nextMonthForecast.varianceNet.toLocaleString()} {currency}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 dark:text-slate-400">Variation relative :</span>
                      <p className={`text-lg font-black ${nextMonthForecast.varianceNet > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {nextMonthForecast.varianceNet > 0 ? '+' : ''}{nextMonthForecast.variancePercent.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className={`p-3 rounded-lg border text-xs leading-relaxed ${
                    nextMonthForecast.varianceNet > 0 
                      ? 'bg-rose-50/60 dark:bg-rose-950/10 border-rose-100 dark:border-rose-900/30 text-rose-800 dark:text-rose-300' 
                      : 'bg-emerald-50/60 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                  }`}>
                    {nextMonthForecast.varianceNet === 0 ? (
                      "Aucune dérive budgétaire n'est simulée. La masse salariale reste conforme à sa structure stable de base."
                    ) : nextMonthForecast.varianceNet > 0 ? (
                      `⚠️ La simulation indique une augmentation de la masse salariale de ${nextMonthForecast.varianceNet.toLocaleString()} ${currency} par mois. Veillez à ce que le taux de recouvrement des frais de scolarité augmente d'au moins ${nextMonthForecast.variancePercent.toFixed(1)}% pour maintenir l'équilibre.`
                    ) : (
                      `✅ Les ajustements simulent une économie de ${Math.abs(nextMonthForecast.varianceNet).toLocaleString()} ${currency} par mois.`
                    )}
                  </div>
                </div>

                {/* Simulated Payslip Structure Chart mockup */}
                <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200/50 dark:border-slate-800 text-xs space-y-3.5">
                  <span className="block font-extrabold text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">Structure de Charges Projetée</span>
                  <div className="space-y-2.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Salaires de base projetés :</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{nextMonthForecast.expectedBase.toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Primes & indemnités projetées :</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{nextMonthForecast.expectedPrimes.toLocaleString()} {currency}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 dark:border-slate-800 pt-2.5">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Masse Salariale Projetée :</span>
                      <span className="font-black text-indigo-600 dark:text-indigo-400">{nextMonthForecast.expectedNet.toLocaleString()} {currency}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 3: HISTORICAL TRACING / ARCHIVES */}
        {activeSubTab === 'history' && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Filter controls */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">Année d'exercice :</label>
                <select 
                  value={historyYear}
                  onChange={(e) => setHistoryYear(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                >
                  {availableYears.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">Mois :</label>
                <select 
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(Number(e.target.value))}
                  className="w-full py-2 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                >
                  {monthsList.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">Rechercher un employé :</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 dark:text-slate-500">
                    <Search className="w-4 h-4" />
                  </span>
                  <input 
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Saisir un nom ou une description..."
                    className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F4A59] dark:focus:ring-sky-500 text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>
            </div>

            {/* Quick summary for selected historical month */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs text-center space-y-1">
                <span className="text-slate-500 dark:text-slate-400 font-bold block">Total Décaissé :</span>
                <p className="text-xl font-extrabold text-[#1F4A59] dark:text-sky-400">
                  {selectedHistoryDetails.totalPaid.toLocaleString()} {currency}
                </p>
              </div>
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs text-center space-y-1">
                <span className="text-slate-500 dark:text-slate-400 font-bold block">Bulletins Émis :</span>
                <p className="text-xl font-extrabold text-slate-800 dark:text-slate-200">
                  {selectedHistoryDetails.count} paiements
                </p>
              </div>
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/20 rounded-xl border border-slate-100 dark:border-slate-800/40 text-xs text-center space-y-1">
                <span className="text-slate-500 dark:text-slate-400 font-bold block">Période d'Exercice :</span>
                <p className="text-sm font-extrabold text-[#1F4A59] dark:text-sky-300 uppercase pt-0.5">
                  {monthsList.find(m => m.value === historyMonth)?.label} {historyYear}
                </p>
              </div>
            </div>

            {/* Historical payments list table */}
            <div className="border border-slate-200/60 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                <thead>
                  <tr className="bg-slate-50/85 dark:bg-slate-800/45">
                    <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">ID Transaction</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bénéficiaire / Description</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date d'Enregistrement</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode de Paye</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Montant Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/50">
                  {selectedHistoryDetails.txs.map((t) => {
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-slate-600 dark:text-slate-400">{t.id}</td>
                        <td className="px-4 py-3 font-bold text-slate-850 dark:text-slate-200">{t.description}</td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {t.date ? new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Non datée'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50/60 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 border border-amber-100 dark:border-amber-900/20">
                            {t.paymentMethod || 'Espèce'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-100">
                          {t.amount.toLocaleString()} {currency}
                        </td>
                      </tr>
                    );
                  })}
                  {selectedHistoryDetails.txs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-slate-500 italic">
                        Aucun paiement de salaire enregistré pour la période sélectionnée ou correspondant à la recherche.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Global Timeline List of all past payrolls */}
            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-4 h-4" />
                Historique Consolidé par Périodes de Paie
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {historicalPaymentsGrouped.map((grp) => {
                  const mLabel = monthsList.find(m => m.value === grp.month)?.label || '';
                  const isActive = historyYear === grp.year && historyMonth === grp.month;
                  return (
                    <div 
                      key={`${grp.year}-${grp.month}`}
                      onClick={() => { setHistoryYear(grp.year); setHistoryMonth(grp.month); }}
                      className={`p-4 rounded-xl border text-xs cursor-pointer transition-all flex justify-between items-center ${
                        isActive 
                          ? 'bg-[#1F4A59] dark:bg-slate-800 text-white border-[#1F4A59] dark:border-slate-700 shadow-sm' 
                          : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <p className={`font-extrabold ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-250'}`}>{mLabel} {grp.year}</p>
                        <p className={`text-[10px] mt-1 ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{grp.count} bulletins versés</p>
                      </div>
                      <span className={`font-black ${isActive ? 'text-white' : 'text-[#1F4A59] dark:text-sky-400'}`}>
                        {grp.total.toLocaleString()} {currency}
                      </span>
                    </div>
                  );
                })}
                {historicalPaymentsGrouped.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic col-span-full py-4 text-center">Aucune archive salariale consolidée n'est disponible.</p>
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
