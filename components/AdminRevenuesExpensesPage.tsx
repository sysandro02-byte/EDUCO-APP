import React, { useState, useMemo, useEffect } from 'react';
import { fetchAdminRegisteredSchools, fetchConsolidatedFinancials } from '../src/services/api';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Building2, 
  Filter, 
  Download, 
  PieChart as PieIcon,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

interface AdminRevenuesExpensesPageProps {
  schools?: any[];
}

export const AdminRevenuesExpensesPage: React.FC<AdminRevenuesExpensesPageProps> = ({ schools = [] }) => {
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const res = await fetchAdminRegisteredSchools();
        if (res && res.schools) {
          setSchoolsList(res.schools);
        }
      } catch (err) {
        console.error("Error loading schools in revenues-expenses page:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchools();
  }, []);

  useEffect(() => {
    const loadFinancials = async () => {
      try {
        const res = await fetchConsolidatedFinancials(selectedSchool);
        if (res && res.success && res.monthlyData) {
          setMonthlyData(res.monthlyData);
        }
      } catch (err) {
        console.error("Error loading consolidated financials:", err);
      }
    };
    loadFinancials();
  }, [selectedSchool]);

  const totalActiveLicenseRevenue = useMemo(() => {
    return schoolsList
      .filter(s => s.subscription?.isActive)
      .reduce((sum, s) => sum + (s.subscription?.price || 0), 0);
  }, [schoolsList]);

  const revenueInMillions = totalActiveLicenseRevenue / 1_000_000;

  // 6 Last Months Financial Flow (Mars 2026 to Août 2026) - Derived directly from dynamic SQL
  const sixMonthsData = useMemo(() => {
    if (monthlyData && monthlyData.length > 0) {
      return monthlyData;
    }
    return [
      { month: 'Mars 2026', revenus: 0.0, depenses: 0.0, soldeNet: 0.0, marge: 0.0 },
      { month: 'Avril 2026', revenus: 0.0, depenses: 0.0, soldeNet: 0.0, marge: 0.0 },
      { month: 'Mai 2026', revenus: 0.0, depenses: 0.0, soldeNet: 0.0, marge: 0.0 },
      { month: 'Juin 2026', revenus: 0.0, depenses: 0.0, soldeNet: 0.0, marge: 0.0 },
      { month: 'Juillet 2026', revenus: 0.0, depenses: 0.0, soldeNet: 0.0, marge: 0.0 },
      { month: 'Août 2026', revenus: 0.0, depenses: 0.0, soldeNet: 0.0, marge: 0.0 }
    ];
  }, [monthlyData]);

  const expenseCategories = [
    { name: 'Salaires Enseignants & Personnel', percent: 0, amount: '0 M FCFA', color: '#1F4A59' },
    { name: 'Fournitures Scolaires & Manuels', percent: 0, amount: '0 M FCFA', color: '#3B82F6' },
    { name: 'Maintenance, Travaux & Logistique', percent: 0, amount: '0 M FCFA', color: '#10B981' },
    { name: 'Énergie, Eau & Connectivité', percent: 0, amount: '0 M FCFA', color: '#F59E0B' },
    { name: 'Activités Périscolaires & Divers', percent: 0, amount: '0 M FCFA', color: '#EC4899' }
  ];

  const total6MRevenues = sixMonthsData.reduce((a, c) => a + c.revenus, 0);
  const total6MExpenses = sixMonthsData.reduce((a, c) => a + c.depenses, 0);
  const total6MNet = total6MRevenues - total6MExpenses;
  const avgMargin = (sixMonthsData.reduce((a, c) => a + c.marge, 0) / sixMonthsData.length).toFixed(1);

  const percentGrowthStr = useMemo(() => {
    if (sixMonthsData.length < 2) return "Aucun flux";
    const firstVal = sixMonthsData[0].revenus;
    const lastVal = sixMonthsData[sixMonthsData.length - 1].revenus;
    if (firstVal === 0) {
      return lastVal > 0 ? `+100% croissance` : "Aucune transaction";
    }
    const growth = ((lastVal - firstVal) / firstVal) * 100;
    return `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% croissance`;
  }, [sixMonthsData]);

  const expenseRatioStr = useMemo(() => {
    if (total6MRevenues === 0) return "Aucune charge";
    const ratio = (total6MExpenses / total6MRevenues) * 100;
    return `Charges représentant ${ratio.toFixed(1)}% des revenus`;
  }, [total6MRevenues, total6MExpenses]);

  const investmentCapacityStr = useMemo(() => {
    if (total6MNet > 0) return "Capacité d'investissement positive";
    if (total6MNet < 0) return "Déficit d'exploitation enregistré";
    return "Aucun flux de trésorerie";
  }, [total6MNet]);

  const performanceStr = useMemo(() => {
    const margin = Number(avgMargin);
    if (margin > 20) return "Rendement financier optimal";
    if (margin > 0) return "Rendement financier positif";
    return "Aucun rendement enregistré";
  }, [avgMargin]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1F4A59] to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" />
              Trajectoire Budgétaire Semestrielle
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">
            Revenus vs Dépenses (6 Derniers Mois)
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Analyse comparative de l'évolution des recettes et charges par établissement.
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700 shrink-0">
          <Building2 className="w-4 h-4 text-emerald-400 ml-1" />
          <select
            value={selectedSchool}
            onChange={(e) => setSelectedSchool(e.target.value)}
            className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer pr-2"
          >
            <option value="all" className="bg-slate-900 text-white">Tous les Établissements (Consolidé)</option>
            {schoolsList.map(s => (
              <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Revenus 6 Mois</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {total6MRevenues.toFixed(1)} M FCFA
          </p>
          <span className="text-[11px] text-emerald-600 font-bold">{percentGrowthStr}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Dépenses 6 Mois</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {total6MExpenses.toFixed(1)} M FCFA
          </p>
          <span className="text-[11px] text-slate-400 font-medium">{expenseRatioStr}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Marge Nette Dégagée</span>
            <DollarSign className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            +{total6MNet.toFixed(1)} M FCFA
          </p>
          <span className="text-[11px] text-slate-400 font-medium">{investmentCapacityStr}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Taux de Marge Moyen</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
            {avgMargin}%
          </p>
          <span className="text-[11px] text-purple-600 font-bold">{performanceStr}</span>
        </div>
      </div>

      {/* Main Area Chart: 6-Month Trend */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#1F4A59] dark:text-sky-400" />
              <span>Courbe Comparative des Flux de Trésorerie (Mars - Août 2026)</span>
            </h2>
            <p className="text-xs text-slate-400">Comparaison mensuelle des encaissements réels vs décaissements engagés</p>
          </div>
        </div>

        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sixMonthsData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                </linearGradient>
                <linearGradient id="colorDepenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis stroke="#64748b" unit="M" tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff' }}
                formatter={(val: any) => [`${val} M FCFA`]}
              />
              <Legend verticalAlign="top" height={36} />
              <Area type="monotone" dataKey="revenus" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenus)" name="Revenus Mensuels" />
              <Area type="monotone" dataKey="depenses" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDepenses)" name="Dépenses d'Exploitation" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown by Category & Ledger Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ledger Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
            <span>Grand Livre Mensuel Consolidé</span>
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200 font-medium">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Mois</th>
                  <th className="px-4 py-3">Revenus</th>
                  <th className="px-4 py-3">Dépenses</th>
                  <th className="px-4 py-3">Solde Net</th>
                  <th className="px-4 py-3">Marge (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {sixMonthsData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.month}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{row.revenus.toFixed(1)} M</td>
                    <td className="px-4 py-3 font-mono text-rose-500">{row.depenses.toFixed(1)} M</td>
                    <td className="px-4 py-3 font-mono font-black text-[#1F4A59] dark:text-sky-400">+{row.soldeNet.toFixed(1)} M</td>
                    <td className="px-4 py-3 font-mono font-bold">{row.marge}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expense Category Breakdown */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-500" />
            <span>Structure des Postes de Dépenses</span>
          </h2>

          <div className="space-y-3 pt-2">
            {expenseCategories.map((cat, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300 truncate pr-2">{cat.name}</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">{cat.percent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full"
                    style={{ width: `${cat.percent}%`, backgroundColor: cat.color }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 font-mono block text-right">{cat.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminRevenuesExpensesPage;
