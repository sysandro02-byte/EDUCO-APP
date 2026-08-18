import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from './UserForm';
import { 
  MessageSquare, Send, Globe, School, Lock, ShieldCheck, Check, 
  Users, Settings, Search, Hash, User as UserIcon, AlertTriangle, 
  Sparkles, CheckCircle2, ChevronRight, RefreshCw, X, Mail, Phone,
  Filter, AlertCircle, CheckSquare, Square, FileText, Share2,
  DollarSign, GraduationCap, Layers, ArrowRight, ExternalLink, Bookmark
} from 'lucide-react';
import { sendBrevoBulkMessages } from '../src/services/api';

export interface MessagingPermissions {
  internal: { [role: string]: boolean };
  interSchool: { [role: string]: boolean };
}

export interface ChatMessage {
  id: string;
  type: 'internal' | 'inter_school';
  schoolId?: number | string;
  schoolName: string;
  targetSchoolId?: number | string;
  targetSchoolName?: string;
  channelId: string;
  senderId: number | string;
  senderName: string;
  senderRole: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
}

export const defaultMessagingPermissions: MessagingPermissions = {
  internal: {
    'Admin': true,
    'Promoteur': true,
    'Directeur Général': true,
    'Directeur des Etudes': true,
    'Directeur du Primaire': true,
    'Responsable des finances': true,
    'Surveillant Général': true,
    'Caissière': true,
    'Enseignant': true,
    'Élève': true,
    'Parent': true,
    'Parent d\'élève': true,
  },
  interSchool: {
    'Admin': true,
    'Promoteur': true,
    'Directeur Général': true,
    'Directeur des Etudes': false,
    'Directeur du Primaire': false,
    'Responsable des finances': false,
    'Surveillant Général': false,
    'Caissière': false,
    'Enseignant': false,
    'Élève': false,
    'Parent': false,
    'Parent d\'élève': false,
  }
};

const ALL_ROLES = [
  'Admin',
  'Promoteur',
  'Directeur Général',
  'Directeur des Etudes',
  'Directeur du Primaire',
  'Responsable des finances',
  'Surveillant Général',
  'Caissière',
  'Enseignant',
  'Élève',
  'Parent'
];

const REGISTERED_SCHOOLS = [
  { id: 'sch-1', name: 'Établissement Scolaire EDUCO (Mon Établissement)', city: 'Brazzaville', status: 'Actif', promoter: 'M. M. LOUTALA' },
  { id: 'sch-2', name: 'Complexe Scolaire Saint-Denis', city: 'Brazzaville', status: 'Actif', promoter: 'Mme Claire VIALA' },
  { id: 'sch-3', name: 'Lycée d\'Excellence de Pointe-Noire', city: 'Pointe-Noire', status: 'Actif', promoter: 'Dr. Jean-Baptiste MANKOU' },
  { id: 'sch-4', name: 'Institut Polytechnique Sainte-Marie', city: 'Dolisie', status: 'Actif', promoter: 'Prof. Gabriel KASSOU' },
  { id: 'sch-5', name: 'Collège & Lycée Lumière', city: 'Brazzaville', status: 'Actif', promoter: 'Mme Henriette ONDONGO' },
];

interface RecipientStudentItem {
  id: string | number;
  userId?: number;
  studentName: string;
  className: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  totalFees: number;
  amountPaid: number;
  balance: number;
  status: string;
  avatar?: string;
}

interface MessagingCenterProps {
  currentUser: User;
  schoolSettings: any;
  users: User[];
  payments?: any[];
  students?: any[];
  classes?: any[];
  currency?: string;
  onUpdatePermissions?: (permissions: MessagingPermissions) => void;
}

export const MessagingCenter: React.FC<MessagingCenterProps> = ({
  currentUser,
  schoolSettings,
  users,
  payments = [],
  students = [],
  classes = [],
  currency = 'FCFA',
  onUpdatePermissions
}) => {
  const isPromoterOrAdmin = currentUser.role === 'Promoteur' || currentUser.role === 'Admin' || currentUser.role === 'Directeur des Etudes' || currentUser.role === 'Responsable des finances';
  const schoolName = schoolSettings?.name || 'Établissement Scolaire EDUCO';

  // Strict role filtering: Hide Admin from Promoteur / School interfaces
  const displayedRoles = useMemo(() => {
    return ALL_ROLES.filter(r => currentUser?.role === 'Admin' || (r !== 'Admin' && r !== 'SuperAdmin'));
  }, [currentUser?.role]);

  // Load Permissions state
  const [permissions, setPermissions] = useState<MessagingPermissions>(() => {
    const saved = localStorage.getItem('educo_messaging_permissions');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading messaging permissions:', e);
      }
    }
    return defaultMessagingPermissions;
  });

  // Saved feedback toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active Main Tab: 'internal' | 'broadcast' | 'inter_school' | 'settings'
  const [activeTab, setActiveTab] = useState<'internal' | 'broadcast' | 'inter_school' | 'settings'>('internal');

  // Selected Channel / School
  const [selectedChannel, setSelectedChannel] = useState<string>('general');
  const [selectedInterSchoolId, setSelectedInterSchoolId] = useState<string>('inter_school_global');
  const [searchQuery, setSearchQuery] = useState('');

  // -------------------------------------------------------------
  // BULK MESSAGING / BROADCAST STATE
  // -------------------------------------------------------------
  const [broadcastFilter, setBroadcastFilter] = useState<'unpaid' | 'all_students' | 'paid' | 'teachers_staff'>('unpaid');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');
  const [minDebtFilter, setMinDebtFilter] = useState<number>(0);
  const [recipientSearch, setRecipientSearch] = useState<string>('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(new Set());

  const [broadcastChannel, setBroadcastChannel] = useState<'email' | 'sms' | 'whatsapp'>('email');
  const [broadcastSubject, setBroadcastSubject] = useState<string>('Rappel Important : Frais de Scolarité');
  const [broadcastMessage, setBroadcastMessage] = useState<string>(
    "Chers parents de {nom_eleve} ({classe}),\n\nNous vous informons qu'un solde restant de {reste_a_payer} est actuellement impayé au titre des frais scolaires à {etablissement}.\n\nNous vous remercions de bien vouloir vous rapprocher de la caisse pour la régularisation de votre dossier dans les meilleurs délais.\n\nCordialement,\nLa Direction"
  );
  const [isSendingBroadcast, setIsSendingBroadcast] = useState<boolean>(false);
  const [broadcastResults, setBroadcastResults] = useState<any | null>(null);

  // Message templates
  const PRESET_TEMPLATES = [
    {
      id: 'unpaid_fees',
      title: '🚨 Relance Frais Impayés',
      subject: 'Rappel de paiement des frais de scolarité',
      text: "Chers parents de {nom_eleve} ({classe}),\n\nNous vous informons qu'un solde de {reste_a_payer} reste impayé sur les frais scolaires à {etablissement}.\n\nMerci de bien vouloir régulariser cette situation auprès du service financier dans les plus brefs délais afin d'assurer la continuité des cours.\n\nCordialement,\nLe Service de Caisse"
    },
    {
      id: 'meeting',
      title: '📅 Réunion des Parents',
      subject: 'Convocation à la Réunion des Parents d\'Élèves',
      text: "Chers parents de {nom_eleve} ({classe}),\n\nLa Direction de {etablissement} vous convie à la réunion générale des parents d'élèves prévue ce samedi à 09h00 dans la grande salle de l'école.\n\nVotre présence est indispensable pour le suivi pédagogique de votre enfant.\n\nBien cordialement,\nLa Direction"
    },
    {
      id: 'report_cards',
      title: '📊 Disponibilité des Bulletins',
      subject: 'Disponibilité des bulletins de notes trimestriels',
      text: "Information aux parents de {nom_eleve} ({classe}) :\n\nLes bulletins de notes du trimestre sont désormais disponibles et consultables en ligne sur le portail EDUCO de votre établissement.\n\nFélicitations pour vos efforts,\nL'Équipe Pédagogique"
    },
    {
      id: 'general_notice',
      title: '📢 Note d\'Information Générale',
      subject: 'Communication de la Direction de l\'Établissement',
      text: "Chers parents d'élèves de {etablissement},\n\nNous vous prions de prendre note de l'information suivante concernant la vie scolaire de {nom_eleve} ({classe}).\n\nMerci pour votre confiance,\nL'Administration"
    }
  ];

  // Build Comprehensive List of Student/Parent Debtors & Recipients
  const allRecipientsList = useMemo<RecipientStudentItem[]>(() => {
    // 1. Gather all student users or students table records
    const studentUsers = users.filter(u => u.role === 'Élève');

    return studentUsers.map(u => {
      // Find matching payment info
      const pay = payments.find(p => p.id === u.id || p.studentId === u.id || (p.name && p.name.toLowerCase() === u.name.toLowerCase())) || {};
      const sDetail = students.find(s => s.userId === u.id || s.id === u.id) || {};
      const cls = classes.find(c => c.id === sDetail.classId || c.name === u.class) || {};

      const totalFees = pay.totalFees !== undefined ? pay.totalFees : (sDetail.totalFees || 350000);
      const amountPaid = pay.amountPaid !== undefined ? pay.amountPaid : (sDetail.amountPaid || 0);
      const balance = Math.max(0, totalFees - amountPaid);

      const parentName = (u as any).parentName || (sDetail as any).parentName || `Parent de ${u.name}`;
      const parentPhone = (u as any).parentPhone || (u as any).phone || (sDetail as any).parentPhone || (sDetail as any).phone || '+242 06 000 00 00';
      const parentEmail = (u as any).parentEmail || (sDetail as any).parentEmail || u.email || 'parent@educo-ecole.cg';
      const className = (u as any).class || cls.name || (sDetail as any).className || 'Classe Principale';

      return {
        id: `stu_${u.id}`,
        userId: u.id,
        studentName: u.name,
        className,
        parentName,
        parentPhone,
        parentEmail,
        totalFees,
        amountPaid,
        balance,
        status: balance > 0 ? 'Impayé' : 'En Règle',
        avatar: u.avatar
      };
    });
  }, [users, payments, students, classes]);

  // Extract unique class list for filtering
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    allRecipientsList.forEach(r => {
      if (r.className) set.add(r.className);
    });
    return Array.from(set).sort();
  }, [allRecipientsList]);

  // Filtered Recipients for Bulk Messaging
  const filteredRecipients = useMemo(() => {
    return allRecipientsList.filter(item => {
      // 1. Audience Filter
      if (broadcastFilter === 'unpaid' && item.balance <= 0) return false;
      if (broadcastFilter === 'paid' && item.balance > 0) return false;
      
      // 2. Minimum Debt Filter
      if (broadcastFilter === 'unpaid' && minDebtFilter > 0 && item.balance < minDebtFilter) {
        return false;
      }

      // 3. Class Filter
      if (selectedClassFilter !== 'ALL' && item.className !== selectedClassFilter) {
        return false;
      }

      // 4. Text Search
      if (recipientSearch.trim().length > 0) {
        const query = recipientSearch.toLowerCase();
        const matchesName = item.studentName.toLowerCase().includes(query);
        const matchesParent = item.parentName.toLowerCase().includes(query);
        const matchesClass = item.className.toLowerCase().includes(query);
        const matchesPhone = item.parentPhone.includes(query);
        const matchesEmail = item.parentEmail.toLowerCase().includes(query);
        if (!matchesName && !matchesParent && !matchesClass && !matchesPhone && !matchesEmail) {
          return false;
        }
      }

      return true;
    });
  }, [allRecipientsList, broadcastFilter, minDebtFilter, selectedClassFilter, recipientSearch]);

  // Auto select all filtered recipients when filter changes
  useEffect(() => {
    const ids = new Set(filteredRecipients.map(r => String(r.id)));
    setSelectedRecipientIds(ids);
  }, [broadcastFilter, selectedClassFilter, minDebtFilter]);

  // Toggle single recipient selection
  const toggleSelectRecipient = (id: string) => {
    const newSet = new Set(selectedRecipientIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedRecipientIds(newSet);
  };

  // Select all or deselect all
  const toggleSelectAll = () => {
    if (selectedRecipientIds.size === filteredRecipients.length && filteredRecipients.length > 0) {
      setSelectedRecipientIds(new Set());
    } else {
      const allIds = new Set(filteredRecipients.map(r => String(r.id)));
      setSelectedRecipientIds(allIds);
    }
  };

  // Compute selected stats
  const selectedRecipientsList = useMemo(() => {
    return filteredRecipients.filter(r => selectedRecipientIds.has(String(r.id)));
  }, [filteredRecipients, selectedRecipientIds]);

  const totalSelectedDebt = useMemo(() => {
    return selectedRecipientsList.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  }, [selectedRecipientsList]);

  // Handle Triggering Bulk Send via Brevo API
  const handleTriggerBulkSend = async () => {
    if (selectedRecipientsList.length === 0) {
      showToast("⚠️ Veuillez sélectionner au moins un destinataire.");
      return;
    }

    if (!broadcastMessage.trim()) {
      showToast("⚠️ Le message ne peut pas être vide.");
      return;
    }

    setIsSendingBroadcast(true);
    setBroadcastResults(null);

    try {
      const payloadRecipients = selectedRecipientsList.map(r => ({
        name: r.parentName || r.studentName,
        studentName: r.studentName,
        className: r.className,
        parentName: r.parentName,
        parentEmail: r.parentEmail,
        parentPhone: r.parentPhone,
        email: r.parentEmail,
        phone: r.parentPhone,
        balance: r.balance,
        totalFees: r.totalFees,
        amountPaid: r.amountPaid
      }));

      const res = await sendBrevoBulkMessages({
        recipients: payloadRecipients,
        channel: broadcastChannel,
        subject: broadcastSubject,
        message: broadcastMessage,
        schoolName,
        senderName: schoolName
      });

      if (res && res.success) {
        setBroadcastResults(res);
        showToast(`🎉 Envoi groupé Brevo déclenché avec succès ! (${res.successful} envoyé(s))`);
      } else {
        throw new Error(res?.error || "Erreur lors de l'envoi groupé Brevo");
      }
    } catch (err: any) {
      console.error("Bulk Send Error:", err);
      showToast(`❌ Échec de l'envoi : ${err.message}`);
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  // Preview computed text for the first selected recipient
  const previewSample = useMemo(() => {
    const sample = selectedRecipientsList[0] || filteredRecipients[0] || {
      studentName: "MBOUNGOU Jean-Marc",
      className: "3ème B",
      parentName: "M. MBOUNGOU Michel",
      balance: 75000,
      totalFees: 350000,
      parentEmail: "michel.mboungou@gmail.com",
      parentPhone: "+242 06 444 55 66"
    };

    const balanceStr = (sample.balance || 0).toLocaleString('fr-FR') + ' ' + currency;

    const personalized = broadcastMessage
      .replace(/{nom_eleve}|{eleve}|{nom}/gi, sample.studentName)
      .replace(/{classe}|{classe_eleve}/gi, sample.className)
      .replace(/{nom_parent}|{parent}/gi, sample.parentName)
      .replace(/{reste_a_payer}|{solde}|{montant_du}|{impayes}/gi, balanceStr)
      .replace(/{etablissement}|{ecole}|{school}/gi, schoolName);

    return {
      sample,
      personalized
    };
  }, [selectedRecipientsList, filteredRecipients, broadcastMessage, schoolName, currency]);

  // Insert variable into message body
  const insertVariable = (varCode: string) => {
    setBroadcastMessage(prev => prev + ' ' + varCode);
  };

  // -------------------------------------------------------------
  // CHAT MESSAGES STATE & LOGIC
  // -------------------------------------------------------------
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('educo_chat_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [
      {
        id: 'msg-1',
        type: 'internal',
        schoolName,
        channelId: 'general',
        senderId: 'u-1',
        senderName: 'Directeur des Études',
        senderRole: 'Directeur des Etudes',
        senderAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
        text: 'Bienvenue dans l\'espace de messagerie sécurisé de notre établissement ! Tout le personnel autorisé et parents ont accès selon la configuration du Promoteur.',
        timestamp: 'Hier à 14:30'
      },
      {
        id: 'msg-2',
        type: 'internal',
        schoolName,
        channelId: 'general',
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        senderAvatar: currentUser.avatar,
        text: 'Bonjour à l\'équipe. La messagerie fonctionne parfaitement.',
        timestamp: 'Aujourd\'hui à 08:15'
      },
      {
        id: 'msg-3',
        type: 'inter_school',
        schoolName: 'Complexe Scolaire Saint-Denis',
        targetSchoolName: schoolName,
        channelId: 'inter_school_global',
        senderId: 'u-99',
        senderName: 'Mme Claire VIALA',
        senderRole: 'Promoteur',
        senderAvatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=200',
        text: 'Chers collègues Promoteurs et Administrateurs, ravis de partager ce réseau inter-établissement sur EDUCO !',
        timestamp: 'Aujourd\'hui à 09:00'
      }
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab, selectedChannel, selectedInterSchoolId]);

  // Persist messages
  useEffect(() => {
    localStorage.setItem('educo_chat_messages', JSON.stringify(messages));
  }, [messages]);

  // Save permissions
  const handleSavePermissions = (newPermissions: MessagingPermissions) => {
    setPermissions(newPermissions);
    localStorage.setItem('educo_messaging_permissions', JSON.stringify(newPermissions));
    if (onUpdatePermissions) {
      onUpdatePermissions(newPermissions);
    }
    showToast('Configuration des droits de messagerie enregistrée avec succès !');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      type: activeTab === 'internal' ? 'internal' : 'inter_school',
      schoolName: schoolName,
      channelId: activeTab === 'internal' ? selectedChannel : selectedInterSchoolId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      senderAvatar: currentUser.avatar,
      text: inputMessage.trim(),
      timestamp: 'À l\'instant'
    };

    setMessages(prev => [...prev, newMsg]);
    setInputMessage('');
  };

  // Channels for internal chat
  const internalChannels = [
    { id: 'general', name: 'Général - Tout le personnel', icon: Hash, desc: 'Annonces et échanges généraux' },
    { id: 'teachers', name: 'Corps Enseignant', icon: Hash, desc: 'Conseils, devoirs, pédagogie' },
    { id: 'admin', name: 'Direction & Administration', icon: Lock, desc: currentUser?.role === 'Admin' ? 'Promoteur, DE, RAF, Admin' : 'Promoteur, Direction, DE, RAF' },
    { id: 'parents', name: 'Canal Information Parents', icon: Hash, desc: 'Communications officielles parents' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900/90 text-white px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border border-slate-700 flex items-center gap-3 animate-slideDown">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Main Page Header */}
      <div className="bg-gradient-to-r from-[#1F4A59] via-[#15343f] to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-emerald-300 border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Centre de Communication Intelligente</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Centre de Messagerie & Relances Groupées
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Gérez les discussions internes, diffusez des relances groupées automatisées (E-mails & SMS) et coordonnez votre communauté scolaire.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 self-start md:self-auto">
            <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-slate-300 font-medium">Élèves enregistrés</p>
              <p className="text-lg font-bold text-white">{allRecipientsList.length}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mt-8 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('internal')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'internal'
                ? 'bg-white text-[#1F4A59] shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Discussion Interne</span>
          </button>

          {/* Brevo Bulk Messaging Tab */}
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'broadcast'
                ? 'bg-emerald-500 text-slate-900 shadow-lg font-black'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Send className="w-4 h-4 text-emerald-300" />
            <span>Diffusion & Relances Groupées</span>
            <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded-full">
              {allRecipientsList.filter(r => r.balance > 0).length} Impayés
            </span>
          </button>

          <button
            onClick={() => setActiveTab('inter_school')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'inter_school'
                ? 'bg-white text-[#1F4A59] shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Réseau Inter-Établissements</span>
          </button>

          {isPromoterOrAdmin && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-[#1F4A59] shadow-lg'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Gestion des Droits</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: BULK MESSAGING & BREVO BROADCAST (ENVOI GROUPÉ & RELANCES) */}
      {/* ========================================================================= */}
      {activeTab === 'broadcast' && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Top Banner & Strategy Selector */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Filter 1: Unpaid Debtors */}
            <button
              type="button"
              onClick={() => setBroadcastFilter('unpaid')}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                broadcastFilter === 'unpaid'
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 shadow-md ring-2 ring-rose-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-rose-500 text-white rounded-xl">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-full">
                  {allRecipientsList.filter(r => r.balance > 0).length} Ciblés
                </span>
              </div>
              <p className="font-bold text-sm">Élèves Insolvables (Impayés)</p>
              <p className="text-[11px] text-slate-500 mt-1">Parents avec solde de scolarité restant dû</p>
            </button>

            {/* Filter 2: All Students & Parents */}
            <button
              type="button"
              onClick={() => setBroadcastFilter('all_students')}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                broadcastFilter === 'all_students'
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 shadow-md ring-2 ring-emerald-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold rounded-full">
                  {allRecipientsList.length} Total
                </span>
              </div>
              <p className="font-bold text-sm">Tous les Élèves & Parents</p>
              <p className="text-[11px] text-slate-500 mt-1">Diffusion générale pour toute l'école</p>
            </button>

            {/* Filter 3: Paid / Good Standing */}
            <button
              type="button"
              onClick={() => setBroadcastFilter('paid')}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                broadcastFilter === 'paid'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 shadow-md ring-2 ring-blue-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
                  {allRecipientsList.filter(r => r.balance <= 0).length} À jour
                </span>
              </div>
              <p className="font-bold text-sm">Élèves en Règle</p>
              <p className="text-[11px] text-slate-500 mt-1">Parents ayant soldé la scolarité</p>
            </button>

            {/* Filter 4: Teachers & Staff */}
            <button
              type="button"
              onClick={() => setBroadcastFilter('teachers_staff')}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                broadcastFilter === 'teachers_staff'
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 shadow-md ring-2 ring-indigo-400'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-indigo-600 text-white rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
                <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full">
                  {users.filter(u => u.role !== 'Élève' && u.role !== 'Parent').length} Agents
                </span>
              </div>
              <p className="font-bold text-sm">Enseignants & Personnel</p>
              <p className="text-[11px] text-slate-500 mt-1">Notes de service & convocations</p>
            </button>

          </div>

          {/* Main Grid: Left (Filters & Recipient Selection Table) | Right (Message Editor & Brevo Trigger) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* LEFT COLUMN: RECIPIENT SELECTOR TABLE (7 Cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden flex flex-col">
              
              {/* Filter Sub-Bar */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/50 space-y-4">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Users className="w-5 h-5 text-[#1F4A59] dark:text-emerald-400" />
                      <span>Sélection des Destinataires ({selectedRecipientIds.size} / {filteredRecipients.length})</span>
                    </h3>
                    {broadcastFilter === 'unpaid' && (
                      <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                        Solde total ciblé : {totalSelectedDebt.toLocaleString('fr-FR')} {currency}
                      </p>
                    )}
                  </div>

                  {/* Select All Toggle */}
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-3.5 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    {selectedRecipientIds.size === filteredRecipients.length && filteredRecipients.length > 0 ? (
                      <>
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                        <span>Tout désélectionner</span>
                      </>
                    ) : (
                      <>
                        <Square className="w-4 h-4 text-slate-400" />
                        <span>Tout sélectionner ({filteredRecipients.length})</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Sub-Filters: Class Selector + Search Box */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Search input */}
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      placeholder="Rechercher élève, parent, tél..."
                      className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Class Filter */}
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">Toutes les classes ({allRecipientsList.length})</option>
                    {availableClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>

                </div>

              </div>

              {/* Recipients Table */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3.5 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedRecipientIds.size === filteredRecipients.length && filteredRecipients.length > 0}
                          onChange={toggleSelectAll}
                          className="rounded text-emerald-600 cursor-pointer"
                        />
                      </th>
                      <th className="p-3.5">Élève & Classe</th>
                      <th className="p-3.5">Contact Parent</th>
                      <th className="p-3.5 text-right">Frais & Solde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 text-slate-800 dark:text-slate-200">
                    {filteredRecipients.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-slate-500">
                          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <p className="font-bold text-sm">Aucun destinataire ne correspond aux filtres.</p>
                          <p className="text-xs text-slate-400 mt-1">Essayez de modifier votre recherche ou le statut de sélection.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredRecipients.map((item) => {
                        const isSelected = selectedRecipientIds.has(String(item.id));
                        return (
                          <tr
                            key={item.id}
                            onClick={() => toggleSelectRecipient(String(item.id))}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                            }`}
                          >
                            <td className="p-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRecipient(String(item.id))}
                                className="rounded text-emerald-600 cursor-pointer"
                              />
                            </td>
                            <td className="p-3.5">
                              <div className="font-bold text-slate-900 dark:text-slate-100">{item.studentName}</div>
                              <span className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-semibold mt-0.5">
                                {item.className}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{item.parentName}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span>{item.parentPhone}</span>
                              </div>
                              {item.parentEmail && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5 truncate max-w-[180px]">
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{item.parentEmail}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-3.5 text-right">
                              {item.balance > 0 ? (
                                <div>
                                  <div className="font-black text-rose-600 dark:text-rose-400">
                                    {item.balance.toLocaleString('fr-FR')} {currency}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Payé: {item.amountPaid.toLocaleString('fr-FR')}
                                  </div>
                                  <span className="inline-block px-1.5 py-0.2 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded text-[9px] font-black uppercase">
                                    Impayé
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <div className="font-bold text-emerald-600 dark:text-emerald-400">0 {currency}</div>
                                  <span className="inline-block px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded text-[9px] font-bold">
                                    Soldé
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 flex items-center justify-between">
                <span>{selectedRecipientIds.size} sélectionné(s) sur {filteredRecipients.length} affichés</span>
                {broadcastFilter === 'unpaid' && (
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    Total Dû : {totalSelectedDebt.toLocaleString('fr-FR')} {currency}
                  </span>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN: MESSAGE COMPOSER & BREVO DISPATCHER (5 Cols) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Channel & Template Selection Card */}
              <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-xl space-y-5">
                
                {/* 1. Channel Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    1. Canal de Diffusion
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setBroadcastChannel('email')}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        broadcastChannel === 'email'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Mail className="w-5 h-5 text-emerald-600" />
                      <span className="text-[11px]">E-mail Direct</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBroadcastChannel('sms')}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        broadcastChannel === 'sms'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Phone className="w-5 h-5 text-blue-600" />
                      <span className="text-[11px]">SMS Direct</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBroadcastChannel('whatsapp')}
                      className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        broadcastChannel === 'whatsapp'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Share2 className="w-5 h-5 text-emerald-500" />
                      <span className="text-[11px]">WhatsApp</span>
                    </button>
                  </div>
                </div>

                {/* 2. Preset Templates */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    2. Modèles de Message Prédéfinis
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PRESET_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => {
                          setBroadcastSubject(tpl.subject);
                          setBroadcastMessage(tpl.text);
                          showToast(`Modèle "${tpl.title}" appliqué.`);
                        }}
                        className="p-2.5 bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-left border border-slate-200 dark:border-slate-600 transition-colors cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between"
                      >
                        <span className="truncate">{tpl.title}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Subject (if Email) */}
                {broadcastChannel === 'email' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Objet de l'E-mail
                    </label>
                    <input
                      type="text"
                      value={broadcastSubject}
                      onChange={(e) => setBroadcastSubject(e.target.value)}
                      placeholder="Ex: Rappel de paiement de scolarité..."
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {/* 4. Message Body & Dynamic Placeholders */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Corps du Message
                    </label>
                    <span className="text-[10px] text-slate-400">
                      {broadcastMessage.length} caractères
                    </span>
                  </div>

                  {/* Variables Insertion Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => insertVariable('{nom_eleve}')}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-mono rounded-md cursor-pointer"
                    >
                      +&#123;nom_eleve&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{classe}')}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-mono rounded-md cursor-pointer"
                    >
                      +&#123;classe&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{reste_a_payer}')}
                      className="px-2 py-0.5 bg-rose-100 dark:bg-rose-900/40 hover:bg-rose-200 text-rose-700 dark:text-rose-300 text-[10px] font-mono font-bold rounded-md cursor-pointer"
                    >
                      +&#123;reste_a_payer&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{nom_parent}')}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-mono rounded-md cursor-pointer"
                    >
                      +&#123;nom_parent&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable('{etablissement}')}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-[10px] font-mono rounded-md cursor-pointer"
                    >
                      +&#123;etablissement&#125;
                    </button>
                  </div>

                  <textarea
                    rows={6}
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                  />
                </div>

                {/* 5. Live Preview Sample */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-2">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                      Aperçu personnalisé pour <strong>{previewSample.sample.studentName}</strong>
                    </span>
                    <span className="text-[10px] text-slate-400">Canal: {broadcastChannel.toUpperCase()}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed shadow-sm font-sans">
                    {previewSample.personalized}
                  </div>
                </div>

                {/* 6. Send Button */}
                <button
                  type="button"
                  disabled={isSendingBroadcast || selectedRecipientsList.length === 0}
                  onClick={handleTriggerBulkSend}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-[#1F4A59] hover:from-emerald-700 hover:to-[#15343f] text-white font-black text-sm rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingBroadcast ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      <span>Envoi groupé en cours...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>Déclencher l'Envoi Groupé ({selectedRecipientsList.length} destinataire(s))</span>
                    </>
                  )}
                </button>

              </div>

              {/* Broadcast Results Report */}
              {broadcastResults && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-5 shadow-lg space-y-3 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Rapport d'Expédition des Messages
                    </h4>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      {broadcastResults.successful} / {broadcastResults.total} Réussi(s)
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {broadcastResults.results?.map((resItem: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 bg-white dark:bg-slate-800 rounded-xl text-xs flex items-center justify-between border border-slate-200 dark:border-slate-700"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-slate-800 dark:text-slate-100">{resItem.recipientName}</p>
                          <p className="text-[10px] text-slate-500">{resItem.target}</p>
                        </div>
                        <div>
                          {resItem.success ? (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 rounded text-[10px] font-bold">
                              {resItem.channel === 'whatsapp' ? '📱 WhatsApp Prêt' : '✅ Transmis'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200 rounded text-[10px] font-bold">
                              ❌ Échec
                            </span>
                          )}
                          {resItem.whatsappUrl && (
                            <a
                              href={resItem.whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 text-emerald-600 underline text-[10px] font-bold inline-flex items-center gap-0.5"
                            >
                              Ouvrir <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INTERNAL CHAT */}
      {/* ========================================================================= */}
      {activeTab === 'internal' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
          
          {/* Sidebar Channels */}
          <div className="md:col-span-4 border-r border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="px-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Canaux de Discussion</h3>
              </div>

              <div className="space-y-1">
                {internalChannels.map(ch => {
                  const IconComp = ch.icon;
                  const isSelected = selectedChannel === ch.id;
                  return (
                    <button
                      key={ch.id}
                      onClick={() => setSelectedChannel(ch.id)}
                      className={`w-full p-3 rounded-2xl text-left flex items-start gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1F4A59] text-white shadow-md'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-white/10' : 'bg-slate-200 dark:bg-slate-700'}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs">{ch.name}</div>
                        <div className={`text-[10px] ${isSelected ? 'text-slate-200' : 'text-slate-400'}`}>{ch.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User status card */}
            <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs overflow-hidden">
                {currentUser.avatar ? <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : currentUser.name.charAt(0)}
              </div>
              <div className="truncate">
                <p className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">{currentUser.role} • En ligne</p>
              </div>
            </div>
          </div>

          {/* Chat Messages Panel */}
          <div className="md:col-span-8 flex flex-col justify-between h-[600px]">
            
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-[#1F4A59] dark:text-emerald-400" />
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {internalChannels.find(c => c.id === selectedChannel)?.name}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">{schoolName}</span>
            </div>

            {/* Messages Flow */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/30 dark:bg-slate-900/20">
              {messages.filter(m => m.type === 'internal' && m.channelId === selectedChannel).map(msg => {
                const isMe = String(msg.senderId) === String(currentUser.id);
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <div className="w-8 h-8 rounded-full bg-[#1F4A59] text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {msg.senderAvatar ? <img src={msg.senderAvatar} alt="" className="w-full h-full object-cover" /> : msg.senderName.charAt(0)}
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${
                      isMe 
                        ? 'bg-[#1F4A59] text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-600'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold text-xs ${isMe ? 'text-emerald-300' : 'text-slate-900 dark:text-slate-100'}`}>
                          {msg.senderName}
                        </span>
                        <span className={`text-[10px] ${isMe ? 'text-slate-300' : 'text-slate-400'}`}>
                          {msg.senderRole} • {msg.timestamp}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Box */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={`Écrire dans #${internalChannels.find(c => c.id === selectedChannel)?.name}...`}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 border-none rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="p-3 bg-[#1F4A59] hover:bg-emerald-700 text-white rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INTER-SCHOOL NETWORK */}
      {/* ========================================================================= */}
      {activeTab === 'inter_school' && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[600px]">
          
          {/* Schools list */}
          <div className="md:col-span-4 border-r border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/30 space-y-3">
            <div className="px-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">Réseau des Établissements</h3>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setSelectedInterSchoolId('inter_school_global')}
                className={`w-full p-3 rounded-2xl text-left flex items-start gap-3 transition-all cursor-pointer ${
                  selectedInterSchoolId === 'inter_school_global'
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className={`p-2 rounded-xl ${selectedInterSchoolId === 'inter_school_global' ? 'bg-white/10' : 'bg-slate-200 dark:bg-slate-700'}`}>
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs">Agora Inter-Écoles (Global)</div>
                  <div className="text-[10px] opacity-80">Promoteurs et Directeurs de tout le réseau</div>
                </div>
              </button>

              {REGISTERED_SCHOOLS.map(sch => (
                <button
                  key={sch.id}
                  onClick={() => setSelectedInterSchoolId(sch.id)}
                  className={`w-full p-3 rounded-2xl text-left flex items-start gap-3 transition-all cursor-pointer ${
                    selectedInterSchoolId === sch.id
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl ${selectedInterSchoolId === sch.id ? 'bg-white/10' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    <School className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-xs">{sch.name}</div>
                    <div className="text-[10px] opacity-80">{sch.city} • {sch.promoter}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Inter-School Messages */}
          <div className="md:col-span-8 flex flex-col justify-between h-[600px]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-sky-600" />
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {selectedInterSchoolId === 'inter_school_global' ? 'Agora Inter-Écoles' : REGISTERED_SCHOOLS.find(s => s.id === selectedInterSchoolId)?.name}
                </span>
              </div>
              <span className="px-2 py-0.5 bg-sky-100 text-sky-700 text-[10px] font-bold rounded-full">Réseau Certifié EDUCO</span>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/30 dark:bg-slate-900/20">
              {messages.filter(m => m.type === 'inter_school').map(msg => {
                const isMe = String(msg.senderId) === String(currentUser.id);
                return (
                  <div key={msg.id} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <div className="w-8 h-8 rounded-full bg-sky-700 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                        {msg.senderAvatar ? <img src={msg.senderAvatar} alt="" className="w-full h-full object-cover" /> : msg.senderName.charAt(0)}
                      </div>
                    )}
                    <div className={`max-w-[75%] rounded-2xl p-4 shadow-sm ${
                      isMe 
                        ? 'bg-sky-600 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-600'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-bold text-xs ${isMe ? 'text-sky-100' : 'text-slate-900 dark:text-slate-100'}`}>
                          {msg.senderName} ({msg.schoolName})
                        </span>
                        <span className={`text-[10px] ${isMe ? 'text-sky-200' : 'text-slate-400'}`}>
                          {msg.senderRole} • {msg.timestamp}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Publier un message sur le réseau inter-écoles..."
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 border-none rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="p-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PERMISSIONS SETTINGS (ADMIN / PROMOTEUR) */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && isPromoterOrAdmin && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 shadow-xl space-y-6 animate-fadeIn">
          <div>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">
              Gestion des Droits d'Accès à la Messagerie
            </h3>
            <p className="text-xs text-slate-500">
              Définissez les rôles autorisés à communiquer en interne et sur le réseau inter-établissements.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase">
                  <th className="p-4">Rôle Utilisateur</th>
                  <th className="p-4 text-center">Messagerie Interne</th>
                  <th className="p-4 text-center">Réseau Inter-Écoles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {displayedRoles.map(role => {
                  const internalAllowed = permissions.internal[role] ?? false;
                  const interSchoolAllowed = permissions.interSchool[role] ?? false;

                  return (
                    <tr key={role}>
                      <td className="p-4 font-bold text-slate-800 dark:text-slate-200">{role}</td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newPerms = {
                              ...permissions,
                              internal: { ...permissions.internal, [role]: !internalAllowed }
                            };
                            setPermissions(newPerms);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                            internalAllowed ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              internalAllowed ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            const newPerms = {
                              ...permissions,
                              interSchool: { ...permissions.interSchool, [role]: !interSchoolAllowed }
                            };
                            setPermissions(newPerms);
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                            interSchoolAllowed ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              interSchoolAllowed ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => handleSavePermissions(permissions)}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl shadow-lg flex items-center gap-2 cursor-pointer transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Enregistrer les Permissions</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default MessagingCenter;
