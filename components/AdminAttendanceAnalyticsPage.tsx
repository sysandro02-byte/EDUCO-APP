import React, { useState, useMemo, useEffect } from 'react';
import { fetchAdminExportData, fetchAdminRegisteredSchools, runSupabaseDeepDiagnostic } from '../src/services/api';
import { 
  Calendar, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Download, 
  Filter, 
  Building2, 
  BarChart2, 
  PieChart as PieIcon,
  Search
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

interface AdminAttendanceAnalyticsPageProps {
  attendance?: any[];
  classes?: any[];
  users?: any[];
  schools?: any[];
}

export const AdminAttendanceAnalyticsPage: React.FC<AdminAttendanceAnalyticsPageProps> = ({
  attendance = [],
  classes = [],
  users = [],
  schools = []
}) => {
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('current');
  const [selectedCycle, setSelectedCycle] = useState<string>('all');
  
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [totalStudents, setTotalStudents] = useState<number>(0);
  const [dbAttendance, setDbAttendance] = useState<any[]>(attendance);
  const [dbStudents, setDbStudents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const schRes = await fetchAdminRegisteredSchools();
        if (schRes && schRes.schools) {
          setSchoolsList(schRes.schools);
        }
        const diagRes = await runSupabaseDeepDiagnostic();
        if (diagRes && diagRes.success) {
          setTotalStudents(diagRes.studentsCount || 0);
        }
        const exportRes = await fetchAdminExportData();
        if (exportRes?.success) {
          setDbAttendance(exportRes.attendance || []);
          setDbStudents(exportRes.students || []);
          setTotalStudents((exportRes.students || []).length || diagRes?.studentsCount || 0);
        }
      } catch (err) {
        console.error("Error loading attendance page data:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const availableSchools = schoolsList.length > 0 ? schoolsList : [];

  const filteredAttendance = useMemo(() => dbAttendance.filter(item => {
    if (selectedSchool === 'all') return true;
    const studentObj = dbStudents.find(s => Number(s.id) === Number(item.studentId));
    return Number(studentObj?.schoolId || item.schoolId) === Number(selectedSchool);
  }), [dbAttendance, dbStudents, selectedSchool]);

  // Weekly Attendance Trajectory Data (Mon to Fri) - Supabase dynamic data
  const weeklyData = useMemo(() => {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    return days.map((day, idx) => {
      const dayMatches = filteredAttendance.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.getDay() === idx + 1 || String(item.date || '').toLowerCase().includes(day.toLowerCase());
      });
      const present = dayMatches.filter(i => ['present', 'présent', 'presente'].includes(String(i.status || '').toLowerCase())).length;
      const late = dayMatches.filter(i => ['late', 'retard', 'en retard'].includes(String(i.status || '').toLowerCase())).length;
      const absent = dayMatches.filter(i => ['absent', 'absence'].includes(String(i.status || '').toLowerCase())).length;
      const total = present + late + absent;
      return {
        day,
        presenceRate: total ? Number(((present / total) * 100).toFixed(1)) : 0,
        retardRate: total ? Number(((late / total) * 100).toFixed(1)) : 0,
        absenceRate: total ? Number(((absent / total) * 100).toFixed(1)) : 0,
        totalStudents: total,
        presentCount: present
      };
    });
  }, [filteredAttendance]);

  const averagePresenceRate = useMemo(() => {
    const totalRecords = filteredAttendance.length;
    if (!totalRecords) return 0;
    const presentRecords = filteredAttendance.filter(i => ['present', 'présent', 'presente'].includes(String(i.status || '').toLowerCase())).length;
    return Number(((presentRecords / totalRecords) * 100).toFixed(1));
  }, [filteredAttendance]);

  const totalLateRecords = useMemo(() => filteredAttendance.filter(i => ['late', 'retard', 'en retard'].includes(String(i.status || '').toLowerCase())).length, [filteredAttendance]);
  const totalAbsentRecords = useMemo(() => filteredAttendance.filter(i => ['absent', 'absence'].includes(String(i.status || '').toLowerCase())).length, [filteredAttendance]);

  // Breakdown by School for Direction Générale
  const schoolComparisonData = useMemo(() => {
    return schoolsList.map(s => {
      const schoolStudents = dbStudents.filter(st => Number(st.schoolId) === Number(s.id));
      const studentIds = new Set(schoolStudents.map(st => Number(st.id)));
      const rows = dbAttendance.filter(a => Number(a.schoolId) === Number(s.id) || studentIds.has(Number(a.studentId)));
      const present = rows.filter(i => ['present', 'présent', 'presente'].includes(String(i.status || '').toLowerCase())).length;
      const late = rows.filter(i => ['late', 'retard', 'en retard'].includes(String(i.status || '').toLowerCase())).length;
      const absent = rows.filter(i => ['absent', 'absence'].includes(String(i.status || '').toLowerCase())).length;
      const total = present + late + absent;
      const presenceRate = total ? Number(((present / total) * 100).toFixed(1)) : 0;
      return {
        school: s.name,
        presenceRate,
        retards: late,
        absences: absent,
        status: total === 0 ? 'Aucune donnée' : presenceRate >= 90 ? 'Optimal' : presenceRate >= 75 ? 'Normal' : 'À surveiller'
      };
    });
  }, [schoolsList, dbAttendance, dbStudents]);

  // Breakdown by Educational Cycle
  const cycleData = [
    { cycle: 'Maternelle (Petite/Moy/Grande)', rate: 0, color: '#10B981' },
    { cycle: 'Primaire (CI -> CM2)', rate: 0, color: '#3B82F6' },
    { cycle: 'Collège (6ème -> 3ème)', rate: 0, color: '#6366F1' },
    { cycle: 'Lycée (2nde -> Tle)', rate: 0, color: '#EC4899' }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1F4A59] to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-emerald-400" />
              Vue Direction Générale • Tableau de Bord Assiduité
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">
            Évolution Hebdomadaire des Présences par Établissement
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Surveillance transversale des taux d'assiduité, retards et absences à travers les établissements.
          </p>
        </div>

        {/* School & Period Filter Controls */}
        <div className="flex flex-wrap gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700 shrink-0">
          <div className="flex items-center gap-1.5 px-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedSchool}
              onChange={(e) => setSelectedSchool(e.target.value)}
              className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-white">Tous les établissements</option>
              {availableSchools.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-700 my-auto"></div>

          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-300 outline-none cursor-pointer px-2"
          >
            <option value="current" className="bg-slate-900 text-white">Semaine en cours (Sem. 33)</option>
            <option value="prev" className="bg-slate-900 text-white">Semaine précédente (Sem. 32)</option>
            <option value="month" className="bg-slate-900 text-white">Moyenne Mensuelle</option>
          </select>
        </div>
      </div>

      {/* 4 Overview Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Taux de Présence Moyen</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{averagePresenceRate.toFixed(1)}%</p>
          <span className="text-[11px] text-slate-400 font-medium">Données en temps réel</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Total Élèves Suivis</span>
            <Users className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{totalStudents.toLocaleString('fr-FR')}</p>
          <span className="text-[11px] text-slate-400 font-medium">Répartis sur {schoolsList.length} établissement{schoolsList.length > 1 ? 's' : ''}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Retards Cumulés</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{totalLateRecords}</p>
          <span className="text-[11px] text-amber-600 font-bold">{totalLateRecords === 0 ? 'Aucun retard à signaler' : 'Retards enregistrés'}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Absences Non Justifiées</span>
            <AlertCircle className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{totalAbsentRecords}</p>
          <span className="text-[11px] text-[#1F4A59] dark:text-sky-400 font-bold">{totalAbsentRecords} absence{totalAbsentRecords > 1 ? 's' : ''} enregistrée{totalAbsentRecords > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Main Chart: Weekly Attendance Profile */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#1F4A59] dark:text-sky-400" />
              <span>Profil Journalier des Présences & Retards (Du Lundi au Vendredi)</span>
            </h2>
            <p className="text-xs text-slate-400">Pourcentage d'élèves présents, en retard ou absents chaque jour ouvrable</p>
          </div>
        </div>

        <div className="h-80 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12, fontWeight: 700 }} />
              <YAxis domain={[0, 100]} stroke="#64748b" unit="%" tick={{ fontSize: 11 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '1rem', color: '#fff' }}
                formatter={(value: any, name: string) => [`${value}%`, name === 'presenceRate' ? 'Présents' : name === 'retardRate' ? 'Retards' : 'Absences']}
              />
              <Legend 
                verticalAlign="top" 
                height={36} 
                formatter={(val) => val === 'presenceRate' ? 'Taux de Présence (%)' : val === 'retardRate' ? 'Retards (%)' : 'Absences (%)'}
              />
              <Bar dataKey="presenceRate" fill="#10B981" radius={[8, 8, 0, 0]} />
              <Bar dataKey="retardRate" fill="#F59E0B" radius={[8, 8, 0, 0]} />
              <Bar dataKey="absenceRate" fill="#EF4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Grid: School Comparison Table & Cycle Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Comparison Table */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
            <span>Assiduité Comparée par Établissement (Vue Multi-Sites)</span>
          </h2>

          <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200 font-medium">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3">Établissement</th>
                  <th className="px-4 py-3">Taux Présence</th>
                  <th className="px-4 py-3">Retards</th>
                  <th className="px-4 py-3">Absences</th>
                  <th className="px-4 py-3">État Assiduité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
                {schoolComparisonData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{item.school}</td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{item.presenceRate}%</td>
                    <td className="px-4 py-3 font-mono text-amber-600">{item.retards} cas</td>
                    <td className="px-4 py-3 font-mono text-rose-600">{item.absences} cas</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                        item.status === 'Optimal'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : item.status === 'Normal'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cycle Breakdown Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-emerald-500" />
            <span>Assiduité par Cycle Pédagogique</span>
          </h2>

          <div className="space-y-4 pt-2">
            {cycleData.map((c, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{c.cycle}</span>
                  <span className="font-mono font-black" style={{ color: c.color }}>{c.rate}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${c.rate}%`, backgroundColor: c.color }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs text-slate-500 space-y-1 mt-4">
            <p className="font-bold text-slate-700 dark:text-slate-300">Observation Direction :</p>
            <p>Le cycle Lycée enregistre une légère hausse des retards le vendredi après-midi. Les équipes de surveillance sont mobilisées.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAttendanceAnalyticsPage;
