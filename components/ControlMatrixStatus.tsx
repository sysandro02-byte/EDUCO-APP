import React from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface ControlRule {
  id: string;
  label: string;
  isValid: boolean;
  errorMessage?: string;
  isWarningOnly?: boolean;
}

interface ControlMatrixStatusProps {
  rules: ControlRule[];
  title?: string;
  className?: string;
  compact?: boolean;
}

export const ControlMatrixStatus: React.FC<ControlMatrixStatusProps> = ({
  rules,
  title = 'Matrice de Contrôle & Conformité Financière',
  className = '',
  compact = false,
}) => {
  const blockingRules = rules.filter(r => !r.isWarningOnly);
  const validCount = blockingRules.filter(r => r.isValid).length;
  const totalCount = blockingRules.length;
  const isAllValid = totalCount > 0 && validCount === totalCount;

  if (compact) {
    return (
      <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
        isAllValid 
          ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
          : 'bg-amber-50/80 border-amber-200 text-amber-900'
      } ${className}`}>
        <div className="flex items-center gap-2">
          {isAllValid ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="font-semibold text-[11px]">
            {isAllValid 
              ? 'Tous les points de contrôle sont validés' 
              : `Contrôles obligatoires : ${validCount}/${totalCount} validés`}
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          isAllValid ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
        }`}>
          {isAllValid ? 'CONFORME' : 'SAISIE INCOMPLÈTE'}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-3.5 rounded-xl border transition-all ${
      isAllValid 
        ? 'bg-emerald-50/60 border-emerald-200/90' 
        : 'bg-slate-50 border-slate-200'
    } ${className}`}>
      <div className="flex items-center justify-between pb-2 border-b border-slate-200/70 mb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className={`w-4 h-4 ${isAllValid ? 'text-emerald-600' : 'text-[#1F4A59]'}`} />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {title}
          </span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isAllValid 
            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
            : 'bg-amber-100 text-amber-800 border border-amber-300'
        }`}>
          {validCount} / {totalCount} points validés
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
        {rules.map((rule) => {
          const ok = rule.isValid;
          return (
            <div 
              key={rule.id}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-colors ${
                ok 
                  ? 'text-emerald-800 bg-emerald-100/50' 
                  : rule.isWarningOnly
                    ? 'text-slate-600 bg-slate-100'
                    : 'text-rose-700 bg-rose-50/80 font-medium'
              }`}
            >
              <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${
                ok 
                  ? 'bg-emerald-600 text-white' 
                  : rule.isWarningOnly
                    ? 'bg-slate-300 text-slate-700'
                    : 'bg-rose-500 text-white'
              }`}>
                {ok ? '✓' : '•'}
              </span>
              <span className="truncate">{rule.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ControlMatrixStatus;
