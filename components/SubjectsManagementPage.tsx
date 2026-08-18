import React, { useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import SubjectForm, { Subject } from './SubjectForm';
import { PencilIcon, TrashIcon, PlusCircleIcon } from './Icons';
import { User } from './UserForm';

interface SubjectsManagementPageProps {
  subjects: Subject[];
  teachers: User[];
  onSaveSubject: (subject: Subject) => void;
  onDeleteSubject: (subjectId: number) => void;
}

const SubjectsManagementPage: React.FC<SubjectsManagementPageProps> = ({ subjects, teachers, onSaveSubject, onDeleteSubject }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  const [subjectToDelete, setSubjectToDelete] = useState<Subject | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleAdd = () => {
    setEditingSubject(null);
    setIsModalOpen(true);
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setIsModalOpen(true);
  };

  const handleDelete = (subject: Subject) => {
    setSubjectToDelete(subject);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteSubject = () => {
    if (subjectToDelete && subjectToDelete.id) {
      onDeleteSubject(subjectToDelete.id);
    }
    setIsDeleteModalOpen(false);
    setSubjectToDelete(null);
  };

  const handleSave = (subjectToSave: Subject) => {
    onSaveSubject(subjectToSave);
    setIsModalOpen(false);
  };

  const getTeacherNames = (teacherIds: number[] = []) => {
    return teacherIds
      .map(id => teachers.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Gestion des Matières & Enseignants</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] transition-colors"
        >
          <PlusCircleIcon />
          <span>Ajouter une matière</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Matière</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enseignant(s) Assigné(s)</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{subject.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getTeacherNames(subject.teacherIds) || 'Non assigné'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                  <button onClick={() => handleEdit(subject)} className="text-indigo-600 hover:text-indigo-900"><PencilIcon /></button>
                  <button onClick={() => handleDelete(subject)} className="text-red-600 hover:text-red-900"><TrashIcon /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSubject ? 'Modifier la Matière' : 'Ajouter une Matière'}>
        <SubjectForm
          subject={editingSubject}
          teachers={teachers}
          onSave={handleSave}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteSubject}
        title="Supprimer la matière"
        itemType="la matière"
        itemName={subjectToDelete?.name}
        warningNote="Attention : La suppression d'une matière supprimera ses assignations aux enseignants, les notes rattachées et les créneaux dans les emplois du temps."
      />
    </div>
  );
};

export default SubjectsManagementPage;