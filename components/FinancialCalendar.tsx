import { useGoogleLogin } from "@react-oauth/google";
import React, { useState } from 'react';
import { FinancialEvent } from '../App';
import { PlusCircleIcon } from './Icons';
import Modal from './Modal';
import FinancialEventForm from './FinancialEventForm';


interface FinancialCalendarProps {
  events: FinancialEvent[];
  onSave: (event: FinancialEvent) => void;
  onDelete: (eventId: string) => void;
  currentUserRole: string;
}

const FinancialCalendar: React.FC<FinancialCalendarProps> = ({ events, onSave, onDelete, currentUserRole }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<FinancialEvent | null>(null);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDayOfWeek = startOfMonth.getDay() === 0 ? 6 : startOfMonth.getDay() - 1;
  const daysInMonth = endOfMonth.getDate();

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const handleAddEvent = () => {
    setSelectedEvent(null);
    setIsModalOpen(true);
  };
  
  const handleEditEvent = (event: FinancialEvent) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };
  
  const handleSaveEvent = (event: FinancialEvent) => {
    onSave(event);
    setIsModalOpen(false);
  };

  const canManageEvents = currentUserRole === 'Responsable des finances' || currentUserRole === 'Admin';

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      let successCount = 0;
      for (const event of events) {
        const gEvent = {
          summary: event.title,
          start: { date: event.start },
          end: { date: event.end }
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
      alert(`${successCount} événements synchronisés avec Google Calendar !`);
    },
    scope: 'https://www.googleapis.com/auth/calendar.events',
  });

  const eventsByDay: { [key: number]: FinancialEvent[] } = {};
  events.forEach(event => {
    const eventDate = new Date(event.start);
    if (eventDate.getFullYear() === currentDate.getFullYear() && eventDate.getMonth() === currentDate.getMonth()) {
      const day = eventDate.getDate();
      if (!eventsByDay[day]) {
        eventsByDay[day] = [];
      }
      eventsByDay[day].push(event);
    }
  });


  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
        <div className="flex items-center gap-4">
            <button onClick={handlePrevMonth} className="px-3 py-1 bg-gray-200 rounded-md">&lt;</button>
            <h2 className="text-xl font-bold text-gray-800">
              {currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
            </h2>
            <button onClick={handleNextMonth} className="px-3 py-1 bg-gray-200 rounded-md">&gt;</button>
        </div>
        {canManageEvents && (
            <div className="flex items-center gap-2 mt-4 sm:mt-0">
              <button onClick={() => login()} className="flex items-center gap-2 px-4 py-2 bg-white text-[#1F4A59] border border-[#1F4A59] rounded-lg hover:bg-gray-50 transition-colors">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5v-5z"/>
                  </svg>
                  <span>Synchroniser avec Google</span>
              </button>
              <button onClick={handleAddEvent} className="flex items-center gap-2 px-4 py-2 bg-[#1F4A59] text-white rounded-lg hover:bg-[#2c5a6e] transition-colors">
                  <PlusCircleIcon/> <span>Ajouter un événement</span>
              </button>
            </div>
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-gray-600 mb-2">
        <div>Lun</div><div>Mar</div><div>Mer</div><div>Jeu</div><div>Ven</div><div>Sam</div><div>Dim</div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="p-2 border rounded-md bg-gray-50"></div>)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
          const dayEvents = eventsByDay[day] || [];

          return (
            <div key={day} className={`p-2 border rounded-md min-h-[120px] flex flex-col ${isToday ? 'bg-blue-50 border-blue-200' : ''}`}>
              <span className={`font-bold ${isToday ? 'text-blue-700' : 'text-gray-800'}`}>{day}</span>
              <div className="space-y-1 mt-1 overflow-y-auto">
                {dayEvents.map(event => (
                  <div key={event.id} onClick={() => canManageEvents && handleEditEvent(event)} className={`p-1 text-xs rounded-md ${canManageEvents ? 'cursor-pointer' : ''} bg-purple-100 text-purple-800`}>
                    {event.title}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedEvent ? "Modifier l'événement" : "Ajouter un événement"}>
        <FinancialEventForm 
            event={selectedEvent}
            onSave={handleSaveEvent}
            onDelete={onDelete}
            onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default FinancialCalendar;