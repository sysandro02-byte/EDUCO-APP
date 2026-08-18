import React from 'react';
import { LogoIcon } from './Icons';
import { 
  Mail, 
  Sparkles, 
  CheckCircle2, 
  Lock, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  Copy, 
  X, 
  ExternalLink,
  Bot,
  Layers,
  GraduationCap,
  Calculator,
  UserCheck
} from 'lucide-react';

interface WelcomeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  promoterName: string;
  promoterEmail: string;
  schoolIdentifier: string;
  onOpenSubscriptionModal: () => void;
}

const WelcomeEmailModal: React.FC<WelcomeEmailModalProps> = ({
  isOpen,
  onClose,
  schoolName,
  promoterName,
  promoterEmail,
  schoolIdentifier,
  onOpenSubscriptionModal,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopyId = () => {
    navigator.clipboard.writeText(schoolIdentifier);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Email Header Bar */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1F4A59] text-white flex items-center justify-center">
              <Mail className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">E-mail Officiel de Bienvenue EDUCO</p>
              <p className="text-[10px] text-slate-400">Expéditeur: notification@educo.app • Destinataire: {promoterEmail}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Email Content Container (Stylized as an official Email Template) */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Brand & Greeting */}
          <div className="text-center pb-5 border-b border-slate-100">
            <div className="flex justify-center mx-auto mb-2">
              <LogoIcon />
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              Compte Promoteur & Établissement Validés
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#1F4A59]">
              Bienvenue sur la plateforme EDUCO !
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Félicitations <strong className="text-slate-800">{promoterName}</strong>, l'espace institutionnel de <strong className="text-slate-800">{schoolName}</strong> a été créé avec succès.
            </p>
          </div>

          {/* School Identifier Box */}
          <div className="bg-gradient-to-r from-slate-50 to-teal-50/40 p-4 rounded-2xl border border-teal-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Identifiant Unique de l'Établissement</p>
              <p className="text-base sm:text-lg font-black text-[#1F4A59] tracking-wider mt-0.5">{schoolIdentifier}</p>
              <p className="text-[11px] text-slate-500">À communiquer à l'administrateur pour l'activation ou le renouvellement de votre licence.</p>
            </div>
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#1F4A59] bg-white hover:bg-slate-50 border border-slate-200 rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-700">Copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-500" />
                  <span>Copier l'identifiant</span>
                </>
              )}
            </button>
          </div>

          {/* Key Features Overview */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Découvrez la puissance de votre nouvel outil
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-teal-100 text-teal-800 shrink-0 mt-0.5">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Inscriptions & Dossiers Élèves</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Gestion complète des dossiers, réinscriptions et certificats de scolarité.</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-800 shrink-0 mt-0.5">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Gestion Académique & Bulletins</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Saisie des notes, calcul automatique des moyennes et génération des bulletins.</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0 mt-0.5">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Caisse & Comptabilité Automatisée</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Encaissements, gestion des impayés, paie du personnel et journal comptable.</p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-purple-100 text-purple-800 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-slate-800">Intelligence Artificielle EDUCO</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">Génération automatique des appréciations, analyses financières et pédagogiques.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Mandatory Subscription Notice (Pre-subscription Status) */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Statut Actuel : Mode Inscription Uniquement (Pré-Abonnement)</span>
            </div>
            <p className="text-[11px] sm:text-xs text-amber-800 leading-relaxed">
              Pour le moment, seules les fonctionnalités <strong>d'inscription et de réinscription des élèves</strong> sont ouvertes. Pour déverrouiller l'ensemble des modules (Comptabilité, Notes, Bulletins, RH, Emplois du temps, IA), vous devez acquérir votre <strong>code d'abonnement</strong> auprès du fournisseur de l'application (Administrateur EDUCO).
            </p>
          </div>

          {/* Pricing Plans Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Nos Formules d'Abonnement Disponibles
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Plan 1: Standard */}
              <div className="p-4 rounded-2xl border-2 border-slate-200 bg-white hover:border-[#1F4A59] transition-all space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-slate-700">Formule Standard</span>
                  <span className="text-xs font-black text-[#1F4A59]">10.000 FCFA <span className="text-[10px] font-normal text-slate-500">/ mois</span></span>
                </div>
                <ul className="text-[11px] text-slate-600 space-y-1 pt-1">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Toutes les fonctionnalités de gestion</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Bulletins, Caisse, Comptabilité, RH</span>
                  </li>
                  <li className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-3.5 h-3.5 flex items-center justify-center text-xs font-bold">✕</span>
                    <span>Sans Intelligence Artificielle</span>
                  </li>
                </ul>
              </div>

              {/* Plan 2: AI Premium */}
              <div className="p-4 rounded-2xl border-2 border-purple-400 bg-gradient-to-br from-purple-50/50 via-white to-indigo-50/40 space-y-2 relative shadow-xs">
                <span className="absolute -top-2.5 right-3 bg-purple-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">
                  Recommandé
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-purple-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    IA Premium
                  </span>
                  <span className="text-xs font-black text-purple-900">20.000 FCFA <span className="text-[10px] font-normal text-slate-500">/ mois</span></span>
                </div>
                <ul className="text-[11px] text-purple-950 space-y-1 pt-1 font-medium">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Toutes les fonctionnalités incluses</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span><strong>Assistants IA</strong> & Appréciations auto</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Analyses financières & prédictions IA</span>
                  </li>
                </ul>
              </div>

            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
            >
              Accéder au portail (Mode Inscription)
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenSubscriptionModal();
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#1F4A59] hover:bg-[#275d70] text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Zap className="w-4 h-4 text-emerald-400" />
              <span>Saisir ma Clé d'Abonnement</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>

        {/* Email Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-100 text-center text-[10px] text-slate-400">
          Ce message a été généré automatiquement par la plateforme EDUCO • Tous droits réservés.
        </div>

      </div>
    </div>
  );
};

export default WelcomeEmailModal;
