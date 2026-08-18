
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CustomRevenueTooltip = ({ active, payload, label, currency = 'FCFA' }: any) => {
  if (active && payload && payload.length >= 2) {
    const revenue = payload.find((p: any) => p.dataKey === 'revenue')?.value || 0;
    const expenses = payload.find((p: any) => p.dataKey === 'expenses')?.value || 0;
    const net = revenue - expenses;
    const margin = revenue > 0 ? ((net / revenue) * 100).toFixed(1) : '0';

    return (
      <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-xl border border-slate-700 shadow-2xl text-xs min-w-[210px]">
        <p className="font-bold text-slate-200 pb-2 mb-2 border-b border-slate-700/80 flex items-center justify-between">
          <span>Période : {label}</span>
          <span className="text-[10px] text-slate-400">Mensuel</span>
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Revenus :
            </span>
            <strong className="text-emerald-300 font-bold">{revenue.toLocaleString('fr-FR')} {currency}</strong>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Dépenses :
            </span>
            <strong className="text-rose-300 font-bold">{expenses.toLocaleString('fr-FR')} {currency}</strong>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">Résultat Net :</span>
            <strong className={`font-black ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {net >= 0 ? '+' : ''}{net.toLocaleString('fr-FR')} {currency} ({margin}%)
            </strong>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

interface RevenueChartCardProps {
  transactions?: any[];
  currency?: string;
}

const RevenueChartCard: React.FC<RevenueChartCardProps> = ({ transactions = [], currency = 'FCFA' }) => {
  const computedData = useMemo(() => {
    // Determine the last 6 months list dynamically
    const monthsList = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return {
        month: d.toLocaleDateString('fr-FR', { month: 'short' }),
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        revenue: 0,
        expenses: 0,
      };
    });

    let hasData = false;
    transactions.forEach(t => {
      const tDate = new Date(t.date || t.timestamp);
      const mIndex = tDate.getMonth();
      const yVal = tDate.getFullYear();
      
      const match = monthsList.find(m => m.monthIndex === mIndex && m.year === yVal);
      if (match) {
        const amt = Number(t.amount) || 0;
        if (t.type === 'Revenu' && (t.status === 'Approuvé' || t.status === 'success' || !t.status)) {
          match.revenue += amt;
          if (amt > 0) hasData = true;
        } else if (t.type === 'Dépense' && (t.status === 'Approuvé' || t.status === 'success' || !t.status)) {
          match.expenses += amt;
          if (amt > 0) hasData = true;
        }
      }
    });

    return monthsList.map(({ month, revenue, expenses }) => {
      // Capitalize first letter of month
      const capitalized = month.charAt(0).toUpperCase() + month.slice(1, 3);
      return {
        month: capitalized,
        revenue,
        expenses,
      };
    });
  }, [transactions]);

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/60 h-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-bold text-gray-800 dark:text-slate-100 text-base">Revenus vs Dépenses (6 derniers mois)</h4>
          <p className="text-xs text-gray-500 dark:text-slate-400">Évolution de la rentabilité et des charges d'exploitation</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300">
          Suivi Financier
        </span>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={computedData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94A3B8" opacity={0.2} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#64748B', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Number(value).toLocaleString()} ${currency}`} />
            <Tooltip content={<CustomRevenueTooltip currency={currency} />} />
            <Legend iconType="circle" iconSize={8} verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px', paddingBottom: '10px' }}/>
            <Line type="monotone" dataKey="revenue" name="Revenus Encaissés" stroke="#10B981" strokeWidth={3} dot={{ r: 3, fill: '#10B981' }} activeDot={{ r: 6, strokeWidth: 2, fill: '#059669' }} isAnimationActive={false} />
            <Line type="monotone" dataKey="expenses" name="Dépenses d'Exploitation" stroke="#EF4444" strokeWidth={3} dot={{ r: 3, fill: '#EF4444' }} activeDot={{ r: 6, strokeWidth: 2, fill: '#DC2626' }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChartCard;