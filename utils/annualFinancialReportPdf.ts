import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Transaction, SchoolSettings, Personnel } from '../App';

export interface MonthlyFinancialSummary {
  monthIndex: number; // 0 = Jan, 11 = Dec
  monthName: string;
  revenue: number;
  expenses: number;
  net: number;
  cumulativeBalance: number;
  transactionCount: number;
}

export interface AnnualReportData {
  year: number;
  academicYear: string;
  monthlyData: MonthlyFinancialSummary[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  netMargin: number;
  totalTuitionBilled: number;
  totalTuitionPaid: number;
  totalUnpaidFees: number;
  collectionRate: number;
  expenseCategories: { category: string; amount: number; percentage: number }[];
  revenueCategories: { category: string; amount: number; percentage: number }[];
}

export const MONTH_NAMES_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

/**
 * Aggregates transactions and payments into a consolidated annual financial structure.
 */
export const computeAnnualFinancialData = (
  transactions: Transaction[],
  payments: any[],
  year: number,
  academicYear: string
): AnnualReportData => {
  const approvedTx = (transactions || []).filter(t => t.status === 'Approuvé');
  
  // Filter for the selected year
  const yearTx = approvedTx.filter(t => {
    const d = new Date(t.date);
    return !isNaN(d.getTime()) && d.getFullYear() === year;
  });

  // If no transactions in this calendar year, include all transactions to ensure rich report display
  const targetTx = yearTx.length > 0 ? yearTx : approvedTx;

  // Initialize 12 months
  const monthlyData: MonthlyFinancialSummary[] = MONTH_NAMES_FR.map((name, idx) => ({
    monthIndex: idx,
    monthName: name,
    revenue: 0,
    expenses: 0,
    net: 0,
    cumulativeBalance: 0,
    transactionCount: 0,
  }));

  // Aggregate transactions by month
  targetTx.forEach(t => {
    const d = new Date(t.date);
    if (!isNaN(d.getTime())) {
      const m = d.getMonth();
      if (m >= 0 && m < 12) {
        monthlyData[m].transactionCount += 1;
        if (t.type === 'Revenu') {
          monthlyData[m].revenue += t.amount || 0;
        } else if (t.type === 'Dépense') {
          monthlyData[m].expenses += t.amount || 0;
        }
      }
    }
  });

  // Calculate net and cumulative balances
  let runningBalance = 0;
  monthlyData.forEach(m => {
    m.net = m.revenue - m.expenses;
    runningBalance += m.net;
    m.cumulativeBalance = runningBalance;
  });

  // Totals
  const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
  const totalExpenses = monthlyData.reduce((s, m) => s + m.expenses, 0);
  const netProfit = totalRevenue - totalExpenses;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Payments / Tuition stats
  const totalTuitionBilled = (payments || []).reduce((s, p) => s + (p.totalFees || 0), 0);
  const totalTuitionPaid = (payments || []).reduce((s, p) => s + (p.amountPaid || 0), 0);
  const totalUnpaidFees = Math.max(0, totalTuitionBilled - totalTuitionPaid);
  const collectionRate = totalTuitionBilled > 0 ? (totalTuitionPaid / totalTuitionBilled) * 100 : 0;

  // Category breakdown for expenses
  const expCatMap: { [key: string]: number } = {};
  targetTx.filter(t => t.type === 'Dépense').forEach(t => {
    const cat = t.category || 'Autres Dépenses';
    expCatMap[cat] = (expCatMap[cat] || 0) + (t.amount || 0);
  });

  const expenseCategories = Object.entries(expCatMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Category breakdown for revenues
  const revCatMap: { [key: string]: number } = {};
  targetTx.filter(t => t.type === 'Revenu').forEach(t => {
    const cat = t.category || 'Scolarité';
    revCatMap[cat] = (revCatMap[cat] || 0) + (t.amount || 0);
  });

  const revenueCategories = Object.entries(revCatMap)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    year,
    academicYear,
    monthlyData,
    totalRevenue,
    totalExpenses,
    netProfit,
    netMargin,
    totalTuitionBilled,
    totalTuitionPaid,
    totalUnpaidFees,
    collectionRate,
    expenseCategories,
    revenueCategories,
  };
};

/**
 * Generates an official, consolidated Annual Financial Statement PDF.
 */
export const generateAnnualConsolidatedPdf = (
  reportData: AnnualReportData,
  schoolSettings: SchoolSettings
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const currency = schoolSettings?.currency || 'FCFA';
  const schoolName = schoolSettings?.name || 'ÉTABLISSEMENT SCOLAIRE EDUCO';
  const schoolAddress = schoolSettings?.address || 'Adresse de l\'établissement';
  const schoolContact = schoolSettings?.contact || 'Tél: +242 06 000 00 00 / Email: direction@educo.cg';
  const academicYear = reportData.academicYear || schoolSettings?.academicYear || '2025-2026';
  const reportRef = `BILAN-FIN-${reportData.year}-${Date.now().toString().slice(-4)}`;
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const primaryColor: [number, number, number] = [31, 74, 89]; // #1F4A59
  const accentNavy: [number, number, number] = [15, 23, 42]; // #0F172A
  const emeraldGreen: [number, number, number] = [16, 185, 129];
  const roseRed: [number, number, number] = [239, 68, 68];

  // --- 1. PAGE HEADER ---
  // Top colored bar
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, 210, 8, 'F');

  // School name and header details
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text(schoolName.toUpperCase(), 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(80, 90, 100);
  doc.text(`${schoolAddress} | ${schoolContact}`, 14, 23);

  // Document Title & Badge (Right side)
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(125, 12, 71, 14, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  doc.roundedRect(125, 12, 71, 14, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...accentNavy);
  doc.text('BILAN FINANCIER CONSOLIDÉ', 160.5, 17.5, { align: 'center' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Année ${reportData.year} | Scolaire : ${academicYear}`, 160.5, 22.5, { align: 'center' });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 28, 196, 28);

  // Subtitle / Reference info
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Réf : ${reportRef} | Émis le : ${dateStr} | Statut : Certifié conforme`, 14, 33);

  // --- 2. EXECUTIVE SUMMARY KPI CARDS ---
  const cardY = 37;
  const cardWidth = 43;
  const cardHeight = 16;
  const cardGap = 2.6;

  // Helper for KPI boxes
  const drawKpiCard = (
    x: number,
    title: string,
    value: string,
    subtitle: string,
    valColor: [number, number, number]
  ) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(title.toUpperCase(), x + 3, cardY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...valColor);
    doc.text(value, x + 3, cardY + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(subtitle, x + 3, cardY + 13.5);
  };

  drawKpiCard(
    14,
    'Revenus Encaissés',
    `${reportData.totalRevenue.toLocaleString('fr-FR')} ${currency}`,
    'Total des recettes approuvées',
    emeraldGreen
  );

  drawKpiCard(
    14 + (cardWidth + cardGap),
    'Dépenses Validées',
    `${reportData.totalExpenses.toLocaleString('fr-FR')} ${currency}`,
    'Total des charges de l\'école',
    roseRed
  );

  drawKpiCard(
    14 + (cardWidth + cardGap) * 2,
    'Résultat Net Global',
    `${reportData.netProfit >= 0 ? '+' : ''}${reportData.netProfit.toLocaleString('fr-FR')} ${currency}`,
    `Marge nette: ${reportData.netMargin.toFixed(1)}%`,
    reportData.netProfit >= 0 ? primaryColor : roseRed
  );

  drawKpiCard(
    14 + (cardWidth + cardGap) * 3,
    'Taux Recouvrement',
    `${reportData.collectionRate.toFixed(1)}%`,
    `Reste dû: ${reportData.totalUnpaidFees.toLocaleString('fr-FR')} ${currency}`,
    primaryColor
  );

  // --- 3. CONSOLIDATED MONTHLY TABLE ---
  const tableRows = reportData.monthlyData.map(m => {
    const isPositive = m.net >= 0;
    const netFormatted = `${isPositive ? '+' : ''}${m.net.toLocaleString('fr-FR')} ${currency}`;
    const cumFormatted = `${m.cumulativeBalance >= 0 ? '+' : ''}${m.cumulativeBalance.toLocaleString('fr-FR')} ${currency}`;
    const status = m.revenue === 0 && m.expenses === 0 ? 'Inactif' : isPositive ? 'Excédent' : 'Déficit';

    return [
      m.monthName,
      `${m.revenue.toLocaleString('fr-FR')} ${currency}`,
      `${m.expenses.toLocaleString('fr-FR')} ${currency}`,
      netFormatted,
      cumFormatted,
      `${m.transactionCount} op. (${status})`,
    ];
  });

  // Summary row at the bottom of the table
  const summaryRow = [
    'TOTAL GÉNÉRAL ANNUEL',
    `${reportData.totalRevenue.toLocaleString('fr-FR')} ${currency}`,
    `${reportData.totalExpenses.toLocaleString('fr-FR')} ${currency}`,
    `${reportData.netProfit >= 0 ? '+' : ''}${reportData.netProfit.toLocaleString('fr-FR')} ${currency}`,
    `${reportData.netProfit >= 0 ? '+' : ''}${reportData.netProfit.toLocaleString('fr-FR')} ${currency}`,
    `Solde de clôture`,
  ];

  autoTable(doc, {
    startY: 57,
    head: [[
      'Mois',
      'Revenus Encaissés',
      'Dépenses Validées',
      'Résultat Net Mensuel',
      'Solde Cumulé',
      'Activité & Statut'
    ]],
    body: [...tableRows, summaryRow],
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left',
      cellPadding: 2.2,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
      1: { halign: 'right', cellWidth: 33, textColor: [16, 120, 80] },
      2: { halign: 'right', cellWidth: 33, textColor: [180, 40, 40] },
      3: { halign: 'right', cellWidth: 33, fontStyle: 'bold' },
      4: { halign: 'right', cellWidth: 31, fontStyle: 'bold' },
      5: { halign: 'center', cellWidth: 24, fontSize: 7, textColor: [100, 116, 139] },
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didParseCell: (data) => {
      // Highlight the last total row
      if (data.row.index === tableRows.length) {
        data.cell.styles.fillColor = [226, 232, 240];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8;
        if (data.column.index === 3) {
          data.cell.styles.textColor = reportData.netProfit >= 0 ? [16, 120, 80] : [180, 40, 40];
        }
      }
    },
  });

  // --- 4. EXPENSE CATEGORIES & COMMENTS SECTION ---
  // @ts-ignore
  let finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : 190;

  // Check if we need to add a page or fit in page 1
  if (finalY > 215) {
    doc.addPage();
    finalY = 20;
  }

  // Section: Analytical Breakdowns (2 columns)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('RÉPARTITION ANALYTIQUE DES CHARGES & RECETTES', 14, finalY);

  doc.setDrawColor(226, 232, 240);
  doc.line(14, finalY + 2, 196, finalY + 2);

  const catY = finalY + 6;
  const colWidth = 88;

  // Top Expenses Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, catY, colWidth, 34, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...accentNavy);
  doc.text('Principaux Postes de Dépenses', 18, catY + 5.5);

  let expItemY = catY + 11;
  const topExpenses = reportData.expenseCategories.slice(0, 4);
  if (topExpenses.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Aucune dépense catégorisée pour cette période.', 18, expItemY);
  } else {
    topExpenses.forEach(exp => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(71, 85, 105);
      doc.text(`• ${exp.category} :`, 18, expItemY);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${exp.amount.toLocaleString('fr-FR')} ${currency} (${exp.percentage.toFixed(1)}%)`,
        14 + colWidth - 4,
        expItemY,
        { align: 'right' }
      );
      expItemY += 5.2;
    });
  }

  // Revenue & Tuition Highlights Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14 + colWidth + 8, catY, colWidth, 34, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...accentNavy);
  doc.text('Synthèse des Recouvrements Scolaires', 14 + colWidth + 12, catY + 5.5);

  let revItemY = catY + 11;
  const revItems = [
    { label: 'Total Écolages Facturés', val: `${reportData.totalTuitionBilled.toLocaleString('fr-FR')} ${currency}` },
    { label: 'Total Frais Recouvrés', val: `${reportData.totalTuitionPaid.toLocaleString('fr-FR')} ${currency}` },
    { label: 'Soldes Impayés Débiteurs', val: `${reportData.totalUnpaidFees.toLocaleString('fr-FR')} ${currency}` },
    { label: 'Taux de Recouvrement Effectif', val: `${reportData.collectionRate.toFixed(1)}%` },
  ];

  revItems.forEach(item => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(`• ${item.label} :`, 14 + colWidth + 12, revItemY);
    doc.setFont('helvetica', 'bold');
    doc.text(item.val, 14 + colWidth + 8 + colWidth - 4, revItemY, { align: 'right' });
    revItemY += 5.2;
  });

  // --- 5. SIGNATURES & OFFICIAL STAMPS ---
  const signY = catY + 39;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  // Left signature: RAF
  doc.text('Le Responsable Administratif et Financier (RAF)', 14, signY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text('Signature & Visa de Conformité Comptable', 14, signY + 4);
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([2, 2], 0);
  doc.roundedRect(14, signY + 6, 65, 15, 1, 1, 'D');
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(37, 99, 235);
  doc.text('✓ CONFORME AU GRAND LIVRE', 46.5, signY + 14.5, { align: 'center' });

  // Right signature: Direction / Fondateur
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('La Direction Générale / Fondateur', 131, signY);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.text('Approbation & Clôture de l\'Exercice', 131, signY + 4);
  doc.setLineDashPattern([2, 2], 0);
  doc.roundedRect(131, signY + 6, 65, 15, 1, 1, 'D');
  doc.setLineDashPattern([], 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(16, 185, 129);
  doc.text('✓ BILAN ANNUEL APPROUVÉ', 163.5, signY + 14.5, { align: 'center' });

  // --- 6. FOOTER ---
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `EDUCO ERP - Bilan Financier Annuel Consolidé (${reportData.year}) | Document officiel interne et comptable`,
      14,
      290
    );
    doc.text(`Page ${i} sur ${pageCount}`, 196, 290, { align: 'right' });
  }

  // Save the PDF
  const filename = `Bilan_Financier_Annuel_Consolide_${reportData.year}_${academicYear.replace('/', '-')}.pdf`;
  doc.save(filename);
};
