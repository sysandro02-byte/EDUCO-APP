import React, { useState, useEffect, useMemo } from 'react';
import { Personnel, RafSettings, SalaryPaymentData } from '../App';
import ControlMatrixStatus, { ControlRule } from './ControlMatrixStatus';
import LoadingDots from './LoadingDots';

interface SalaryFormProps {
  personnel: Personnel;
  onSave: (personnelId: number, paymentData: SalaryPaymentData) => void;
  onCancel: () => void;
  rafSettings: RafSettings;
  currency: string;
}

const SalaryForm: React.FC<SalaryFormProps> = ({ personnel, onSave, onCancel, rafSettings, currency }) => {
  // Période de paie
  const currentMonthName = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(new Date());
  const formattedCurrentMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);
  const currentYear = new Date().getFullYear().toString();
  
  const [selectedMonth, setSelectedMonth] = useState(formattedCurrentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Éléments exceptionnels et ad-hoc
  const [allowance, setAllowance] = useState(''); // Prime exceptionnelle existante
  const [customPrimeDesc, setCustomPrimeDesc] = useState('');
  const [customPrimeAmount, setCustomPrimeAmount] = useState('');
  
  const [customDeductionDesc, setCustomDeductionDesc] = useState('');
  const [customDeductionAmount, setCustomDeductionAmount] = useState('');

  // Toggles pour exonération fiscale
  const [applySocialSec, setApplySocialSec] = useState(true);
  const [applyIncomeTax, setApplyIncomeTax] = useState(true);

  // Options de paiement de salaire avancées
  const [paymentMethod, setPaymentMethod] = useState<'Espèce' | 'Mobile Money' | 'Virement' | 'Chèque'>('Espèce');
  const [mobileOperator, setMobileOperator] = useState('Wave');
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState('');
  const [mobileTxRef, setMobileTxRef] = useState('');
  const [bankName, setBankName] = useState('');
  const [virementReference, setVirementReference] = useState('');
  const [chequeNumber, setChequeNumber] = useState('');
  const [issuingBank, setIssuingBank] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Calculs détaillés
  const [netAmount, setNetAmount] = useState(0);
  const [calculation, setCalculation] = useState({
      baseSalary: 0,
      totalPrimes: 0,
      totalDeductions: 0,
      grossSalary: 0,
      socialContributions: 0,
      taxableSalary: 0,
      incomeTax: 0,
  });

  const { baseSalary, primes = [], deductions = [] } = personnel;

  useEffect(() => {
    const allowanceAmount = parseFloat(allowance) || 0;
    const additionalPrimeVal = parseFloat(customPrimeAmount) || 0;
    const additionalDeductionVal = parseFloat(customDeductionAmount) || 0;

    // Primes contractuelles + Prime exceptionnelle classique + Prime ad-hoc custom
    const basePrimesTotal = primes.reduce((sum, p) => sum + p.amount, 0);
    const totalPrimes = basePrimesTotal + allowanceAmount + additionalPrimeVal;

    // Salaire brut de base pour charges
    const grossSalary = baseSalary + totalPrimes;

    // Cotisations Sociales facultatives
    const socialContributions = applySocialSec 
      ? grossSalary * (rafSettings.salaries.socialContributionsRate / 100)
      : 0;

    const taxableSalary = Math.max(0, grossSalary - socialContributions);

    // Impôt sur le revenu facultatif
    const incomeTax = applyIncomeTax
      ? taxableSalary * (rafSettings.salaries.incomeTaxRate / 100)
      : 0;

    // Retenues contractuelles + Retenue ad-hoc custom
    const baseDeductionsTotal = deductions.reduce((sum, d) => sum + d.amount, 0);
    const totalDeductions = baseDeductionsTotal + additionalDeductionVal;

    // Somme de toutes les retenues et charges
    const grandTotalDeductions = totalDeductions + socialContributions + incomeTax;
    
    setNetAmount(Math.max(0, grossSalary - grandTotalDeductions));
    setCalculation({ 
      baseSalary,
      totalPrimes, 
      totalDeductions,
      grossSalary, 
      socialContributions, 
      taxableSalary, 
      incomeTax 
    });

  }, [
    allowance, 
    customPrimeAmount, 
    customDeductionAmount, 
    baseSalary, 
    primes, 
    deductions, 
    rafSettings, 
    applySocialSec, 
    applyIncomeTax
  ]);

  // MATRICE DE CONTRÔLE DE SAISIE DE SALAIRE
  const validationRules = useMemo((): ControlRule[] => {
    return [
      {
        id: 'pers',
        label: `Collaborateur désigné : ${personnel.name || 'Inconnu'}`,
        isValid: !!personnel && !!personnel.name,
      },
      {
        id: 'period',
        label: `Période de paie : ${selectedMonth} ${selectedYear}`,
        isValid: !!selectedMonth && !!selectedYear,
      },
      {
        id: 'net',
        label: `Salaire Net calculé valide (${netAmount.toLocaleString()} ${currency})`,
        isValid: !isNaN(netAmount) && netAmount >= 0,
      },
      {
        id: 'method',
        label: paymentMethod === 'Mobile Money'
          ? 'N° Mobile Money (min 6 chiffres)'
          : paymentMethod === 'Virement'
            ? 'Nom de la banque renseigné'
            : paymentMethod === 'Chèque'
              ? 'N° de chèque renseigné'
              : 'Mode de règlement comptant (Espèces)',
        isValid: paymentMethod === 'Mobile Money'
          ? mobileMoneyNumber.trim().length >= 6
          : paymentMethod === 'Virement'
            ? bankName.trim().length >= 2
            : paymentMethod === 'Chèque'
              ? chequeNumber.trim().length >= 2
              : true,
      },
    ];
  }, [personnel, selectedMonth, selectedYear, netAmount, currency, paymentMethod, mobileMoneyNumber, bankName, chequeNumber]);

  const isFormValid = useMemo(() => {
    return validationRules.every(r => r.isValid || r.isWarningOnly);
  }, [validationRules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;

    const allowanceAmount = parseFloat(allowance) || 0;
    const additionalPrimeVal = parseFloat(customPrimeAmount) || 0;
    const additionalDeductionVal = parseFloat(customDeductionAmount) || 0;
    const salaryPeriod = `${selectedMonth} ${selectedYear}`;

    // Construire la liste des primes définitives
    const finalPrimes = [...primes];
    if (allowanceAmount > 0) {
      finalPrimes.push({ description: 'Prime Exceptionnelle', amount: allowanceAmount, id: `allowance_${Date.now()}` });
    }
    if (additionalPrimeVal > 0 && customPrimeDesc) {
      finalPrimes.push({ description: customPrimeDesc, amount: additionalPrimeVal, id: `custom_prime_${Date.now()}` });
    }

    // Construire la liste des retenues définitives
    const finalDeductions = [...deductions];
    if (additionalDeductionVal > 0 && customDeductionDesc) {
      finalDeductions.push({ description: customDeductionDesc, amount: additionalDeductionVal, id: `custom_deduct_${Date.now()}` });
    }
    if (calculation.socialContributions > 0) {
      finalDeductions.push({ description: `Cotisations Sociales (${rafSettings.salaries.socialContributionsRate}%)`, amount: calculation.socialContributions, id: 'social' });
    }
    if (calculation.incomeTax > 0) {
      finalDeductions.push({ description: `Impôt sur le Revenu (${rafSettings.salaries.incomeTaxRate}%)`, amount: calculation.incomeTax, id: 'tax' });
    }

    const paymentData: SalaryPaymentData = {
      netAmount,
      details: {
        primes: finalPrimes,
        deductions: finalDeductions,
        allowance: allowanceAmount,
        paymentMethod,
        mobileOperator: paymentMethod === 'Mobile Money' ? mobileOperator : undefined,
        mobileMoneyNumber: paymentMethod === 'Mobile Money' ? mobileMoneyNumber : undefined,
        mobileTxRef: paymentMethod === 'Mobile Money' ? mobileTxRef : undefined,
        bankName: paymentMethod === 'Virement' ? bankName : undefined,
        virementReference: paymentMethod === 'Virement' ? virementReference : undefined,
        chequeNumber: paymentMethod === 'Chèque' ? chequeNumber : undefined,
        issuingBank: paymentMethod === 'Chèque' ? issuingBank : undefined,
        salaryPeriod,
        notes: paymentNotes,
      }
    };

    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      await Promise.resolve(onSave(personnel.id!, paymentData));
    } catch (err) {
      console.error("Erreur lors de l'enregistrement du salaire vers Supabase:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDetailRow = (label: string, amount: number, colorClass = 'text-slate-700', isBold = false, key?: string | number) => (
    <div key={key} className={`flex justify-between items-center text-xs py-1 ${isBold ? 'font-bold border-t border-slate-200 mt-1 pt-1.5' : ''}`}>
      <span className="text-slate-500 font-medium">{label}</span>
      <span className={`font-mono font-semibold ${colorClass}`}>
        {amount > 0 ? '+' : ''}{amount.toLocaleString()} {currency}
      </span>
    </div>
  );

  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  const years = [
    (new Date().getFullYear() - 1).toString(),
    new Date().getFullYear().toString(),
    (new Date().getFullYear() + 1).toString()
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-slate-800">
      {/* Employee Brief Header */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="px-2 py-0.5 bg-[#1F4A59]/10 text-[#1F4A59] rounded text-[10px] font-extrabold uppercase tracking-wider">
            {personnel.role}
          </span>
          <h3 className="text-base font-extrabold text-slate-800 mt-1">{personnel.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5">Dernier versement : {personnel.lastPaymentDate || 'Aucun versement enregistré'}</p>
        </div>
        <div className="text-left sm:text-right">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Salaire Contractuel</span>
          <span className="text-base font-black text-slate-800 font-mono">
            {personnel.baseSalary.toLocaleString()} {currency}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: OPTIONS & INPUTS */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* SECTION 1: Période de paie */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              📅 Période de Paie
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Mois de versement</label>
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9"
                >
                  {months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Année</label>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: Éléments variables et exceptionnels */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              ⚡ Variables Exceptionnelles du Mois
            </h4>
            
            <div className="space-y-3">
              <div>
                <label htmlFor="allowance" className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Prime Exceptionnelle Standard ({currency})
                </label>
                <input 
                  type="number" 
                  name="allowance" 
                  id="allowance" 
                  value={allowance} 
                  onChange={(e) => setAllowance(e.target.value)} 
                  min="0"
                  step="0.01"
                  className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9"
                  placeholder="Ex: 15000"
                />
              </div>

              {/* Autre prime ad-hoc */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Libellé Prime Additionnelle</label>
                  <input 
                    type="text"
                    value={customPrimeDesc}
                    onChange={(e) => setCustomPrimeDesc(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9"
                    placeholder="Ex: Indemnité Transport"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Montant Prime ({currency})</label>
                  <input 
                    type="number"
                    value={customPrimeAmount}
                    onChange={(e) => setCustomPrimeAmount(e.target.value)}
                    min="0"
                    className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 font-mono"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Autre déduction ad-hoc */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Motif Retenue / Acompte Exceptionnel</label>
                  <input 
                    type="text"
                    value={customDeductionDesc}
                    onChange={(e) => setCustomDeductionDesc(e.target.value)}
                    className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9"
                    placeholder="Ex: Retard répété / Acompte"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Montant Retenu ({currency})</label>
                  <input 
                    type="number"
                    value={customDeductionAmount}
                    onChange={(e) => setCustomDeductionAmount(e.target.value)}
                    min="0"
                    className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59] h-9 font-mono text-rose-600"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Mode de Règlement de Salaire */}
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              💳 Mode de Règlement du Salaire
            </h4>
            
            {/* Grid selector style */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['Espèce', 'Mobile Money', 'Virement', 'Chèque'] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-2 px-3 text-xs font-extrabold rounded-lg border transition-all text-center cursor-pointer ${
                    paymentMethod === method 
                      ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {method === 'Espèce' && '💵 Espèce'}
                  {method === 'Mobile Money' && '📱 Mobile M.'}
                  {method === 'Virement' && '🏦 Virement'}
                  {method === 'Chèque' && '✍️ Chèque'}
                </button>
              ))}
            </div>

            {/* Sub fields for Mobile Money */}
            {paymentMethod === 'Mobile Money' && (
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-3 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Opérateur</label>
                    <select 
                      value={mobileOperator} 
                      onChange={(e) => setMobileOperator(e.target.value)}
                      className="block w-full rounded-lg border-indigo-200 text-xs focus:ring-indigo-500 focus:border-indigo-500 h-9 bg-white"
                    >
                      <option value="Wave">Wave</option>
                      <option value="Orange Money">Orange Money</option>
                      <option value="MTN MoMo">MTN Mobile Money</option>
                      <option value="Moov Money">Moov Money</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Numéro de téléphone bénéficiaire</label>
                    <input 
                      type="text" 
                      value={mobileMoneyNumber} 
                      onChange={(e) => setMobileMoneyNumber(e.target.value)}
                      required={paymentMethod === 'Mobile Money'}
                      placeholder="Ex: +225 07 00 00 00 00"
                      className="block w-full rounded-lg border-indigo-200 text-xs focus:ring-indigo-500 focus:border-indigo-500 h-9 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-indigo-700 uppercase mb-1">Référence Transaction Mobile (ID)</label>
                  <input 
                    type="text" 
                    value={mobileTxRef} 
                    onChange={(e) => setMobileTxRef(e.target.value)}
                    placeholder="Ex: MP260814.1523.A00124"
                    className="block w-full rounded-lg border-indigo-200 text-xs focus:ring-indigo-500 focus:border-indigo-500 h-9 bg-white"
                  />
                </div>
              </div>
            )}

            {/* Sub fields for Virement */}
            {paymentMethod === 'Virement' && (
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Établissement Bancaire (Bancaire)</label>
                    <input 
                      type="text" 
                      value={bankName} 
                      onChange={(e) => setBankName(e.target.value)}
                      required={paymentMethod === 'Virement'}
                      placeholder="Ex: SGCI, Ecobank, Coris Bank"
                      className="block w-full rounded-lg border-emerald-200 text-xs focus:ring-emerald-500 focus:border-emerald-500 h-9 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-emerald-700 uppercase mb-1">Référence du Virement (Numéro Ordre)</label>
                    <input 
                      type="text" 
                      value={virementReference} 
                      onChange={(e) => setVirementReference(e.target.value)}
                      required={paymentMethod === 'Virement'}
                      placeholder="Ex: VIR-SALA-2026-081"
                      className="block w-full rounded-lg border-emerald-200 text-xs focus:ring-emerald-500 focus:border-emerald-500 h-9 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sub fields for Chèque */}
            {paymentMethod === 'Chèque' && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100 space-y-3 animate-fadeIn">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1">Numéro du Chèque Émis</label>
                    <input 
                      type="text" 
                      value={chequeNumber} 
                      onChange={(e) => setChequeNumber(e.target.value)}
                      required={paymentMethod === 'Chèque'}
                      placeholder="Ex: CHQ-9081245"
                      className="block w-full rounded-lg border-amber-200 text-xs focus:ring-amber-500 focus:border-amber-500 h-9 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-700 uppercase mb-1">Banque émettrice</label>
                    <input 
                      type="text" 
                      value={issuingBank} 
                      onChange={(e) => setIssuingBank(e.target.value)}
                      placeholder="Ex: SIB, BOA, NSIA"
                      className="block w-full rounded-lg border-amber-200 text-xs focus:ring-amber-500 focus:border-amber-500 h-9 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Notes / Observations Internes (Fiche de paie)</label>
              <textarea 
                value={paymentNotes} 
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="Notes internes de comptabilité (ex: primes exceptionnelles de rendement ou justifications d'absence...)"
                rows={2}
                className="block w-full rounded-lg border-gray-300 text-xs focus:ring-[#1F4A59] focus:border-[#1F4A59]"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PROFESSIONAL COMPUTATION PREVIEW */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl border border-slate-800 space-y-4 relative overflow-hidden">
            
            {/* Decortive dark glow background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-2xl" />
            
            <div>
              <h4 className="text-xs font-black uppercase text-teal-400 tracking-widest">
                📑 Récapitulatif Budgétaire & Fiscal
              </h4>
              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">
                Période: {selectedMonth} {selectedYear}
              </p>
            </div>

            <div className="space-y-2 border-b border-slate-800 pb-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Salaire de Base Contractuel :</span>
                <span className="font-mono font-semibold">{baseSalary.toLocaleString()} {currency}</span>
              </div>

              {/* Total Primes contractuelles + Exceptionnelles */}
              <div className="flex justify-between text-xs text-teal-300">
                <span className="text-slate-400">Primes & Indemnités (+ ad-hoc) :</span>
                <span className="font-mono font-bold">+{calculation.totalPrimes.toLocaleString()} {currency}</span>
              </div>

              <div className="flex justify-between text-xs font-black border-t border-slate-800/60 pt-2 text-slate-200">
                <span>Salaire Brut Total :</span>
                <span className="font-mono">{calculation.grossSalary.toLocaleString()} {currency}</span>
              </div>
            </div>

            {/* Charges patronales / Cotisations */}
            <div className="space-y-2.5 border-b border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={applySocialSec}
                    onChange={(e) => setApplySocialSec(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 text-teal-500 focus:ring-teal-500 bg-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Cotisations Soc. ({rafSettings.salaries.socialContributionsRate}%)</span>
                </label>
                <span className="text-xs text-rose-400 font-mono font-semibold">
                  -{calculation.socialContributions.toLocaleString()} {currency}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={applyIncomeTax}
                    onChange={(e) => setApplyIncomeTax(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-700 text-teal-500 focus:ring-teal-500 bg-slate-800"
                  />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Impôt s/ Revenu ({rafSettings.salaries.incomeTaxRate}%)</span>
                </label>
                <span className="text-xs text-rose-400 font-mono font-semibold">
                  -{calculation.incomeTax.toLocaleString()} {currency}
                </span>
              </div>

              {/* Retenues contractuelles et additionnelles */}
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 uppercase text-[10px] font-bold">Avances & Retenues contractuelles :</span>
                <span className="font-mono text-rose-400 font-semibold">-{calculation.totalDeductions.toLocaleString()} {currency}</span>
              </div>
            </div>

            {/* Total Net à payer */}
            <div className="pt-2 bg-slate-950/40 p-4 rounded-xl border border-slate-800/80">
              <span className="text-[10px] font-black uppercase text-teal-400 tracking-wider block mb-1">
                Net à Verser au Collaborateur ({paymentMethod})
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black font-mono text-white tracking-tight">
                  {netAmount.toLocaleString()}
                </span>
                <span className="text-xs font-black text-slate-400 uppercase">{currency}</span>
              </div>
              {paymentMethod === 'Mobile Money' && mobileMoneyNumber && (
                <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800 pt-1 flex justify-between">
                  <span>Compte mobile:</span>
                  <span className="font-mono text-white font-bold">{mobileOperator} ({mobileMoneyNumber})</span>
                </div>
              )}
              {paymentMethod === 'Virement' && bankName && (
                <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800 pt-1 flex justify-between">
                  <span>Virement Banque:</span>
                  <span className="text-white font-bold">{bankName}</span>
                </div>
              )}
              {paymentMethod === 'Chèque' && chequeNumber && (
                <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800 pt-1 flex justify-between">
                  <span>N° Chèque:</span>
                  <span className="font-mono text-white font-bold">{chequeNumber}</span>
                </div>
              )}
            </div>
            
            {/* Matrice de Contrôle de Conformité */}
            <ControlMatrixStatus rules={validationRules} title="Matrice de Contrôle Paie" />

            <div className="text-[10px] text-slate-500 italic leading-relaxed text-center">
              * Ce versement de salaire sera enregistré en dépenses et soumis à la validation réglementaire de la direction.
            </div>
          </div>

          {/* Cancel & Submit Button inside container */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button 
              type="button" 
              onClick={onCancel} 
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition-all cursor-pointer text-center disabled:opacity-50"
            >
              Annuler
            </button>
            <button 
              type="submit" 
              disabled={!isFormValid || isSubmitting}
              className={`flex-2 px-5 py-2.5 text-white text-xs font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 ${
                !isFormValid || isSubmitting
                  ? 'bg-slate-400 opacity-60 cursor-not-allowed'
                  : 'bg-[#1F4A59] hover:bg-[#2c5a6e] cursor-pointer'
              }`}
            >
              {isSubmitting ? (
                <>
                  <span>Validation & Enregistrement Supabase</span>
                  <LoadingDots />
                </>
              ) : (
                <span>💾 Enregistrer & Valider le Salaire</span>
              )}
            </button>
          </div>

        </div>
      </div>
    </form>
  );
};

export default SalaryForm;
