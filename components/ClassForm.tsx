import React, { useState, useEffect } from 'react';

export interface Class {
  id: number | null;
  name: string;
  level: string;
  maxStudents: number;
  mainTeacher?: string;
  tuitionFee?: number;
  isExamClass?: boolean;
  status?: 'active' | 'inactive';
}

interface ClassFormProps {
  classData: Class | null;
  onSave: (cls: Class) => void;
  onCancel: () => void;
}

const ClassForm: React.FC<ClassFormProps> = ({ classData, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Class>({
    id: null,
    name: '',
    level: '',
    maxStudents: 30,
    tuitionFee: 0,
    isExamClass: false,
    status: 'active',
  });

  useEffect(() => {
    if (classData) {
      setFormData({
        ...classData,
        name: classData.name || '',
        level: classData.level || '',
        maxStudents: classData.maxStudents ?? 30,
        tuitionFee: Number((classData as any).tuitionFee || 0),
        isExamClass: Boolean((classData as any).isExamClass),
        status: (classData as any).status || 'active',
      });
    } else {
      setFormData({ id: null, name: '', level: '', maxStudents: 30, tuitionFee: 0, isExamClass: false, status: 'active' });
    }
  }, [classData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const checked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'isExamClass' ? checked : name === 'maxStudents' ? parseInt(value, 10) || 0 : name === 'tuitionFee' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.level && formData.maxStudents > 0) {
      onSave(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nom de la classe (ex: CM2 A)</label>
        <input type="text" name="name" id="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
          <input type="checkbox" name="isExamClass" checked={Boolean(formData.isExamClass)} onChange={handleChange} className="rounded text-[#1F4A59]" />
          Classe d'examen
        </label>
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">Statut</label>
          <select id="status" name="status" value={formData.status || 'active'} onChange={handleChange as any} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm sm:text-sm">
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="level" className="block text-sm font-medium text-gray-700">Niveau (ex: Primaire)</label>
        <input type="text" name="level" id="level" value={formData.level} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div>
        <label htmlFor="maxStudents" className="block text-sm font-medium text-gray-700">Effectif Maximum</label>
        <input type="number" name="maxStudents" id="maxStudents" value={formData.maxStudents} onChange={handleChange} required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div>
        <label htmlFor="tuitionFee" className="block text-sm font-medium text-gray-700">Frais d'écolage par défaut</label>
        <input type="number" name="tuitionFee" id="tuitionFee" value={formData.tuitionFee || 0} onChange={handleChange} min="0" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-md hover:bg-[#2c5a6e]">Sauvegarder</button>
      </div>
    </form>
  );
};

export default ClassForm;
