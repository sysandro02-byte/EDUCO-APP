import React from 'react';
import { UserAddIcon, PaymentsIcon, ReceiptIcon, BriefcaseIcon } from './Icons';
import { ChevronRight, Zap, PlusCircle, CreditCard } from 'lucide-react';

// DashboardStatCard
interface DashboardStatCardProps {
  title: string;
  value: string;
  subtitle: string;
  valueColor?: string;
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

export const DashboardStatCard: React.FC<DashboardStatCardProps> = ({ title, value, subtitle, valueColor = 'text-gray-800', onClick, className, icon }) => {
  const cardClasses = `animate-fade-slide-up group relative bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-700/70 transition-all duration-200 flex flex-col justify-between ${onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:-translate-y-0.5' : ''} ${className || ''}`;
  
  return (
    <div className={cardClasses} onClick={onClick}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xs font-bold text-gray-600 dark:text-slate-300 tracking-tight uppercase">
            {title}
          </p>
          {icon && (
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900/80 text-gray-500 dark:text-slate-400 group-hover:scale-105 transition-transform shrink-0 border border-slate-100 dark:border-slate-700/60">
              {icon}
            </div>
          )}
        </div>

        <div className="my-1">
          <p className={`text-2xl sm:text-3xl font-black tracking-tight ${valueColor}`}>
            {value}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
        <span className="text-gray-500 dark:text-slate-400 font-medium truncate max-w-[80%]">
          {subtitle}
        </span>
        {onClick && (
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform shrink-0">
            →
          </span>
        )}
      </div>
    </div>
  );
};


// Enhanced ActionButton Component with color themes, subtitles & hover feedback
interface ActionButtonProps {
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  colorScheme?: 'emerald' | 'sky' | 'rose' | 'purple';
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  label, 
  subtitle, 
  icon, 
  onClick, 
  disabled, 
  colorScheme = 'sky' 
}) => {
  const stylesMap = {
    emerald: {
      bg: 'bg-emerald-50/80 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border-emerald-200/80 dark:border-emerald-800/60',
      iconBg: 'bg-emerald-500 text-white shadow-xs',
      text: 'text-emerald-950 dark:text-emerald-100',
      subtext: 'text-emerald-700/80 dark:text-emerald-300/70',
      arrow: 'text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1',
      hoverBorder: 'hover:border-emerald-400 dark:hover:border-emerald-500'
    },
    sky: {
      bg: 'bg-sky-50/80 dark:bg-sky-950/30 hover:bg-sky-100 dark:hover:bg-sky-900/50 border-sky-200/80 dark:border-sky-800/60',
      iconBg: 'bg-[#1F4A59] text-white shadow-xs',
      text: 'text-slate-900 dark:text-sky-100',
      subtext: 'text-sky-700/80 dark:text-sky-300/70',
      arrow: 'text-[#1F4A59] dark:text-sky-400 group-hover:translate-x-1',
      hoverBorder: 'hover:border-sky-400 dark:hover:border-sky-500'
    },
    rose: {
      bg: 'bg-rose-50/80 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/50 border-rose-200/80 dark:border-rose-800/60',
      iconBg: 'bg-rose-500 text-white shadow-xs',
      text: 'text-rose-950 dark:text-rose-100',
      subtext: 'text-rose-700/80 dark:text-rose-300/70',
      arrow: 'text-rose-600 dark:text-rose-400 group-hover:translate-x-1',
      hoverBorder: 'hover:border-rose-400 dark:hover:border-rose-500'
    },
    purple: {
      bg: 'bg-purple-50/80 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border-purple-200/80 dark:border-purple-800/60',
      iconBg: 'bg-purple-600 text-white shadow-xs',
      text: 'text-purple-950 dark:text-purple-100',
      subtext: 'text-purple-700/80 dark:text-purple-300/70',
      arrow: 'text-purple-600 dark:text-purple-400 group-hover:translate-x-1',
      hoverBorder: 'hover:border-purple-400 dark:hover:border-purple-500'
    }
  };

  const scheme = stylesMap[colorScheme];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 shadow-xs hover:shadow-md ${scheme.bg} ${scheme.hoverBorder} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:border-slate-200 min-w-0`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2.5 rounded-xl shrink-0 transition-transform duration-200 group-hover:scale-105 ${scheme.iconBg}`}>
          {icon}
        </div>
        <div className="text-left min-w-0">
          <p className={`font-bold text-sm tracking-tight ${scheme.text} whitespace-nowrap truncate`}>
            {label}
          </p>
          {subtitle && (
            <p className={`text-[10px] font-medium mt-0.5 ${scheme.subtext} whitespace-nowrap truncate max-w-[120px] xs:max-w-[140px] sm:max-w-[180px]`}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <ChevronRight className={`w-4 h-4 shrink-0 transition-transform duration-200 ${scheme.arrow}`} />
    </button>
  );
};

interface QuickActionsCardProps {
  onInscription: () => void;
  onPaiement: () => void;
  onDepense: () => void;
  onSalaire: () => void;
  disabled?: boolean;
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({ 
  onInscription, 
  onPaiement, 
  onDepense, 
  onSalaire, 
  disabled 
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-md border border-slate-100 dark:border-slate-700/60 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-gray-900 dark:text-slate-100 text-base tracking-tight">
              Actions Rapides
            </h4>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Saisie directe & opérations de caisse
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
          Raccourcis
        </span>
      </div>

      <div className="space-y-2.5 my-auto">
        <ActionButton 
          label="Paiement Écolage" 
          subtitle="Scolarité, frais & reçus"
          colorScheme="sky"
          icon={<CreditCard className="w-4 h-4" />} 
          onClick={onPaiement} 
          disabled={disabled} 
        />
        <ActionButton 
          label="Saisie Dépense" 
          subtitle="Charges & frais de caisse"
          colorScheme="rose"
          icon={<ReceiptIcon />} 
          onClick={onDepense} 
          disabled={disabled}
        />
        <ActionButton 
          label="Paiement Salaire" 
          subtitle="Paie enseignants & personnel"
          colorScheme="purple"
          icon={<BriefcaseIcon />} 
          onClick={onSalaire} 
          disabled={disabled}
        />
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 text-center">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-500">
          ⚡ Validation instantanée en caisse
        </p>
      </div>
    </div>
  );
};
