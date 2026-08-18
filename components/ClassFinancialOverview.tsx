import React, { useMemo } from 'react';
import { Class } from './ClassForm';

type Payment = {
    id: number;
    studentId: string;
    name: string;
    class: string;
    totalFees: number;
    amountPaid: number;
};

interface ClassFinancialOverviewProps {
    payments: Payment[];
    classes: Class[];
    currency: string;
}

const ProgressBar: React.FC<{ value: number }> = ({ value }) => {
    const getColor = (val: number) => {
        if (val < 50) return 'bg-red-500';
        if (val < 90) return 'bg-yellow-500';
        return 'bg-green-500';
    };
    return (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className={`${getColor(value)} h-2.5 rounded-full`} style={{ width: `${value}%` }}></div>
        </div>
    );
};

const ClassFinancialOverview: React.FC<ClassFinancialOverviewProps> = ({ payments, classes, currency }) => {
    const financialDataByCycle = useMemo(() => {
        const classToLevelMap = new Map(classes.map(c => [c.name, c.level]));

        const classStats = new Map<string, { totalFees: number, amountPaid: number, studentCount: number }>();
        payments.forEach(p => {
            if (!classStats.has(p.class)) {
                classStats.set(p.class, { totalFees: 0, amountPaid: 0, studentCount: 0 });
            }
            const stats = classStats.get(p.class)!;
            stats.totalFees += p.totalFees;
            stats.amountPaid += p.amountPaid;
            stats.studentCount += 1;
        });

        const cycleData = new Map<string, { totalFees: number, amountPaid: number, classes: any[] }>();
        classStats.forEach((stats, className) => {
            const level = (classToLevelMap.get(className) as string) || 'Non Classé';
            if (!cycleData.has(level)) {
                cycleData.set(level, { totalFees: 0, amountPaid: 0, classes: [] });
            }
            const cycle = cycleData.get(level)!;
            const balance = stats.totalFees - stats.amountPaid;
            const collectionRate = stats.totalFees > 0 ? (stats.amountPaid / stats.totalFees) * 100 : 0;
            
            cycle.totalFees += stats.totalFees;
            cycle.amountPaid += stats.amountPaid;
            cycle.classes.push({ name: className, ...stats, balance, collectionRate });
        });
        
        const cycleOrder = ['Maternelle', 'Primaire', 'Collège', 'Lycée', 'Non Classé'];
        const result = Array.from(cycleData.entries())
            .map(([name, data]: [string, { totalFees: number; amountPaid: number; classes: any[]; }]) => ({
                name,
                ...data,
                balance: data.totalFees - data.amountPaid,
                collectionRate: data.totalFees > 0 ? (data.amountPaid / data.totalFees) * 100 : 0,
            }))
            // FIX: Explicitly typed the parameters 'a' and 'b' in the sort callback to resolve a type inference issue where their properties were incorrectly inferred as 'unknown', causing an error when passed to `indexOf`.
            .sort((a: { name: string }, b: { name: string }) => cycleOrder.indexOf(a.name) - cycleOrder.indexOf(b.name));

        return result;
    }, [payments, classes]);

    const formatCurrency = (amount: number) => `${amount.toLocaleString('fr-FR')} ${currency}`;

    const gradientClasses = [
        'from-blue-100 to-blue-200',
        'from-green-100 to-green-200',
        'from-purple-100 to-purple-200',
        'from-yellow-100 to-yellow-200',
        'from-gray-100 to-gray-200',
    ];

    return (
        <div className="space-y-8">
            {financialDataByCycle.map((cycle, index) => (
                <div key={cycle.name} className={`p-6 rounded-xl shadow-lg border bg-gradient-to-br ${gradientClasses[index % gradientClasses.length]}`}>
                    <h3 className="text-2xl font-bold text-gray-800 mb-4">Cycle {cycle.name}</h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 text-center">
                        <div className="bg-white/50 p-3 rounded-lg"><p className="text-sm text-gray-600">Total Frais</p><p className="font-bold text-lg">{formatCurrency(cycle.totalFees)}</p></div>
                        <div className="bg-white/50 p-3 rounded-lg"><p className="text-sm text-gray-600">Total Encaissé</p><p className="font-bold text-lg text-green-700">{formatCurrency(cycle.amountPaid)}</p></div>
                        <div className="bg-white/50 p-3 rounded-lg"><p className="text-sm text-gray-600">Solde Restant</p><p className="font-bold text-lg text-red-700">{formatCurrency(cycle.balance)}</p></div>
                        <div className="bg-white/50 p-3 rounded-lg"><p className="text-sm text-gray-600">Taux de Recouvrement</p><p className="font-bold text-lg">{cycle.collectionRate.toFixed(1)}%</p></div>
                    </div>

                    <div className="overflow-x-auto bg-white/70 rounded-lg p-2">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50/50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Classe</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Frais</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total Encaissé</th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Solde Restant</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-1/4">Taux Recouvrement</th>
                                </tr>
                            </thead>
                            <tbody className="bg-transparent divide-y divide-gray-200/50">
                                {cycle.classes.map(cls => (
                                    <tr key={cls.name}>
                                        <td className="px-4 py-3 font-medium">{cls.name}</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(cls.totalFees)}</td>
                                        <td className="px-4 py-3 text-right text-green-700">{formatCurrency(cls.amountPaid)}</td>
                                        <td className="px-4 py-3 text-right text-red-700">{formatCurrency(cls.balance)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <ProgressBar value={cls.collectionRate} />
                                                <span className="text-xs font-semibold w-12 text-right">{cls.collectionRate.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ClassFinancialOverview;