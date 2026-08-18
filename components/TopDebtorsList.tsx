

import React from 'react';

interface Payment {
    id: number;
    name: string;
    class: string;
    totalFees: number;
    amountPaid: number;
}

interface TopDebtorsListProps {
    payments: Payment[];
    currency: string;
}

const TopDebtorsList: React.FC<TopDebtorsListProps> = ({ payments, currency }) => {
    const topDebtors = payments
        .map(p => ({
            ...p,
            balance: p.totalFees - p.amountPaid,
        }))
        .filter(p => p.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 4);

    return (
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-xl shadow-md border border-white/80 h-full">
            <h4 className="font-semibold text-gray-700 mb-4">Élèves avec Solde Important</h4>
            <ul className="space-y-0 divide-y divide-gray-200">
                {topDebtors.map((student) => (
                    <li key={student.id} className="flex justify-between items-center py-3">
                        <div>
                            <p className="font-medium text-gray-800 text-sm">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.class}</p>
                        </div>
                        <p className="font-semibold text-sm text-red-600">{student.balance.toLocaleString()} {currency}</p>
                    </li>
                ))}
                 {topDebtors.length === 0 && (
                    <li className="text-center text-sm text-gray-500 py-4">Aucun solde important à afficher.</li>
                )}
            </ul>
        </div>
    );
};

export default TopDebtorsList;