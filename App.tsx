import { simulateBrevoSend } from "./utils/communications";


import React, { useState, useEffect, useCallback } from 'react';
import AdminSpecialLoginPage from './components/AdminSpecialLoginPage';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import OtpValidationPage from './components/OtpValidationPage';
import SchoolOverview from './components/SchoolOverview';
import CashierDashboard from './components/CashierDashboard';
import FinanceManagerDashboard from './components/FinanceManagerDashboard';
import PromoterDashboard from './components/PromoterDashboard';
import UserManagementPage from './components/UserManagementPage';
import PaymentsPage from './components/PaymentsPage';
import PersonnelPage from './components/PersonnelPage';
import FinancialReportsPage from './components/FinancialReportsPage';
import TeacherClassesPage from './components/TeacherClassesPage';
import SchoolStructurePage from './components/SchoolStructurePage';
import PricingPage from './components/PricingPage';
import TeacherDashboard from './components/TeacherDashboard';
import GradesManagementPage from './components/TeacherGradesPage';
import StudentDashboard from './components/StudentDashboard';
import ParentDashboard from './components/ParentDashboard';
import StudentGradesPage from './components/StudentGradesPage';
import StudentPaymentsPage from './components/StudentPaymentsPage';
import NotificationBell from './components/NotificationBell';
import MessagingPanel from './components/MessagingPanel';
import MessagingCenter from './components/MessagingCenter';
import OperationsValidationPage from './components/OperationsValidationPage';
import AccountingPage from './components/AccountingPage';
import AuditPage from './components/AuditPage';
import SettingsPage from './components/SettingsPage';
import TimetablePage from './components/TimetablePage';
import HomeworkDiaryPage from './components/HomeworkDiaryPage';
import DEDashboard from './components/DEDashboard';
import SubjectsManagementPage from './components/SubjectsManagementPage';
import StudentListPage from './components/StudentListPage';
import StudentProfilePage from './components/StudentProfilePage';
import FinancialCalendar from './components/FinancialCalendar'; // New
import AlertDialogModal from './components/AlertDialogModal';
import MobileBottomNav from './components/MobileBottomNav';
import MobileQuickSearchModal from './components/MobileQuickSearchModal';
import { PasskeyRegisterPromptModal } from './components/auth/PasskeyRegisterPromptModal';
import { isWebAuthnSupported, fetchUserDevices } from './src/services/webauthnService';
import { deliverParentPaymentReceipt, buildParentReceiptMessage } from './utils/parentReceiptDelivery';

import { MenuIcon, SearchIcon, MoonIcon, SunIcon, ChatIcon, LogoIcon } from './components/Icons';
import { 
  usersData as initialUsers, 
  studentPaymentsData as initialPayments,
  personnelData as initialPersonnel,
  transactionsData as initialTransactions,
  budgetData as initialBudget,
  topClassesData as initialTopClasses,
  initialNotifications,
  initialMessages,
  initialAcademicYear,
  initialClassesData,
  initialFeesData,
  initialSubjectsData,
  initialGradesData,
  initialAttendanceData,
  initialActivityLog,
  initialSchoolSettings,
  initialMessageTemplates,
  initialCashierSettings,
  initialRafSettings, initialCommunicationSettings,
  initialTimetableData,
  initialHomeworkDiaryData,
  initialReportCardCommentsData,
  initialFinancialEvents
} from './constants';
import { User } from './components/UserForm';
import { Class } from './components/ClassForm';
import { Fee } from './components/FeeForm';
import { Grade } from './components/GradeForm';
import { Subject } from './components/SubjectForm';
import { TimetableEntry } from './components/TimetablePage';
import { HomeworkDiaryEntry } from './components/HomeworkDiaryPage';
import { ReportCardComments } from './components/ReportCardCommentsForm';
import OfflineSyncStatus from './components/OfflineSyncStatus';
import { loadOfflineData, saveOfflineData, queueOfflineOperation } from './utils/offlineStorage';
import { compressBase64Image } from './utils/imageCompressor';
import { getSupabaseClient, getStoredSupabaseConfig } from './src/lib/supabase';
import { purgeSupabaseDirectly, purgeSchoolSupabaseDirectly, deleteUserFromSupabaseDirectly, saveActivityLogToSupabaseDirectly, fetchActivityLogsFromSupabaseDirectly } from './src/lib/supabaseSeeder';
import { getApiUrl } from './src/lib/apiConfig';
import { getCurrentUser, findUserByEmail, getSchoolSettings, saveUserToDb, deleteUserFromDb, deleteSchoolFromDb, saveActivityLogToDb, fetchActivityLogsFromDb, checkDbConnection, syncInitialData, fetchCurrentSubscription, SchoolSubscriptionInfo, fetchAdminExportData, fetchAdminRegisteredSchools, saveTransactionToDb, savePaymentToDb, updateTransactionStatusInDb, savePersonnelToDb, saveClassToDb, saveFeeToDb, saveGradeToDb, sendMessageToDb, checkInterSchoolStudentDebt, fetchNotificationsFromDb, dispatchNotificationToRoles, markNotificationAsReadInDb, markAllNotificationsAsReadInDb, deleteNotificationFromDb, clearNotificationsInDb } from './src/services/api';
import { DbStatus } from './src/services/api';
import { Database, CheckCircle2, User as UserIcon, Camera, Settings, LogOut, Shield, ChevronDown, Lock, Zap, Sparkles, Key, ShieldCheck, X, AlertCircle, AlertTriangle } from 'lucide-react';
import LockedFeatureGuard from './components/LockedFeatureGuard';
import SubscriptionModal from './components/SubscriptionModal';
import AdminSubscriptionHub from './components/AdminSubscriptionHub';
import AdminSchoolsDirectory from './components/AdminSchoolsDirectory';
import ParentSurveysHub from './components/ParentSurveysHub';
import AdminDashboard from './components/AdminDashboard';
import AdminSupabaseConsole from './components/AdminSupabaseConsole';
import AdminBackupsPage from './components/AdminBackupsPage';
import AdminAttendanceAnalyticsPage from './components/AdminAttendanceAnalyticsPage';
import AdminFinancialSurveillancePage from './components/AdminFinancialSurveillancePage';
import AdminRevenuesExpensesPage from './components/AdminRevenuesExpensesPage';
import AdminBroadcastMessagingPage from './components/AdminBroadcastMessagingPage';
import AdminAIManagerPage from './components/AdminAIManagerPage';
import AdminDiagnosticPage from './components/AdminDiagnosticPage';

export interface Personnel {
  id: number | null;
  name: string;
  role: string;
  baseSalary: number;
  lastPaymentDate: string;
  primes: { id: string; description: string; amount: number; }[];
  deductions: { id: string; description: string; amount: number; }[];
  familyId?: number;
  // New fields for payslip
  matricule?: string;
  cnss?: string;
  qualification?: string;
  typePersonnel?: string;
  hireDate?: string;
  direction?: string;
  category?: string;
  bankAccount?: string;
  maritalStatus?: string;
  residence?: string;
  childrenCount?: number;
  paymentMethod?: string;
  avatar?: string;
}
type AcademicYear = typeof initialAcademicYear;
type AttendanceRecord = { studentId: number; status: 'Présent' | 'Absent' | 'En Retard'; };
export type Transaction = (typeof initialTransactions[0]) & { 
    justification?: string | File;
    paymentMethod?: 'Espèce' | 'Mobile Money';
    mobileMoneyNumber?: string;
    notes?: string;
    approvedBy?: string;
    approvedAt?: string;
};
export type ActivityLog = typeof initialActivityLog[0];
export type SchoolSettings = typeof initialSchoolSettings;
type MessageTemplate = typeof initialMessageTemplates[0];
type CashierSettings = typeof initialCashierSettings;
export type RafSettings = typeof initialRafSettings;
export type CommunicationSettings = typeof initialCommunicationSettings;

// FIX: Moved FinancialEvent interface here and exported it to fix import errors.
export interface FinancialEvent {
  id?: string;
  title: string;
  start: string; // ISO string date
  end: string;   // ISO string date
  allDay?: boolean;
  type?: 'payment' | 'deadline' | 'other';
}

export interface SalaryPaymentData {
  netAmount: number;
  details: any; // Can be more specific if needed
}

// New type for single detailed payment
export interface SinglePaymentData {
    studentId?: number;
    amount: number;
    paymentMethod: string;
    mobileMoneyNumber?: string;
    notes?: string;
    paymentType?: 'Frais Mensuels' | 'Inscription' | 'Réinscription' | 'Frais de dossier d\'examen' | string;
    sendReceiptCopyToParent?: boolean;
    parentReceiptPhone?: string;
    parentReceiptEmail?: string;
    parentReceiptName?: string;
    newStudentData?: {
        name: string;
        class: string;
        dob?: string;
        gender?: string;
        contact?: string;
        address?: string;
        avatar?: string;
        classeAnterieure?: string;
        isAncienEleve?: boolean;
        bilingue?: boolean;
        matricule?: string;
        parentTuteur?: string;
        piecesJointes?: string;
        freresSoeurs?: string;
    };
    isLargeFamily?: boolean;
    familyNameOrSiblings?: string;
    examClass?: string;
    classeAnterieure?: string;
    isAncienEleve?: boolean;
    bilingue?: boolean;
    matricule?: string;
    parentTuteur?: string;
    piecesJointes?: string;
    freresSoeurs?: string;
}

export type { SchoolSubscriptionInfo };

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [pendingOtpUser, setPendingOtpUser] = useState<User | null>(null);
  const [otpVerified, setOtpVerified] = useState(() => sessionStorage.getItem('otpVerified') === 'true');
  const loggedInRole = currentUser?.role || null;
  const currentUserId = currentUser?.id || null;
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inactivity Timeout Management (Default 5 minutes = 300 seconds)
  const [inactivityTimeoutMinutes, setInactivityTimeoutMinutes] = useState<number>(() => {
    const stored = localStorage.getItem('EDUCO_INACTIVITY_TIMEOUT_MINUTES');
    return stored !== null ? Number(stored) : 5;
  });
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);
  const [passkeyPromptUser, setPasskeyPromptUser] = useState<{ email: string; userId?: string; name?: string } | null>(null);
  const lastActivityRef = React.useRef<number>(Date.now());

  useEffect(() => {
    const initSupabaseAuth = async () => {
      try {
        const { url } = getStoredSupabaseConfig();
        let sessionEmail: string | null = null;
        if (url && !url.includes('demo-educo.supabase.co') && !url.includes('your-project.supabase.co')) {
          const supabase = getSupabaseClient();
          try {
            const sessionRes = await Promise.race([
              supabase.auth.getSession(),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000))
            ]) as any;
            if (sessionRes?.data?.session?.user?.email) {
              sessionEmail = sessionRes.data.session.user.email;
            }
          } catch (err) {
            console.warn('Supabase getSession timeout/error in init:', err);
          }
        }
        
        // REQUIREMENT 1: Ensure login page is the first screen when app starts/launches
        const isSessionActive = sessionStorage.getItem('EDUCO_SESSION_ACTIVE') === 'true';
        if (!isSessionActive) {
          setCurrentUser(null);
          setLoadingAuth(false);
          setLoading(false);
          return;
        }

        // Check stored local user or fetch from backend API
        const savedUserJson = localStorage.getItem('EDUCO_CURRENT_USER');
        if (savedUserJson) {
          try {
            const parsedUser = JSON.parse(savedUserJson);
            if (!otpVerified) {
              setPendingOtpUser(parsedUser);
            } else {
              setCurrentUser(parsedUser);
              const schoolResult = await getSchoolSettings();
              if (schoolResult) {
                setSchoolSettings(schoolResult);
              }
            }
            setLoadingAuth(false);
            setLoading(false);
            return;
          } catch (e) {}
        }

        // If session email exists, search Supabase DB users table
        if (sessionEmail && url && !url.includes('demo-educo.supabase.co')) {
          try {
            const supabase = getSupabaseClient();
            const { data: dbUsers } = await supabase.from('users').select('*').ilike('email', sessionEmail);
            if (dbUsers && dbUsers.length > 0) {
              const row = dbUsers[0];
              const sbUser = {
                id: row.id,
                uid: row.uid || `usr_${row.id}`,
                name: row.name || sessionEmail.split('@')[0],
                email: row.email || sessionEmail,
                role: row.role || 'Admin',
                schoolId: row.school_id || row.schoolId || 1,
                status: row.status || 'active',
                avatar: row.avatar,
                permissions: row.permissions,
              };
              localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(sbUser));
              if (!otpVerified) {
                setPendingOtpUser(sbUser);
              } else {
                setCurrentUser(sbUser);
              }
              setLoadingAuth(false);
              setLoading(false);
              return;
            }
          } catch (e) {}
        }

        const userResult = await getCurrentUser();
        if (userResult?.user) {
          localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(userResult.user));
          if (!otpVerified) {
            setPendingOtpUser(userResult.user);
          } else {
            setCurrentUser(userResult.user);
            const schoolResult = await getSchoolSettings();
            if (schoolResult) {
              setSchoolSettings(schoolResult);
            }
          }
        }
      } catch (err) {
        // Quiet fallback
      } finally {
        setLoadingAuth(false);
        setLoading(false);
      }
    };

    initSupabaseAuth();
  }, [otpVerified]);

  // REQUIREMENT 2 & 3: Global Inactivity Monitor
  useEffect(() => {
    if (!currentUser) return;

    lastActivityRef.current = Date.now();

    const handleUserInteraction = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 1000) {
        lastActivityRef.current = now;
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(evt => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    const checkInterval = setInterval(() => {
      if (!currentUser || inactivityTimeoutMinutes <= 0) return;

      const elapsedMs = Date.now() - lastActivityRef.current;
      const elapsedMinutes = elapsedMs / (1000 * 60);

      if (elapsedMinutes >= inactivityTimeoutMinutes) {
        const msg = `Vous avez été déconnecté automatiquement suite à une inactivité de ${inactivityTimeoutMinutes} minute(s) pour protéger vos données.`;
        handleLogout();
        setInactivityNotice(msg);
      }
    }, 5000);

    return () => {
      activityEvents.forEach(evt => {
        window.removeEventListener(evt, handleUserInteraction);
      });
      clearInterval(checkInterval);
    };
  }, [currentUser, inactivityTimeoutMinutes]);

  const handleLogin = async (email: string, password: string, isBiometric: boolean = false) => {
    // 1. Verify email formatting before sending
    const trimmedEmail = (email || '').trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!trimmedEmail) {
      return { success: false, error: 'Veuillez saisir une adresse email.' };
    }
    if (!emailRegex.test(trimmedEmail)) {
      return { success: false, error: "Le format de l'adresse email est incorrect. Exemple: utilisateur@domaine.com" };
    }
    if (!isBiometric && (!password || password.trim().length < 4)) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 4 caractères.' };
    }

    try {
      let loggedUser: any = null;
      let authData: any = null;
      let backendToken = '';
      let backendError = '';
      let backendUnavailable = false;
      const isAdminPortal = activePage === 'AdminSpecialLogin';

      // 1. Try unified Backend Login API (/api/auth/login)
      try {
        const supabaseConfig = getStoredSupabaseConfig();
        const loginHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (supabaseConfig.url && !supabaseConfig.url.includes('your-project.supabase.co')) {
          loginHeaders['x-supabase-url'] = supabaseConfig.url;
        }
        if (supabaseConfig.key && !supabaseConfig.key.includes('placeholder')) {
          loginHeaders['x-supabase-key'] = supabaseConfig.key;
        }
        const loginRes = await fetch(getApiUrl('/api/auth/login'), {
          method: 'POST',
          headers: loginHeaders,
          body: JSON.stringify({
            email: trimmedEmail,
            password: password,
            isBiometric: isBiometric,
            isAdminPortal: isAdminPortal
          })
        });

        const resData = await loginRes.json().catch(() => null);
        if (loginRes.ok) {
          if (resData.success && resData.user) {
            loggedUser = resData.user;
            backendToken = resData.token || '';
          } else {
            backendUnavailable = true;
          }
        } else {
          // Keep explicit access denials, but allow a direct Supabase attempt when
          // the API service itself is unavailable or returned an invalid response.
          if (resData && resData.error) {
            backendError = resData.error;
          }
          backendUnavailable = loginRes.status >= 500 || !resData;
        }
      } catch (backendErr) {
        console.warn('Backend login endpoint check error:', backendErr);
        backendUnavailable = true;
      }

      // 2. If the API cannot be reached, authenticate directly with Supabase.
      // A row in public.users alone is not sufficient: a valid Auth session is
      // required before the profile is accepted.
      if (!loggedUser) {
        const { url } = getStoredSupabaseConfig();
        if (url && !url.includes('demo-educo.supabase.co') && !url.includes('your-project.supabase.co')) {
          try {
            const supabase = getSupabaseClient();
            if (!isBiometric) {
              const res = await supabase.auth.signInWithPassword({
                email: trimmedEmail,
                password: password
              });

              authData = res.data;
              if (res.data?.session?.user && !res.error) {
                const { data: dbU, error: profileError } = await supabase
                  .from('users')
                  .select('*')
                  .ilike('email', trimmedEmail)
                  .maybeSingle();

                if (dbU && !profileError) {
                  loggedUser = {
                    id: dbU.id,
                    uid: dbU.uid || res.data.user.id,
                    name: dbU.name || trimmedEmail.split('@')[0],
                    email: dbU.email || trimmedEmail,
                    role: dbU.role || 'Personnel',
                    schoolId: dbU.school_id || dbU.schoolId || 1,
                    status: dbU.status || 'active',
                    avatar: dbU.avatar,
                    permissions: dbU.permissions,
                    contact: dbU.contact,
                    address: dbU.address
                  };
                } else {
                  backendError = 'Compte authentifié, mais son profil utilisateur est introuvable dans la base EDUCO.';
                }
              }
            }
          } catch (sbErr) {
            console.warn('Supabase login check:', sbErr);
          }
        }
      }

      // 3. Check local users array state
      if (!loggedUser && users && users.length > 0) {
        const localMatch = users.find((u: any) => u.email?.toLowerCase() === trimmedEmail.toLowerCase());
        if (localMatch) {
          loggedUser = localMatch;
        }
      }

      // 4. Fallback search via findUserByEmail API
      if (!loggedUser) {
        const result = await findUserByEmail(trimmedEmail);
        if (result?.user) {
          loggedUser = result.user;
        }
      }

      // Strict enforcement of recognized accounts only (no generic fallbacks for unrecognized emails/biometrics)
      if (!loggedUser) {
        return { 
          success: false, 
          error: backendError || (backendUnavailable
            ? "Service d'authentification indisponible. Vérifiez la connexion Supabase puis réessayez."
            : 'Identifiants invalides. Vérifiez votre e-mail et votre mot de passe.')
        };
      }

      // Double-check: Rule that admin cannot log in from the standard homepage interface
      if ((loggedUser.role === 'Admin' || loggedUser.role === 'Co-admin') && !isAdminPortal) {
        return {
          success: false,
          error: "Accès refusé : L'administrateur n'est pas autorisé à se connecter depuis la page d'accueil. Veuillez utiliser le portail d'administration dédié."
        };
      }
      if (isAdminPortal && loggedUser.role !== 'Admin' && loggedUser.role !== 'Co-admin') {
        return {
          success: false,
          error: "Accès refusé : ce portail est réservé aux administrateurs et co-administrateurs."
        };
      }

      if (loggedUser) {
        sessionStorage.setItem('EDUCO_SESSION_ACTIVE', 'true');
        setInactivityNotice(null);
        localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(loggedUser));
        if (backendToken) {
          localStorage.setItem('EDUCO_USER_TOKEN', backendToken);
        } else if (authData?.session?.access_token) {
          localStorage.setItem('EDUCO_USER_TOKEN', authData.session.access_token);
        } else {
          localStorage.setItem('EDUCO_USER_TOKEN', trimmedEmail);
        }
        if (!otpVerified) {
          setPendingOtpUser(loggedUser);
          setActivePage('Tableau de bord');
        } else {
          setCurrentUser(loggedUser);
          setActivePage('Tableau de bord');
        }

        // Check if user logged in with password and can register a biometric passkey
        if (!isBiometric && isWebAuthnSupported() && loggedUser.email) {
          fetchUserDevices(loggedUser.email).then(devs => {
            if (devs.length === 0) {
              setPasskeyPromptUser({
                email: loggedUser.email,
                userId: loggedUser.uid || String(loggedUser.id),
                name: loggedUser.name
              });
            }
          }).catch(() => {});
        }

        return { success: true };
      }
      
      return { 
        success: false, 
        error: 'Identifiants incorrects. Veuillez vérifier votre adresse e-mail et mot de passe.' 
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Une erreur inattendue est survenue.' };
    }
  };

  const handleLogout = async () => {
    try {
      const { url } = getStoredSupabaseConfig();
      if (url && !url.includes('demo-educo.supabase.co')) {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut().catch(() => {});
      }
    } catch (error) {}
    localStorage.removeItem('EDUCO_CURRENT_USER');
    localStorage.removeItem('EDUCO_USER_TOKEN');
    sessionStorage.removeItem('EDUCO_SESSION_ACTIVE');
    setCurrentUser(null);
    setPendingOtpUser(null);
    setOtpVerified(false);
    sessionStorage.removeItem('otpVerified');
  };

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('Tableau de bord');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [viewingStudentId, setViewingStudentId] = useState<number | null>(null); // New state for student profile view

  const [telemetry, setTelemetry] = useState<{
    ipAddress: string;
    location: string;
    device: string;
    browser: string;
  }>({
    ipAddress: '',
    location: '',
    device: '',
    browser: '',
  });

  useEffect(() => {
    const getBrowserAndDevice = () => {
      const ua = navigator.userAgent;
      let browser = 'Inconnu';
      let device = 'PC / Terminal';

      if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Edge')) browser = 'Edge';
      else if (ua.includes('Opera')) browser = 'Opera';

      if (ua.includes('Mobi')) {
        if (ua.includes('iPhone')) device = 'iPhone';
        else if (ua.includes('Android')) device = 'Android Smartphone';
        else device = 'Mobile';
      } else if (ua.includes('iPad')) {
        device = 'iPad';
      } else if (ua.includes('Macintosh')) {
        device = 'Mac';
      } else if (ua.includes('Windows')) {
        device = 'Windows PC';
      } else if (ua.includes('Linux')) {
        device = 'Linux PC';
      }

      return { browser, device };
    };

    const fetchGeoData = async () => {
      const cached = sessionStorage.getItem('EDUCO_TELEMETRY');
      if (cached) {
        try {
          setTelemetry(JSON.parse(cached));
          return;
        } catch (e) {}
      }

      const bd = getBrowserAndDevice();
      let ipAddress = 'Calcul en cours...';
      let location = 'Récupération...';

      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const data = await res.json();
          ipAddress = data.ip || '127.0.0.1';
          location = `${data.city || 'Brazzaville'}, ${data.country_name || 'Congo'}`;
        } else {
          const res2 = await fetch('https://ip-api.com/json/');
          if (res2.ok) {
            const data2 = await res2.json();
            ipAddress = data2.query || '127.0.0.1';
            location = `${data2.city || 'Pointe-Noire'}, ${data2.country || 'Congo'}`;
          }
        }
      } catch (err) {
        console.warn('Geolocation lookup failed:', err);
        ipAddress = '197.218.45.12';
        location = 'Brazzaville, CG';
      }

      const gathered = {
        ipAddress,
        location,
        device: bd.device,
        browser: bd.browser,
      };

      setTelemetry(gathered);
      sessionStorage.setItem('EDUCO_TELEMETRY', JSON.stringify(gathered));
    };

    fetchGeoData();
  }, []);

  // Centralized State Management - Initialized as empty
  const [users, setUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<typeof initialBudget | null>(null);
  const [topClasses, setTopClasses] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [academicYear, setAcademicYear] = useState<AcademicYear | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings | null>(null);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  const [cashierSettings, setCashierSettings] = useState<CashierSettings | null>(null);
  const [rafSettings, setRafSettings] = useState<RafSettings | null>(null);
  const [communicationSettings, setCommunicationSettings] = useState<CommunicationSettings | null>(null);
  // New pedagogical state
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [homeworkDiary, setHomeworkDiary] = useState<HomeworkDiaryEntry[]>([]);
  const [reportCardComments, setReportCardComments] = useState<ReportCardComments[]>([]);
  const [financialEvents, setFinancialEvents] = useState<FinancialEvent[]>([]);

  // State for cashier's operational hours
  const [isCaisseOpen, setIsCaisseOpen] = useState(true);
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Subscription & Licensing State
  const [subscriptionInfo, setSubscriptionInfo] = useState<SchoolSubscriptionInfo | null>(null);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isSubscriptionLoading, setIsSubscriptionLoading] = useState(false);

  const loadSubscription = useCallback(async () => {
    setIsSubscriptionLoading(true);
    try {
      const info = await fetchCurrentSubscription();
      setSubscriptionInfo(info);
    } catch (e) {
      console.warn('Could not fetch subscription status:', e);
      setSubscriptionInfo(null);
    } finally {
      setIsSubscriptionLoading(false);
    }
  }, []);

  // The app mounts before a school user authenticates. Refresh the entitlement
  // once that user is available so the modal receives the real school identifier.
  useEffect(() => {
    if (currentUser?.schoolId && currentUser.role !== 'Admin') {
      loadSubscription();
      return;
    }

    if (!currentUser) {
      setSubscriptionInfo(null);
    }
  }, [currentUser?.schoolId, currentUser?.role, loadSubscription]);

  // Header profile menu & search states
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const headerFileInputRef = React.useRef<HTMLInputElement>(null);

  // Global Modal Alert State to replace native window.alert popups
  const [appAlert, setAppAlert] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });

  // Global override for window.alert to display modern Modal popups everywhere
  useEffect(() => {
    const originalAlert = window.alert;
    const normalizeFeedbackType = (msgString: string): { type: 'info' | 'warning' | 'error' | 'success'; title: string } => {
      let type: 'info' | 'warning' | 'error' | 'success' = 'info';
      let title = 'Information';
      const lower = msgString.toLowerCase();
      if (
        lower.includes('erreur') || 
        lower.includes('aucun') || 
        lower.includes('aucune') || 
        lower.includes('impossible') || 
        lower.includes('rejeté') ||
        lower.includes('refus') ||
        lower.includes('seul') ||
        lower.includes('veuillez') ||
        lower.includes('fermée')
      ) {
        type = lower.includes('erreur') || lower.includes('impossible') ? 'error' : 'warning';
        title = type === 'error' ? 'Erreur' : 'Avertissement / Information';
      } else if (
        lower.includes('succès') || 
        lower.includes('validé') ||
        lower.includes('validée') ||
        lower.includes('modifié') ||
        lower.includes('modifiée') ||
        lower.includes('exporté') ||
        lower.includes('exportée') ||
        lower.includes('enregistré') || 
        lower.includes('sauvegardé') || 
        lower.includes('approuvé') ||
        lower.includes('déclenché') ||
        lower.includes('synchronisé')
      ) {
        type = 'success';
        title = 'Succès';
      }
      return { type, title };
    };

    window.alert = (message?: any) => {
      const msgString = String(message || '');
      const { type, title } = normalizeFeedbackType(msgString);

      setAppAlert({
        isOpen: true,
        title,
        message: msgString,
        type,
      });
    };

    const handleModalFeedback = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const msgString = String(detail.message || '');
      const normalized = normalizeFeedbackType(msgString);
      setAppAlert({
        isOpen: true,
        title: detail.title || normalized.title,
        message: msgString,
        type: detail.type || normalized.type,
      });
    };

    window.addEventListener('educo:modal-feedback', handleModalFeedback);

    return () => {
      window.alert = originalAlert;
      window.removeEventListener('educo:modal-feedback', handleModalFeedback);
    };
  }, []);

  // Dark / Light Theme State with LocalStorage Persistence (Strict Light Mode Default)
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Clear any residual dark mode class or setting
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    try {
      localStorage.setItem('educo_theme', 'light');
    } catch (e) {
      console.warn('LocalStorage not available:', e);
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    try {
      localStorage.setItem('educo_theme', theme);
    } catch (e) {
      console.warn('LocalStorage not available:', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Data loading & Supabase connection verification.
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Keep only local preference/settings cache. Core business data is not
        // rehydrated from localStorage so stale/mock records never appear while
        // Supabase is loading or unavailable.
        const offlineCache = loadOfflineData();

        // Verify Supabase connection
        checkDbConnection().then(status => {
          setDbStatus(status);
          if (status.connected) {
            syncInitialData({
              initialUsers: initialUsers as any[],
              initialClasses: initialClassesData,
              initialFees: initialFeesData,
              initialTransactions: initialTransactions,
              initialBudget,
              initialPersonnel: initialPersonnel as any[],
              initialSettings: initialSchoolSettings,
            });
          }
        });

        // Initialize business state empty; live Supabase/API data will populate it.
        setUsers([]);
        setPayments([]);
        setPersonnel([]);
        setTransactions([]);
        setBudget(offlineCache?.budget || initialBudget);
        setTopClasses([]);
        setNotifications([]);
        setMessages([]);
        setAcademicYear(offlineCache?.academicYear || initialAcademicYear);
        setClasses([]);
        setFees([]);
        setSubjects([]);
        setGrades([]);
        setAttendance([]);
        setActivityLog([]);
        setSchoolSettings(offlineCache?.schoolSettings || initialSchoolSettings);
        setMessageTemplates(offlineCache?.messageTemplates || initialMessageTemplates);
        const loadedCashierSettings = offlineCache?.cashierSettings || initialCashierSettings;
        setCashierSettings({
          ...initialCashierSettings,
          ...loadedCashierSettings,
          permissions: {
            ...initialCashierSettings.permissions,
            ...(loadedCashierSettings?.permissions || {}),
          },
          limits: {
            ...initialCashierSettings.limits,
            ...(loadedCashierSettings?.limits || {}),
          }
        });
        setRafSettings(offlineCache?.rafSettings || initialRafSettings);
        setCommunicationSettings(offlineCache?.communicationSettings || initialCommunicationSettings);
        
        setTimetable([]);
        setHomeworkDiary([]);
        setReportCardComments([]);
        setFinancialEvents([]);
        loadSubscription();
        setLoading(false);
      } catch (err) {
        setError("Erreur lors du chargement des données de l'application.");
        setLoading(false);
      }
    };

    fetchData();
    loadSubscription();
  }, [loadSubscription]);

  // Periodic Supabase connection status check
  useEffect(() => {
    const checkSupabase = async () => {
      try {
        const { url } = getStoredSupabaseConfig();
        if (!url || url.includes('demo-educo.supabase.co')) {
          setSupabaseConnected('disconnected');
          return;
        }
        const supabase = getSupabaseClient();
        const { error } = await supabase.from('users').select('id').limit(1);
        setSupabaseConnected(error ? 'disconnected' : 'connected');
      } catch (err) {
        setSupabaseConnected('disconnected');
      }
    };

    checkSupabase();
    const interval = setInterval(checkSupabase, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Refresh business data without replacing a populated screen with an empty
  // partial response. Notifications have their own per-user endpoint below.
  useEffect(() => {
    const areRecordsEqual = (a: any[], b: any[]) => {
      if (a === b) return true;
      if (!a || !b || a.length !== b.length) return false;
      return JSON.stringify(a) === JSON.stringify(b);
    };

    const replaceIfArray = <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: unknown) => {
      if (!Array.isArray(value)) return;
      setter(prev => {
        // An empty remote collection during a transient auth/database response
        // must never erase records already visible to the user. Local deletes
        // update the state optimistically, so this does not block normal use.
        if (prev.length > 0 && value.length === 0) return prev;
        return areRecordsEqual(prev, value) ? prev : value as T[];
      });
    };

    const syncCentralAdminData = async () => {
      try {
        const userRole = loggedInRole || currentUser?.role;
        if (!userRole && !currentUser) return;

        const exportRes = await fetchAdminExportData();
        if (exportRes && exportRes.success) {
          replaceIfArray<User>(setUsers, exportRes.users);
          replaceIfArray<any>(setPayments, exportRes.payments);
          replaceIfArray<Transaction>(setTransactions, exportRes.transactions);
          replaceIfArray<Personnel>(setPersonnel, exportRes.personnel);
          replaceIfArray<Class>(setClasses, exportRes.classes);
          replaceIfArray<Fee>(setFees, exportRes.fees);
          replaceIfArray<Grade>(setGrades, exportRes.grades);
          replaceIfArray<any>(setAttendance, exportRes.attendance);
          // Do not use the consolidated export for notifications: it contains
          // school/global records and can expose another account's messages.
        }
      } catch (e) {
        console.warn('Central account sync warning:', e);
      }
    };

    syncCentralAdminData();
    const syncInterval = setInterval(syncCentralAdminData, 60000);
    const onFocus = () => syncCentralAdminData();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', onFocus);
    };
  }, [loggedInRole, currentUser]);

  // Dynamic Supabase notifications for the bell + modal preview for Admin broadcasts
  useEffect(() => {
    if (!currentUser && !loggedInRole) return;
    let isMounted = true;

    const loadNotifications = async () => {
      try {
        const res = await fetchNotificationsFromDb();
        if (!isMounted || !res?.success || !Array.isArray(res.notifications)) return;

        setNotifications(prev => {
          const previousIds = new Set((prev || []).map(n => String(n.id)));
          const normalized = res.notifications.map((n: any) => ({
            ...n,
            read: Boolean(n.read ?? n.isRead),
            timestamp: n.timestamp || n.createdAt || new Date().toISOString(),
            roles: n.roles || [],
          }));

          const freshAdminMessages = normalized.filter((n: any) =>
            !previousIds.has(String(n.id)) &&
            !n.read &&
            String(n.type || '').toLowerCase().includes('message admin')
          );

          if (freshAdminMessages.length > 0) {
            const latest = freshAdminMessages[0];
            setAppAlert({
              isOpen: true,
              title: latest.title || 'Message Admin',
              message: latest.message || 'Vous avez reçu un nouveau message administratif.',
              type: 'info',
            });
          }

          return JSON.stringify(prev) === JSON.stringify(normalized) ? prev : normalized;
        });
      } catch (e) {
        console.warn('Notifications sync warning:', e);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 12000);
    const onFocus = () => loadNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentUser, loggedInRole]);

  // Auto-persist entire application state locally whenever data changes
  useEffect(() => {
    if (loading) return;
    saveOfflineData({
      users,
      payments,
      personnel,
      transactions,
      budget,
      topClasses,
      notifications,
      messages,
      academicYear,
      classes,
      fees,
      subjects,
      grades,
      attendance,
      activityLog,
      schoolSettings,
      messageTemplates,
      cashierSettings,
      rafSettings,
      communicationSettings,
      timetable,
      homeworkDiary,
      reportCardComments,
      financialEvents,
      updatedAt: new Date().toISOString()
    });
  }, [
    users, payments, personnel, transactions, budget, topClasses,
    notifications, messages, academicYear, classes, fees, subjects,
    grades, attendance, activityLog, schoolSettings, messageTemplates,
    cashierSettings, rafSettings,
      communicationSettings, timetable, homeworkDiary,
    reportCardComments, financialEvents, loading
  ]);

  // School operations never target the platform administrators. A notification
  // is persisted once per recipient, rather than living in a shared browser
  // array that could be shown to another role after a refresh.
  const addNotification = useCallback((message: string, type: string, roles: string[], link?: string) => {
    const requestedRoles = [...new Set((roles || []).filter(Boolean))];
    const platformRoles = new Set(['Admin', 'Co-admin']);
    const schoolRoles = requestedRoles.filter(role => !platformRoles.has(role));
    const recipientRoles = schoolRoles.length > 0 ? schoolRoles : requestedRoles;

    if (recipientRoles.length === 0) return;

    const newNotification = {
      id: `notif_${Date.now()}_${Math.random()}`,
      title: type || 'Notification',
      message,
      type,
      roles: recipientRoles,
      timestamp: new Date().toISOString(),
      read: false,
      link,
    };

    if (loggedInRole && recipientRoles.includes(loggedInRole)) {
      setNotifications(prev => [newNotification, ...prev]);
    }

    void dispatchNotificationToRoles({
      title: newNotification.title,
      message,
      type,
      roles: recipientRoles,
      link,
    });
  }, [loggedInRole]);

  const addActivityLog = useCallback(async (action: string, details?: string, currentPageName?: string) => {
    if (!loggedInRole) return;
    const userProfile = {
      name: currentUser?.name || loggedInRole || 'Utilisateur',
      role: currentUser?.role || loggedInRole || 'Utilisateur',
      avatar: currentUser?.avatar || ''
    };

    // Retrieve cached or current telemetry
    let ip = telemetry.ipAddress || '197.218.45.12';
    let loc = telemetry.location || 'Brazzaville, CG';
    const cached = sessionStorage.getItem('EDUCO_TELEMETRY');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        ip = parsed.ipAddress || ip;
        loc = parsed.location || loc;
      } catch (e) {}
    }

    const browserName = telemetry.browser || 'Chrome';
    const deviceName = telemetry.device || 'Windows PC';
    const page = currentPageName || activePage || 'Tableau de bord';

    const newLog = {
        id: `log_${Date.now()}`,
        user: userProfile.name,
        role: userProfile.role,
        action,
        timestamp: new Date().toISOString(),
        details: details || '',
        ipAddress: ip,
        location: loc,
        device: deviceName,
        browser: browserName,
        page: page,
    };

    setActivityLog(prev => [newLog, ...prev]);

    try {
      await saveActivityLogToDb({
        action,
        details: details || '',
        userName: userProfile.name,
        userRole: userProfile.role,
        userEmail: currentUser?.email || '',
        schoolName: schoolSettings?.name || '',
        schoolId: (schoolSettings as any)?.id || 1,
        ipAddress: ip,
        location: loc,
        device: deviceName,
        browser: browserName,
        page: page
      });
    } catch (dbErr) {
      console.warn('Failed to persist activity log to database:', dbErr);
    }
  }, [loggedInRole, telemetry, activePage, currentUser, schoolSettings]);

  const persistTransaction = useCallback((optimisticTransaction: Transaction) => {
    saveTransactionToDb(optimisticTransaction)
      .then((saved: any) => {
        if (saved?.id) {
          setTransactions(prev => prev.map(t => (
            t.id === optimisticTransaction.id
              ? { ...t, ...saved, id: String(saved.id) } as Transaction
              : t
          )));
        }
      })
      .catch((err) => {
        console.warn('Transaction gardée localement, synchronisation Supabase échouée:', err);
      });
  }, []);

  const addLogRef = React.useRef(addActivityLog);
  useEffect(() => {
    addLogRef.current = addActivityLog;
  }, [addActivityLog]);

  useEffect(() => {
    if (currentUser && activePage) {
      addLogRef.current('Accès page', `Utilisateur est entré sur la page : ${activePage}`, activePage);
    }
  }, [activePage, !!currentUser]);

  // Effect for threshold alerts
  useEffect(() => {
    if (!rafSettings?.alerts.debtThresholdEnabled || payments.length === 0) {
        return;
    }

    const threshold = rafSettings.alerts.debtThresholdAmount;
    const notifiedDebts = new Set(sessionStorage.getItem('notifiedDebts')?.split(',') || []);

    payments.forEach(p => {
        const debt = p.totalFees - p.amountPaid;
        const studentId = p.studentId.toString();

        if (debt > 0 && debt <= threshold && !notifiedDebts.has(studentId)) {
            addNotification(
                `Le solde de ${p.name} est passé sous le seuil d'alerte (${debt.toLocaleString()} ${schoolSettings?.currency}).`,
                'Alerte',
                ['Responsable des finances'],
                'Audit & Contrôle'
            );
            notifiedDebts.add(studentId);
        }
    });

    sessionStorage.setItem('notifiedDebts', Array.from(notifiedDebts).join(','));

  }, [payments, rafSettings,
      communicationSettings, addNotification, schoolSettings]);

  // Effect for cashier operational hours
  useEffect(() => {
    if (loggedInRole !== 'Caissière' || !rafSettings?.automation?.caisseOperationalHours?.enabled) {
      setIsCaisseOpen(true);
      return;
    }

    const checkCaisseStatus = () => {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      const [openH, openM] = rafSettings.automation.caisseOperationalHours.opensAt.split(':').map(Number);
      const openTime = openH * 60 + openM;

      const [closeH, closeM] = rafSettings.automation.caisseOperationalHours.closesAt.split(':').map(Number);
      const closeTime = closeH * 60 + openM;

      const isOpen = currentTime >= openTime && currentTime < closeTime;

      setIsCaisseOpen(prevIsOpen => {
        if (prevIsOpen && !isOpen) {
          // The cash register just closed automatically
          addActivityLog('Clôture automatique de la caisse', `Heure de fermeture atteinte: ${rafSettings.automation.caisseOperationalHours.closesAt}`);
        }
        return isOpen;
      });
    };

    checkCaisseStatus(); // Initial check
    const intervalId = setInterval(checkCaisseStatus, 60000); // Check every minute

    return () => clearInterval(intervalId);

  }, [loggedInRole, rafSettings,
      communicationSettings, addActivityLog]);

  // Effect for system notifications (budget threshold & pending payments)
  // Effect for external communications (Brevo API Mock)
  useEffect(() => {
    if (!communicationSettings?.sendPendingPaymentReminders) return;
    if (!loggedInRole || !['Direction', 'Responsable des finances', 'Caissière'].includes(loggedInRole)) return;
    if (!payments || !financialEvents) return;

    const runReminders = async () => {
      const today = new Date();
      
      // Look for upcoming deadlines in the financial calendar
      const upcomingDeadlines = financialEvents.filter(event => {
        if (event.type !== 'deadline') return false;
        const eventDate = new Date(event.start);
        const diffTime = eventDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        return communicationSettings.reminderDaysBefore.includes(diffDays) || diffDays === 0;
      });

      if (upcomingDeadlines.length === 0) return;

      const sentRemindersKey = new Set(sessionStorage.getItem('sentRemindersKeys')?.split(',') || []);

      for (const deadline of upcomingDeadlines) {
        // Find students with pending payments
        const pendingStudents = payments.filter(p => (p.totalFees - p.amountPaid) > 0);
        
        for (const student of pendingStudents) {
          const reminderId = `rem-${deadline.id || deadline.title}-${student.id || student.name}-${today.toDateString()}`;
          
          if (!sentRemindersKey.has(reminderId)) {
            // Send the reminder
            let sent = false;
            const message = `Bonjour cher parent. Ceci est un rappel que le paiement pour ${student.name} (${student.class}) est attendu. Reste à payer: ${(student.totalFees - student.amountPaid).toLocaleString()} ${schoolSettings?.currency}. Date limite: ${new Date(deadline.start).toLocaleDateString()}.`;
            
            // Priority: WhatsApp > SMS > Email
            if (communicationSettings.whatsappEnabled) {
               sent = await simulateBrevoSend(communicationSettings, { phone: 'Parent' }, message, 'WhatsApp');
            } else if (communicationSettings.smsEnabled) {
               sent = await simulateBrevoSend(communicationSettings, { phone: 'Parent' }, message, 'SMS');
            } else if (communicationSettings.emailEnabled) {
               sent = await simulateBrevoSend(communicationSettings, { email: 'parent@email.com' }, message, 'Email');
            }
            
            if (sent) {
              sentRemindersKey.add(reminderId);
            }
          }
        }
      }

      if (sentRemindersKey.size > 0) {
        sessionStorage.setItem('sentRemindersKeys', Array.from(sentRemindersKey).join(','));
      }
    };

    runReminders();

  }, [loggedInRole, payments, financialEvents, communicationSettings, schoolSettings]);
  useEffect(() => {
    if (!loggedInRole || !['Direction', 'Responsable des finances'].includes(loggedInRole)) return;
    if (!schoolSettings || !budget || !transactions || !payments) return;

    const notifiedKeys = new Set(sessionStorage.getItem('systemNotifiedKeys')?.split(',') || []);

    // 1. Budget Threshold Alert (e.g. 80% of total budget consumed)
    const totalExpenses = transactions.filter(t => t.type === 'Dépense' && t.status === 'Approuvée').reduce((sum, t) => sum + t.amount, 0);
    const globalBudgetThreshold = 0.8;
    
    if (budget.total > 0 && (totalExpenses / budget.total) >= globalBudgetThreshold) {
      const budgetKey = `global-budget-${academicYear}`;
      if (!notifiedKeys.has(budgetKey)) {
        addNotification(
          `⚠️ Alerte globale : Le total des dépenses (${totalExpenses.toLocaleString()} ${schoolSettings.currency}) a atteint ou dépassé ${(globalBudgetThreshold * 100)}% du budget total (${budget.total.toLocaleString()} ${schoolSettings.currency}).`,
          'Alerte',
          ['Direction', 'Responsable des finances'],
          'Finance & Comptabilité'
        );
        notifiedKeys.add(budgetKey);
      }
    }

    // 2. Pending Payments Alert
    const pendingPaymentsCount = payments.filter(p => (p.totalFees - p.amountPaid) > 0).length;
    
    if (pendingPaymentsCount > 0) {
      const paymentsKey = `pending-payments-${pendingPaymentsCount}-${academicYear}`;
      if (!notifiedKeys.has(paymentsKey)) {
        addNotification(
          `📊 Vous avez ${pendingPaymentsCount} dossier(s) avec des paiements en attente de recouvrement.`,
          'Information',
          ['Direction', 'Responsable des finances', 'Caissière'],
          'Caisse'
        );
        notifiedKeys.add(paymentsKey);
      }
    }

    if (notifiedKeys.size > 0) {
        sessionStorage.setItem('systemNotifiedKeys', Array.from(notifiedKeys).join(','));
    }

  }, [loggedInRole, budget, transactions, payments, addNotification, schoolSettings, academicYear]);

  
  const handleNotificationClick = (link?: string, notifId?: string | number) => {
    if (notifId) {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    }
    if (!link) {
      setActivePage('Tableau de bord');
      return;
    }

    const cleanLink = link.trim();
    const lower = cleanLink.toLowerCase();

    // Smart role-based page navigation
    if (lower.includes('paiement') || lower.includes('caisse') || lower.includes('revenu') || lower.includes('dépense') || lower.includes('opérations à valider') || lower.includes('solde')) {
      if (loggedInRole === 'Parent' || loggedInRole === "Parent d'élève" || loggedInRole === 'Élève') {
        setActivePage('Paiements');
      } else {
        setActivePage('Paiements');
      }
      return;
    }

    if (lower.includes('inscription') || lower.includes('élève') || lower.includes('eleve') || lower.includes('étudiant') || lower.includes('activation') || lower.includes('compte')) {
      if (loggedInRole === 'Parent' || loggedInRole === "Parent d'élève") {
        setActivePage('Tableau de bord');
      } else {
        setActivePage('Inscriptions & Élèves');
      }
      return;
    }

    if (lower.includes('note') || lower.includes('bulletin') || lower.includes('moyenne') || lower.includes('pédagogie')) {
      if (loggedInRole === 'Élève' || loggedInRole === 'Parent' || loggedInRole === "Parent d'élève") {
        setActivePage('Mes Notes');
      } else {
        setActivePage('Notes');
      }
      return;
    }

    if (lower.includes('présence') || lower.includes('retard') || lower.includes('absence')) {
      if (loggedInRole === 'Élève' || loggedInRole === 'Parent' || loggedInRole === "Parent d'élève") {
        setActivePage('Tableau de bord');
      } else {
        setActivePage('Présences');
      }
      return;
    }

    if (lower.includes('message') || lower.includes('discussion') || lower.includes('chat') || lower.includes('annonce')) {
      setActivePage('Messagerie');
      return;
    }

    if (lower.includes('personnel') || lower.includes('salaire') || lower.includes('enseignant')) {
      if (loggedInRole === 'Promoteur' || loggedInRole === 'Directeur Général' || loggedInRole === 'Responsable des finances' || loggedInRole === 'Admin') {
        setActivePage('Personnel');
      } else {
        setActivePage('Tableau de bord');
      }
      return;
    }

    if (lower.includes('audit') || lower.includes('contrôle') || lower.includes('comptabilité')) {
      if (loggedInRole === 'Responsable des finances' || loggedInRole === 'Promoteur' || loggedInRole === 'Admin') {
        setActivePage('Comptabilité');
      } else {
        setActivePage('Tableau de bord');
      }
      return;
    }

    // Direct page name or fallback
    setActivePage(cleanLink);
  };

  const handleMarkNotificationsAsRead = async () => {
    if (!loggedInRole) return;
    setNotifications(prev =>
      prev.map(n =>
        (!n.roles || n.roles.length === 0 || n.roles.includes(loggedInRole)) && !n.read ? { ...n, read: true } : n
      )
    );
    await markAllNotificationsAsReadInDb();
  };

  const handleMarkSingleNotificationAsRead = async (id: string | number) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
    await markNotificationAsReadInDb(id);
  };

  const handleDeleteNotification = async (id: string | number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await deleteNotificationFromDb(id);
  };

  const handleClearAllNotifications = async () => {
    if (!loggedInRole) return;
    setNotifications(prev =>
      prev.filter(n => n.roles && n.roles.length > 0 && !n.roles.includes(loggedInRole))
    );
    await clearNotificationsInDb();
  };

  const handleUpdateAvatar = async (newAvatar: string) => {
    if (currentUser) {
      let avatarToSave = newAvatar;
      try {
        avatarToSave = await compressBase64Image(newAvatar, 128, 128);
      } catch (err) {
        console.warn("Avatar compression failed:", err);
      }
      const updatedUser = { ...currentUser, avatar: avatarToSave };
      setCurrentUser(updatedUser);
      localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(updatedUser));
      setUsers(prevUsers => prevUsers.map(u => 
        u.id === currentUser.id ? updatedUser : u
      ));
      
      // Update local DB via Express API
      try {
        await saveUserToDb(updatedUser);
      } catch (e) {
        console.warn("Mise à jour avatar en BD échouée:", e);
      }

      // Sync to direct Supabase database if configured
      try {
        const { url } = getStoredSupabaseConfig();
        if (url && !url.includes('demo-educo.supabase.co')) {
          const supabase = getSupabaseClient();
          if (currentUser.id) {
            await supabase.from('users')
              .update({ avatar: avatarToSave })
              .eq('id', currentUser.id);
          } else if ((currentUser as any).uid) {
            await supabase.from('users')
              .update({ avatar: avatarToSave })
              .eq('uid', (currentUser as any).uid);
          } else if (currentUser.email) {
            await supabase.from('users')
              .update({ avatar: avatarToSave })
              .ilike('email', currentUser.email);
          }
        }
      } catch (sbErr) {
        console.warn("Synchronisation directe de l'avatar vers Supabase échouée:", sbErr);
      }

      addActivityLog('Mise à jour de la photo de profil', `Utilisateur: ${currentUser.name}`);
    }
  };

  const handleToggleStudentAccountActivation = (studentIdOrUserId: number | string) => {
    const authorizedRoles = ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Admin', 'Co-admin'];
    if (!authorizedRoles.includes(loggedInRole)) {
      alert("Accès refusé : Seuls le Promoteur, le Directeur Général et le Directeur des Études ont le droit d'activer les comptes d'élèves.");
      return;
    }

    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id === studentIdOrUserId || u.studentId === String(studentIdOrUserId) || (typeof studentIdOrUserId === 'number' && u.id === studentIdOrUserId)) {
        const nextState = !u.isAccountActivated;
        const statusMsg = nextState ? "activé" : "désactivé";
        alert(`Le compte de l'élève "${u.name}" a été ${statusMsg} avec succès par le ${loggedInRole}.`);
        addActivityLog('Activation Compte Élève', `Compte de ${u.name} ${statusMsg} par ${loggedInRole}`);
        return {
          ...u,
          isAccountActivated: nextState,
          activatedBy: loggedInRole,
          activatedAt: new Date().toISOString()
        };
      }
      return u;
    }));
  };

  const handleSaveUser = async (userToSave: User) => {
    const isNewParent = userToSave.role === 'Parent' && !userToSave.id;

    try {
      const result = await saveUserToDb(userToSave);
      if (result && result.id) {
        if (userToSave.id) {
          setUsers(users.map(user => (user.id === result.id ? result : user)));
        } else {
          setUsers([...users, result]);
        }
        addActivityLog(userToSave.id ? 'Modification utilisateur' : 'Création utilisateur', `Nom: ${result.name}`);
        
        if (isNewParent) {
          triggerParentCreationNotification(result);
        }
        return;
      }
    } catch (err) {
      console.error('DB save failed:', err);
      alert(err instanceof Error ? err.message : 'Impossible de créer ce compte. Veuillez réessayer.');
      return;
    }
  };

  const triggerParentCreationNotification = (parentUser: User) => {
    const parentName = parentUser.name || 'Nouveau Parent';
    const parentContact = parentUser.phone || parentUser.contact || parentUser.email || 'Non renseigné';
    const notif = {
      id: Date.now(),
      title: '📢 Nouveau Compte Parent Créé',
      message: `Le parent "${parentName}" (${parentContact}) vient de créer un compte parent dans l'établissement.`,
      type: 'Information',
      roles: [
        'Promoteur',
        'Directeur Général',
        'Directeur des Etudes',
        'Directeur du Primaire',
        'Responsable des finances',
        'Caissière',
        'Surveillant Général',
        'Surveillant Général Adjoint',
        'Admin',
        'Co-admin'
      ],
      timestamp: new Date().toISOString(),
      read: false
    };
    setNotifications(prev => [notif, ...prev]);
  };

  const handleDeleteUser = async (userId: number) => {
    const targetUser = users.find(u => u.id === userId);
    await deleteUserFromDb(userId);
    await deleteUserFromSupabaseDirectly(userId);
    setUsers(prev => prev.filter(user => user.id !== userId));
    const userDesc = targetUser ? `Nom: ${targetUser.name}, Rôle: ${targetUser.role}, Email: ${targetUser.email || 'N/A'}` : `ID: ${userId}`;
    addActivityLog('Suppression de compte', `Compte supprimé avec succès - ${userDesc}`);
  };

  const handleDeleteSchool = async (schoolId: number, schoolName: string) => {
    await deleteSchoolFromDb(schoolId, schoolName);
    await purgeSchoolSupabaseDirectly(schoolId.toString(), { students: true, payments: true, personnel: true, grades: true });
    addActivityLog('Suppression d\'établissement', `Établissement supprimé : "${schoolName}" (ID: ${schoolId})`);
  };

  // New handler for single, detailed payments
  const handleSaveSinglePayment = (paymentData: SinglePaymentData): Transaction | null => {
      const today = new Date();
      const pType = paymentData.paymentType || 'Frais Mensuels';

      // 2) Seul le caissier et le RAF et le directeur général peuvent inscrire, réinscrire les eleves et encaisser le paiement de frais d'ecolage
      const allowedEnrollAndCollectRoles = [
        'Caissière', 
        'Responsable des finances', 
        'Directeur Général', 
        'Promoteur', 
        'Admin', 
        'Co-admin'
      ];

      if (!allowedEnrollAndCollectRoles.includes(loggedInRole)) {
        alert("Opération non autorisée : Seuls la Caissière, le Responsable Administratif & Financier (RAF) et le Directeur Général sont habilités à inscrire, réinscrire les élèves et encaisser les frais d'écolage.");
        return null;
      }

      // Cashier permissions and limits validation
      if (loggedInRole === 'Caissière' && cashierSettings) {
          const perms = cashierSettings.permissions;
          const limits = cashierSettings.limits;

          // Check permissions
          if (pType === 'Inscription') {
              if (perms && perms.allowRegistration === false) {
                  alert("Opération refusée : Vous n'avez pas l'autorisation d'inscrire de nouveaux élèves. Veuillez contacter votre RAF.");
                  return null;
              }
          } else {
              if (perms && perms.allowStudentPayment === false) {
                  alert("Opération refusée : Vous n'avez pas l'autorisation d'enregistrer des paiements d'écolage. Veuillez contacter votre RAF.");
                  return null;
              }
          }

          // Check daily actions limit
          if (limits && limits.maxDailyActions > 0) {
              const todayStr = new Date().toISOString().split('T')[0];
              const cashierDailyCount = transactions.filter(t => {
                  if (!t.date) return false;
                  const tDate = t.date.split('T')[0];
                  return tDate === todayStr;
              }).length;

              if (cashierDailyCount >= limits.maxDailyActions) {
                  alert(`Opération refusée : Limite quotidienne d'actions de caisse atteinte (${limits.maxDailyActions} opérations/jour). Veuillez contacter le RAF.`);
                  return null;
              }
          }

          // Check unit ceiling
          if (limits && limits.maxUnitRevenue > 0 && paymentData.amount > limits.maxUnitRevenue) {
              alert(`Opération refusée : Le montant de ${paymentData.amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'} dépasse votre plafond d'encaissement unitaire autorisé (${limits.maxUnitRevenue.toLocaleString()} ${schoolSettings?.currency || 'FCFA'}).`);
              return null;
          }
      }

      let studentName = '';
      let studentClass = '';
      let targetStudentId = paymentData.studentId;

      // 1. IF IT'S A NEW STUDENT INSCRIPTION
      if (pType === 'Inscription' && paymentData.newStudentData) {
          const maxId = users.length > 0 ? Math.max(...users.map(u => typeof u.id === 'number' ? u.id : 0)) : 0;
          const newId = maxId + 1;
          const studentMatricule = paymentData.newStudentData.matricule || `MAT${today.getFullYear()}${String(newId).padStart(3, '0')}`;
          
          studentName = paymentData.newStudentData.name;
          studentClass = paymentData.newStudentData.class;
          targetStudentId = newId;

          const newStudentUser: User = {
              id: newId,
              name: studentName,
              role: 'Élève',
              email: `${studentName.toLowerCase().replace(/\s+/g, '.')}@school.edu`,
              status: 'Actif',
              studentId: studentMatricule,
              class: studentClass,
              dob: paymentData.newStudentData.dob || '',
              gender: (paymentData.newStudentData.gender as any) || 'Masculin',
              contact: paymentData.newStudentData.contact || '',
              phone: paymentData.newStudentData.contact || '',
              address: paymentData.newStudentData.address || '',
              parentName: paymentData.newStudentData.parentTuteur || paymentData.parentTuteur || '',
              guardian: paymentData.newStudentData.parentTuteur || paymentData.parentTuteur || '',
              avatar: paymentData.newStudentData.avatar || `https://i.pravatar.cc/150?u=${newId}`,
              familyId: paymentData.isLargeFamily ? Date.now() : undefined,
              isAccountActivated: false, // Compte à activer par Promoteur / DG / DE
              enrollmentType: 'Inscription',
              registrationType: 'Inscription',
              ...({
                classeAnterieure: paymentData.newStudentData.classeAnterieure || paymentData.classeAnterieure || '',
                isAncienEleve: !!paymentData.newStudentData.isAncienEleve || !!paymentData.isAncienEleve,
                bilingue: !!paymentData.newStudentData.bilingue || !!paymentData.bilingue,
                parentTuteur: paymentData.newStudentData.parentTuteur || paymentData.parentTuteur || '',
                piecesJointes: paymentData.newStudentData.piecesJointes || paymentData.piecesJointes || '',
                freresSoeurs: paymentData.newStudentData.freresSoeurs || paymentData.freresSoeurs || '',
              } as any)
          };

          // Find relevant annual fee for this class to initialize payment record
          const relevantFee = fees.find(f => f.class === studentClass && f.type === 'Scolarité');
          const totalFees = relevantFee ? relevantFee.amount : 0;

          const newPaymentRecord = {
              id: newId,
              studentId: studentMatricule,
              name: studentName,
              class: studentClass,
              totalFees,
              amountPaid: 0,
              isLargeFamily: paymentData.isLargeFamily || false,
              siblings: paymentData.familyNameOrSiblings || paymentData.newStudentData.freresSoeurs || '',
          };

          setUsers(prev => [...prev, newStudentUser]);
          setPayments(prev => [...prev, newPaymentRecord]);
          saveUserToDb(newStudentUser)
            .then((saved: any) => {
              if (saved?.id) {
                setUsers(prev => prev.map(u => u.id === newId ? { ...u, ...saved, id: saved.id } : u));
              }
            })
            .catch((err) => console.warn('Élève gardé localement, synchronisation Supabase échouée:', err));
      } else {
          // EXISTING STUDENT (for Frais Mensuels, Réinscription, or Dossier d'Examen)
          const student = (payments || []).find(p => p.id === targetStudentId) || (users || []).find(u => u.id === targetStudentId);
          if (student) {
              studentName = student.name;
              studentClass = (student as any).class || paymentData.examClass || '';
              
              // If Réinscription, let's update student user details with newly entered details
              if (pType === 'Réinscription') {
                  setUsers(prev => prev.map(u => {
                      if (u.id === targetStudentId) {
                          return {
                              ...u,
                              studentId: paymentData.matricule || u.studentId,
                              gender: paymentData.newStudentData?.gender || u.gender,
                              ...({
                                classeAnterieure: paymentData.classeAnterieure || '',
                                isAncienEleve: paymentData.isAncienEleve !== undefined ? paymentData.isAncienEleve : true,
                                bilingue: !!paymentData.bilingue,
                                parentTuteur: paymentData.parentTuteur || '',
                                piecesJointes: paymentData.piecesJointes || '',
                                freresSoeurs: paymentData.freresSoeurs || '',
                              } as any)
                          };
                      }
                      return u;
                  }));
              }

              // Update existing student payment if applicable
              const pIdx = payments.findIndex(p => p.id === targetStudentId);
              if (pIdx !== -1) {
                  const updatedPayments = [...payments];
                  updatedPayments[pIdx] = {
                      ...updatedPayments[pIdx],
                      amountPaid: updatedPayments[pIdx].amountPaid + (pType === 'Frais Mensuels' ? paymentData.amount : 0),
                      isLargeFamily: paymentData.isLargeFamily !== undefined ? paymentData.isLargeFamily : updatedPayments[pIdx].isLargeFamily,
                      siblings: paymentData.familyNameOrSiblings || paymentData.freresSoeurs || updatedPayments[pIdx].siblings,
                  };
                  setPayments(updatedPayments);
              }
          } else {
              studentName = `Élève #${targetStudentId}`;
          }
      }

      if (pType === 'Inscription' || pType === 'Réinscription') {
        checkInterSchoolStudentDebt({
          name: studentName,
          studentName,
          matricule: paymentData.newStudentData?.matricule || paymentData.matricule,
          parentName: paymentData.newStudentData?.parentTuteur || paymentData.parentTuteur,
          parentTuteur: paymentData.newStudentData?.parentTuteur || paymentData.parentTuteur
        }).then((result: any) => {
          if (result?.hasDebt && Array.isArray(result.matches) && result.matches.length > 0) {
            const debtSummary = result.matches
              .map((m: any) => `${m.studentName || studentName} — ${m.previousSchoolName}: ${Number(m.outstanding || 0).toLocaleString()} ${schoolSettings?.currency || 'FCFA'}`)
              .join('\n');
            alert(`⚠️ Vérification financière inter-école\n\nDette détectée dans le réseau :\n${debtSummary}\n\nMerci de contacter l'établissement d'origine avant validation définitive.`);
            addNotification(
              `Dette inter-école détectée pour ${studentName}: ${debtSummary}`,
              'Vérification financière',
              ['Responsable des finances', 'Promoteur', 'Admin'],
              'Inscriptions & Élèves'
            );
            addActivityLog('Dette inter-école détectée', debtSummary);
          }
        }).catch((err) => console.warn('Vérification inter-école indisponible:', err));
      }

      // Build transaction description and category
      let description = '';
      let category = 'Scolarité';

      if (pType === 'Inscription' && paymentData.newStudentData) {
          const sd = paymentData.newStudentData;
          const bilText = sd.bilingue ? ' | BILINGUE' : '';
          const ancText = sd.isAncienEleve ? ' | Ancien élève' : '';
          const fsText = sd.freresSoeurs ? ` | Fratrie: ${sd.freresSoeurs}` : '';
          const clsAnt = sd.classeAnterieure ? ` | Cl. Ant.: ${sd.classeAnterieure}` : '';
          const tutor = sd.parentTuteur ? ` | Tuteur: ${sd.parentTuteur}` : '';
          description = `Frais d'inscription - ${studentName} (${studentClass})${bilText}${ancText}${clsAnt}${tutor}${fsText}`;
          category = 'Scolarité';
      } else if (pType === 'Réinscription') {
          const bilText = paymentData.bilingue ? ' | BILINGUE' : '';
          const ancText = paymentData.isAncienEleve ? ' | Ancien élève' : '';
          const fsText = paymentData.freresSoeurs ? ` | Fratrie: ${paymentData.freresSoeurs}` : '';
          const clsAnt = paymentData.classeAnterieure ? ` | Cl. Ant.: ${paymentData.classeAnterieure}` : '';
          const tutor = paymentData.parentTuteur ? ` | Tuteur: ${paymentData.parentTuteur}` : '';
          description = `Frais de réinscription - ${studentName} (${studentClass})${bilText}${ancText}${clsAnt}${tutor}${fsText}`;
          category = 'Scolarité';
      } else if (pType === 'Frais de dossier d\'examen') {
          description = `Frais de dossier d'examen - ${studentName} (${paymentData.examClass || studentClass})`;
          category = 'Autres';
      } else {
          description = `Frais de scolarité / mensuels - ${studentName} (${studentClass})`;
          category = 'Scolarité';
      }

      const existingPaymentRecord = payments.find(p => p.id === targetStudentId);
      const totalFeesForReceipt = existingPaymentRecord?.totalFees || fees.find(f => f.class === studentClass && f.type === 'Scolarité')?.amount || 0;
      const paidBeforeReceipt = existingPaymentRecord?.amountPaid || 0;
      const totalPaidByStudent = paidBeforeReceipt + paymentData.amount;
      const remainingBalanceForReceipt = Math.max(0, totalFeesForReceipt - totalPaidByStudent);
      const normalizeContact = (value?: string) => String(value || '').replace(/\D/g, '');
      const parentRecipientPhone = paymentData.parentReceiptPhone
        || paymentData.newStudentData?.contact
        || users.find(u => u.id === targetStudentId)?.parentPhone
        || users.find(u => u.id === targetStudentId)?.guardianPhone
        || users.find(u => u.id === targetStudentId)?.phone
        || users.find(u => u.id === targetStudentId)?.contact
        || '';
      const parentRecipientName = paymentData.parentReceiptName
        || paymentData.newStudentData?.parentTuteur
        || paymentData.parentTuteur
        || users.find(u => u.id === targetStudentId)?.parentName
        || users.find(u => u.id === targetStudentId)?.guardian
        || 'Parent/Tuteur';
      const parentAccount = users.find(u => {
        if (u.role !== 'Parent') return false;
        const sameEmail = paymentData.parentReceiptEmail && u.email?.toLowerCase() === paymentData.parentReceiptEmail.toLowerCase();
        const samePhone = parentRecipientPhone && [u.phone, u.contact].filter(Boolean).some(v => normalizeContact(v) === normalizeContact(parentRecipientPhone));
        const sameName = parentRecipientName && u.name?.toLowerCase().includes(parentRecipientName.toLowerCase());
        return sameEmail || samePhone || sameName;
      });
      const parentRecipientEmail = paymentData.parentReceiptEmail || parentAccount?.email || '';

      const newTransaction: Transaction = {
          id: `TXN${Date.now()}_${targetStudentId || 'N'}`,
          description,
          type: 'Revenu',
          amount: paymentData.amount,
          date: today.toISOString(),
          status: 'En attente',
          category,
          paymentMethod: (paymentData.paymentMethod as any) || 'Espèces',
          mobileMoneyNumber: paymentData.mobileMoneyNumber,
          notes: paymentData.notes,
          receiptSummary: {
            studentName,
            studentClass,
            parentName: parentRecipientName,
            parentPhone: parentRecipientPhone,
            parentEmail: parentRecipientEmail,
            schoolName: schoolSettings?.name || '',
            amountCollected: paymentData.amount,
            totalPaidByStudent,
            remainingBalance: remainingBalanceForReceipt,
            debt: remainingBalanceForReceipt,
            cashierName: currentUser?.name || loggedInRole || 'Caisse',
          },
          parentReceiptDelivery: {
            requested: !!paymentData.sendReceiptCopyToParent,
            phone: parentRecipientPhone,
            email: parentRecipientEmail,
            accountUserId: parentAccount?.id,
          },
      } as any;

      // Add new transaction
      setTransactions(prev => [newTransaction, ...prev]);

      // Queue offline operation for auto-sync
      queueOfflineOperation({
        type: 'TRANSACTION',
        action: 'CREATE',
        payload: newTransaction,
      });
      persistTransaction(newTransaction);
      savePaymentToDb({
        studentId: typeof targetStudentId === 'number' ? targetStudentId : undefined,
        amount: paymentData.amount,
        paymentDate: today.toISOString(),
        receiptNumber: `REC-${Date.now()}-${targetStudentId || 'N'}`,
        paymentMethod: paymentData.paymentMethod,
        status: 'paid'
      }).catch((err) => console.warn('Paiement gardé localement, synchronisation Supabase échouée:', err));

      // Logging & Notifications
      const details = `Paiement ${pType} pour ${studentName} (${studentClass}). Montant: ${paymentData.amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'}`;
      addActivityLog(`Enregistrement ${pType}`, details);
      addNotification(
          `Paiement ${pType} de ${paymentData.amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'} pour ${studentName} (${studentClass}) à valider.`,
          'Revenu',
          ['Responsable des finances', 'Admin', 'Promoteur'],
          'Opérations à valider'
      );

      if (paymentData.sendReceiptCopyToParent) {
        const parentMessage = buildParentReceiptMessage(newTransaction, schoolSettings, {
          name: parentRecipientName,
          phone: parentRecipientPhone,
          email: parentRecipientEmail,
        });

        if (parentAccount?.id) {
          setNotifications(prev => [{
            id: `parent_receipt_${Date.now()}_${parentAccount.id}`,
            message: parentMessage,
            type: 'Reçu de paiement',
            roles: ['Parent'],
            userId: parentAccount.id,
            timestamp: new Date().toISOString(),
            read: false,
            link: 'Paiements',
            transactionId: newTransaction.id,
          }, ...prev]);
        }

        deliverParentPaymentReceipt(newTransaction, schoolSettings, {
          name: parentRecipientName,
          phone: parentRecipientPhone,
          email: parentRecipientEmail,
        }).then((result) => {
          addNotification(
            `Copie parent du reçu de ${studentName}: ${result.message}`,
            'Reçu de paiement',
            ['Caissière', 'Responsable des finances', 'Directeur Général'],
            'Caisse'
          );
        }).catch((err) => {
          console.warn('Livraison copie reçu parent indisponible:', err);
          if (parentAccount?.id) {
            setNotifications(prev => [{
              id: `parent_receipt_fallback_${Date.now()}_${parentAccount.id}`,
              message: `${parentMessage}\n\nLe canal WhatsApp/email n'a pas pu être ouvert. Le reçu reste disponible auprès de la caisse.`,
              type: 'Reçu de paiement',
              roles: ['Parent'],
              userId: parentAccount.id,
              timestamp: new Date().toISOString(),
              read: false,
              link: 'Paiements',
              transactionId: newTransaction.id,
            }, ...prev]);
          }
        });
      }
      
      return newTransaction;
  };

  const handlePaySalary = (personnelId: number, paymentData: SalaryPaymentData): Transaction | null => {
    // Cashier permissions and limits validation
    if (loggedInRole === 'Caissière' && cashierSettings) {
        const perms = cashierSettings.permissions;
        const limits = cashierSettings.limits;

        if (perms && perms.allowSalaryPayment === false) {
            alert("Opération refusée : Vous n'avez pas l'autorisation d'effectuer des paiements de salaires. Veuillez contacter votre RAF.");
            return null;
        }

        // Check daily count
        if (limits && limits.maxDailyActions > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const cashierDailyCount = transactions.filter(t => {
                if (!t.date) return false;
                const tDate = t.date.split('T')[0];
                return tDate === todayStr;
            }).length;

            if (cashierDailyCount >= limits.maxDailyActions) {
                alert(`Opération refusée : Limite quotidienne d'actions de caisse atteinte (${limits.maxDailyActions} opérations/jour). Veuillez contacter le RAF.`);
                return null;
            }
        }

        // Check unit ceiling
        if (limits && limits.maxUnitExpense > 0 && paymentData.netAmount > limits.maxUnitExpense) {
            alert(`Opération refusée : Le montant de ${paymentData.netAmount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'} dépasse votre plafond de décaissement unitaire autorisé (${limits.maxUnitExpense.toLocaleString()} ${schoolSettings?.currency || 'FCFA'}).`);
            return null;
        }
    }

    const employee = personnel.find(p => p.id === personnelId);
    if (!employee) return null;

    const pd = paymentData.details || {};
    const periodSuffix = pd.salaryPeriod ? ` (${pd.salaryPeriod})` : '';

    const newTransaction: Transaction = {
      id: `TXN${Date.now()}`,
      description: `Salaire - ${employee.name}${periodSuffix}`,
      type: 'Dépense',
      amount: paymentData.netAmount,
      date: new Date().toISOString(),
      status: 'En attente',
      category: 'Salaires',
      paymentMethod: pd.paymentMethod || 'Espèce',
      mobileMoneyNumber: pd.mobileMoneyNumber || '',
      notes: pd.notes || '',
      // Store additional properties on the transaction for full visibility
      ...(pd.mobileOperator ? { mobileOperator: pd.mobileOperator } : {}),
      ...(pd.mobileTxRef ? { mobileTxRef: pd.mobileTxRef } : {}),
      ...(pd.bankName ? { bankName: pd.bankName } : {}),
      ...(pd.virementReference ? { virementReference: pd.virementReference } : {}),
      ...(pd.chequeNumber ? { chequeNumber: pd.chequeNumber } : {}),
      ...(pd.issuingBank ? { issuingBank: pd.issuingBank } : {}),
      ...(pd.salaryPeriod ? { salaryPeriod: pd.salaryPeriod } : {}),
    } as any;

    setTransactions(prev => [newTransaction, ...prev]);
    queueOfflineOperation({
      type: 'TRANSACTION',
      action: 'CREATE',
      payload: newTransaction,
    });
    persistTransaction(newTransaction);
    addActivityLog('Paiement de salaire (en attente)', `Personnel: ${employee.name}, Période: ${pd.salaryPeriod || 'N/A'}, Montant: ${paymentData.netAmount.toLocaleString()} ${schoolSettings?.currency}`);
    
    addNotification(
      `Paiement de salaire de ${paymentData.netAmount.toLocaleString()} ${schoolSettings?.currency} pour ${employee.name} (${pd.salaryPeriod || 'N/A'}) à valider. Mode: ${pd.paymentMethod || 'Espèce'}.`,
      'Dépense',
      ['Responsable des finances'],
      'Opérations à valider'
    );
    return newTransaction;
  };
  
  const handleUpdateTransactionStatus = (transactionId: string, status: 'Approuvé' | 'Rejeté') => {
      if (loggedInRole !== 'Responsable des finances' && loggedInRole !== 'Promoteur' && loggedInRole !== 'Admin') {
          alert("Seul le Responsable Administratif et Financier (RAF), le Directeur Général (DG / Promoteur) ou l'Administrateur est habilité à valider ou rejeter les opérations. La caissière n'a pas ce droit.");
          return;
      }
      const currentUserProfile = currentUser;
      const approverName = currentUserProfile?.name || 'Responsable';
      const approverTitle = loggedInRole === 'Promoteur' ? 'Directeur Général (DG)' : loggedInRole;
      const approvedByText = `${approverName} (${approverTitle})`;

      let updatedTransaction: Transaction | undefined;
      setTransactions(prev => prev.map(t => {
          if (t.id === transactionId) {
              if(status === 'Approuvé' && t.type === 'Dépense' && t.description.startsWith('Salaire - ')) {
                  const employeeName = t.description.replace('Salaire - ', '');
                  const today = new Date();
                  setPersonnel(prevP => prevP.map(p => p.name === employeeName ? {...p, lastPaymentDate: today.toLocaleDateString('fr-FR')} : p));
              }
              updatedTransaction = { 
                ...t, 
                status,
                approvedBy: approvedByText,
                approvedAt: new Date().toISOString()
              };
              return updatedTransaction;
          }
          return t;
      }));

      const transaction = transactions.find(t => t.id === transactionId);
      if (transaction && budget) {
          addActivityLog(`Validation transaction (${status}) par ${approvedByText}`, `ID: ${transactionId}, Desc: ${transaction.description}`);
          if (/^\d+$/.test(String(transactionId))) {
            updateTransactionStatusInDb(String(transactionId), status)
              .then((saved: any) => {
                if (saved?.id) {
                  setTransactions(prev => prev.map(t => (
                    String(t.id) === String(transactionId)
                      ? { ...t, ...saved, id: String(saved.id), status } as Transaction
                      : t
                  )));
                }
              })
              .catch((err) => console.warn('Validation gardée localement, synchronisation Supabase échouée:', err));
          }
          
          // Notification to Caisse, RAF, DG (Promoteur) & Admin
          addNotification(
              `L'opération "${transaction.description}" (${transaction.amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'}) a été ${status === 'Approuvé' ? 'approuvée' : 'rejetée'} par ${approvedByText}.`,
              'Validation Opération',
              ['Caissière', 'Responsable des finances', 'Promoteur', 'Admin'],
              'Transactions'
          );

          if (status === 'Approuvé' && transaction.type === 'Dépense') {
              const updatedTransactions = transactions.map(t => t.id === transactionId ? { ...t, status: 'Approuvé', approvedBy: approvedByText } : t);
              const expenseCategory = transaction.category;
              const totalSpentInCategory = updatedTransactions
                  .filter(t => t.type === 'Dépense' && t.status === 'Approuvé' && t.category === expenseCategory)
                  .reduce((sum, t) => sum + t.amount, 0);
              const budgetForCategory = budget.categories.find(c => c.name === expenseCategory)?.amount;

              if (budgetForCategory && totalSpentInCategory > budgetForCategory) {
                  addNotification(
                      `🚨 Dépassement budgétaire pour "${expenseCategory}". Total: ${totalSpentInCategory.toLocaleString()} ${schoolSettings?.currency} / ${budgetForCategory.toLocaleString()} ${schoolSettings?.currency}`,
                      'Budget',
                      ['Responsable des finances', 'Promoteur', 'Admin'],
                      'Audit & Contrôle'
                  );
              }
          }
      }
  };

  const handleEditTransaction = (transactionId: string, updatedData: Partial<Transaction>) => {
      if (loggedInRole !== 'Responsable des finances' && loggedInRole !== 'Promoteur' && loggedInRole !== 'Admin') {
          alert("Seul le Responsable Administratif et Financier (RAF), le Directeur Général (DG / Promoteur) ou l'Administrateur a le droit de modifier une transaction.");
          return;
      }

      setTransactions(prev => prev.map(t => {
          if (t.id === transactionId) {
              const updated = { ...t, ...updatedData };
              addActivityLog('Modification de transaction par le RAF', `ID: ${transactionId}, Intitulé: ${updated.description}, Montant: ${updated.amount}`);
              return updated;
          }
          return t;
      }));

      addNotification(
          `La transaction ${transactionId} a été modifiée par le RAF/DG.`,
          'Modification Transaction',
          ['Caissière', 'Responsable des finances', 'Promoteur', 'Admin'],
          'Comptabilité'
      );
  };
  
  const handleSaveExpense = (description: string, amount: number, category: string, justification?: File, extra?: any) => {
      // Cashier permissions and limits validation
      if (loggedInRole === 'Caissière' && cashierSettings) {
          const perms = cashierSettings.permissions;
          const limits = cashierSettings.limits;

          if (perms && perms.allowGeneralExpense === false) {
              alert("Opération refusée : Vous n'avez pas l'autorisation d'enregistrer des dépenses de fonctionnement. Veuillez contacter votre RAF.");
              return;
          }

          // Check daily count
          if (limits && limits.maxDailyActions > 0) {
              const todayStr = new Date().toISOString().split('T')[0];
              const cashierDailyCount = transactions.filter(t => {
                  if (!t.date) return false;
                  const tDate = t.date.split('T')[0];
                  return tDate === todayStr;
              }).length;

              if (cashierDailyCount >= limits.maxDailyActions) {
                  alert(`Opération refusée : Limite quotidienne d'actions de caisse atteinte (${limits.maxDailyActions} opérations/jour). Veuillez contacter le RAF.`);
                  return;
              }
          }

          // Check unit ceiling
          if (limits && limits.maxUnitExpense > 0 && amount > limits.maxUnitExpense) {
              alert(`Opération refusée : Le montant de ${amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'} dépasse votre plafond de décaissement unitaire autorisé (${limits.maxUnitExpense.toLocaleString()} ${schoolSettings?.currency || 'FCFA'}).`);
              return;
          }
      }

      if (!budget) return;
      const currentUserProfile = currentUser;
      const isRAFOrDG = loggedInRole === 'Responsable des finances' || loggedInRole === 'Promoteur' || loggedInRole === 'Admin';
      const autoApprovalLimit = rafSettings?.alerts?.approvalThresholdAmount ?? 50000;
      const isUnderThreshold = amount <= autoApprovalLimit;

      let status: Transaction['status'] = 'En attente';
      let approvedBy: string | undefined = undefined;

      if (isRAFOrDG) {
        status = 'Approuvé';
        approvedBy = `${currentUserProfile?.name || 'Responsable'} (${loggedInRole === 'Promoteur' ? 'Directeur Général (DG)' : loggedInRole})`;
      } else if (isUnderThreshold) {
        status = 'Approuvé';
        approvedBy = `Décaissement Direct Caissière (<= ${autoApprovalLimit.toLocaleString()} ${schoolSettings?.currency || 'FCFA'})`;
      } else {
        status = 'En attente';
      }

      const newExpense: Transaction = {
          id: `TXN${Date.now()}`,
          description,
          type: 'Dépense',
          amount,
          date: new Date().toISOString(),
          status,
          category,
          justification: justification ? justification.name : undefined,
          approvedBy,
          approvedAt: status === 'Approuvé' ? new Date().toISOString() : undefined,
          ...(extra || {}),
      } as any;
      const newTransactions = [newExpense, ...transactions];
      setTransactions(newTransactions);
      
      queueOfflineOperation({
        type: 'TRANSACTION',
        action: 'CREATE',
        payload: newExpense,
      });
      persistTransaction(newExpense);
      
      if (isRAFOrDG) {
        addActivityLog('Enregistrement dépense (Direction/RAF)', `Desc: ${description}, Montant: ${amount} ${schoolSettings?.currency}, Cat: ${category}`);
        addNotification(
          `Dépense de ${amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'} enregistrée et approuvée par ${approvedBy}.`,
          'Dépense Approuvée',
          ['Caissière', 'Responsable des finances', 'Promoteur', 'Admin'],
          'Rapports Financiers'
        );
      } else if (isUnderThreshold) {
        addActivityLog('Enregistrement dépense Caissière (auto-approuvée sous plafond)', `Desc: ${description}, Montant: ${amount} ${schoolSettings?.currency}, Cat: ${category}`);
        addNotification(
          `Dépense de ${amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'} décaissée par la Caissière (Inférieure au plafond de ${autoApprovalLimit.toLocaleString()} ${schoolSettings?.currency || 'FCFA'}).`,
          'Décaissement Direct',
          ['Caissière', 'Responsable des finances', 'Promoteur', 'Admin'],
          'Transactions'
        );
      } else {
        addActivityLog('Enregistrement dépense Caissière (en attente validation RAF/DG)', `Desc: ${description}, Montant: ${amount} ${schoolSettings?.currency}, Cat: ${category}`);
        addNotification(
          `Nouvelle dépense de ${amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'} (> plafond de ${autoApprovalLimit.toLocaleString()} ${schoolSettings?.currency || 'FCFA'}) soumise par la Caissière — En attente d'approbation par le RAF ou le DG.`,
          'Dépense en attente',
          ['Responsable des finances', 'Promoteur', 'Admin'],
          'Opérations à valider'
        );
      }

      const totalSpentInCategory = newTransactions
        .filter(t => t.type === 'Dépense' && t.status === 'Approuvé' && t.category === category)
        .reduce((sum, t) => sum + t.amount, 0);
      const budgetForCategory = budget.categories.find(c => c.name === category)?.amount;

      if (budgetForCategory) {
        const ratio = totalSpentInCategory / budgetForCategory;
        if (ratio >= 1) {
          addNotification(
              `🚨 Dépassement budgétaire critique pour "${category}". Total: ${totalSpentInCategory.toLocaleString()} ${schoolSettings?.currency} / ${budgetForCategory.toLocaleString()} ${schoolSettings?.currency} (${(ratio * 100).toFixed(1)}%)`,
              'Budget',
              ['Admin', 'Promoteur', 'Responsable des finances'],
              'Tableau de bord'
          );
        } else if (ratio >= 0.9) {
          addNotification(
              `⚠️ Alerte Seuil 90% : La catégorie "${category}" a consommé ${(ratio * 100).toFixed(1)}% de son budget (${totalSpentInCategory.toLocaleString()} / ${budgetForCategory.toLocaleString()} ${schoolSettings?.currency})`,
              'Budget',
              ['Admin', 'Promoteur', 'Responsable des finances'],
              'Tableau de bord'
          );
        }
      }

      if (loggedInRole === 'Responsable des finances') {
        addNotification(
            `Nouvelle dépense de ${amount.toLocaleString()} ${schoolSettings?.currency} enregistrée et approuvée.`,
            'Dépense',
            ['Admin', 'Promoteur'],
            'Comptabilité'
        );
      }
  };

  const handleSaveRevenue = (description: string, amount: number, category: string, justification?: File, extra?: any) => {
      // Cashier permissions and limits validation
      if (loggedInRole === 'Caissière' && cashierSettings) {
          const perms = cashierSettings.permissions;
          const limits = cashierSettings.limits;

          if (perms && perms.allowStudentPayment === false) {
              alert("Opération refusée : Vous n'avez pas l'autorisation d'enregistrer de nouvelles recettes. Veuillez contacter votre RAF.");
              return;
          }

          // Check daily count
          if (limits && limits.maxDailyActions > 0) {
              const todayStr = new Date().toISOString().split('T')[0];
              const cashierDailyCount = transactions.filter(t => {
                  if (!t.date) return false;
                  const tDate = t.date.split('T')[0];
                  return tDate === todayStr;
              }).length;

              if (cashierDailyCount >= limits.maxDailyActions) {
                  alert(`Opération refusée : Limite quotidienne d'actions de caisse atteinte (${limits.maxDailyActions} opérations/jour). Veuillez contacter le RAF.`);
                  return;
              }
          }

          // Check unit ceiling
          if (limits && limits.maxUnitRevenue > 0 && amount > limits.maxUnitRevenue) {
              alert(`Opération refusée : Le montant de ${amount.toLocaleString()} ${schoolSettings?.currency || 'FCFA'} dépasse votre plafond d'encaissement unitaire autorisé (${limits.maxUnitRevenue.toLocaleString()} ${schoolSettings?.currency || 'FCFA'}).`);
              return;
          }
      }

      const newRevenue: Transaction = {
          id: `TXN${Date.now()}`,
          description,
          type: 'Revenu',
          amount,
          date: new Date().toISOString(),
          status: 'Approuvé', // Revenues created by RAF are auto-approved
          category,
          justification: justification ? justification.name : undefined,
          ...(extra || {}),
      } as any;
      setTransactions(prev => [newRevenue, ...prev]);
      queueOfflineOperation({
        type: 'TRANSACTION',
        action: 'CREATE',
        payload: newRevenue,
      });
      persistTransaction(newRevenue);
      addActivityLog('Enregistrement revenu', `Desc: ${description}, Montant: ${amount} ${schoolSettings?.currency}, Cat: ${category}`);
      addNotification(
          `Nouveau revenu de ${amount.toLocaleString()} ${schoolSettings?.currency} enregistré.`,
          'Revenu',
          ['Admin', 'Promoteur'],
          'Comptabilité'
      );
  };


  const handleSavePersonnel = (personnelToSave: Personnel) => {
    if (personnelToSave.id) {
        // Update
        setPersonnel(personnel.map(p => p.id === personnelToSave.id ? personnelToSave : p));
        savePersonnelToDb(personnelToSave)
          .then((saved: any) => {
            if (saved?.id) {
              setPersonnel(prev => prev.map(p => p.id === personnelToSave.id ? { ...p, ...saved } : p));
            }
          })
          .catch((err) => console.warn('Personnel gardé localement, synchronisation Supabase échouée:', err));
        addActivityLog('Mise à jour fiche personnel', `ID: ${personnelToSave.id}, Nom: ${personnelToSave.name}`);
    } else {
        // Create
        const newId = personnel.length > 0 ? Math.max(...personnel.map(p => p.id as number)) + 1 : 1;
        const newPersonnel = { ...personnelToSave, id: newId };
        setPersonnel([...personnel, newPersonnel]);
        savePersonnelToDb({ ...newPersonnel, id: undefined })
          .then((saved: any) => {
            if (saved?.id) {
              setPersonnel(prev => prev.map(p => p.id === newId ? { ...p, ...saved } : p));
            }
          })
          .catch((err) => console.warn('Personnel gardé localement, synchronisation Supabase échouée:', err));
        addActivityLog('Création membre du personnel', `Nom: ${newPersonnel.name}, Rôle: ${newPersonnel.role}`);
    }
  };

  const handleDeletePersonnel = (personnelId: number) => {
    const personToDelete = personnel.find(p => p.id === personnelId);
    if (personToDelete) {
        setPersonnel(personnel.filter(p => p.id !== personnelId));
        addActivityLog('Suppression membre du personnel', `ID: ${personnelId}, Nom: ${personToDelete.name}`);
    }
  };

  const handleUpdateBudget = (newBudget: number) => {
    setBudget(prev => (prev ? {...prev, total: newBudget} : { total: newBudget, categories: [] }));
    addActivityLog('Mise à jour budget total', `Nouveau montant: ${newBudget.toLocaleString()} ${schoolSettings?.currency}`);
  };

  const handleUpdateClassPerformance = (className: string, newPerformance: number) => {
    setTopClasses(prevClasses =>
      prevClasses.map(c => 
        c.name === className ? { ...c, performance: newPerformance } : c
      ).sort((a, b) => b.performance - a.performance)
    );
    addActivityLog('Mise à jour performance classe', `Classe: ${className}, Perf: ${newPerformance}%`);
    addNotification(
      `Performance de la classe ${className} mise à jour : ${newPerformance}%.`,
      'Pédagogie',
      ['Admin', 'Promoteur'],
      'Tableau de bord'
    );
    addNotification(
      `Une mise à jour concerne votre classe ${className}.`,
      'Pédagogie',
      ['Élève'],
      'Tableau de bord'
    );
  };
  
  const handleSendMessage = (text: string) => {
    const currentUser = users.find(u => u.id === currentUserId);
    if (!loggedInRole || !currentUser) return;
    
    const newMessage = {
        id: `msg_${Date.now()}`,
        senderName: currentUser.name,
        senderRole: loggedInRole,
        avatar: currentUser?.avatar || '',
        text,
        timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
    sendMessageToDb({
      text,
      title: `Message de ${currentUser.name}`,
      targetSchoolId: (currentUser as any).schoolId || (schoolSettings as any)?.id,
      roles: undefined
    }).catch((err) => console.warn('Message gardé localement, synchronisation Supabase échouée:', err));
  };

  const handleUpdateAcademicYear = (newYear: AcademicYear) => {
    setAcademicYear(newYear);
    addActivityLog('Mise à jour année scolaire', `Début: ${newYear.startDate}, Fin: ${newYear.endDate}`);
  };

  const handleSaveClass = (classToSave: Class) => {
    if (classToSave.id) {
      setClasses(classes.map(c => c.id === classToSave.id ? classToSave : c));
      saveClassToDb(classToSave)
        .then((saved: any) => {
          if (saved?.id) {
            setClasses(prev => prev.map(c => c.id === classToSave.id ? { ...c, ...saved } : c));
          }
        })
        .catch((err) => console.warn('Classe gardée localement, synchronisation Supabase échouée:', err));
      addActivityLog('Modification classe', `ID: ${classToSave.id}, Nom: ${classToSave.name}`);
    } else {
      const newId = classes.length > 0 ? Math.max(...classes.map(c => c.id as number)) + 1 : 1;
      const newClass = { ...classToSave, id: newId };
      setClasses([...classes, newClass]);
      saveClassToDb({ ...newClass, id: undefined })
        .then((saved: any) => {
          if (saved?.id) {
            setClasses(prev => prev.map(c => c.id === newId ? { ...c, ...saved } : c));
          }
        })
        .catch((err) => console.warn('Classe gardée localement, synchronisation Supabase échouée:', err));
      addActivityLog('Création classe', `Nom: ${newClass.name}`);
    }
  };

  const handleDeleteClass = (classId: number) => {
    const classToDelete = classes.find(c => c.id === classId);
    setClasses(classes.filter(c => c.id !== classId));
    if(classToDelete) {
        addActivityLog('Suppression classe', `ID: ${classId}, Nom: ${classToDelete.name}`);
    }
  };

  const handleSaveFee = (feeToSave: Fee) => {
    if (feeToSave.id) {
        setFees(fees.map(f => f.id === feeToSave.id ? feeToSave : f));
        saveFeeToDb(feeToSave)
          .then((saved: any) => {
            if (saved?.id) {
              setFees(prev => prev.map(f => f.id === feeToSave.id ? { ...f, ...saved } : f));
            }
          })
          .catch((err) => console.warn('Tarif gardé localement, synchronisation Supabase échouée:', err));
        addActivityLog('Modification tarif', `ID: ${feeToSave.id}, Classe/Service: ${feeToSave.class}`);
    } else {
        const newId = fees.length > 0 ? Math.max(...fees.map(f => f.id)) + 1 : 1;
        const newFee = { ...feeToSave, id: newId };
        setFees([...fees, newFee]);
        saveFeeToDb({ ...newFee, id: undefined })
          .then((saved: any) => {
            if (saved?.id) {
              setFees(prev => prev.map(f => f.id === newId ? { ...f, ...saved } : f));
            }
          })
          .catch((err) => console.warn('Tarif gardé localement, synchronisation Supabase échouée:', err));
        addActivityLog('Création tarif', `Classe/Service: ${newFee.class}, Montant: ${newFee.amount}`);
    }
  };

  const handleDeleteFee = (feeId: number) => {
      const feeToDelete = fees.find(f => f.id === feeId);
      setFees(fees.filter(f => f.id !== feeId));
      if (feeToDelete) {
          addActivityLog('Suppression tarif', `ID: ${feeId}, Classe/Service: ${feeToDelete.class}`);
      }
  };

  const handleSaveGrade = (gradeToSave: Grade) => {
    const newId = `grade_${Date.now()}`;
    const newGrade = { ...gradeToSave, id: newId };
    setGrades(prev => [...prev, newGrade]);
    saveGradeToDb(newGrade)
      .then((saved: any) => {
        if (saved?.id) {
          setGrades(prev => prev.map(g => g.id === newId ? { ...g, ...saved } : g));
        }
      })
      .catch((err) => console.warn('Note gardée localement, synchronisation Supabase échouée:', err));
    const student = users.find(u => u.id === gradeToSave.studentId);
    addActivityLog('Ajout de note', `Élève: ${student?.name}, Matière: ${gradeToSave.subject}, Note: ${gradeToSave.score}`);

    if (student) {
        addNotification(
            `Nouvelle note en ${gradeToSave.subject}: ${gradeToSave.score}/20 pour le devoir "${gradeToSave.assignment}".`,
            'Pédagogie',
            ['Élève'], // This should be targeted to the specific student, but for now we notify the generic role
            'Mes Notes'
        );
    }
     addNotification(
        `Note ajoutée pour ${student?.name} en ${gradeToSave.subject}.`,
        'Pédagogie',
        ['Admin', 'Promoteur', 'Directeur des Etudes'],
        'Notes'
    );
  };

  const handleSaveAttendance = (classId: number, date: string, records: AttendanceRecord[]) => {
      const otherDays = attendance.filter(att => !(att.classId === classId && att.date === date));
      const newAttendance = records.map(rec => ({ ...rec, classId, date }));
      setAttendance([...otherDays, ...newAttendance]);
      const className = classes.find(c => c.id === classId)?.name || '';
      addActivityLog('Enregistrement des présences', `Classe: ${className}, Date: ${date}`);
      
      addNotification(
        `Feuille de présence pour la classe ${className} enregistrée pour le ${new Date(date).toLocaleDateString('fr-FR')}.`,
        'Pédagogie',
        ['Admin', 'Promoteur', 'Directeur des Etudes'],
        'Présences'
    );
  };

  const handleSaveSchoolSettings = (settings: SchoolSettings) => {
    setSchoolSettings(settings);
    try {
      const currentOffline = loadOfflineData() || {};
      saveOfflineData({
        ...currentOffline,
        schoolSettings: settings,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Erreur sauvegarde locale paramètres école:', e);
    }
    addActivityLog('Mise à jour des paramètres de l\'établissement');
  };

  const handleSaveSubject = (subjectToSave: Subject) => {
    if (subjectToSave.id) {
        setSubjects(subjects.map(s => s.id === subjectToSave.id ? subjectToSave : s));
        addActivityLog('Modification matière', `ID: ${subjectToSave.id}, Nom: ${subjectToSave.name}`);
    } else {
        const newId = subjects.length > 0 ? Math.max(...subjects.map(s => s.id as number)) + 1 : 1;
        const newSubject = { ...subjectToSave, id: newId };
        setSubjects([...subjects, newSubject]);
        addActivityLog('Création matière', `Nom: ${newSubject.name}`);
    }
  };

  const handleDeleteSubject = (subjectId: number) => {
    const subjectToDelete = subjects.find(s => s.id === subjectId);
    if (subjectToDelete) {
        setSubjects(subjects.filter(s => s.id !== subjectId));
        addActivityLog('Suppression matière', `ID: ${subjectId}, Nom: ${subjectToDelete.name}`);
    }
  };

  const handleSaveMessageTemplate = (templateToSave: MessageTemplate) => {
    if (templateToSave.id) {
        setMessageTemplates(messageTemplates.map(t => t.id === templateToSave.id ? templateToSave : t));
        addActivityLog('Modification modèle de message', `ID: ${templateToSave.id}`);
    } else {
        const newId = messageTemplates.length > 0 ? Math.max(...messageTemplates.map(t => t.id)) + 1 : 1;
        const newTemplate = { ...templateToSave, id: newId };
        setMessageTemplates([...messageTemplates, newTemplate]);
        addActivityLog('Création modèle de message', `Titre: ${newTemplate.title}`);
    }
  };

  const handleSaveCashierSettings = (settings: CashierSettings) => {
    setCashierSettings(settings);
    addActivityLog('Mise à jour des paramètres de la caisse');
  };

  const handleSaveCommunicationSettings = (settings: CommunicationSettings) => {
    setCommunicationSettings(settings);
    addActivityLog('Configuration Communication ', 'Mise à jour des paramètres de communication');
  };

  const handleSaveRafSettings = (settings: RafSettings) => {
    setRafSettings(settings);
    addActivityLog('Mise à jour des paramètres du RAF');
  };

  // New Pedagogical Handlers
  const handleSaveTimetableEntry = (entry: TimetableEntry) => {
    setTimetable(prev => {
      const index = prev.findIndex(e => e.id === entry.id);
      if (index > -1) {
        const newTimetable = [...prev];
        newTimetable[index] = entry;
        return newTimetable;
      }
      return [...prev, { ...entry, id: `tt_${Date.now()}` }];
    });
    addActivityLog('Mise à jour Emploi du temps', `Classe ID: ${entry.classId}`);
  };

  const handleDeleteTimetableEntry = (id: string) => {
    setTimetable(prev => prev.filter(e => e.id !== id));
    addActivityLog('Suppression d\'un cours de l\'emploi du temps');
  };

  const handleSaveHomeworkEntry = (entry: HomeworkDiaryEntry) => {
    setHomeworkDiary(prev => [...prev, { ...entry, id: `hw_${Date.now()}` }]);
    addActivityLog('Ajout au cahier de texte', `Classe ID: ${entry.classId}`);
  };

  const handleSaveReportCardComments = (comments: ReportCardComments) => {
    setReportCardComments(prev => {
        const index = prev.findIndex(c => c.studentId === comments.studentId && c.period === comments.period);
        if (index > -1) {
            const newComments = [...prev];
            newComments[index] = comments;
            return newComments;
        }
        return [...prev, { ...comments, id: `rc_${Date.now()}` }];
    });
    const student = users.find(u => u.id === comments.studentId);
    addActivityLog('Sauvegarde appréciation bulletin', `Élève: ${student?.name}`);
  };

  const handleSaveFinancialEvent = (event: FinancialEvent) => {
    setFinancialEvents(prev => {
      if (event.id) {
        return prev.map(e => e.id === event.id ? event : e);
      }
      return [...prev, { ...event, id: `fe_${Date.now()}` }];
    });
    addActivityLog('Mise à jour du calendrier financier', event.title);
  };
  
  const handleDeleteFinancialEvent = (eventId: string) => {
    setFinancialEvents(prev => prev.filter(e => e.id !== eventId));
    addActivityLog('Suppression d\'un événement du calendrier financier');
  };


  const handleViewStudentProfile = (studentId: number) => {
    setViewingStudentId(studentId);
    setActivePage('Profil Élève');
  };


  const handleExportBackup = async (encryptionPassword?: string) => {
    const fullBackup = {
      exportDate: new Date().toISOString(),
      schoolSettings,
      users,
      classes,
      fees,
      payments,
      transactions,
      personnel,
      budget,
      academicYear,
      subjects,
      grades,
      reportCardComments,
      attendance,
      activityLog,
      messageTemplates,
      cashierSettings,
      rafSettings,
      communicationSettings,
      timetable,
      homeworkDiary,
      financialEvents,
    };

    let fileContent = JSON.stringify(fullBackup, null, 2);
    let fileName = `educo_backup_${new Date().toISOString().split('T')[0]}.json`;

    if (encryptionPassword && encryptionPassword.trim().length > 0) {
      try {
        const enc = new TextEncoder();
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const keyMaterial = await window.crypto.subtle.importKey(
          "raw",
          enc.encode(encryptionPassword),
          { name: "PBKDF2" },
          false,
          ["deriveKey"]
        );
        
        const key = await window.crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
          keyMaterial,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt"]
        );
        
        const encrypted = await window.crypto.subtle.encrypt(
          { name: "AES-GCM", iv: iv },
          key,
          enc.encode(fileContent)
        );
        
        const bundle = {
          encrypted: true,
          salt: Array.from(salt),
          iv: Array.from(iv),
          data: Array.from(new Uint8Array(encrypted))
        };
        fileContent = JSON.stringify(bundle, null, 2);
        fileName = `educo_backup_encrypted_${new Date().toISOString().split('T')[0]}.json`;
      } catch (err) {
        console.error("Erreur de chiffrement du backup:", err);
        alert("Erreur lors du chiffrement de la sauvegarde.");
        return;
      }
    }

    const blob = new Blob([fileContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    addActivityLog(encryptionPassword ? 'Exportation de la sauvegarde chiffrée du système' : 'Exportation de la sauvegarde du système');
  };

  const handleRestoreBackup = async (rawFileContent: string, decryptionPassword?: string): Promise<boolean> => {
    try {
      let parsed = JSON.parse(rawFileContent);

      if (parsed.encrypted) {
        if (!decryptionPassword) {
          alert("Cette sauvegarde est chiffrée. Veuillez saisir le mot de passe de déchiffrement.");
          return false;
        }
        try {
          const enc = new TextEncoder();
          const salt = new Uint8Array(parsed.salt);
          const iv = new Uint8Array(parsed.iv);
          const encryptedData = new Uint8Array(parsed.data);

          const keyMaterial = await window.crypto.subtle.importKey(
            "raw",
            enc.encode(decryptionPassword),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
          );

          const key = await window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial,
            { name: "AES-GCM", length: 256 },
            false,
            ["decrypt"]
          );

          const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            encryptedData
          );

          const dec = new TextDecoder();
          parsed = JSON.parse(dec.decode(decrypted));
        } catch (err) {
          console.error("Déchiffrement échoué:", err);
          alert("Mot de passe de déchiffrement incorrect ou fichier corrompu.");
          return false;
        }
      }

      if (parsed.schoolSettings) setSchoolSettings(parsed.schoolSettings);
      if (parsed.users) setUsers(parsed.users);
      if (parsed.classes) setClasses(parsed.classes);
      if (parsed.fees) setFees(parsed.fees);
      if (parsed.payments) setPayments(parsed.payments);
      if (parsed.transactions) setTransactions(parsed.transactions);
      if (parsed.personnel) setPersonnel(parsed.personnel);
      if (parsed.budget) setBudget(parsed.budget);
      if (parsed.academicYear) setAcademicYear(parsed.academicYear);
      if (parsed.subjects) setSubjects(parsed.subjects);
      if (parsed.grades) setGrades(parsed.grades);
      if (parsed.reportCardComments) setReportCardComments(parsed.reportCardComments);
      if (parsed.attendance) setAttendance(parsed.attendance);
      if (parsed.activityLog) setActivityLog(parsed.activityLog);
      if (parsed.messageTemplates) setMessageTemplates(parsed.messageTemplates);
      if (parsed.cashierSettings) setCashierSettings(parsed.cashierSettings);
      if (parsed.rafSettings) setRafSettings(parsed.rafSettings);
      if (parsed.communicationSettings) setCommunicationSettings(parsed.communicationSettings);
      if (parsed.timetable) setTimetable(parsed.timetable);
      if (parsed.homeworkDiary) setHomeworkDiary(parsed.homeworkDiary);
      if (parsed.financialEvents) setFinancialEvents(parsed.financialEvents);

      addActivityLog('Restauration complète de la base de données', `Fichier réimporté avec succès le ${new Date().toLocaleString()}`);
      return true;
    } catch (err) {
      console.error("Erreur restauration backup:", err);
      return false;
    }
  };

  const handleResetAllData = async () => {
    try {
      await purgeSupabaseDirectly();
    } catch (err) {
      console.warn('Purge Supabase client warning:', err);
    }

    try {
      await fetch(getApiUrl('/api/db/purge-all'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.warn('Purge backend server warning:', err);
    }

    const adminUser = users.find(u => u.role === 'Admin') || {
      id: 1,
      name: 'Super Administrateur',
      role: 'Admin',
      email: 'admin@ecole.cg',
      status: 'Actif'
    };

    setUsers([adminUser as any]);
    setPayments([]);
    setTransactions([]);
    setPersonnel([]);
    setClasses([]);
    setGrades([]);
    setAttendance([]);
    setFinancialEvents([]);
    setTimetable([]);
    setHomeworkDiary([]);
    setReportCardComments([]);
    setBudget({ total: 0, categories: [] });
    setSchoolSettings({
      name: "Mon École",
      logo: "",
      address: "",
      contact: "",
      email: "",
      currency: "FCFA",
      themeColor: "#1F4A59",
      slogan: "",
      currentYear: "",
      academicYear: "2025-2026",
      defaultLanguage: "Français",
      dashboardView: "standard",
    });
    setActivityLog([{
      id: `act_${Date.now()}`,
      action: 'Réinitialisation Générale',
      details: 'Toutes les données, montants et transactions ont été supprimés. Seul le compte admin a été conservé.',
      timestamp: new Date().toISOString()
    }]);

    localStorage.removeItem('educo_offline_queue');
    localStorage.removeItem('educo_offline_app_data_v1');
    localStorage.setItem('EDUCO_CURRENT_USER', JSON.stringify(adminUser));
    alert("Toutes les données ont été supprimées avec succès. L'application est désormais vide et vierge, seul le compte admin a été conservé.");
  };

  const handleResetSchoolData = async (schoolIdentifierOrName: string, options?: { students?: boolean; payments?: boolean; personnel?: boolean; grades?: boolean }) => {
    try {
      await purgeSchoolSupabaseDirectly(schoolIdentifierOrName, options);
    } catch (err) {
      console.warn('Purge school Supabase warning:', err);
    }

    const opts = { students: true, payments: true, personnel: true, grades: true, ...options };
    const term = schoolIdentifierOrName.toLowerCase().trim();

    if (opts.students) {
      setUsers(prev => prev.filter(u => u.role === 'Admin' || !(
        ((u as any).schoolName && String((u as any).schoolName).toLowerCase().includes(term)) ||
        ((u as any).schoolId && String((u as any).schoolId).toLowerCase() === term)
      )));
    }

    if (opts.payments) {
      setPayments(prev => prev.filter(p => !(
        (p as any).schoolName && (p as any).schoolName.toLowerCase().includes(term)
      )));
      setTransactions(prev => prev.filter(t => !(
        (t as any).schoolName && (t as any).schoolName.toLowerCase().includes(term)
      )));
    }

    if (opts.personnel) {
      setPersonnel(prev => prev.filter(p => !(
        (p as any).schoolName && (p as any).schoolName.toLowerCase().includes(term)
      )));
    }

    if (opts.grades) {
      setGrades([]);
      setAttendance([]);
    }

    addActivityLog('Réinitialisation Établissement', `Données purgées pour l'établissement "${schoolIdentifierOrName}"`);
    alert(`Les données sélectionnées pour l'établissement "${schoolIdentifierOrName}" ont été réinitialisées.`);
  };

  useEffect(() => {
    if (loggedInRole === 'Admin') {
      const todayDate = new Date().toISOString().split('T')[0];
      const lastBackupDate = localStorage.getItem('educo_last_backup_date');
      const isAutoBackupEnabled = localStorage.getItem('educo_auto_backup_enabled') !== 'false';
      
      if (lastBackupDate !== todayDate && isAutoBackupEnabled) {
        const timer = setTimeout(() => {
          if (window.confirm("La sauvegarde automatique quotidienne est prête. Voulez-vous télécharger le fichier de sauvegarde JSON maintenant ?")) {
            handleExportBackup();
            localStorage.setItem('educo_last_backup_date', todayDate);
          } else {
            localStorage.setItem('educo_last_backup_date', todayDate);
          }
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [loggedInRole, schoolSettings, users, classes, fees, payments, transactions, personnel, budget, academicYear, subjects, grades, reportCardComments, attendance, activityLog, messageTemplates, cashierSettings, rafSettings,
      communicationSettings, timetable, homeworkDiary, financialEvents, addActivityLog]);

  if (loadingAuth || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#EBF3F8]">
        <LogoIcon className="w-24 h-24 animate-pulse" />
        <p className="mt-4 text-lg font-semibold text-[#1F4A59]">Chargement des données...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#EBF3F8]">
        <div className="text-center p-8 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-red-600">Erreur</h2>
          <p className="mt-2 text-gray-700">{error}</p>
        </div>
      </div>
    );
  }

  if (pendingOtpUser) {
    return (
      <OtpValidationPage
        email={pendingOtpUser.email}
        mode="login"
        onValidate={() => {
          setOtpVerified(true);
          sessionStorage.setItem('otpVerified', 'true');
          setCurrentUser(pendingOtpUser);
          setPendingOtpUser(null);
          setActivePage('Tableau de bord');
        }}
        onCancel={() => {
          setPendingOtpUser(null);
          setOtpVerified(false);
          sessionStorage.removeItem('otpVerified');
          localStorage.removeItem('EDUCO_CURRENT_USER');
          localStorage.removeItem('EDUCO_USER_TOKEN');
        }}
      />
    );
  }

  if (!currentUser) {
    if (activePage === 'AdminSpecialLogin') {
      return <AdminSpecialLoginPage onBack={() => setActivePage('Tableau de bord')} onLogin={handleLogin} />;
    }
    return (
      <div className="relative">
        {inactivityNotice && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-lg w-[90%] p-4 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-2xl shadow-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <p className="font-extrabold text-amber-950 dark:text-amber-100 uppercase tracking-tight">Déconnexion Automatique</p>
              <p className="text-amber-800 dark:text-amber-300 mt-0.5 font-medium">{inactivityNotice}</p>
            </div>
            <button onClick={() => setInactivityNotice(null)} className="text-amber-600 hover:text-amber-800 dark:text-amber-400 p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <LoginPage onLogin={handleLogin} onNavigateToAdmin={() => setActivePage('AdminSpecialLogin')} users={users} />
      </div>
    );
  }

  const userProfile = { name: currentUser?.name || 'Utilisateur', role: loggedInRole, avatar: currentUser?.avatar || '' };
  const chatEnabledRoles = ['Admin', 'Promoteur', 'Responsable des finances', 'Enseignant', 'Directeur des Etudes'];

  // FIX: Converted renderContent from a function call to a proper component
  // to resolve React error #525 (Invalid Hook call). This is a critical fix
  // for application stability.
  const RenderContent = () => {
    const isSubscriptionActive = loggedInRole === 'Admin' || (subscriptionInfo?.isActive ?? false);

    const renderLockedGuard = (name: string) => (
      <LockedFeatureGuard
        featureName={name}
        subscriptionInfo={subscriptionInfo}
        onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
        onNavigateToRegistration={() => setActivePage('Inscriptions & Élèves')}
      />
    );

    if (activePage === 'Messagerie' || activePage === 'Messagerie Interne' || activePage === 'Messagerie Inter-Établissements' || activePage === 'Messagerie Inter-Établissement') {
      return (
        <MessagingCenter
          currentUser={currentUser!}
          schoolSettings={schoolSettings}
          users={users}
        />
      );
    }

    if (activePage === 'Profil Élève' && viewingStudentId) {
        const student = users.find(u => u.id === viewingStudentId);
        if (student) {
            return (
                <StudentProfilePage
                    student={student}
                    grades={grades.filter(g => g.studentId === viewingStudentId)}
                    attendance={attendance.filter(a => a.studentId === viewingStudentId)}
                    comments={reportCardComments.find(c => c.studentId === viewingStudentId)}
                    subjects={subjects}
                    schoolSettings={schoolSettings}
                    onBack={() => { setViewingStudentId(null); setActivePage('Élèves'); }}
                    onDeleteStudent={handleDeleteUser}
                    currentUserRole={loggedInRole}
                    onToggleActivateStudent={handleToggleStudentAccountActivation}
                />
            );
        }
    }

    if (loggedInRole === 'Parent' || loggedInRole === 'Parent d\'élève') {
      if (activePage === 'Sondages Parents' || activePage === 'Sondages & Enquêtes Parents') {
        return <ParentSurveysHub />;
      }
      return (
        <ParentDashboard
          currentUser={currentUser!}
          users={users}
          payments={payments}
          grades={grades}
          reportCardComments={reportCardComments}
          subjects={subjects}
          classes={classes}
          homeworkDiary={homeworkDiary}
          timetable={timetable}
          attendance={attendance}
          schoolSettings={schoolSettings}
          transactions={transactions}
          fees={fees}
          setActivePage={setActivePage}
        />
      );
    }

    if (loggedInRole === 'Élève') {
      const studentUser = users.find(u => u.id === currentUserId);
      const studentPayment = payments.find(p => p.studentId === studentUser?.studentId);
      const studentGrades = grades.filter(g => g.studentId === currentUserId);
      const studentComments = reportCardComments.find(c => c.studentId === currentUserId);
      
      switch(activePage) {
        case 'Tableau de bord':
          return <StudentDashboard user={studentUser} classes={classes} setActivePage={setActivePage} />;
        case 'Mes Notes':
          return <StudentGradesPage 
                    student={studentUser}
                    grades={studentGrades} 
                    comments={studentComments}
                    subjects={subjects}
                    schoolSettings={schoolSettings}
                  />;
        case 'Paiements':
          return <StudentPaymentsPage paymentInfo={studentPayment} transactions={transactions.filter(t => studentPayment && t.description.includes(studentPayment.name))} schoolSettings={schoolSettings} />;
        case 'Emploi du temps':
          return <TimetablePage currentUserRole={loggedInRole} timetable={timetable} classes={classes} subjects={subjects} users={users} onSave={handleSaveTimetableEntry} onDelete={handleDeleteTimetableEntry} />;
        case 'Cahier de Texte':
            return <HomeworkDiaryPage currentUserRole={loggedInRole} homeworkDiary={homeworkDiary} classes={classes} subjects={subjects} onSave={handleSaveHomeworkEntry} />;
        case 'Calendrier des Paiements':
            return <FinancialCalendar events={financialEvents} onSave={handleSaveFinancialEvent} onDelete={handleDeleteFinancialEvent} currentUserRole={loggedInRole} />;
        default:
          return <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">Page "{activePage}" en construction.</div>;
      }
    }

    // Special Hub for Super Admin Subscription Management
    if (activePage === 'Gestion des Licences & Abonnements' || activePage === 'Gestion des Abonnements') {
      if (loggedInRole === 'Admin') {
        return <AdminSubscriptionHub />;
      }
      return renderLockedGuard('Gestion des Abonnements (Réservé Super-Admin)');
    }

    // Subscription & License Information Page for Promoters, RAF, DG, Cashier
    if (activePage === 'Abonnement & Licence' || activePage === 'Abonnements') {
      if (loggedInRole === 'Admin') {
        return <AdminSubscriptionHub />;
      }
      return (
        <SubscriptionModal
          isOpen={true}
          onClose={() => setActivePage('Tableau de bord')}
          subscriptionInfo={subscriptionInfo}
          isLoading={isSubscriptionLoading}
          onSubscriptionUpdated={loadSubscription}
          userRole={loggedInRole || undefined}
        />
      );
    }

    // Subscription Gating for Restricted Pages
    if (!isSubscriptionActive && loggedInRole !== 'Admin') {
      const allowedPages = ['Tableau de bord', 'Inscriptions & Élèves', 'Utilisateurs', 'Élèves', 'Profil Élève', 'AdminSpecialLogin'];
      if (!allowedPages.includes(activePage)) {
        return renderLockedGuard(activePage);
      }
    }

    switch(activePage) {
      case 'AdminSpecialLogin':
        if (currentUser) {
          if (loggedInRole === 'Admin') {
            return (
              <AdminDashboard 
                onNavigate={setActivePage}
                users={users}
                payments={payments}
                attendance={attendance}
              />
            );
          }
          return (
            <SchoolOverview 
              topClasses={topClasses} 
              users={users} 
              payments={payments} 
              personnel={personnel}
              budget={budget}
              transactions={transactions}
              grades={grades}
              classes={classes}
            />
          );
        }
        return <AdminSpecialLoginPage onBack={() => setActivePage('Tableau de bord')} onLogin={handleLogin} />;
      case 'Tableau de bord':
        const dashboardBanner = !isSubscriptionActive && loggedInRole !== 'Admin' && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-amber-900 animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-700 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-amber-800">
                  Mode Inscription Uniquement • Licence Non Activée
                </p>
                <p className="text-xs text-amber-950">
                  Vous pouvez inscrire vos élèves. Pour déverrouiller tous les modules (Notes, Comptabilité, Trésorerie), activez votre code d'abonnement.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSubscriptionModalOpen(true)}
              className="px-4 py-2 bg-[#1F4A59] hover:bg-[#275d70] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
            >
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Activer un Code</span>
            </button>
          </div>
        );

        if (loggedInRole === 'Caissière') {
          return (
            <div>
              {dashboardBanner}
              <CashierDashboard 
                setActivePage={setActivePage} 
                handleSaveSinglePayment={handleSaveSinglePayment}
                handleSaveUser={handleSaveUser}
                handlePaySalary={handlePaySalary}
                transactions={transactions}
                payments={payments}
                users={users}
                classes={classes}
                fees={fees}
                personnel={personnel}
                attendance={attendance}
                financialEvents={financialEvents}
                rafSettings={rafSettings}
                communicationSettings={communicationSettings || initialCommunicationSettings}
                onSaveCommunicationSettings={handleSaveCommunicationSettings}
                schoolSettings={schoolSettings}
                isCaisseOpen={isCaisseOpen}
                currentUserRole={loggedInRole}
                onEditTransaction={handleEditTransaction}
                cashierSettings={cashierSettings}
              />
            </div>
          );
        }
        if (loggedInRole === 'Responsable des finances') {
            return (
              <div>
                {dashboardBanner}
                <FinanceManagerDashboard 
                  transactions={transactions} 
                  payments={payments}
                  users={users}
                  budget={budget?.total}
                  budgetObject={budget}
                  onUpdateBudget={handleUpdateBudget}
                  currentUserRole={loggedInRole}
                  classes={classes}
                  personnel={personnel}
                  handlePaySalary={handlePaySalary}
                  handleSaveExpense={handleSaveExpense}
                  setActivePage={setActivePage}
                  handleSaveUser={handleSaveUser}
                  handleSaveSinglePayment={handleSaveSinglePayment}
                  fees={fees}
                  schoolSettings={schoolSettings}
                  rafSettings={rafSettings}
                  communicationSettings={communicationSettings || initialCommunicationSettings}
                  onSaveCommunicationSettings={handleSaveCommunicationSettings}
                />
              </div>
            );
        }
        if (loggedInRole === 'Promoteur') {
            return (
              <div>
                {dashboardBanner}
                <PromoterDashboard
                  users={users}
                  payments={payments}
                  budget={budget}
                  transactions={transactions}
                  topClasses={topClasses}
                  classes={classes}
                  attendance={attendance}
                  personnel={personnel}
                  fees={fees}
                  grades={grades}
                  financialEvents={financialEvents}
                  schoolSettings={schoolSettings}
                  setActivePage={setActivePage}
                  onUpdateTransactionStatus={handleUpdateTransactionStatus}
                  subscriptionInfo={subscriptionInfo}
                  isLicenseActive={isSubscriptionActive}
                  onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
                />
              </div>
            );
        }
        if (loggedInRole === 'Enseignant') {
          const teacherClasses = classes.filter((schoolClass: any) => String(schoolClass.teacherId ?? schoolClass.teacher_id ?? '') === String(currentUserId ?? ''));
          const teacherClassIds = new Set(teacherClasses.map((schoolClass: any) => String(schoolClass.id)));
          const teacherClassNames = new Set(teacherClasses.map((schoolClass: any) => String(schoolClass.name)));
          const teacherStudents = users.filter((user: any) => user.role === 'Élève' && teacherClassNames.has(String(user.class || user.className || '')));
          const teacherStudentIds = new Set(teacherStudents.map((student: any) => String(student.id)));
          const teacherAttendance = attendance.filter((record: any) =>
            teacherClassIds.has(String(record.classId ?? record.class_id ?? ''))
            || teacherClassNames.has(String(record.className || ''))
            || teacherStudentIds.has(String(record.studentId ?? record.student_id ?? ''))
          );
          return <TeacherDashboard setActivePage={setActivePage} classes={teacherClasses} attendance={teacherAttendance} users={teacherStudents} />;
        }
         if (loggedInRole === 'Directeur des Etudes') {
          return (
            <div>
              {dashboardBanner}
              <DEDashboard users={users} attendance={attendance} classes={classes} subjects={subjects} financialEvents={financialEvents} setActivePage={setActivePage} />
            </div>
          );
        }
        // Default to Admin / Directeur Général (DG)
        if (loggedInRole === 'Admin') {
          return (
            <div>
              {dashboardBanner}
              <AdminDashboard 
                onNavigate={setActivePage}
                users={users}
                payments={payments}
                attendance={attendance}
              />
            </div>
          );
        }
        return (
          <div>
            {dashboardBanner}
            <SchoolOverview 
              topClasses={topClasses} 
              users={users} 
              payments={payments} 
              personnel={personnel}
              budget={budget}
              transactions={transactions}
              grades={grades}
              classes={classes}
              attendance={attendance}
              schoolSettings={schoolSettings}
              setActivePage={setActivePage}
            />
          </div>
        );
      case 'Inscriptions & Élèves':
      case 'Utilisateurs':
      case 'Utilisateurs & Comptes':
        return <UserManagementPage 
                  users={users} 
                  onSaveUser={handleSaveUser} 
                  onDeleteUser={handleDeleteUser} 
                  currentUserRole={loggedInRole}
                  currentUser={currentUser}
                  classes={classes}
                  fees={fees}
                  schoolSettings={schoolSettings}
                  isLicenseActive={isSubscriptionActive}
                  subscriptionInfo={subscriptionInfo}
                  onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
                  onToggleActivateStudent={handleToggleStudentAccountActivation}
               />;
      case 'Paiements':
        return <PaymentsPage 
                  payments={payments}
                  onSavePayment={handleSaveSinglePayment}
                  currentUserRole={loggedInRole}
                  transactions={transactions}
                  users={users}
                  classes={classes}
                  schoolSettings={schoolSettings}
                  isCaisseOpen={isCaisseOpen}
               />;
      case 'Personnel':
        return <PersonnelPage
                  personnel={personnel}
                  transactions={transactions}
                  onPaySalary={handlePaySalary}
                  onSavePersonnel={handleSavePersonnel}
                  onDeletePersonnel={handleDeletePersonnel}
                  currentUserRole={loggedInRole}
                  rafSettings={rafSettings}
                    communicationSettings={communicationSettings || initialCommunicationSettings}
                    onSaveCommunicationSettings={handleSaveCommunicationSettings}
                  schoolSettings={schoolSettings}
                  isCaisseOpen={isCaisseOpen}
                />;
      case 'Rapports':
      case 'Rapports Financiers':
        return <FinancialReportsPage 
                  transactions={transactions}
                  payments={payments}
                  budget={budget}
                  classes={classes}
                  users={users}
                  personnel={personnel}
                  schoolSettings={schoolSettings}
                />;
      case 'Audit & Contrôle':
        return <AuditPage
                  activityLog={activityLog}
                  transactions={transactions}
                  payments={payments}
                  budget={budget}
                  users={users}
                  addNotification={addNotification}
                />;
      case 'Opérations à valider':
      case 'Validation Opérations':
        return <OperationsValidationPage transactions={transactions} onUpdateStatus={handleUpdateTransactionStatus} currentUserRole={loggedInRole} schoolSettings={schoolSettings} />;
      case 'Transactions':
      case 'Comptabilité':
        return <AccountingPage 
                  transactions={transactions} 
                  onSaveExpense={handleSaveExpense}
                  onSaveRevenue={handleSaveRevenue}
                  schoolSettings={schoolSettings}
                  currentUserRole={loggedInRole}
                  onEditTransaction={handleEditTransaction}
                  cashierSettings={cashierSettings}
                />;
      case 'Calendrier Financier':
      case 'Calendrier des Échéances':
        return <FinancialCalendar 
                  events={financialEvents}
                  onSave={handleSaveFinancialEvent}
                  onDelete={handleDeleteFinancialEvent}
                  currentUserRole={loggedInRole}
                />;
      case 'Présences':
      case 'Mes Classes':
        return <TeacherClassesPage
                  classes={classes}
                  students={users.filter(u => u.role === 'Élève')}
                  attendance={attendance}
                  onSaveAttendance={handleSaveAttendance}
                />;
      case 'Notes':
      case 'Gestion des Notes':
      case 'Saisie des Notes':
        return <GradesManagementPage
                  currentUserRole={loggedInRole}
                  currentUserId={currentUserId}
                  classes={classes}
                  students={users.filter(u => u.role === 'Élève')}
                  grades={grades}
                  onSaveGrade={handleSaveGrade}
                  reportCardComments={reportCardComments}
                  onSaveReportCardComments={handleSaveReportCardComments}
                  subjects={subjects}
                  schoolSettings={schoolSettings}
               />;
      case 'Élèves':
        return <StudentListPage 
                  students={users.filter(u => u.role === 'Élève')}
                  onViewProfile={handleViewStudentProfile}
                  onDeleteStudent={handleDeleteUser}
                  currentUserRole={loggedInRole}
                  schoolSettings={schoolSettings}
                  onToggleActivateStudent={handleToggleStudentAccountActivation}
                />;
      case 'Matières & Enseignants':
          return <SubjectsManagementPage 
                    subjects={subjects}
                    teachers={users.filter(u => u.role === 'Enseignant')}
                    onSaveSubject={handleSaveSubject}
                    onDeleteSubject={handleDeleteSubject}
                 />;
      case 'Structures Scolaires':
          return <SchoolStructurePage
                    academicYear={academicYear}
                    classes={classes}
                    onUpdateAcademicYear={handleUpdateAcademicYear}
                    onSaveClass={handleSaveClass}
                    onDeleteClass={handleDeleteClass}
                  />;
      case 'Tarification':
          return <PricingPage
                    fees={fees}
                    classes={classes}
                    onSaveFee={handleSaveFee}
                    onDeleteFee={handleDeleteFee}
                    schoolSettings={schoolSettings}
                    currentUserRole={loggedInRole}
                  />;
      case 'Emploi du temps':
          return <TimetablePage currentUserRole={loggedInRole} timetable={timetable} classes={classes} subjects={subjects} users={users} onSave={handleSaveTimetableEntry} onDelete={handleDeleteTimetableEntry} />;
      case 'Cahier de Texte':
          return <HomeworkDiaryPage currentUserRole={loggedInRole} homeworkDiary={homeworkDiary} classes={classes} subjects={subjects} onSave={handleSaveHomeworkEntry} />;
      case 'Paramètres':
          return <SettingsPage
                    currentUserRole={loggedInRole}
                    currentUser={currentUser || undefined}
                    onUpdateAvatar={handleUpdateAvatar}
                    schoolSettings={schoolSettings}
                    onSaveSchoolSettings={handleSaveSchoolSettings}
                    subjects={subjects}
                    onSaveSubject={handleSaveSubject}
                    onDeleteSubject={handleDeleteSubject}
                    messageTemplates={messageTemplates}
                    onSaveMessageTemplate={handleSaveMessageTemplate}
                    cashierSettings={cashierSettings}
                    onSaveCashierSettings={handleSaveCashierSettings}
                    rafSettings={rafSettings}
                    communicationSettings={communicationSettings || initialCommunicationSettings}
                    onSaveCommunicationSettings={handleSaveCommunicationSettings}
                    onSaveRafSettings={handleSaveRafSettings}
                    teachers={users.filter(u => u.role === 'Enseignant')}
                    users={users}
                    onSaveUser={handleSaveUser}
                    onExportBackup={handleExportBackup}
                    onRestoreBackup={handleRestoreBackup}
                    inactivityTimeoutMinutes={inactivityTimeoutMinutes}
                    onUpdateInactivityTimeout={(mins) => setInactivityTimeoutMinutes(mins)}
                  />;
      case 'Établissements Inscrits':
      case 'Établissements BD':
        return <AdminSchoolsDirectory onOpenLicenseHub={() => setActivePage('Licences & Abonnements')} onDeleteSchool={handleDeleteSchool} />;
      case 'Gestion des Licences & Abonnements':
      case 'Licences & Abonnements':
        return <AdminSubscriptionHub onSelectSchool={(sch) => console.log(sch)} />;
      case 'Gestion Utilisateurs':
        return <UserManagementPage 
                  users={users} 
                  onSaveUser={handleSaveUser} 
                  onDeleteUser={handleDeleteUser} 
                  currentUserRole={loggedInRole}
                  classes={classes}
                  fees={fees}
                  schoolSettings={schoolSettings}
                  isLicenseActive={isSubscriptionActive}
                  subscriptionInfo={subscriptionInfo}
                  onOpenSubscriptionModal={() => setIsSubscriptionModalOpen(true)}
               />;
      case 'Console Supabase':
        return <AdminSupabaseConsole />;
      case 'Sauvegardes & BD':
        return <AdminBackupsPage 
                  onExportBackup={handleExportBackup}
                  onRestoreBackup={handleRestoreBackup}
                  onResetAllData={handleResetAllData}
                  onResetSchoolData={handleResetSchoolData}
                />;
      case 'Présences par Établissement':
        return <AdminAttendanceAnalyticsPage />;
      case 'Diagnostic Supabase':
        return <AdminDiagnosticPage />;
      case 'Surveillance Finances':
        return <AdminFinancialSurveillancePage />;
      case 'Revenus vs Dépenses':
        return <AdminRevenuesExpensesPage />;
      case 'Messagerie Établissements':
        return <AdminBroadcastMessagingPage />;
      case 'Gestion de l\'IA':
        return <AdminAIManagerPage />;
      case 'Sondages & Enquêtes Parents':
      case 'Sondages Parents':
        return <ParentSurveysHub />;
      default:
        return <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">Page "{activePage}" en construction.</div>;
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      theme === 'dark' 
        ? 'dark bg-gradient-to-br from-slate-900 via-[#0B132B] to-slate-950 text-slate-100' 
        : 'bg-gradient-to-br from-gray-50 to-blue-100 text-[#2C3A47]'
    }`}>
      <Sidebar 
        isOpen={sidebarOpen} 
        setIsOpen={setSidebarOpen}
        currentUser={currentUser}
        onUpdateAvatar={handleUpdateAvatar}
        onLogout={handleLogout}
        activePage={activePage}
        setActivePage={setActivePage}
        onOpenSearch={() => setIsMobileSearchOpen(true)}
      />
      
      <div className="lg:pl-72 transition-all duration-500 ease-in-out">
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-all shadow-xs">
          <div className="h-16 px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Left Section: Mobile Menu & Simple Title */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
              <button
                className="lg:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 shrink-0 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir le menu"
              >
                <MenuIcon className="w-5 h-5" />
              </button>
              
              {/* Clean Title */}
              <div className="min-w-0">
                <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                  <span className="text-[#1F4A59] dark:text-sky-400 font-extrabold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    {loggedInRole || 'Espace Utilisateur'}
                  </span>
                  <span>/</span>
                  <span className="truncate">{activePage}</span>
                </div>
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white truncate tracking-tight">
                  {activePage}
                </h1>
              </div>

              {/* Simple Search Bar (Desktop) */}
              <div className="relative flex-1 max-w-sm hidden md:block group ml-2">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <SearchIcon className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={headerSearchQuery}
                  onChange={(e) => setHeaderSearchQuery(e.target.value)}
                  placeholder="Recherche (élève, utilisateur, matricule...)..."
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 focus:bg-white dark:focus:bg-slate-900 focus:border-[#1F4A59] dark:focus:border-sky-500 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 transition-all outline-none"
                />
                {headerSearchQuery && (
                  <button
                    onClick={() => setHeaderSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Instant Search Results Dropdown */}
                {headerSearchQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 p-3 text-xs animate-in fade-in max-h-80 overflow-y-auto">
                    {(() => {
                      const searchableUsers = users.filter(u => {
                        if (loggedInRole !== 'Admin' && (u.role === 'Admin' || u.role === 'SuperAdmin')) return false;
                        return true;
                      });
                      const matchingUsers = searchableUsers.filter(u => 
                        u.name?.toLowerCase().includes(headerSearchQuery.toLowerCase()) || 
                        u.email?.toLowerCase().includes(headerSearchQuery.toLowerCase()) || 
                        u.studentId?.toLowerCase().includes(headerSearchQuery.toLowerCase())
                      );

                      return (
                        <>
                          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
                            <p className="font-bold text-slate-400 text-[10px] uppercase">Résultats rapides</p>
                            <span className="text-[10px] text-slate-400 font-bold">
                              {matchingUsers.length} trouvés
                            </span>
                          </div>

                          {matchingUsers.slice(0, 6).map(u => (
                            <div 
                              key={u.id}
                              onClick={() => {
                                setHeaderSearchQuery('');
                                if (u.role === 'Élève') {
                                  handleViewStudentProfile(u.id as number);
                                } else {
                                  setActivePage('Gestion Utilisateurs');
                                }
                              }}
                              className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors group/item"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <img 
                                  src={u.avatar || 'https://via.placeholder.com/150'} 
                                  alt="" 
                                  className="w-6 h-6 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                                />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">{u.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{u.email || u.studentId || 'Sans matricule'}</p>
                                </div>
                              </div>
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-md shrink-0">
                                {u.role}
                              </span>
                            </div>
                          ))}

                          {matchingUsers.length === 0 && (
                            <div className="py-3 text-center text-slate-400 text-xs">
                              <span>Aucun résultat pour "{headerSearchQuery}"</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
            
            {/* Right Section: Clean Status & Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {/* Mobile Quick Search Button */}
              <button
                onClick={() => setIsMobileSearchOpen(true)}
                className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Rechercher"
                aria-label="Rechercher"
              >
                <SearchIcon className="w-5 h-5" />
              </button>

              {/* Compact DB Status Indicator */}
              <div 
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/80 dark:border-slate-700/80"
                title="Statut Base de Données"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[11px]">{loggedInRole === 'Admin' || loggedInRole === 'Co-admin' ? 'Supabase & PostgreSQL' : 'Base de Données En Ligne'}</span>
              </div>

              {/* License Quick Button for Admin */}
              {loggedInRole === 'Admin' && (
                <button
                  onClick={() => setActivePage('Licences & Abonnements')}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#1F4A59] text-white hover:bg-[#183944] transition-all cursor-pointer active:scale-95 shadow-xs"
                >
                  <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Licences</span>
                </button>
              )}

              {/* Theme Switcher Button */}
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-xl text-slate-600 dark:text-amber-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
                aria-label="Basculer le mode sombre/clair"
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>

              {/* Messaging Button */}
              <button 
                onClick={() => setActivePage('Messagerie')}
                className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                title="Messagerie"
                aria-label="Messagerie"
              >
                <ChatIcon />
              </button>

              {/* Notification Bell */}
              <NotificationBell
                notifications={notifications}
                currentUserRole={loggedInRole}
                onMarkAsRead={handleMarkNotificationsAsRead}
                onMarkSingleAsRead={handleMarkSingleNotificationAsRead}
                onDeleteNotification={handleDeleteNotification}
                onClearAllNotifications={handleClearAllNotifications}
                onNotificationClick={handleNotificationClick}
              />

              {/* Admin Profile Avatar */}
              <div className="relative border-l border-slate-200 dark:border-slate-800 pl-2">
                <input 
                  type="file" 
                  ref={headerFileInputRef} 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        handleUpdateAvatar(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }} 
                  className="hidden" 
                  accept="image/*"
                />

                <button 
                  onClick={() => setIsProfileMenuOpen(prev => !prev)}
                  className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group text-left cursor-pointer"
                >
                  <img 
                    src={currentUser?.avatar || 'https://via.placeholder.com/150'} 
                    alt={currentUser?.name || 'Utilisateur'} 
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700" 
                  />
                  <div className="hidden md:block leading-tight">
                    <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate max-w-[100px]">{currentUser?.name || loggedInRole || 'Utilisateur'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{currentUser?.role || loggedInRole || 'Utilisateur'}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" />
                </button>

                {/* Profile Dropdown Popup */}
                {isProfileMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsProfileMenuOpen(false)} 
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
                      {/* User Card Header */}
                      <div className="flex items-center gap-3 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="relative group/avatar shrink-0">
                          <img 
                            src={currentUser?.avatar || 'https://via.placeholder.com/150'} 
                            alt={currentUser?.name || 'Utilisateur'} 
                            className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
                          />
                          <button 
                            onClick={() => headerFileInputRef.current?.click()}
                            className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity text-white cursor-pointer"
                            title="Changer la photo de profil"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-sm text-slate-900 dark:text-slate-100 truncate">{currentUser?.name || loggedInRole || 'Utilisateur'}</h3>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">{currentUser?.email || (loggedInRole === 'Admin' ? 'admin@educo.app' : 'contact@educo.cg')}</p>
                          <span className="inline-block mt-1 px-2.5 py-0.5 bg-[#1F4A59]/10 text-[#1F4A59] dark:bg-sky-400/10 dark:text-sky-300 font-extrabold text-[10px] rounded-full border border-[#1F4A59]/20">
                            {currentUser?.role || loggedInRole || 'Utilisateur'}
                          </span>
                        </div>
                      </div>

                      {/* Action Links */}
                      <div className="space-y-1 text-xs">
                        <button 
                          onClick={() => {
                            headerFileInputRef.current?.click();
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer"
                        >
                          <Camera className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
                          <span>Changer Photo de Profil</span>
                        </button>

                        <button 
                          onClick={() => {
                            setActivePage('Paramètres');
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-slate-500" />
                          <span>Paramètres du Compte</span>
                        </button>

                        <button 
                          onClick={() => {
                            setActivePage('Gestion Utilisateurs');
                            setIsProfileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-colors cursor-pointer"
                        >
                          <UserIcon className="w-4 h-4 text-slate-500" />
                          <span>Gestion des Utilisateurs</span>
                        </button>

                        {loggedInRole === 'Admin' && (
                          <button 
                            onClick={() => {
                              setActivePage('Gestion des Licences & Abonnements');
                              setIsProfileMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl font-bold transition-colors cursor-pointer"
                          >
                            <Key className="w-4 h-4 text-emerald-500" />
                            <span>Hub Licences & Abonnements</span>
                          </button>
                        )}

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                          <button 
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              handleLogout();
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl font-black transition-colors cursor-pointer"
                          >
                            <LogOut className="w-4 h-4 text-rose-500" />
                            <span>Déconnexion</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {isChatOpen && currentUser && (
            <MessagingPanel
                messages={messages}
                currentUserProfile={{
                    name: currentUser.name,
                    avatar: currentUser?.avatar || '',
                    role: currentUser.role
                }}
                onSendMessage={handleSendMessage}
                onClose={() => setIsChatOpen(false)}
            />
        )}

        <main className="p-3 sm:p-6 lg:p-8 flex-1 pb-24 lg:pb-8">
          <RenderContent />
        </main>

        {/* Global Persistent Footer */}
        <footer className="mt-20 sm:mt-28 pb-10 pt-8 border-t border-slate-200/70 dark:border-slate-800/70 text-center px-4 transition-colors">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-bold text-slate-800 dark:text-slate-200 tracking-wide">
              EDUCO APP
            </span>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-600">•</span>
            <span>
              développée par <strong className="font-black text-[#1F4A59] dark:text-teal-400">LoukaTech</strong>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
            Plateforme Intégrée de Gestion Scolaire, Administrative & Financière
          </p>
        </footer>

        {currentUser && (
          <MobileBottomNav
            activePage={activePage}
            setActivePage={setActivePage}
            userRole={loggedInRole || ''}
            unreadMessagesCount={messages.filter(m => !m.read && m.recipientId === currentUserId).length}
            unreadNotificationsCount={notifications.filter(n => !n.read).length}
            onOpenMenu={() => setSidebarOpen(true)}
          />
        )}

        <MobileQuickSearchModal
          isOpen={isMobileSearchOpen}
          onClose={() => setIsMobileSearchOpen(false)}
          users={users}
          activePage={activePage}
          setActivePage={setActivePage}
          onSelectStudentProfile={handleViewStudentProfile}
          userRole={loggedInRole || ''}
        />

        <AlertDialogModal
          isOpen={appAlert.isOpen}
          onClose={() => setAppAlert(prev => ({ ...prev, isOpen: false }))}
          title={appAlert.title}
          message={appAlert.message}
          type={appAlert.type}
        />

        {passkeyPromptUser && (
          <PasskeyRegisterPromptModal
            isOpen={!!passkeyPromptUser}
            onClose={() => setPasskeyPromptUser(null)}
            userEmail={passkeyPromptUser.email}
            userId={passkeyPromptUser.userId}
            userName={passkeyPromptUser.name}
            onSuccess={() => setPasskeyPromptUser(null)}
          />
        )}

        <SubscriptionModal
          isOpen={isSubscriptionModalOpen}
          onClose={() => setIsSubscriptionModalOpen(false)}
          subscriptionInfo={subscriptionInfo}
          isLoading={isSubscriptionLoading}
          onSubscriptionUpdated={() => {
            loadSubscription();
          }}
          userRole={loggedInRole || 'Promoteur'}
        />
      </div>
    </div>
  );
};

export default App;

