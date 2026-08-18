import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Database, BarChart3 } from 'lucide-react';

interface AdminDatabasePopulationChartProps {
  users?: any[];
  payments?: any[];
  personnel?: any[];
  classes?: any[];
  transactions?: any[];
  grades?: any[];
}

export const AdminDatabasePopulationChart: React.FC<AdminDatabasePopulationChartProps> = ({
  users = [],
  payments = [],
  personnel = [],
  classes = [],
  transactions = [],
  grades = []
}) => {
  const studentsCount = users.filter(u => u.role === 'Élève').length;
  const teachersCount = users.filter(u => u.role === 'Enseignant').length;
  const parentsCount = users.filter(u => u.role === 'Parent').length;

  const data = [
    { name: 'Élèves', count: studentsCount, fill: '#3b82f6' },
    { name: 'Paiements', count: payments.length, fill: '#10b981' },
    { name: 'Personnel', count: personnel.length, fill: '#8b5cf6' },
    { name: 'Classes', count: classes.length, fill: '#f59e0b' },
    { name: 'Transactions', count: transactions.length, fill: '#ef4444' },
    { name: 'Notes', count: grades.length, fill: '#14b8a6' },
    { name: 'Enseignants', count: teachersCount, fill: '#6366f1' },
    { name: 'Parents', count: parentsCount, fill: '#ec4899' },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base tracking-tight">
              Preuve Visuelle : Population des Tables Supabase
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Visualisation par histogramme (Recharts) des enregistrements actifs en base de données
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Synchronisé Supabase
        </span>
      </div>

      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" opacity={0.6} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" allowDecimals={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', fontSize: '12px' }}
              formatter={(value: any) => [`${value} enregistrements`, 'Volume']}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Total cumulé : <strong className="text-slate-900 dark:text-slate-100">{data.reduce((sum, d) => sum + d.count, 0)}</strong> enregistrements</span>
        <span className="italic">Base PostgreSQL Supabase connectée</span>
      </div>
    </div>
  );
};
export default AdminDatabasePopulationChart;
