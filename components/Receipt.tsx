import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Transaction, SchoolSettings } from '../App';
import { PrinterIcon, SignatureIcon, FileDownloadIcon } from './Icons';
import { generateReceiptPdf, downloadReceiptElementAsPdf } from '../utils/receiptPdfGenerator';

interface ReceiptProps {
  transactions?: Transaction[];
  transaction?: Transaction;
  onClose?: () => void;
  schoolSettings: SchoolSettings;
}

const money = (amount: number, currency: string) => `${Number(amount || 0).toLocaleString('fr-FR')} ${currency}`;
const shortReceiptId = (id?: string) => (id || `REC-${Date.now()}`).split('_')[0];
const cleanDescription = (description = '') => description
  .replace(/^Frais de scolarité \/ mensuels - /i, '')
  .replace(/^Frais de scolarité - /i, '')
  .trim();

const paymentLabel = (transaction: Transaction) => {
  const description = transaction.description || '';
  if (/réinscription|reinscription/i.test(description)) return 'Réinscription';
  if (/inscription/i.test(description)) return 'Inscription';
  if (/dossier d'?examen/i.test(description)) return "Frais de dossier d'examen";
  if (/scolarité|scolarite|mensuels/i.test(description)) return "Frais d'école";
  return transaction.category || 'Encaissement';
};

const receiptPrintStyles = `
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #fff;
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    text-rendering: geometricPrecision;
  }
  .receipt-page {
    width: 80mm;
    margin: 0 auto;
    padding: 3mm;
    background: #fff;
  }
  .ticket-copy {
    color: #000;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12px;
    line-height: 1.24;
    font-weight: 600;
  }
  .ticket-copy + .ticket-copy-wrap {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 2px dashed #000;
  }
  .ticket-header,
  .ticket-section {
    border-bottom: 1.5px dashed #000;
  }
  .ticket-header {
    text-align: center;
    padding-bottom: 8px;
  }
  .ticket-logo {
    width: 34px;
    height: 34px;
    border: 2px solid #000;
    border-radius: 50%;
    margin: 0 auto 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 17px;
    font-weight: 900;
  }
  .ticket-brand {
    margin: 0;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .ticket-school {
    margin: 3px 0;
    font-size: 15px;
    line-height: 1.15;
    font-weight: 900;
    text-transform: uppercase;
  }
  .ticket-small {
    margin: 2px 0;
    font-size: 11px;
    font-weight: 700;
  }
  .ticket-section {
    padding: 7px 0;
  }
  .ticket-title {
    margin: 0 0 7px;
    text-align: center;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .ticket-row {
    display: flex;
    justify-content: space-between;
    gap: 9px;
    margin: 4px 0;
    break-inside: avoid;
  }
  .ticket-label {
    color: #000;
    font-weight: 700;
    white-space: nowrap;
  }
  .ticket-value {
    color: #000;
    text-align: right;
    font-weight: 900;
    overflow-wrap: anywhere;
  }
  .ticket-grid {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 5px 10px;
  }
  .ticket-head {
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .ticket-amount {
    text-align: right;
    font-weight: 900;
    white-space: nowrap;
  }
  .ticket-note {
    margin-top: 7px;
    border: 1px solid #000;
    padding: 5px;
    font-size: 11px;
    font-weight: 700;
  }
  .ticket-total {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 8px;
    margin-bottom: 5px;
    font-size: 12px;
    font-weight: 900;
    text-transform: uppercase;
  }
  .ticket-total strong {
    font-size: 18px;
    font-weight: 900;
    white-space: nowrap;
  }
  .ticket-footer {
    padding-top: 9px;
    text-align: center;
    font-size: 11px;
    font-weight: 700;
  }
  .ticket-qr svg {
    width: 92px;
    height: 92px;
    shape-rendering: crispEdges;
  }
  .ticket-qr-label {
    margin: 4px 0;
    font-size: 10px;
    font-weight: 900;
  }
  .ticket-signature {
    width: 40mm;
    margin: 21px auto 6px;
    padding-top: 4px;
    border-top: 1.5px solid #000;
    font-size: 11px;
    font-weight: 900;
  }
  .ticket-credit {
    margin-top: 7px;
    padding-top: 7px;
    border-top: 1px solid #000;
    font-size: 10px;
    font-style: italic;
    font-weight: 700;
  }
  @media screen {
    body { background: #f1f5f9; }
    .receipt-page { box-shadow: 0 16px 40px rgba(15, 23, 42, .16); }
  }
  @media print {
    .no-print { display: none !important; }
    .receipt-page { box-shadow: none !important; }
  }
`;

const Receipt: React.FC<ReceiptProps> = ({ transactions, transaction, onClose, schoolSettings }) => {
  const [isSigned, setIsSigned] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const txList = transactions || (transaction ? [transaction] : []);

  if (txList.length === 0) return <div className="p-4 text-center">Aucune transaction à afficher.</div>;

  const first = txList[0];
  const summary = (first as any).receiptSummary || {};
  const receiptId = shortReceiptId(first.id);
  const date = new Date(first.date || Date.now());
  const currency = schoolSettings?.currency || 'FCFA';
  const total = txList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const studentName = summary.studentName || cleanDescription(first.description).replace(/\s*\([^)]*\)\s*$/, '') || 'N/A';
  const studentMatricule = summary.studentMatricule || summary.studentId || '';
  const qrPayload = JSON.stringify({
    app: 'EDUCO',
    type: 'ticket-caisse',
    receiptId,
    date: date.toISOString(),
    school: schoolSettings?.name || '',
    student: {
      name: studentName,
      class: summary.studentClass || '',
      matricule: studentMatricule,
      parent: summary.parentName || '',
    },
    payment: {
      label: paymentLabel(first),
      amount: total,
      currency,
      method: first.paymentMethod || 'Espèces',
      totalPaid: summary.totalPaidByStudent ?? total,
      remainingBalance: summary.remainingBalance ?? null,
    },
  });

  const TicketCopy = ({ label }: { label: string }) => (
    <article className="ticket-copy">
      <header className="ticket-header">
        <div className="ticket-logo">E</div>
        <p className="ticket-brand">Educo caisse</p>
        <h1 className="ticket-school">{schoolSettings?.name || 'Établissement scolaire'}</h1>
        {schoolSettings?.slogan && <p className="ticket-small">{schoolSettings.slogan}</p>}
        <p className="ticket-small">{schoolSettings?.address || 'Adresse non renseignée'}</p>
        <p className="ticket-small">TEL: {schoolSettings?.contact || 'N/A'}</p>
      </header>

      <section className="ticket-section">
        <div className="ticket-row"><span className="ticket-label">Ticket N°</span><span className="ticket-value">{receiptId}</span></div>
        <div className="ticket-row"><span className="ticket-label">Date</span><span className="ticket-value">{date.toLocaleDateString('fr-FR')} {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span></div>
        <div className="ticket-row"><span className="ticket-label">Caissier(e)</span><span className="ticket-value">{summary.cashierName || first.approvedBy || 'Caisse Educo'}</span></div>
        <div className="ticket-row"><span className="ticket-label">Copie</span><span className="ticket-value">{label}</span></div>
      </section>

      <section className="ticket-section">
        <p className="ticket-title">Reçu officiel d'encaissement</p>
        <div className="ticket-row"><span className="ticket-label">Élève</span><span className="ticket-value">{studentName}</span></div>
        {studentMatricule && <div className="ticket-row"><span className="ticket-label">Matricule</span><span className="ticket-value">{studentMatricule}</span></div>}
        {summary.studentClass && <div className="ticket-row"><span className="ticket-label">Classe</span><span className="ticket-value">{summary.studentClass}</span></div>}
        {summary.parentName && <div className="ticket-row"><span className="ticket-label">Parent/Tuteur</span><span className="ticket-value">{summary.parentName}</span></div>}
        <div className="ticket-row"><span className="ticket-label">Motif</span><span className="ticket-value">{paymentLabel(first)}</span></div>
        <div className="ticket-row"><span className="ticket-label">Mode paiement</span><span className="ticket-value">{first.paymentMethod || 'Espèces'}</span></div>
        {first.mobileMoneyNumber && <div className="ticket-row"><span className="ticket-label">Réf. mobile</span><span className="ticket-value">{first.mobileMoneyNumber}</span></div>}
      </section>

      <section className="ticket-section">
        <div className="ticket-grid">
          <span className="ticket-head">Désignation</span>
          <span className="ticket-head ticket-amount">Montant</span>
          {txList.map(item => <React.Fragment key={item.id}><span>{paymentLabel(item)}</span><span className="ticket-amount">{money(item.amount, currency)}</span></React.Fragment>)}
        </div>
        {first.notes && <p className="ticket-note"><span>Note: </span>{first.notes}</p>}
      </section>

      <section className="ticket-section">
        <div className="ticket-total"><span>Net encaissé</span><strong>{money(total, currency)}</strong></div>
        {summary.totalPaidByStudent !== undefined && <div className="ticket-row"><span className="ticket-label">Total payé élève</span><span className="ticket-value">{money(summary.totalPaidByStudent, currency)}</span></div>}
        {summary.remainingBalance !== undefined && <div className="ticket-row"><span className="ticket-label">Solde restant</span><span className="ticket-value">{money(summary.remainingBalance, currency)}</span></div>}
      </section>

      <footer className="ticket-footer">
        <div className="ticket-qr"><QRCodeSVG value={qrPayload} size={92} level="H" includeMargin /></div>
        <p className="ticket-qr-label">QR de vérification Educo - {receiptId}</p>
        <p><strong>Merci pour votre paiement.</strong></p>
        <p>Ticket à conserver. Toute réclamation doit présenter ce justificatif.</p>
        <div className="ticket-signature">Cachet / Signature</div>
        {isSigned && <p><strong>SIGNÉ NUMÉRIQUEMENT - {new Date().toLocaleString('fr-FR')}</strong></p>}
        <p className="ticket-credit">Logiciel conçu par Loukatech.com</p>
      </footer>
    </article>
  );

  const handlePrint = () => {
    const printContent = document.getElementById('receipt-a4-content');
    if (!printContent) return;
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write('<html><head><title>Ticket de Caisse Educo</title>');
        printWindow.document.write(`<style>${receiptPrintStyles}</style>`);
        printWindow.document.write('</head><body>');
        printWindow.document.write(printContent.innerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); printWindow.close(); }, 500);
        return;
      }
    } catch (e) {
      console.warn('window.open blocked, executing fallback in-page print', e);
    }
    window.print();
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      if (document.getElementById('receipt-a4-content')) await downloadReceiptElementAsPdf('receipt-a4-content', receiptId);
      else generateReceiptPdf(first, schoolSettings, isSigned);
    } catch (error) {
      console.warn('Fallback to direct jsPDF vector generation:', error);
      generateReceiptPdf(first, schoolSettings, isSigned);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex h-[80vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-inner dark:border-slate-800 dark:bg-slate-900">
      <style>{receiptPrintStyles}</style>
      <div className="flex-grow overflow-y-auto p-5 sm:p-8 scrollbar-hide">
        <div id="receipt-a4-content" className="receipt-page mx-auto w-[80mm] rounded-sm bg-white p-[4mm] shadow-2xl">
          <div className="space-y-4">
            <TicketCopy label="Établissement" />
            <div className="ticket-copy-wrap"><TicketCopy label="Parent / Élève" /></div>
          </div>
        </div>
      </div>

      <div className="no-print flex flex-shrink-0 flex-wrap items-center justify-center gap-4 border-t border-slate-100 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        <button onClick={() => setIsSigned(true)} disabled={isSigned} className="inline-flex items-center gap-3 rounded-2xl bg-blue-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-blue-700 shadow-sm transition-all hover:bg-blue-100 active:scale-95 disabled:opacity-50 dark:bg-blue-900/30 dark:text-blue-400"><SignatureIcon className="h-4 w-4" /><span>{isSigned ? 'Signé Numériquement' : 'Apposer Signature'}</span></button>
        <button onClick={handleDownloadPDF} disabled={isDownloading} className="inline-flex items-center gap-3 rounded-2xl bg-emerald-50 px-6 py-3 text-xs font-black uppercase tracking-widest text-emerald-700 shadow-sm transition-all hover:bg-emerald-100 active:scale-95 disabled:opacity-50 dark:bg-emerald-900/30 dark:text-emerald-400" title="Télécharger le reçu au format PDF"><FileDownloadIcon className="h-5 w-5" /><span>{isDownloading ? 'Génération...' : 'Télécharger PDF'}</span></button>
        <button onClick={handlePrint} className="inline-flex items-center gap-3 rounded-2xl bg-[#1F4A59] px-6 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-[#1F4A59]/20 transition-all hover:bg-[#153540] active:scale-95"><PrinterIcon className="h-4 w-4" /><span>Imprimer Directement</span></button>
        {onClose && <button onClick={onClose} className="rounded-2xl bg-slate-100 px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-600 transition-all hover:bg-slate-200 active:scale-95 dark:bg-slate-700 dark:text-slate-300">Fermer</button>}
      </div>
    </div>
  );
};

export default Receipt;
