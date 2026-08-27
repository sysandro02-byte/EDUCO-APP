import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Plus, 
  RefreshCw, 
  Copy, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Building2, 
  User, 
  Phone, 
  DollarSign, 
  Calendar, 
  Send, 
  Check, 
  ChevronRight, 
  ToggleLeft, 
  ToggleRight,
  Filter,
  Share2
} from 'lucide-react';
import { 
  fetchAdminSubscriptions, 
  adminGenerateSubscription, 
  adminExtendSubscription, 
  adminToggleAutoRenew, 
  adminFulfillRequest 
} from '../src/services/api';

interface AdminSubscriptionHubProps {
  onSelectSchool?: (school: any) => void;
}

const AdminSubscriptionHub: React.FC<AdminSubscriptionHubProps> = ({ onSelectSchool }) => {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'licenses' | 'generate' | 'requests'>('licenses');

  // Generator Form State
  const [schoolName, setSchoolName] = useState('');
  const [schoolIdentifier, setSchoolIdentifier] = useState('');
  const [promoterName, setPromoterName] = useState('');
  const [promoterContact, setPromoterContact] = useState('');
  const [planType, setPlanType] = useState<'standard' | 'ai_premium'>('standard');
  const [months, setMonths] = useState(1);
  const [amountPaid, setAmountPaid] = useState(10000);
  const [autoRenew, setAutoRenew] = useState(false);
  const [autoRenewFrequency, setAutoRenewFrequency] = useState<'monthly' | 'before_expiry'>('before_expiry');
  const [generating, setGenerating] = useState(false);
  const [generatedCodeResult, setGeneratedCodeResult] = useState<any | null>(null);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'standard' | 'ai_premium'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSubscriptions();
      setSubscriptions(data.subscriptions || []);
      setRequests(data.requests || []);
      setSchools(data.schools || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update amount automatically when plan or months change
  useEffect(() => {
    const rate = planType === 'ai_premium' ? 20000 : 10000;
    setAmountPaid(rate * months);
  }, [planType, months]);

  const handleSelectExistingSchool = (sch: any) => {
    setSchoolName(sch.name);
    setSchoolIdentifier(sch.identifier || `EDUCO-SCH-${sch.id}`);
    setPromoterName(sch.promoterName || '');
    setPromoterContact(sch.promoterContact || sch.email || sch.phone || '');
  };

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolIdentifier.trim() || !schools.some(s => String(s.identifier).toUpperCase() === schoolIdentifier.trim().toUpperCase())) {
      alert('Veuillez sélectionner un établissement enregistré. Une licence ne peut pas être créée sans établissement destinataire.');
      return;
    }

    setGenerating(true);
    try {
      const res = await adminGenerateSubscription({
        schoolName,
        schoolIdentifier,
        promoterName,
        promoterContact,
        planType,
        months,
        amountPaid,
        autoRenew,
        autoRenewFrequency,
      });

      if (res.error) {
        alert(res.error);
      } else {
        setGeneratedCodeResult(res.subscription);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleExtend = async (subId: number, addMonths: number) => {
    try {
      const res = await adminExtendSubscription(subId, addMonths);
      if (res.error) alert(res.error);
      else loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAutoRenew = async (subId: number, current: boolean, freq: string) => {
    try {
      const res = await adminToggleAutoRenew(subId, !current, freq);
      if (res.error) alert(res.error);
      else loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleFulfillRequest = async (reqId: number) => {
    try {
      const res = await adminFulfillRequest(reqId, true, 'before_expiry');
      if (res.error) alert(res.error);
      else {
        alert(`Demande validée ! Code généré : ${res.subscription.code}`);
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 3000);
  };

  const filteredSubs = subscriptions.filter((s) => {
    const matchesSearch = 
      s.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.schoolIdentifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.promoterName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPlan = planFilter === 'all' || s.planType === planFilter;
    return matchesSearch && matchesPlan;
  });

  const totalRevenue = subscriptions.reduce((acc, s) => acc + (s.amountPaid || 0), 0);
  const activeCount = subscriptions.filter(s => new Date(s.endDate).getTime() > Date.now() && s.status === 'active').length;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner & Stats */}
      <div className="bg-[#1F4A59] text-white p-4 sm:p-5 rounded-2xl shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase rounded-full border border-emerald-400/30">
                Centre de Contrôle Administrateur
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight">
              Gestion des Abonnements & Licences Écoles
            </h1>
            <p className="text-xs text-teal-100 mt-0.5 max-w-2xl">
              Génération de clés uniques d'activation, gestion des renouvellements mensuels, suivi des paiements.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setGeneratedCodeResult(null);
                setActiveTab('generate');
              }}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Générer un Code</span>
            </button>
            <button
              onClick={loadData}
              className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="bg-white/5 p-3 rounded-xl backdrop-blur-xs">
            <p className="text-teal-200 text-[10px] font-semibold uppercase">Licences Actives</p>
            <p className="text-xl font-black text-white mt-0.5">{activeCount}</p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl backdrop-blur-xs">
            <p className="text-teal-200 text-[10px] font-semibold uppercase">Total Licences Émises</p>
            <p className="text-xl font-black text-white mt-0.5">{subscriptions.length}</p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl backdrop-blur-xs">
            <p className="text-teal-200 text-[10px] font-semibold uppercase">Demandes en Attente</p>
            <p className="text-xl font-black text-amber-300 mt-0.5">
              {requests.filter(r => r.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white/5 p-3 rounded-xl backdrop-blur-xs">
            <p className="text-teal-200 text-[10px] font-semibold uppercase">Volume Encaissé</p>
            <p className="text-xl font-black text-emerald-300 mt-0.5">{totalRevenue.toLocaleString('fr-FR')} F</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('licenses')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'licenses'
              ? 'bg-[#1F4A59] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Licences Émises ({subscriptions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('generate')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'generate'
              ? 'bg-[#1F4A59] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Key className="w-4 h-4 text-emerald-400" />
          <span>Générateur de Clé d'Abonnement</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 relative ${
            activeTab === 'requests'
              ? 'bg-[#1F4A59] text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Demandes Reçues ({requests.filter(r => r.status === 'pending').length})</span>
          {requests.filter(r => r.status === 'pending').length > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
          )}
        </button>
      </div>

      {/* TAB 1: GENERATE SUBSCRIPTION CODE */}
      {activeTab === 'generate' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 animate-fade-in max-w-3xl mx-auto">
          
          <div>
            <h2 className="text-lg font-black text-slate-900">Générer un Code d'Abonnement Unique</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Renseignez les informations de l'établissement, du promoteur, le montant encaissé et la durée pour générer la clé.
            </p>
          </div>

          {/* Result Alert if just generated */}
          {generatedCodeResult && (
            <div className="p-5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-2 border-emerald-500/30 rounded-2xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Code Unique Généré avec Succès !
                </span>
                <button
                  onClick={() => handleCopy(generatedCodeResult.code)}
                  className="px-3 py-1 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5"
                >
                  {copiedCode === generatedCodeResult.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copié</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier le Code</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Clé d'activation unique</p>
                  <p className="text-lg sm:text-xl font-black font-mono tracking-wider text-[#1F4A59] mt-0.5">
                    {generatedCodeResult.code}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <p className="text-slate-500">École : <strong>{generatedCodeResult.schoolName}</strong></p>
                  <p className="text-slate-500">Durée : <strong>{generatedCodeResult.months} mois ({generatedCodeResult.amountPaid?.toLocaleString()} FCFA)</strong></p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleGenerateCode} className="space-y-5">
            
            {/* Quick Pick Existing School */}
            {schools.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Sélection rapide d'une école enregistrée :
                </label>
                <div className="flex flex-wrap gap-2">
                  {schools.map((sch) => (
                    <button
                      key={sch.id}
                      type="button"
                      onClick={() => handleSelectExistingSchool(sch)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                        schoolName === sch.name 
                          ? 'bg-[#1F4A59] text-white border-[#1F4A59]' 
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                      }`}
                    >
                      {sch.name} ({sch.identifier || `SCH-${sch.id}`})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* School & Promoter details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom de l'Établissement <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Complexe Scolaire Saint Joseph"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Identifiant Établissement <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  readOnly
                  placeholder="Sélectionnez une école ci-dessus"
                  value={schoolIdentifier}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-mono font-bold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom du Promoteur / Responsable <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: M. Jean-Marc Koffi"
                  value={promoterName}
                  onChange={(e) => setPromoterName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Contact / E-mail du Promoteur
                </label>
                <input
                  type="text"
                  placeholder="Ex: +225 07 00 00 00 / promoteur@email.com"
                  value={promoterContact}
                  onChange={(e) => setPromoterContact(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                />
              </div>
            </div>

            {/* Plan selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Type de Formule d'Abonnement :
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setPlanType('standard')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    planType === 'standard'
                      ? 'border-[#1F4A59] bg-teal-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="adminPlan"
                    checked={planType === 'standard'}
                    onChange={() => setPlanType('standard')}
                    className="mt-0.5 text-[#1F4A59]"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">Formule Standard (Sans IA)</p>
                    <p className="text-xs font-black text-[#1F4A59] mt-0.5">10.000 FCFA / mois</p>
                    <p className="text-[10px] text-slate-500 mt-1">Inscriptions, Bulletins, Caisse, Comptabilité, RH.</p>
                  </div>
                </label>

                <label
                  onClick={() => setPlanType('ai_premium')}
                  className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                    planType === 'ai_premium'
                      ? 'border-purple-600 bg-purple-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="adminPlan"
                    checked={planType === 'ai_premium'}
                    onChange={() => setPlanType('ai_premium')}
                    className="mt-0.5 text-purple-600"
                  />
                  <div>
                    <p className="text-xs font-bold text-purple-950 flex items-center gap-1">
                      <span>Formule IA Premium</span>
                      <Sparkles className="w-3 h-3 text-purple-600" />
                    </p>
                    <p className="text-xs font-black text-purple-900 mt-0.5">20.000 FCFA / mois</p>
                    <p className="text-[10px] text-purple-800 mt-1">Toutes fonctionnalités + Assistant IA & analyses.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Duration Selector & Amount Paid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Durée de l'Abonnement (Mois) :
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 6, 12].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths(m)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                        months === m
                          ? 'bg-[#1F4A59] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {m} m
                    </button>
                  ))}
                  <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setMonths(Math.max(1, months - 1))}
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 text-xs font-bold"
                    >
                      -
                    </button>
                    <span className="px-2 text-xs font-bold text-slate-800">{months}</span>
                    <button
                      type="button"
                      onClick={() => setMonths(months + 1)}
                      className="px-2.5 py-1 text-slate-600 hover:bg-slate-100 text-xs font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Montant Encaissé (FCFA) :
                </label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-[#1F4A59] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                />
              </div>
            </div>

            {/* Auto-Renewal Options (Checkbox requirement from user) */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <p className="text-xs font-bold text-slate-800">Options de Renouvellement Automatique :</p>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRenew}
                    onChange={(e) => setAutoRenew(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1F4A59]"
                  />
                  <span className="font-semibold">Activer le renouvellement automatique pour cet établissement</span>
                </label>

                {autoRenew && (
                  <div className="pl-6 pt-1 flex flex-col sm:flex-row gap-3">
                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="renewFreq"
                        checked={autoRenewFrequency === 'before_expiry'}
                        onChange={() => setAutoRenewFrequency('before_expiry')}
                      />
                      <span>Renouvellement automatique avant la date d'échéance</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="radio"
                        name="renewFreq"
                        checked={autoRenewFrequency === 'monthly'}
                        onChange={() => setAutoRenewFrequency('monthly')}
                      />
                      <span>Renouvellement automatique chaque mois</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={generating}
                className="px-6 py-3 bg-[#1F4A59] hover:bg-[#275d70] text-white text-xs font-black rounded-2xl shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                <Key className="w-4 h-4 text-emerald-400" />
                <span>{generating ? 'Génération en cours...' : 'Générer la Clé d\'Abonnement Unique'}</span>
              </button>
            </div>

          </form>
        </div>
      )}

      {/* TAB 2: LICENSES LIST */}
      {activeTab === 'licenses' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-4 sm:p-6 animate-fade-in">
          
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Rechercher par école, code, promoteur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setPlanFilter('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  planFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous
              </button>
              <button
                onClick={() => setPlanFilter('standard')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  planFilter === 'standard' ? 'bg-[#1F4A59] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Standard (10k)
              </button>
              <button
                onClick={() => setPlanFilter('ai_premium')}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors ${
                  planFilter === 'ai_premium' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                IA Premium (20k)
              </button>
            </div>
          </div>

          {/* Licenses Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-y border-slate-200">
                <tr>
                  <th className="px-4 py-3">Code Unique</th>
                  <th className="px-4 py-3">Établissement & Promoteur</th>
                  <th className="px-4 py-3">Formule</th>
                  <th className="px-4 py-3">Montant / Durée</th>
                  <th className="px-4 py-3">Échéance & Reste</th>
                  <th className="px-4 py-3">Auto-Renouv.</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      Aucune licence trouvée. Cliquez sur "Générer un Nouveau Code" pour en créer une.
                    </td>
                  </tr>
                ) : (
                  filteredSubs.map((sub) => {
                    const endDate = new Date(sub.endDate);
                    const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    const isExp = daysLeft <= 0;

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                        
                        {/* Code Unique with copy */}
                        <td className="px-4 py-3 font-mono font-bold text-[#1F4A59]">
                          <div className="flex items-center gap-1.5">
                            <span>{sub.code}</span>
                            <button
                              onClick={() => handleCopy(sub.code)}
                              title="Copier le code"
                              className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700"
                            >
                              {copiedCode === sub.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>

                        {/* School & Promoter */}
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">{sub.schoolName}</p>
                          <p className="text-[11px] text-slate-500">
                            {sub.promoterName} {sub.promoterContact ? `• ${sub.promoterContact}` : ''}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400">{sub.schoolIdentifier}</span>
                        </td>

                        {/* Plan */}
                        <td className="px-4 py-3">
                          {sub.planType === 'ai_premium' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                              <Sparkles className="w-3 h-3" />
                              IA Premium
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-[#1F4A59]">
                              Standard
                            </span>
                          )}
                        </td>

                        {/* Amount & Duration */}
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-900">{sub.amountPaid?.toLocaleString()} FCFA</p>
                          <p className="text-[10px] text-slate-500">{sub.months} mois</p>
                        </td>

                        {/* Expiry & Days Remaining */}
                        <td className="px-4 py-3">
                          <p className="text-slate-800 font-semibold">{endDate.toLocaleDateString('fr-FR')}</p>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mt-0.5 ${
                            isExp ? 'bg-rose-100 text-rose-700' : daysLeft <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isExp ? 'Expiré' : `${daysLeft} j restants`}
                          </span>
                        </td>

                        {/* Auto-renewal toggle */}
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleAutoRenew(sub.id, sub.autoRenew, sub.autoRenewFrequency)}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 hover:text-slate-900"
                          >
                            {sub.autoRenew ? (
                              <ToggleRight className="w-5 h-5 text-emerald-600" />
                            ) : (
                              <ToggleLeft className="w-5 h-5 text-slate-400" />
                            )}
                            <span>{sub.autoRenew ? 'Activé' : 'Désactivé'}</span>
                          </button>
                        </td>

                        {/* Actions (Extend +1m, +2m, +3m) */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleExtend(sub.id, 1)}
                              title="Prolonger de 1 mois"
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px]"
                            >
                              +1m
                            </button>
                            <button
                              onClick={() => handleExtend(sub.id, 2)}
                              title="Prolonger de 2 mois"
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px]"
                            >
                              +2m
                            </button>
                            <button
                              onClick={() => handleExtend(sub.id, 3)}
                              title="Prolonger de 3 mois"
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px]"
                            >
                              +3m
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* TAB 3: INCOMING RENEWAL REQUESTS FROM SCHOOLS */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 animate-fade-in">
          <div>
            <h2 className="text-base font-bold text-slate-900">Demandes de Renouvellement Transmises par les Écoles</h2>
            <p className="text-xs text-slate-500">
              Traitez les demandes de licences envoyées depuis les portails Promoteur, RAF, DG ou Caissière.
            </p>
          </div>

          <div className="space-y-3">
            {requests.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                Aucune demande de renouvellement en attente.
              </div>
            ) : (
              requests.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                    req.status === 'processed' 
                      ? 'bg-slate-50 border-slate-200 opacity-70' 
                      : 'bg-amber-50/50 border-amber-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-900">{req.schoolName}</span>
                      <span className="font-mono text-xs font-bold text-[#1F4A59] bg-white px-2 py-0.5 rounded border border-slate-200">
                        {req.schoolIdentifier}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        req.status === 'processed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {req.status === 'processed' ? 'Traité' : 'En attente'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">
                      Promoteur : <strong>{req.promoterName}</strong> {req.promoterContact ? `(${req.promoterContact})` : ''}
                    </p>
                    <p className="text-xs text-slate-700 mt-1">
                      Formule demandée : <strong>{req.requestedPlan === 'ai_premium' ? 'IA Premium (20.000 FCFA/m)' : 'Standard (10.000 FCFA/m)'}</strong> • Durée : <strong>{req.requestedMonths} mois</strong>
                    </p>
                  </div>

                  {req.status !== 'processed' && (
                    <button
                      onClick={() => handleFulfillRequest(req.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95 shrink-0"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Valider & Générer Clé</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminSubscriptionHub;
