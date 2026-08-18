import React, { useState, useEffect, useMemo } from 'react';
import { Class } from './ClassForm';
import ControlMatrixStatus, { ControlRule } from './ControlMatrixStatus';
import LoadingDots from './LoadingDots';

export interface Fee {
  id: number | null;
  class: string; // Can now be a class name or a service name
  type: string;
  amount: number;
  period: string;
}

interface FeeFormProps {
  fee: Fee | null;
  classes: Class[];
  onSave: (fee: Fee) => void;
  onCancel: () => void;
}

const FeeForm: React.FC<FeeFormProps> = ({ fee, classes, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Fee>({
    id: null,
    class: '',
    type: 'Scolarité',
    amount: 0,
    period: 'Annuel',
  });
  const [applyTo, setApplyTo] = useState<'class' | 'service'>('class');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (fee) {
      setFormData({
        ...fee,
        class: fee.class || '',
        type: fee.type || '',
        amount: fee.amount ?? 0,
        period: fee.period || 'Annuel',
      });
      const isAClass = (classes || []).some(c => c.name === fee.class);
      setApplyTo(isAClass ? 'class' : 'service');
    } else {
      setFormData({ id: null, class: (classes || [])[0]?.name || '', type: 'Scolarité', amount: 0, period: 'Annuel' });
      setApplyTo('class');
    }
  }, [fee, classes]);

  const handleApplyToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newApplyTo = e.target.value as 'class' | 'service';
    setApplyTo(newApplyTo);
    if (newApplyTo === 'class') {
      setFormData(prev => ({ ...prev, class: classes[0]?.name || '' }));
    } else {
      setFormData(prev => ({ ...prev, class: '' }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'amount' ? parseFloat(value) || 0 : value,
    }));
  };

  // Matrice de Contrôle
  const validationRules = useMemo((): ControlRule[] => {
    return [
      {
        id: 'target',
        label: applyTo === 'class' ? `Classe ciblée : ${formData.class || 'Non spécifiée'}` : `Service : ${formData.class || 'Non spécifié'}`,
        isValid: formData.class.trim().length > 0,
      },
      {
        id: 'type',
        label: `Intitulé du frais : ${formData.type || 'Non spécifié'}`,
        isValid: formData.type.trim().length > 0,
      },
      {
        id: 'amount',
        label: `Montant valide (> 0) : ${formData.amount} €`,
        isValid: !isNaN(formData.amount) && formData.amount > 0,
      },
    ];
  }, [applyTo, formData]);

  const isFormValid = useMemo(() => {
    return validationRules.every(r => r.isValid || r.isWarningOnly);
  }, [validationRules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.class && formData.amount > 0 && isFormValid && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        await Promise.resolve(onSave(formData));
      } catch (err) {
        console.error("Erreur lors de l'enregistrement du tarif vers Supabase:", err);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Appliquer le tarif à</label>
        <div className="mt-2 flex items-center gap-x-6">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="radio" value="class" name="applyTo" checked={applyTo === 'class'} onChange={handleApplyToChange} className="form-radio h-4 w-4 text-indigo-600"/>
            <span className="text-sm text-gray-700">Une Classe Spécifique</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input type="radio" value="service" name="applyTo" checked={applyTo === 'service'} onChange={handleApplyToChange} className="form-radio h-4 w-4 text-indigo-600"/>
            <span className="text-sm text-gray-700">Un Service Général</span>
          </label>
        </div>
      </div>

      {applyTo === 'class' ? (
        <div>
          <label htmlFor="class" className="block text-sm font-medium text-gray-700">Classe</label>
          <select
            name="class"
            id="class"
            value={formData.class}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
      ) : (
        <div>
          <label htmlFor="serviceName" className="block text-sm font-medium text-gray-700">Nom du Service</label>
          <input
            type="text"
            name="class"
            id="serviceName"
            value={formData.class}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Ex: Garderie, Cantine, TD..."
          />
        </div>
      )}

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type de Frais</label>
        <input type="text" name="type" id="type" value={formData.type} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div>
        <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Montant (€)</label>
        <input type="number" name="amount" id="amount" value={formData.amount} onChange={handleChange} required min="0.01" step="0.01" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div>
        <label htmlFor="period" className="block text-sm font-medium text-gray-700">Période</label>
        <select
          name="period"
          id="period"
          value={formData.period}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          <option>Annuel</option>
          <option>Trimestriel</option>
          <option>Mensuel</option>
        </select>
      </div>

      {/* Matrice de Contrôle */}
      <ControlMatrixStatus rules={validationRules} title="Matrice de Contrôle Tarifaire" />

      <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
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
              <span>Enregistrement Supabase</span>
              <LoadingDots />
            </>
          ) : (
            <span>Sauvegarder</span>
          )}
        </button>
      </div>
    </form>
  );
};

export default FeeForm;
