

import React, { useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import SalaryForm from './SalaryForm';
import PersonnelForm from './PersonnelForm';
import Payslip from './Payslip';
import IdCard from './IdCard';
import { PencilIcon, PlusCircleIcon, TrashIcon, BadgeIcon } from './Icons';
import { Personnel, RafSettings, SchoolSettings, SalaryPaymentData, Transaction } from '../App';
import { SalaryAnalytics } from './SalaryAnalytics';

interface PersonnelPageProps {
  personnel: Personnel[];
  transactions: Transaction[];
  onPaySalary: (personnelId: number, paymentData: SalaryPaymentData) => void;
  onSavePersonnel: (personnel: Personnel) => void;
  onDeletePersonnel: (personnelId: number) => void;
  currentUserRole: string;
  rafSettings: RafSettings;
  schoolSettings: SchoolSettings;
  isCaisseOpen: boolean;
  communicationSettings?: any;
  onSaveCommunicationSettings?: (settings: any) => void;
}

const PersonnelPage: React.FC<PersonnelPageProps> = ({ personnel, transactions, onPaySalary, onSavePersonnel, onDeletePersonnel, currentUserRole, rafSettings, schoolSettings, isCaisseOpen }) => {
  const [activeTab, setActiveTab] = useState<'list' | 'analytics'>('list');
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isAddOrEditModalOpen, setIsAddOrEditModalOpen] = useState(false);
  const [isPayslipModalOpen, setIsPayslipModalOpen] = useState(false);
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [payslipData, setPayslipData] = useState<{ personnel: Personnel, netAmount: number, paymentDetails: any } | null>(null);
  const [personForBadge, setPersonForBadge] = useState<Personnel | null>(null);
  const [personnelToDelete, setPersonnelToDelete] = useState<Personnel | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handlePayClick = (person: Personnel) => {
    setSelectedPersonnel(person);
    setIsPayModalOpen(true);
  };
  
  const handleAddClick = () => {
    setSelectedPersonnel(null);
    setIsAddOrEditModalOpen(true);
  };

  const handleEditClick = (person: Personnel) => {
    setSelectedPersonnel(person);
    setIsAddOrEditModalOpen(true);
  };

  const handleDeletePersonnelClick = (person: Personnel) => {
    setPersonnelToDelete(person);
    setIsDeleteModalOpen(true);
  };

  const confirmDeletePersonnel = () => {
    if (personnelToDelete && personnelToDelete.id) {
      onDeletePersonnel(personnelToDelete.id);
    }
    setIsDeleteModalOpen(false);
    setPersonnelToDelete(null);
  };

  const handleShowBadge = (person: Personnel) => {
    setPersonForBadge(person);
    setIsBadgeModalOpen(true);
  };

  const handleSaveSalary = (personnelId: number, paymentData: SalaryPaymentData) => {
    const employee = personnel.find(p => p.id === personnelId);
    if (employee) {
        onPaySalary(personnelId, paymentData);
        setPayslipData({ 
            personnel: employee, 
            netAmount: paymentData.netAmount, 
            paymentDetails: paymentData.details 
        });
        setIsPayModalOpen(false);
        setIsPayslipModalOpen(true);
    }
  };
  
  const handleSavePersonnel = (personnelToSave: Personnel) => {
    onSavePersonnel(personnelToSave);
    setIsAddOrEditModalOpen(false);
  };
  
  const canManagePersonnel = currentUserRole === 'Admin' || currentUserRole === 'Responsable des finances';
  const canPaySalary = currentUserRole === 'Admin' || currentUserRole === 'Caissière' || currentUserRole === 'Responsable des finances';
  const canGenerateBadges = ['Admin', 'Caissière', 'Responsable des finances', 'Directeur des Etudes'].includes(currentUserRole);
  const isCaisseClosedForCashier = currentUserRole === 'Caissière' && !isCaisseOpen;

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestion & Analyse du Personnel</h2>
          <p className="text-xs text-gray-500 mt-0.5">Registre de paie, gestion de l'effectif et analyse financière de la masse salariale</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {canManagePersonnel && activeTab === 'list' && (
            <button onClick={handleAddClick} className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] transition-colors text-sm">
                <PlusCircleIcon />
                <span>Ajouter</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-gray-200 mb-6 no-print">
        <button
          onClick={() => setActiveTab('list')}
          className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'list' 
              ? 'border-[#1F4A59] text-[#1F4A59]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          📋 Liste du Personnel ({personnel.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-5 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'analytics' 
              ? 'border-[#1F4A59] text-[#1F4A59]' 
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          💼 Planification & Pilotage Salarial
        </button>
      </div>
      
      {activeTab === 'list' ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Salaire de Base</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dernier Paiement</th>
              <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {personnel.map((person) => (
              <tr key={person.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{person.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.role}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.baseSalary.toLocaleString()} {schoolSettings.currency}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{person.lastPaymentDate}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                   {canGenerateBadges && (
                    <button onClick={() => handleShowBadge(person)} className="text-gray-500 hover:text-gray-800 inline-flex items-center" title="Générer le badge">
                      <BadgeIcon />
                    </button>
                   )}
                   {canManagePersonnel && (
                    <>
                      <button onClick={() => handleEditClick(person)} className="text-indigo-600 hover:text-indigo-900 inline-flex items-center" title="Modifier le membre">
                        <PencilIcon />
                      </button>
                      <button onClick={() => handleDeletePersonnelClick(person)} className="text-red-600 hover:text-red-900 inline-flex items-center" title="Supprimer le membre">
                        <TrashIcon />
                      </button>
                    </>
                  )}
                  {canPaySalary && (
                    <button 
                      onClick={() => handlePayClick(person)} 
                      disabled={isCaisseClosedForCashier}
                      title={isCaisseClosedForCashier ? "La caisse est actuellement fermée" : `Payer ${person.name}`}
                      className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 text-xs font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Payer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      ) : (
        <div className="pt-2">
          <SalaryAnalytics 
            personnelList={personnel}
            transactions={transactions}
            schoolSettings={schoolSettings}
            rafSettings={rafSettings}
            currentUserRole={currentUserRole}
          />
        </div>
      )}

      <Modal isOpen={isPayModalOpen} onClose={() => setIsPayModalOpen(false)} title={`Payer le salaire de ${selectedPersonnel?.name}`}>
        {selectedPersonnel && (
          <SalaryForm
            personnel={selectedPersonnel}
            onSave={handleSaveSalary}
            onCancel={() => setIsPayModalOpen(false)}
            rafSettings={rafSettings}
            currency={schoolSettings.currency}
          />
        )}
      </Modal>

      <Modal isOpen={isAddOrEditModalOpen} onClose={() => setIsAddOrEditModalOpen(false)} title={selectedPersonnel ? `Modifier ${selectedPersonnel.name}` : 'Ajouter un Membre du Personnel'}>
        <PersonnelForm
            personnel={selectedPersonnel}
            onSave={handleSavePersonnel}
            onCancel={() => setIsAddOrEditModalOpen(false)}
        />
      </Modal>

      <Modal isOpen={isPayslipModalOpen} onClose={() => setIsPayslipModalOpen(false)} title="Aperçu du Bulletin de Paie" size="4xl">
        {payslipData && (
          <Payslip 
            personnel={payslipData.personnel}
            netAmount={payslipData.netAmount}
            paymentDetails={payslipData.paymentDetails}
            onClose={() => setIsPayslipModalOpen(false)}
            rafSettings={rafSettings}
            schoolSettings={schoolSettings}
          />
        )}
      </Modal>

      <Modal isOpen={isBadgeModalOpen} onClose={() => setIsBadgeModalOpen(false)} title="Génération de Badge" size="4xl">
        {personForBadge && (
          <IdCard
            person={personForBadge}
            schoolSettings={schoolSettings}
            onClose={() => setIsBadgeModalOpen(false)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setPersonnelToDelete(null);
        }}
        onConfirm={confirmDeletePersonnel}
        title="Confirmation de suppression - Personnel"
        itemType="le membre du personnel"
        itemName={personnelToDelete ? `${personnelToDelete.name}` : undefined}
        itemDetails={personnelToDelete ? `Poste / Rôle : ${personnelToDelete.role} ${personnelToDelete.matricule ? `• Matricule : ${personnelToDelete.matricule}` : ''} • Salaire de base : ${personnelToDelete.baseSalary.toLocaleString('fr-FR')} FCFA` : undefined}
        warningNote="Attention : La suppression de ce collaborateur retirera ses accès, sa fiche de paie et son historique de contrat. Cette action est irréversible."
        confirmText="Supprimer le membre"
        cancelText="Annuler"
      />
    </div>
  );
};

export default PersonnelPage;