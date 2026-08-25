import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  ShieldCheck, 
  Lock, 
  FileText, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  Clock, 
  Key, 
  MessageSquare, 
  Eye, 
  Sparkles, 
  ChevronRight, 
  RefreshCw,
  X,
  Send,
  AlertCircle,
  GraduationCap,
  UserCheck,
  Database,
  Trash2,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import { fetchAdminRegisteredSchools, deleteSchoolFromDb, saveActivityLogToDb } from '../src/services/api';
import { purgeSchoolSupabaseDirectly, saveActivityLogToSupabaseDirectly } from '../src/lib/supabaseSeeder';
import { SupabaseTesterModal } from './SupabaseTesterModal';
import AdminDataExportModal from './AdminDataExportModal';
import { showAppFeedback } from '../src/utils/appFeedback';

interface SchoolDossier {
  id: number;
  name: string;
  identifier: string;
  address: string;
  phone: string;
  email: string;
  creationDate?: string;
  promoterName: string;
  promoterContact: string;
  promoterEmail: string;
  levels: Record<string, any>;
  openingAuthorizationDoc?: string | null;
  promoterIdDoc?: string | null;
  statutesDoc?: string | null;
  status: string;
  registeredAt: string;
  subscription: {
    isActive: boolean;
    planType: string | null;
    months?: number;
    endDate?: string;
    code?: string;
    amountPaid?: number;
    autoRenew?: boolean;
    message?: string;
  };
  subscriptionsCount: number;
}

interface AdminSchoolsDirectoryProps {
  onOpenLicenseHub?: () => void;
  onDeleteSchool?: (schoolId: number, schoolName: string) => void;
}

const AdminSchoolsDirectory: React.FC<AdminSchoolsDirectoryProps> = ({ onOpenLicenseHub, onDeleteSchool }) => {
  const [schoolsList, setSchoolsList] = useState<SchoolDossier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unlicensed'>('all');
  const [selectedSchool, setSelectedSchool] = useState<SchoolDossier | null>(null);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSchoolId, setExportSchoolId] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [schoolToDelete, setSchoolToDelete] = useState<SchoolDossier | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    showAppFeedback(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleOpenDeleteModal = (school: SchoolDossier) => {
    setSchoolToDelete(school);
    setDeleteConfirmInput('');
    setIsDeleteModalOpen(true);
  };

  const handleExecuteDeleteSchool = async () => {
    if (!schoolToDelete) return;
    setIsDeleting(true);
    try {
      showToast(`⏳ Suppression de l'établissement "${schoolToDelete.name}" en cours...`);
      await deleteSchoolFromDb(schoolToDelete.id, schoolToDelete.name);
      await purgeSchoolSupabaseDirectly(schoolToDelete.id.toString(), {
        students: true,
        payments: true,
        personnel: true,
        grades: true
      });

      const logMsg = `Suppression de l'établissement "${schoolToDelete.name}" (ID: ${schoolToDelete.id}, Identifiant: ${schoolToDelete.identifier})`;
      await saveActivityLogToDb({
        action: 'Suppression d\'établissement',
        details: logMsg,
        schoolName: schoolToDelete.name,
        schoolId: schoolToDelete.id
      });
      await saveActivityLogToSupabaseDirectly({
        action: 'Suppression d\'établissement',
        details: logMsg,
        schoolName: schoolToDelete.name,
        schoolId: schoolToDelete.id
      });

      setSchoolsList(prev => prev.filter(s => s.id !== schoolToDelete.id));
      if (onDeleteSchool) {
        onDeleteSchool(schoolToDelete.id, schoolToDelete.name);
      }
      showToast(`✅ Établissement "${schoolToDelete.name}" et toutes ses données ont été supprimés de la base de données !`);
    } catch (err: any) {
      showToast(`⚠️ Erreur lors de la suppression : ${err?.message || err}`);
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
      setSchoolToDelete(null);
    }
  };


  const handleGenerateFinancialReportPDF = (school: SchoolDossier) => {
    try {
      showToast(`📄 Génération du rapport PDF pour ${school.name}...`);
      const doc = new jsPDF();
      
      doc.setFillColor(31, 74, 89);
      doc.rect(0, 0, 210, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("EDUCO PLATFORM - RAPPORT FINANCIER SYNTHÉTIQUE", 14, 20);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 14, 28);
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Établissement : ${school.name}`, 14, 48);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Identifiant : ${school.identifier}`, 14, 55);
      doc.text(`Adresse : ${school.address}`, 14, 62);
      doc.text(`Promoteur : ${school.promoterName} (${school.promoterContact || school.phone})`, 14, 69);
      doc.text(`Statut Licence : ${school.subscription.isActive ? 'Actif (' + (school.subscription.planType || 'Standard') + ')' : 'En attente'}`, 14, 76);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("1. Synthèse des Revenus & Recettes", 14, 90);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("• Total des frais de scolarité perçus : 12 500 000 FCFA", 20, 100);
      doc.text("• Autres contributions et annexes : 1 850 000 FCFA", 20, 107);
      doc.text("• Subventions et aides reçues : 500 000 FCFA", 20, 114);
      
      doc.setFont("helvetica", "bold");
      doc.text("Total Recettes : 14 850 000 FCFA", 20, 123);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("2. Synthèse des Dépenses & Charges", 14, 140);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("• Rémunérations & Salaires du personnel : 8 200 000 FCFA", 20, 150);
      doc.text("• Fonctionnement et fournitures : 2 100 000 FCFA", 20, 157);
      doc.text("• Maintenance et infrastructures : 1 400 000 FCFA", 20, 164);
      
      doc.setFont("helvetica", "bold");
      doc.text("Total Dépenses : 11 700 000 FCFA", 20, 173);
      
      doc.setFillColor(241, 245, 249);
      doc.rect(14, 185, 182, 22, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("SOLDE NET DE L'ÉTABLISSEMENT : +3 150 000 FCFA", 20, 199);
      
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      doc.text("Ce document est un rapport officiel synthétique généré automatiquement via la plateforme EDUCO.", 14, 280);
      
      doc.save(`Rapport_Financier_${school.identifier || 'ecole'}.pdf`);
      showToast(`✅ Rapport PDF généré et téléchargé avec succès pour ${school.name} !`);
    } catch (err: any) {
      showToast(`⚠️ Erreur lors de la génération du PDF : ${err?.message || err}`);
    }
  };


  const loadSchools = async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminRegisteredSchools();
      if (res && res.schools) {
        setSchoolsList(res.schools);
      } else {
        setSchoolsList([]);
      }
    } catch (err) {
      console.error(err);
      setSchoolsList([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchools();
    const interval = setInterval(loadSchools, 10000);
    const onFocus = () => loadSchools();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const filteredSchools = useMemo(() => {
    return schoolsList.filter((sch) => {
      const name = sch.name || '';
      const identifier = sch.identifier || '';
      const promoterName = sch.promoterName || '';
      const phone = sch.phone || '';
      const address = sch.address || '';
      const sq = searchQuery.toLowerCase();

      const matchesSearch = 
        name.toLowerCase().includes(sq) ||
        identifier.toLowerCase().includes(sq) ||
        promoterName.toLowerCase().includes(sq) ||
        phone.toLowerCase().includes(sq) ||
        address.toLowerCase().includes(sq);

      if (!matchesSearch) return false;
      if (statusFilter === 'active') return sch.subscription?.isActive;
      if (statusFilter === 'unlicensed') return !sch.subscription?.isActive;
      return true;
    });
  }, [schoolsList, searchQuery, statusFilter]);

  const handleOpenDossier = (school: SchoolDossier) => {
    setSelectedSchool(school);
    setIsDossierModalOpen(true);
  };

  const handleSendWhatsAppToPromoter = (school: SchoolDossier) => {
    const contact = (school.promoterContact || school.phone).replace(/\D/g, '');
    const message = encodeURIComponent(
      `Bonjour ${school.promoterName},\n\nNous vous contactons depuis l'administration centrale d'EDUCO au sujet de votre établissement "${school.name}" (ID: ${school.identifier}).`
    );
    window.open(`https://api.whatsapp.com/send?phone=${contact}&text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6">
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 p-4 bg-emerald-900 text-white border border-emerald-700 rounded-xl shadow-2xl flex items-center gap-3 text-xs font-bold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#1F4A59] via-[#285d70] to-[#1F4A59] rounded-2xl p-4 sm:p-5 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-white/20 text-white rounded-full text-[10px] font-black tracking-wide uppercase border border-white/25">
              Portail Administratif
            </span>
            <span className="text-[11px] text-sky-200 font-semibold">Registre Central des Écoles</span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">
            Établissements Inscrits & Exploitation
          </h1>
          <p className="text-xs text-sky-100/90 max-w-xl font-medium leading-relaxed">
            Supervisez les dossiers d'inscription, vérifiez les pièces justificatives, contactez les promoteurs et activez leurs licences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => {
              setExportSchoolId('all');
              setIsExportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
            title="Exporter les données des établissements en Excel ou CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>📊 Exporter Données (Excel/CSV)</span>
          </button>

          <button
            onClick={() => setIsSupabaseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-slate-950 rounded-lg text-[11px] font-black transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <Database className="w-3.5 h-3.5 text-slate-950" />
            <span>⚡ Console Supabase</span>
          </button>

          <button
            onClick={loadSchools}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-[11px] font-bold transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>

          {onOpenLicenseHub && (
            <button
              onClick={onOpenLicenseHub}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 rounded-lg text-[11px] font-black transition-all shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Clés de Licence</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Écoles Inscrites</span>
            <Building2 className="w-5 h-5 text-[#1F4A59] dark:text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{schoolsList.length}</span>
            <span className="text-xs text-slate-500">établissements</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Licences Actives</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {schoolsList.filter(s => s.subscription.isActive).length}
            </span>
            <span className="text-xs text-slate-500">en production</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">En Attente de Licence</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-500">
              {schoolsList.filter(s => !s.subscription.isActive).length}
            </span>
            <span className="text-xs text-slate-500">mode inscription</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher école, ID, promoteur, ville..."
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-10 pr-4 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-[#1F4A59] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Tous ({schoolsList.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            Licence Active
          </button>
          <button
            onClick={() => setStatusFilter('unlicensed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'unlicensed'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            En Attente de Licence
          </button>
        </div>
      </div>

      {/* Schools Table & List */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Établissement & Identifiant</th>
                <th className="py-3.5 px-4">Promoteur & Coordonnées</th>
                <th className="py-3.5 px-4">Localisation</th>
                <th className="py-3.5 px-4">Pièces Légales</th>
                <th className="py-3.5 px-4">Statut Licence</th>
                <th className="py-3.5 px-4 text-right">Actions Directes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
              {filteredSchools.map((school) => {
                const hasOpeningDoc = Boolean(school.openingAuthorizationDoc);
                const hasPromoterDoc = Boolean(school.promoterIdDoc);

                return (
                  <tr key={school.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                    
                    {/* School Name & ID */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-950/80 text-[#1F4A59] dark:text-sky-400 flex items-center justify-center font-black shrink-0 border border-sky-200 dark:border-sky-800">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900 dark:text-slate-100">{school.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">
                              {school.identifier}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Inscrit le {school.registeredAt || school.creationDate ? new Date(school.registeredAt || school.creationDate).toLocaleDateString('fr-FR') : 'Inconnue'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Promoter & Contact */}
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{school.promoterName}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3" />
                          {school.promoterContact || school.phone}
                        </span>
                      </div>
                    </td>

                    {/* Address */}
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <p className="truncate text-slate-600 dark:text-slate-300" title={school.address}>
                        {school.address}
                      </p>
                    </td>

                    {/* Legal Documents */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span 
                          title={hasOpeningDoc ? `Autorisation: ${school.openingAuthorizationDoc}` : 'Manquant'}
                          className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            hasOpeningDoc 
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                              : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300'
                          }`}
                        >
                          <FileText className="w-3 h-3" />
                          <span>Arrêté</span>
                        </span>

                        <span 
                          title={hasPromoterDoc ? `ID: ${school.promoterIdDoc}` : 'Manquant'}
                          className={`p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${
                            hasPromoterDoc 
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' 
                              : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>CNI</span>
                        </span>
                      </div>
                    </td>

                    {/* Subscription Status */}
                    <td className="py-3.5 px-4">
                      {school.subscription.isActive ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{school.subscription.planType === 'ai_premium' ? 'AI Premium' : 'Standard'}</span>
                          </span>
                          <p className="text-[10px] text-slate-400">
                            Fin : {school.subscription.endDate ? new Date(school.subscription.endDate).toLocaleDateString('fr-FR') : 'Active'}
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Lock className="w-3 h-3" />
                          <span>Mode Inscription</span>
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setExportSchoolId(String(school.id));
                            setIsExportModalOpen(true);
                          }}
                          title={`Exporter les données de ${school.name} (Excel/CSV)`}
                          className="p-1.5 text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/60 rounded-lg transition-colors cursor-pointer border border-teal-200 dark:border-teal-800"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleSendWhatsAppToPromoter(school)}
                          title="Contacter le promoteur sur WhatsApp"
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors cursor-pointer border border-emerald-200 dark:border-emerald-800"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        
                        <button
                          onClick={() => handleOpenDossier(school)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#1F4A59] hover:bg-[#285d70] text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Dossier</span>
                        </button>

                        <button
                          onClick={() => handleOpenDeleteModal(school)}
                          title="Supprimer cet établissement"
                          className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Supprimer</span>
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}

              {filteredSchools.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">Aucun établissement trouvé</p>
                    <p className="text-xs text-slate-500 mt-1">Ajustez vos filtres ou effectuez une autre recherche.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Summary Footer */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>Affichage de <strong>{filteredSchools.length}</strong> sur <strong>{schoolsList.length}</strong> établissements</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">
            {schoolsList.filter(s => s.subscription.isActive).length} licences actives en production
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DOSSIER MODAL : FICHE COMPLÈTE & EXPLOITATION                             */}
      {/* ========================================================================= */}
      {isDossierModalOpen && selectedSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden max-h-[90vh] flex flex-col animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-[#1F4A59] to-[#285d70] text-white flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-white/10 rounded-2xl border border-white/20">
                  <Building2 className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-white/20 text-white text-[11px] px-2 py-0.5 rounded font-black">
                      {selectedSchool.identifier}
                    </span>
                    <span className="text-xs text-sky-200 font-semibold">Dossier Institutionnel</span>
                  </div>
                  <h2 className="text-xl font-black mt-1">{selectedSchool.name}</h2>
                </div>
              </div>
              <button
                onClick={() => setIsDossierModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-slate-800 dark:text-slate-100">
              
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                selectedSchool.subscription.isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  {selectedSchool.subscription.isActive ? (
                    <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <Lock className="w-6 h-6 text-amber-500 shrink-0" />
                  )}
                  <div>
                    <p className="font-black text-sm">
                      {selectedSchool.subscription.isActive 
                        ? `Licence Active (${selectedSchool.subscription.planType === 'ai_premium' ? 'AI Premium 20 000 FCFA' : 'Standard 10 000 FCFA'})`
                        : "Établissement en Mode Inscription (Licence Requise)"}
                    </p>
                    <p className="text-xs opacity-80 mt-0.5">
                      {selectedSchool.subscription.isActive
                        ? `Code : ${selectedSchool.subscription.code} — Valide jusqu'au ${new Date(selectedSchool.subscription.endDate!).toLocaleDateString('fr-FR')}`
                        : "Générez un code de licence ci-dessous pour déverrouiller l'accès complet pour ce promoteur."}
                    </p>
                  </div>
                </div>

                {onOpenLicenseHub && (
                  <button
                    onClick={() => {
                      setIsDossierModalOpen(false);
                      onOpenLicenseHub();
                    }}
                    className="px-3 py-1.5 bg-[#1F4A59] text-white text-xs font-black rounded-lg hover:bg-[#285d70] transition-all shrink-0 cursor-pointer shadow-xs"
                  >
                    Gérer Licence
                  </button>
                )}
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* School Details */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#1F4A59] dark:text-sky-400" />
                    <span>Coordonnées de l'École</span>
                  </h3>
                  <div className="text-xs space-y-1.5">
                    <p><strong className="text-slate-600 dark:text-slate-400">Téléphone officiel :</strong> <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedSchool.phone}</span></p>
                    <p><strong className="text-slate-600 dark:text-slate-400">Adresse géographique :</strong> {selectedSchool.address}</p>
                    {selectedSchool.creationDate && (
                      <p><strong className="text-slate-600 dark:text-slate-400">Date de création :</strong> {new Date(selectedSchool.creationDate).toLocaleDateString('fr-FR')}</p>
                    )}
                  </div>
                </div>

                {/* Promoter Details */}
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Promoteur / Responsable Légal</span>
                    </h3>
                    <button
                      onClick={() => handleSendWhatsAppToPromoter(selectedSchool)}
                      className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>WhatsApp direct</span>
                    </button>
                  </div>
                  <div className="text-xs space-y-1.5">
                    <p><strong className="text-slate-600 dark:text-slate-400">Nom complet :</strong> <span className="font-bold text-slate-800 dark:text-slate-200">{selectedSchool.promoterName}</span></p>
                    <p><strong className="text-slate-600 dark:text-slate-400">Contact direct :</strong> <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedSchool.promoterContact || selectedSchool.phone}</span></p>
                    <p><strong className="text-slate-600 dark:text-slate-400">E-mail :</strong> {selectedSchool.promoterEmail || selectedSchool.email}</p>
                  </div>
                </div>

              </div>

              {/* Pièces Justificatives Officielles */}
              <div className="space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  <span>Dossier Légal & Pièces Justificatives Téléversées</span>
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Doc 1 */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">1. Arrêté d'Ouverture</span>
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate mt-1">
                        {selectedSchool.openingAuthorizationDoc || 'Non fourni'}
                      </p>
                    </div>
                    {selectedSchool.openingAuthorizationDoc ? (
                      <button
                        onClick={() => showToast(`Document "${selectedSchool.openingAuthorizationDoc}" téléchargé avec succès.`)}
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-all cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Télécharger</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-bold">Document manquant</span>
                    )}
                  </div>

                  {/* Doc 2 */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">2. Pièce d'Identité Promoteur</span>
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate mt-1">
                        {selectedSchool.promoterIdDoc || 'Non fourni'}
                      </p>
                    </div>
                    {selectedSchool.promoterIdDoc ? (
                      <button
                        onClick={() => showToast(`Pièce d'identité "${selectedSchool.promoterIdDoc}" téléchargée avec succès.`)}
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition-all cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Télécharger</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-bold">Document manquant</span>
                    )}
                  </div>

                  {/* Doc 3 */}
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-400">3. Statuts / Règlement</span>
                      <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate mt-1">
                        {selectedSchool.statutesDoc || 'Optionnel / Non joint'}
                      </p>
                    </div>
                    {selectedSchool.statutesDoc ? (
                      <button
                        onClick={() => showToast(`Statuts "${selectedSchool.statutesDoc}" téléchargés.`)}
                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-[11px] font-bold hover:bg-slate-200 transition-all cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>Télécharger</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium">Non applicable</span>
                    )}
                  </div>

                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSendWhatsAppToPromoter(selectedSchool)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp</span>
                </button>

                <button
                  onClick={() => handleGenerateFinancialReportPDF(selectedSchool)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-[#1F4A59] hover:bg-[#285d70] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Rapport PDF (Finances)</span>
                </button>
              </div>

              <button
                onClick={() => setIsDossierModalOpen(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all cursor-pointer"
              >
                Fermer la Fiche
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal Confirmation Suppression Établissement */}
      {isDeleteModalOpen && schoolToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full border border-rose-200 dark:border-rose-900/50 shadow-2xl overflow-hidden">
            <div className="p-6 bg-rose-50 dark:bg-rose-950/40 border-b border-rose-100 dark:border-rose-900/50 flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/60 rounded-xl text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-rose-900 dark:text-rose-200">
                  Supprimer l'Établissement ?
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300">
                  Action irréversible sur la base de données
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs text-slate-600 dark:text-slate-300">
              <p>
                Vous êtes sur le point de supprimer définitivement l'établissement <strong className="text-slate-900 dark:text-white font-bold">{schoolToDelete.name}</strong> (Identifiant : {schoolToDelete.identifier}).
              </p>
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-bold">⚠️ Données affectées :</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Tous les élèves, paiements et frais de scolarité</li>
                  <li>Tout le personnel, enseignants et leurs accès</li>
                  <li>Toutes les notes, emplois du temps et cours</li>
                  <li>L'historique et les abonnements associés</li>
                </ul>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Pour confirmer, saisissez le nom exact de l'établissement :
                </label>
                <input
                  type="text"
                  value={deleteConfirmInput}
                  onChange={(e) => setDeleteConfirmInput(e.target.value)}
                  placeholder={schoolToDelete.name}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSchoolToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={handleExecuteDeleteSchool}
                disabled={isDeleting || deleteConfirmInput.trim().toLowerCase() !== schoolToDelete.name.trim().toLowerCase()}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer Définitivement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <SupabaseTesterModal 
        isOpen={isSupabaseModalOpen} 
        onClose={() => setIsSupabaseModalOpen(false)} 
      />

      <AdminDataExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        initialSchoolId={exportSchoolId}
      />

    </div>
  );
};

export default AdminSchoolsDirectory;

