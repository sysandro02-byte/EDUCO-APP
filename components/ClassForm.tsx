import React, { useState, useEffect } from 'react';

export interface Class {
  id: number | null;
  name: string;
  level: string;
  maxStudents: number;
  mainTeacher?: string;
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
  });

  useEffect(() => {
    if (classData) {
      setFormData({
        ...classData,
        name: classData.name || '',
        level: classData.level || '',
        maxStudents: classData.maxStudents ?? 30,
      });
    } else {
      setFormData({ id: null, name: '', level: '', maxStudents: 30 });
    }
  }, [classData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'maxStudents' ? parseInt(value, 10) || 0 : value,
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
      <div>
        <label htmlFor="level" className="block text-sm font-medium text-gray-700">Niveau (ex: Primaire)</label>
        <input type="text" name="level" id="level" value={formData.level} onChange={handleChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div>
        <label htmlFor="maxStudents" className="block text-sm font-medium text-gray-700">Effectif Maximum</label>
        <input type="number" name="maxStudents" id="maxStudents" value={formData.maxStudents} onChange={handleChange} required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-md hover:bg-[#2c5a6e]">Sauvegarder</button>
      </div>
    </form>
  );
};

export default ClassForm;
