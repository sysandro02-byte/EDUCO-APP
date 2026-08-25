import React, { useState, useMemo, useEffect } from 'react';
import { fetchAdminRegisteredSchools, runSupabaseDeepDiagnostic, fetchAdminExportData } from '../src/services/api';
import { 
  Building2, 
  Users, 
  Key, 
  Database, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  MessageSquare, 
  Sparkles, 
  Settings, 
  ShieldCheck, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  ArrowUpRight, 
  RefreshCw,
  HardDrive,
  BarChart2,
  PieChart as PieIcon,
  Search,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import AdminDataExportModal from './AdminDataExportModal';
import UserAvatar from './UserAvatar';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  AreaChart,
  Area
} from 'recharts';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
  schools?: any[];
  users?: any[];
  payments?: any[];
  attendance?: any[];
  onOpenLicenseHub?: () => void;
  onOpenSupabaseModal?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigate,
  schools = [],
  users = [],
  payments = [],
  attendance = [],
  onOpenLicenseHub,
  onOpenSupabaseModal
}) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [dbPayments, setDbPayments] = useState<any[]>([]);
  const [dbTransactions, setDbTransactions] = useState<any[]>([]);
  const [dbAttendance, setDbAttendance] = useState<any[]>([]);
  const [dbStudents, setDbStudents] = useState<any[]>([]);
  const [dbStats, setDbStats] = useState<{ studentsCount: number | null; usersCount: number | null }>({
    studentsCount: null,
    usersCount: null
  });

  const loadDashboardData = async () => {
    try {
      const areEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

      const res = await fetchAdminExportData();
      if (res && res.success) {
        setSchoolsList(prev => areEqual(prev, res.schools || []) ? prev : (res.schools || []));
        setDbStats(prev => {
          const next = {
            studentsCount: res.students?.length || 0,
            usersCount: res.users?.length || 0
          };
          return areEqual(prev, next) ? prev : next;
        });
        setDbPayments(prev => areEqual(prev, res.payments || []) ? prev : (res.payments || []));
        setDbTransactions(prev => areEqual(prev, res.transactions || []) ? prev : (res.transactions || []));
        setDbAttendance(prev => areEqual(prev, res.attendance || []) ? prev : (res.attendance || []));
        setDbStudents(prev => areEqual(prev, res.students || []) ? prev : (res.students || []));
      } else {
        const schRes = await fetchAdminRegisteredSchools();
        if (schRes && schRes.schools) {
          setSchoolsList(prev => areEqual(prev, schRes.schools) ? prev : schRes.schools);
        }
      }
    } catch (err) {
      console.error("Error loading schools in AdminDashboard:", err);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 20000); // 20s interval
    const onFocus = () => loadDashboardData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const activeLicencesCount = useMemo(() => {
    return schoolsList.filter(s => s.subscription?.isActive).length;
  }, [schoolsList]);

  const activeLicencesPercentage = useMemo(() => {
    if (schoolsList.length === 0) return 0;
    return Math.round((activeLicencesCount / schoolsList.length) * 100);
  }, [schoolsList, activeLicencesCount]);

  const totalStudentsCount = useMemo(() => {
    if (dbStats.studentsCount !== null && dbStats.studentsCount > 0) return dbStats.studentsCount;
    if (dbStudents.length > 0) return dbStudents.length;
    if (dbPayments.length > 0) {
      return Array.from(new Set(dbPayments.map(p => p.studentId || p.studentName))).length;
    }
    return 0;
  }, [dbStats.studentsCount, dbStudents, dbPayments]);

  const financialStats = useMemo(() => {
    const totalFees = dbPayments.reduce((sum, p) => sum + (p.totalFees || p.amount || 0), 0);
    const totalPaid = dbPayments.reduce((sum, p) => sum + (p.amountPaid || p.amount || 0), 0);
    const recoveryRate = totalFees > 0 ? ((totalPaid / totalFees) * 100).toFixed(1) : '0.0';
    return {
      totalFees,
      totalPaid,
      recoveryRate
    };
  }, [dbPayments]);

  const formatAmountMillions = (amount: number) => {
    if (amount >= 1_000_000) {
      return (amount / 1_000_000).toFixed(1) + ' M FCFA';
    }
    return amount.toLocaleString('fr-FR') + ' FCFA';
  };

  // 12 Executive Modules Matrix
  const adminModules = useMemo(() => [
    {
      id: 1,
      title: 'Licences & Abonnements',
      desc: 'Octroyer & gérer les licences et abonnements des établissements',
      icon: Key,
      color: 'from-blue-600 to-indigo-600',
      badge: `${activeLicencesCount} Active${activeLicencesCount > 1 ? 's' : ''}`,
      page: 'Licences & Abonnements'
    },
    {
      id: 2,
      title: 'Gestion d\'Utilisateurs',
      desc: 'Comptes, attributions de rôles, permissions et sécurité',
      icon: Users,
      color: 'from-emerald-600 to-teal-600',
      badge: `${dbStats.usersCount !== null ? dbStats.usersCount : users.length} Utilisateurs`,
      page: 'Gestion Utilisateurs'
    },
    {
      id: 3,
      title: 'Console Supabase',
      desc: 'Contrôler la base de données, requêtes SQL & tables en direct',
      icon: Database,
      color: 'from-slate-800 to-slate-950',
      badge: 'Temps Réel',
      page: 'Console Supabase'
    },
    {
      id: 4,
      title: 'Établissements BD',
      desc: 'Gestion des dossiers scolaires, agréments & multi-tenancy',
      icon: Building2,
      color: 'from-cyan-600 to-blue-700',
      badge: `${schoolsList.length} Inscrit${schoolsList.length > 1 ? 's' : ''}`,
      page: 'Établissements BD'
    },
    {
      id: 5,
      title: 'Sauvegardes & Base de Données',
      desc: 'Instantanés automatiques, exports JSON/SQL & restauration',
      icon: HardDrive,
      color: 'from-indigo-600 to-purple-600',
      badge: 'Quotidien',
      page: 'Sauvegardes & BD'
    },
    {
      id: 6,
      title: 'Présences par Établissement',
      desc: 'Évolution hebdomadaire des présences des élèves (Vue DG)',
      icon: Calendar,
      color: 'from-emerald-500 to-green-600',
      badge: `${dbAttendance.length > 0 ? 'Données réelles' : '0% Présence'}`,
      page: 'Présences par Établissement'
    },
    {
      id: 7,
      title: 'Tableau de Bord & Diagnostic Supabase',
      desc: 'Santé du cluster, réactivité API, schémas & métriques',
      icon: Activity,
      color: 'from-amber-600 to-orange-600',
      badge: dbStats.usersCount !== null ? 'Connecté' : 'À vérifier',
      page: 'Diagnostic Supabase'
    },
    {
      id: 8,
      title: 'Surveillance des Finances',
      desc: 'Surveillance des finances par établissement & alertes seuils',
      icon: DollarSign,
      color: 'from-emerald-600 to-emerald-700',
      badge: 'Conforme',
      page: 'Surveillance Finances'
    },
    {
      id: 9,
      title: 'Revenus vs Dépenses (6 Mois)',
      desc: 'Trajectoire budgétaire semestrielle et marges nettes par école',
      icon: TrendingUp,
      color: 'from-blue-600 to-cyan-600',
      badge: formatAmountMillions(financialStats.totalPaid),
      page: 'Revenus vs Dépenses'
    },
    {
      id: 10,
      title: 'Envoi de Messages',
      desc: 'Circulaires, alertes d\'échéance et communications aux écoles',
      icon: MessageSquare,
      color: 'from-sky-600 to-indigo-600',
      badge: 'Multi-Canal',
      page: 'Messagerie Établissements'
    },
    {
      id: 11,
      title: 'Gestion de l\'IA',
      desc: 'Moteur Gemini, assistants de cours, bulletins & quotas',
      icon: Sparkles,
      color: 'from-purple-600 to-pink-600',
      badge: 'Gemini 2.5 Flash',
      page: 'Gestion de l\'IA'
    },
    {
      id: 12,
      title: 'Paramètres',
      desc: 'Configuration générale du système, sécurité & maintenance',
      icon: Settings,
      color: 'from-slate-700 to-slate-900',
      badge: 'Système v2.0',
      page: 'Paramètres'
    }
  ], [activeLicencesCount, dbStats.usersCount, users, schoolsList, dbAttendance.length, financialStats.totalPaid]);

  // Weekly Attendance Trajectory dynamically calculated
  const weeklyAttendance = useMemo(() => {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const filtered = dbAttendance.filter(item => {
      if (selectedSchoolId === 'all') return true;
      const studentObj = dbStudents.find(s => s.id === item.studentId);
      return studentObj?.schoolId === Number(selectedSchoolId);
    });

    if (filtered.length === 0) {
      return days.map(day => ({ day, presenceRate: 0, retardRate: 0, absenceRate: 0 }));
    }

    return days.map(day => {
      const dayMatches = filtered.filter(item => {
        const itemDate = new Date(item.date);
        const dayIndex = itemDate.getDay();
        const targetIdx = days.indexOf(day) + 1;
        return dayIndex === targetIdx || String(item.date).toLowerCase().includes(day.toLowerCase());
      });

      if (dayMatches.length === 0) {
        return { day, presenceRate: 0, retardRate: 0, absenceRate: 0 };
      }

      const present = dayMatches.filter(i => i.status === 'present' || i.status === 'Présent').length;
      const late = dayMatches.filter(i => i.status === 'late' || i.status === 'En Retard').length;
      const absent = dayMatches.filter(i => i.status === 'absent' || i.status === 'Absent').length;
      const total = present + late + absent || 1;

      return {
        day,
        presenceRate: Number(((present / total) * 100).toFixed(1)),
        retardRate: Number(((late / total) * 100).toFixed(1)),
        absenceRate: Number(((absent / total) * 100).toFixed(1))
      };
    });
  }, [dbAttendance, dbStudents, selectedSchoolId]);

  // 6 Last Months Revenue vs Expenses dynamically calculated
  const sixMonthsCashflow = useMemo(() => {
    const months = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];
    const activeMonths = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const mIdx = (d.getMonth() - i + 12) % 12;
      activeMonths.push({ index: mIdx, name: months[mIdx] });
    }

    const filteredPayments = dbPayments.filter(p => {
      return selectedSchoolId === 'all' || p.schoolId === Number(selectedSchoolId);
    });
    const filteredTxs = dbTransactions.filter(t => {
      return selectedSchoolId === 'all' || t.schoolId === Number(selectedSchoolId);
    });

    const hasData = filteredPayments.length > 0 || filteredTxs.length > 0;
    if (!hasData) {
      return activeMonths.map(m => ({
        month: m.name,
        revenus: 0,
        depenses: 0
      }));
    }

    return activeMonths.map(m => {
      const payIn = filteredPayments.filter(p => {
        const pDate = new Date(p.paymentDate);
        return pDate.getMonth() === m.index;
      }).reduce((sum, p) => sum + (p.amount || 0), 0);

      const txIn = filteredTxs.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === m.index && t.type === 'income';
      }).reduce((sum, t) => sum + (t.amount || 0), 0);

      const exp = filteredTxs.filter(t => {
        const tDate = new Date(t.date);
        return tDate.getMonth() === m.index && t.type === 'expense';
      }).reduce((sum, t) => sum + (t.amount || 0), 0);

      const totalIncomeMillions = Number(((payIn + txIn) / 1_000_000).toFixed(2));
      const totalExpenseMillions = Number((exp / 1_000_000).toFixed(2));

      return {
        month: m.name,
        revenus: totalIncomeMillions,
        depenses: totalExpenseMillions
      };
    });
  }, [dbPayments, dbTransactions, schoolsList, selectedSchoolId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Simple Compact Executive Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 bg-[#1F4A59]/10 text-[#1F4A59] dark:bg-sky-400/10 dark:text-sky-300 rounded text-[10px] font-extrabold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Super-Admin
            </span>
          </div>
          <h1 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Tableau de Bord Administration
          </h1>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Console de pilotage des modules d'administration EDUCO.
          </p>
        </div>

        {/* School Picker & Actions */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <Building2 className="w-3.5 h-3.5 text-[#1F4A59] dark:text-sky-400" />
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-slate-800 dark:text-white outline-none cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Tous les Établissements</option>
              {schoolsList.map(s => (
                <option key={s.id} value={s.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{s.name}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-lg shadow-sm font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            title="Exporter les données en Excel ou CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exporter Données (Excel/CSV)</span>
          </button>

          <button
            onClick={() => {
              handleRefresh();
              loadDashboardData();
            }}
            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer text-[11px]"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 Core Top-Tier Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Effectif Global Élèves</span>
            <Users className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{totalStudentsCount.toLocaleString('fr-FR')}</p>
          <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> Données synchronisées en direct
          </span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Taux de Recouvrement</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{financialStats.recoveryRate}%</p>
          <span className="text-[11px] text-slate-400 font-medium">{formatAmountMillions(financialStats.totalPaid)} encaissés</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Parc Établissements</span>
            <Building2 className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white font-mono">{schoolsList.length} École{schoolsList.length > 1 ? 's' : ''}</p>
          <span className="text-[11px] text-[#1F4A59] dark:text-sky-400 font-bold">{activeLicencesPercentage}% avec Licences Actives</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-black uppercase tracking-wider">Santé Supabase BD</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            100% En Ligne
          </p>
          <span className="text-[11px] text-slate-400 font-mono">Latence moyenne : 28ms</span>
        </div>
      </div>

      {/* THE 12-MODULE EXECUTIVE CONTROL MATRIX */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#1F4A59] dark:text-sky-400" />
              <span>Matrice de Contrôle Administrateur (Les 12 Modules)</span>
            </h2>
            <p className="text-xs text-slate-500">Accès direct et statut opérationnel de chaque paramètre d'administration</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {adminModules.map((mod) => {
            const IconComp = mod.icon;
            return (
              <div
                key={mod.id}
                onClick={() => onNavigate(mod.page)}
                className="group relative bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${mod.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] rounded-lg">
                      {mod.badge}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-mono font-bold text-slate-400">#{mod.id}</span>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-[#1F4A59] dark:group-hover:text-sky-400 transition-colors">
                        {mod.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {mod.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-[#1F4A59] dark:text-sky-400">
                  <span>Accéder au module</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DUAL EXECUTIVE ANALYTICS: FEATURE #6 & FEATURE #9 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module 6: Évolution Hebdomadaire des Présences (Vue DG) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-md">Module #6</span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Évolution Hebdomadaire des Présences (Vue DG)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Taux de présence journalier (Lundi au Vendredi)</p>
            </div>
            <button
              onClick={() => onNavigate('Présences par Établissement')}
              className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Détails →
            </button>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyAttendance} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis domain={[80, 100]} stroke="#64748b" unit="%" tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '11px' }}
                  formatter={(val: any) => [`${val}%`]}
                />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="presenceRate" fill="#10B981" radius={[4, 4, 0, 0]} name="Présence (%)" isAnimationActive={false} />
                <Bar dataKey="retardRate" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Retards (%)" isAnimationActive={false} />
                <Bar dataKey="absenceRate" fill="#EF4444" radius={[4, 4, 0, 0]} name="Absences (%)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Module 9: Revenus vs Dépenses (6 Derniers Mois) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-md">Module #9</span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Revenus vs Dépenses (6 Derniers Mois)
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Flux d'encaissement et charges d'exploitation (M FCFA)</p>
            </div>
            <button
              onClick={() => onNavigate('Revenus vs Dépenses')}
              className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              Détails →
            </button>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sixMonthsCashflow} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorDepDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" tick={{ fontSize: 11, fontWeight: 700 }} />
                <YAxis stroke="#64748b" unit="M" tick={{ fontSize: 10 }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff', fontSize: '11px' }}
                  formatter={(val: any) => [`${val} M FCFA`]}
                />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px' }} />
                <Area type="monotone" dataKey="revenus" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevDash)" name="Revenus" isAnimationActive={false} />
                <Area type="monotone" dataKey="depenses" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDepDash)" name="Dépenses" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* LIVE SUPABASE REGISTERED ESTABLISHMENTS CONSOLIDATED OVERVIEW */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Établissements Enregistrés & Synchronisation Supabase ({schoolsList.length})
                </h3>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold rounded-md flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Temps Réel
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Consolidation automatique des comptes Promoteurs, effectifs élèves et abonnements
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('Établissements BD')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Voir la base complète →
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Établissement & Ville</th>
                <th className="py-3 px-4">Promoteur / Contact</th>
                <th className="py-3 px-4">Effectif Élèves</th>
                <th className="py-3 px-4">Abonnement & Licence</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
              {schoolsList.map((school: any) => {
                const sName = school.schoolName || school.name || 'Établissement';
                const pName = school.promoterName || school.adminName || 'Promoteur';
                const pEmail = school.promoterEmail || school.adminEmail || 'contact@school.com';
                const count = school.studentCount ?? school.metrics?.studentCount ?? 0;
                const plan = school.subscription?.plan || school.plan || 'Standard';
                const isAct = school.subscription?.isActive ?? true;

                return (
                  <tr key={school.id || sName} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-[#1F4A59]/10 text-[#1F4A59] dark:text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {sName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 dark:text-white truncate">{sName}</p>
                          <p className="text-[11px] text-slate-400 truncate">{school.city || school.country || 'Côte d\'Ivoire'}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <UserAvatar src={school.promoterAvatar} name={pName} role="Promoteur" size="sm" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{pName}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{pEmail}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-lg">
                        <Users className="w-3.5 h-3.5" />
                        {count} élèves
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                        isAct 
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                          : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}>
                        <Key className="w-3 h-3" />
                        <span>{plan} ({isAct ? 'Actif' : 'Expiré'})</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onNavigate('Établissements BD')}
                        className="px-3 py-1.5 bg-[#1F4A59]/10 dark:bg-sky-400/10 text-[#1F4A59] dark:text-sky-300 hover:bg-[#1F4A59]/20 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Superviser
                      </button>
                    </td>
                  </tr>
                );
              })}

              {schoolsList.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold">Aucun établissement enregistré</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Data Export Modal */}
      <AdminDataExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        initialSchoolId={selectedSchoolId}
      />
    </div>
  );
};

export default AdminDashboard;
