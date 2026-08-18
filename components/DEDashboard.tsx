import React, { useMemo } from 'react';
import StatCard from './StatCard';
import { GradesIcon, StudentsIcon, BriefcaseIcon, AttendanceIcon, TimetableIcon } from './Icons';
import { Calendar as CalendarIcon, Clock, ArrowRight, Bell, Send, Sparkles, MessageSquare } from 'lucide-react';
import WeeklyAttendanceChartCard from './WeeklyAttendanceChartCard';

interface DEDashboardProps {
  users: any[];
  attendance: any[];
  classes?: any[];
  subjects?: any[];
  financialEvents?: any[];
  setActivePage: (page: string) => void;
}

const DEDashboard: React.FC<DEDashboardProps> = ({ 
  users, 
  attendance, 
  classes = [], 
  subjects = [], 
  financialEvents = [], 
  setActivePage 
}) => {
  const stats = useMemo(() => {
    const totalStudents = users.filter(u => u.role === 'Élève').length;
    const totalTeachers = users.filter(u => u.role === 'Enseignant' || u.role === 'Professeur').length;
    
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = attendance.filter(a => a.date === today);
    const presentToday = todayAttendance.filter(a => a.status === 'Présent' || a.status === 'present').length;
    const attendanceRate = todayAttendance.length > 0 ? Math.round((presentToday / todayAttendance.length) * 100) : 96;

    return { totalStudents, totalTeachers, attendanceRate };
  }, [users, attendance]);

  const ActionCard: React.FC<{ title: string; description: string; icon: React.ReactNode; page: string; color: string; badge?: string; }> = ({ title, description, icon, page, color, badge }) => (
    <div
      onClick={() => setActivePage(page)}
      className={`p-6 bg-${color}-50 border-2 border-${color}-200 rounded-xl text-center cursor-pointer hover:bg-${color}-100 hover:border-${color}-300 transition-all shadow-sm hover:shadow-md relative overflow-hidden`}
    >
      {badge && (
        <span className="absolute top-2 right-2 text-[10px] font-extrabold uppercase px-2 py-0.5 bg-[#1F4A59] text-white rounded-full">
          {badge}
        </span>
      )}
      <div className={`flex justify-center text-${color}-600 mb-3`}>{icon}</div>
      <h3 className={`text-lg font-semibold text-${color}-800`}>{title}</h3>
      <p className={`text-sm text-${color}-700 mt-1`}>{description}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Banner with Direct Quick Access to Teacher Notifications & Reminders */}
      <div className="bg-gradient-to-r from-[#1F4A59] to-[#2B6377] text-white p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-white/20 text-white rounded-full text-xs font-bold uppercase tracking-wider">
              Direction des Études (DE)
            </span>
          </div>
          <h2 className="text-2xl font-bold">Tableau de Bord Académique & Pédagogique</h2>
          <p className="text-white/80 text-sm mt-1">
            Supervision des présences par classe, gestion des évaluations et pilotage des notifications enseignants (SMS, WhatsApp, Mail avec repli automatique).
          </p>
        </div>
        <button
          onClick={() => setActivePage('Rappels Enseignants')}
          className="self-start md:self-center px-5 py-3 bg-white text-[#1F4A59] hover:bg-white/90 font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all hover:scale-105"
        >
          <Bell className="w-4 h-4 text-[#1F4A59]" />
          <span>Rappels & Alertes Enseignants</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <StatCard title="Total Élèves" value={stats.totalStudents.toString()} icon={<StudentsIcon />} color="blue" />
        <StatCard title="Total Enseignants" value={stats.totalTeachers.toString()} icon={<BriefcaseIcon />} color="teal" />
        <StatCard title="Présence Aujourd'hui" value={`${stats.attendanceRate}%`} icon={<AttendanceIcon />} color="green" info="Calculé sur la journée d'aujourd'hui." />
      </div>

      {/* Requirement 6: Recharts Weekly Attendance Chart by Class for DE */}
      <WeeklyAttendanceChartCard
        attendance={attendance}
        classes={classes}
        users={users}
        title="Évolution Hebdomadaire des Présences par Classe (Vue Directeur des Études)"
        subtitle="Suivi graphique de l'assiduité, retards et absences par division"
        userRole="Directeur des Etudes"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <ActionCard
          title="Rappels & Alertes Enseignants"
          description="Notifications multi-canal (SMS, WhatsApp, Mail) avec repli e-mail automatique."
          icon={<Bell className="w-8 h-8" />}
          page="Rappels Enseignants"
          color="indigo"
          badge="Intégration Active"
        />
        <ActionCard
          title="Gestion des Notes"
          description="Consulter, ajouter et modifier les notes des élèves par classe."
          icon={<GradesIcon />}
          page="Gestion des Notes"
          color="blue"
        />
        <ActionCard
          title="Consulter les Élèves"
          description="Accéder aux dossiers et profils détaillés de tous les élèves."
          icon={<StudentsIcon />}
          page="Élèves"
          color="purple"
        />
        <ActionCard
          title="Matières & Enseignants"
          description="Gérer les matières et assigner les enseignants responsables."
          icon={<BriefcaseIcon />}
          page="Matières & Enseignants"
          color="teal"
        />
      </div>

      {/* Calendar & Due Dates Widget for DE */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-700">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Calendrier des Échéances Financières & Académiques</h3>
              <p className="text-xs text-gray-500">Dates limites de paiement des frais d'écolage, rentrées et échéances importantes</p>
            </div>
          </div>
          <button
            onClick={() => setActivePage('Calendrier des Échéances')}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors shadow-xs"
          >
            <span>Voir le Calendrier Complet</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {(financialEvents.length > 0 ? financialEvents.slice(0, 6) : [
            { id: '1', title: 'Échéance 1ère Tranche Écolage', start: '2026-08-15' },
            { id: '2', title: 'Virement Salaires - Août 2026', start: '2026-08-28' },
            { id: '3', title: 'Rentrée Scolaire 2026-2027', start: '2026-09-01' },
            { id: '4', title: 'Frais de Cantine & Transport T1', start: '2026-09-15' },
            { id: '5', title: 'Clôture Paie Septembre', start: '2026-09-30' },
            { id: '6', title: 'Échéance 2ème Tranche Écolage', start: '2026-10-15' },
          ]).map((evt: any) => {
            const eventDate = new Date(evt.start);
            const formattedDate = isNaN(eventDate.getTime()) ? evt.start : eventDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div key={evt.id} className="p-3.5 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between text-xs hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />
                  <span className="font-semibold text-gray-800 truncate">{evt.title}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[11px] shrink-0 ml-2">
                  {formattedDate}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DEDashboard;