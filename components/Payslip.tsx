import React, { useState } from 'react';
import { Personnel, RafSettings } from '../App';
import { PrinterIcon, SignatureIcon } from './Icons';

interface PayslipProps {
  personnel: Personnel;
  netAmount: number;
  paymentDetails: {
    primes: { description: string; amount: number }[];
    deductions: { description: string; amount: number }[];
    allowance: number;
    paymentMethod?: string;
    mobileOperator?: string;
    mobileMoneyNumber?: string;
    bankName?: string;
    virementReference?: string;
    chequeNumber?: string;
    salaryPeriod?: string;
    notes?: string;
  } | null;
  onClose?: () => void;
  rafSettings: RafSettings;
  schoolSettings: any;
}

const Payslip: React.FC<PayslipProps> = ({ personnel, netAmount, paymentDetails, onClose, rafSettings, schoolSettings }) => {
  const [isSigned, setIsSigned] = useState(false);
  const printDate = new Date();
  const month = printDate.toLocaleString('fr-FR', { month: 'long' });
  const year = printDate.getFullYear();
  const currency = schoolSettings.currency;
  
  const [lastName, ...firstNameParts] = personnel.name.split(' ');
  const firstName = firstNameParts.join(' ');
  
  const allowance = paymentDetails?.allowance || 0;
  const primes = paymentDetails?.primes || personnel.primes;
  const recurrentDeductions = paymentDetails?.deductions || personnel.deductions;
  
  const totalPrimes = primes.reduce((sum, p) => sum + p.amount, 0) + allowance;

  const grossSalary = personnel.baseSalary + totalPrimes;
  const socialContributions = grossSalary * (rafSettings.salaries.socialContributionsRate / 100);
  const taxableSalary = grossSalary - socialContributions;
  const incomeTax = taxableSalary * (rafSettings.salaries.incomeTaxRate / 100);
  const totalRecurrentDeductions = recurrentDeductions.reduce((sum, d) => sum + d.amount, 0);

  const totalDeductions = totalRecurrentDeductions + socialContributions + incomeTax;
  
  const handlePrint = () => {
    const printContent = document.getElementById('payslip-a4-content');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write('<html><head><title>Bulletin de Paie</title>');
      printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
      printWindow.document.write('<style>@media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; } .payslip-page { page-break-after: always; } } @page { size: A4; margin: 0; }</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent.innerHTML);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };
  
  const salaryItems = [
    { code: '010', label: 'Salaire de Base', base: personnel.baseSalary, gain: personnel.baseSalary },
    ...primes.map((p, i) => ({ code: `03${i}`, label: p.description, base: p.amount, gain: p.amount })),
    ...(allowance > 0 ? [{ code: '040', label: 'Prime Exceptionnelle', base: allowance, gain: allowance }] : []),
    { code: '300', label: `Cotisations Sociales (${rafSettings.salaries.socialContributionsRate}%)`, base: grossSalary, retention: socialContributions },
    { code: '310', label: `Impôt sur le Revenu (${rafSettings.salaries.incomeTaxRate}%)`, base: taxableSalary, retention: incomeTax },
    ...recurrentDeductions.map((d, i) => ({ code: `35${i}`, label: d.description, base: d.amount, retention: d.amount })),
  ];
  
  const PayslipA5Content = () => (
    <div className="bg-white p-3 text-[8px] leading-tight w-full relative">
      {/* Header */}
      <div className="text-center mb-2">
          <h1 className="text-lg font-bold text-gray-800">{schoolSettings.name}</h1>
          <h2 className="text-base font-semibold text-gray-700">BULLETIN DE PAIE DU MOIS DE {month.toUpperCase()} {year}</h2>
      </div>

      {/* Employee Info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 border p-1 mb-2">
          <div className="flex justify-between"><span className="font-semibold">Nom:</span><span>{lastName.toUpperCase()}</span></div>
          <div className="flex justify-between"><span className="font-semibold">N° Matricule:</span><span>{personnel.matricule || 'N/A'}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Prénom:</span><span>{firstName}</span></div>
          <div className="flex justify-between"><span className="font-semibold">N° CNSS:</span><span>{personnel.cnss || 'Non signalé'}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Qualification:</span><span>{personnel.qualification || 'N/A'}</span></div>
          <div className="flex justify-between"><span className="font-semibold">Date d'embauche:</span><span>{personnel.hireDate ? new Date(personnel.hireDate).toLocaleDateString('fr-FR') : 'N/A'}</span></div>
      </div>

      {/* Salary Breakdown */}
      <table className="w-full text-left mb-2">
          <thead className="bg-gray-100">
              <tr>
                  <th className="p-1 border text-[7px]">Code</th>
                  <th className="p-1 border text-[7px]">Libellé de la rubrique</th>
                  <th className="p-1 border text-right text-[7px]">Base</th>
                  <th className="p-1 border text-right text-[7px]">Gains</th>
                  <th className="p-1 border text-right text-[7px]">Retenues</th>
              </tr>
          </thead>
          <tbody>
              {salaryItems.map(item => (
                  <tr key={item.code} className="border-b">
                      <td className="p-1 border">{item.code}</td>
                      <td className="p-1 border">{item.label}</td>
                      <td className="p-1 border text-right">{item.base?.toLocaleString('fr-FR')}</td>
                      <td className="p-1 border text-right">{item.gain?.toLocaleString('fr-FR')}</td>
                      <td className="p-1 border text-right">{item.retention?.toLocaleString('fr-FR')}</td>
                  </tr>
              ))}
          </tbody>
          <tfoot className="font-bold bg-gray-100">
              <tr>
                  <td colSpan={3} className="p-1 border text-center">TOTAUX</td>
                  <td className="p-1 border text-right">{grossSalary.toLocaleString('fr-FR')}</td>
                  <td className="p-1 border text-right">{totalDeductions.toLocaleString('fr-FR')}</td>
              </tr>
          </tfoot>
      </table>

      {/* Summary & Signatures */}
       <div className="grid grid-cols-2 gap-x-4 mb-2 p-1 border">
          <div className="font-bold text-xs bg-gray-200 p-1 text-center col-span-2">
              <span className="font-semibold">NET A PAYER:</span> {netAmount.toLocaleString('fr-FR')} {currency}
          </div>
          {paymentDetails?.paymentMethod && (
            <div className="col-span-2 text-[6.5px] mt-1 text-gray-600 flex flex-wrap justify-between px-1 border-t pt-1">
              <span>Mode de Règlement: <strong className="text-gray-800">{paymentDetails.paymentMethod}</strong></span>
              {paymentDetails.paymentMethod === 'Mobile Money' && (
                <span>Opérateur: <strong className="text-gray-800">{paymentDetails.mobileOperator} ({paymentDetails.mobileMoneyNumber})</strong></span>
              )}
              {paymentDetails.paymentMethod === 'Virement' && (
                <span>Banque: <strong className="text-gray-800">{paymentDetails.bankName}</strong> {paymentDetails.virementReference && `(Ref: ${paymentDetails.virementReference})`}</span>
              )}
              {paymentDetails.paymentMethod === 'Chèque' && (
                <span>Chèque N°: <strong className="text-gray-800">{paymentDetails.chequeNumber}</strong></span>
              )}
              {paymentDetails.salaryPeriod && (
                <span>Période de Paie: <strong className="text-gray-800">{paymentDetails.salaryPeriod}</strong></span>
              )}
            </div>
          )}
      </div>

      <div className="flex justify-between items-end mt-4 h-16">
          <div>
              <p className="font-semibold mb-6">Signature de l'employé :</p>
              <hr className="border-black w-32"/>
          </div>
          <div>
              <p>Date de paie: {printDate.toLocaleDateString('fr-FR')}</p>
              <p className="font-semibold mb-6">Signature de l'employeur:</p>
              <hr className="border-black w-32"/>
               {isSigned && (
                <div className="absolute bottom-4 right-4 transform -rotate-12">
                    <p className="font-cursive text-blue-600 text-lg">Signé Numériquement</p>
                    <p className="text-blue-500 text-[8px]">{new Date().toLocaleString('fr-FR')}</p>
                </div>
              )}
          </div>
      </div>
    </div>
  );
  
  return (
    <div className="flex flex-col h-[80vh] bg-gray-200 rounded-b-lg">
      {/* Scrollable content area */}
      <div className="flex-grow overflow-y-auto p-4">
        <div id="payslip-a4-content" className="bg-white mx-auto shadow-lg w-[210mm] min-h-[297mm] p-[10mm] payslip-page">
            <div className="flex flex-col h-full">
            <div className="flex-1 border-b-2 border-dashed border-gray-400 pb-2">
                <PayslipA5Content />
            </div>
            <div className="flex-1 pt-2">
                <PayslipA5Content />
            </div>
            </div>
        </div>
      </div>
      {/* Fixed footer */}
      <div className="flex-shrink-0 p-4 bg-white border-t text-center space-x-4 no-print flex justify-center items-center">
        <button onClick={() => setIsSigned(true)} disabled={isSigned} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold inline-flex items-center gap-2 disabled:bg-blue-300">
            <SignatureIcon />
            <span>Signature Électronique</span>
        </button>
        <button onClick={handlePrint} className="px-6 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] font-semibold inline-flex items-center gap-2">
          <PrinterIcon />
          <span>Imprimer</span>
        </button>
        {onClose && (
          <button onClick={onClose} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold">
            Fermer
          </button>
        )}
      </div>
    </div>
  );
};

export default Payslip;