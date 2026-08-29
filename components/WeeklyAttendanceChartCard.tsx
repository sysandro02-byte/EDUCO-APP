import React, { useState, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  BarChart3, 
  Activity, 
  Layers 
} from 'lucide-react';

interface WeeklyAttendanceChartCardProps {
  attendance?: any[];
  classes?: any[];
  users?: any[];
  title?: string;
  subtitle?: string;
  defaultClassId?: string;
  userRole?: string;
}

const DAYS_OF_WEEK = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const WeeklyAttendanceChartCard: React.FC<WeeklyAttendanceChartCardProps> = ({
  attendance = [],
  classes = [],
  users = [],
  title = "Évolution Hebdomadaire des Présences des Élèves par Classe",
  subtitle = "Suivi de l'assiduité, des retards et des absences par niveau et division",
  defaultClassId,
  userRole,
}) => {
  const [selectedClass, setSelectedClass] = useState<string>(defaultClassId || 'all');
  const [selectedWeek, setSelectedWeek] = useState<string>('current');
  const [chartType, setChartType] = useState<'bar' | 'area' | 'line'>('bar');
  const [viewMetric, setViewMetric] = useState<'rate' | 'counts'>('counts');

  // Compute student list
  const students = useMemo(() => {
    return users.filter(u => u.role === 'Élève');
  }, [users]);

  // Compute weekly attendance dataset
  const weeklyData = useMemo(() => {
    const selectedClassRecord = classes.find(c => c.name === selectedClass || String(c.id) === selectedClass);
    const weekOffset = selectedWeek === 'prev' ? 7 : selectedWeek === 'prev2' ? 14 : 0;
    const startOfWeek = new Date();
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7) - weekOffset);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    // Build day-by-day weekly metrics
    return DAYS_OF_WEEK.map((dayName, index) => {
      // Find matching live attendance records for that day if available
      const dayAttendance = attendance.filter(a => {
        if (!a.date) return false;
        const recordDate = new Date(a.date);
        if (Number.isNaN(recordDate.getTime()) || recordDate < startOfWeek || recordDate >= endOfWeek) return false;
        const dayOfWeekIndex = (recordDate.getDay() + 6) % 7; // Monday = 0
        const matchesDay = dayOfWeekIndex === index;
        if (!matchesDay) return false;
        if (selectedClass !== 'all' && String(a.className || '') !== selectedClass && String(a.classId ?? a.class_id ?? '') !== String(selectedClassRecord?.id ?? selectedClass)) return false;
        return true;
      });

      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;

      if (dayAttendance.length > 0) {
        presentCount = dayAttendance.filter(a => a.status === 'Présent' || a.status === 'present').length;
        absentCount = dayAttendance.filter(a => a.status === 'Absent' || a.status === 'absent').length;
        lateCount = dayAttendance.filter(a => a.status === 'En retard' || a.status === 'late' || a.status === 'Retard').length;
      }

      const totalRecorded = presentCount + absentCount + lateCount;
      const attendanceRate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0;
      const punctualityRate = Math.round(((presentCount) / (presentCount + lateCount || 1)) * 100);

      return {
        day: dayName,
        presents: presentCount,
        absents: absentCount,
        retards: lateCount,
        total: totalRecorded,
        tauxPresence: attendanceRate,
        tauxPonctualite: Math.min(100, punctualityRate),
      };
    });
  }, [attendance, classes, students, selectedClass, selectedWeek]);

  // Overall Weekly Summary KPIs
  const summaryKpis = useMemo(() => {
    const totalPresents = weeklyData.reduce((sum, d) => sum + d.presents, 0);
    const totalAbsents = weeklyData.reduce((sum, d) => sum + d.absents, 0);
    const totalRetards = weeklyData.reduce((sum, d) => sum + d.retards, 0);
    const avgRate = Math.round(weeklyData.reduce((sum, d) => sum + d.tauxPresence, 0) / weeklyData.length);
    
    // Find best day
    let bestDay = weeklyData[0]?.day || 'Mardi';
    let maxPresent = -1;
    weeklyData.forEach(d => {
      if (d.presents > maxPresent) {
        maxPresent = d.presents;
        bestDay = d.day;
      }
    });

    return {
      totalPresents,
      totalAbsents,
      totalRetards,
      avgRate,
      bestDay,
    };
  }, [weeklyData]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200">
      {/* Top Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">{title}</h3>
              <p className="text-xs text-gray-500">{subtitle}</p>
            </div>
          </div>
        </div>

        {/* Filters & Toggles */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Class Filter */}
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="text-xs font-semibold rounded-lg border-gray-300 py-1.5 px-2.5 bg-gray-50 text-gray-800 focus:ring-[#1F4A59] focus:border-[#1F4A59]"
            >
              <option value="all">Toutes les classes (Global)</option>
              {classes.map(c => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Week Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="text-xs font-semibold rounded-lg border-gray-300 py-1.5 px-2.5 bg-gray-50 text-gray-800 focus:ring-[#1F4A59] focus:border-[#1F4A59]"
            >
              <option value="current">Semaine en cours (S33)</option>
              <option value="prev">Semaine précédente (S32)</option>
              <option value="prev2">Il y a 2 semaines (S31)</option>
            </select>
          </div>

          {/* Metric View Toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMetric('counts')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                viewMetric === 'counts'
                  ? 'bg-white text-[#1F4A59] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Effectifs
            </button>
            <button
              type="button"
              onClick={() => setViewMetric('rate')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                viewMetric === 'rate'
                  ? 'bg-white text-[#1F4A59] shadow-xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Taux (%)
            </button>
          </div>

          {/* Chart Style Toggle */}
          <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              title="Graphique en Barres"
              className={`p-1.5 rounded-md transition-all ${
                chartType === 'bar' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('area')}
              title="Graphique en Aires"
              className={`p-1.5 rounded-md transition-all ${
                chartType === 'area' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              title="Graphique en Courbes"
              className={`p-1.5 rounded-md transition-all ${
                chartType === 'line' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Badges Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-emerald-800">Taux Moyen Présence</div>
            <div className="text-lg font-extrabold text-emerald-900">{summaryKpis.avgRate}%</div>
          </div>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-blue-800">Présences Cumulées</div>
            <div className="text-lg font-extrabold text-blue-900">{summaryKpis.totalPresents}</div>
          </div>
        </div>

        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-rose-100 text-rose-700 rounded-lg">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-rose-800">Total Absences</div>
            <div className="text-lg font-extrabold text-rose-900">{summaryKpis.totalAbsents}</div>
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-800">Retards Signalés</div>
            <div className="text-lg font-extrabold text-amber-900">{summaryKpis.totalRetards}</div>
          </div>
        </div>
      </div>

      {/* Main Recharts Chart Area */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit={viewMetric === 'rate' ? '%' : ''} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              {viewMetric === 'counts' ? (
                <>
                  <Bar dataKey="presents" name="Présents" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false} />
                  <Bar dataKey="absents" name="Absents" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false} />
                  <Bar dataKey="retards" name="Retards" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false} />
                </>
              ) : (
                <>
                  <Bar dataKey="tauxPresence" name="Taux de Présence (%)" fill="#1F4A59" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false} />
                  <Bar dataKey="tauxPonctualite" name="Taux de Ponctualité (%)" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false} />
                </>
              )}
            </BarChart>
          ) : chartType === 'area' ? (
            <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPresents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAbsents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1F4A59" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#1F4A59" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit={viewMetric === 'rate' ? '%' : ''} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              {viewMetric === 'counts' ? (
                <>
                  <Area type="monotone" dataKey="presents" name="Présents" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPresents)" isAnimationActive={false} />
                  <Area type="monotone" dataKey="absents" name="Absents" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorAbsents)" isAnimationActive={false} />
                </>
              ) : (
                <Area type="monotone" dataKey="tauxPresence" name="Taux de Présence (%)" stroke="#1F4A59" strokeWidth={3} fillOpacity={1} fill="url(#colorRate)" isAnimationActive={false} />
              )}
            </AreaChart>
          ) : (
            <LineChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="day" stroke="#64748b" fontSize={12} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={12} tickLine={false} unit={viewMetric === 'rate' ? '%' : ''} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
              {viewMetric === 'counts' ? (
                <>
                  <Line type="monotone" dataKey="presents" name="Présents" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="absents" name="Absents" stroke="#f43f5e" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="retards" name="Retards" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} isAnimationActive={false} />
                </>
              ) : (
                <>
                  <Line type="monotone" dataKey="tauxPresence" name="Taux de Présence (%)" stroke="#1F4A59" strokeWidth={3} dot={{ r: 5 }} isAnimationActive={false} />
                  <Line type="monotone" dataKey="tauxPonctualite" name="Taux de Ponctualité (%)" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
                </>
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default WeeklyAttendanceChartCard;
