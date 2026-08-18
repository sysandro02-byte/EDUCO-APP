import React, { useState, useEffect } from 'react';
import { User } from './UserForm';

export interface Subject {
  id: number | null;
  name: string;
  teacherIds?: number[];
}

interface SubjectFormProps {
  subject: Subject | null;
  teachers: User[];
  onSave: (subject: Subject) => void;
  onCancel: () => void;
}

const SubjectForm: React.FC<SubjectFormProps> = ({ subject, teachers, onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);

  useEffect(() => {
    if (subject) {
      setName(subject.name || '');
      setSelectedTeacherIds(subject.teacherIds || []);
    } else {
      setName('');
      setSelectedTeacherIds([]);
    }
  }, [subject]);

  const handleTeacherSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedIds = Array.from(e.target.selectedOptions, (option: HTMLOptionElement) => Number(option.value));
    setSelectedTeacherIds(selectedIds);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ id: subject ? subject.id : null, name, teacherIds: selectedTeacherIds });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nom de la matière</label>
        <input
          type="text"
          name="name"
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Ex: Mathématiques"
        />
      </div>
       <div>
        <label htmlFor="teachers" className="block text-sm font-medium text-gray-700">Enseignant(s) assigné(s)</label>
        <select
          id="teachers"
          multiple
          value={selectedTeacherIds.map(String)}
          onChange={handleTeacherSelect}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm h-32"
        >
          {teachers.map(teacher => (
            <option key={teacher.id} value={teacher.id!}>
              {teacher.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-500 mt-1">Maintenez Ctrl (ou Cmd sur Mac) pour sélectionner plusieurs enseignants.</p>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-md hover:bg-[#2c5a6e]">Sauvegarder</button>
      </div>
    </form>
  );
};

export default SubjectForm;