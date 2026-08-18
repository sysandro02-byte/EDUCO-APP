import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  GraduationCap, 
  MessageSquare, 
  Menu, 
  BookOpen, 
  Calendar, 
  FileText, 
  ShieldCheck,
  Building2,
  Wallet,
  Sparkles,
  PieChart
} from 'lucide-react';

interface MobileBottomNavProps {
  activePage: string;
  setActivePage: (page: string) => void;
  userRole: string;
  unreadMessagesCount?: number;
  unreadNotificationsCount?: number;
  onOpenMenu: () => void;
}

interface NavButtonConfig {
  label: string;
  targetPage: string;
  icon: React.ElementType;
  badge?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activePage,
  setActivePage,
  userRole,
  unreadMessagesCount = 0,
  unreadNotificationsCount = 0,
  onOpenMenu,
}) => {
  // Dynamically compute the top 4 quick access tabs tailored per role
  const getNavItems = (): NavButtonConfig[] => {
    switch (userRole) {
      case 'Admin':
      case 'Co-admin':
        return [
          { label: 'Dashboard', targetPage: 'Tableau de bord', icon: LayoutDashboard },
          { label: 'Utilisateurs', targetPage: 'Gestion Utilisateurs', icon: Users },
          { label: 'Licences', targetPage: 'Licences & Abonnements', icon: ShieldCheck },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];

      case 'Promoteur':
        return [
          { label: 'Accueil', targetPage: "Vue d'ensemble", icon: LayoutDashboard },
          { label: 'Finances', targetPage: 'Rapports Financiers', icon: Wallet },
          { label: 'Élèves', targetPage: 'Élèves', icon: GraduationCap },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];

      case 'Directeur Général':
        return [
          { label: 'Accueil', targetPage: "Vue d'ensemble", icon: LayoutDashboard },
          { label: 'Personnel', targetPage: 'Personnel', icon: Users },
          { label: 'Classes', targetPage: 'Classes', icon: Building2 },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];

      case 'Directeur des Etudes':
      case 'Directeur du Primaire':
        return [
          { label: 'Accueil', targetPage: 'Tableau de bord', icon: LayoutDashboard },
          { label: 'Classes', targetPage: 'Classes', icon: Building2 },
          { label: 'Emploi du temps', targetPage: 'Emploi du temps', icon: Calendar },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];

      case 'Caissière':
        return [
          { label: 'Caisse', targetPage: 'Tableau de bord', icon: LayoutDashboard },
          { label: 'Paiements', targetPage: 'Paiements Élèves', icon: CreditCard },
          { label: 'Rapports', targetPage: 'Rapports Financiers', icon: PieChart },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];

      case 'Responsable des finances':
        return [
          { label: 'Finances', targetPage: 'Tableau de bord', icon: LayoutDashboard },
          { label: 'Paiements', targetPage: 'Paiements Élèves', icon: CreditCard },
          { label: 'Comptabilité', targetPage: 'Comptabilité Générale', icon: Wallet },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];

      case 'Enseignant':
        return [
          { label: 'Dashboard', targetPage: 'Tableau de bord', icon: LayoutDashboard },
          { label: 'Mes Classes', targetPage: 'Mes Classes', icon: Users },
          { label: 'Notes', targetPage: 'Saisie des Notes', icon: FileText },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];

      case 'Élève':
        return [
          { label: 'Accueil', targetPage: 'Tableau de bord', icon: LayoutDashboard },
          { label: 'Mes Notes', targetPage: 'Mes Notes & Bulletins', icon: FileText },
          { label: 'Emploi', targetPage: 'Mon Emploi du Temps', icon: Calendar },
          { label: 'Paiements', targetPage: 'Mes Paiements', icon: CreditCard }
        ];

      case 'Parent':
      case "Parent d'élève":
        return [
          { label: 'Accueil', targetPage: 'Tableau de bord', icon: LayoutDashboard },
          { label: 'Bulletins', targetPage: 'Bulletins & Notes', icon: FileText },
          { label: 'Paiements', targetPage: 'Paiements Scolarité', icon: CreditCard },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];

      default:
        return [
          { label: 'Accueil', targetPage: 'Tableau de bord', icon: LayoutDashboard },
          { label: 'Élèves', targetPage: 'Élèves', icon: GraduationCap },
          { label: 'Finances', targetPage: 'Paiements', icon: CreditCard },
          { label: 'Messages', targetPage: 'Messagerie', icon: MessageSquare, badge: unreadMessagesCount }
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <nav 
      aria-label="Navigation mobile principale"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_25px_rgba(0,0,0,0.4)] px-2 pt-1.5 pb-safe select-none transition-all"
    >
      <div className="max-w-md mx-auto flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.targetPage;

          return (
            <button
              key={item.targetPage}
              onClick={() => setActivePage(item.targetPage)}
              className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 px-1 rounded-2xl transition-all duration-200 active:scale-90 cursor-pointer ${
                isActive 
                  ? 'text-[#1F4A59] dark:text-sky-400 font-extrabold' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium'
              }`}
            >
              {/* Active Indicator Top Glow / Pill */}
              {isActive && (
                <span className="absolute -top-1.5 w-7 h-1 bg-[#1F4A59] dark:bg-sky-400 rounded-full shadow-[0_0_8px_rgba(31,74,89,0.5)] dark:shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
              )}

              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.4]' : 'stroke-[1.8]'}`} />
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 bg-rose-500 text-white font-black text-[9px] rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 animate-pulse">
                    {item.badge! > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>

              <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-[62px] leading-none ${isActive ? 'font-black scale-105' : 'font-semibold'}`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Button: Quick Menu Drawer Trigger */}
        <button
          onClick={onOpenMenu}
          className="relative flex flex-col items-center justify-center flex-1 h-full py-1 px-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-2xl transition-all active:scale-90 cursor-pointer"
          aria-label="Ouvrir le menu complet"
        >
          <div className="relative p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
            <Menu className="w-4 h-4 stroke-[2]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white dark:border-slate-900" />
            )}
          </div>
          <span className="text-[10px] font-bold mt-0.5 tracking-tight leading-none text-slate-600 dark:text-slate-400">
            Menu
          </span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomNav;
