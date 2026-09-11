import React, { useEffect, useState } from 'react';
import { Bell, CalendarClock, Repeat, Trash2 } from 'lucide-react';
import { FinancialEvent } from '../App';
import ConfirmDialog from './ConfirmDialog';

interface FinancialEventFormProps {
  event: FinancialEvent | null;
  onSave: (event: FinancialEvent) => void;
  onDelete: (event: FinancialEvent) => void | Promise<unknown>;
  onCancel: () => void;
}

const today = () => new Date().toISOString().split('T')[0];

const FinancialEventForm: React.FC<FinancialEventFormProps> = ({ event, onSave, onDelete, onCancel }) => {
  const [formData, setFormData] = useState<any>({
    title: '',
    start: today(),
    end: today(),
    type: 'deadline',
    priority: 'normal',
    recurrence: 'none',
    recurrenceEnd: '',
    reminderEnabled: true,
    reminderDaysBefore: 2,
    notificationChannel: 'app',
    googleSync: false,
    notes: '',
  });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        start: event.start || today(),
        end: event.end || event.start || today(),
        type: event.type || 'deadline',
        priority: (event as any).priority || 'normal',
        recurrence: (event as any).recurrence || 'none',
        recurrenceEnd: (event as any).recurrenceEnd || '',
        reminderEnabled: (event as any).reminderEnabled ?? true,
        reminderDaysBefore: (event as any).reminderDaysBefore ?? 2,
        notificationChannel: (event as any).notificationChannel || 'app',
        googleSync: (event as any).googleSync || false,
        notes: (event as any).notes || '',
      });
      return;
    }
    setFormData({
      title: '',
      start: today(),
      end: today(),
      type: 'deadline',
      priority: 'normal',
      recurrence: 'none',
      recurrenceEnd: '',
      reminderEnabled: true,
      reminderDaysBefore: 2,
      notificationChannel: 'app',
      googleSync: false,
      notes: '',
    });
  }, [event]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData((prev: any) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      id: event?.id,
      allDay: true,
      reminderDaysBefore: Number(formData.reminderDaysBefore || 0),
    } as FinancialEvent);
  };

  const confirmDelete = () => {
    if (event?.id) {
      onDelete(event);
      onCancel();
    }
    setIsDeleteModalOpen(false);
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-2xl bg-[#1F4A59] text-white p-4 flex items-center gap-3">
          <CalendarClock className="w-6 h-6 text-emerald-300" />
          <div>
            <p className="text-sm font-black">Insertion d'une échéance</p>
            <p className="text-xs text-slate-200">Planifiez les rappels financiers, pédagogiques et administratifs.</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-600 uppercase mb-1">Titre</label>
          <input name="title" value={formData.title} onChange={handleChange} required placeholder="Ex: Paiement salaires, frais d'examen, réunion RAF..." className="input-style" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase mb-1">Date début</label>
            <input type="date" name="start" value={formData.start} onChange={(e) => setFormData((prev: any) => ({ ...prev, start: e.target.value, end: prev.end || e.target.value }))} required className="input-style" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase mb-1">Date fin</label>
            <input type="date" name="end" value={formData.end} onChange={handleChange} required className="input-style" />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase mb-1">Type</label>
            <select name="type" value={formData.type} onChange={handleChange} className="input-style">
              <option value="deadline">Échéance</option>
              <option value="payment">Paiement</option>
              <option value="meeting">Réunion</option>
              <option value="exam">Examen</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase mb-1">Priorité</label>
            <select name="priority" value={formData.priority} onChange={handleChange} className="input-style">
              <option value="low">Basse</option>
              <option value="normal">Normale</option>
              <option value="high">Haute</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-black text-slate-800">
            <Repeat className="w-4 h-4 text-[#1F4A59]" />
            <span>Répétition & alarmes</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase mb-1">Répéter</label>
              <select name="recurrence" value={formData.recurrence} onChange={handleChange} className="input-style">
                <option value="none">Ne pas répéter</option>
                <option value="daily">Chaque jour</option>
                <option value="weekly">Chaque semaine</option>
                <option value="monthly">Chaque mois</option>
                <option value="quarterly">Chaque trimestre</option>
                <option value="yearly">Chaque année</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase mb-1">Fin de répétition</label>
              <input type="date" name="recurrenceEnd" value={formData.recurrenceEnd} onChange={handleChange} disabled={formData.recurrence === 'none'} min={formData.start} className="input-style disabled:bg-slate-100" />
            </div>
            <label className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 mt-5">
              <input type="checkbox" name="reminderEnabled" checked={formData.reminderEnabled} onChange={handleChange} className="rounded text-[#1F4A59]" />
              <span className="text-xs font-bold text-slate-700"><Bell className="w-3.5 h-3.5 inline mr-1" />Activer l'alarme</span>
            </label>
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase mb-1">Rappel avant</label>
              <select name="reminderDaysBefore" value={formData.reminderDaysBefore} onChange={handleChange} className="input-style" disabled={!formData.reminderEnabled}>
                <option value={0}>Le jour même</option>
                <option value={1}>1 jour avant</option>
                <option value={2}>2 jours avant</option>
                <option value={7}>1 semaine avant</option>
                <option value={30}>1 mois avant</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase mb-1">Catégorie</label>
              <input name="category" value={formData.category || ''} onChange={handleChange} placeholder="Ex. Finance, administration…" className="input-style" />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase mb-1">Canal notification</label>
              <select name="notificationChannel" value={formData.notificationChannel} onChange={handleChange} className="input-style">
                <option value="app">Notification interne</option>
                <option value="email">E-mail</option>
                <option value="sms">SMS / WhatsApp</option>
                <option value="all">Tous les canaux disponibles</option>
              </select>
            </div>
            <label className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 mt-5">
              <input type="checkbox" name="googleSync" checked={formData.googleSync} onChange={handleChange} className="rounded text-[#1F4A59]" />
              <span className="text-xs font-bold text-slate-700">Inclure dans la synchronisation Google</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-black text-slate-600 uppercase mb-1">Notes</label>
          <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} placeholder="Instructions, personnes concernées, pièces à préparer..." className="input-style" />
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div>
            {event && (
              <button type="button" onClick={() => setIsDeleteModalOpen(true)} className="px-4 py-2 bg-rose-100 text-rose-700 rounded-xl hover:bg-rose-200 flex items-center gap-2 text-xs font-bold">
                <Trash2 className="w-4 h-4" />
                Supprimer
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="btn-secondary">Annuler</button>
            <button type="submit" className="btn-primary">Sauvegarder</button>
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
