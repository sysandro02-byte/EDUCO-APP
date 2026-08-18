import React from 'react';
import { PencilIcon } from './Icons';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface BudgetTrackerProps {
    spent: number;
    total: number;
    onEdit?: () => void;
    currentUserRole?: string;
    currency?: string;
}

const CustomBudgetTooltip = ({ active, payload, total, currency }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0];
        const value = data.value || 0;
        const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
        return (
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-xl border border-slate-700 shadow-2xl text-xs z-50">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.payload.fill || data.color }} />
                    <span className="font-bold text-slate-200">{data.name}</span>
                </div>
                <div className="text-sm font-black text-emerald-400 mt-1">
                    {Math.round(value).toLocaleString('fr-FR')} {currency}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                    Part : <strong className="text-slate-200">{pct}%</strong> du budget total
                </div>
            </div>
        );
    }
    return null;
};

const BudgetTracker: React.FC<BudgetTrackerProps> = ({ spent, total, onEdit, currentUserRole, currency = 'FCFA' }) => {
    const percentage = total > 0 ? Math.round((spent / total) * 100) : 0;
    const canEdit = currentUserRole === 'Responsable des finances';
    
    // Fake data for visual similarity to mockup
    const spentPart1 = spent * 0.6; // blue
    const spentPart2 = spent * 0.25; // green
    const spentPart3 = spent * 0.15; // red
    const remaining = Math.max(0, total - spent);
    
    const data = [
        { name: 'Dépenses Salariales', value: spentPart1 },
        { name: 'Charges Opérationnelles', value: spentPart2 },
        { name: 'Investissements & Autres', value: spentPart3 },
        { name: 'Budget Disponible', value: remaining },
    ];
    
    const COLORS = ['#3B82F6', '#10B981', '#EF4444', '#1F4A59'];

    return (
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-xl shadow-md border border-white/80 h-full flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-semibold text-gray-700 text-base">Suivi Budgétaire Annuel</h4>
                {canEdit && onEdit && (
                    <button onClick={onEdit} className="text-gray-500 hover:text-gray-800" title="Modifier le budget">
                        <PencilIcon className="w-4 h-4" />
                    </button>
                )}
            </div>
            <div className="flex items-center justify-between gap-4 my-auto">
                <div className="flex-shrink-0">
                     <p className="text-2xl font-bold text-gray-800">{spent.toLocaleString('fr-FR')} {currency}</p>
                     <p className="text-xs text-gray-500">sur {total.toLocaleString('fr-FR')} {currency}</p>
                     <p className="text-xs font-bold text-blue-600 mt-3 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping inline-block" />
                        {percentage}% du budget engagé
                     </p>
                </div>
                <div className="w-36 h-36 flex-shrink-0">
                     <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie 
                                data={data} 
                                cx="50%" 
                                cy="50%" 
                                innerRadius={42} 
                                outerRadius={58} 
                                fill="#8884d8" 
                                paddingAngle={3} 
                                dataKey="value" 
                                stroke="none"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomBudgetTooltip total={total} currency={currency} />} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default BudgetTracker;