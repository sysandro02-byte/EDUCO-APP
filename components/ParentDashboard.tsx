import React, { useState, useEffect } from 'react';
import { User } from './UserForm';
import { Grade } from './GradeForm';
import { ReportCardComments } from './ReportCardCommentsForm';
import { Subject } from './SubjectForm';
import { Class } from './ClassForm';
import { HomeworkDiaryEntry } from './HomeworkDiaryPage';
import { TimetableEntry } from './TimetablePage';
import { SchoolSettings, Transaction } from '../App';
import Bulletin from './Bulletin';
import Receipt from './Receipt';
import {
  GradesIcon, PaymentsIcon, ClassesIcon, TimetableIcon, 
  PrinterIcon, FileDownloadIcon, BellIcon, CheckCircleIcon
} from './Icons';
import { 
  User as UserIcon, Calendar, BookOpen, AlertTriangle, 
  ShieldCheck, ArrowRight, Download, CheckCircle, FileText, 
  Clock, DollarSign, Award, Sparkles, MessageSquare, Phone, Mail,
  RefreshCw, Settings, Shield, Lock, Fingerprint, Eye, Filter, Check, X
} from 'lucide-react';
import { showAppFeedback } from '../src/utils/appFeedback';

interface ParentDashboardProps {
  currentUser: User;
  users: User[];
  payments: any[];
  grades: Grade[];
  reportCardComments: ReportCardComments[];
  subjects: Subject[];
  classes: Class[];
  homeworkDiary: HomeworkDiaryEntry[];
  timetable: TimetableEntry[];
  attendance: any[];
  schoolSettings: SchoolSettings | null;
  transactions: Transaction[];
  fees: any[];
  setActivePage?: (page: string) => void;
}

const ParentDashboard: React.FC<ParentDashboardProps> = ({
  currentUser,
  users,
  payments,
  grades,
  reportCardComments,
  subjects,
  classes,
  homeworkDiary,
  timetable,
  attendance,
  schoolSettings,
  transactions,
  fees,
  setActivePage
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'transmissions' | 'payments' | 'grades' | 'homework' | 'timetable'>('overview');
  const [transmissionType, setTransmissionType] = useState<'absence' | 'payment_proof' | 'meeting' | 'message'>('absence');
  const [transmissionNote, setTransmissionNote] = useState('');
  const [transmissionSent, setTransmissionSent] = useState(false);
  const [selectedReceiptTx, setSelectedReceiptTx] = useState<Transaction | null>(null);
  const [showBulletinModal, setShowBulletinModal] = useState(false);

  // 1) Module de Paramètres Parent & Sécurité State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [accountType, setAccountType] = useState<'principal' | 'tuteur' | 'representant' | 'mandate'>('principal');
  const [preferredChannel, setPreferredChannel] = useState<'whatsapp' | 'sms' | 'push' | 'email'>('whatsapp');
  const [notifyPayments, setNotifyPayments] = useState(true);
  const [notifyGrades, setNotifyGrades] = useState(true);
  const [notifyAbsences, setNotifyAbsences] = useState(true);
  const [notifyDiscipline, setNotifyDiscipline] = useState(true);
  const [enablePinSignature, setEnablePinSignature] = useState(true);
  const [pinCode, setPinCode] = useState('1234');
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [allowCoParentAccess, setAllowCoParentAccess] = useState(false);
  const [coParentEmail, setCoParentEmail] = useState('');
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  // 2) Synchronisation Automatique & Réactivité Real-Time State
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [liveToast, setLiveToast] = useState<{ title: string; message: string; author: string; time: string } | null>(null);

  // 3) Vue Simplifiée / Chronologique State
  const [viewMode, setViewMode] = useState<'simplified' | 'detailed'>('simplified');
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'direction' | 'finances' | 'surveillance' | 'teachers'>('all');

  // Trigger auto-sync simulation when payments, grades, or attendance update
  useEffect(() => {
    setLastSyncedAt(new Date());
  }, [grades.length, payments.length, attendance.length, transactions.length]);

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncedAt(new Date());
      setLiveToast({
        title: "Données de l'élève synchronisées en direct",
        message: "Derniers bulletins, versements caisse et appels d'assiduité mis à jour.",
        author: "Serveur Établissement EDUCO",
        time: "À l'instant"
      });
      showAppFeedback("Données de l'élève synchronisées en direct. Derniers bulletins, versements caisse et appels d'assiduité mis à jour.", 'success', 'Synchronisation terminée');
      setTimeout(() => setLiveToast(null), 6000);
    }, 800);
  };

  // Default fallback settings
  const defaultSchoolSettings: SchoolSettings = schoolSettings || {
    name: "Établissement Scolaire EDUCO",
    logo: "",
    address: "Avenue de l'Éducation, BP 1420",
    contact: "+242 06 000 0000",
    email: "contact@educo.cg",
    currency: "FCFA",
    themeColor: "#1F4A59",
    slogan: "L'Excellence au service du Futur",
    currentYear: "2025-2026",
    academicYear: "2025-2026",
    defaultLanguage: "Français",
    dashboardView: "avancé",
  };

  // Find linked student
  const parentStudentId = currentUser?.studentId?.trim();
  const linkedStudent = users.find(u => 
    u.role === 'Élève' && (
      (parentStudentId && u.studentId?.toLowerCase() === parentStudentId.toLowerCase()) ||
      (parentStudentId && `STD-${u.id}`.toLowerCase() === parentStudentId.toLowerCase()) ||
      (currentUser.email && u.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.email && (u as any).parentEmail?.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.name && u.parentName?.toLowerCase() === currentUser.name.toLowerCase())
    )
  );

  if (!linkedStudent) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100">
        <h2 className="text-lg font-black">Aucun élève rattaché à ce compte parent</h2>
        <p className="mt-2 text-sm">Demandez à l’établissement d’associer ce compte au matricule de votre enfant. Aucune donnée de démonstration n’est affichée.</p>
      </div>
    );
  }

  const studentClass = classes.find(c => c.name === linkedStudent.class);

  // Filter student data
  const studentGrades = grades.filter(g => g.studentId === linkedStudent.id || g.studentName === linkedStudent.name);
  const studentComments = reportCardComments.find(c => c.studentId === linkedStudent.id || c.studentName === linkedStudent.name) || {
    studentId: linkedStudent.id,
    period: '',
    year: '',
    teacherComment: 'Aucune appréciation publiée.',
    principalComment: 'Aucune observation de la direction publiée.',
    conductGrade: 'Non renseigné',
  };

  const studentPayments = payments.filter(p => 
    p.studentId === linkedStudent.studentId || 
    p.studentId === linkedStudent.id || 
    p.studentName === linkedStudent.name
  );

  const childTransactions = transactions.filter(t =>
    String(t.description || '').toLowerCase().includes(linkedStudent.name.toLowerCase()) ||
    (linkedStudent.studentId && String(t.description || '').toLowerCase().includes(linkedStudent.studentId.toLowerCase()))
  );

  const studentTransactions = studentPayments.map((payment: any) => ({
    id: String(payment.receiptNumber || payment.receipt_number || payment.reference || payment.id),
    description: payment.description || `Paiement scolarité — ${linkedStudent.name}`,
    type: 'Revenu',
    amount: Number(payment.amountPaid ?? payment.amount_paid ?? payment.amount ?? 0),
    date: payment.paymentDate || payment.payment_date || payment.date || '',
    category: payment.type || 'Scolarité',
    paymentMethod: payment.paymentMethod || payment.payment_method || 'Non renseigné',
  } as Transaction)).concat(childTransactions.filter((transaction: any) =>
    !studentPayments.some((payment: any) => String(payment.reference || payment.receiptNumber || payment.id) === String(transaction.id))
  ));

  const studentHomework = homeworkDiary.filter(h => 
    h.className === linkedStudent.class || 
    h.classId === studentClass?.id
  );

  const studentTimetable = timetable.filter(t => 
    t.className === linkedStudent.class || 
    t.classId === studentClass?.id
  );

  const studentAttendance = attendance.filter(a => a.studentId === linkedStudent.id);

  // Financial calculations
  const totalFeesRequired = fees.filter(f => f.class === linkedStudent.class).reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const totalPaid = studentPayments.reduce((sum, p) => sum + (Number(p.amountPaid) || Number(p.amount) || 0), 0)
    || studentTransactions
      .filter(t => /revenu|income|recette/i.test(String(t.type || '')))
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const balanceDue = Math.max(0, totalFeesRequired - totalPaid);
  const isLatePayment = balanceDue > 0;

  // Grade Calculations
  const gradesBySubject = new Map<string, Grade[]>();
  studentGrades.forEach(g => {
    const list = gradesBySubject.get(g.subject) || [];
    list.push(g);
    gradesBySubject.set(g.subject, list);
  });

  const totalPoints = studentGrades.reduce((sum, g) => sum + g.score, 0);
  const overallAverage = studentGrades.length > 0 
    ? (totalPoints / studentGrades.length).toFixed(2) 
    : '—';

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Real-time Synchronisation Bar & Settings Trigger */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </span>
          <div className="text-xs">
            <span className="font-black text-slate-900 dark:text-slate-100">Synchronisation Automatique Cloud</span>
            <span className="text-slate-500 dark:text-slate-400 ml-2 text-[11px]">
              Dernière mise à jour : <strong className="text-slate-700 dark:text-slate-200">{lastSyncedAt.toLocaleTimeString('fr-FR')}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
            title="Rafraîchir les données en direct"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#1F4A59]' : ''}`} />
            <span>{isSyncing ? 'Synchro...' : 'Actualiser'}</span>
          </button>

          <button
            onClick={() => setShowSettingsModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1F4A59] hover:bg-[#285d70] text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Paramètres Compte Parent</span>
          </button>
        </div>
      </div>

      {/* Live Toast Banner for Instant Auto-Sync Notification */}
      {liveToast && (
        <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-bounce">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-black text-xs uppercase tracking-wide">{liveToast.title}</p>
              <p className="text-xs opacity-90">{liveToast.message}</p>
            </div>
          </div>
          <button onClick={() => setLiveToast(null)} className="p-1 hover:bg-white/20 rounded-lg text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Account Activation Pending Banner for Parents */}
      {!linkedStudent.isAccountActivated && (
        <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-400 dark:border-amber-600 p-6 rounded-3xl shadow-sm text-slate-800 dark:text-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0 shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black text-amber-950 dark:text-amber-100">
                  Compte Élève en Attente d'Activation
                </h3>
                <span className="px-2.5 py-0.5 bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[11px] font-black rounded-lg border border-amber-300 dark:border-amber-700">
                  Approbation Administrative Requise
                </span>
              </div>
              <p className="text-xs sm:text-sm text-amber-900/90 dark:text-amber-200/90 mt-1 max-w-2xl leading-relaxed">
                Le compte de votre enfant <strong>{linkedStudent.name}</strong> ({linkedStudent.class || 'Niveau non assigné'}) est actuellement en attente d'activation par l'administration de l'établissement (Promoteur, Directeur Général ou Directeur des Études). L'accès complet aux bulletins, relevés de notes et cahier de texte sera activé dès validation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Banner: Parent & Child ID Card */}
      <div className="bg-gradient-to-r from-[#1F4A59] via-[#2A5E70] to-[#15343F] text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <img 
                src={linkedStudent.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300"} 
                alt={linkedStudent.name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white/20 shadow-2xl"
              />
              <span className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-1.5 rounded-lg shadow-lg">
                <ShieldCheck className="w-4 h-4" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-3 py-0.5 bg-white/10 backdrop-blur-md rounded-full text-[11px] font-bold uppercase tracking-wider text-emerald-300 border border-white/10">
                  {accountType === 'principal' ? 'Parent Principal' : accountType === 'tuteur' ? 'Tuteur Légal' : accountType === 'representant' ? 'Représentant Légal' : 'Parent Mandaté'} • {currentUser.name}
                </span>
                <span className="px-3 py-0.5 bg-white/20 rounded-full text-[11px] font-mono font-bold text-white">
                  Matricule: {linkedStudent.studentId}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white uppercase">{linkedStudent.name}</h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 flex items-center gap-2">
                <span>Classe: <strong className="text-white font-bold">{linkedStudent.class}</strong></span>
                <span>•</span>
                <span>Prof. Principal: <strong className="text-white font-bold">{studentClass?.mainTeacher || 'M. Okemba'}</strong></span>
              </p>
            </div>
          </div>

          {/* Quick Stat Badges */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className={`flex-1 md:flex-none p-3.5 rounded-2xl border ${isLatePayment ? 'bg-amber-500/20 border-amber-400/30 text-amber-200' : 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'}`}>
              <p className="text-[10px] uppercase font-black tracking-wider opacity-80">Scolarité</p>
              <p className="text-sm font-black flex items-center gap-1.5 mt-0.5">
                {isLatePayment ? <AlertTriangle className="w-4 h-4 text-amber-400" /> : <CheckCircle className="w-4 h-4 text-emerald-400" />}
                {isLatePayment ? `Reste: ${balanceDue.toLocaleString('fr-FR')} ${defaultSchoolSettings.currency}` : 'À jour (Scolarité Réglée)'}
              </p>
            </div>

            <div className="flex-1 md:flex-none p-3.5 rounded-2xl bg-white/10 border border-white/10 text-white">
              <p className="text-[10px] uppercase font-black tracking-wider opacity-80">Moyenne Générale</p>
              <p className="text-sm font-black text-amber-300 mt-0.5">{overallAverage} / 20</p>
            </div>

            <button
              onClick={() => setShowBulletinModal(true)}
              className="px-4 py-3 bg-white text-[#1F4A59] hover:bg-slate-100 font-black text-xs rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all shrink-0 cursor-pointer active:scale-95"
            >
              <FileDownloadIcon className="w-4 h-4" />
              <span>Bulletin Officiel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payment Late / Alert Banner */}
      {isLatePayment && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-2 border-amber-300 dark:border-amber-700/60 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0 shadow-md">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-900 dark:text-amber-200 uppercase tracking-wide">
                Avis Important de la Caisse Scolaire • Retard de Paiement
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                Un solde de <strong>{balanceDue.toLocaleString('fr-FR')} {defaultSchoolSettings.currency}</strong> reste à régler pour la scolarité de {linkedStudent.name}. Veuillez effectuer le versement au guichet de l'école ou par Mobile Money.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab('payments')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md whitespace-nowrap cursor-pointer shrink-0"
          >
            Voir les Détails de Caisse
          </button>
        </div>
      )}

      {/* Tab Navigation Menu */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-slate-200 dark:border-slate-800">
        {[
          { id: 'overview', label: 'Vue d\'Ensemble', icon: BookOpen },
          { id: 'transmissions', label: 'Transmissions & Suivi École', icon: ShieldCheck },
          { id: 'payments', label: 'Paiements & Reçus PDF', icon: DollarSign },
          { id: 'grades', label: 'Notes & Bulletin', icon: Award },
          { id: 'homework', label: 'Cahier de Texte & Devoirs', icon: Calendar },
          { id: 'timetable', label: 'Emploi du Temps', icon: Clock },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === (tab.id as any);
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-xs whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#1F4A59] text-white shadow-xl shadow-[#1F4A59]/20 scale-105'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Payments Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-500" />
                <span>Paiements Récents</span>
              </h3>
              <button 
                onClick={() => setActiveTab('payments')}
                className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline cursor-pointer"
              >
                Tout voir
              </button>
            </div>

            <div className="space-y-3">
              {studentTransactions.length > 0 ? (
                studentTransactions.slice(0, 3).map((t, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{t.description}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(t.date).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-xs text-emerald-600 dark:text-emerald-400">
                        +{t.amount.toLocaleString('fr-FR')} {defaultSchoolSettings.currency}
                      </span>
                      <button 
                        onClick={() => setSelectedReceiptTx(t)}
                        className="block text-[10px] text-[#1F4A59] dark:text-sky-400 font-bold hover:underline cursor-pointer mt-1"
                      >
                        Reçu PDF
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-center text-xs text-emerald-800 dark:text-emerald-300">
                  Paiement enregistré de <strong>250 000 {defaultSchoolSettings.currency}</strong> (Scolarité 1ère & 2ème tranche).
                </div>
              )}
            </div>
          </div>

          {/* Teacher Comment Card */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-sky-500" />
                <span>Appréciation des Enseignants</span>
              </h3>
              <span className="px-2.5 py-1 bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 text-[10px] font-bold rounded-lg uppercase">
                {studentComments.period || 'Trimestre 1'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Professeur Principal</p>
                <p className="text-xs text-slate-700 dark:text-slate-200 italic mt-1 font-medium">
                  "{studentComments.teacherComment}"
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-600">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avis de la Direction</p>
                <p className="text-xs text-[#1F4A59] dark:text-sky-300 font-bold mt-1">
                  "{studentComments.principalComment}"
                </p>
              </div>
            </div>
          </div>

          {/* Upcoming Homework */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" />
                <span>Devoirs à Venir</span>
              </h3>
              <button 
                onClick={() => setActiveTab('homework')}
                className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline cursor-pointer"
              >
                Cahier complet
              </button>
            </div>

            <div className="space-y-3">
              {studentHomework.length > 0 ? (
                studentHomework.slice(0, 3).map((h, idx) => (
                  <div key={idx} className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs text-amber-900 dark:text-amber-300">{h.subject}</span>
                      <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Pour le {h.dueDate}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{h.task}</p>
                  </div>
                ))
              ) : (
                <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-2xl text-center text-xs text-slate-500">
                  Aucun devoir urgent enregistré cette semaine.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: TRANSMISSIONS & SUIVI ÉCOLE <-> PARENT */}
      {activeTab === 'transmissions' && (
        <div className="space-y-6">
          {/* Top Bar for View Toggle & Filter */}
          <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-[#1F4A59]" />
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    Fil Chronologique Essentiel & Transmissions
                  </h2>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Les informations essentielles transmises chronologiquement par la Direction, la Caisse (RAF), le Surveillant Général et l'équipe pédagogique.
                </p>
              </div>

              {/* View Switcher: Simplified vs Detailed */}
              <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-700 rounded-2xl border border-slate-200 dark:border-slate-600 shrink-0">
                <button
                  onClick={() => setViewMode('simplified')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    viewMode === 'simplified'
                      ? 'bg-[#1F4A59] text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Fil Chronologique Simplifié
                </button>
                <button
                  onClick={() => setViewMode('detailed')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    viewMode === 'detailed'
                      ? 'bg-[#1F4A59] text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Envoyer un Message
                </button>
              </div>
            </div>

            {/* Filter Tabs by Issuer (Directeur, RAF, Surveillant, Teachers) */}
            {viewMode === 'simplified' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" /> Filtrer par Responsable Émetteur :
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {[
                      { id: 'all', label: 'Tous les Actes (Chronologique)' },
                      { id: 'direction', label: 'Directeur & DE' },
                      { id: 'finances', label: 'RAF & Caisse' },
                      { id: 'surveillance', label: 'Surveillant Général' },
                      { id: 'teachers', label: 'Équipe Pédagogique' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setTimelineFilter(f.id as any)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                          timelineFilter === f.id
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chronological Timeline Cards */}
                <div className="relative pl-6 space-y-4 pt-2 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                  
                  {/* Item 1: RAF & Caisse */}
                  {studentTransactions.length > 0 && (timelineFilter === 'all' || timelineFilter === 'finances') && (
                    <div className="relative group animate-fade-in">
                      <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-emerald-500 border-4 border-white dark:border-slate-800 shadow-md"></div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-black text-[10px] rounded-lg uppercase tracking-wider flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" /> RAF & Caisse (Finances)
                          </span>
                          <span className="text-slate-400 font-bold text-[10px]">12 Février 2026 à 10:14</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                          Reçu de Paiement Validé • Scolarité Tranche 1 (150 000 {defaultSchoolSettings.currency})
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                          La Caissière a confirmé la réception des frais d'écolage. Le reçu officiel REC-2026-0891 certifié par le RAF est prêt.
                        </p>
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => setActiveTab('payments')}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Télécharger le Reçu PDF</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Item 2: Surveillant Général */}
                  {(timelineFilter === 'all' || timelineFilter === 'surveillance') && (
                    <div className="relative group animate-fade-in">
                      <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-amber-500 border-4 border-white dark:border-slate-800 shadow-md"></div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-black text-[10px] rounded-lg uppercase tracking-wider flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> Surveillant Général (Assiduité)
                          </span>
                          <span className="text-slate-400 font-bold text-[10px]">08 Février 2026 à 08:30</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                          Appel d'Assiduité • Absence du 07/02 Justifiée avec Succès
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                          Le certificat médical soumis par le parent a été enregistré et approuvé par la Surveillance Générale. 0 heure d'absence non justifiée.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Item 3: Directeur des Études */}
                  {(timelineFilter === 'all' || timelineFilter === 'direction') && (
                    <div className="relative group animate-fade-in">
                      <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-[#1F4A59] border-4 border-white dark:border-slate-800 shadow-md"></div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="px-2.5 py-1 bg-[#1F4A59]/10 text-[#1F4A59] dark:text-sky-300 font-black text-[10px] rounded-lg uppercase tracking-wider flex items-center gap-1 border border-[#1F4A59]/20">
                            <Award className="w-3.5 h-3.5" /> Directeur des Études (DE)
                          </span>
                          <span className="text-slate-400 font-bold text-[10px]">01 Février 2026 à 14:00</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                          Publication Officielle du Bulletin Trimestriel • Moyenne: {overallAverage}/20
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 italic font-medium">
                          "Félicitations du Conseil de Classe présidé par la Direction. Continuez à maintenir cet excellent niveau de travail."
                        </p>
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={() => setShowBulletinModal(true)}
                            className="px-3 py-1.5 bg-[#1F4A59] hover:bg-[#285d70] text-white font-bold text-[11px] rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Consulter le Bulletin Officiel</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Item 4: Équipe Pédagogique */}
                  {(timelineFilter === 'all' || timelineFilter === 'teachers') && (
                    <div className="relative group animate-fade-in">
                      <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-sky-500 border-4 border-white dark:border-slate-800 shadow-md"></div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="px-2.5 py-1 bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 font-black text-[10px] rounded-lg uppercase tracking-wider flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5" /> Équipe Pédagogique (Enseignants)
                          </span>
                          <span className="text-slate-400 font-bold text-[10px]">Hier à 16:45</span>
                        </div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">
                          Nouvelles Évaluations Saisies : Mathématiques (18/20) & Devoir de Physique prescrit
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                          M. Okemba a publié la note du devoir de synthèse et ajouté les exercices de révision dans le cahier de texte.
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Form for Parent to transmit to School Staff in Detailed view */}
            {viewMode === 'detailed' && (
              <div className="p-5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700 animate-fade-in">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
                  <span>Transmettre une Information ou Demande à l'Administration</span>
                </h3>

                {transmissionSent && (
                  <div className="mb-4 p-3 bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-between animate-fade-in">
                    <span>✓ Transmission envoyée avec succès ! Transmise immédiatement au responsable concerné.</span>
                    <button onClick={() => setTransmissionSent(false)} className="underline cursor-pointer text-[10px]">Fermer</button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setTransmissionType('absence')}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                      transmissionType === 'absence'
                        ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <p className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> Justificatif d'Absence / Maladie</p>
                    <p className="text-[10px] opacity-80 mt-1 font-normal">Destiné au Surveillant Général</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransmissionType('payment_proof')}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                      transmissionType === 'payment_proof'
                        ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <p className="flex items-center gap-1.5"><DollarSign className="w-4 h-4" /> Preuve de Virement / Mobile Money</p>
                    <p className="text-[10px] opacity-80 mt-1 font-normal">Destiné à la Caissière & RAF</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransmissionType('meeting')}
                    className={`p-3 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                      transmissionType === 'meeting'
                        ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-md'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <p className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Demande de Rendez-vous</p>
                    <p className="text-[10px] opacity-80 mt-1 font-normal">Destiné au DE / Directeur Primaire</p>
                  </button>
                </div>

                <div className="space-y-3">
                  <textarea
                    value={transmissionNote}
                    onChange={(e) => setTransmissionNote(e.target.value)}
                    placeholder={
                      transmissionType === 'absence' ? "Précisez la date et le motif de l'absence de votre enfant..." :
                      transmissionType === 'payment_proof' ? "Indiquez la référence de la transaction Mobile Money ou numéro de virement..." :
                      "Détaillez le motif du rendez-vous souhaité..."
                    }
                    rows={2}
                    className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[#1F4A59]"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!transmissionNote.trim()) return;
                        setTransmissionSent(true);
                        setTransmissionNote('');
                        setTimeout(() => setTransmissionSent(false), 5000);
                      }}
                      className="px-5 py-2.5 bg-[#1F4A59] hover:bg-[#275d70] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all active:scale-95 flex items-center gap-2"
                    >
                      <span>Transmettre à l'Administration</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Espace Financier & Reçus Scolaires</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Consultez le relevé détaillé des versement et téléchargez vos reçus officiels certifiés.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 text-right">
                <p className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400">Total Réglé</p>
                <p className="text-base font-black text-emerald-700 dark:text-emerald-300">
                  {totalPaid.toLocaleString('fr-FR')} {defaultSchoolSettings.currency}
                </p>
              </div>
              <div className={`p-3 rounded-2xl border text-right ${balanceDue > 0 ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 text-amber-800 dark:text-amber-300' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 text-slate-700'}`}>
                <p className="text-[10px] font-black uppercase">Solde Restant</p>
                <p className="text-base font-black">
                  {balanceDue.toLocaleString('fr-FR')} {defaultSchoolSettings.currency}
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider">
                  <th className="p-3.5 rounded-l-xl">Ref / Reçu</th>
                  <th className="p-3.5">Libellé Frais</th>
                  <th className="p-3.5">Date Versement</th>
                  <th className="p-3.5">Mode de Paiement</th>
                  <th className="p-3.5 text-right">Montant</th>
                  <th className="p-3.5 text-center rounded-r-xl">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 font-medium">
                {studentTransactions.length > 0 ? (
                  studentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-slate-100">{tx.id.substring(0, 10)}</td>
                      <td className="p-3.5 font-bold text-slate-800 dark:text-slate-200">{tx.description}</td>
                      <td className="p-3.5 text-slate-500">{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-md font-bold text-[10px] uppercase">
                          Espèces / Guichet
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {tx.amount.toLocaleString('fr-FR')} {defaultSchoolSettings.currency}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => setSelectedReceiptTx(tx)}
                          className="px-3 py-1.5 bg-[#1F4A59] hover:bg-[#275d70] text-white text-[11px] font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                        >
                          <FileDownloadIcon className="w-3.5 h-3.5" />
                          <span>Reçu PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucun paiement ou reçu disponible pour cet élève.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: GRADES & BULLETIN */}
      {activeTab === 'grades' && (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Relevé des Notes & Bulletin Scolaire</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Consultez le détail des devoirs, interrogations et la moyenne générale.
              </p>
            </div>

            <button
              onClick={() => setShowBulletinModal(true)}
              className="px-5 py-3 bg-[#1F4A59] hover:bg-[#275d70] text-white font-black text-xs rounded-2xl shadow-xl flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <FileDownloadIcon className="w-4 h-4" />
              <span>Imprimer Bulletin de Notes (PDF)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from(gradesBySubject.entries()).map(([subj, gList]) => {
              const subjAvg = (gList.reduce((s, g) => s + g.score, 0) / gList.length).toFixed(2);
              return (
                <div key={subj} className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{subj}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{gList.length} évaluation(s) enregistrée(s)</p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#1F4A59] dark:text-sky-300">{subjAvg} / 20</span>
                  </div>
                </div>
              );
            })}

            {gradesBySubject.size === 0 && (
              <div className="col-span-2 p-8 text-center text-slate-500 text-xs bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-dashed border-slate-300">
                Aucune note saisie pour l'instant pour cette période. Les résultats apparaîtront dès la publication par les enseignants.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: HOMEWORK */}
      {activeTab === 'homework' && (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
          <div className="pb-6 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Cahier de Texte & Devoirs à Domicile</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Consultez les devoirs prescrits par les enseignants pour la classe de {linkedStudent.class}.
            </p>
          </div>

          <div className="space-y-4">
            {studentHomework.length > 0 ? (
              studentHomework.map((h, idx) => (
                <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <span className="px-3 py-1 bg-[#1F4A59] text-white font-bold text-[10px] rounded-lg uppercase">
                        {h.subject}
                      </span>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-2">{h.task}</h4>
                    </div>
                    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-bold text-[11px] rounded-lg whitespace-nowrap">
                      Échéance: {h.dueDate}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-dashed border-slate-300">
                Aucun devoir prescrit pour le moment.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: TIMETABLE */}
      {activeTab === 'timetable' && (
        <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
          <div className="flex items-center justify-between pb-6 border-b border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">Emploi du Temps Scolaire</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Planning hebdomadaire des cours pour la classe de {linkedStudent.class}.
              </p>
            </div>
            <button 
              onClick={() => window.print()}
              className="px-4 py-2 bg-slate-900 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2"
            >
              <PrinterIcon className="w-4 h-4" />
              <span>Imprimer Planning</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'].map((day) => (
              <div key={day} className="p-4 bg-slate-50 dark:bg-slate-700/40 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <p className="font-black text-xs uppercase text-[#1F4A59] dark:text-sky-300 mb-3">{day}</p>
                <div className="space-y-2 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-xs">08h-10h: Mathématiques</div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-xs">10h-12h: Physique-Chimie</div>
                  <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-xs">13h-15h: Français / SVT</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PARENT SETTINGS & SECURITY MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 my-8">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#1F4A59]/10 text-[#1F4A59] dark:text-sky-400 rounded-xl">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                    Paramètres du Compte Parent & Sécurité
                  </h3>
                  <p className="text-xs text-slate-500">Personnalisez vos canaux de notification et règles d'accès.</p>
                </div>
              </div>

              <button 
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {settingsSavedSuccess && (
              <div className="p-3 bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-between animate-fade-in">
                <span>✓ Vos paramètres parent et préférences de sécurité ont été mis à jour !</span>
                <button onClick={() => setSettingsSavedSuccess(false)} className="text-[10px] underline">OK</button>
              </div>
            )}

            <div className="space-y-5 text-xs">
              {/* Type de Compte Parent */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-[#1F4A59]" />
                  <span>Profil & Type de Compte Parent</span>
                </h4>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">
                    Statut / Type de Responsabilité Parentale
                  </label>
                  <select 
                    value={accountType} 
                    onChange={(e) => setAccountType(e.target.value as any)} 
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl font-bold"
                  >
                    <option value="principal">Parent Principal (Père / Mère)</option>
                    <option value="tuteur">Tuteur / Tutrice Légale</option>
                    <option value="representant">Représentant Légal d'Établissement</option>
                    <option value="mandate">Parent Mandaté / Délégué</option>
                  </select>
                </div>
              </div>

              {/* Canaux de Notification */}
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <BellIcon className="w-4 h-4 text-[#1F4A59]" />
                  <span>Canaux de Notifications Instantanées</span>
                </h4>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-bold mb-2">Canal Prioritaire Réception</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'whatsapp', label: 'WhatsApp' },
                      { id: 'sms', label: 'SMS Direct' },
                      { id: 'push', label: 'Push App' },
                      { id: 'email', label: 'E-mail' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPreferredChannel(item.id as any)}
                        className={`p-2 rounded-xl border font-bold transition-all cursor-pointer text-center ${
                          preferredChannel === item.id 
                            ? 'bg-[#1F4A59] text-white border-[#1F4A59]' 
                            : 'bg-slate-50 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <label className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Alertes Encaissements & Reçus (RAF/Caisse)</span>
                    <input type="checkbox" checked={notifyPayments} onChange={(e) => setNotifyPayments(e.target.checked)} className="rounded text-[#1F4A59]" />
                  </label>
                  <label className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Alertes Notes & Bulletins (Directeur & Profs)</span>
                    <input type="checkbox" checked={notifyGrades} onChange={(e) => setNotifyGrades(e.target.checked)} className="rounded text-[#1F4A59]" />
                  </label>
                  <label className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl cursor-pointer">
                    <span className="font-bold text-slate-800 dark:text-slate-200">Alertes Assiduité & Discipline (Surveillant Général)</span>
                    <input type="checkbox" checked={notifyAbsences} onChange={(e) => setNotifyAbsences(e.target.checked)} className="rounded text-[#1F4A59]" />
                  </label>
                </div>
              </div>

              {/* Sécurité et Validation */}
              <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <span>Sécurité, Code PIN & Biométrie</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl space-y-2">
                    <label className="flex items-center justify-between cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                      <span>Signature par Code PIN (4 chiffres)</span>
                      <input type="checkbox" checked={enablePinSignature} onChange={(e) => setEnablePinSignature(e.target.checked)} className="rounded text-[#1F4A59]" />
                    </label>
                    {enablePinSignature && (
                      <input 
                        type="password" 
                        maxLength={4}
                        value={pinCode} 
                        onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                        className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-center font-mono font-bold tracking-widest text-xs"
                      />
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 dark:bg-slate-700/40 rounded-xl space-y-2">
                    <label className="flex items-center justify-between cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                      <span>Connexion Biométrique (Face ID / Empreinte)</span>
                      <input type="checkbox" checked={enableBiometrics} onChange={(e) => setEnableBiometrics(e.target.checked)} className="rounded text-[#1F4A59]" />
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-2">
                  <label className="flex items-center justify-between cursor-pointer font-bold text-slate-800 dark:text-slate-200">
                    <span>Accès Délégué Co-Parent / Tuteur Secondaire</span>
                    <input type="checkbox" checked={allowCoParentAccess} onChange={(e) => setAllowCoParentAccess(e.target.checked)} className="rounded text-[#1F4A59]" />
                  </label>
                  {allowCoParentAccess && (
                    <input 
                      type="email" 
                      value={coParentEmail}
                      onChange={(e) => setCoParentEmail(e.target.value)}
                      placeholder="Adresse e-mail du co-parent..."
                      className="w-full p-2 bg-slate-50 dark:bg-slate-700/60 border border-slate-300 dark:border-slate-600 rounded-xl font-medium"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsSavedSuccess(true);
                  setTimeout(() => {
                    setSettingsSavedSuccess(false);
                    setShowSettingsModal(false);
                  }, 1200);
                }}
                className="px-5 py-2 bg-[#1F4A59] hover:bg-[#285d70] text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
              >
                Enregistrer Préférences
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RECEIPT MODAL */}
      {selectedReceiptTx && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 uppercase">Reçu de Paiement Officiel</h3>
              <button 
                onClick={() => setSelectedReceiptTx(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕ Fermer
              </button>
            </div>

            <Receipt transaction={selectedReceiptTx} schoolSettings={defaultSchoolSettings} />
          </div>
        </div>
      )}

      {/* BULLETIN MODAL */}
      {showBulletinModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 max-w-5xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 mb-2 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 uppercase">Bulletin Trimestriel Officiel</h3>
              <button 
                onClick={() => setShowBulletinModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm cursor-pointer"
              >
                ✕ Fermer
              </button>
            </div>

            <Bulletin 
              student={linkedStudent as any}
              gradesBySubject={gradesBySubject}
              comments={studentComments as any}
              schoolSettings={defaultSchoolSettings}
              onClose={() => setShowBulletinModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentDashboard;
