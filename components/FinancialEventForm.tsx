import React, { useState, useEffect } from 'react';
import { TrashIcon } from './Icons';
import { FinancialEvent } from '../App';
import ConfirmDialog from './ConfirmDialog';

interface FinancialEventFormProps {
  event: FinancialEvent | null;
  onSave: (event: FinancialEvent) => void;
  onDelete: (eventId: string) => void;
  onCancel: () => void;
}

const FinancialEventForm: React.FC<FinancialEventFormProps> = ({ event, onSave, onDelete, onCancel }) => {
  const [formData, setFormData] = useState<Omit<FinancialEvent, 'id'>>({
    title: '',
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
    type: 'other'
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        start: event.start || new Date().toISOString().split('T')[0],
        end: event.end || new Date().toISOString().split('T')[0],
        type: event.type || 'other'
      });
    } else {
        setFormData({
            title: '',
            start: new Date().toISOString().split('T')[0],
            end: new Date().toISOString().split('T')[0],
            type: 'other'
        });
    }
  }, [event]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, id: event?.id });
  };
  
  const confirmDelete = () => {
    if (event?.id) {
      onDelete(event.id);
      onCancel();
    }
    setIsDeleteModalOpen(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">Titre de l'événement</label>
          <input
            type="text"
            name="title"
            id="title"
            value={formData.title}
            onChange={handleChange}
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
        <div>
          <label htmlFor="start" className="block text-sm font-medium text-gray-700">Date</label>
          <input
            type="date"
            name="start"
            id="start"
            value={formData.start}
            onChange={(e) => setFormData(prev => ({ ...prev, start: e.target.value, end: e.target.value }))} // Keep start and end date same for simplicity
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
        </div>
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">Type d'événement</label>
          <select name="type" id="type" value={formData.type} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
              <option value="other">Autre</option>
              <option value="payment">Paiement de Salaire</option>
              <option value="deadline">Échéance</option>
          </select>
        </div>
        <div className="flex justify-between items-center pt-4 border-t mt-4">
          <div>
              {event && (
                  <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center gap-2">
                      <TrashIcon className="w-4 h-4" />
                      Supprimer
                  </button>
              )}
          </div>
          <div className="flex space-x-2">
              <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Annuler</button>
              <button type="submit" className="px-4 py-2 bg-[#1F4A59] text-white rounded-md hover:bg-[#2c5a6e]">Sauvegarder</button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Supprimer l'événement financier"
        itemType="l'événement"
        itemName={event?.title}
        warningNote="Cet événement sera retiré du calendrier financier et des rappels d'échéances."
      />
    </>
  );
};

export default FinancialEventForm;