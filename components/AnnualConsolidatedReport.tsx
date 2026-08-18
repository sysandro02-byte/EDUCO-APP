import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, Line, ComposedChart 
} from 'recharts';
import { 
  FileText, Download, Printer, Calendar, TrendingUp, TrendingDown, DollarSign, 
  CheckCircle2, AlertCircle, PieChart as PieIcon, ShieldCheck 
} from 'lucide-react';
import { Transaction, SchoolSettings, Personnel } from '../App';
import { 
  computeAnnualFinancialData, 
  generateAnnualConsolidatedPdf, 
  AnnualReportData 
} from '../utils/annualFinancialReportPdf';

interface AnnualConsolidatedReportProps {
  transactions: Transaction[];
  payments: any[];
  budget: any;
  classes: any[];
  personnel: Personnel[];
  schoolSettings: SchoolSettings;
  onOpenPdfPreview?: (data: AnnualReportData) => void;
}

const AnnualConsolidatedReport: React.FC<AnnualConsolidatedReportProps> = ({
  transactions,
  payments,
  budget,
  classes,
  personnel,
  schoolSettings,
}) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const currency = schoolSettings.currency || 'FCFA';

  // Compute available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(currentYear);
    (transactions || []).forEach(t => {
      const d = new Date(t.date);
      if (!isNaN(d.getTime())) {
        years.add(d.getFullYear());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions, currentYear]);

  // Aggregate annual data for selected year
  const reportData = useMemo(() => {
    return computeAnnualFinancialData(
      transactions,
      payments,
      selectedYear,
      schoolSettings.academicYear || `${selectedYear}-${selectedYear + 1}`
    );
  }, [transactions, payments, selectedYear, schoolSettings.academicYear]);

  // Handle PDF Generation
  const handleDownloadPdf = () => {
    setIsGeneratingPdf(true);
    try {
      generateAnnualConsolidatedPdf(reportData, schoolSettings);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err) {
      console.error('Erreur lors de la génération du PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Format chart data
  const chartData = useMemo(() => {
    return reportData.monthlyData.map(m => ({
      name: m.monthName.slice(0, 4),
      fullName: m.monthName,
      Revenus: m.revenue,
      Dépenses: m.expenses,
      'Résultat Net': m.net,
      'Solde Cumulé': m.cumulativeBalance,
    }));
  }, [reportData]);

  return (
    <div className="space-y-6">
      {/* Action Banner */}
      <div className="bg-gradient-to-r from-[#1F4A59] to-[#0F2834] text-white p-6 rounded-2xl shadow-lg border border-[#1F4A59]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Bilan Consolidé
            </span>
            <span className="text-xs text-slate-300">
              Année Scolaire : {schoolSettings.academicYear || `${selectedYear}-${selectedYear + 1}`}
            </span>
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight">
            Bilan Financier Annuel & Consolidation Mensuelle
          </h3>
          <p className="text-sm text-slate-300 max-w-2xl">
            Agrégation automatique des encaissements de scolarité, flux de caisse et dépenses opérationnelles par mois avec génération du rapport financier certifié au format PDF.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Year selector */}
          <div className="flex items-center bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/20">
            <Calendar className="w-4 h-4 ml-2 text-slate-300" />
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-white font-semibold text-sm px-3 py-1.5 focus:outline-none cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr} className="text-gray-900 bg-white">
                  Exercice {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Download PDF Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Génération du PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Télécharger le Bilan PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {downloadSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-sm font-medium">
              Le bilan financier annuel consolidé ({selectedYear}) a été généré et téléchargé avec succès !
            </span>
          </div>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Revenues */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-5 rounded-xl shadow-md border border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Revenus Encaissés ({selectedYear})</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {reportData.totalRevenue.toLocaleString('fr-FR')} <span className="text-sm font-normal">{currency}</span>
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Total des recettes approuvées sur l'année
          </p>
        </div>

        {/* Total Expenses */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-5 rounded-xl shadow-md border border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Dépenses Validées ({selectedYear})</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {reportData.totalExpenses.toLocaleString('fr-FR')} <span className="text-sm font-normal">{currency}</span>
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Charges salariales & dépenses engagées
          </p>
        </div>

        {/* Net Profit */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-5 rounded-xl shadow-md border border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Résultat Net Annuel</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-black mt-2 ${reportData.netProfit >= 0 ? 'text-[#1F4A59] dark:text-sky-400' : 'text-rose-600'}`}>
            {reportData.netProfit >= 0 ? '+' : ''}{reportData.netProfit.toLocaleString('fr-FR')} <span className="text-sm font-normal">{currency}</span>
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Marge nette consolidée : <span className="font-semibold">{reportData.netMargin.toFixed(1)}%</span>
          </p>
        </div>

        {/* Collection Rate */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-5 rounded-xl shadow-md border border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Taux Recouvrement Scolaire</span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {reportData.collectionRate.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Reste à recouvrer : {reportData.totalUnpaidFees.toLocaleString('fr-FR')} {currency}
          </p>
        </div>
      </div>

      {/* Chart Section: Monthly Trend Composed Chart */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/60">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Évolution Mensuelle des Flux Consolidés ({selectedYear})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Comparatif mensuel des encaissements, des décaissements et de la trésorerie nette
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-3 h-3 bg-emerald-500 rounded-sm inline-block" /> Revenus
            </span>
            <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
              <span className="w-3 h-3 bg-rose-500 rounded-sm inline-block" /> Dépenses
            </span>
            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
              <span className="w-3 h-1 bg-blue-500 inline-block" /> Solde Cumulé
            </span>
          </div>
        </div>

        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="fullName" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={45} />
              <YAxis yAxisId="left" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip 
                formatter={(val: number, name: string) => [`${val.toLocaleString('fr-FR')} ${currency}`, name]}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="Revenus" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Bar yAxisId="left" dataKey="Dépenses" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
              <Line yAxisId="right" type="monotone" dataKey="Solde Cumulé" stroke="#3B82F6" strokeWidth={3} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table: Full Monthly Breakdown (12 Months) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/60 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
          <div>
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Tableau Consolidé Mensuel ({selectedYear})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Agrégation comptable complète des 12 mois de l'exercice
            </p>
          </div>
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exporter PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-3 text-left">Mois</th>
                <th className="px-6 py-3 text-right">Revenus Encaissés</th>
                <th className="px-6 py-3 text-right">Dépenses Validées</th>
                <th className="px-6 py-3 text-right">Résultat Net Mensuel</th>
                <th className="px-6 py-3 text-right">Solde Cumulé</th>
                <th className="px-6 py-3 text-center">Activité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-sm">
              {reportData.monthlyData.map((m) => {
                const isPositive = m.net >= 0;
                return (
                  <tr key={m.monthIndex} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                      {m.monthName}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {m.revenue > 0 ? `${m.revenue.toLocaleString('fr-FR')} ${currency}` : '-'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-rose-600 dark:text-rose-400">
                      {m.expenses > 0 ? `${m.expenses.toLocaleString('fr-FR')} ${currency}` : '-'}
                    </td>
                    <td className={`px-6 py-3.5 text-right font-bold ${isPositive ? 'text-slate-800 dark:text-slate-100' : 'text-rose-600'}`}>
                      {m.net !== 0 ? `${isPositive ? '+' : ''}${m.net.toLocaleString('fr-FR')} ${currency}` : '-'}
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-blue-600 dark:text-blue-400">
                      {`${m.cumulativeBalance >= 0 ? '+' : ''}${m.cumulativeBalance.toLocaleString('fr-FR')} ${currency}`}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        m.transactionCount > 0 
                          ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          : 'bg-transparent text-slate-400'
                      }`}>
                        {m.transactionCount} op.
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Total Summary Row */}
              <tr className="bg-slate-100 dark:bg-slate-900 font-bold border-t-2 border-slate-300 dark:border-slate-600 text-base">
                <td className="px-6 py-4 text-slate-900 dark:text-white uppercase tracking-wide">
                  TOTAL ANNUEL CONSOLIDÉ
                </td>
                <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400">
                  {reportData.totalRevenue.toLocaleString('fr-FR')} {currency}
                </td>
                <td className="px-6 py-4 text-right text-rose-600 dark:text-rose-400">
                  {reportData.totalExpenses.toLocaleString('fr-FR')} {currency}
                </td>
                <td className={`px-6 py-4 text-right ${reportData.netProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
                  {reportData.netProfit >= 0 ? '+' : ''}{reportData.netProfit.toLocaleString('fr-FR')} {currency}
                </td>
                <td className="px-6 py-4 text-right text-blue-700 dark:text-blue-400">
                  {reportData.netProfit >= 0 ? '+' : ''}{reportData.netProfit.toLocaleString('fr-FR')} {currency}
                </td>
                <td className="px-6 py-4 text-center text-xs text-slate-500">
                  Clôture
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytical Breakdown: Expense Categories + Revenue Structure */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expense Categories */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-5 h-5 text-rose-500" />
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Répartition des Dépenses par Poste ({selectedYear})
            </h4>
          </div>

          <div className="space-y-3">
            {reportData.expenseCategories.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Aucune dépense enregistrée pour cet exercice.</p>
            ) : (
              reportData.expenseCategories.map((cat, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>{cat.category}</span>
                    <span>{cat.amount.toLocaleString('fr-FR')} {currency} ({cat.percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-rose-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, cat.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Tuition Recovery and Revenues */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
              Synthèse des Recouvrements Scolaires
            </h4>
          </div>

          <div className="space-y-4 text-sm">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Frais Encaissés</p>
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                  {reportData.totalTuitionPaid.toLocaleString('fr-FR')} {currency}
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 px-2 py-1 bg-emerald-200/50 rounded-lg">
                {reportData.collectionRate.toFixed(1)}% Recouvert
              </span>
            </div>

            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-100 dark:border-rose-900/50 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Soldes Débiteurs & Impayés</p>
                <p className="text-lg font-bold text-rose-700 dark:text-rose-300">
                  {reportData.totalUnpaidFees.toLocaleString('fr-FR')} {currency}
                </p>
              </div>
              <span className="text-xs font-bold text-rose-700 dark:text-rose-300 px-2 py-1 bg-rose-200/50 rounded-lg">
                {(100 - reportData.collectionRate).toFixed(1)}% Reste Dû
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Total Écolages Facturés</p>
                <p className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {reportData.totalTuitionBilled.toLocaleString('fr-FR')} {currency}
                </p>
              </div>
              <span className="text-xs text-slate-500">100% de l'assiette</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnualConsolidatedReport;
