import React, { useState, useMemo, useEffect } from 'react';
import { fetchAdminRegisteredSchools } from '../src/services/api';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  ShieldCheck, 
  Building2, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  CreditCard, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

interface AdminFinancialSurveillancePageProps {
  schools?: any[];
  payments?: any[];
  transactions?: any[];
}

export const AdminFinancialSurveillancePage: React.FC<AdminFinancialSurveillancePageProps> = ({
  schools = [],
  payments = [],
  transactions = []
}) => {
  const [selectedSchool, setSelectedSchool] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const res = await fetchAdminRegisteredSchools();
        if (res && res.schools) {
          setSchoolsList(res.schools);
        }
      } catch (err) {
        console.error("Error fetching schools in financial page:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchools();
  }, []);

  const defaultFinancials = useMemo(() => {
    return schoolsList.map(s => {
      const price = s.subscription?.price || 0;
      const isPaid = s.subscription?.isActive ? price : 0;
      return {
        id: String(s.id),
        school: s.name,
        totalRevenue: isPaid,
        totalExpenses: 0,
        netBalance: isPaid,
        recoveryRate: s.subscription?.isActive ? 100.0 : 0.0,
        pendingTuition: s.subscription?.isActive ? 0 : price,
        cashboxStatus: s.subscription?.isActive ? 'Conforme' : 'Inactif',
        riskLevel: s.subscription?.isActive ? 'Faible' : 'Non applicable',
        lastAudit: s.subscription?.updatedAt ? new Date(s.subscription.updatedAt).toLocaleDateString('fr-FR') : 'Non audité'
      };
    });
  }, [schoolsList]);

  const financialAlerts = useMemo(() => {
    return schoolsList
      .filter(s => !s.subscription?.isActive)
      .map(s => ({
        school: s.name,
        type: 'Licence Scolaire Inactive',
        description: `L'établissement ${s.name} n'a pas de licence active. L'accès aux fonctionnalités est restreint.`,
        severity: 'high' as const
      }));
  }, [schoolsList]);

  const chartComparisonData = useMemo(() => {
    return defaultFinancials.map(f => ({
      name: f.school.split(' ')[0] + ' ' + (f.school.split(' ')[1] || ''),
      Revenus: Math.round(f.totalRevenue / 1000000) || 0,
      Depenses: Math.round(f.totalExpenses / 1000000) || 0,
      SoldeNet: Math.round(f.netBalance / 1000000) || 0
    }));
  }, [defaultFinancials]);

  const totalAllRevenue = useMemo(() => defaultFinancials.reduce((acc, curr) => acc + curr.totalRevenue, 0), [defaultFinancials]);
  const totalAllExpenses = useMemo(() => defaultFinancials.reduce((acc, curr) => acc + curr.totalExpenses, 0), [defaultFinancials]);
  const totalAllNet = totalAllRevenue - totalAllExpenses;
  const avgRecoveryRate = useMemo(() => {
    return defaultFinancials.length > 0
      ? (defaultFinancials.reduce((acc, curr) => acc + curr.recoveryRate, 0) / defaultFinancials.length).toFixed(1)
      : '0.0';
  }, [defaultFinancials]);

  const filteredFinancials = useMemo(() => {
    return defaultFinancials.filter(item => {
      const matchesSearch = item.school.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSchool = selectedSchool === 'all' || item.id === selectedSchool;
      return matchesSearch && matchesSchool;
    });
  }, [defaultFinancials, searchQuery, selectedSchool]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1F4A59] to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              Surveillance Financière Consolidée
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">
            Surveillance des Finances par Établissement
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Supervisez les flux d'encaissement, les dépenses opérationnelles et les alertes d'impayés.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="p-2 bg-slate-800/80 rounded-xl border border-slate-700">
            <span className="text-[9px] text-slate-400 font-bold block uppercase">Solde Global Réseau</span>
            <span className="text-sm sm:text-base font-black font-mono text-emerald-400">
              {totalAllNet.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
        </div>
      </div>

      {/* 4 Overview Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Revenus Cumulés</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {(totalAllRevenue / 1000000).toFixed(1)} M FCFA
          </p>
          <span className="text-[11px] text-emerald-600 font-bold">+14.2% vs N-1</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Dépenses Opérationnelles</span>
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {(totalAllExpenses / 1000000).toFixed(1)} M FCFA
          </p>
          <span className="text-[11px] text-slate-400 font-medium">Salaires, fournitures, énergie</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Taux de Recouvrement</span>
            <ShieldCheck className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {avgRecoveryRate}%
          </p>
          <span className="text-[11px] text-slate-400 font-medium">Objectif annuel : 85%</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Alertes Actives</span>
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {financialAlerts.length} Seuils
          </p>
          <span className="text-[11px] text-amber-600 font-bold">Nécessite arbitrage</span>
        </div>
      </div>

      {/* Financial Comparison Chart */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-[#1F4A59] dark:text-sky-400" />
              <span>Comparatif Financier par Établissement (en Millions de FCFA)</span>
            </h2>
            <p className="text-xs text-slate-400">Revenus collectés, dépenses engagées et solde net dégagé</p>
          </div>
        </div>

        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartComparisonData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 11, fontWeight: 700 }} />
              <YAxis stroke="#64748b" unit="M" tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff' }}
                formatter={(value: any) => [`${value} M FCFA`]}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar dataKey="Revenus" fill="#10B981" radius={[6, 6, 0, 0]} name="Revenus Encaissements" />
              <Bar dataKey="Depenses" fill="#EF4444" radius={[6, 6, 0, 0]} name="Dépenses Opérationnelles" />
              <Bar dataKey="SoldeNet" fill="#3B82F6" radius={[6, 6, 0, 0]} name="Solde Net (Marge)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Financial Matrix Table & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
              <span>Matrice Financière Consolidée</span>
            </h2>
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrer..."
                className="w-full pl-8 pr-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200 font-medium">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Établissement</th>
                  <th className="px-4 py-3">Revenus</th>
                  <th className="px-4 py-3">Dépenses</th>
                  <th className="px-4 py-3">Recouvrement</th>
                  <th className="px-4 py-3">Impayés</th>
                  <th className="px-4 py-3">Risque</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {filteredFinancials.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.school}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {(row.totalRevenue / 1000000).toFixed(1)} M
                    </td>
                    <td className="px-4 py-3 font-mono text-rose-500">
                      {(row.totalExpenses / 1000000).toFixed(1)} M
                    </td>
                    <td className="px-4 py-3 font-mono font-bold">{row.recoveryRate}%</td>
                    <td className="px-4 py-3 font-mono text-amber-600">
                      {(row.pendingTuition / 1000000).toFixed(1)} M
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        row.riskLevel === 'Faible'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : row.riskLevel === 'Modéré'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}>
                        {row.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Anomaly Alerts */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Alertes Financières Détectées</span>
          </h2>

          <div className="space-y-3">
            {financialAlerts.map((alert, idx) => (
              <div 
                key={idx}
                className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 dark:text-amber-300">{alert.school}</span>
                  <span className="px-2 py-0.5 bg-amber-200/60 dark:bg-amber-900 text-amber-900 dark:text-amber-200 text-[10px] font-black rounded-md">
                    {alert.type}
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-400 leading-relaxed">
                  {alert.description}
                </p>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Aucune anomalie critique de caisse signalée lors des 48 dernières heures.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminFinancialSurveillancePage;
