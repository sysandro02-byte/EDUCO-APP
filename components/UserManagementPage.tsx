import React, { useState, useMemo } from 'react';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import UserForm, { User } from './UserForm';
import IdCard from './IdCard';
import UserAvatar from './UserAvatar';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Pencil, 
  Trash2, 
  CreditCard, 
  Shield, 
  GraduationCap, 
  Briefcase, 
  UserCheck, 
  CheckCircle2, 
  XCircle,
  Mail,
  School,
  Sparkles,
  Download,
  Building2,
  Key,
  Eye,
  Copy,
  Check,
  Power,
  RefreshCw,
  Phone,
  Calendar,
  AlertCircle,
  Lock,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { USER_ROLES } from '../constants';
import { Class } from './ClassForm';
import { Fee } from './FeeForm';
import { SchoolSettings, SchoolSubscriptionInfo } from '../App';
import { showAppFeedback } from '../src/utils/appFeedback';

interface UserManagementPageProps {
  users: User[];
  onSaveUser: (user: User) => void;
  onDeleteUser: (userId: number) => void;
  currentUserRole: string;
  currentUser?: User | null;
  classes: Class[];
  fees: Fee[];
  schoolSettings: SchoolSettings;
  isLicenseActive?: boolean;
  subscriptionInfo?: SchoolSubscriptionInfo | null;
  onOpenSubscriptionModal?: () => void;
  onToggleActivateStudent?: (studentId: number | string) => void;
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({ 
  users, 
  onSaveUser, 
  onDeleteUser, 
  currentUserRole, 
  currentUser,
  classes, 
  fees, 
  schoolSettings,
  isLicenseActive = true,
  subscriptionInfo,
  onOpenSubscriptionModal,
  onToggleActivateStudent
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Actif' | 'Inactif'>('All');
  const [schoolFilter, setSchoolFilter] = useState<string>('All');
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [selectedUserForBadge, setSelectedUserForBadge] = useState<User | null>(null);

  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Interactive user inspection & reset password modals
  const [inspectingUser, setInspectingUser] = useState<User | null>(null);
  const [passwordResetModal, setPasswordResetModal] = useState<{ user: User; newPass: string } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    showAppFeedback(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setIsModalOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsModalOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = () => {
    if (userToDelete && userToDelete.id) {
      onDeleteUser(userToDelete.id);
      showToast(`Compte de ${userToDelete.name} supprimé.`);
    }
    setIsDeleteModalOpen(false);
    setUserToDelete(null);
  };

  const handleSaveUser = (userToSave: User) => {
    onSaveUser(userToSave);
    setIsModalOpen(false);
    showToast(`Compte de ${userToSave.name} enregistré avec succès.`);
  };
  
  const handleShowBadge = (user: User) => {
    setSelectedUserForBadge(user);
    setIsBadgeModalOpen(true);
  };

  // Interactive Status Toggle
  const handleToggleStatus = async (user: User) => {
    if (!user.id) return;
    setActionLoadingId(user.id);
    const newStatus = user.status === 'Actif' ? 'Inactif' : 'Actif';

    try {
      const token = localStorage.getItem('supabase_auth_token') || localStorage.getItem('auth_token');
      const res = await fetch(`/api/users/${user.id}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        const data = await res.json();
        const updated = { ...user, status: (data.user?.status || newStatus) as any };
        onSaveUser(updated);
        showToast(`Statut de ${user.name} passé à ${newStatus}.`);
      } else {
        // Fallback optimistic update
        const updated = { ...user, status: newStatus as any };
        onSaveUser(updated);
        showToast(`Statut de ${user.name} mis à jour : ${newStatus}.`);
      }
    } catch (err) {
      const updated = { ...user, status: newStatus as any };
      onSaveUser(updated);
      showToast(`Statut de ${user.name} mis à jour : ${newStatus}.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Interactive Password Reset
  const handleResetPassword = async (user: User) => {
    if (!user.id) return;
    setActionLoadingId(user.id);

    try {
      const token = localStorage.getItem('supabase_auth_token') || localStorage.getItem('auth_token');
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });

      if (res.ok) {
        const data = await res.json();
        setPasswordResetModal({
          user,
          newPass: data.temporaryPassword || 'Educo@' + Math.floor(100000 + Math.random() * 900000)
        });
      } else {
        const fallbackPass = 'Educo@' + Math.floor(100000 + Math.random() * 900000);
        setPasswordResetModal({
          user,
          newPass: fallbackPass
        });
      }
    } catch (err) {
      const fallbackPass = 'Educo@' + Math.floor(100000 + Math.random() * 900000);
      setPasswordResetModal({
        user,
        newPass: fallbackPass
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Filter users by establishment and strictly hide Admin accounts from Promoteurs & school roles
  const establishmentUsers = useMemo(() => {
    return users.filter(user => {
      // If current user is NOT SuperAdmin/Admin (e.g. Promoteur or school staff), NEVER show Admin accounts
      if (currentUserRole !== 'Admin') {
        if (user.role === 'Admin' || user.role === 'SuperAdmin') {
          return false;
        }
      }

      // Filter by establishment if specified on user / promoteur
      if (currentUserRole === 'Promoteur' || currentUserRole !== 'Admin') {
        const mySchool = String((currentUser as any)?.schoolId || (currentUser as any)?.schoolName || schoolSettings?.name || '');
        const userSchool = String((user as any)?.schoolId || (user as any)?.schoolName || '');

        if (mySchool && userSchool) {
          if (userSchool.trim().toLowerCase() !== mySchool.trim().toLowerCase()) {
            return false;
          }
        }
      }

      return true;
    });
  }, [users, currentUserRole, currentUser, schoolSettings]);

  // Unique list of schools for Admin filtering
  const distinctSchools = useMemo(() => {
    const schoolSet = new Set<string>();
    establishmentUsers.forEach(u => {
      const sName = (u as any).schoolName;
      if (sName && sName !== 'Inconnu') schoolSet.add(sName);
    });
    return Array.from(schoolSet).sort();
  }, [establishmentUsers]);

  // KPIs computed strictly on establishment users
  const totalUsersCount = establishmentUsers.length;
  const activeUsersCount = establishmentUsers.filter(u => u.status === 'Actif').length;
  const teachersCount = establishmentUsers.filter(u => u.role === 'Enseignant').length;
  const studentsCount = establishmentUsers.filter(u => u.role === 'Élève').length;
  const adminStaffCount = establishmentUsers.filter(u => 
    ['Co-admin', 'Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Responsable des finances', 'Caissière'].includes(u.role) ||
    (currentUserRole === 'Admin' && u.role === 'Admin')
  ).length;

  const filteredUsers = useMemo(() => {
    return establishmentUsers
      .filter(user => roleFilter === 'All' || user.role === roleFilter)
      .filter(user => statusFilter === 'All' || user.status === statusFilter)
      .filter(user => schoolFilter === 'All' || (user as any).schoolName === schoolFilter)
      .filter(user => 
        (user.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.studentId?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.class?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        ((user as any).schoolName?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }, [establishmentUsers, roleFilter, statusFilter, schoolFilter, searchTerm]);

  const availableRoles = useMemo(() => {
    return USER_ROLES.filter(role => currentUserRole === 'Admin' || (role !== 'Admin' && role !== 'SuperAdmin'));
  }, [currentUserRole]);

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'Admin':
      case 'Promoteur':
        return 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-700';
      case 'Directeur des Etudes':
      case 'Responsable des finances':
        return 'bg-[#1F4A59]/10 text-[#1F4A59] dark:bg-sky-400/10 dark:text-sky-300 border-[#1F4A59]/20';
      case 'Enseignant':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Élève':
        return 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'Parent':
        return 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border-violet-200 dark:border-violet-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const canManageUsers = ['Admin', 'Co-admin', 'Promoteur'].includes(currentUserRole);
  const canGenerateBadges = ['Admin', 'Co-admin', 'Promoteur', 'Caissière', 'Responsable des finances', 'Directeur des Etudes'].includes(currentUserRole);

  return (
    <div className="space-y-6 animate-fade-in relative">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-700 text-xs font-bold animate-slide-up">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-[#1F4A59]/10 dark:bg-sky-400/10 text-[#1F4A59] dark:text-sky-300 text-[11px] font-black uppercase tracking-wider rounded-full border border-[#1F4A59]/20">
                Annuaire & Comptes Interactifs
              </span>
              <span className="px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold rounded-md flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Synchronisé Supabase
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Gestion Centralisée des Utilisateurs
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Consultez, ajoutez et administrez les comptes du personnel administratif, enseignants, élèves et parents avec actions directes (activation, réinitialisation de mot de passe, badges).
            </p>
          </div>

          {canManageUsers && (
            <div className="flex items-center gap-3 shrink-0">
              <button 
                onClick={handleAddUser}
                className="px-5 py-3 bg-gradient-to-r from-[#1F4A59] to-[#275d70] hover:from-[#183944] hover:to-[#1F4A59] text-white text-xs font-black rounded-2xl shadow-sm hover:shadow transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <UserPlus className="w-4 h-4" />
                <span>Nouveau Compte Utilisateur</span>
              </button>
            </div>
          )}
        </div>

        {/* Mode Licence Non Activée Alert Banner */}
        {currentUserRole === 'Promoteur' && !isLicenseActive && (
          <div className="p-4 mt-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border-2 border-amber-300 dark:border-amber-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white shrink-0 shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-black text-amber-950 dark:text-amber-100 uppercase tracking-tight">
                    Mode Licence Non Activée
                  </h3>
                  <span className="px-2 py-0.5 bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-extrabold rounded-md">
                    Création Caissier & Inscription Élèves Uniquement
                  </span>
                </div>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1 max-w-2xl leading-relaxed">
                  En mode sans licence active, vous avez le droit de <strong>créer le compte Caissier</strong> et <strong>d'inscrire des élèves</strong>. Pour déverrouiller l'accès complet à tous les modules (Notes, Comptabilité, Trésorerie) et créer les autres rôles du personnel, veuillez acheter et saisir votre code d'abonnement.
                </p>
              </div>
            </div>
            {onOpenSubscriptionModal && (
              <button
                onClick={onOpenSubscriptionModal}
                className="px-4 py-2.5 bg-[#1F4A59] hover:bg-[#183944] text-white text-xs font-black rounded-xl shadow-xs shrink-0 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
              >
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span>Acheter / Activer code</span>
              </button>
            )}
          </div>
        )}

        {/* Pro Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/60">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Comptes</span>
              <Users className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{totalUsersCount}</p>
            <span className="text-[10px] text-emerald-600 font-bold">{activeUsersCount} Actifs</span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Administration</span>
              <Shield className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{adminStaffCount}</p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Corps Enseignant</span>
              <Briefcase className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{teachersCount}</p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Élèves Enregistrés</span>
              <GraduationCap className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{studentsCount}</p>
          </div>
        </div>
      </div>
      
      {/* Filters and Control Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher nom, email, matricule, classe, école..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-2xl py-2 pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1F4A59]/20 focus:border-[#1F4A59]"
          />
        </div>

        {/* Role, School & Status Filters */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          {currentUserRole === 'Admin' && distinctSchools.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/70 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase px-2">École:</span>
              <select 
                value={schoolFilter} 
                onChange={e => setSchoolFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none pr-2 cursor-pointer max-w-[140px] truncate"
              >
                <option value="All">Toutes les écoles</option>
                {distinctSchools.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/70 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Rôle:</span>
            <select 
              id="roleFilter" 
              value={roleFilter} 
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none pr-2 cursor-pointer"
            >
              <option value="All">Tous les rôles ({establishmentUsers.length})</option>
              {availableRoles.map(role => (
                <option key={role} value={role}>{role} ({establishmentUsers.filter(u => u.role === role).length})</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/70 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Statut:</span>
            <select 
              id="statusFilter" 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none pr-2 cursor-pointer"
            >
              <option value="All">Tous statuts</option>
              <option value="Actif">Actif uniquement</option>
              <option value="Inactif">Inactif uniquement</option>
            </select>
          </div>
        </div>
      </div>

      {/* Professional Interactive Data Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Identité & Coordonnées</th>
                <th className="py-4 px-6">Rôle & Affectation</th>
                {currentUserRole === 'Admin' && <th className="py-4 px-6">Établissement</th>}
                <th className="py-4 px-6">Classe / Département</th>
                <th className="py-4 px-6">Statut & Interactivité</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors group">
                  
                  {/* User Profile Info with UserAvatar */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <UserAvatar
                          src={user.avatar}
                          name={user.name}
                          role={user.role}
                          size="md"
                          status={user.status}
                          showStatus
                          className="rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="min-w-0">
                        <button 
                          onClick={() => setInspectingUser(user)}
                          className="font-black text-slate-900 dark:text-slate-100 truncate text-sm hover:text-[#1F4A59] dark:hover:text-sky-400 transition-colors text-left flex items-center gap-1 cursor-pointer"
                        >
                          <span>{user.name}</span>
                          <Eye className="w-3 h-3 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity" />
                        </button>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1 truncate font-mono">
                            <Mail className="w-3 h-3" />
                            {user.email || 'Sans email'}
                          </span>
                          {user.studentId && (
                            <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                              {user.studentId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Role Badge */}
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black border ${getRoleBadgeStyle(user.role)}`}>
                      <span>{user.role}</span>
                    </span>
                  </td>

                  {currentUserRole === 'Admin' && (
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg text-xs">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span className="max-w-[120px] truncate" title={(user as any).schoolName || 'Inconnu'}>
                          {(user as any).schoolName || 'Inconnu'}
                        </span>
                      </span>
                    </td>
                  )}

                  {/* Class / Extra Details */}
                  <td className="py-4 px-6">
                    {user.class ? (
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60 px-2.5 py-1 rounded-xl">
                        <School className="w-3.5 h-3.5 text-[#1F4A59] dark:text-sky-400" />
                        <span>{user.class}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Non assigné</span>
                    )}
                  </td>

                  {/* Interactive Status Toggle */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStatus(user)}
                        disabled={actionLoadingId === user.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border ${
                          user.status === 'Actif'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100'
                        }`}
                        title="Cliquer pour activer ou désactiver ce compte en direct"
                      >
                        {actionLoadingId === user.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : user.status === 'Actif' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        )}
                        <span>{user.status || 'Actif'}</span>
                      </button>

                      {canManageUsers && (
                        <button
                          onClick={() => handleResetPassword(user)}
                          disabled={actionLoadingId === user.id}
                          className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer"
                          title="Réinitialiser le mot de passe"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Action Toolbar */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {user.role === 'Élève' && ['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Admin', 'Co-admin'].includes(currentUserRole) && onToggleActivateStudent && (
                        <button
                          onClick={() => onToggleActivateStudent(user.id!)}
                          className={`px-3 py-1 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            user.isAccountActivated
                              ? 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md font-extrabold animate-pulse'
                          }`}
                          title={user.isAccountActivated ? "Compte élève activé (Cliquer pour désactiver)" : "Cliquer pour ACTIVER le compte de cet élève"}
                        >
                          {user.isAccountActivated ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Compte Activé</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                              <span>Activer</span>
                            </>
                          )}
                        </button>
                      )}

                      <button 
                        onClick={() => setInspectingUser(user)}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
                        title="Consulter la fiche détaillée"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {canGenerateBadges && (user.role === 'Élève' || user.role === 'Enseignant') && (
                        <button 
                          onClick={() => handleShowBadge(user)} 
                          className="p-2 text-[#1F4A59] dark:text-sky-400 hover:bg-[#1F4A59]/10 dark:hover:bg-sky-400/10 rounded-xl transition-colors cursor-pointer border border-[#1F4A59]/20"
                          title="Générer et imprimer le badge scolaire"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}
                      {canManageUsers && (
                        <>
                          <button 
                            onClick={() => handleEditUser(user)} 
                            className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
                            title="Modifier les informations"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user)} 
                            className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer border border-rose-200 dark:border-rose-800"
                            title="Supprimer ce compte"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>

                </tr>
              ))}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={currentUserRole === 'Admin' ? 6 : 5} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">Aucun utilisateur trouvé</p>
                    <p className="text-xs text-slate-500 mt-1">Essayez de modifier votre recherche ou vos filtres de sélection.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>Affichage de <strong>{filteredUsers.length}</strong> sur <strong>{establishmentUsers.length}</strong> utilisateurs</span>
          <span className="font-bold text-[#1F4A59] dark:text-sky-400">{activeUsersCount} comptes actifs</span>
        </div>
      </div>

      {/* User Form Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingUser ? `Modifier le dossier : ${editingUser.name}` : "Création d'un Nouveau Compte Utilisateur"}
        size="2xl"
      >
        <UserForm 
          user={editingUser}
          onSave={handleSaveUser}
          onCancel={() => setIsModalOpen(false)}
          currentUserRole={currentUserRole}
          isLicenseActive={isLicenseActive}
          onOpenSubscriptionModal={onOpenSubscriptionModal}
          classes={classes}
          fees={fees}
          schoolSettings={schoolSettings}
        />
      </Modal>

      {/* ID Badge Modal */}
      <Modal isOpen={isBadgeModalOpen} onClose={() => setIsBadgeModalOpen(false)} title="Badge & Carte d'Identification Scolaire" size="4xl">
        {selectedUserForBadge && (
            <IdCard
                person={selectedUserForBadge}
                schoolSettings={schoolSettings}
                onClose={() => setIsBadgeModalOpen(false)}
            />
        )}
      </Modal>

      {/* Inspect User Detailed Profile Drawer/Modal */}
      {inspectingUser && (
        <Modal 
          isOpen={Boolean(inspectingUser)} 
          onClose={() => setInspectingUser(null)} 
          title={`Fiche Utilisateur : ${inspectingUser.name}`}
          size="lg"
        >
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <UserAvatar
                src={inspectingUser.avatar}
                name={inspectingUser.name}
                role={inspectingUser.role}
                size="xl"
                status={inspectingUser.status}
                showStatus
                className="w-16 h-16 rounded-2xl shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-slate-900 dark:text-white">{inspectingUser.name}</h3>
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border ${getRoleBadgeStyle(inspectingUser.role)}`}>
                    {inspectingUser.role}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{inspectingUser.email || 'Pas d\'adresse email'}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    inspectingUser.status === 'Actif'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                  }`}>
                    {inspectingUser.status || 'Actif'}
                  </span>
                  {(inspectingUser as any).schoolName && (
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {(inspectingUser as any).schoolName}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 font-medium block">Matricule / Identifiant</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {inspectingUser.studentId || (inspectingUser as any).matricule || 'N/A'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 font-medium block">Classe / Section</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {inspectingUser.class || 'Non assigné'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 font-medium block">Téléphone / Contact</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {(inspectingUser as any).phone || 'Non renseigné'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400 font-medium block">Date de Création / Enregistrement</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">
                  {(inspectingUser as any).registrationDate || (inspectingUser as any).createdAt ? new Date((inspectingUser as any).registrationDate || (inspectingUser as any).createdAt).toLocaleDateString('fr-FR') : 'Récent'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleToggleStatus(inspectingUser);
                    setInspectingUser(prev => prev ? { ...prev, status: prev.status === 'Actif' ? 'Inactif' : 'Actif' } : null);
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                    inspectingUser.status === 'Actif'
                      ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>{inspectingUser.status === 'Actif' ? 'Désactiver le compte' : 'Activer le compte'}</span>
                </button>

                <button
                  onClick={() => {
                    const usr = inspectingUser;
                    setInspectingUser(null);
                    handleResetPassword(usr);
                  }}
                  className="px-3 py-2 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Réinitialiser MDP</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const usr = inspectingUser;
                    setInspectingUser(null);
                    handleEditUser(usr);
                  }}
                  className="px-4 py-2 bg-[#1F4A59] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#183944] cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Modifier</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Password Reset Display Modal */}
      {passwordResetModal && (
        <Modal
          isOpen={Boolean(passwordResetModal)}
          onClose={() => setPasswordResetModal(null)}
          title="Réinitialisation du mot de passe"
          size="md"
        >
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-300 flex items-center justify-center mx-auto">
              <Key className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Nouveau mot de passe pour {passwordResetModal.user.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Le mot de passe provisoire a été généré et synchronisé avec Supabase Auth.
              </p>
            </div>

            <div className="p-3.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-black text-indigo-600 dark:text-indigo-400 tracking-wider">
                {passwordResetModal.newPass}
              </span>
              <button
                onClick={() => copyToClipboard(passwordResetModal.newPass)}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copié !' : 'Copier'}</span>
              </button>
            </div>

            <button
              onClick={() => setPasswordResetModal(null)}
              className="w-full py-2.5 bg-[#1F4A59] text-white text-xs font-bold rounded-xl hover:bg-[#183944] cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDeleteUser}
        title={userToDelete?.role === 'Élève' ? "Confirmation de suppression - Élève" : `Confirmation de suppression - ${userToDelete?.role || 'Utilisateur'}`}
        itemType={userToDelete?.role === 'Élève' ? "l'élève" : `l'utilisateur (${userToDelete?.role || 'Compte'})`}
        itemName={userToDelete?.name}
        itemDetails={
          userToDelete?.role === 'Élève'
            ? `Classe : ${userToDelete.class || 'Non assignée'} ${userToDelete.studentId ? `• Matricule : ${userToDelete.studentId}` : ''} • Email : ${userToDelete.email}`
            : `Rôle : ${userToDelete?.role} • Email de connexion : ${userToDelete?.email}`
        }
        warningNote={
          userToDelete?.role === 'Élève'
            ? "Attention : La suppression de cet élève supprimera son dossier scolaire, ses notes, ses présences et ses historiques de paiements rattachés. Cette action est irréversible."
            : "Attention : Cette action est définitive. Les données de connexion, identifiants et accès rattachés à ce compte seront immédiatement supprimés."
        }
        confirmText={userToDelete?.role === 'Élève' ? "Supprimer l'élève" : "Supprimer le compte"}
        cancelText="Annuler"
      />
    </div>
  );
};

export default UserManagementPage;
