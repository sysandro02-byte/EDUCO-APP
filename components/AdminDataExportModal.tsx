import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from '@e965/xlsx';
import { 
  Download, 
  FileSpreadsheet, 
  Building2, 
  GraduationCap, 
  Users, 
  Briefcase, 
  Layers, 
  CheckCircle2, 
  X, 
  Sparkles, 
  RefreshCw, 
  AlertCircle,
  FileText,
  Calendar,
  Check
} from 'lucide-react';
import { fetchAdminExportData, fetchAdminRegisteredSchools } from '../src/services/api';

interface AdminDataExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSchoolId?: string;
}

export const AdminDataExportModal: React.FC<AdminDataExportModalProps> = ({
  isOpen,
  onClose,
  initialSchoolId = 'all'
}) => {
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [scope, setScope] = useState<'all' | 'specific'>(initialSchoolId !== 'all' ? 'specific' : 'all');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(initialSchoolId !== 'all' ? initialSchoolId : '');
  const [dataset, setDataset] = useState<'students' | 'teachers' | 'personnel' | 'schools' | 'all_in_one'>('all_in_one');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportData, setExportData] = useState<{
    schools: any[];
    users: any[];
    students: any[];
    personnel: any[];
    classes: any[];
    payments: any[];
    transactions: any[];
  }>({
    schools: [],
    users: [],
    students: [],
    personnel: [],
    classes: [],
    payments: [],
    transactions: []
  });

  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const res = await fetchAdminExportData();
        if (res && res.success) {
          setExportData({
            schools: res.schools || [],
            users: res.users || [],
            students: res.students || [],
            personnel: res.personnel || [],
            classes: res.classes || [],
            payments: res.payments || [],
            transactions: res.transactions || []
          });

          if (res.schools && res.schools.length > 0 && !selectedSchoolId) {
            setSelectedSchoolId(String(res.schools[0].id));
          }
        }
      } catch (err: any) {
        console.error("Error loading export data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen]);

  // Filtered dataset counts
  const targetSchool = useMemo(() => {
    if (scope === 'all') return null;
    return exportData.schools.find(s => String(s.id) === String(selectedSchoolId));
  }, [exportData.schools, scope, selectedSchoolId]);

  const targetUsers = useMemo(() => {
    if (scope === 'all') return exportData.users;
    return exportData.users.filter(u => String(u.schoolId) === String(selectedSchoolId));
  }, [exportData.users, scope, selectedSchoolId]);

  const studentCount = useMemo(() => {
    return targetUsers.filter(u => u.role === 'Élève').length;
  }, [targetUsers]);

  const teacherCount = useMemo(() => {
    return targetUsers.filter(u => u.role === 'Enseignant').length;
  }, [targetUsers]);

  const personnelCount = useMemo(() => {
    return targetUsers.filter(u => u.role !== 'Élève' && u.role !== 'Parent' && u.role !== 'Admin').length;
  }, [targetUsers]);

  const handleExport = async () => {
    setIsExporting(true);
    setStatusMessage(null);

    try {
      const nowStr = new Date().toISOString().slice(0, 10);
      const schoolPrefix = scope === 'specific' && targetSchool 
        ? targetSchool.name.toUpperCase().replace(/[^A-Z0-9]/gi, '_').substring(0, 20)
        : 'TOUS_LES_ETABLISSEMENTS';

      // 1. Prepare Data for Students
      const prepareStudentsData = () => {
        const studentUsers = targetUsers.filter(u => u.role === 'Élève');
        return studentUsers.map(u => {
          const sDetail = exportData.students.find(s => s.userId === u.id) || {};
          const school = exportData.schools.find(sch => sch.id === u.schoolId) || {};
          const cls = exportData.classes.find(c => c.id === sDetail.classId) || {};
          const pay = exportData.payments.find(p => p.studentId === u.id || p.name === u.name) || {};
          const totalFees = pay.totalFees || sDetail.totalFees || 0;
          const amountPaid = pay.amountPaid || 0;
          const balance = totalFees - amountPaid;

          return {
            "Matricule": sDetail.studentId || `MAT-${u.id}`,
            "Nom & Prénom de l'Élève": u.name,
            "E-mail": u.email || "Non renseigné",
            "Classe": cls.name || sDetail.class || "Non assignée",
            "Établissement": school.name || `Établissement #${u.schoolId}`,
            "Nom du Parent / Tuteur": sDetail.parentName || u.parentName || "Non renseigné",
            "Téléphone Parent": sDetail.parentPhone || u.phone || "Non renseigné",
            "Adresse": sDetail.address || "Non renseignée",
            "Date de Naissance": sDetail.dateOfBirth || "Non renseignée",
            "Frais Scolaires Totaux (FCFA)": totalFees,
            "Montant Versé (FCFA)": amountPaid,
            "Solde Restant Dû (FCFA)": balance,
            "Statut Financier": balance <= 0 ? "En Règle" : "Solde Débiteur",
            "Statut Compte": u.status || "Actif"
          };
        });
      };

      // 2. Prepare Data for Teachers
      const prepareTeachersData = () => {
        const teacherUsers = targetUsers.filter(u => u.role === 'Enseignant');
        return teacherUsers.map(u => {
          const pDetail = exportData.personnel.find(p => p.userId === u.id) || {};
          const school = exportData.schools.find(sch => sch.id === u.schoolId) || {};

          return {
            "Matricule": pDetail.matricule || `ENS-${u.id}`,
            "Nom & Prénom": u.name,
            "E-mail de connexion": u.email,
            "Téléphone": u.phone || pDetail.phone || "Non renseigné",
            "Matière / Spécialité": pDetail.role || "Enseignant",
            "Établissement": school.name || `Établissement #${u.schoolId}`,
            "Salaire de Base (FCFA)": pDetail.baseSalary || 0,
            "Date d'Embauche": pDetail.hireDate || "Non renseignée",
            "Compte Bancaire / Mobile Money": pDetail.bankAccount || "Non renseigné",
            "Statut": u.status || "Actif"
          };
        });
      };

      // 3. Prepare Data for Personnel / Staff
      const preparePersonnelData = () => {
        const staffUsers = targetUsers.filter(u => u.role !== 'Élève' && u.role !== 'Parent' && u.role !== 'Admin');
        return staffUsers.map(u => {
          const pDetail = exportData.personnel.find(p => p.userId === u.id) || {};
          const school = exportData.schools.find(sch => sch.id === u.schoolId) || {};

          return {
            "Matricule": pDetail.matricule || `STF-${u.id}`,
            "Nom & Prénom de l'Agent": u.name,
            "E-mail de connexion": u.email,
            "Téléphone": u.phone || "Non renseigné",
            "Poste / Fonction": pDetail.role || u.role,
            "Rôle Système": u.role,
            "Établissement": school.name || `Établissement #${u.schoolId}`,
            "Salaire Mensuel (FCFA)": pDetail.baseSalary || 0,
            "Date d'Embauche": pDetail.hireDate || "Non renseignée",
            "Compte Bancaire / RIB": pDetail.bankAccount || "Non renseigné",
            "Statut": u.status || "Actif"
          };
        });
      };

      // 4. Prepare Data for Schools
      const prepareSchoolsData = () => {
        const schoolsToExport = scope === 'specific' && targetSchool 
          ? [targetSchool] 
          : exportData.schools;

        return schoolsToExport.map(s => {
          const studentCountInSch = exportData.users.filter(u => u.schoolId === s.id && u.role === 'Élève').length;
          const teacherCountInSch = exportData.users.filter(u => u.schoolId === s.id && u.role === 'Enseignant').length;
          const staffCountInSch = exportData.users.filter(u => u.schoolId === s.id && u.role !== 'Élève' && u.role !== 'Parent' && u.role !== 'Admin').length;

          return {
            "ID": s.id,
            "Nom de l'Établissement": s.name,
            "Identifiant Unique": s.identifier || `EDUCO-SCH-${s.id}`,
            "Adresse": s.address || "Non renseignée",
            "Téléphone Principal": s.phone || "Non renseigné",
            "E-mail": s.email || "Non renseigné",
            "Nom du Promoteur": s.promoterName || s.promoter || "Non renseigné",
            "Contact Promoteur": s.promoterContact || "Non renseigné",
            "E-mail Promoteur": s.promoterEmail || "Non renseigné",
            "Nombre d'Élèves": studentCountInSch,
            "Nombre d'Enseignants": teacherCountInSch,
            "Total Personnel": staffCountInSch,
            "Statut": s.status || "Actif",
            "Date d'Enregistrement": s.registeredAt || s.createdAt ? new Date(s.registeredAt || s.createdAt).toLocaleDateString('fr-FR') : "Non renseignée"
          };
        });
      };

      // Handle CSV Generation
      if (format === 'csv') {
        let activeData: any[] = [];
        let filename = "";

        if (dataset === 'students') {
          activeData = prepareStudentsData();
          filename = `EDUCO_ELEVES_${schoolPrefix}_${nowStr}.csv`;
        } else if (dataset === 'teachers') {
          activeData = prepareTeachersData();
          filename = `EDUCO_ENSEIGNANTS_${schoolPrefix}_${nowStr}.csv`;
        } else if (dataset === 'personnel') {
          activeData = preparePersonnelData();
          filename = `EDUCO_PERSONNEL_${schoolPrefix}_${nowStr}.csv`;
        } else if (dataset === 'schools') {
          activeData = prepareSchoolsData();
          filename = `EDUCO_ETABLISSEMENTS_${nowStr}.csv`;
        } else {
          // All in one -> fallback to full students or schools
          activeData = prepareStudentsData();
          filename = `EDUCO_EXPORT_GLOBAL_${schoolPrefix}_${nowStr}.csv`;
        }

        if (activeData.length === 0) {
          throw new Error("Aucune donnée correspondante trouvée pour cette sélection.");
        }

        // Build CSV string with semicolon separator (standard French Excel)
        const headers = Object.keys(activeData[0]);
        const csvRows = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(";")];

        activeData.forEach(row => {
          const values = headers.map(h => {
            const val = row[h];
            if (val === null || val === undefined) return '""';
            return `"${String(val).replace(/"/g, '""')}"`;
          });
          csvRows.push(values.join(";"));
        });

        const csvContent = "\uFEFF" + csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);

        setStatusMessage({
          type: 'success',
          text: `Fichier CSV "${filename}" téléchargé avec succès ! (${activeData.length} lignes)`
        });
      } 
      // Handle XLSX (Excel) Generation
      else {
        const workbook = XLSX.utils.book_new();
        let filename = "";

        if (dataset === 'all_in_one') {
          filename = `EDUCO_DOSSIER_COMPLET_${schoolPrefix}_${nowStr}.xlsx`;

          const schoolsData = prepareSchoolsData();
          const studentsData = prepareStudentsData();
          const teachersData = prepareTeachersData();
          const personnelData = preparePersonnelData();

          if (schoolsData.length > 0) {
            const wsSchools = XLSX.utils.json_to_sheet(schoolsData);
            XLSX.utils.book_append_sheet(workbook, wsSchools, "Établissements");
          }

          if (studentsData.length > 0) {
            const wsStudents = XLSX.utils.json_to_sheet(studentsData);
            XLSX.utils.book_append_sheet(workbook, wsStudents, "Élèves");
          }

          if (teachersData.length > 0) {
            const wsTeachers = XLSX.utils.json_to_sheet(teachersData);
            XLSX.utils.book_append_sheet(workbook, wsTeachers, "Enseignants");
          }

          if (personnelData.length > 0) {
            const wsPersonnel = XLSX.utils.json_to_sheet(personnelData);
            XLSX.utils.book_append_sheet(workbook, wsPersonnel, "Personnel");
          }
        } else if (dataset === 'students') {
          filename = `EDUCO_ELEVES_${schoolPrefix}_${nowStr}.xlsx`;
          const studentsData = prepareStudentsData();
          const ws = XLSX.utils.json_to_sheet(studentsData);
          XLSX.utils.book_append_sheet(workbook, ws, "Élèves");
        } else if (dataset === 'teachers') {
          filename = `EDUCO_ENSEIGNANTS_${schoolPrefix}_${nowStr}.xlsx`;
          const teachersData = prepareTeachersData();
          const ws = XLSX.utils.json_to_sheet(teachersData);
          XLSX.utils.book_append_sheet(workbook, ws, "Enseignants");
        } else if (dataset === 'personnel') {
          filename = `EDUCO_PERSONNEL_${schoolPrefix}_${nowStr}.xlsx`;
          const personnelData = preparePersonnelData();
          const ws = XLSX.utils.json_to_sheet(personnelData);
          XLSX.utils.book_append_sheet(workbook, ws, "Personnel");
        } else if (dataset === 'schools') {
          filename = `EDUCO_ETABLISSEMENTS_${nowStr}.xlsx`;
          const schoolsData = prepareSchoolsData();
          const ws = XLSX.utils.json_to_sheet(schoolsData);
          XLSX.utils.book_append_sheet(workbook, ws, "Établissements");
        }

        XLSX.writeFile(workbook, filename);

        setStatusMessage({
          type: 'success',
          text: `Classeur Excel "${filename}" généré et téléchargé avec succès !`
        });
      }
    } catch (err: any) {
      console.error("Export Error:", err);
      setStatusMessage({
        type: 'error',
        text: err?.message || "Erreur lors de la génération du fichier d'exportation."
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-[#1F4A59] to-[#15343f] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Centre d'Exportation Administrateur</h2>
              <p className="text-xs text-emerald-200 font-medium">Export de données Excel (.xlsx) et CSV consolidés</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          
          {/* Status Message */}
          {statusMessage && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-semibold ${
              statusMessage.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* 1. Format Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              1. Format du Fichier d'Exportation
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormat('xlsx')}
                className={`p-4 rounded-2xl border-2 flex items-center gap-3 text-left transition-all cursor-pointer ${
                  format === 'xlsx'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-300 shadow-md'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="p-2 bg-emerald-600 text-white rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">Microsoft Excel (.xlsx)</div>
                  <div className="text-[11px] text-slate-500">Idéal pour tableaux, filtres et multi-feuilles</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`p-4 rounded-2xl border-2 flex items-center gap-3 text-left transition-all cursor-pointer ${
                  format === 'csv'
                    ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-300 shadow-md'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="p-2 bg-sky-600 text-white rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm">Fichier CSV (.csv UTF-8)</div>
                  <div className="text-[11px] text-slate-500">Universel, compatible import / bases de données</div>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Scope Selection (All Schools vs Specific School) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              2. Périmètre d'Établissement
            </label>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  scope === 'all'
                    ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-md'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Tous les Établissements ({exportData.schools.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setScope('specific')}
                className={`p-3 rounded-2xl border flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                  scope === 'specific'
                    ? 'bg-[#1F4A59] text-white border-[#1F4A59] shadow-md'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4 text-emerald-400" />
                <span>Chaque Établissement (au choix)</span>
              </button>
            </div>

            {/* School Selector if Specific */}
            {scope === 'specific' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-200 dark:border-slate-600 animate-fadeIn">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Sélectionner l'établissement cible :
                </label>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {exportData.schools.map((sch) => (
                    <option key={sch.id} value={String(sch.id)}>
                      {sch.name} (ID: {sch.id})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 3. Dataset Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              3. Données à Exporter
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* All in one (multi sheets in Excel) */}
              {format === 'xlsx' && (
                <button
                  type="button"
                  onClick={() => setDataset('all_in_one')}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between text-left col-span-1 sm:col-span-2 transition-all cursor-pointer ${
                    dataset === 'all_in_one'
                      ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-600 text-white rounded-xl">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">Classeur Consolidé Complet (Multi-Feuilles)</div>
                      <div className="text-[10px] text-slate-500">Inclut Établissements, Élèves, Enseignants et Personnel</div>
                    </div>
                  </div>
                  {dataset === 'all_in_one' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </button>
              )}

              {/* Students */}
              <button
                type="button"
                onClick={() => setDataset('students')}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                  dataset === 'students'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600 text-white rounded-xl">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">
                      {scope === 'all' ? 'Tous les Élèves' : 'Élèves de l\'établissement'}
                    </div>
                    <div className="text-[10px] text-slate-500">{studentCount} élève(s) disponible(s)</div>
                  </div>
                </div>
                {dataset === 'students' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </button>

              {/* Teachers */}
              <button
                type="button"
                onClick={() => setDataset('teachers')}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                  dataset === 'teachers'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">
                      {scope === 'all' ? 'Tous les Enseignants' : 'Enseignants de l\'établissement'}
                    </div>
                    <div className="text-[10px] text-slate-500">{teacherCount} enseignant(s) disponible(s)</div>
                  </div>
                </div>
                {dataset === 'teachers' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </button>

              {/* Personnel / Staff */}
              <button
                type="button"
                onClick={() => setDataset('personnel')}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                  dataset === 'personnel'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-600 text-white rounded-xl">
                    <Briefcase className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">
                      {scope === 'all' ? 'Tout le Personnel' : 'Personnel de l\'établissement'}
                    </div>
                    <div className="text-[10px] text-slate-500">{personnelCount} agent(s) (RAF, DE, Caisse, etc.)</div>
                  </div>
                </div>
                {dataset === 'personnel' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </button>

              {/* Schools List */}
              <button
                type="button"
                onClick={() => setDataset('schools')}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                  dataset === 'schools'
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-bold shadow-sm ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Fiche des Établissements</div>
                    <div className="text-[10px] text-slate-500">{exportData.schools.length} établissement(s) enregistré(s)</div>
                  </div>
                </div>
                {dataset === 'schools' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </button>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-indigo-600 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synchronisation des données...
              </span>
            ) : (
              <span>Format sélectionné : <strong className="text-slate-800 dark:text-slate-200 uppercase">{format}</strong></span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isExporting || isLoading}
              onClick={handleExport}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Génération du fichier...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Télécharger l'Export ({format.toUpperCase()})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
export default AdminDataExportModal;
