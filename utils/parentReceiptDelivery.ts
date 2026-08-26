import type { Transaction, SchoolSettings } from '../App';
import { createReceiptPdfBlob } from './receiptPdfGenerator';
import { getApiUrl } from '../src/lib/apiConfig';

export type ParentReceiptRecipient = {
  name?: string;
  phone?: string;
  email?: string;
};

export type ParentReceiptDeliveryResult = {
  success: boolean;
  channel: 'web-share' | 'whatsapp-link' | 'email-link' | 'download-only' | 'none';
  message: string;
};

const normalizeWhatsAppPhone = (phone?: string) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0') && digits.length >= 9) return `242${digits.slice(1)}`;
  return digits;
};

export const buildParentReceiptMessage = (
  transaction: Transaction,
  schoolSettings: SchoolSettings,
  recipient?: ParentReceiptRecipient
) => {
  const currency = schoolSettings?.currency || 'FCFA';
  const summary = (transaction as any)?.receiptSummary || {};
  const schoolName = schoolSettings?.name || summary.schoolName || "l'établissement";
  const studentName = summary.studentName || 'votre enfant';
  const paidTotal = Number(summary.totalPaidByStudent ?? transaction.amount ?? 0);
  const remaining = Number(summary.remainingBalance ?? summary.debt ?? 0);
  const debt = Number(summary.debt ?? remaining);

  return [
    `Bonjour ${recipient?.name || 'cher parent'},`,
    `Message automatique de ${schoolName}.`,
    `Nous vous transmettons la copie du reçu de paiement de ${studentName}.`,
    `Montant encaissé : ${(transaction.amount || 0).toLocaleString('fr-FR')} ${currency}.`,
    `Total payé par l'élève : ${paidTotal.toLocaleString('fr-FR')} ${currency}.`,
    `Reste à payer : ${remaining.toLocaleString('fr-FR')} ${currency}. Dette : ${debt.toLocaleString('fr-FR')} ${currency}.`,
    `Numéro de l'école utilisé pour le suivi : ${schoolSettings?.contact || 'N/A'}.`,
    `Merci.`
  ].join('\n');
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const blobToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onloadend = () => {
    const result = String(reader.result || '');
    resolve(result.includes(',') ? result.split(',')[1] : result);
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

export const deliverParentPaymentReceipt = async (
  transaction: Transaction,
  schoolSettings: SchoolSettings,
  recipient: ParentReceiptRecipient
): Promise<ParentReceiptDeliveryResult> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { success: false, channel: 'none', message: 'Navigateur indisponible pour la livraison du reçu.' };
  }

  const summary = (transaction as any)?.receiptSummary || {};
  const receiptId = transaction.id ? transaction.id.split('_')[0] : `REC-${Date.now().toString().slice(-6)}`;
  const filename = `Recu_parent_${summary.studentName || 'eleve'}_${receiptId}.pdf`.replace(/[\\/:*?"<>|]/g, '_');
  const pdfBlob = createReceiptPdfBlob(transaction, schoolSettings, true);
  const message = buildParentReceiptMessage(transaction, schoolSettings, recipient);
  const file = new File([pdfBlob], filename, { type: 'application/pdf' });

  try {
    const pdfBase64 = await blobToBase64(pdfBlob);
    const apiRes = await fetch(getApiUrl('/api/parent-receipts/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient,
        message,
        subject: `Reçu de paiement - ${summary.studentName || 'Élève'}`,
        schoolName: schoolSettings?.name || 'EDUCO',
        filename,
        pdfBase64,
      }),
    });
    const apiData = await apiRes.json().catch(() => ({}));
    if (apiRes.ok && apiData?.success) {
      return {
        success: true,
        channel: apiData.whatsapp?.success ? 'whatsapp-link' : 'email-link',
        message: apiData.whatsapp?.success
          ? 'Reçu envoyé au parent via WhatsApp Business.'
          : 'WhatsApp indisponible : reçu envoyé par email avec PDF joint.',
      };
    }
    console.warn('API reçu parent indisponible, fallback navigateur:', apiData);
  } catch (error) {
    console.warn('Erreur API reçu parent, fallback navigateur:', error);
  }

  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: `Reçu de paiement - ${summary.studentName || 'Élève'}`,
        text: message,
        files: [file],
      });
      return { success: true, channel: 'web-share', message: 'Reçu partagé via le partage natif du navigateur.' };
    }
  } catch (error) {
    console.warn('Partage natif du reçu parent annulé ou impossible:', error);
  }

  downloadBlob(pdfBlob, filename);

  const whatsappPhone = normalizeWhatsAppPhone(recipient.phone);
  if (whatsappPhone) {
    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
    return {
      success: true,
      channel: 'whatsapp-link',
      message: 'Le PDF a été téléchargé et WhatsApp a été ouvert avec le message prérempli.',
    };
  }

  if (recipient.email) {
    const subject = `Reçu de paiement - ${summary.studentName || 'Élève'}`;
    window.open(`mailto:${recipient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message}\n\nLe reçu PDF vient d'être téléchargé. Merci de le joindre au mail si votre messagerie ne l'ajoute pas automatiquement.`)}`, '_blank');
    return {
      success: true,
      channel: 'email-link',
      message: 'Le PDF a été téléchargé et un email prérempli a été ouvert.',
    };
  }

  return {
    success: true,
    channel: 'download-only',
    message: 'Le PDF a été téléchargé. Aucun téléphone ou email parent exploitable trouvé.',
  };
};
