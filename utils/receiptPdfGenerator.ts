import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Transaction, SchoolSettings } from '../App';

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
    format: 'a4',
  });

  const currency = schoolSettings?.currency || '€';
  const now = new Date(transaction.date || Date.now());
  const receiptId = transaction.id ? transaction.id.split('_')[0] : `REC-${Date.now().toString().slice(-6)}`;
  const totalAmount = transaction.amount || 0;
  const description = (transaction.description || 'Paiement Frais de scolarité').replace('Frais de scolarité - ', '');

  const drawReceiptSection = (startY: number, copyTitle: string) => {
    const pageWidth = 210;
    const margin = 18;
    const contentWidth = pageWidth - margin * 2;

    // Header bar
    doc.setFillColor(31, 74, 89); // #1F4A59
    doc.roundedRect(margin, startY, contentWidth, 7.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(copyTitle, pageWidth / 2, startY + 5.2, { align: 'center' });

    // School Name & Contact
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(31, 74, 89);
    doc.text(schoolSettings?.name || 'ÉTABLISSEMENT SCOLAIRE', pageWidth / 2, startY + 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.text(schoolSettings?.address || 'Adresse de l\'établissement', pageWidth / 2, startY + 19.5, { align: 'center' });
    doc.text(`TÉL : ${schoolSettings?.contact || 'N/A'}`, pageWidth / 2, startY + 23.5, { align: 'center' });

    // Dashed divider
    doc.setDrawColor(190, 190, 190);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(margin, startY + 26.5, margin + contentWidth, startY + 26.5);
    doc.setLineDashPattern([], 0);

    // Meta box
    const metaY = startY + 32;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('REÇU N° :', margin + 4, metaY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(receiptId, margin + 22, metaY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Date & Heure :', margin + 60, metaY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(`${now.toLocaleDateString('fr-FR')} ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, margin + 83, metaY);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Mode :', margin + 128, metaY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(20, 20, 20);
    doc.text(transaction.paymentMethod || 'Espèces / Caisse', margin + 141, metaY);

    // Table Header
    const tableY = startY + 39;
    doc.setFillColor(243, 246, 248);
    doc.rect(margin, tableY, contentWidth, 7, 'F');
    doc.setDrawColor(210, 220, 225);
    doc.setLineWidth(0.2);
    doc.rect(margin, tableY, contentWidth, 7, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(31, 74, 89);
    doc.text('DÉSIGNATION / DÉTAILS DU PAIEMENT', margin + 4, tableY + 4.8);
    doc.text('MONTANT ENCAISSÉ', margin + contentWidth - 4, tableY + 4.8, { align: 'right' });

    // Table Row
    const rowY = tableY + 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 30);
    doc.text(description, margin + 4, rowY);
    doc.setFont('helvetica', 'bold');
    doc.text(`${totalAmount.toLocaleString('fr-FR')} ${currency}`, margin + contentWidth - 4, rowY, { align: 'right' });

    // Total Amount Box
    const totalY = rowY + 6;
    doc.setFillColor(232, 242, 246);
    doc.rect(margin, totalY, contentWidth, 8.5, 'F');
    doc.setDrawColor(31, 74, 89);
    doc.setLineWidth(0.3);
    doc.rect(margin, totalY, contentWidth, 8.5, 'D');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(31, 74, 89);
    doc.text('MONTANT TOTAL PAYÉ', margin + 4, totalY + 5.8);
    doc.setFontSize(10.5);
    doc.text(`${totalAmount.toLocaleString('fr-FR')} ${currency}`, margin + contentWidth - 4, totalY + 5.8, { align: 'right' });

    // Footer & Signature
    const footerY = totalY + 14;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text('! Merci pour votre paiement ! Conservez ce reçu comme preuve de règlement.', pageWidth / 2, footerY, { align: 'center' });

    // Signature stamp area
    const sigY = footerY + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text('Cachet et Signature autorisée', margin + contentWidth - 28, sigY, { align: 'center' });

    if (isSigned) {
      doc.setDrawColor(37, 99, 235);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(margin + contentWidth - 52, sigY + 2, 50, 11, 1, 1, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(37, 99, 235);
      doc.text('✓ SIGNÉ NUMÉRIQUEMENT', margin + contentWidth - 27, sigY + 6.5, { align: 'center' });
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(new Date().toLocaleString('fr-FR'), margin + contentWidth - 27, sigY + 10.5, { align: 'center' });
    }
  };

  // Render Top Section
  drawReceiptSection(12, '** COPIE ÉTABLISSEMENT **');

  // Cut line
  doc.setDrawColor(180, 180, 180);
  doc.setLineDashPattern([3, 3], 0);
  doc.line(12, 146, 198, 146);
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('✂  - - - - - - - - - - - - - - - - - - - - - DÉCOUPER ICI - - - - - - - - - - - - - - - - - - - - -  ✂', 105, 148, { align: 'center' });
  doc.setLineDashPattern([], 0);

  // Render Bottom Section
  drawReceiptSection(154, '** COPIE CLIENT / ÉLÈVE **');

  // Download
  const filename = `Recu_${receiptId}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
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
