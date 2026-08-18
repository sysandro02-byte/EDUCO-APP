import React, { useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import AcademicYearForm from './AcademicYearForm';
import ClassForm, { Class } from './ClassForm';
import { PencilIcon, TrashIcon, PlusCircleIcon } from './Icons';

type AcademicYear = {
  startDate: string;
  endDate: string;
}

interface SchoolStructurePageProps {
  academicYear: AcademicYear | null;
  classes: Class[];
  onUpdateAcademicYear: (year: AcademicYear) => void;
  onSaveClass: (cls: Class) => void;
  onDeleteClass: (classId: number) => void;
}

const SchoolStructurePage: React.FC<SchoolStructurePageProps> = ({
  academicYear,
  classes,
  onUpdateAcademicYear,
  onSaveClass,
  onDeleteClass
}) => {
  const [isYearModalOpen, setIsYearModalOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleAddClass = () => {
    setEditingClass(null);
    setIsClassModalOpen(true);
  };

  const handleEditClass = (cls: Class) => {
    setEditingClass(cls);
    setIsClassModalOpen(true);
  };

  const handleDeleteClassClick = (cls: Class) => {
    setClassToDelete(cls);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteClass = () => {
    if (classToDelete && classToDelete.id) {
      onDeleteClass(classToDelete.id);
    }
    setIsDeleteModalOpen(false);
    setClassToDelete(null);
  };

  const handleSaveClass = (classToSave: Class) => {
    onSaveClass(classToSave);
    setIsClassModalOpen(false);
  };

  const handleSaveYear = (yearToSave: AcademicYear) => {
    onUpdateAcademicYear(yearToSave);
    setIsYearModalOpen(false);
  };

  if (!academicYear) {
    return <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">Chargement des données de la structure scolaire...</div>;
  }

  return (
    <div className="space-y-8">
      {/* Academic Year Section */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Année Scolaire</h2>
          <button
            onClick={() => setIsYearModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
          >
            <PencilIcon className="w-4 h-4" />
            <span>Modifier</span>
          </button>
        </div>
        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-sm text-gray-500">Date de début</p>
            <p className="text-lg font-semibold text-gray-800">{new Date(academicYear.startDate).toLocaleDateString('fr-FR')}</p>
          </div>
          <div className="text-gray-400">&rarr;</div>
          <div>
            <p className="text-sm text-gray-500">Date de fin</p>
            <p className="text-lg font-semibold text-gray-800">{new Date(academicYear.endDate).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
      </div>

      {/* Classes Management Section */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Gestion des Classes</h2>
          <button
            onClick={handleAddClass}
            className="flex items-center gap-2 px-4 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] transition-colors"
          >
            <PlusCircleIcon />
            <span>Ajouter une classe</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom de la Classe</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Niveau</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Effectif Max.</th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {classes.map((cls) => (
                <tr key={cls.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cls.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cls.level}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cls.maxStudents}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                    <button onClick={() => handleEditClass(cls)} className="text-indigo-600 hover:text-indigo-900" title="Modifier la classe"><PencilIcon /></button>
                    <button onClick={() => handleDeleteClassClick(cls)} className="text-red-600 hover:text-red-900" title="Supprimer la classe"><TrashIcon /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <Modal isOpen={isYearModalOpen} onClose={() => setIsYearModalOpen(false)} title="Définir l'Année Scolaire">
        <AcademicYearForm
          currentYear={academicYear}
          onSave={handleSaveYear}
          onCancel={() => setIsYearModalOpen(false)}
        />
      </Modal>

      <Modal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} title={editingClass ? 'Modifier la Classe' : 'Ajouter une Classe'}>
        <ClassForm
          classData={editingClass}
          onSave={handleSaveClass}
          onCancel={() => setIsClassModalOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteClass}
        title="Supprimer la classe"
        itemType="la classe"
        itemName={classToDelete?.name}
        warningNote="Attention : La suppression d'une classe peut impacter l'affectation des élèves, les emplois du temps et les grilles tarifaires associées."
      />
    </div>
  );
};

export default SchoolStructurePage;