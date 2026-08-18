import React, { useState } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import FeeForm, { Fee } from './FeeForm';
import { PencilIcon, TrashIcon, PlusCircleIcon, GraduationCapIcon } from './Icons';
import { Class } from './ClassForm';
import { ShieldAlert, CheckCircle2, Lock } from 'lucide-react';

interface PricingPageProps {
  fees: Fee[];
  classes: Class[];
  onSaveFee: (fee: Fee) => void;
  onDeleteFee: (feeId: number) => void;
  schoolSettings: any;
  currentUserRole?: string;
}

const PricingPage: React.FC<PricingPageProps> = ({ 
  fees, classes, onSaveFee, onDeleteFee, schoolSettings, currentUserRole 
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<Fee | null>(null);
  const [feeToDelete, setFeeToDelete] = useState<Fee | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Requirement 4: Seul le RAF et le DG (Promoteur) / Admin peuvent configurer les classes d'examen & leurs montants
  const isRAFOrDG = currentUserRole === 'Responsable des finances' || currentUserRole === 'Promoteur' || currentUserRole === 'Admin';

  // Temporary local state for editing exam fees grid
  const [examFeesState, setExamFeesState] = useState<Record<string, { enabled: boolean; amount: number }>>(() => {
    const initialState: Record<string, { enabled: boolean; amount: number }> = {};
    
    // Default presets for exam classes
    classes.forEach(c => {
      const existingExamFee = fees.find(f => f.class === c.name && f.type === 'Frais de dossier d\'examen');
      if (existingExamFee) {
        initialState[c.name] = { enabled: true, amount: existingExamFee.amount };
      } else if (c.name.includes('3ème') || c.name.includes('CM2') || c.name.includes('TA4') || c.name.includes('TD')) {
        const defaultAmount = c.name.includes('3ème') ? 15000 : c.name.includes('CM2') ? 10000 : 20000;
        initialState[c.name] = { enabled: true, amount: defaultAmount };
      } else {
        initialState[c.name] = { enabled: false, amount: 15000 };
      }
    });
    return initialState;
  });

  const [examSaveSuccessMsg, setExamSaveSuccessMsg] = useState<string | null>(null);

  const handleToggleExamClass = (className: string) => {
    if (!isRAFOrDG) return;
    setExamFeesState(prev => ({
      ...prev,
      [className]: {
        ...prev[className],
        enabled: !prev[className]?.enabled
      }
    }));
  };

  const handleExamAmountChange = (className: string, amount: number) => {
    if (!isRAFOrDG) return;
    setExamFeesState(prev => ({
      ...prev,
      [className]: {
        ...prev[className],
        amount: Math.max(0, amount)
      }
    }));
  };

  const handleSaveExamFeesConfig = () => {
    if (!isRAFOrDG) {
      alert("Seul le RAF et le DG ont l'autorisation de modifier les montants des classes d'examen.");
      return;
    }

    (Object.entries(examFeesState) as [string, { enabled: boolean; amount: number }][]).forEach(([className, config]) => {
      const existingFee = fees.find(f => f.class === className && f.type === 'Frais de dossier d\'examen');
      if (config.enabled) {
        onSaveFee({
          id: existingFee ? existingFee.id : null,
          class: className,
          type: 'Frais de dossier d\'examen',
          amount: config.amount,
          period: 'Examen',
        });
      } else if (existingFee && existingFee.id) {
        onDeleteFee(existingFee.id);
      }
    });

    setExamSaveSuccessMsg("Configuration des frais de dossier d'examen mise à jour avec succès par la Direction !");
    setTimeout(() => setExamSaveSuccessMsg(null), 4000);
  };

  const handleAddFee = () => {
    setEditingFee(null);
    setIsModalOpen(true);
  };

  const handleEditFee = (fee: Fee) => {
    setEditingFee(fee);
    setIsModalOpen(true);
  };

  const handleDeleteFeeClick = (fee: Fee) => {
    setFeeToDelete(fee);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteFee = () => {
    if (feeToDelete && feeToDelete.id) {
      onDeleteFee(feeToDelete.id);
    }
    setIsDeleteModalOpen(false);
    setFeeToDelete(null);
  };

  const handleSaveFee = (feeToSave: Fee) => {
    onSaveFee(feeToSave);
    setIsModalOpen(false);
  };

  // --- Grouping Logic ---
  const classNames = new Set(classes.map(c => c.name));
  const classToLevelMap = new Map(classes.map(c => [c.name, c.level]));

  const serviceFees = fees.filter(fee => !classNames.has(fee.class));
  const classFees = fees.filter(fee => classNames.has(fee.class));

  const feesByCycle: Record<string, Fee[]> = {};
  for (const fee of classFees) {
    const level = classToLevelMap.get(fee.class) as string;
    if (level) {
      if (!feesByCycle[level]) {
        feesByCycle[level] = [];
      }
      feesByCycle[level].push(fee);
    }
  }

  const cycleOrder = ['Maternelle', 'Primaire', 'Collège', 'Lycée'];
  const orderedCycles = cycleOrder.filter(cycle => feesByCycle[cycle] && feesByCycle[cycle].length > 0);

  const renderTable = (feesList: Fee[]) => (
    <div className="overflow-x-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classe / Service</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type de Frais</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Période</th>
                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {feesList.map((fee) => (
                    <tr key={fee.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{fee.class}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${fee.type === 'Frais de dossier d\'examen' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700'}`}>
                              {fee.type}
                            </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{fee.amount.toLocaleString()} {schoolSettings.currency}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{fee.period}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                            <button onClick={() => handleEditFee(fee)} className="text-indigo-600 hover:text-indigo-900" title="Modifier le tarif"><PencilIcon /></button>
                            <button onClick={() => handleDeleteFeeClick(fee)} className="text-red-600 hover:text-red-900" title="Supprimer le tarif"><TrashIcon /></button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Requirement 4: Section dédiée à la Configuration des Classes d'Examen & Frais de Dossier */}
      <div className="bg-white p-6 rounded-2xl shadow-lg border border-indigo-100 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
              <GraduationCapIcon className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">Configuration des Classes d'Examen & Frais de Dossier</h2>
                <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full">
                   Réservé RAF / DG
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Sélectionnez les classes soumises aux examens officiels et précisez les montants exigés pour le dossier d'examen.
              </p>
            </div>
          </div>

          {isRAFOrDG ? (
            <button
              onClick={handleSaveExamFeesConfig}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Enregistrer la Tarification Examens</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-medium">
              <Lock className="w-4 h-4" />
              <span>Lecture seule (Caissière)</span>
            </div>
          )}
        </div>

        {/* Warning Badge if not RAF or DG */}
        {!isRAFOrDG && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-xs text-amber-800">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <p>
              <strong>Accès Restreint :</strong> Seuls le <strong>Responsable des Affaires Financières (RAF)</strong> et le <strong>Directeur Général (DG)</strong> ont la possibilité de sélectionner les classes d'examen et de définir leurs montants.
            </p>
          </div>
        )}

        {examSaveSuccessMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{examSaveSuccessMsg}</span>
          </div>
        )}

        {/* Grid of Classes to toggle Exam status & Amount */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {classes.map(c => {
            const config = examFeesState[c.name] || { enabled: false, amount: 15000 };
            return (
              <div 
                key={c.id} 
                className={`p-4 rounded-xl border transition-all ${
                  config.enabled 
                    ? 'bg-indigo-50/50 border-indigo-200 shadow-xs' 
                    : 'bg-gray-50 border-gray-200 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={config.enabled} 
                      onChange={() => handleToggleExamClass(c.name)}
                      disabled={!isRAFOrDG}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 disabled:opacity-50"
                    />
                    <span className="font-bold text-sm text-gray-900">{c.name}</span>
                  </label>
                  <span className="text-[11px] font-medium text-gray-500 bg-white px-2 py-0.5 rounded border">
                    {c.level}
                  </span>
                </div>

                {config.enabled && (
                  <div className="space-y-1 pt-1">
                    <label className="block text-xs font-semibold text-indigo-900">
                      Montant Dossier d'Examen ({schoolSettings.currency})
                    </label>
                    <input 
                      type="number" 
                      value={config.amount} 
                      onChange={(e) => handleExamAmountChange(c.name, parseFloat(e.target.value) || 0)} 
                      disabled={!isRAFOrDG}
                      min="0"
                      className="block w-full rounded-lg border-indigo-300 bg-white text-sm font-bold text-indigo-900 focus:ring-indigo-500 py-1.5 px-3 disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Pricing Management Table */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-bold text-gray-800">Grille Tarifaire Complète</h2>
          <button
            onClick={handleAddFee}
            className="flex items-center gap-2 px-4 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] transition-colors w-full sm:w-auto"
          >
            <PlusCircleIcon />
            <span>Ajouter un Frais</span>
          </button>
        </div>

        <div className="space-y-8">
          {orderedCycles.map(cycle => (
            <div key={cycle}>
              <h3 className="text-xl font-semibold text-gray-700 mb-4">{`Cycle ${cycle}`}</h3>
              {renderTable(feesByCycle[cycle])}
            </div>
          ))}

          {serviceFees.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold text-gray-700 mb-4">Services Généraux</h3>
              {renderTable(serviceFees)}
            </div>
          )}
        </div>

        <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingFee ? 'Modifier le Tarif' : 'Ajouter un Tarif'}>
          <FeeForm
            fee={editingFee}
            classes={classes}
            onSave={handleSaveFee}
            onCancel={() => setIsModalOpen(false)}
          />
        </Modal>

        <ConfirmDialog
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={confirmDeleteFee}
          title="Supprimer le tarif"
          itemType="le tarif"
          itemName={feeToDelete ? `${feeToDelete.type} (${feeToDelete.class}) - ${feeToDelete.amount.toLocaleString()} ${schoolSettings.currency}` : undefined}
          warningNote="Attention : La suppression de ce tarif affectera le calcul des échéances futures pour les élèves rattachés à cette tarification."
        />
      </div>
    </div>
  );
};

export default PricingPage;
