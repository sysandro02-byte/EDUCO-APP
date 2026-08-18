import React, { useState, useMemo, useEffect, useRef } from 'react';
import { BellIcon } from './Icons';
import { 
  Bell, 
  AlertTriangle, 
  Info, 
  BookOpen, 
  CreditCard, 
  Check, 
  X, 
  ChevronRight, 
  ChevronLeft, 
  ExternalLink, 
  Clock, 
  Shield, 
  CheckCircle2, 
  Copy, 
  Sparkles,
  School,
  UserCheck,
  Trash2,
  Eye,
  CheckCheck
} from 'lucide-react';

export interface NotificationItem {
  id: string | number;
  title?: string;
  message: string;
  type: string; // 'Alerte' | 'Information' | 'Pédagogie' | 'Revenu' | 'Dépense' | string
  roles?: string[];
  timestamp: string;
  read: boolean;
  link?: string;
  metadata?: {
    schoolName?: string;
    schoolIdentifier?: string;
    promoterName?: string;
    amount?: number;
  };
}

interface NotificationBellProps {
  notifications: NotificationItem[];
  currentUserRole: string;
  onMarkAsRead: () => void;
  onMarkSingleAsRead?: (id: string | number) => void;
  onDeleteNotification?: (id: string | number) => void;
  onClearAllNotifications?: () => void;
  onNotificationClick: (link: string, notifId?: string | number) => void;
}

const formatTimeAgo = (timestamp: string) => {
  if (!timestamp) return "à l'instant";
  const now = new Date();
  const past = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (isNaN(seconds) || seconds < 60) return `à l'instant`;
  let interval = seconds / 31536000;
  if (interval >= 1) return `il y a ${Math.floor(interval)} an(s)`;
  interval = seconds / 2592000;
  if (interval >= 1) return `il y a ${Math.floor(interval)} mois`;
  interval = seconds / 86400;
  if (interval >= 1) return `il y a ${Math.floor(interval)} j`;
  interval = seconds / 3600;
  if (interval >= 1) return `il y a ${Math.floor(interval)} h`;
  interval = seconds / 60;
  return `il y a ${Math.floor(interval)} min`;
};

const NotificationBell: React.FC<NotificationBellProps> = ({ 
  notifications, 
  currentUserRole, 
  onMarkAsRead, 
  onMarkSingleAsRead,
  onDeleteNotification,
  onClearAllNotifications,
  onNotificationClick 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'Tous' | 'Alerte' | 'Information' | 'Pédagogie' | 'Finances'>('Tous');
  const [activeNotification, setActiveNotification] = useState<NotificationItem | null>(null);
  const [isSideDrawerOpen, setIsSideDrawerOpen] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Normalize notifications for current role
  const userNotifications = useMemo(() => {
    return (notifications || [])
      .filter(n => !n.roles || n.roles.length === 0 || n.roles.includes(currentUserRole))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [notifications, currentUserRole]);

  // Filtered by type
  const filteredNotifications = useMemo(() => {
    if (selectedFilter === 'Tous') return userNotifications;
    if (selectedFilter === 'Finances') {
      return userNotifications.filter(n => n.type === 'Revenu' || n.type === 'Dépense' || n.type === 'Finances');
    }
    return userNotifications.filter(n => n.type?.toLowerCase() === selectedFilter.toLowerCase());
  }, [userNotifications, selectedFilter]);

  const unreadCount = useMemo(() => {
    return userNotifications.filter(n => !n.read).length;
  }, [userNotifications]);

  const getFilterCount = (filterName: string) => {
    if (filterName === 'Tous') return userNotifications.length;
    if (filterName === 'Finances') {
      return userNotifications.filter(n => n.type === 'Revenu' || n.type === 'Dépense' || n.type === 'Finances').length;
    }
    return userNotifications.filter(n => n.type?.toLowerCase() === filterName.toLowerCase()).length;
  };

  const handleToggle = () => {
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCardClick = (notification: NotificationItem) => {
    // Mark as read
    if (onMarkSingleAsRead) {
      onMarkSingleAsRead(notification.id);
    }
    setIsOpen(false);

    if (notification.link) {
      onNotificationClick(notification.link, notification.id);
    } else {
      setActiveNotification(notification);
      setIsSideDrawerOpen(true);
    }
  };

  const handleOpenPreviewDrawer = (notif: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (onMarkSingleAsRead) {
      onMarkSingleAsRead(notif.id);
    }
    setActiveNotification(notif);
    setIsSideDrawerOpen(true);
    setIsOpen(false);
  };

  const handleNextNotification = () => {
    if (!activeNotification) return;
    const currentIndex = userNotifications.findIndex(n => n.id === activeNotification.id);
    if (currentIndex < userNotifications.length - 1) {
      setActiveNotification(userNotifications[currentIndex + 1]);
    }
  };

  const handlePrevNotification = () => {
    if (!activeNotification) return;
    const currentIndex = userNotifications.findIndex(n => n.id === activeNotification.id);
    if (currentIndex > 0) {
      setActiveNotification(userNotifications[currentIndex - 1]);
    }
  };

  const getTypeMeta = (type: string) => {
    const t = type?.toLowerCase() || '';
    if (t.includes('alerte') || t.includes('danger') || t.includes('urgent')) {
      return {
        label: 'Alerte',
        bg: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        dot: 'bg-rose-500',
        icon: AlertTriangle,
      };
    }
    if (t.includes('pédagogie') || t.includes('note') || t.includes('cours')) {
      return {
        label: 'Pédagogie',
        bg: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
        dot: 'bg-indigo-500',
        icon: BookOpen,
      };
    }
    if (t.includes('revenu') || t.includes('dépense') || t.includes('finance') || t.includes('paiement')) {
      return {
        label: 'Finances',
        bg: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
        dot: 'bg-emerald-500',
        icon: CreditCard,
      };
    }
    return {
      label: 'Information',
      bg: 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800',
      dot: 'bg-sky-500',
      icon: Info,
    };
  };

  return (
    <>
      {/* Bell Button */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={handleToggle}
          className={`relative p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer ${
            unreadCount > 0 ? "animate-pulse" : ""
          }`}
          aria-label="Notifications"
          title="Notifications & Alertes"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 justify-center items-center text-white text-[9px] font-black">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          )}
        </button>

        {/* Dropdown Popover */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-scaleIn">
            
            {/* Popover Header */}
            <div className="p-3.5 bg-gradient-to-r from-[#1F4A59] to-[#285d70] text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                <h4 className="font-bold text-xs">Centre de Notifications</h4>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-black">
                    {unreadCount} non lu(s)
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onMarkAsRead(); }}
                    className="text-[10px] bg-white/20 hover:bg-white/30 text-white font-bold px-2 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck className="w-3 h-3" />
                    <span>Tout lire</span>
                  </button>
                )}
                {onClearAllNotifications && userNotifications.length > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClearAllNotifications(); }}
                    className="text-[10px] bg-rose-500/30 hover:bg-rose-500/50 text-rose-100 font-bold p-1 rounded-lg transition-all cursor-pointer"
                    title="Effacer toutes les notifications"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Chips Bar */}
            <div className="p-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1.5 overflow-x-auto text-[11px]">
              {(['Tous', 'Alerte', 'Information', 'Pédagogie', 'Finances'] as const).map((filter) => {
                const count = getFilterCount(filter);
                const isSelected = selectedFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={(e) => { e.stopPropagation(); setSelectedFilter(filter); }}
                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1F4A59] text-white shadow-2xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {filter} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notification) => {
                  const meta = getTypeMeta(notification.type);
                  const IconComp = meta.icon;

                  return (
                    <div 
                      key={notification.id}
                      onClick={() => handleCardClick(notification)}
                      className={`group p-3.5 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                        !notification.read ? 'bg-sky-50/60 dark:bg-sky-950/20 font-medium' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 ${meta.bg}`}>
                          <IconComp className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${meta.bg}`}>
                              {meta.label}
                            </span>
                            {!notification.read && (
                              <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                            )}
                          </div>
                          
                          {notification.title && (
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                              {notification.title}
                            </p>
                          )}

                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                            {notification.message}
                          </p>

                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-slate-400">
                              {formatTimeAgo(notification.timestamp)}
                            </span>

                            {notification.link && (
                              <span className="text-[10px] font-bold text-[#1F4A59] dark:text-sky-400 flex items-center gap-0.5 group-hover:underline">
                                <span>Voir {notification.link}</span>
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Action Icons */}
                      <div className="flex flex-col items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => handleOpenPreviewDrawer(notification, e)}
                          className="p-1 rounded-md text-slate-400 hover:text-[#1F4A59] dark:hover:text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                          title="Aperçu détaillé"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteNotification && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNotification(notification.id);
                            }}
                            className="p-1 rounded-md text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Supprimer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-slate-400 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center text-slate-400">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-slate-600 dark:text-slate-300">Aucune notification dans cette catégorie</p>
                  <p className="text-[11px]">Les nouvelles activités apparaîtront ici automatiquement en temps réel.</p>
                </div>
              )}
            </div>

            {/* Popover Footer */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 text-center">
              <p className="text-[10px] text-slate-500 font-medium">
                Cliquez sur une notification pour accéder directement à la page
              </p>
            </div>

          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SIDE OVER PREVIEW DRAWER (PANNEAU LATÉRAL AVEC ACTIONS CONTEXTUELLES)    */}
      {/* ========================================================================= */}
      {isSideDrawerOpen && activeNotification && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Overlay backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-2xs transition-opacity animate-fadeIn"
            onClick={() => setIsSideDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 flex flex-col justify-between animate-slideLeft">
              
              {/* Drawer Top Bar */}
              <div className="p-5 bg-gradient-to-r from-[#1F4A59] to-[#285d70] text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-xl border border-white/20">
                    <Bell className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-sky-200">Aperçu Rapide Latéral</span>
                    <h3 className="text-sm font-black">Détails de la Notification</h3>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {/* Prev / Next Notif */}
                  <button
                    onClick={handlePrevNotification}
                    title="Notification précédente"
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleNextNotification}
                    title="Notification suivante"
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsSideDrawerOpen(false)}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer ml-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Body Content */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-100">
                
                {/* Type & Date Badges */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${getTypeMeta(activeNotification.type).bg}`}>
                    <span className={`w-2 h-2 rounded-full ${getTypeMeta(activeNotification.type).dot}`} />
                    <span>Catégorie : {getTypeMeta(activeNotification.type).label}</span>
                  </span>

                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatTimeAgo(activeNotification.timestamp)}</span>
                  </span>
                </div>

                {/* Title */}
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-slate-100">
                    {activeNotification.title || "Notification Système"}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Reçu le {new Date(activeNotification.timestamp || Date.now()).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Full Message Box */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                  {activeNotification.message}
                </div>

                {/* Target Link & Direct Navigation */}
                {activeNotification.link && (
                  <div className="p-4 bg-sky-50 dark:bg-sky-950/40 rounded-xl border border-sky-200 dark:border-sky-800 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-sky-900 dark:text-sky-300">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>Action Recommandée</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Accédez directement au module concerné pour traiter cette alerte :
                    </p>
                    <button
                      onClick={() => {
                        setIsSideDrawerOpen(false);
                        onNotificationClick(activeNotification.link!, activeNotification.id);
                      }}
                      className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 bg-[#1F4A59] hover:bg-[#285d70] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Ouvrir la page : {activeNotification.link}</span>
                    </button>
                  </div>
                )}

              </div>

              {/* Drawer Footer Actions */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${activeNotification.title ? activeNotification.title + '\n\n' : ''}${activeNotification.message}`);
                    setCopiedToast(true);
                    setTimeout(() => setCopiedToast(false), 2500);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedToast ? 'Copié !' : 'Copier texte'}</span>
                </button>

                {onDeleteNotification && (
                  <button
                    onClick={() => {
                      onDeleteNotification(activeNotification.id);
                      setIsSideDrawerOpen(false);
                    }}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl hover:bg-rose-100 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Supprimer</span>
                  </button>
                )}

                <button
                  onClick={() => setIsSideDrawerOpen(false)}
                  className="px-4 py-2 bg-[#1F4A59] text-white text-xs font-black rounded-xl hover:bg-[#285d70] transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;

