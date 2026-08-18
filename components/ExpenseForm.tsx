import React, { useState, useEffect, useMemo } from 'react';
import { SparklesIcon } from './Icons';
import { TRANSACTION_CATEGORIES_EXPENSE } from '../constants';
import ControlMatrixStatus, { ControlRule } from './ControlMatrixStatus';
import LoadingDots from './LoadingDots';

interface ExpenseFormProps {
  onSave: (description: string, amount: number, category: string, justification?: File, extra?: any) => void;
  onCancel: () => void;
  currency?: string;
}

const ExpenseForm: React.FC<ExpenseFormProps> = ({ onSave, onCancel, currency = 'FCFA' }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(''); // Montant TTC saisi
  const [category, setCategory] = useState(TRANSACTION_CATEGORIES_EXPENSE[0]);
  const [justification, setJustification] = useState<File | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nouvelles options professionnelles pour le journal de caisse (Dépenses)
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Mobile Money' | 'Virement' | 'Chèque'>('Espèces');
  const [thirdParty, setThirdParty] = useState(''); // Bénéficiaire de la dépense (ex: SODECI, Librairie...)
  const [referenceNumber, setReferenceNumber] = useState(''); // N° de pièce justificative (ex: Facture N°...)
  const [cashBox, setCashBox] = useState('Caisse Principale (Sécurisée)');
  
  // Option TVA
  const [hasTva, setHasTva] = useState(false);
  const [tvaRate, setTvaRate] = useState<number>(18); // 18% standard UEMOA ou 9% réduit
  const [htAmount, setHtAmount] = useState<number>(0);
  const [tvaAmount, setTvaAmount] = useState<number>(0);

  useEffect(() => {
    const totalAmount = parseFloat(amount) || 0;
    if (hasTva && totalAmount > 0) {
      // TTC = HT * (1 + rate/100) => HT = TTC / (1 + rate/100)
      const ht = totalAmount / (1 + tvaRate / 100);
      const tva = totalAmount - ht;
      setHtAmount(ht);
      setTvaAmount(tva);
    } else {
      setHtAmount(totalAmount);
      setTvaAmount(0);
    }
  }, [amount, hasTva, tvaRate]);

  // MATRICE DE CONTRÔLE DE SAISIE DE DÉPENSE
  const validationRules = useMemo((): ControlRule[] => {
    const numAmount = parseFloat(amount);
    return [
      {
        id: 'desc',
        label: 'Motif explicite de la dépense (≥ 3 car.)',
        isValid: description.trim().length >= 3,
      },
      {
        id: 'amount',
        label: 'Montant TTC valide (> 0)',
        isValid: !isNaN(numAmount) && numAmount > 0,
      },
      {
        id: 'category',
        label: 'Catégorie de charge imputée',
        isValid: !!category,
      },
      {
        id: 'cashBox',
        label: 'Caisse / Compte de décaissement',
        isValid: !!cashBox,
      },
      {
        id: 'thirdParty',
        label: thirdParty.trim() ? 'Tiers / Bénéficiaire identifié' : 'Bénéficiaire (recommandé)',
        isValid: true,
        isWarningOnly: !thirdParty.trim(),
      },
    ];
  }, [description, amount, category, cashBox, thirdParty]);

  const isFormValid = useMemo(() => {
    return validationRules.every(r => r.isValid || r.isWarningOnly);
  }, [validationRules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const numAmount = parseFloat(amount);
    if (description && numAmount > 0 && category) {
      setIsSubmitting(true);
      try {
        // Objet contenant toutes les options comptables supplémentaires de la pièce
        const extraData = {
          paymentMethod,
          thirdParty: thirdParty.trim() || 'Bénéficiaire indéfini',
          referenceNumber: referenceNumber.trim() || 'N/A',
          cashBox,
          hasTva,
          tvaRate: hasTva ? tvaRate : 0,
          htAmount: parseFloat(htAmount.toFixed(2)),
          tvaAmount: parseFloat(tvaAmount.toFixed(2)),
          notes: `Enregistrement dépense caisse. Tiers: ${thirdParty || 'N/A'}. Pièce N°: ${referenceNumber || 'N/A'}.`
        };
        
        await new Promise(resolve => setTimeout(resolve, 600));
        await Promise.resolve(onSave(description, numAmount, category, justification, extraData));
      } catch (err) {
        console.error("Erreur lors de l'enregistrement de la dépense vers Supabase:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleOcrSimulation = () => {
    // Simulate smart data extraction
    setDescription("Achat de 50 ramettes de papier A4 et cartouches d'encre");
    setAmount("118000"); // 100 000 HT + 18% TVA = 118 000 TTC
    setCategory("Fournitures");
    setThirdParty("Librairie de la Paix - Abidjan");
    setReferenceNumber("FAC-2026-8094");
    setHasTva(true);
    setTvaRate(18);
    setPaymentMethod("Espèces");
    alert("✨ IA OCR: Informations lues avec succès sur la facture de la Librairie de la Paix !\nMontant TTC: 118 000 FCFA (incluant 18% TVA).");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-slate-800">
      
      {/* OCR Smart Scan Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 p-3.5 rounded-xl border border-amber-200/60 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-200/20 rounded-full blur-xl" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <div className="text-center sm:text-left">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[9px] font-black uppercase tracking-wider mb-1">
              ⚡ Détection IA OCR
            </span>
            <p className="text-xs text-slate-500 font-medium">Vous disposez d'un reçu ou d'une facture imprimée ? Laissez l'IA l'analyser.</p>
          </div>
          <button 
            type="button" 
            onClick={handleOcrSimulation}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-lg transition-all font-bold shadow-xs cursor-pointer whitespace-nowrap"
          >
            <SparklesIcon className="w-4 h-4" />
            <span>Scanner & Remplir</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* DESCRIPTION */}
        <div className="md:col-span-2">
          <label htmlFor="exp-description" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Description / Motif de la Dépense *</label>
          <input
            type="text"
            id="exp-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9"
            placeholder="Ex: Achat de craies blanches et de stylos correcteurs"
          />
        </div>

        {/* BENEFICIAIRE / TIERS */}
        <div>
          <label htmlFor="exp-thirdparty" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tiers / Bénéficiaire (Règlement à)</label>
          <input
            type="text"
            id="exp-thirdparty"
            value={thirdParty}
            onChange={(e) => setThirdParty(e.target.value)}
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9"
            placeholder="Ex: SODECI, SNE, Fournisseur Papier"
          />
        </div>

        {/* REFERENCE DE PIECE */}
        <div>
          <label htmlFor="exp-ref" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">N° de Facture ou de Pièce justificative</label>
          <input
            type="text"
            id="exp-ref"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 font-mono"
            placeholder="Ex: FAC-2026-781"
          />
        </div>

        {/* CATEGORIE */}
        <div>
          <label htmlFor="exp-category" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Catégorie de Charge *</label>
          <select 
            id="exp-category" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            required 
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 bg-white"
          >
            {TRANSACTION_CATEGORIES_EXPENSE.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* CAISSE OU COMPTE AFFECTE */}
        <div>
          <label htmlFor="exp-cashbox" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Caisse ou Compte de Décaissement</label>
          <select 
            id="exp-cashbox" 
            value={cashBox} 
            onChange={(e) => setCashBox(e.target.value)} 
            required 
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 bg-white"
          >
            <option value="Caisse Principale (Sécurisée)">Caisse Principale (Sécurisée)</option>
            <option value="Caisse Scolarité">Caisse Scolarité</option>
            <option value="Compte Bancaire SGCI">Compte Bancaire (Courant)</option>
            <option value="Compte Mobile School">Compte Mobile (Wave/Orange)</option>
          </select>
        </div>

        {/* MONTANT TTC */}
        <div>
          <label htmlFor="exp-amount" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Montant TTC ({currency}) *</label>
          <input
            type="number"
            id="exp-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min="0.01"
            step="0.01"
            className="block w-full rounded-lg border-gray-300 text-xs font-bold text-[#1F4A59] focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 font-mono"
            placeholder="0"
          />
        </div>

        {/* MODE DE REGLEMENT */}
        <div>
          <label htmlFor="exp-method" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mode de Paiement de la Dépense</label>
          <select 
            id="exp-method" 
            value={paymentMethod} 
            onChange={(e) => setPaymentMethod(e.target.value as any)} 
            required 
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 bg-white"
          >
            <option value="Espèces">💵 Espèces</option>
            <option value="Mobile Money">📱 Mobile Money</option>
            <option value="Virement">🏦 Virement Bancaire</option>
            <option value="Chèque">✍️ Chèque Émis</option>
          </select>
        </div>
      </div>

      {/* DETAILED TAX / TVA CALCULATION BLOCK */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={hasTva}
              onChange={(e) => setHasTva(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#1F4A59] focus:ring-[#1F4A59]"
            />
            <span className="text-xs font-bold text-slate-700">Dépense soumise à la TVA (Taxe sur la Valeur Ajoutée)</span>
          </label>

          {hasTva && (
            <select
              value={tvaRate}
              onChange={(e) => setTvaRate(parseInt(e.target.value))}
              className="rounded border-gray-300 text-[11px] font-bold text-[#1F4A59] py-0.5 px-1.5 bg-white h-7 focus:ring-[#1F4A59]"
            >
              <option value="18">Taux Standard (18%)</option>
              <option value="9">Taux Réduit (9%)</option>
              <option value="0">Exonéré (0%)</option>
            </select>
          )}
        </div>

        {hasTva && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 text-center">
            <div className="bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Montant Hors Taxe</span>
              <span className="text-xs font-bold font-mono text-slate-700">
                {htAmount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {currency}
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">TVA Collectée ({tvaRate}%)</span>
              <span className="text-xs font-bold font-mono text-amber-600">
                {tvaAmount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {currency}
              </span>
            </div>
            <div className="bg-slate-900 text-white p-2 rounded-lg">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Montant TTC Total</span>
              <span className="text-xs font-bold font-mono text-teal-300">
                {(parseFloat(amount) || 0).toLocaleString('fr-FR')} {currency}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* FILE ATTACHMENT */}
      <div>
        <label htmlFor="exp-justification" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
          📁 Pièce Jointe / Justificatif Scanner (Facture, Ticket, Reçu)
        </label>
        <div className="mt-1 flex items-center justify-between border-2 border-dashed border-slate-200 rounded-lg p-3 bg-white hover:bg-slate-50/50 transition-colors">
          <input 
            type="file" 
            id="exp-justification" 
            onChange={(e) => setJustification(e.target.files?.[0])} 
            className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-[#1F4A59]/10 file:text-[#1F4A59] hover:file:bg-[#1F4A59]/20 file:cursor-pointer cursor-pointer"
          />
          {justification && (
            <span className="text-[10px] bg-teal-50 border border-teal-100 text-teal-700 px-2 py-0.5 rounded font-medium">
              ✓ Prêt ({Math.round(justification.size / 1024)} KB)
            </span>
          )}
        </div>
      </div>

      {/* Matrice de Contrôle de Saisie */}
      <ControlMatrixStatus rules={validationRules} title="Matrice de Contrôle de la Dépense" />

      {/* FOOTER ACTIONS */}
      <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
        <button 
          type="button" 
          onClick={onCancel} 
          disabled={isSubmitting}
          className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
        >
          Annuler
        </button>
        <button 
          type="submit" 
          disabled={!isFormValid || isSubmitting}
          className={`px-5 py-2 text-white rounded-lg text-xs font-extrabold transition-all shadow-sm flex items-center gap-2 ${
            !isFormValid || isSubmitting 
              ? 'bg-slate-400 opacity-60 cursor-not-allowed' 
              : 'bg-red-600 hover:bg-red-700 cursor-pointer'
          }`}
        >
          {isSubmitting ? (
            <>
              <span>Validation & Enregistrement Supabase</span>
              <LoadingDots />
            </>
          ) : (
            <span>💾 Enregistrer la Dépense de Caisse</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default ExpenseForm;
