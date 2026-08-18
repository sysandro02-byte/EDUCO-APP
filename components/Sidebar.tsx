import React from 'react';
import { 
  XIcon,
  PencilIcon,
} from './Icons';
import { USER_PROFILES, ROLE_NAV_ITEMS } from '../constants';
import { User } from './UserForm';
import { ShieldCheck, Sparkles, Database, Building2, BarChart3, Settings, LogOut, ChevronRight, Search, Moon, Sun } from 'lucide-react';
import { compressBase64Image } from '../utils/imageCompressor';
import UserAvatar from './UserAvatar';

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  isLogout?: boolean;
}> = ({ icon, label, active, onClick, isLogout }) => {
  return (
    <li
      className={`group flex items-center justify-between px-3.5 py-3 lg:py-2.5 my-1 rounded-xl cursor-pointer transition-all duration-200 relative text-xs sm:text-xs tracking-tight font-bold touch-target ${
        isLogout
          ? 'text-rose-300 hover:bg-rose-500/20 hover:text-white mt-4 border border-rose-500/20'
          : active
          ? 'bg-white/15 text-white font-extrabold shadow-sm border-l-4 border-emerald-400 pl-3'
          : 'text-slate-300/80 hover:bg-white/10 hover:text-white active:bg-white/15'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`transition-transform duration-200 shrink-0 ${active ? 'text-emerald-400 scale-105' : 'text-slate-300 group-hover:text-white group-hover:scale-105'}`}>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      {active && (
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-xs shadow-emerald-400"></span>
      )}
    </li>
  );
};

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  currentUser: User | null | undefined;
  onUpdateAvatar: (avatar: string) => void;
  onLogout: () => void;
  activePage: string;
  setActivePage: (page: string) => void;
  onOpenSearch?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  setIsOpen, 
  currentUser, 
  onUpdateAvatar, 
  onLogout, 
  activePage, 
  setActivePage,
  onOpenSearch 
}) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  if (!currentUser) {
    return null;
  }
  
  const userProfile = USER_PROFILES[currentUser.role];
  const navItems = ROLE_NAV_ITEMS[currentUser.role] || [];

  const handleNavClick = (label: string) => {
    if (label === 'Déconnexion') {
      onLogout();
      return;
    }
    setActivePage(label);
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };
  
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = async () => {
              try {
                  const compressed = await compressBase64Image(reader.result as string, 128, 128);
                  onUpdateAvatar(compressed);
              } catch (err) {
                  onUpdateAvatar(reader.result as string);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Co-admin';

  // Group Admin items logically for maximum readability
  const adminCategories = [
    {
      title: 'Global & Supervision',
      items: ['Tableau de bord', 'Licences & Abonnements', 'Établissements BD', 'Gestion Utilisateurs']
    },
    {
      title: 'Base de Données & IA',
      items: ['Console Supabase', 'Sauvegardes & BD', 'Diagnostic Supabase', 'Gestion de l\'IA']
    },
    {
      title: 'Finances & Assiduité',
      items: ['Présences par Établissement', 'Surveillance Finances', 'Revenus vs Dépenses', 'Messagerie Établissements']
    },
    {
      title: 'Configuration',
      items: ['Paramètres', 'Déconnexion']
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      <div 
        className={`fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      ></div>

      <aside className={`
        fixed inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 
        transition-all duration-300 ease-in-out z-50 lg:z-40
        w-80 sm:w-72 bg-gradient-to-b from-[#1F4A59] via-[#1A3F4C] to-[#163540] text-white shadow-2xl p-4 sm:p-5 
        flex flex-col shrink-0 border-r border-white/10 pt-safe pb-safe
      `}>
        {/* Brand Header */}
        <div className="flex-shrink-0 mb-4 sm:mb-5">
          <div className="flex justify-between items-center mb-3 sm:mb-4">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => handleNavClick('Tableau de bord')}>
              <div className="w-10 h-10 rounded-xl bg-white text-[#1F4A59] flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform shrink-0">
                E
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg font-black tracking-tight text-white uppercase">EDUCO</h1>
                  <span className="px-1.5 py-0.2 bg-emerald-400/20 text-emerald-300 text-[9px] font-extrabold rounded uppercase tracking-wider">
                    v3.2
                  </span>
                </div>
                <p className="text-[10px] text-slate-300/80 font-bold uppercase tracking-widest">Smarter School</p>
              </div>
            </div>
            <button 
              className="lg:hidden text-slate-300 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 touch-target flex items-center justify-center cursor-pointer" 
              onClick={() => setIsOpen(false)} 
              aria-label="Fermer le menu"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Mobile Search Bar Button */}
          {onOpenSearch && (
            <button
              onClick={() => {
                setIsOpen(false);
                onOpenSearch();
              }}
              className="w-full mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 text-xs text-slate-200 font-semibold transition-all cursor-pointer text-left"
            >
              <Search className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="flex-1 truncate">Recherche rapide...</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 bg-white/10 rounded text-slate-300">
                Rechercher
              </span>
            </button>
          )}

          {/* User Profile Strip (Compact & Clean) */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-3 rounded-2xl flex items-center gap-3 relative overflow-hidden group">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*"
            />
            
            <button onClick={handleAvatarClick} className="relative group shrink-0 cursor-pointer" title="Changer la photo de profil">
              <UserAvatar
                src={currentUser?.avatar}
                name={currentUser.name}
                role={currentUser.role}
                size="md"
                className="rounded-xl border-2 border-white/20 shadow-sm transition-transform group-hover:scale-105"
              />
              <div className="absolute -bottom-1 -right-1 bg-emerald-400 text-[#1F4A59] p-1 rounded-md shadow-xs z-10">
                <PencilIcon className="w-2.5 h-2.5" />
              </div>
            </button>

            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-black text-white truncate">{currentUser.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 rounded-md text-[9px] font-extrabold uppercase tracking-wider truncate">
                  {userProfile?.role || currentUser.role}
                </span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Navigation Section */}
        <div className="flex-grow overflow-y-auto px-1 -mx-2 pr-2 scrollbar-thin scrollbar-thumb-white/20">
          {isAdmin ? (
            <div className="space-y-4">
              {adminCategories.map((cat, idx) => {
                const catNavItems = navItems.filter(item => cat.items.includes(item.label));
                if (catNavItems.length === 0) return null;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="px-2 pt-1 pb-1 flex items-center gap-2">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-300/60">{cat.title}</span>
                      <div className="h-[1px] flex-1 bg-white/10"></div>
                    </div>
                    <ul>
                      {catNavItems.map(({ label, icon: Icon }) => (
                        <NavItem
                          key={label}
                          icon={<Icon className="w-4 h-4" />}
                          label={label}
                          active={activePage === label}
                          isLogout={label === 'Déconnexion'}
                          onClick={() => handleNavClick(label)}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <div className="px-2 pb-2 text-[10px] uppercase font-extrabold tracking-wider text-slate-300/60">
                Navigation Principale
              </div>
              <ul className="space-y-0.5">
                {navItems.map(({ label, icon: Icon }) => (
                  <NavItem
                    key={label}
                    icon={<Icon className="w-4 h-4" />}
                    label={label}
                    active={activePage === label}
                    isLogout={label === 'Déconnexion'}
                    onClick={() => handleNavClick(label)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer with System Info */}
        <div className="pt-3 mt-3 border-t border-white/10 shrink-0 space-y-1.5 px-1">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-300/60 uppercase tracking-widest">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              EDUCO Pro
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{currentUser.role === 'Admin' ? 'Supabase Live' : 'Serveur Connecté'}</span>
          </div>
          <div className="text-[9px] text-slate-400/80 text-center pt-0.5">
            EDUCO APP développée par <span className="text-teal-300 font-bold">LoukaTech</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

