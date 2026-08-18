import React, { useState } from 'react';

type AcademicYear = {
  startDate: string;
  endDate: string;
}

interface AcademicYearFormProps {
  currentYear: AcademicYear;
  onSave: (year: AcademicYear) => void;
  onCancel: () => void;
}

const AcademicYearForm: React.FC<AcademicYearFormProps> = ({ currentYear, onSave, onCancel }) => {
  const [year, setYear] = useState(currentYear);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setYear(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(year);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Date de début</label>
        <input
          type="date"
          name="startDate"
          id="startDate"
          value={year.startDate}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <div>
        <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Date de fin</label>
        <input
          type="date"
          name="endDate"
          id="endDate"
          value={year.endDate}
          onChange={handleChange}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-md hover:bg-[#2c5a6e]">Sauvegarder</button>
      </div>
    </form>
  );
};

export default AcademicYearForm;
