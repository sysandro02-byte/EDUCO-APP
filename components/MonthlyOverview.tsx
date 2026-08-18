import React from 'react';
import { Personnel } from '../App';

interface MonthlyOverviewProps {
    personnel: Personnel[];
    payments: any[]; // Simplified type for payments
    currency: string;
}

const MonthlyOverview: React.FC<MonthlyOverviewProps> = ({ personnel, payments, currency }) => {
    // 1. Calculate expected monthly revenue
    // Assume school operates for 10 months
    const totalAnnualFees = payments.reduce((sum, p) => sum + p.totalFees, 0);
    const expectedMonthlyRevenue = totalAnnualFees / 10;

    // 2. Calculate estimated monthly expenses
    const isTeacher = (p: Personnel) => p.role === 'Enseignant';
    const isSecondaryTeacher = (p: Personnel) => isTeacher(p) && (p.direction?.includes('Secondaire') || p.direction?.includes('Collège'));
    const isPrimaryTeacher = (p: Personnel) => isTeacher(p) && (p.direction?.includes('Primaire') || p.direction?.includes('Maternelle'));
    const isAdminStaff = (p: Personnel) => !isTeacher(p);

    const secondaryPayroll = personnel
        .filter(isSecondaryTeacher)
        .reduce((sum, p) => sum + p.baseSalary, 0);

    const primaryPayroll = personnel
        .filter(isPrimaryTeacher)
        .reduce((sum, p) => sum + p.baseSalary, 0);

    const adminPayroll = personnel
        .filter(isAdminStaff)
        .reduce((sum, p) => sum + p.baseSalary, 0);

    const formatCurrency = (amount: number) => `${Math.round(amount).toLocaleString('fr-FR')} ${currency}`;

    return (
        <div className="bg-white/70 backdrop-blur-md p-6 rounded-xl shadow-md border border-white/80 h-full">
            <h4 className="font-semibold text-gray-700 mb-4 text-base">Aperçu Mensuel Estimé</h4>
            <div className="space-y-4">
                {/* Expected Revenue */}
                <div>
                    <h5 className="font-semibold text-sm text-gray-600">Attentes de Revenus</h5>
                    <div className="flex justify-between items-center mt-1 p-2 bg-green-50 rounded-md">
                        <span className="text-sm">Scolarité attendue</span>
                        <span className="font-bold text-green-700">{formatCurrency(expectedMonthlyRevenue)}</span>
                    </div>
                </div>

                {/* Estimated Expenses */}
                <div>
                    <h5 className="font-semibold text-sm text-gray-600">Dépenses (Masse Salariale)</h5>
                    <div className="space-y-1 mt-1 text-sm p-2 bg-red-50 rounded-md">
                         <div className="flex justify-between">
                            <span>Collège & Lycée</span>
                            <span className="font-semibold text-red-700">{formatCurrency(secondaryPayroll)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Direction & Admin.</span>
                            <span className="font-semibold text-red-700">{formatCurrency(adminPayroll)}</span>
                        </div>
                         <div className="flex justify-between">
                            <span>Garderie, Préscolaire & Primaire</span>
                            <span className="font-semibold text-red-700">{formatCurrency(primaryPayroll)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MonthlyOverview;
