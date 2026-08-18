import React from 'react';
import { 
  DashboardIcon, ClassesIcon, StudentsIcon, TeachersIcon, 
  SettingsIcon, PaymentsIcon, BriefcaseIcon, BuildingLibraryIcon,
  TransactionsIcon, GradesIcon, AttendanceIcon, BudgetingIcon,
  TimetableIcon, GlobalStatsIcon, ReportingIcon, UsersIcon, BellIcon,
  TagIcon, CalculatorIcon, ShieldCheckIcon, LogoutIcon, MessageIcon,
  DatabaseIcon, SparklesIcon
} from './components/Icons';

export const USER_ROLES = [
  'Admin',
  'Co-admin',
  'Promoteur',
  'Directeur Général',
  'Directeur des Etudes',
  'Directeur du Primaire',
  'Responsable des finances',
  'Surveillant Général',
  'Surveillant Général Adjoint',
  'Caissière',
  'Enseignant',
  'Élève',
  'Parent',
  'Parent d\'élève'
];

export const USER_PROFILES: { [key: string]: { name: string; role: string; avatar: string } } = {};
export const USER_CREDENTIALS: { [key: string]: { password: string; role: string } } = {};

export const TRANSACTION_CATEGORIES_EXPENSE = ['Salaires', 'Fournitures', 'Maintenance', 'Factures', 'Marketing', 'Autres'];
export const TRANSACTION_CATEGORIES_REVENUE = ['Scolarité', 'Frais de cantine', 'Dons', 'Location de locaux', 'Autres'];

export const ROLE_NAV_ITEMS: { [key: string]: { label: string; icon: React.ElementType }[] } = {
  'Admin': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Licences & Abonnements', icon: ShieldCheckIcon },
    { label: 'Gestion Utilisateurs', icon: UsersIcon },
    { label: 'Console Supabase', icon: DatabaseIcon },
    { label: 'Établissements BD', icon: BuildingLibraryIcon },
    { label: 'Sauvegardes & BD', icon: DatabaseIcon },
    { label: 'Présences par Établissement', icon: AttendanceIcon },
    { label: 'Diagnostic Supabase', icon: GlobalStatsIcon },
    { label: 'Surveillance Finances', icon: PaymentsIcon },
    { label: 'Revenus vs Dépenses', icon: ReportingIcon },
    { label: 'Messagerie Établissements', icon: MessageIcon },
    { label: 'Gestion de l\'IA', icon: SparklesIcon },
    { label: 'Paramètres', icon: SettingsIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Co-admin': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Licences & Abonnements', icon: ShieldCheckIcon },
    { label: 'Gestion Utilisateurs', icon: UsersIcon },
    { label: 'Console Supabase', icon: DatabaseIcon },
    { label: 'Établissements BD', icon: BuildingLibraryIcon },
    { label: 'Sauvegardes & BD', icon: DatabaseIcon },
    { label: 'Présences par Établissement', icon: AttendanceIcon },
    { label: 'Diagnostic Supabase', icon: GlobalStatsIcon },
    { label: 'Surveillance Finances', icon: PaymentsIcon },
    { label: 'Revenus vs Dépenses', icon: ReportingIcon },
    { label: 'Messagerie Établissements', icon: MessageIcon },
    { label: 'Gestion de l\'IA', icon: SparklesIcon },
    { label: 'Paramètres', icon: SettingsIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Promoteur': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Sondages & Enquêtes Parents', icon: ReportingIcon },
    { label: 'Inscriptions & Élèves', icon: StudentsIcon },
    { label: 'Abonnement & Licence', icon: ShieldCheckIcon },
    { label: 'Paiements', icon: PaymentsIcon },
    { label: 'Comptabilité', icon: CalculatorIcon },
    { label: 'Personnel', icon: BriefcaseIcon },
    { label: 'Utilisateurs & Comptes', icon: UsersIcon },
    { label: 'Notes', icon: GradesIcon },
    { label: 'Validation Opérations', icon: ShieldCheckIcon },
    { label: 'Rapports Financiers', icon: ReportingIcon },
    { label: 'Paramètres', icon: SettingsIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Directeur Général': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Sondages & Enquêtes Parents', icon: ReportingIcon },
    { label: 'Inscriptions & Élèves', icon: StudentsIcon },
    { label: 'Structures Scolaires', icon: BuildingLibraryIcon },
    { label: 'Notes', icon: GradesIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Cahier de Texte', icon: ClassesIcon },
    { label: 'Paiements', icon: PaymentsIcon },
    { label: 'Personnel', icon: BriefcaseIcon },
    { label: 'Rapports Financiers', icon: ReportingIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Directeur du Primaire': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Sondages & Enquêtes Parents', icon: ReportingIcon },
    { label: 'Inscriptions & Élèves', icon: StudentsIcon },
    { label: 'Structures Scolaires', icon: BuildingLibraryIcon },
    { label: 'Notes', icon: GradesIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Cahier de Texte', icon: ClassesIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Responsable des finances': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Sondages & Enquêtes Parents', icon: ReportingIcon },
    { label: 'Inscriptions & Élèves', icon: StudentsIcon },
    { label: 'Abonnement & Licence', icon: ShieldCheckIcon },
    { label: 'Paiements', icon: PaymentsIcon },
    { label: 'Comptabilité', icon: CalculatorIcon },
    { label: 'Personnel', icon: BriefcaseIcon },
    { label: 'Calendrier des Échéances', icon: TimetableIcon },
    { label: 'Rapports Financiers', icon: ReportingIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Caissière': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Inscriptions & Élèves', icon: StudentsIcon },
    { label: 'Abonnement & Licence', icon: ShieldCheckIcon },
    { label: 'Paiements', icon: PaymentsIcon },
    { label: 'Calendrier des Paiements', icon: TimetableIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Directeur des Etudes': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Sondages & Enquêtes Parents', icon: ReportingIcon },
    { label: 'Inscriptions & Élèves', icon: StudentsIcon },
    { label: 'Abonnement & Licence', icon: ShieldCheckIcon },
    { label: 'Structures Scolaires', icon: BuildingLibraryIcon },
    { label: 'Notes', icon: GradesIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Cahier de Texte', icon: ClassesIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Surveillant Général': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Inscriptions & Élèves', icon: StudentsIcon },
    { label: 'Structures Scolaires', icon: BuildingLibraryIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Cahier de Texte', icon: ClassesIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Surveillant Général Adjoint': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Inscriptions & Élèves', icon: StudentsIcon },
    { label: 'Structures Scolaires', icon: BuildingLibraryIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Cahier de Texte', icon: ClassesIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Enseignant': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Mes Classes', icon: ClassesIcon },
    { label: 'Saisie des Notes', icon: GradesIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Cahier de Texte', icon: ClassesIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Élève': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Mes Notes', icon: GradesIcon },
    { label: 'Paiements', icon: PaymentsIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Cahier de Texte', icon: ClassesIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Parent': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Suivi de l\'Élève', icon: StudentsIcon },
    { label: 'Notes & Bulletin', icon: GradesIcon },
    { label: 'Paiements & Reçus', icon: PaymentsIcon },
    { label: 'Devoirs & Cahier de texte', icon: ClassesIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Sondages Parents', icon: ReportingIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
  'Parent d\'élève': [
    { label: 'Tableau de bord', icon: DashboardIcon },
    { label: 'Messagerie', icon: MessageIcon },
    { label: 'Suivi de l\'Élève', icon: StudentsIcon },
    { label: 'Notes & Bulletin', icon: GradesIcon },
    { label: 'Paiements & Reçus', icon: PaymentsIcon },
    { label: 'Devoirs & Cahier de texte', icon: ClassesIcon },
    { label: 'Emploi du temps', icon: TimetableIcon },
    { label: 'Sondages Parents', icon: ReportingIcon },
    { label: 'Déconnexion', icon: LogoutIcon },
  ],
};

// --- EMPTY DATA ---
export const usersData: any[] = [];
export const revenueExpenseData: any[] = [];
export const paymentDistributionData: any[] = [];
export const PAYMENT_COLORS = ['#1F4A59', '#42A5F5', '#64B5F6', '#A5D6A7'];
export const topClassesData: any[] = [];
export const studentsPerClassData: any[] = [];
export const dailyCollectionsData: any[] = [];
export const feePaymentStatusData: any[] = [];
export const FEE_STATUS_COLORS = ['#00796B', '#FBC02D', '#D32F2F'];
export const transactionsData: any[] = [];
export const personnelData: any[] = [];
export const studentPaymentsData: any[] = [];
export const budgetData = {
    total: 0,
    categories: []
};
export const initialAcademicYear = { startDate: '', endDate: '' };
export const initialClassesData: any[] = [];
export const initialFeesData: any[] = [];
export const initialSubjectsData: any[] = [];
export const initialGradesData: any[] = [];
export const initialAttendanceData: any[] = [];
export const initialTimetableData: any[] = [];
export const initialHomeworkDiaryData: any[] = [];
export const initialReportCardCommentsData: any[] = [];
export const initialNotifications: any[] = [];
export const initialMessages: any[] = [];
export const initialActivityLog: any[] = [];
export const initialFinancialEvents: any[] = [];

// --- SETTINGS ---
export const initialCommunicationSettings = {
  brevoApiKey: "",
  smsEnabled: false,
  whatsappEnabled: false,
  emailEnabled: true, // Default fallback
  reminderDaysBefore: [7, 3, 1], // Days before deadline to send reminder
  sendPendingPaymentReminders: true,
};

export const initialSchoolSettings = {
    name: "EDUCO Excellence",
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
    dashboardView: "avancé",
};

export const initialMessageTemplates: any[] = [];
export const initialCashierSettings = {
    openingAmount: 0,
    paymentMethods: { cash: true, mobileMoney: false, transfer: false },
    paymentAccounts: { mobileMoney: '', bankAccount: '' },
    receiptTemplate: { footerText: "", printCopies: 1, showQrCode: true },
    defaultViewPeriod: 'day',
    reminders: { closeout: true },
    notifications: { paymentValidated: false, newStudent: false, cashDifference: false },
    operationalHours: { enabled: false, opensAt: '08:00', closesAt: '17:00' },
    personalProfile: { theme: 'light' },
    permissions: { allowRegistration: false, allowStudentPayment: false, allowGeneralExpense: false, allowSalaryPayment: false, allowCsvExport: false },
    limits: { maxDailyActions: 0, maxUnitRevenue: 0, maxUnitExpense: 0 }
};

export const initialRafSettings = {
  salaries: { socialContributionsRate: 0, incomeTaxRate: 0 },
  alerts: { debtThresholdEnabled: false, debtThresholdAmount: 0, approvalThresholdAmount: 0 },
  automation: { monthlyClosures: false, caisseOperationalHours: { enabled: false, opensAt: '08:00', closesAt: '17:00' } },
  multiCurrency: { enabled: true, defaultCurrency: 'FCFA', additionalCurrencies: ['EUR', 'USD'] },
};
