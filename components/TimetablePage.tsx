import { useGoogleLogin } from "@react-oauth/google";
import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { Class } from './ClassForm';
import { Subject } from './SubjectForm';
import { User } from './UserForm';
import { PlusCircleIcon, PencilIcon, TrashIcon } from './Icons';

export interface TimetableEntry {
  id: string;
  classId: number;
  day: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi';
  startTime: string;
  endTime: string;
  subjectId: number;
  teacherId: number;
  className?: string;
}

const DAYS: Array<'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi'> = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

interface TimetablePageProps {
  currentUserRole: string;
  timetable: TimetableEntry[];
  classes: Class[];
  subjects: Subject[];
  users: User[];
  onSave: (entry: TimetableEntry) => void;
  onDelete?: (id: string) => void;
}

const TimetablePage: React.FC<TimetablePageProps> = ({ 
  currentUserRole, 
  timetable, 
  classes, 
  subjects, 
  users, 
  onSave,
  onDelete 
}) => {
  const [selectedClassId, setSelectedClassId] = useState<number | ''>(classes[0]?.id || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      let successCount = 0;
      
      const filteredTimetable = selectedClassId 
         ? timetable.filter(t => t.classId === selectedClassId)
         : timetable;

      for (const entry of filteredTimetable) {
        const cls = classes.find(c => c.id === entry.classId);
        const sub = subjects.find(s => s.id === entry.subjectId);
        
        // Find next occurrence of the day
        const dayMap: Record<string, number> = {
          'Dimanche': 0, 'Lundi': 1, 'Mardi': 2, 'Mercredi': 3, 'Jeudi': 4, 'Vendredi': 5, 'Samedi': 6
        };
        const targetDay = dayMap[entry.day];
        
        const now = new Date();
        const startOfNextWeek = new Date(now);
        const daysUntilNext = (targetDay + 7 - now.getDay()) % 7;
        startOfNextWeek.setDate(now.getDate() + daysUntilNext);
        
        const dateStr = startOfNextWeek.toISOString().split('T')[0];
        
        const gEvent = {
          summary: `Cours: ${sub?.name || 'Matière'} - ${cls?.name || 'Classe'}`,
          start: { dateTime: `${dateStr}T${entry.startTime}:00`, timeZone: 'Africa/Brazzaville' },
          end: { dateTime: `${dateStr}T${entry.endTime}:00`, timeZone: 'Africa/Brazzaville' },
          recurrence: ['RRULE:FREQ=WEEKLY']
        };
        try {
          await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
             method: 'POST',
             headers: {
               'Authorization': `Bearer ${token}`,
               'Content-Type': 'application/json'
             },
             body: JSON.stringify(gEvent)
          });
          successCount++;
        } catch(e) {
          console.error(e);
        }
      }
      alert(`${successCount} cours hebdomadaires synchronisés avec Google Calendar !`);
    },
    scope: 'https://www.googleapis.com/auth/calendar.events',
  });
  const [entryToDelete, setEntryToDelete] = useState<TimetableEntry | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Form states
  const [formDay, setFormDay] = useState<'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi'>('Lundi');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:00');
  const [formSubjectId, setFormSubjectId] = useState<number | ''>(subjects[0]?.id || '');
  const [formTeacherId, setFormTeacherId] = useState<number | ''>(users.filter(u => u.role === 'Enseignant')[0]?.id || '');
  
  const isEditable = currentUserRole === 'Admin' || currentUserRole === 'Enseignant' || currentUserRole === 'Directeur des Etudes';

  const teachers = useMemo(() => users.filter(u => u.role === 'Enseignant' || u.role === 'Admin'), [users]);

  const timetableForClass = useMemo(() => {
    return timetable.filter(entry => entry.classId === selectedClassId);
  }, [timetable, selectedClassId]);

  const getEntryForSlot = (day: string, startTime: string) => {
    return timetableForClass.find(entry => entry.day === day && entry.startTime === startTime);
  };
  
  const getSubjectName = (id: number) => subjects.find(s => s.id === id)?.name || 'Matière';
  const getTeacherName = (id: number) => users.find(u => u.id === id)?.name || 'Enseignant';

  const handleOpenAddModal = (defaultDay?: 'Lundi' | 'Mardi' | 'Mercredi' | 'Jeudi' | 'Vendredi' | 'Samedi', defaultStartTime?: string) => {
    setEditingEntry(null);
    setFormDay(defaultDay || 'Lundi');
    setFormStartTime(defaultStartTime || '08:00');
    const slotIdx = TIME_SLOTS.indexOf(defaultStartTime || '08:00');
    setFormEndTime(slotIdx >= 0 && slotIdx + 1 < TIME_SLOTS.length ? TIME_SLOTS[slotIdx + 1] : '09:00');
    setFormSubjectId(subjects[0]?.id || '');
    setFormTeacherId(teachers[0]?.id || '');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setFormDay(entry.day);
    setFormStartTime(entry.startTime);
    setFormEndTime(entry.endTime);
    setFormSubjectId(entry.subjectId);
    setFormTeacherId(entry.teacherId);
    setIsModalOpen(true);
  };

  const handleDeleteEntryClick = (entry: TimetableEntry, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEntryToDelete(entry);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteEntry = () => {
    if (entryToDelete && onDelete) {
      onDelete(entryToDelete.id);
    }
    setIsDeleteModalOpen(false);
    setEntryToDelete(null);
    setIsModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !formSubjectId || !formTeacherId) {
      alert('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    const entryToSave: TimetableEntry = {
      id: editingEntry?.id || `tt_${Date.now()}`,
      classId: Number(selectedClassId),
      day: formDay,
      startTime: formStartTime,
      endTime: formEndTime,
      subjectId: Number(formSubjectId),
      teacherId: Number(formTeacherId),
    };

    onSave(entryToSave);
    setIsModalOpen(false);
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Emploi du Temps</h2>
          <p className="text-sm text-gray-500">Consultez et organisez le planning hebdomadaire des cours.</p>
        </div>
        {isEditable && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => login()} 
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#1F4A59] border border-[#1F4A59] rounded-lg hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z"/>
              </svg>
              <span>Synchroniser avec Google</span>
            </button>
            <button 
              onClick={() => handleOpenAddModal()} 
              className="flex items-center gap-2 px-4 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] transition-colors shadow-sm text-sm font-medium"
            >
              <PlusCircleIcon className="w-5 h-5" />
              <span>Ajouter un cours</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
        <div>
          <label htmlFor="class-select" className="block text-sm font-medium text-gray-700">Classe sélectionnée</label>
          <select
            id="class-select"
            value={selectedClassId}
            onChange={e => setSelectedClassId(Number(e.target.value))}
            className="mt-1 block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
          >
            {classes.map(c => <option key={c.id} value={c.id!}>{c.name} ({c.level})</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-sm font-semibold text-gray-700 w-24">Heure</th>
              {DAYS.map(day => <th key={day} className="border border-gray-300 p-2 text-sm font-semibold text-gray-700">{day}</th>)}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.slice(0, -1).map((startTime, index) => {
              const endTime = TIME_SLOTS[index + 1];
              return (
                <tr key={startTime}>
                  <td className="border border-gray-300 p-2 text-center text-xs font-semibold bg-gray-50 text-gray-700 whitespace-nowrap">
                    {startTime} - {endTime}
                  </td>
                  {DAYS.map(day => {
                    const entry = getEntryForSlot(day, startTime);
                    return (
                      <td 
                        key={day} 
                        className={`border border-gray-300 p-1 align-top h-24 transition-colors ${
                          !entry && isEditable ? 'hover:bg-blue-50/50 cursor-pointer' : ''
                        }`}
                        onClick={() => {
                          if (!entry && isEditable) {
                            handleOpenAddModal(day, startTime);
                          }
                        }}
                      >
                        {entry ? (
                          <div 
                            onClick={(e) => {
                              if (isEditable) {
                                e.stopPropagation();
                                handleOpenEditModal(entry);
                              }
                            }}
                            className={`bg-indigo-50 border border-indigo-200 p-2 rounded-md h-full flex flex-col justify-between group relative ${
                              isEditable ? 'cursor-pointer hover:bg-indigo-100' : ''
                            }`}
                          >
                            <div>
                              <p className="font-bold text-indigo-900 text-xs sm:text-sm">{getSubjectName(entry.subjectId)}</p>
                              <p className="text-[11px] text-indigo-700 mt-0.5">{getTeacherName(entry.teacherId)}</p>
                            </div>
                            <div className="flex justify-between items-center mt-1 text-[10px] text-indigo-500">
                              <span>{entry.startTime} - {entry.endTime}</span>
                              {isEditable && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleOpenEditModal(entry); }}
                                    className="p-0.5 text-indigo-600 hover:text-indigo-900" 
                                    title="Modifier"
                                  >
                                    <PencilIcon className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={(e) => handleDeleteEntryClick(entry, e)}
                                    className="p-0.5 text-red-500 hover:text-red-700" 
                                    title="Supprimer le cours"
                                  >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          isEditable && (
                            <div className="h-full flex items-center justify-center text-gray-300 hover:text-indigo-500 text-xs transition-colors">
                              <span>+</span>
                            </div>
                          )
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Ajout / Modification de cours */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingEntry ? "Modifier le cours" : "Ajouter un cours à l'emploi du temps"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Jour</label>
              <select
                value={formDay}
                onChange={e => setFormDay(e.target.value as any)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm"
              >
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Matière</label>
              <select
                value={formSubjectId}
                onChange={e => setFormSubjectId(Number(e.target.value))}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm"
              >
                <option value="" disabled>Sélectionner une matière</option>
                {subjects.map(s => <option key={s.id} value={s.id!}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Heure de début</label>
              <select
                value={formStartTime}
                onChange={e => {
                  setFormStartTime(e.target.value);
                  const idx = TIME_SLOTS.indexOf(e.target.value);
                  if (idx >= 0 && idx + 1 < TIME_SLOTS.length) {
                    setFormEndTime(TIME_SLOTS[idx + 1]);
                  }
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm"
              >
                {TIME_SLOTS.slice(0, -1).map(slot => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Heure de fin</label>
              <select
                value={formEndTime}
                onChange={e => setFormEndTime(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm"
              >
                {TIME_SLOTS.slice(1).map(slot => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Enseignant responsable</label>
            <select
              value={formTeacherId}
              onChange={e => setFormTeacherId(Number(e.target.value))}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm border p-2 text-sm"
            >
              <option value="" disabled>Sélectionner un enseignant</option>
              {teachers.map(t => <option key={t.id} value={t.id!}>{t.name} ({t.role})</option>)}
            </select>
          </div>

          <div className="flex justify-between items-center pt-4 border-t">
            {editingEntry ? (
              <button
                type="button"
                onClick={() => handleDeleteEntryClick(editingEntry)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
              >
                Supprimer
              </button>
            ) : <div />}
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] text-sm font-medium transition-colors shadow-sm"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDeleteEntry}
        title="Retirer le cours"
        itemType="le cours"
        itemName={entryToDelete ? `${getSubjectName(entryToDelete.subjectId)} (${entryToDelete.day} ${entryToDelete.startTime}-${entryToDelete.endTime})` : undefined}
        warningNote="Ce créneau sera immédiatement libéré dans le planning hebdomadaire de la classe."
      />
    </div>
  );
};

export default TimetablePage;
