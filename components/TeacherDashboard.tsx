import React from 'react';
import { GradesIcon, AttendanceIcon } from './Icons';
import WeeklyAttendanceChartCard from './WeeklyAttendanceChartCard';
import { Bell, BookOpen, Users, CheckCircle2 } from 'lucide-react';

interface TeacherDashboardProps {
  setActivePage: (page: string) => void;
  classes?: any[];
  attendance?: any[];
  users?: any[];
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ 
  setActivePage,
  classes = [],
  attendance = [],
  users = []
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#1F4A59] to-[#2B6377] text-white p-6 rounded-2xl shadow-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="px-2.5 py-0.5 bg-white/20 text-white rounded-full text-xs font-bold uppercase tracking-wider">
            Espace Enseignant
          </span>
          <h2 className="text-2xl font-bold mt-1">Tableau de Bord Pédagogique</h2>
          <p className="text-white/80 text-sm mt-1">
            Suivi de vos classes, saisie des évaluations et assiduité hebdomadaire des élèves.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActivePage('Notes')}
            className="px-4 py-2.5 bg-white text-[#1F4A59] hover:bg-white/90 font-bold text-xs rounded-xl shadow-md transition-colors"
          >
            Saisie des Notes
          </button>
          <button
            onClick={() => setActivePage('Mes classes')}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
          >
            Faire l'Appel
          </button>
        </div>
      </div>

      {/* Requirement 6: Recharts Weekly Attendance Chart by Class for Teacher */}
      <WeeklyAttendanceChartCard
        attendance={attendance}
        classes={classes}
        users={users}
        title="Évolution Hebdomadaire des Présences de vos Classes"
        subtitle="Visualisation journalière du taux d'assiduité, présences et retards"
        userRole="Enseignant"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div 
          onClick={() => setActivePage('Notes')}
          className="p-6 bg-blue-50 border-2 border-blue-200 rounded-xl text-center cursor-pointer hover:bg-blue-100 hover:border-blue-300 transition-all shadow-xs"
        >
          <div className="flex justify-center text-blue-600 mb-3">
            <GradesIcon />
          </div>
          <h3 className="text-lg font-semibold text-blue-800">Gestion des Notes & Évaluations</h3>
          <p className="text-sm text-blue-700 mt-1">Ajoutez, modifiez et consultez les notes et appréciations de vos élèves.</p>
        </div>
        
        <div 
          onClick={() => setActivePage('Mes classes')}
          className="p-6 bg-teal-50 border-2 border-teal-200 rounded-xl text-center cursor-pointer hover:bg-teal-100 hover:border-teal-300 transition-all shadow-xs"
        >
          <div className="flex justify-center text-teal-600 mb-3">
            <AttendanceIcon />
          </div>
          <h3 className="text-lg font-semibold text-teal-800">Suivi & Registre des Présences</h3>
          <p className="text-sm text-teal-700 mt-1">Faites l'appel quotidien et signalez les absences ou retards par heure de cours.</p>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;