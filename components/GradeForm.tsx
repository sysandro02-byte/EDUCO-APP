import React, { useState } from 'react';
import { User } from './UserForm';

export interface Grade {
  id?: string;
  studentId: number;
  classId: number;
  subject: string;
  assignment: string;
  score: number;
  studentName?: string;
}

interface GradeFormProps {
  students: User[];
  subject: string;
  onSave: (grade: Grade) => void;
  onCancel: () => void;
}

const GradeForm: React.FC<GradeFormProps> = ({ students, subject, onSave, onCancel }) => {
  const [studentId, setStudentId] = useState<number | ''>(students[0]?.id || '');
  const [assignment, setAssignment] = useState('');
  const [score, setScore] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (studentId && assignment && score) {
      onSave({
        studentId: studentId,
        classId: 0, // Will be set in the parent component
        subject: subject,
        assignment,
        score: parseFloat(score),
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="student" className="block text-sm font-medium text-gray-700">Élève</label>
        <select
          id="student"
          value={studentId}
          onChange={(e) => setStudentId(Number(e.target.value))}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        >
          {students.map(s => <option key={s.id} value={s.id!}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="assignment" className="block text-sm font-medium text-gray-700">Nom du devoir</label>
        <input
          type="text"
          name="assignment"
          id="assignment"
          value={assignment}
          onChange={(e) => setAssignment(e.target.value)}
          required
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="Ex: Interrogation 1"
        />
      </div>
       <div>
        <label htmlFor="score" className="block text-sm font-medium text-gray-700">Note (/20)</label>
        <input
          type="number"
          name="score"
          id="score"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          required
          min="0"
          max="20"
          step="0.5"
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          placeholder="15.5"
        />
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Annuler</button>
        <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-md hover:bg-[#2c5a6e]">Sauvegarder la Note</button>
      </div>
    </form>
  );
};

export default GradeForm;