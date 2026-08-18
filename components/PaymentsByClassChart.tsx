import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Class } from './ClassForm';
import { Transaction } from '../App';

type Payment = { id: number; studentId: string; name: string; class: string; totalFees: number; amountPaid: number; };

interface PaymentsByClassChartProps {
    transactions: Transaction[];
    payments: Payment[];
    classes: Class[];
}

const PaymentsByClassChart: React.FC<PaymentsByClassChartProps> = ({ transactions, payments, classes }) => {
    const data = useMemo(() => {
        const studentNameToClassMap = new Map<string, string>();
        payments.forEach(p => {
            studentNameToClassMap.set(p.name, p.class);
        });

        const classPayments = new Map<string, number>();
        classes.forEach(c => classPayments.set(c.name, 0));

        transactions.forEach(t => {
            if (t.type === 'Revenu' && t.description.startsWith('Frais de scolarité - ')) {
                const studentName = t.description.replace('Frais de scolarité - ', '');
                const studentClass = studentNameToClassMap.get(studentName);
                if (studentClass && classPayments.has(studentClass)) {
                    classPayments.set(studentClass, classPayments.get(studentClass)! + t.amount);
                }
            }
        });

        return Array.from(classPayments.entries()).map(([name, amount]) => ({ name, montant: amount }));

    }, [transactions, payments, classes]);


    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-md h-[400px]">
            <h4 className="font-semibold text-gray-700 mb-4">Paiements Approuvés par Classe</h4>
            <ResponsiveContainer width="100%" height="90%">
                <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(value) => `${value / 1000}k`} />
                    <Tooltip formatter={(value: number) => `${value.toLocaleString()} €`} />
                    <Legend />
                    <Bar dataKey="montant" fill="#1F4A59" name="Montant Encaissé" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default PaymentsByClassChart;
