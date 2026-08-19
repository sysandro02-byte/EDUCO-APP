import React from 'react';
import { 
  Lock, 
  ShieldAlert, 
  Sparkles, 
  Zap, 
  ArrowRight, 
  UserCheck, 
  Key, 
  Clock, 
  FileText,
  Copy,
  CheckCircle2
} from 'lucide-react';
import { SchoolSubscriptionInfo } from '../src/services/api';

interface LockedFeatureGuardProps {
  featureName: string;
  subscriptionInfo: SchoolSubscriptionInfo | null;
  onOpenSubscriptionModal: () => void;
  onNavigateToRegistration: () => void;
}

const LockedFeatureGuard: React.FC<LockedFeatureGuardProps> = ({
  featureName,
  subscriptionInfo,
  onOpenSubscriptionModal,
  onNavigateToRegistration,
}) => {
  const [copied, setCopied] = React.useState(false);
  const schoolId = subscriptionInfo?.schoolIdentifier || 'Non renseigné';

  const handleCopyId = () => {
    navigator.clipboard.writeText(schoolId);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-xl w-full bg-white rounded-3xl p-6 sm:p-8 border-2 border-slate-200/80 shadow-xl text-center space-y-6 animate-fade-in relative overflow-hidden">
        
        {/* Top Decorative Background Accent */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-amber-100 rounded-full blur-2xl pointer-events-none opacity-60"></div>
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-teal-100 rounded-full blur-2xl pointer-events-none opacity-60"></div>

        {/* Lock Icon */}
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 mx-auto flex items-center justify-center border-2 border-amber-200 shadow-xs">
          <Lock className="w-8 h-8" />
        </div>

        {/* Heading */}
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-full border border-amber-200 mb-2">
            <Clock className="w-3.5 h-3.5" />
            Mode Inscription Uniquement • Licence Requise
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Accès Restreint : {featureName}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 max-w-md mx-auto leading-relaxed">
            Ce module est verrouillé. Avant l'achat de votre abonnement auprès de l'administrateur EDUCO, seule la fonctionnalité <strong>d'inscription et réinscription des élèves</strong> est active.
          </p>
        </div>

        {/* School Identifier Box */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 text-left">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase">Identifiant de votre établissement</p>
            <p className="text-sm font-black text-[#1F4A59] font-mono tracking-wider">{schoolId}</p>
          </div>
          <button
            onClick={handleCopyId}
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 shrink-0"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copié</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copier</span>
              </>
            )}
          </button>
        </div>

        {/* Pricing options reminder */}
        <div className="grid grid-cols-2 gap-3 text-left">
          <div className="p-3 rounded-xl border border-slate-200 bg-white">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Formule Standard</p>
            <p className="text-xs font-black text-slate-900 mt-0.5">10.000 FCFA <span className="text-[9px] font-normal text-slate-500">/ mois</span></p>
            <p className="text-[10px] text-slate-500 mt-0.5">Toutes fonctions sans IA</p>
          </div>
          <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/40">
            <p className="text-[10px] font-bold text-purple-700 uppercase flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              IA Premium
            </p>
            <p className="text-xs font-black text-purple-950 mt-0.5">20.000 FCFA <span className="text-[9px] font-normal text-slate-500">/ mois</span></p>
            <p className="text-[10px] text-purple-800 mt-0.5">Toutes fonctions avec IA</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={onNavigateToRegistration}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span>Aller aux Inscriptions</span>
          </button>

          <button
            type="button"
            onClick={onOpenSubscriptionModal}
            className="flex-1 px-5 py-2.5 bg-[#1F4A59] hover:bg-[#275d70] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
          >
            <Key className="w-4 h-4 text-emerald-400" />
            <span>Activer un Code / Renouveler</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default LockedFeatureGuard;
