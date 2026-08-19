import React, { useState } from 'react';
import StatCard from './StatCard';
import RevenueChartCard from './LineChartCard';
import PaymentDistributionChartCard from './PieChartCard';
import TopClassesList from './TopClassesList';
import BudgetCategoryAlerts from './BudgetCategoryAlerts';
import WeeklyAttendanceChartCard from './WeeklyAttendanceChartCard';
import AdminDatabasePopulationChart from './AdminDatabasePopulationChart';
import AdminDiagnostic from './AdminDiagnostic';
import { 
  StatStudentsIcon, 
  StatClassesIcon,
  StatTeachersIcon,
  SuccessRateIcon,
  PaymentsIcon,
  BriefcaseIcon,
  DatabaseIcon,
  ReportingIcon,
  SettingsIcon,
  ShieldCheckIcon,
  KeyIcon,
} from './Icons';
import { topClassesData } from '../constants';
import { UserPlus, Download, Database, Settings, Activity, ShieldCheck, Mail, ArrowRight, Bell, CheckCircle2, RefreshCw, Sparkles, Building2, Play } from 'lucide-react';
import { SupabaseTesterModal } from './SupabaseTesterModal';

type TopClass = typeof topClassesData[0];

interface SchoolOverviewProps {
  topClasses: TopClass[];
  users?: any[];
  payments?: any[];
  personnel?: any[];
  classes?: any[];
  attendance?: any[];
  budget?: any;
  transactions?: any[];
  grades?: any[];
  schoolSettings?: any;
  setActivePage?: (page: string) => void;
}

const SchoolOverview: React.FC<SchoolOverviewProps> = ({ 
  topClasses, 
  users = [], 
  payments = [], 
  personnel = [],
  classes = [],
  attendance = [],
  budget,
  transactions = [],
  grades = [],
  schoolSettings,
  setActivePage,
}) => {
  const [dbTestResult, setDbTestResult] = useState<any>(null);
  const [isTestingDb, setIsTestingDb] = useState(false);
  const [isSeedingDb, setIsSeedingDb] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);


  const enrolledStudentsCount = users.filter(u => u.role === 'Élève').length;
  const personnelCount = personnel.length;
  const teachersCount = users.filter(u => u.role === 'Enseignant').length;
  const adminsCount = users.filter(u => u.role === 'Admin').length;
  
  const totalFeesAll = payments.reduce((sum, p) => sum + (p.totalFees || 0), 0);
  const totalPaidAll = payments.reduce((sum, p) => sum + (p.amountPaid || 0), 0);
  const currentPaymentRate = totalFeesAll > 0 ? Math.round((totalPaidAll / totalFeesAll) * 100) : 0;
  const currency = schoolSettings?.currency || 'FCFA';

  const lastBackup = localStorage.getItem('educo_last_backup_date') || 'Aucune';
  const autoBackup = localStorage.getItem('educo_auto_backup_enabled') !== 'false';

  return (
    <div className="space-y-6">
      {/* Super Admin Header */}
      <div className="bg-gradient-to-r from-slate-800 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Espace Administrateur Système
            </span>
            <span className="text-xs text-slate-300">
              {schoolSettings?.name || "Educo"} - Année : {schoolSettings?.academicYear || schoolSettings?.currentYear || '2025-2026'}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Centre de Contrôle de l'Application</h2>
          <p className="text-sm text-slate-300 max-w-2xl">
            Vue d'ensemble et gestion centrale de toutes les entités de l'établissement. Naviguez vers les paramètres pour configurer les rôles, matières, intégrations et sauvegardes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
            <button
                onClick={() => setIsSupabaseModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-xs transition-all shadow-md rounded-xl cursor-pointer"
            >
                <Database className="w-4 h-4 text-slate-950" />
                <span>⚡ Console Base de Données</span>
            </button>

            <button 
                onClick={() => setActivePage && setActivePage('Paramètres')}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium text-xs transition-colors border border-indigo-400 cursor-pointer"
            >
                <Settings className="w-4 h-4" />
                <span>Paramètres</span>
            </button>
        </div>
      </div>

      {/* Database School Test Banner if Triggered */}
      {dbTestResult && (
        <div className="p-4 bg-emerald-950/90 text-emerald-100 rounded-2xl border border-emerald-500/50 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-slide-up">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-wider text-emerald-300">{dbTestResult.message || 'Test Base de Données Effectué'}</p>
              {dbTestResult.school && (
                <p className="text-xs text-slate-200 mt-0.5">
                  Établissement : <strong className="text-white font-mono">{dbTestResult.school.name}</strong> ({dbTestResult.school.identifier}) • Promoteur : <strong className="text-white">{dbTestResult.school.promoterName}</strong>
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setDbTestResult(null)} className="px-3 py-1 bg-white/10 hover:bg-white/20 text-xs rounded-lg font-bold text-white shrink-0 cursor-pointer">
            Fermer
          </button>
        </div>
      )}

      <BudgetCategoryAlerts 
        budget={budget}
        transactions={transactions}
        currency={currency}
        roleTitle="Direction Générale / Admin"
        onNavigateToReports={setActivePage ? () => setActivePage('Rapports Financiers') : undefined}
      />

      {/* 4 Summary Statistical Cards with Progressive Entry Animation (fade-in + slide-up) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="animate-fade-slide-up [animation-delay:0ms] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl">
          <StatCard
            title="Élèves Inscrits"
            value={enrolledStudentsCount.toString()}
            icon={<StatStudentsIcon />}
            color="green"
            info="Nombre total d'élèves enregistrés dans la base"
          />
        </div>
        <div className="animate-fade-slide-up [animation-delay:120ms] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl">
          <StatCard
            title="Taux de Recouvrement"
            value={`${currentPaymentRate}%`}
            icon={<PaymentsIcon />}
            color="blue"
            info="Pourcentage global des frais de scolarité encaissés"
          />
        </div>
        <div className="animate-fade-slide-up [animation-delay:240ms] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl">
          <StatCard
            title="Membres du Personnel"
            value={(personnelCount + teachersCount).toString()}
            icon={<BriefcaseIcon />}
            color="teal"
            info="Effectif total du personnel et enseignants"
          />
        </div>
        <div className="animate-fade-slide-up [animation-delay:360ms] transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl">
          <StatCard
            title="Comptes Administrateurs"
            value={adminsCount.toString()}
            icon={<ShieldCheckIcon />}
            color="purple"
            info="Nombre de comptes ayant les droits d'administration"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Actions Rapides Admin */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                Actions Rapides
            </h3>
            <div className="space-y-3 flex-1">
                <button 
                    onClick={() => setActivePage && setActivePage('Utilisateurs')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg group-hover:bg-indigo-200">
                            <UserPlus className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-gray-700 group-hover:text-indigo-700">Gestion des Utilisateurs</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                </button>

                <button 
                    onClick={() => setActivePage && setActivePage('Paramètres')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-200">
                            <KeyIcon />
                        </div>
                        <span className="font-medium text-gray-700 group-hover:text-blue-700">Rôles & Accès</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600" />
                </button>

                <button 
                    onClick={() => setActivePage && setActivePage('Paramètres')}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-200">
                            <DatabaseIcon />
                        </div>
                        <span className="font-medium text-gray-700 group-hover:text-emerald-700">Sauvegardes & Base de données</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-emerald-600" />
                </button>
            </div>
            
            {/* System Status Mini Widget */}
            <div className="mt-6 pt-4 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-600 mb-3">État du Système</h4>
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Sauvegarde auto</span>
                        <span className={`font-medium ${autoBackup ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {autoBackup ? 'Activée' : 'Désactivée'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Dernier backup</span>
                        <span className="font-medium text-gray-700">{lastBackup}</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
            <TopClassesList classes={topClasses} />
        </div>
      </div>

      {/* Requirement 6: Recharts Weekly Attendance Chart by Class for Director General / Admin */}
      <WeeklyAttendanceChartCard
        attendance={attendance}
        classes={classes}
        users={users}
        title="Évolution Hebdomadaire des Présences par Classe (Vue Direction Générale)"
        subtitle="Analyse transversale de l'assiduité, présences et retards sur l'ensemble des cycles"
        userRole="Admin"
      />

      {/* Admin Database Population Chart & Diagnostics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AdminDatabasePopulationChart 
          users={users}
          payments={payments}
          personnel={personnel}
          classes={classes}
          transactions={transactions}
          grades={grades}
        />
        <AdminDiagnostic 
          users={users}
          payments={payments}
          personnel={personnel}
          classes={classes}
          transactions={transactions}
          grades={grades}
          subjects={[]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <PaymentDistributionChartCard payments={payments} currency={currency} />
        </div>
        <div className="lg:col-span-2">
          <RevenueChartCard transactions={transactions} currency={currency} />
        </div>
      </div>

      <SupabaseTesterModal 
        isOpen={isSupabaseModalOpen} 
        onClose={() => setIsSupabaseModalOpen(false)} 
      />
    </div>
  );
};

export default SchoolOverview;
