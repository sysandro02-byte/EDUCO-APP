import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Sparkles, 
  Key, 
  Clock, 
  Calendar, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  X, 
  Zap, 
  Lock, 
  ArrowRight,
  Bot,
  Layers,
  HelpCircle
} from 'lucide-react';
import { 
  activateSubscriptionCode, 
  requestSubscriptionRenewal, 
  SchoolSubscriptionInfo 
} from '../src/services/api';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionInfo: SchoolSubscriptionInfo | null;
  isLoading?: boolean;
  onSubscriptionUpdated: () => void;
  userRole?: string;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  subscriptionInfo,
  isLoading = false,
  onSubscriptionUpdated,
  userRole = 'Promoteur',
}) => {
  const [activationCode, setActivationCode] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationSuccess, setActivationSuccess] = useState<string | null>(null);

  // Renewal Request Form State
  const [isRequestingRenewal, setIsRequestingRenewal] = useState(false);
  const [requestedPlan, setRequestedPlan] = useState<'standard' | 'ai_premium'>('ai_premium');
  const [requestedMonths, setRequestedMonths] = useState<number>(3);
  const [renewalNotes, setRenewalNotes] = useState('');
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [renewalSuccess, setRenewalSuccess] = useState<string | null>(null);
  const [renewalError, setRenewalError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState(false);

  if (!isOpen) return null;

  const schoolId = subscriptionInfo?.schoolIdentifier || (isLoading ? 'Chargement…' : 'Indisponible');
  const isActive = subscriptionInfo?.isActive || false;
  const planType = subscriptionInfo?.planType;
  const daysRemaining = subscriptionInfo?.daysRemaining ?? 0;
  const isExpired = subscriptionInfo ? (subscriptionInfo.daysRemaining <= 0 && !subscriptionInfo.isPreSubscription) : false;
  const isPreSubscription = subscriptionInfo?.isPreSubscription ?? true;

  const handleCopyId = () => {
    if (!subscriptionInfo?.schoolIdentifier) return;
    navigator.clipboard.writeText(schoolId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 3000);
  };

  const handleActivateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activationCode.trim()) {
      setActivationError('Veuillez renseigner votre code d\'abonnement unique.');
      return;
    }

    setIsActivating(true);
    setActivationError(null);
    setActivationSuccess(null);

    try {
      const res = await activateSubscriptionCode(activationCode.trim());
      if (res.error) {
        setActivationError(res.error);
      } else {
        setActivationSuccess(res.message || 'Votre abonnement a été activé avec succès !');
        setActivationCode('');
        onSubscriptionUpdated();
      }
    } catch (err: any) {
      setActivationError(err.message || 'Erreur lors de l\'activation.');
    } finally {
      setIsActivating(false);
    }
  };

  const handleSendRenewalRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingRequest(true);
    setRenewalError(null);
    setRenewalSuccess(null);

    try {
      const res = await requestSubscriptionRenewal({
        requestedPlan,
        requestedMonths,
        notes: renewalNotes,
      });

      if (res.error) {
        setRenewalError(res.error);
      } else {
        setRenewalSuccess(`Votre demande de renouvellement (${requestedMonths} mois - ${requestedPlan === 'ai_premium' ? 'IA Premium' : 'Standard'}) a été transmise à l'administrateur.`);
        setTimeout(() => {
          setIsRequestingRenewal(false);
          setRenewalSuccess(null);
        }, 3500);
      }
    } catch (err: any) {
      setRenewalError(err.message || 'Erreur lors de la transmission.');
    } finally {
      setIsSendingRequest(false);
    }
  };

  const calculateTotalAmount = () => {
    const monthlyRate = requestedPlan === 'ai_premium' ? 20000 : 10000;
    return (monthlyRate * requestedMonths).toLocaleString('fr-FR');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="bg-[#1F4A59] text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-300">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">Gestion de l'Abonnement & Licence</h2>
              <p className="text-xs text-teal-100">
                Établissement: <strong className="text-white">{subscriptionInfo?.schoolName || 'Mon Établissement'}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Status Banner Card */}
          <div className={`p-5 rounded-2xl border ${
            isActive 
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50/50 border-emerald-200 text-emerald-950'
              : isExpired
              ? 'bg-gradient-to-br from-rose-50 to-orange-50/50 border-rose-200 text-rose-950'
              : 'bg-gradient-to-br from-amber-50 to-orange-50/50 border-amber-200 text-amber-950'
          }`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider ${
                    isActive 
                      ? 'bg-emerald-600 text-white'
                      : isExpired 
                      ? 'bg-rose-600 text-white' 
                      : 'bg-amber-600 text-white'
                  }`}>
                    {isActive ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {planType === 'ai_premium' ? 'Licence IA Premium Active' : 'Licence Standard Active'}
                      </>
                    ) : isExpired ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        Abonnement Expiré
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        Mode Découverte / Inscription Seule
                      </>
                    )}
                  </span>
                </div>
                
                {/* Days remaining highlight */}
                <div className="flex items-baseline gap-2 mt-2">
                  <Clock className="w-4 h-4 text-slate-500 shrink-0 self-center" />
                  <span className="text-sm font-semibold text-slate-700">Durée restante :</span>
                  <span className="text-xl sm:text-2xl font-black text-[#1F4A59]">
                    {isActive ? `${daysRemaining} jour(s)` : isExpired ? '0 jour (Expiré)' : '0 jour (Non activé)'}
                  </span>
                </div>

                {subscriptionInfo?.endDate && isActive && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Échéance prévue le : <strong>{new Date(subscriptionInfo.endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                  </p>
                )}
              </div>

              {/* School Identifier Badge */}
              <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-slate-200/80 shrink-0">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Identifiant Établissement</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-black text-slate-900 tracking-wider font-mono">{schoolId}</span>
                  <button 
                    onClick={handleCopyId}
                    title="Copier l'identifiant"
                    disabled={!subscriptionInfo?.schoolIdentifier}
                    className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copiedId ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Auto-renew note */}
            {subscriptionInfo?.autoRenew && (
              <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2 text-xs font-medium text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Renouvellement automatique configuré par l'administrateur.</span>
              </div>
            )}
          </div>

          {/* Code Activation Form */}
          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
              <Key className="w-4 h-4 text-[#1F4A59]" />
              <span>Activer un Code d'Abonnement Unique</span>
            </div>
            <p className="text-xs text-slate-500">
              Saisissez le code fourni par l'administrateur EDUCO suite à votre paiement pour déverrouiller ou prolonger votre licence.
            </p>

            {isLoading && (
              <div className="p-3 bg-sky-50 text-sky-800 text-xs rounded-xl border border-sky-200 flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-sky-500 border-t-transparent animate-spin shrink-0" />
                <span>Chargement des informations de votre établissement…</span>
              </div>
            )}

            {activationError && (
              <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{activationError}</span>
              </div>
            )}

            {activationSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{activationSuccess}</span>
              </div>
            )}

            <form onSubmit={handleActivateCode} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                placeholder="Ex: EDUCO-STD-2026-X8F9-Q2M1"
                value={activationCode}
                onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
              />
              <button
                type="submit"
                disabled={isLoading || isActivating || !activationCode.trim()}
                className="px-5 py-2.5 bg-[#1F4A59] hover:bg-[#275d70] disabled:bg-slate-300 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 active:scale-95"
              >
                {isActivating ? (
                  <span className="animate-pulse">Validation...</span>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>Activer la Licence</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Renewal Request Section */}
          <div className="p-5 bg-white rounded-2xl border-2 border-dashed border-teal-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Besoin d'un nouvel abonnement ou d'un renouvellement ?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Envoyez une demande instantanée avec votre identifiant d'école à l'administrateur EDUCO.
                </p>
              </div>
              {!isRequestingRenewal && (
                <button
                  type="button"
                  onClick={() => setIsRequestingRenewal(true)}
                  disabled={isLoading || !subscriptionInfo?.schoolIdentifier}
                  className="px-4 py-2 bg-teal-50 hover:bg-teal-100 text-[#1F4A59] border border-teal-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Demander un renouvellement</span>
                </button>
              )}
            </div>

            {/* Expanded Renewal Request Form */}
            {isRequestingRenewal && (
              <form onSubmit={handleSendRenewalRequest} className="space-y-4 pt-3 border-t border-slate-100 animate-fade-in">
                
                {renewalError && (
                  <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-xl border border-rose-200 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{renewalError}</span>
                  </div>
                )}

                {renewalSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-xl border border-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{renewalSuccess}</span>
                  </div>
                )}

                {/* Formula Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Choisissez votre Formule :
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label 
                      onClick={() => setRequestedPlan('standard')}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                        requestedPlan === 'standard' 
                          ? 'border-[#1F4A59] bg-teal-50/50 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="plan" 
                        checked={requestedPlan === 'standard'} 
                        onChange={() => setRequestedPlan('standard')}
                        className="mt-0.5 text-[#1F4A59]" 
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-800">Formule Standard</p>
                        <p className="text-[11px] font-black text-[#1F4A59] mt-0.5">10.000 FCFA / mois</p>
                        <p className="text-[10px] text-slate-500 mt-1">Gestion intégrale sans module IA.</p>
                      </div>
                    </label>

                    <label 
                      onClick={() => setRequestedPlan('ai_premium')}
                      className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-2.5 ${
                        requestedPlan === 'ai_premium' 
                          ? 'border-purple-600 bg-purple-50/50 shadow-xs' 
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="plan" 
                        checked={requestedPlan === 'ai_premium'} 
                        onChange={() => setRequestedPlan('ai_premium')}
                        className="mt-0.5 text-purple-600" 
                      />
                      <div>
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-bold text-purple-950">Formule IA Premium</p>
                          <Sparkles className="w-3 h-3 text-purple-600" />
                        </div>
                        <p className="text-[11px] font-black text-purple-900 mt-0.5">20.000 FCFA / mois</p>
                        <p className="text-[10px] text-purple-800 mt-1">Gestion complète + Intelligence Artificielle.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Duration in Months */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Durée souhaitée :
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 6, 12].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setRequestedMonths(m)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          requestedMonths === m
                            ? 'bg-[#1F4A59] text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {m} mois
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total estimation */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Montant total estimé :</span>
                  <span className="font-black text-base text-[#1F4A59]">{calculateTotalAmount()} FCFA</span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsRequestingRenewal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingRequest}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingRequest ? 'Envoi en cours...' : 'Envoyer la demande à l\'Admin'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[11px] text-slate-500">
            Rôle actuel : <strong className="text-slate-700">{userRole}</strong>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};

export default SubscriptionModal;
