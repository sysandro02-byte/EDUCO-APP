import React, { useState, useMemo } from 'react';
import { Transaction, SchoolSettings } from '../App';
import Modal from './Modal';
import ExpenseForm from './ExpenseForm';
import { PlusCircleIcon, FileDownloadIcon, CloudIcon } from './Icons';
import { TRANSACTION_CATEGORIES_EXPENSE, TRANSACTION_CATEGORIES_REVENUE } from '../constants';
import { ShieldAlert, ShieldCheck, Edit3, Lock, Wallet, TrendingUp, TrendingDown, AlertCircle, Eye, Info } from 'lucide-react';

// --- SUB-COMPONENT: RevenueForm ---
interface RevenueFormProps {
  onSave: (description: string, amount: number, category: string, justification?: File, extra?: any) => void;
  onCancel: () => void;
  currency: string;
}

const RevenueForm: React.FC<RevenueFormProps> = ({ onSave, onCancel, currency }) => {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(''); // Montant TTC
  const [category, setCategory] = useState(TRANSACTION_CATEGORIES_REVENUE[0]);
  const [justification, setJustification] = useState<File | undefined>(undefined);

  // Nouvelles options professionnelles pour le journal de caisse (Recettes)
  const [paymentMethod, setPaymentMethod] = useState<'Espèces' | 'Mobile Money' | 'Virement' | 'Chèque' | 'Autre'>('Espèces');
  const [thirdParty, setThirdParty] = useState(''); // Qui verse l'argent (ex: Association parents d'élèves, Sponsor...)
  const [referenceNumber, setReferenceNumber] = useState(''); // Référence du reçu ou pièce comptable
  const [cashBox, setCashBox] = useState('Caisse Principale (Sécurisée)');
  
  // Option TVA collectée
  const [hasTva, setHasTva] = useState(false);
  const [tvaRate, setTvaRate] = useState<number>(18); // 18% standard ou 9% réduit
  const [htAmount, setHtAmount] = useState<number>(0);
  const [tvaAmount, setTvaAmount] = useState<number>(0);

  React.useEffect(() => {
    const totalAmount = parseFloat(amount) || 0;
    if (hasTva && totalAmount > 0) {
      const ht = totalAmount / (1 + tvaRate / 100);
      const tva = totalAmount - ht;
      setHtAmount(ht);
      setTvaAmount(tva);
    } else {
      setHtAmount(totalAmount);
      setTvaAmount(0);
    }
  }, [amount, hasTva, tvaRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (description && numAmount > 0 && category) {
      const extraData = {
        paymentMethod,
        thirdParty: thirdParty.trim() || 'Payeur indéfini',
        referenceNumber: referenceNumber.trim() || 'N/A',
        cashBox,
        hasTva,
        tvaRate: hasTva ? tvaRate : 0,
        htAmount: parseFloat(htAmount.toFixed(2)),
        tvaAmount: parseFloat(tvaAmount.toFixed(2)),
        notes: `Enregistrement recette caisse. Provenance: ${thirdParty || 'N/A'}. Pièce N°: ${referenceNumber || 'N/A'}.`
      };
      onSave(description, numAmount, category, justification, extraData);
    }
  };

  const handleReceiptUpload = () => {
    document.getElementById('rev-justification')?.click();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 text-slate-800">
      
      {/* OCR Scan for Revenue */}
      <div className="bg-gradient-to-r from-teal-50 to-emerald-50/50 p-3.5 rounded-xl border border-teal-200/60 relative overflow-hidden">
        <div className="absolute -top-6 -right-6 w-20 h-20 bg-teal-200/20 rounded-full blur-xl" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          <div className="text-center sm:text-left">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-800 rounded text-[9px] font-black uppercase tracking-wider mb-1">
              ⚡ Détection IA OCR
            </span>
            <p className="text-xs text-slate-500 font-medium">L'IA peut lire un bordereau de dépôt, un reçu ou un ordre de chèque.</p>
          </div>
          <button 
            type="button" 
            onClick={handleReceiptUpload}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded-lg transition-all font-bold shadow-xs cursor-pointer whitespace-nowrap"
          >
            <PlusCircleIcon className="w-4 h-4" />
            <span>Joindre un reçu</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* DESCRIPTION */}
        <div className="md:col-span-2">
          <label htmlFor="rev-description" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Description / Motif de l'encaissement *</label>
          <input 
            type="text" 
            id="rev-description" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            required 
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9" 
            placeholder="Ex: Don de l'association des parents pour achat livres" 
          />
        </div>

        {/* TIERS / PROVENANCE */}
        <div>
          <label htmlFor="rev-thirdparty" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Provenance / Payeur (Reçu de)</label>
          <input 
            type="text" 
            id="rev-thirdparty" 
            value={thirdParty} 
            onChange={(e) => setThirdParty(e.target.value)} 
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9" 
            placeholder="Ex: M. Jean Soro, Comité APE, Donateur anonyme" 
          />
        </div>

        {/* N° DE REFERENCE */}
        <div>
          <label htmlFor="rev-ref" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Référence Bordereau, Chèque ou Reçu</label>
          <input 
            type="text" 
            id="rev-ref" 
            value={referenceNumber} 
            onChange={(e) => setReferenceNumber(e.target.value)} 
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 font-mono" 
            placeholder="Ex: REC-90812-APE" 
          />
        </div>

        {/* CATEGORIE */}
        <div>
          <label htmlFor="rev-category" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Catégorie de Recette *</label>
          <select 
            id="rev-category" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            required 
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 bg-white"
          >
            {TRANSACTION_CATEGORIES_REVENUE.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        {/* CAISSE RECEPTRICE */}
        <div>
          <label htmlFor="rev-cashbox" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Caisse ou Compte de Destination</label>
          <select 
            id="rev-cashbox" 
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

        {/* MONTANT TOTAL ENCAISSE */}
        <div>
          <label htmlFor="rev-amount" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Montant Encaissé TTC ({currency}) *</label>
          <input 
            type="number" 
            id="rev-amount" 
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
          <label htmlFor="rev-method" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mode de Règlement</label>
          <select 
            id="rev-method" 
            value={paymentMethod} 
            onChange={(e) => setPaymentMethod(e.target.value as any)} 
            required 
            className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 bg-white"
          >
            <option value="Espèces">💵 Espèces</option>
            <option value="Mobile Money">📱 Mobile Money</option>
            <option value="Virement">🏦 Virement</option>
            <option value="Chèque">✍️ Chèque Reçu</option>
            <option value="Autre">⚖️ Autre</option>
          </select>
        </div>
      </div>

      {/* TVA OPTION FOR REVENUE */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 space-y-3">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={hasTva}
              onChange={(e) => setHasTva(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-[#1F4A59] focus:ring-[#1F4A59]"
            />
            <span className="text-xs font-bold text-slate-700">Soumis à la TVA collectée (ex: Uniformes, Vente de manuels)</span>
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
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Montant HT</span>
              <span className="text-xs font-bold font-mono text-slate-700">
                {htAmount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {currency}
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-slate-100">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">TVA ({tvaRate}%)</span>
              <span className="text-xs font-bold font-mono text-teal-600">
                {tvaAmount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {currency}
              </span>
            </div>
            <div className="bg-slate-900 text-white p-2 rounded-lg">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Total Encaissé</span>
              <span className="text-xs font-bold font-mono text-emerald-300">
                {(parseFloat(amount) || 0).toLocaleString('fr-FR')} {currency}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* FILE ATTACHMENT */}
      <div>
        <label htmlFor="rev-justification" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
          📁 Justificatif d'Encaissement (Bordereau, Copie Chèque...)
        </label>
        <div className="mt-1 flex items-center justify-between border-2 border-dashed border-slate-200 rounded-lg p-3 bg-white hover:bg-slate-50/50 transition-colors">
          <input 
            type="file" 
            id="rev-justification" 
            onChange={(e) => setJustification(e.target.files?.[0])} 
            className="text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-[11px] file:font-bold file:bg-[#1F4A59]/10 file:text-[#1F4A59] hover:file:bg-[#1F4A59]/20 file:cursor-pointer cursor-pointer"
          />
          {justification && (
            <span className="text-[10px] bg-teal-50 border border-teal-100 text-teal-700 px-2 py-0.5 rounded font-medium">
              ✓ Téléchargé ({Math.round(justification.size / 1024)} KB)
            </span>
          )}
        </div>
      </div>

      {/* BUTTONS */}
      <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all cursor-pointer">Annuler</button>
        <button type="submit" className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-extrabold transition-all shadow-sm cursor-pointer">Sauvegarder la Recette</button>
      </div>
    </form>
  );
};

// --- SUB-COMPONENT: EditTransactionForm (Exclusif RAF) ---
interface EditTransactionFormProps {
  transaction: Transaction;
  onSave: (transactionId: string, updatedData: Partial<Transaction>) => void;
  onCancel: () => void;
  currency: string;
}

const EditTransactionForm: React.FC<EditTransactionFormProps> = ({ transaction, onSave, onCancel, currency }) => {
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(transaction.amount.toString());
  const [category, setCategory] = useState(transaction.category || 'Divers');
  const [paymentMethod, setPaymentMethod] = useState(transaction.paymentMethod || 'Espèces');
  const [thirdParty, setThirdParty] = useState((transaction as any).thirdParty || '');
  const [referenceNumber, setReferenceNumber] = useState((transaction as any).referenceNumber || '');
  const [cashBox, setCashBox] = useState((transaction as any).cashBox || 'Caisse Principale (Sécurisée)');
  const [notes, setNotes] = useState(transaction.notes || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) {
      alert("Veuillez saisir une description et un montant valide.");
      return;
    }

    onSave(transaction.id, {
      description,
      amount: numAmount,
      category,
      paymentMethod,
      notes,
      thirdParty,
      referenceNumber,
      cashBox,
    } as any);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-800">
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold block">Sécurité d'Audit active</span>
          <span className="text-[11px] leading-relaxed">Cette action de modification modifiera les archives du journal. Cette modification sera auditée dans les journaux d'activité.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">ID Transaction (Non modifiable)</label>
          <input type="text" value={transaction.id} disabled className="block w-full rounded-lg border-gray-300 bg-slate-50 text-slate-400 font-mono text-xs h-9" />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Catégorie comptable</label>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            className="block w-full rounded-lg border-gray-300 text-xs h-9 bg-white"
          >
            {[...new Set([...TRANSACTION_CATEGORIES_REVENUE, ...TRANSACTION_CATEGORIES_EXPENSE])].map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Description / Intitulé *</label>
          <input 
            type="text" 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            required 
            className="block w-full rounded-lg border-gray-300 text-xs h-9" 
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tiers (Payeur ou Bénéficiaire)</label>
          <input 
            type="text" 
            value={thirdParty} 
            onChange={(e) => setThirdParty(e.target.value)} 
            className="block w-full rounded-lg border-gray-300 text-xs h-9" 
            placeholder="Ex: Client, APE, SODECI..."
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">N° Référence / Pièce comptable</label>
          <input 
            type="text" 
            value={referenceNumber} 
            onChange={(e) => setReferenceNumber(e.target.value)} 
            className="block w-full rounded-lg border-gray-300 text-xs h-9 font-mono" 
            placeholder="Ex: FA-90812"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Montant ({currency}) *</label>
          <input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            required 
            min="0.01"
            className="block w-full rounded-lg border-gray-300 text-xs font-bold text-[#1F4A59] h-9 font-mono" 
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mode de Règlement</label>
          <select 
            value={paymentMethod} 
            onChange={(e) => setPaymentMethod(e.target.value)} 
            className="block w-full rounded-lg border-gray-300 text-xs h-9 bg-white"
          >
            <option value="Espèces">Espèces</option>
            <option value="Mobile Money">Mobile Money</option>
            <option value="Carte Bancaire">Carte Bancaire</option>
            <option value="Virement">Virement</option>
            <option value="Chèque">Chèque</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Caisse d'affectation</label>
          <select 
            value={cashBox} 
            onChange={(e) => setCashBox(e.target.value)} 
            className="block w-full rounded-lg border-gray-300 text-xs h-9 bg-white"
          >
            <option value="Caisse Principale (Sécurisée)">Caisse Principale (Sécurisée)</option>
            <option value="Caisse Scolarité">Caisse Scolarité</option>
            <option value="Compte Bancaire SGCI">Compte Bancaire (Courant)</option>
            <option value="Compte Mobile School">Compte Mobile (Wave/Orange)</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observations / Motif de modification (Exigé RAF)</label>
          <textarea 
            value={notes} 
            onChange={(e) => setNotes(e.target.value)} 
            rows={2}
            required
            className="block w-full rounded-lg border-gray-300 text-xs"
            placeholder="Ex: Correction de saisie erronée sur le montant après vérification de la pièce justificative physique."
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer">
          Annuler
        </button>
        <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs font-extrabold transition-all shadow-sm cursor-pointer">
          Enregistrer les modifications (RAF)
        </button>
      </div>
    </form>
  );
};


interface AccountingPageProps {
  transactions: Transaction[];
  onSaveExpense: (description: string, amount: number, category: string, justification?: File, extra?: any) => void;
  onSaveRevenue: (description: string, amount: number, category: string, justification?: File, extra?: any) => void;
  schoolSettings: SchoolSettings;
  currentUserRole?: string;
  onEditTransaction?: (transactionId: string, updatedData: Partial<Transaction>) => void;
  cashierSettings?: any;
}

const AccountingPage: React.FC<AccountingPageProps> = ({ 
  transactions, onSaveExpense, onSaveRevenue, schoolSettings, currentUserRole, onEditTransaction, cashierSettings 
}) => {
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isRevenueModalOpen, setIsRevenueModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingDetailsTransaction, setViewingDetailsTransaction] = useState<Transaction | null>(null);

  // Filtres étendus
  const [periodFilter, setPeriodFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [importNotification, setImportNotification] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const isRAFOrDG = currentUserRole === 'Responsable des finances' || currentUserRole === 'Promoteur' || currentUserRole === 'Admin';
  const currency = schoolSettings.currency;

  const handleSaveExpense = (description: string, amount: number, category: string, justification?: File, extra?: any) => {
    onSaveExpense(description, amount, category, justification, extra);
    setIsExpenseModalOpen(false);
  };
  
  const handleSaveRevenue = (description: string, amount: number, category: string, justification?: File, extra?: any) => {
    onSaveRevenue(description, amount, category, justification, extra);
    setIsRevenueModalOpen(false);
  };

  const handleSaveEdit = (transactionId: string, updatedData: Partial<Transaction>) => {
    if (onEditTransaction) {
      onEditTransaction(transactionId, updatedData);
    }
    setEditingTransaction(null);
  };

  const handleAttemptEdit = (t: Transaction) => {
    if (!isRAFOrDG) {
      alert("Accès refusé : Seul le Responsable des Affaires Financières (RAF) ou le Directeur Général (DG) a le droit de modifier une transaction enregistrée.\n\nEn tant que caissière, vous pouvez uniquement saisir les encaissements scolaires.");
      return;
    }
    setEditingTransaction(t);
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // CALCUL STATS POUR LES CARTES COMPTABLES
  const stats = useMemo(() => {
    let totalRevenueApproved = 0;
    let totalExpenseApproved = 0;
    let totalPendingAmount = 0;
    let totalPendingCount = 0;

    transactions.forEach(t => {
      if (t.status === 'Approuvé') {
        if (t.type === 'Revenu') {
          totalRevenueApproved += t.amount;
        } else if (t.type === 'Dépense') {
          totalExpenseApproved += t.amount;
        }
      } else if (t.status === 'En attente') {
        totalPendingAmount += t.amount;
        totalPendingCount++;
      }
    });

    return {
      netCash: totalRevenueApproved - totalExpenseApproved,
      revenueApproved: totalRevenueApproved,
      expenseApproved: totalExpenseApproved,
      pendingAmount: totalPendingAmount,
      pendingCount: totalPendingCount
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    return sortedTransactions.filter(t => {
      // Filtre Période
      const tDate = new Date(t.date);
      let periodMatch = false;
      if (periodFilter === 'all') periodMatch = true;
      else if (periodFilter === 'month') {
        periodMatch = tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      } else if (periodFilter === 'year') {
        periodMatch = tDate.getFullYear() === now.getFullYear();
      }
      
      // Filtres standard
      const typeMatch = typeFilter === 'all' || t.type === typeFilter;
      const categoryMatch = categoryFilter === 'all' || t.category === categoryFilter;
      
      // Nouveau filtre mode de paiement
      const currentMethod = t.paymentMethod || 'Espèces';
      const methodMatch = paymentMethodFilter === 'all' || 
                         currentMethod.toLowerCase().includes(paymentMethodFilter.toLowerCase());

      // Recherche textuelle élargie
      let searchMatch = true;
      if (searchTerm.trim().length > 0) {
        const term = searchTerm.toLowerCase();
        const descMatch = t.description.toLowerCase().includes(term);
        const catMatch = (t.category || '').toLowerCase().includes(term);
        const thirdMatch = ((t as any).thirdParty || '').toLowerCase().includes(term);
        const refMatch = ((t as any).referenceNumber || '').toLowerCase().includes(term);
        const idMatch = t.id.toLowerCase().includes(term);
        searchMatch = descMatch || catMatch || thirdMatch || refMatch || idMatch;
      }

      return periodMatch && typeMatch && categoryMatch && methodMatch && searchMatch;
    });
  }, [sortedTransactions, periodFilter, typeFilter, categoryFilter, paymentMethodFilter, searchTerm]);
  
  const allCategories = [...new Set([...TRANSACTION_CATEGORIES_REVENUE, ...TRANSACTION_CATEGORIES_EXPENSE])];

  const handleExportCSV = () => {
    if (currentUserRole === 'Caissière' && cashierSettings?.permissions?.allowCsvExport === false) {
      alert("Accès refusé : Le Responsable des finances (RAF) a désactivé votre droit d'exportation des journaux de caisse.");
      return;
    }
    const headers = ['ID', 'Date', 'Description', 'Tiers', 'Reference', 'Caisse', 'Categorie', 'Type', 'Montant', 'TVA_Applicable', 'Devise', 'Statut', 'Approuve_Par'];
    const rows = filteredTransactions.map(t => [
      t.id,
      new Date(t.date).toLocaleDateString('fr-FR'),
      `"${t.description.replace(/"/g, '""')}"`,
      `"${((t as any).thirdParty || '-').replace(/"/g, '""')}"`,
      `"${((t as any).referenceNumber || '-').replace(/"/g, '""')}"`,
      `"${((t as any).cashBox || 'Caisse Scolarité').replace(/"/g, '""')}"`,
      t.category,
      t.type,
      t.amount,
      (t as any).hasTva ? `${(t as any).tvaRate}%` : 'Non',
      currency,
      t.status,
      `"${(t.approvedBy || (t.status === 'Approuvé' ? 'Direction / RAF' : '-')).replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `journal_de_caisse_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        let count = 0;

        if (file.name.endsWith('.json')) {
          const items = JSON.parse(text);
          if (Array.isArray(items)) {
            items.forEach(item => {
              if (item.type === 'Dépense' || item.amount < 0) {
                onSaveExpense(
                  item.description || 'Dépense importée', 
                  Math.abs(item.amount || 0), 
                  item.category || 'Divers',
                  undefined,
                  {
                    paymentMethod: item.paymentMethod || 'Espèces',
                    thirdParty: item.thirdParty || 'Bénéficiaire importé',
                    referenceNumber: item.referenceNumber || 'N/A',
                    cashBox: item.cashBox || 'Caisse Principale (Sécurisée)'
                  }
                );
                count++;
              } else {
                onSaveRevenue(
                  item.description || 'Recette importée', 
                  Math.abs(item.amount || 0), 
                  item.category || 'Divers',
                  undefined,
                  {
                    paymentMethod: item.paymentMethod || 'Espèces',
                    thirdParty: item.thirdParty || 'Payeur importé',
                    referenceNumber: item.referenceNumber || 'N/A',
                    cashBox: item.cashBox || 'Caisse Principale (Sécurisée)'
                  }
                );
                count++;
              }
            });
          }
        } else {
          // CSV Parsing
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(/[;,]/);
            if (cols.length >= 4) {
              const description = cols[2]?.replace(/^"|"$/g, '').trim() || cols[1]?.trim() || 'Transaction importée';
              const category = cols[3]?.trim() || 'Divers';
              const type = cols[4]?.trim().toLowerCase().includes('dépense') ? 'Dépense' : 'Revenu';
              const amount = parseFloat(cols[5]?.replace(/[^\d.-]/g, '') || cols[4]?.replace(/[^\d.-]/g, '') || cols[3]?.replace(/[^\d.-]/g, '')) || 0;

              if (amount > 0) {
                if (type === 'Dépense') {
                  onSaveExpense(description, amount, category);
                  count++;
                } else {
                  onSaveRevenue(description, amount, category);
                  count++;
                }
              }
            }
          }
        }

        setImportNotification(`Succès : ${count} transactions importées et injectées dans le journal !`);
        setTimeout(() => setImportNotification(null), 6000);
      } catch (err) {
        alert('Erreur lors de la lecture du fichier. Veuillez vérifier le format de vos colonnes.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* 1. HABILITATION BANNER */}
      {!isRAFOrDG ? (
        <div className="bg-amber-50 border border-amber-200/80 p-4 rounded-xl shadow-xs flex items-start gap-3.5 text-xs text-amber-950">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-[13px] text-amber-900">🔒 Mode Caisse Restreint — Lecture de Journal uniquement</h4>
            <p className="mt-1 leading-relaxed text-slate-600">
              En tant que <strong>{currentUserRole || 'Caissière'}</strong>, vous pouvez ajouter de nouvelles recettes ou dépenses directes d'école sous réserve de validation comptable. Les transactions enregistrées sont <strong>verrouillées à la modification</strong>. Seul le <strong>Responsable des Finances (RAF)</strong> ou le <strong>Directeur Général (Promoteur)</strong> est habilité à éditer ou corriger une pièce déjà comptabilisée.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200/80 p-4 rounded-xl shadow-xs flex items-center justify-between text-xs text-emerald-950">
          <div className="flex items-center gap-3.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <h4 className="font-extrabold text-[13px] text-emerald-900">⚡ Administration & Audit RAF Actifs</h4>
              <p className="text-slate-600 mt-0.5">Vous disposez d'un accès de modification directe des transactions et d'un contrôle de caisse global.</p>
            </div>
          </div>
          <span className="hidden sm:inline-block bg-emerald-200 text-emerald-950 font-black px-3 py-1 rounded-full text-[10px] uppercase tracking-wider">
            Super-Utilisateur
          </span>
        </div>
      )}

      {/* 2. REAL-TIME FINANCIAL KPIS CARDS (ANTI-SLOP & GORGEOUS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* SOLDE REEL */}
        <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Solde Réel de Caisse</span>
            <span className="text-lg font-black font-mono text-teal-300">
              {stats.netCash.toLocaleString()} <span className="text-xs font-bold text-slate-400">{currency}</span>
            </span>
          </div>
          <div className="p-2 bg-slate-800 rounded-lg text-teal-400 border border-slate-700/50">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* TOTAL RECETTES */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Recettes Encaissées</span>
            <span className="text-lg font-black font-mono text-emerald-600">
              +{stats.revenueApproved.toLocaleString()} <span className="text-xs font-bold text-slate-400">{currency}</span>
            </span>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* TOTAL DEPENSES */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-xs">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Dépenses Approuvées</span>
            <span className="text-lg font-black font-mono text-rose-600">
              -{stats.expenseApproved.toLocaleString()} <span className="text-xs font-bold text-slate-400">{currency}</span>
            </span>
          </div>
          <div className="p-2 bg-rose-50 rounded-lg text-rose-600 border border-rose-100">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        {/* COMPTABILITE EN ATTENTE */}
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-xs transition-all ${stats.pendingCount > 0 ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-white border-slate-200'}`}>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Opérations en Attente</span>
            <span className="text-lg font-black font-mono text-amber-600">
              {stats.pendingAmount.toLocaleString()} <span className="text-xs font-bold text-slate-400">{currency}</span>
            </span>
            {stats.pendingCount > 0 && (
              <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200 block w-max uppercase tracking-wider">
                {stats.pendingCount} à valider
              </span>
            )}
          </div>
          <div className={`p-2 rounded-lg border ${stats.pendingCount > 0 ? 'bg-amber-100/50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. MAIN COMPTABLE JOURNAL PANEL */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-5 space-y-5">
        
        {/* Top Header Actions */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">📕 Livre-Journal de Caisse Scolaire</h2>
            <p className="text-xs text-slate-500 mt-0.5">Registre officiel d'encaissement et de décaissement de l'établissement scolaire.</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full xl:w-auto">
            <button 
              onClick={() => {
                if (currentUserRole === 'Caissière' && cashierSettings?.permissions?.allowStudentPayment === false) {
                  alert("Accès refusé : Le Responsable des finances (RAF) a restreint votre droit d'enregistrement de nouvelles recettes.");
                  return;
                }
                setIsRevenueModalOpen(true);
              }} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              <PlusCircleIcon className="w-4 h-4" /> 
              <span>Encaisser Recette</span>
            </button>
            <button 
              onClick={() => {
                if (currentUserRole === 'Caissière' && cashierSettings?.permissions?.allowGeneralExpense === false) {
                  alert("Accès refusé : Le Responsable des finances (RAF) a restreint votre droit d'enregistrement de nouvelles dépenses.");
                  return;
                }
                setIsExpenseModalOpen(true);
              }} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer whitespace-nowrap"
            >
              <PlusCircleIcon className="w-4 h-4" /> 
              <span>Décaisser Dépense</span>
            </button>
            <button 
              onClick={handleExportCSV} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer whitespace-nowrap" 
              title="Exporter au format CSV"
            >
              <FileDownloadIcon className="w-4 h-4" /> 
              <span>Exporter CSV</span>
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all border border-slate-200 cursor-pointer whitespace-nowrap" 
              title="Importer depuis Excel/CSV ou JSON"
            >
              <FileDownloadIcon className="w-4 h-4 transform rotate-180 text-slate-500" /> 
              <span>Importer</span>
            </button>
            
            <input 
              ref={fileInputRef} 
              type="file" 
              accept=".csv,.txt,.json" 
              onChange={handleImportFile} 
              className="hidden" 
            />
          </div>
        </div>

        {importNotification && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center justify-between animate-fadeIn">
            <span className="font-medium">{importNotification}</span>
            <button onClick={() => setImportNotification(null)} className="font-bold text-emerald-700 ml-2 hover:text-emerald-900">&times;</button>
          </div>
        )}
        
        {/* FILTRES COMPTABLES AVANCES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60 text-xs">
          
          {/* RECHERCHE */}
          <div className="sm:col-span-2 lg:col-span-1">
            <label htmlFor="search" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Recherche globale</label>
            <input 
              type="text" 
              id="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="N° Pièce, Tiers, Libellé..." 
              className="block w-full rounded-lg border-gray-300 text-xs h-9 bg-white focus:ring-[#1F4A59]" 
            />
          </div>

          {/* PERIODE */}
          <div>
            <label htmlFor="periodFilter" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Période d'écriture</label>
            <select id="periodFilter" value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="block w-full rounded-lg border-gray-300 text-xs h-9 bg-white focus:ring-[#1F4A59]">
              <option value="all">Tout l'historique</option>
              <option value="month">Mois en cours</option>
              <option value="year">Année en cours</option>
            </select>
          </div>

          {/* MOUVEMENT */}
          <div>
            <label htmlFor="typeFilter" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Type de mouvement</label>
            <select id="typeFilter" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="block w-full rounded-lg border-gray-300 text-xs h-9 bg-white focus:ring-[#1F4A59]">
              <option value="all">Recettes & Dépenses</option>
              <option value="Revenu">Recettes (+)</option>
              <option value="Dépense">Dépenses (-)</option>
            </select>
          </div>

          {/* REGLEMENT */}
          <div>
            <label htmlFor="methodFilter" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Mode Règlement</label>
            <select id="methodFilter" value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)} className="block w-full rounded-lg border-gray-300 text-xs h-9 bg-white focus:ring-[#1F4A59]">
              <option value="all">Tous les modes</option>
              <option value="espèces">Espèces</option>
              <option value="mobile">Mobile Money</option>
              <option value="virement">Virement Bancaire</option>
              <option value="chèque">Chèques</option>
            </select>
          </div>

          {/* CATEGORIES */}
          <div>
            <label htmlFor="categoryFilter" className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Catégorie budgétaire</label>
            <select id="categoryFilter" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="block w-full rounded-lg border-gray-300 text-xs h-9 bg-white focus:ring-[#1F4A59]">
              <option value="all">Toutes catégories</option>
              {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>

        {/* 4. TABLEAU DES ECRITURES COMPTABLES */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="px-4 py-3 text-left">Date & ID</th>
                <th className="px-4 py-3 text-left">Pièce & Tiers</th>
                <th className="px-4 py-3 text-left">Désignation</th>
                <th className="px-4 py-3 text-left">Catégorie</th>
                <th className="px-4 py-3 text-center">Règlement</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3 text-center">Statut</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100 text-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    <Info className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold">Aucune transaction comptable trouvée</p>
                    <p className="text-[11px] mt-0.5">Essayez de modifier vos filtres ou de faire une recherche globale.</p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => {
                  const hasTvaApplied = (t as any).hasTva;
                  const tvaValue = (t as any).tvaRate;
                  const third = (t as any).thirdParty;
                  const refN = (t as any).referenceNumber;
                  const box = (t as any).cashBox;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-all">
                      
                      {/* DATE & ID */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-bold text-slate-800 block">
                          {new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono block mt-0.5">{t.id}</span>
                      </td>

                      {/* PIECE & TIERS */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-extrabold text-slate-700 block text-[11px]">
                          👤 {third || 'Non spécifié'}
                        </span>
                        {refN && (
                          <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100/40 px-1 py-0.1 rounded font-mono mt-0.5 inline-block">
                            📄 N° {refN}
                          </span>
                        )}
                      </td>

                      {/* DESIGNATION */}
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-800 text-[11px] block">{t.description}</span>
                        {box && (
                          <span className="text-[9px] text-slate-400 block mt-0.5">
                            🏦 {box}
                          </span>
                        )}
                      </td>

                      {/* CATEGORIE */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-700 border border-slate-200/60 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {t.category}
                        </span>
                      </td>

                      {/* MODE DE REGLEMENT */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span className="text-slate-600 font-bold bg-slate-50 border px-1.5 py-0.5 rounded text-[10px] inline-block">
                          {t.paymentMethod || 'Espèces'}
                        </span>
                        {hasTvaApplied && (
                          <span className="text-[8px] bg-teal-50 text-teal-700 border border-teal-100 px-1 rounded block w-max mx-auto mt-0.5">
                            TVA {tvaValue}%
                          </span>
                        )}
                      </td>

                      {/* MONTANT */}
                      <td className={`px-4 py-3.5 whitespace-nowrap text-right font-black font-mono text-[13px] ${t.type === 'Revenu' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t.type === 'Revenu' ? '+' : '-'}{t.amount.toLocaleString()} {currency}
                      </td>

                      {/* STATUT */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <span className={`px-2 py-0.5 inline-flex text-[9px] font-black uppercase tracking-wider rounded-full ${
                          t.status === 'Approuvé' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : t.status === 'Rejeté' 
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {t.status}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button 
                            onClick={() => setViewingDetailsTransaction(t)}
                            className="p-1 text-slate-500 bg-slate-100 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                            title="Consulter le détail de la pièce"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          
                          {isRAFOrDG ? (
                            <button 
                              onClick={() => handleAttemptEdit(t)}
                              className="inline-flex items-center gap-1 px-2 py-0.8 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded font-black text-[10px] transition-all cursor-pointer"
                              title="Modifier cette transaction (Privilège RAF)"
                            >
                              <Edit3 className="w-3 h-3 text-amber-700" />
                              <span>Éditer</span>
                            </button>
                          ) : (
                            <span 
                              className="inline-flex items-center gap-0.5 px-2 py-0.8 bg-slate-50 text-slate-300 border rounded text-[10px]"
                              title="Verrouillé pour la caissière. RAF requis."
                            >
                              <Lock className="w-2.5 h-2.5" />
                              <span>Verrouillé</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. MODAL DETAILED PIECE VIEW */}
      <Modal isOpen={!!viewingDetailsTransaction} onClose={() => setViewingDetailsTransaction(null)} title="📄 Fiche Pièce Comptable — Détails">
        {viewingDetailsTransaction && (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 relative overflow-hidden">
              <span className={`absolute top-3 right-3 text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                viewingDetailsTransaction.type === 'Revenu' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {viewingDetailsTransaction.type}
              </span>
              <div className="space-y-0.5">
                <span className="text-[9px] text-slate-400 font-mono">{viewingDetailsTransaction.id}</span>
                <h3 className="text-sm font-black text-white">{viewingDetailsTransaction.description}</h3>
                <p className="text-[10px] text-slate-400">Date d'écriture : {new Date(viewingDetailsTransaction.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200/60">
              <div>
                <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Provenance / Tiers</span>
                <span className="font-extrabold text-slate-800 text-xs">{(viewingDetailsTransaction as any).thirdParty || 'Non précisé'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Référence Pièce</span>
                <span className="font-extrabold text-slate-800 font-mono text-xs">{(viewingDetailsTransaction as any).referenceNumber || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Catégorie Budgétaire</span>
                <span className="font-extrabold text-slate-800 text-xs">{viewingDetailsTransaction.category}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Caisse d'affectation</span>
                <span className="font-extrabold text-slate-800 text-xs">{(viewingDetailsTransaction as any).cashBox || 'Caisse Principale'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Mode de Règlement</span>
                <span className="font-extrabold text-slate-800 text-xs">{viewingDetailsTransaction.paymentMethod || 'Espèces'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[9px] uppercase tracking-wider">Facture Justificatif</span>
                <span className="font-extrabold text-[#1F4A59] text-xs">
                  {viewingDetailsTransaction.justification ? `📁 ${viewingDetailsTransaction.justification}` : 'Aucun fichier attaché'}
                </span>
              </div>
            </div>

            {/* Tax details if applied */}
            {(viewingDetailsTransaction as any).hasTva && (
              <div className="p-3 bg-teal-50/50 border border-teal-100 rounded-xl space-y-2">
                <span className="text-[9px] text-teal-800 font-black uppercase tracking-wider block">Détails de Taxation TVA ({(viewingDetailsTransaction as any).tvaRate}%)</span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold">Hors Taxe (HT)</span>
                    <span className="text-xs font-mono font-extrabold text-slate-800">
                      {((viewingDetailsTransaction as any).htAmount || viewingDetailsTransaction.amount).toLocaleString()} {currency}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold">TVA</span>
                    <span className="text-xs font-mono font-extrabold text-amber-600">
                      {((viewingDetailsTransaction as any).tvaAmount || 0).toLocaleString()} {currency}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold">Total TTC</span>
                    <span className="text-xs font-mono font-extrabold text-emerald-600">
                      {viewingDetailsTransaction.amount.toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Audit validation details */}
            <div className="p-3 bg-slate-100 rounded-xl space-y-1.5">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block">Détails de Validation d'Audit</span>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-slate-400 block">Approuvé par:</span>
                  <span className="font-bold text-slate-800">{viewingDetailsTransaction.approvedBy || 'Validation auto direction'}</span>
                </div>
                {viewingDetailsTransaction.approvedAt && (
                  <div>
                    <span className="text-slate-400 block">Date Approbation:</span>
                    <span className="font-bold text-slate-800">
                      {new Date(viewingDetailsTransaction.approvedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}
              </div>
              {viewingDetailsTransaction.notes && (
                <div className="pt-2 border-t text-[10px]">
                  <span className="text-slate-400 block">Observations / Notes:</span>
                  <p className="text-slate-600 font-medium italic mt-0.5">"{viewingDetailsTransaction.notes}"</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setViewingDetailsTransaction(null)} 
                className="px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-extrabold cursor-pointer hover:bg-slate-800 transition-all"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 6. MODAL NEW EXPENSE */}
      <Modal isOpen={isExpenseModalOpen} onClose={() => setIsExpenseModalOpen(false)} title="Enregistrer une Nouvelle Dépense de Caisse">
        <ExpenseForm onSave={handleSaveExpense} onCancel={() => setIsExpenseModalOpen(false)} currency={currency} />
      </Modal>
      
      {/* 7. MODAL NEW REVENUE */}
      <Modal isOpen={isRevenueModalOpen} onClose={() => setIsRevenueModalOpen(false)} title="Enregistrer une Nouvelle Recette de Caisse">
        <RevenueForm onSave={handleSaveRevenue} onCancel={() => setIsRevenueModalOpen(false)} currency={currency} />
      </Modal>

      {/* 8. MODAL EDIT TRANSACTION (RAF & DG ONLY) */}
      <Modal isOpen={!!editingTransaction} onClose={() => setEditingTransaction(null)} title="✏️ Modification de Transaction (Autorisé RAF & DG)">
        {editingTransaction && (
          <EditTransactionForm 
            transaction={editingTransaction}
            onSave={handleSaveEdit}
            onCancel={() => setEditingTransaction(null)}
            currency={currency}
          />
        )}
      </Modal>
    </div>
  );
};

export default AccountingPage;
