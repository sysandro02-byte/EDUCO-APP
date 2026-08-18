import React, { useState, useEffect } from 'react';
import { TrashIcon } from './Icons';
import { Personnel } from '../App';

interface PersonnelFormProps {
  personnel: Personnel | null;
  onSave: (personnel: Personnel) => void;
  onCancel: () => void;
}

const PersonnelForm: React.FC<PersonnelFormProps> = ({ personnel, onSave, onCancel }) => {
  const getInitialFormData = (): Personnel => ({
    id: null,
    name: '',
    role: '',
    baseSalary: 0,
    lastPaymentDate: 'N/A',
    primes: [],
    deductions: [],
    matricule: '',
    cnss: '',
    qualification: '',
    typePersonnel: 'Personnel Administratif',
    hireDate: '',
    direction: '',
    category: '',
    bankAccount: '',
    maritalStatus: 'Célibataire',
    residence: '',
    childrenCount: 0,
    paymentMethod: 'Espèce',
  });

  const [formData, setFormData] = useState<Personnel>(getInitialFormData());

  useEffect(() => {
    if (personnel) {
      setFormData({
        ...getInitialFormData(),
        ...personnel,
        name: personnel.name || '',
        role: personnel.role || '',
        baseSalary: personnel.baseSalary ?? 0,
        lastPaymentDate: personnel.lastPaymentDate || 'N/A',
        matricule: personnel.matricule || '',
        cnss: personnel.cnss || '',
        qualification: personnel.qualification || '',
        typePersonnel: personnel.typePersonnel || 'Personnel Administratif',
        hireDate: personnel.hireDate || '',
        direction: personnel.direction || '',
        category: personnel.category || '',
        bankAccount: personnel.bankAccount || '',
        maritalStatus: personnel.maritalStatus || 'Célibataire',
        residence: personnel.residence || '',
        childrenCount: personnel.childrenCount ?? 0,
        paymentMethod: personnel.paymentMethod || 'Espèce',
        primes: personnel.primes || [],
        deductions: personnel.deductions || [],
      });
    } else {
        setFormData(getInitialFormData());
    }
  }, [personnel]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: (name === 'baseSalary' || name === 'childrenCount') ? parseFloat(value) || 0 : value,
    }));
  };
  
  const handleItemChange = (type: 'primes' | 'deductions', index: number, field: 'description' | 'amount', value: string | number) => {
      const updatedItems = [...(formData[type] || [])];
      (updatedItems[index] as any)[field] = value;
      setFormData(prev => ({ ...prev, [type]: updatedItems }));
  };
  
  const handleAddItem = (type: 'primes' | 'deductions') => {
      const newItem = { id: `item_${Date.now()}`, description: '', amount: 0 };
      setFormData(prev => ({ ...prev, [type]: [...(prev[type] || []), newItem] }));
  };

  const handleRemoveItem = (type: 'primes' | 'deductions', index: number) => {
      const updatedItems = (formData[type] || []).filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, [type]: updatedItems }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  const renderItemsSection = (type: 'primes' | 'deductions', title: string) => (
    <div className="space-y-2 p-3 border rounded-md bg-gray-50">
      <h4 className="font-semibold text-gray-600">{title}</h4>
      {(formData[type] || []).map((item, index) => (
          <div key={item.id} className="flex items-center gap-2">
              <input 
                  type="text" 
                  placeholder="Description" 
                  value={item.description} 
                  onChange={(e) => handleItemChange(type, index, 'description', e.target.value)}
                  className="flex-grow block w-full rounded-md border-gray-300 shadow-sm sm:text-sm"
              />
              <input 
                  type="number" 
                  placeholder="Montant" 
                  value={item.amount} 
                  onChange={(e) => handleItemChange(type, index, 'amount', parseFloat(e.target.value) || 0)}
                  className="w-24 block rounded-md border-gray-300 shadow-sm sm:text-sm"
              />
              <button type="button" onClick={() => handleRemoveItem(type, index)} className="text-red-500 hover:text-red-700">
                  <TrashIcon className="w-4 h-4" />
              </button>
          </div>
      ))}
      <button type="button" onClick={() => handleAddItem(type)} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          + Ajouter un élément
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nom complet</label>
            <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700">Rôle</label>
            <input type="text" name="role" id="role" value={formData.role} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="matricule" className="block text-sm font-medium text-gray-700">N° Matricule</label>
            <input type="text" name="matricule" id="matricule" value={formData.matricule} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="qualification" className="block text-sm font-medium text-gray-700">Qualification</label>
            <input type="text" name="qualification" id="qualification" value={formData.qualification} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="cnss" className="block text-sm font-medium text-gray-700">N° CNSS</label>
            <input type="text" name="cnss" id="cnss" value={formData.cnss} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="typePersonnel" className="block text-sm font-medium text-gray-700">Type de personnel</label>
            <select name="typePersonnel" id="typePersonnel" value={formData.typePersonnel} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                <option>Personnel Administratif</option>
                <option>Personnel Pédagogique</option>
            </select>
        </div>
        <div>
            <label htmlFor="hireDate" className="block text-sm font-medium text-gray-700">Date d'embauche</label>
            <input type="date" name="hireDate" id="hireDate" value={formData.hireDate} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="direction" className="block text-sm font-medium text-gray-700">Direction</label>
            <input type="text" name="direction" id="direction" value={formData.direction} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-700">N° de compte bancaire</label>
            <input type="text" name="bankAccount" id="bankAccount" value={formData.bankAccount} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="maritalStatus" className="block text-sm font-medium text-gray-700">Situation matrimoniale</label>
            <select name="maritalStatus" id="maritalStatus" value={formData.maritalStatus} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                <option>Célibataire</option>
                <option>Marié(e)</option>
                <option>Divorcé(e)</option>
                <option>Veuf(ve)</option>
            </select>
        </div>
         <div>
            <label htmlFor="residence" className="block text-sm font-medium text-gray-700">Résidence</label>
            <input type="text" name="residence" id="residence" value={formData.residence} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
        <div>
            <label htmlFor="childrenCount" className="block text-sm font-medium text-gray-700">Nombre d'enfant</label>
            <input type="number" name="childrenCount" id="childrenCount" value={formData.childrenCount} onChange={handleChange} min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
         <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">Mode de paiement</label>
            <select name="paymentMethod" id="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
                <option>Espèce</option>
                <option>Virement</option>
                <option>Chèque</option>
            </select>
        </div>
        <div>
            <label htmlFor="baseSalary" className="block text-sm font-medium text-gray-700">Salaire de Base (€)</label>
            <input type="number" name="baseSalary" id="baseSalary" value={formData.baseSalary} onChange={handleChange} required min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm" />
        </div>
      </div>
      
      {renderItemsSection('primes', 'Primes Récurrentes')}
      {renderItemsSection('deductions', 'Déductions Récurrentes')}

      <div className="flex justify-end space-x-2 pt-4 border-t mt-6">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-md hover:bg-[#2c5a6e]">Sauvegarder</button>
      </div>
    </form>
  );
};

export default PersonnelForm;
