import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Transaction, SchoolSettings } from '../App';

/**
 * Generates and downloads a clean, professional A4 Payment Receipt PDF with jspdf.
 * Includes both "Copie Établissement" and "Copie Client" on a single A4 page.
 */
export const generateReceiptPdf = (
  transaction: Transaction,
  schoolSettings: SchoolSettings,
  isSigned = false
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [80, 210],
  });

  const currency = schoolSettings?.currency || 'FCFA';
  const now = new Date(transaction.date || Date.now());
  const receiptId = transaction.id ? transaction.id.split('_')[0] : `REC-${Date.now().toString().slice(-6)}`;
  const summary = (transaction as any)?.receiptSummary || {};
  const totalAmount = Number(transaction.amount || 0);
  const schoolName = schoolSettings?.name || 'ÉTABLISSEMENT SCOLAIRE';
  const studentName = summary.studentName || (transaction.description || 'Paiement').replace(/^Frais de scolarité \/ mensuels - /i, '').replace(/^Frais de scolarité - /i, '').replace(/\s*\([^)]*\)\s*$/, '') || 'N/A';
  const paymentLabel = (() => {
    const desc = transaction.description || '';
    if (/réinscription|reinscription/i.test(desc)) return 'Réinscription';
    if (/inscription/i.test(desc)) return 'Inscription';
    if (/dossier d'?examen/i.test(desc)) return "Frais de dossier d'examen";
    if (/scolarité|scolarite|mensuels/i.test(desc)) return "Frais d'école";
    return transaction.category || 'Encaissement';
  })();
  const money = (value: number) => `${Number(value || 0).toLocaleString('fr-FR')} ${currency}`;
  const drawTextRow = (label: string, value: string, y: number, bold = false) => {
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(95, 105, 115);
    doc.text(label, 5, y);
    doc.setFont('courier', bold ? 'bold' : 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(value || 'N/A', 75, y, { align: 'right', maxWidth: 43 });
  };

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 80, 210, 'F');
  doc.setDrawColor(31, 74, 89);
  doc.setLineWidth(0.5);
  doc.circle(40, 10, 5, 'S');
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(31, 74, 89);
  doc.text('E', 40, 12.2, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text('EDUCO CAISSE', 40, 20, { align: 'center' });
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(schoolName.toUpperCase(), 40, 26, { align: 'center', maxWidth: 70 });
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.3);
  doc.text(schoolSettings?.address || 'Adresse non renseignée', 40, 32, { align: 'center', maxWidth: 70 });
  doc.text(`TEL: ${schoolSettings?.contact || 'N/A'}`, 40, 36, { align: 'center' });

  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, 40, 75, 40);
  doc.setLineDashPattern([], 0);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(31, 74, 89);
  doc.text("REÇU OFFICIEL D'ENCAISSEMENT", 40, 46, { align: 'center' });

  drawTextRow('Ticket N°', receiptId, 54, true);
  drawTextRow('Date', `${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 60, true);
  drawTextRow('Caissier(e)', summary.cashierName || transaction.approvedBy || 'Caisse Educo', 66, true);
  drawTextRow('Élève', studentName, 74, true);
  if (summary.studentClass) drawTextRow('Classe', summary.studentClass, 80, true);
  if (summary.parentName) drawTextRow('Parent/Tuteur', summary.parentName, 86, true);
  drawTextRow('Motif', paymentLabel, 94, true);
  drawTextRow('Mode paiement', transaction.paymentMethod || 'Espèces', 100, true);
  if (transaction.mobileMoneyNumber) drawTextRow('Réf. mobile', transaction.mobileMoneyNumber, 106, true);

  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, 112, 75, 112);
  doc.setLineDashPattern([], 0);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('DÉSIGNATION', 5, 119);
  doc.text('MONTANT', 75, 119, { align: 'right' });
  doc.setFont('courier', 'normal');
  doc.text(paymentLabel, 5, 126, { maxWidth: 42 });
  doc.setFont('courier', 'bold');
  doc.text(money(totalAmount), 75, 126, { align: 'right' });

  let y = 136;
  if (transaction.notes) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.text(`Note: ${transaction.notes}`, 5, y, { maxWidth: 70 });
    y += 10;
  }

  doc.setLineDashPattern([1, 1], 0);
  doc.line(5, y, 75, y);
  doc.setLineDashPattern([], 0);
  y += 8;
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.text('NET ENCAISSÉ', 5, y);
  doc.setFontSize(10.5);
  doc.setTextColor(31, 74, 89);
  doc.text(money(totalAmount), 75, y, { align: 'right' });

  if (summary.totalPaidByStudent !== undefined) {
    y += 8;
    drawTextRow('Total payé élève', money(Number(summary.totalPaidByStudent)), y, true);
  }
  if (summary.remainingBalance !== undefined) {
    y += 6;
    drawTextRow('Solde restant', money(Number(summary.remainingBalance)), y, true);
  }

  y += 14;
  doc.setDrawColor(15, 23, 42);
  doc.rect(28, y, 24, 24, 'S');
  doc.setFont('courier', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(15, 23, 42);
  doc.text('QR EDUCO', 40, y + 13, { align: 'center' });
  y += 31;
  doc.text(`QR de vérification - ${receiptId}`, 40, y, { align: 'center' });
  y += 7;
  doc.text('Merci pour votre paiement.', 40, y, { align: 'center' });
  y += 6;
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.2);
  doc.text('Ticket à conserver comme justificatif.', 40, y, { align: 'center' });
  y += 13;
  doc.line(24, y, 56, y);
  doc.text('Cachet / Signature', 40, y + 4, { align: 'center' });
  if (isSigned) {
    y += 11;
    doc.setTextColor(37, 99, 235);
    doc.setFont('courier', 'bold');
    doc.text('SIGNÉ NUMÉRIQUEMENT', 40, y, { align: 'center' });
  }
  doc.setTextColor(100, 116, 139);
  doc.setFont('courier', 'italic');
  doc.text('Logiciel conçu par Loukatech.com', 40, 204, { align: 'center' });

  doc.save(`Ticket_Educo_${receiptId}_${now.toISOString().slice(0, 10)}.pdf`);
};

export const createReceiptPdfBlob = (
  transaction: Transaction,
  schoolSettings: SchoolSettings,
  isSigned = false
): Blob => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const currency = schoolSettings?.currency || 'FCFA';
  const now = new Date(transaction.date || Date.now());
  const receiptId = transaction.id ? transaction.id.split('_')[0] : `REC-${Date.now().toString().slice(-6)}`;
  const totalAmount = transaction.amount || 0;
  const summary = (transaction as any)?.receiptSummary || {};
  const description = (transaction.description || 'Paiement Frais de scolarité').replace('Frais de scolarité - ', '');
  const paidTotal = Number(summary.totalPaidByStudent ?? totalAmount);
  const remaining = Number(summary.remainingBalance ?? summary.debt ?? 0);
  const debt = Number(summary.debt ?? remaining);

  doc.setFillColor(31, 74, 89);
  doc.rect(0, 0, 210, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(schoolSettings?.name || 'ÉTABLISSEMENT SCOLAIRE', 105, 13, { align: 'center' });
  doc.setFontSize(9);
  doc.text(`Reçu parent - ${receiptId}`, 105, 20, { align: 'center' });

  doc.setTextColor(31, 74, 89);
  doc.setFontSize(14);
  doc.text('COPIE DU REÇU DE PAIEMENT', 18, 40);

  doc.setTextColor(40, 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Date : ${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, 18, 52);
  doc.text(`Élève : ${summary.studentName || 'N/A'}`, 18, 60);
  doc.text(`Classe : ${summary.studentClass || 'N/A'}`, 18, 68);
  doc.text(`Parent/Tuteur : ${summary.parentName || 'N/A'}`, 18, 76);
  doc.text(`Motif : ${description}`, 18, 84);
  doc.text(`Mode : ${transaction.paymentMethod || 'Espèces / Caisse'}`, 18, 92);

  doc.setFillColor(243, 246, 248);
  doc.roundedRect(18, 105, 174, 48, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text(`Montant encaissé par la caisse : ${totalAmount.toLocaleString('fr-FR')} ${currency}`, 26, 118);
  doc.text(`Montant total payé par l'élève : ${paidTotal.toLocaleString('fr-FR')} ${currency}`, 26, 130);
  doc.text(`Reste à payer : ${remaining.toLocaleString('fr-FR')} ${currency}`, 26, 142);
  doc.text(`Dette actuelle : ${debt.toLocaleString('fr-FR')} ${currency}`, 112, 142);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  doc.text('Message système : merci pour votre paiement. Ce reçu est une copie transmise au parent/tuteur.', 105, 170, { align: 'center' });
  doc.text(`Contact école : ${schoolSettings?.contact || 'N/A'} • ${schoolSettings?.address || ''}`, 105, 178, { align: 'center' });

  return doc.output('blob');
};

/**
 * Captures an HTML element (like #receipt-a4-content) and converts it to a PDF using html2canvas & jspdf.
 */
export const downloadReceiptElementAsPdf = async (
  elementId: string,
  receiptId: string
) => {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
  const canvasWidthMm = imgWidth * ratio;
  const canvasHeightMm = imgHeight * ratio;
  const marginX = (pdfWidth - canvasWidthMm) / 2;
  const marginY = (pdfHeight - canvasHeightMm) / 2;

  pdf.addImage(imgData, 'PNG', marginX, marginY, canvasWidthMm, canvasHeightMm);
  const cleanId = receiptId ? receiptId.split('_')[0] : 'paiement';
  pdf.save(`Recu_${cleanId}_${new Date().toISOString().slice(0, 10)}.pdf`);
};
