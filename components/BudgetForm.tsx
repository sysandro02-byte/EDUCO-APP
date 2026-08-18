
import React, { useState } from 'react';

interface BudgetFormProps {
  currentBudget: number;
  onSave: (newBudget: number) => void;
  onCancel: () => void;
  currency: string;
}

const BudgetForm: React.FC<BudgetFormProps> = ({ currentBudget, onSave, onCancel, currency }) => {
  const [budget, setBudget] = useState(currentBudget);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(budget);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="budget" className="block text-sm font-medium text-gray-700">Montant Total du Budget Annuel ({currency})</label>
        <input
          type="number"
          name="budget"
          id="budget"
          value={budget}
          onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
          required
          min="0"
          step="1"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="350000"
        />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-md hover:bg-[#2c5a6e]">Sauvegarder le Budget</button>
      </div>
    </form>
  );
};

export default BudgetForm;
