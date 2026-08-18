import React from 'react';
import { FileDownloadIcon } from './Icons';
import { SchoolSettings, Transaction } from '../App';
import { generateReceiptPdf } from '../utils/receiptPdfGenerator';

interface StudentPaymentsPageProps {
  paymentInfo?: {
    id: number;
    name: string;
    studentId: string;
    class: string;
    totalFees: number;
    amountPaid: number;
  };
  transactions?: Transaction[];
  schoolSettings?: SchoolSettings;
}

const StudentPaymentsPage: React.FC<StudentPaymentsPageProps> = ({ paymentInfo, transactions, schoolSettings }) => {
  const currency = schoolSettings?.currency || '€';

  if (!paymentInfo) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <h2 className="text-2xl font-bold text-gray-800">Paiements</h2>
        <p className="mt-4 text-gray-600">Aucune information de paiement trouvée pour cet élève.</p>
      </div>
    );
  }

  const balance = paymentInfo.totalFees - paymentInfo.amountPaid;

  const handleDownloadPDF = (transaction: Transaction) => {
    generateReceiptPdf(transaction, schoolSettings || {
      name: 'EDUCO - Établissement Scolaire',
      logo: '',
      address: 'Avenue de l\'Éducation',
      contact: '+242 06 000 00 00',
      email: 'contact@educo.cg',
      currency: currency,
      themeColor: '#1F4A59',
      slogan: "L'Excellence au service du Futur",
      currentYear: '2025-2026',
      academicYear: '2025-2026',
      defaultLanguage: 'Français',
      dashboardView: 'avancé',
    });
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Suivi des Paiements</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-center">
        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">Frais Totaux</p>
          <p className="text-2xl font-bold text-blue-800">{paymentInfo.totalFees.toLocaleString()} {currency}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-sm text-green-700">Total Payé</p>
          <p className="text-2xl font-bold text-green-800">{paymentInfo.amountPaid.toLocaleString()} {currency}</p>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg">
          <p className="text-sm text-orange-700">Solde Restant</p>
          <p className="text-2xl font-bold text-orange-800">{balance.toLocaleString()} {currency}</p>
        </div>
      </div>

      <h3 className="text-xl font-semibold text-gray-700 mb-4">Historique des Transactions</h3>
      <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Reçu PDF</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions?.map(t => (
              <tr key={t.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{t.description}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold text-right">{t.amount.toLocaleString()} {currency}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <button 
                    onClick={() => handleDownloadPDF(t)}
                    className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg inline-flex items-center gap-1.5 transition-colors text-xs font-semibold"
                    title="Télécharger le reçu au format PDF"
                  >
                    <FileDownloadIcon className="w-5 h-5" />
                    <span>PDF</span>
                  </button>
                </td>
              </tr>
            ))}
             {(!transactions || transactions.length === 0) && (
                <tr>
                    <td colSpan={4} className="text-center py-4 text-gray-500">Aucun paiement enregistré.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentPaymentsPage;