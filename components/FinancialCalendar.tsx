import { useGoogleLogin } from "@react-oauth/google";
import React, { useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Filter, Plus, RefreshCw } from 'lucide-react';
import { FinancialEvent } from '../App';
import Modal from './Modal';
import FinancialEventForm from './FinancialEventForm';

interface FinancialCalendarProps {
  events: FinancialEvent[];
  onSave: (event: FinancialEvent) => void | Promise<unknown>;
  onDelete: (event: FinancialEvent) => void | Promise<unknown>;
  currentUserRole: string;
}

const typeMeta: Record<string, { label: string; chip: string; dot: string }> = {
  payment: { label: 'Paiement', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  deadline: { label: 'Échéance', chip: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  meeting: { label: 'Réunion', chip: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500' },
  exam: { label: 'Examen', chip: 'bg-indigo-100 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500' },
  other: { label: 'Autre', chip: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
};

const formatIcsDate = (value: string) => value.replaceAll('-', '');

const googleRecurrence = (event: FinancialEvent) => {
  const frequency: Record<string, string> = {
    daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY', quarterly: 'MONTHLY;INTERVAL=3', yearly: 'YEARLY',
  };
  const rule = frequency[(event as any).recurrence || ''];
  if (!rule) return undefined;
  const until = (event as any).recurrenceEnd ? `;UNTIL=${formatIcsDate((event as any).recurrenceEnd)}T235959Z` : '';
  return [`RRULE:FREQ=${rule}${until}`];
};

const FinancialCalendar: React.FC<FinancialCalendarProps> = ({ events, onSave, onDelete, currentUserRole }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<FinancialEvent | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [googleStatus, setGoogleStatus] = useState('');
  const pendingGoogleDeletion = useRef<FinancialEvent | null>(null);

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const startDayOfWeek = startOfMonth.getDay() === 0 ? 6 : startOfMonth.getDay() - 1;
  const daysInMonth = endOfMonth.getDate();
  const canManageEvents = ['Responsable des finances', 'Directeur Général', 'Admin', 'Caissière'].includes(currentUserRole);

  const filteredEvents = useMemo(() => {
    return (events || []).filter((event: any) => {
      const matchesType = typeFilter === 'all' || event.type === typeFilter;
      const matchesPriority = priorityFilter === 'all' || (event.priority || 'normal') === priorityFilter;
      return matchesType && matchesPriority;
    });
  }, [events, typeFilter, priorityFilter]);

  const monthEvents = useMemo(() => filteredEvents
    .filter(event => {
      const date = new Date(event.start);
      return date.getFullYear() === currentDate.getFullYear() && date.getMonth() === currentDate.getMonth();
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()), [filteredEvents, currentDate]);

  const upcomingEvents = useMemo(() => filteredEvents
    .filter(event => new Date(event.start) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 8), [filteredEvents]);

  const eventsByDay: Record<number, FinancialEvent[]> = {};
  monthEvents.forEach(event => {
    const day = new Date(event.start).getDate();
    eventsByDay[day] = [...(eventsByDay[day] || []), event];
  });

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

  const syncableEvents = filteredEvents.filter((event: any) => event.googleSync === true);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      const deleting = pendingGoogleDeletion.current;
      if (deleting) {
        try {
          const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(deleting.googleCalendarEventId || '')}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
          });
          // Google returns 410 when an event was already removed: this is also
          // a successful, idempotent end state.
          if (!response.ok && response.status !== 410) throw new Error(`Google Calendar a répondu ${response.status}`);
          await onDelete(deleting);
          setGoogleStatus('Échéance supprimée dans EDUCO et Google Calendar.');
        } catch (error) {
          console.error('Google Calendar deletion error:', error);
          setGoogleStatus("La suppression Google a échoué : l'échéance est conservée dans EDUCO.");
        } finally {
          pendingGoogleDeletion.current = null;
        }
        return;
      }
      let createdCount = 0;
      let updatedCount = 0;
      let failedCount = 0;
      for (const event of syncableEvents) {
        const gEvent = {
          summary: event.title,
          description: (event as any).notes || '',
          start: { date: event.start },
          end: { date: event.end || event.start },
          ...(googleRecurrence(event) && { recurrence: googleRecurrence(event) }),
          reminders: (event as any).reminderEnabled ? {
            useDefault: false,
            overrides: [{ method: 'popup', minutes: Number((event as any).reminderDaysBefore || 0) * 24 * 60 }]
          } : { useDefault: true },
        };
        try {
          const existingGoogleId = (event as any).googleCalendarEventId;
          const endpoint = existingGoogleId
            ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingGoogleId)}`
            : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
          const response = await fetch(endpoint, {
             method: existingGoogleId ? 'PUT' : 'POST',
             headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
             body: JSON.stringify(gEvent)
          });
          if (!response.ok) throw new Error(`Google Calendar a répondu ${response.status}`);
          const savedGoogleEvent = await response.json();
          await onSave({ ...event, googleCalendarEventId: savedGoogleEvent.id, googleSyncedAt: new Date().toISOString() });
          if (existingGoogleId) updatedCount++; else createdCount++;
        } catch (e) {
          console.error('Google Calendar sync error:', e);
          failedCount++;
        }
      }
      const details = [`${createdCount} créé(s)`, `${updatedCount} mis à jour`];
      if (failedCount) details.push(`${failedCount} échec(s)`);
      setGoogleStatus(`Synchronisation Google Calendar : ${details.join(' · ')}.`);
    },
    scope: 'https://www.googleapis.com/auth/calendar.events',
  });

  const handleDeleteEvent = async (event: FinancialEvent) => {
    if (!event.googleCalendarEventId) {
      await onDelete(event);
      return;
    }
    pendingGoogleDeletion.current = event;
    login();
  };

  const exportIcs = () => {
    const body = syncableEvents.map((event: any) => [
      'BEGIN:VEVENT',
      `UID:${event.id || event.title}-${event.start}@educo`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.notes || ''}`,
      `DTSTART;VALUE=DATE:${formatIcsDate(event.start)}`,
      `DTEND;VALUE=DATE:${formatIcsDate(event.end || event.start)}`,
      'END:VEVENT'
    ].join('\n')).join('\n');
    const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//EDUCO//Calendrier des echeances//FR\n${body}\nEND:VCALENDAR`;
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'educo-calendrier-echeances.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-gradient-to-br from-[#153842] via-[#1F4A59] to-slate-900 text-white p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center ring-1 ring-white/15">
              <CalendarDays className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-emerald-200 font-black">Pilotage des échéances</p>
              <h2 className="text-2xl font-black">Calendrier des Échéances</h2>
              <p className="text-xs text-slate-200 mt-1">Rappels, alarmes, répétitions et synchronisation Google.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-4 py-2 rounded-xl bg-white/10 font-black text-sm min-w-48 text-center">
              {currentDate.toLocaleString('fr-FR', { month: 'long', year: 'numeric' })}
            </div>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 rounded-xl bg-white/10 hover:bg-white/20">
              <ChevronRight className="w-4 h-4" />
            </button>
            {canManageEvents && (
              <button onClick={handleAddEvent} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-400 text-slate-950 font-black text-xs hover:bg-emerald-300">
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <Filter className="w-4 h-4" />
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="rounded-xl border-slate-300 text-xs">
                <option value="all">Tous les types</option>
                <option value="deadline">Échéances</option>
                <option value="payment">Paiements</option>
                <option value="meeting">Réunions</option>
                <option value="exam">Examens</option>
                <option value="other">Autres</option>
              </select>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="rounded-xl border-slate-300 text-xs">
                <option value="all">Toutes priorités</option>
                <option value="urgent">Urgente</option>
                <option value="high">Haute</option>
                <option value="normal">Normale</option>
                <option value="low">Basse</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={() => login()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[#1F4A59] text-[#1F4A59] text-xs font-black hover:bg-[#1F4A59]/5">
                <RefreshCw className="w-4 h-4" /> Synchroniser avec Google
              </button>
              <button onClick={exportIcs} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-black hover:bg-slate-200">
                <Download className="w-4 h-4" /> Export .ics
              </button>
            </div>
          </div>
          {googleStatus && <div className="mb-4 p-3 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">{googleStatus}</div>}

          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-black text-slate-500 uppercase mb-2">
            <div>Lun</div><div>Mar</div><div>Mer</div><div>Jeu</div><div>Ven</div><div>Sam</div><div>Dim</div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`empty-${i}`} className="min-h-28 rounded-2xl bg-slate-50 border border-slate-100" />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
              const dayEvents = eventsByDay[day] || [];
              return (
                <div key={day} className={`min-h-28 rounded-2xl border p-2 flex flex-col ${isToday ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-100' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`w-7 h-7 flex items-center justify-center rounded-xl text-xs font-black ${isToday ? 'bg-sky-600 text-white' : 'text-slate-700 bg-slate-100'}`}>{day}</span>
                    {dayEvents.length > 0 && <span className="text-[10px] font-black text-slate-400">{dayEvents.length}</span>}
                  </div>
                  <div className="space-y-1 mt-2 overflow-y-auto">
                    {dayEvents.map((event: any) => {
                      const meta = typeMeta[event.type || 'other'] || typeMeta.other;
                      return (
                        <button key={event.id || event.title} onClick={() => canManageEvents && handleEditEvent(event)} className={`w-full text-left px-2 py-1 rounded-lg border text-[10px] font-bold truncate ${meta.chip} ${canManageEvents ? 'cursor-pointer hover:brightness-95' : ''}`}>
                          {event.priority === 'urgent' ? '!' : ''} {event.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <p className="text-xs font-black uppercase text-slate-400">À venir</p>
            <h3 className="text-lg font-black text-slate-900">Prochaines échéances</h3>
          </div>
          <div className="space-y-2">
            {upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Aucune échéance à venir.</p>
            ) : upcomingEvents.map((event: any) => {
              const meta = typeMeta[event.type || 'other'] || typeMeta.other;
              return (
                <button key={event.id || event.title} onClick={() => canManageEvents && handleEditEvent(event)} className="w-full text-left p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-black text-sm text-slate-900">{event.title}</p>
                      <p className="text-[11px] text-slate-500">{new Date(event.start).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-black ${meta.chip}`}>{meta.label}</span>
                  </div>
                  {(event.recurrence && event.recurrence !== 'none') && <p className="mt-1 text-[10px] text-slate-400">Répétition : {event.recurrence}</p>}
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={selectedEvent ? "Modifier l'échéance" : "Ajouter une échéance"} size="lg">
        <FinancialEventForm event={selectedEvent} onSave={handleSaveEvent} onDelete={handleDeleteEvent} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  );
};

export default FinancialCalendar;
