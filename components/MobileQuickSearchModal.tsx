import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  X, 
  User, 
  GraduationCap, 
  BookOpen, 
  ChevronRight, 
  Sparkles, 
  ArrowRight,
  Shield,
  Layers,
  FileSpreadsheet,
  Settings,
  CreditCard,
  Building2
} from 'lucide-react';
import { User as UserType } from './UserForm';
import UserAvatar from './UserAvatar';

interface MobileQuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserType[];
  activePage: string;
  setActivePage: (page: string) => void;
  onSelectStudentProfile: (studentId: number) => void;
  userRole: string;
}

export const MobileQuickSearchModal: React.FC<MobileQuickSearchModalProps> = ({
  isOpen,
  onClose,
  users,
  activePage,
  setActivePage,
  onSelectStudentProfile,
  userRole,
}) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'students' | 'staff' | 'pages'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Shortcuts based on role
  const quickPages = [
    { label: 'Tableau de bord', desc: 'Accueil & statistiques', icon: Layers },
    { label: 'Gestion Utilisateurs', desc: 'Gestion des comptes', icon: User },
    { label: 'Paiements', desc: 'Frais scolaires & reçus', icon: CreditCard },
    { label: 'Messagerie', desc: 'Échanges & notifications', icon: Sparkles },
    { label: 'Paramètres', desc: 'Configuration de l\'application', icon: Settings },
  ];

  const filteredUsers = users.filter(u => {
    if (userRole !== 'Admin' && (u.role === 'Admin' || u.role === 'SuperAdmin')) return false;
    if (!query.trim()) return false;
    const q = query.toLowerCase();
    const matchesName = u.name?.toLowerCase().includes(q);
    const matchesEmail = u.email?.toLowerCase().includes(q);
    const matchesId = u.studentId?.toLowerCase().includes(q);
    const matchesRole = u.role?.toLowerCase().includes(q);

    if (activeFilter === 'students') return (matchesName || matchesEmail || matchesId) && (u.role === 'Élève' || u.role === 'Etudiant');
    if (activeFilter === 'staff') return (matchesName || matchesEmail || matchesRole) && u.role !== 'Élève';
    return matchesName || matchesEmail || matchesId || matchesRole;
  });

  const filteredPages = quickPages.filter(p => {
    if (!query.trim()) return activeFilter === 'pages';
    const q = query.toLowerCase();
    return p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
  });

  const handleSelectPage = (pageName: string) => {
    setActivePage(pageName);
    onClose();
  };

  const handleSelectUser = (u: UserType) => {
    if (u.role === 'Élève' || u.role === 'Etudiant') {
      onSelectStudentProfile(u.id as number);
    } else {
      setActivePage('Gestion Utilisateurs');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      {/* Search Header Container */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 pt-safe shadow-md">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-5 h-5" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un élève, enseignant, page..."
                className="w-full pl-11 pr-10 py-3 bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-2xl text-sm font-medium border border-transparent focus:border-[#1F4A59] dark:focus:border-sky-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-3.5 py-3 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors shrink-0"
            >
              Fermer
            </button>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: 'Tout' },
              { id: 'students', label: 'Élèves' },
              { id: 'staff', label: 'Personnel & Profs' },
              { id: 'pages', label: 'Pages & Menus' },
            ].map((chip) => (
              <button
                key={chip.id}
                onClick={() => setActiveFilter(chip.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeFilter === chip.id
                    ? 'bg-[#1F4A59] dark:bg-sky-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Container */}
      <div className="flex-1 overflow-y-auto p-4 max-w-xl mx-auto w-full space-y-4 pb-20">
        {/* If no query, show recommended pages */}
        {!query.trim() && (
          <div className="space-y-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
              Raccourcis Fréquents
            </h4>
            <div className="grid grid-cols-1 gap-2">
              {quickPages.map((page) => {
                const Icon = page.icon;
                return (
                  <div
                    key={page.label}
                    onClick={() => handleSelectPage(page.label)}
                    className="flex items-center justify-between p-3 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-[#1F4A59] dark:hover:border-sky-500 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {page.label}
                        </p>
                        <p className="text-xs text-slate-400">
                          {page.desc}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search Results */}
        {query.trim() && (
          <div className="space-y-4">
            {/* Users section */}
            {filteredUsers.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Utilisateurs ({filteredUsers.length})
                  </h4>
                </div>
                <div className="space-y-1.5">
                  {filteredUsers.slice(0, 10).map((u) => (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-[#1F4A59] dark:hover:border-sky-500 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          src={u.avatar}
                          name={u.name}
                          role={u.role}
                          size="md"
                          className="rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {u.name}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {u.email || u.studentId || 'Sans matricule'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-extrabold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[#1F4A59] dark:text-sky-300 rounded-lg">
                          {u.role}
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pages section */}
            {filteredPages.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
                  Navigation & Menus
                </h4>
                <div className="space-y-1.5">
                  {filteredPages.map((page) => {
                    const Icon = page.icon;
                    return (
                      <div
                        key={page.label}
                        onClick={() => handleSelectPage(page.label)}
                        className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-[#1F4A59] dark:hover:border-sky-500 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">
                              {page.label}
                            </p>
                            <p className="text-xs text-slate-400">
                              {page.desc}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredUsers.length === 0 && filteredPages.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <p className="font-bold text-base text-slate-700 dark:text-slate-300">
                  Aucun résultat trouvé
                </p>
                <p className="text-xs mt-1">
                  Essayez avec un autre nom, rôle ou matricule
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileQuickSearchModal;
