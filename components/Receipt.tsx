import React, { useState } from 'react';
import { Transaction, SchoolSettings } from '../App';
import { PrinterIcon, SignatureIcon, FileDownloadIcon } from './Icons';
import { generateReceiptPdf, downloadReceiptElementAsPdf } from '../utils/receiptPdfGenerator';

interface ReceiptProps {
  transactions?: Transaction[];
  transaction?: Transaction;
  onClose?: () => void;
  schoolSettings: SchoolSettings;
}

const QrCodePlaceholder = () => (
    <svg width="80" height="80" viewBox="0 0 100 100" className="mx-auto">
        <rect width="100" height="100" fill="#f3f4f6" />
        <rect x="10" y="10" width="25" height="25" fill="#374151" />
        <rect x="15" y="15" width="15" height="15" fill="#f3f4f6" />
        <rect x="65" y="10" width="25" height="25" fill="#374151" />
        <rect x="70" y="15" width="15" height="15" fill="#f3f4f6" />
        <rect x="10" y="65" width="25" height="25" fill="#374151" />
        <rect x="15" y="70" width="15" height="15" fill="#f3f4f6" />
        <rect x="45" y="45" width="10" height="10" fill="#374151" />
        <rect x="65" y="45" width="10" height="10" fill="#374151" />
    </svg>
);

const Receipt: React.FC<ReceiptProps> = ({ transactions, transaction, onClose, schoolSettings }) => {
  const [isSigned, setIsSigned] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const txList = transactions || (transaction ? [transaction] : []);

  if (!txList || txList.length === 0) {
      return <div className="p-4 text-center">Aucune transaction à afficher.</div>;
  }
  
  const now = new Date(txList[0].date);
  const receiptId = txList[0].id.split('_')[0];
  const totalAmount = txList.reduce((sum, t) => sum + t.amount, 0);
  const currency = schoolSettings.currency;

  const ReceiptContent = () => (
    <div className="p-2 font-mono text-xs text-black w-full bg-white relative">
        <div className="text-center mb-2">
            <h1 className="font-bold text-sm">{schoolSettings.name}</h1>
            <p>{schoolSettings.address}</p>
            <p>TEL: {schoolSettings.contact}</p>
        </div>

        <div className="my-2 border-t border-b border-dashed border-black py-1">
            <div className="flex justify-between">
                <span>REÇU No:</span>
                <span className="font-bold">{receiptId}</span>
            </div>
            <div className="flex justify-between">
                <span>Date:</span>
                <span>{now.toLocaleDateString('fr-FR')} {now.toLocaleTimeString('fr-FR')}</span>
            </div>
            <div className="flex justify-between">
                <span>Caissier(e):</span>
                <span>John Smith</span>
            </div>
        </div>

        <p className="font-bold text-left mb-1">DÉTAILS DU PAIEMENT :</p>
        
        {txList.map(t => (
            <div key={t.id} className="flex justify-between items-center py-0.5">
                <span>{t.description.replace('Frais de scolarité - ', '')}</span>
                <span className="font-semibold">{t.amount.toLocaleString('fr-FR')} {currency}</span>
            </div>
        ))}

        <div className="mt-3 pt-2 border-t-2 border-solid border-black">
            <div className="flex justify-between font-bold text-sm">
                <span>MONTANT TOTAL PAYÉ</span>
                <span>{totalAmount.toLocaleString('fr-FR')} {currency}</span>
            </div>
        </div>

        <div className="mt-4 text-center">
            <QrCodePlaceholder />
        </div>

        <div className="text-center font-bold text-sm my-3">! Merci pour votre paiement !</div>
        
        <div className="mt-8 flex justify-between items-center text-xs">
            <div className="text-center">
                <p className="border-t border-black px-4 pt-1">Le Gestionnaire</p>
            </div>
            <div className="text-center">
                <p className="border-t border-black px-4 pt-1">Le R.A.F</p>
            </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 text-center text-[10px] py-2 border-t border-black bg-white">
            <p>{schoolSettings.name} - {schoolSettings.address} - TEL: {schoolSettings.contact}</p>
            <p className="italic text-gray-500 mt-1">Logiciel conçu par Loukatech.com</p>
        </div>
    </div>
  );

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-a4-content');
    if (!printContent) return;
    
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Reçu de Paiement</title>');
        printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
        printWindow.document.write('<style>@media print { .no-print { display: none; } body { -webkit-print-color-adjust: exact; font-family: monospace !important; } .receipt-page { page-break-after: always; } } @page { size: A4; margin: 0; }</style>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
        return;
      }
    } catch (e) {
      console.warn("window.open blocked, executing fallback in-page print", e);
    }

    // Direct fallback
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      if (document.getElementById('receipt-a4-content')) {
        await downloadReceiptElementAsPdf('receipt-a4-content', receiptId);
      } else if (txList.length > 0) {
        generateReceiptPdf(txList[0], schoolSettings, isSigned);
      }
    } catch (error) {
      console.warn('Fallback to direct jsPDF vector generation:', error);
      if (txList.length > 0) {
        generateReceiptPdf(txList[0], schoolSettings, isSigned);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-[80vh] bg-slate-50 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-inner">
        {/* Scrollable content area */}
        <div className="flex-grow overflow-y-auto p-8 scrollbar-hide">
            <div id="receipt-a4-content" className="bg-white mx-auto shadow-2xl w-[210mm] min-h-[297mm] p-[15mm] receipt-page rounded-sm transform origin-top scale-90 sm:scale-100 transition-transform">
                <div className="flex flex-col h-full gap-8">
                <div className="flex-1 border-b-2 border-dashed border-slate-200 pb-10 relative">
                    <div className="absolute top-0 right-0">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] -rotate-90 origin-right translate-y-10">Copie Établissement</span>
                    </div>
                    <ReceiptContent />
                </div>
                <div className="flex-1 pt-4 relative">
                    <div className="absolute top-4 right-0">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] -rotate-90 origin-right translate-y-10">Copie Client</span>
                    </div>
                    <ReceiptContent />
                </div>
                </div>
            </div>
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 p-6 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex flex-wrap justify-center items-center gap-4 no-print shadow-lg">
            <button 
                onClick={() => setIsSigned(true)} 
                disabled={isSigned} 
                className="px-5 py-3 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-2xl hover:bg-blue-100 font-black text-xs uppercase tracking-widest inline-flex items-center gap-3 disabled:opacity-50 transition-all shadow-sm active:scale-95"
            >
                <SignatureIcon className="w-4 h-4" />
                <span>{isSigned ? 'Signé Numériquement' : 'Apposer Signature'}</span>
            </button>
            <button 
                onClick={handleDownloadPDF} 
                disabled={isDownloading}
                className="px-6 py-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-2xl hover:bg-emerald-100 font-black text-xs uppercase tracking-widest inline-flex items-center gap-3 transition-all disabled:opacity-50 shadow-sm active:scale-95"
                title="Télécharger le reçu au format PDF"
            >
                <FileDownloadIcon className="w-5 h-5" />
                <span>{isDownloading ? 'Génération...' : 'Télécharger PDF'}</span>
            </button>
            <button 
                onClick={handlePrint} 
                className="px-6 py-3 bg-[#1F4A59] text-white rounded-2xl hover:bg-[#153540] font-black text-xs uppercase tracking-widest inline-flex items-center gap-3 transition-all shadow-lg shadow-[#1F4A59]/20 active:scale-95"
            >
                <PrinterIcon className="w-4 h-4" />
                <span>Imprimer Directement</span>
            </button>
            {onClose && (
                <button 
                    onClick={onClose} 
                    className="px-6 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-200 font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                >
                    Fermer
                </button>
            )}
        </div>
    </div>
  );
};

export default Receipt;