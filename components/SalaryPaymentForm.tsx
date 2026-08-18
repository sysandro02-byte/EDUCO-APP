import React, { useState, useEffect, useMemo } from 'react';
import { Personnel } from '../App';
import { User } from './UserForm';
import ControlMatrixStatus, { ControlRule } from './ControlMatrixStatus';
import LoadingDots from './LoadingDots';

type Payment = { id: number; studentId: string; name: string; class: string; totalFees: number; amountPaid: number; familyId?: number };

export interface SalaryPaymentData {
    personnel: Personnel;
    netAmount: number;
    primes: { description: string; amount: number }[];
    deductions: { description: string; amount: number }[];
}

interface SalaryPaymentFormProps {
  personnelList: Personnel[];
  users: User[];
  payments: Payment[];
  onSave: (salaryData: SalaryPaymentData) => void;
  onCancel: () => void;
}

const SalaryPaymentForm: React.FC<SalaryPaymentFormProps> = ({ personnelList, users, payments, onSave, onCancel }) => {
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<number | ''>('');
  const [childrenDeductions, setChildrenDeductions] = useState<{ [studentId: string]: boolean }>({});
  const [netAmount, setNetAmount] = useState(0);
  const [currentPrimes, setCurrentPrimes] = useState<{ description: string; amount: number }[]>([]);
  const [currentDeductions, setCurrentDeductions] = useState<{ description: string; amount: number }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedPersonnel = useMemo(() => 
      personnelList.find(p => p.id === selectedPersonnelId),
      [selectedPersonnelId, personnelList]
  );

  const personnelChildren = useMemo(() => {
    if (!selectedPersonnel || !selectedPersonnel.familyId) return [];
    
    const childrenUserIds = users
      .filter(u => u.familyId === selectedPersonnel.familyId && u.role === 'Élève')
      .map(u => u.id);
      
    return payments.filter(p => childrenUserIds.includes(p.id) && (p.totalFees - p.amountPaid > 0));

  }, [selectedPersonnel, users, payments]);

  useEffect(() => {
    if (selectedPersonnel) {
        // Initialize deductions with children who have a balance
        const initialDeductions: { [studentId: string]: boolean } = {};
        personnelChildren.forEach(child => {
            initialDeductions[child.studentId] = true; // Default to deduct
        });
        setChildrenDeductions(initialDeductions);
    } else {
        setChildrenDeductions({});
    }
  }, [selectedPersonnel?.id, personnelChildren.length]);

  useEffect(() => {
    if (selectedPersonnel) {
      const baseSalary = selectedPersonnel.baseSalary || 0;
      const primes = selectedPersonnel.primes || [];
      const recurrentDeductions = selectedPersonnel.deductions || [];
      
      const tuitionDeductions = personnelChildren
        .filter(child => childrenDeductions[child.studentId])
        .map(child => ({
            description: `Frais scolarité - ${child.name}`,
            amount: child.totalFees - child.amountPaid,
        }));
        
      const allDeductions = [...recurrentDeductions, ...tuitionDeductions];
      const totalPrimes = primes.reduce((sum, p) => sum + p.amount, 0);
      const totalDeductions = allDeductions.reduce((sum, d) => sum + d.amount, 0);
      
      setCurrentPrimes(primes);
      setCurrentDeductions(allDeductions);
      setNetAmount(baseSalary + totalPrimes - totalDeductions);
    } else {
      setNetAmount(0);
      setCurrentPrimes([]);
      setCurrentDeductions([]);
    }
  }, [selectedPersonnel?.id, JSON.stringify(childrenDeductions), personnelChildren.length]);

  // MATRICE DE CONTRÔLE
  const validationRules = useMemo((): ControlRule[] => {
    return [
      {
        id: 'pers',
        label: selectedPersonnel ? `Collaborateur : ${selectedPersonnel.name}` : 'Sélection d\'un membre du personnel',
        isValid: !!selectedPersonnel,
      },
      {
        id: 'net',
        label: `Solde net calculé valide (${netAmount.toLocaleString()} €)`,
        isValid: !!selectedPersonnel && !isNaN(netAmount) && netAmount >= 0,
      },
    ];
  }, [selectedPersonnel, netAmount]);

  const isFormValid = useMemo(() => {
    return validationRules.every(r => r.isValid || r.isWarningOnly);
  }, [validationRules]);

  const handleChildDeductionToggle = (studentId: string) => {
    setChildrenDeductions(prev => ({
        ...prev,
        [studentId]: !prev[studentId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPersonnel && isFormValid && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 600));
        await Promise.resolve(onSave({
            personnel: selectedPersonnel,
            netAmount,
            primes: currentPrimes,
            deductions: currentDeductions,
        }));
      } catch (err) {
        console.error("Erreur lors de la validation du salaire vers Supabase:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div>
        <label htmlFor="personnel" className="block text-sm font-medium text-gray-700">Sélectionner un membre du personnel</label>
        <select 
          id="personnel" 
          value={selectedPersonnelId} 
          onChange={(e) => setSelectedPersonnelId(Number(e.target.value))}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option value="" disabled>-- Choisir un employé --</option>
          {personnelList.map(p => (
            <option key={p.id} value={p.id!}>{p.name} - {p.role}</option>
          ))}
        </select>
      </div>

      {selectedPersonnel && (
        <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
          <h4 className="font-semibold text-gray-800 mb-2">Détail du Calcul du Salaire</h4>
          
          <div className="flex justify-between text-sm"><span className="text-gray-600">Salaire de Base:</span> <span className="font-medium">{selectedPersonnel.baseSalary.toLocaleString()} €</span></div>

          {currentPrimes.map((prime, i) => (
             <div key={`p-${i}`} className="flex justify-between text-sm text-green-700"><span className="text-gray-600">{prime.description}:</span> <span className="font-medium">+ {prime.amount.toLocaleString()} €</span></div>
          ))}
          
          {currentDeductions.map((deduction, i) => (
             <div key={`d-${i}`} className="flex justify-between text-sm text-red-700"><span className="text-gray-600">{deduction.description}:</span> <span className="font-medium">- {deduction.amount.toLocaleString()} €</span></div>
          ))}

          {personnelChildren.length > 0 && (
            <div className="pt-2 mt-2 border-t">
                 <h5 className="font-semibold text-gray-700 text-sm mb-1">Enfants inscrits avec solde :</h5>
                 {personnelChildren.map(child => (
                    <div key={child.id} className="flex items-center justify-between text-sm">
                        <label htmlFor={`deduct-${child.studentId}`} className="flex items-center space-x-2 text-gray-600">
                           <input type="checkbox" id={`deduct-${child.studentId}`} checked={childrenDeductions[child.studentId] || false} onChange={() => handleChildDeductionToggle(child.studentId)} />
                           <span>Déduire frais pour {child.name}</span>
                        </label>
                        <span className="font-medium text-red-700">- {(child.totalFees - child.amountPaid).toLocaleString()} €</span>
                    </div>
                 ))}
            </div>
          )}

          <div className="text-right font-bold text-lg text-[#1F4A59] pt-2 border-t">
              Net à Payer : {netAmount.toLocaleString()} €
           </div>
        </div>
      )}

      {/* Matrice de Contrôle */}
      <ControlMatrixStatus rules={validationRules} title="Matrice de Contrôle de Paie" />

      <div className="flex justify-end space-x-2 pt-4 border-t mt-4">
        <button 
          type="button" 
          onClick={onCancel} 
          disabled={isSubmitting}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 disabled:opacity-50"
        >
          Annuler
        </button>
        <button 
          type="submit" 
          disabled={!isFormValid || isSubmitting} 
          className={`px-4 py-2 text-white rounded-md flex items-center gap-2 ${
            !isFormValid || isSubmitting 
              ? 'bg-gray-400 opacity-60 cursor-not-allowed' 
              : 'bg-[#1F4A59] hover:bg-[#2c5a6e] cursor-pointer'
          }`}
        >
          {isSubmitting ? (
            <>
              <span>Validation & Enregistrement Supabase</span>
              <LoadingDots />
            </>
          ) : (
            <span>Valider et Générer le Bulletin</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default SalaryPaymentForm;
