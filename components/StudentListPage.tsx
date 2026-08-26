import React, { useState, useMemo } from 'react';
import { User } from './UserForm';
import IdCard from './IdCard';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { 
  GraduationCap, 
  Search, 
  Filter, 
  CreditCard, 
  Trash2, 
  Eye, 
  School, 
  CheckCircle2, 
  XCircle, 
  Users, 
  Mail, 
  Phone, 
  Sparkles,
  BookOpen,
  Zap,
  ShieldCheck,
  Lock,
  FileSpreadsheet
} from 'lucide-react';
import { SchoolSettings } from '../App';
import UserAvatar from './UserAvatar';

interface StudentListPageProps {
  students: User[];
  onViewProfile: (studentId: number) => void;
  onDeleteStudent?: (studentId: number) => void;
  currentUserRole: string;
  schoolSettings: SchoolSettings;
  onToggleActivateStudent?: (studentId: number | string) => void;
}

const StudentListPage: React.FC<StudentListPageProps> = ({ 
  students, 
  onViewProfile, 
  onDeleteStudent, 
  currentUserRole, 
  schoolSettings,
  onToggleActivateStudent
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Actif' | 'Inactif'>('All');
  const [isBadgeModalOpen, setIsBadgeModalOpen] = useState(false);
  const [selectedStudentForBadge, setSelectedStudentForBadge] = useState<User | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [exportGrouping, setExportGrouping] = useState<'classe' | 'cycle'>('classe');

  const classes = useMemo(() => {
    const rawClasses = Array.from(new Set(students.map(s => s.class).filter(Boolean)));
    return ['All', ...rawClasses];
  }, [students]);

  const filteredStudents = useMemo(() => {
    return students
      .filter(student => classFilter === 'All' || student.class === classFilter)
      .filter(student => statusFilter === 'All' || student.status === statusFilter)
      .filter(student =>
        student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [students, searchTerm, classFilter, statusFilter]);
  
  const handleShowBadge = (e: React.MouseEvent, student: User) => {
    e.stopPropagation();
    setSelectedStudentForBadge(student);
    setIsBadgeModalOpen(true);
  };

  const handleDeleteStudentClick = (e: React.MouseEvent, student: User) => {
    e.stopPropagation();
    setStudentToDelete(student);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete && studentToDelete.id && onDeleteStudent) {
      onDeleteStudent(studentToDelete.id);
    }
    setIsDeleteModalOpen(false);
    setStudentToDelete(null);
  };

  const canGenerateBadges = ['Admin', 'Caissière', 'Responsable des finances', 'Directeur des Etudes'].includes(currentUserRole);
  const canDeleteStudent = ['Admin', 'Responsable des finances'].includes(currentUserRole) && !!onDeleteStudent;
  const canExportStudents = [
    'Directeur Général',
    'Directeur des Etudes',
    'Directeur du Primaire',
    'Caissière',
    'Responsable des finances',
  ].includes(currentUserRole);

  const getCycleFromClass = (className?: string) => {
    const value = (className || '').toLowerCase();
    if (!value) return 'Cycle non renseigné';
    if (value.includes('garderie') || value.includes('maternelle') || value.includes('petite') || value.includes('moyenne') || value.includes('grande section')) return 'Préscolaire';
    if (/(cp|ce1|ce2|cm1|cm2|primaire)/i.test(className || '')) return 'Primaire';
    if (/(6|5|4|3|collège|college)/i.test(className || '')) return 'Collège';
    if (/(2nde|seconde|1ère|première|terminale|tle|lycée|lycee)/i.test(className || '')) return 'Lycée';
    return 'Autre cycle';
  };

  const handleExportStudentsAlphabetically = () => {
    const sorted = [...filteredStudents].sort((a, b) => {
      const groupA = exportGrouping === 'classe' ? (a.class || 'Classe non renseignée') : getCycleFromClass(a.class);
      const groupB = exportGrouping === 'classe' ? (b.class || 'Classe non renseignée') : getCycleFromClass(b.class);
      return groupA.localeCompare(groupB, 'fr') || (a.name || '').localeCompare(b.name || '', 'fr');
    });

    let csv = '\uFEFF';
    csv += `"LISTE ALPHABÉTIQUE DES ÉLÈVES - ${schoolSettings?.name || 'ÉTABLISSEMENT'}"\n`;
    csv += `"Regroupement";"${exportGrouping === 'classe' ? 'Classe' : 'Cycle'}"\n`;
    csv += `"Généré le";"${new Date().toLocaleString('fr-FR')}"\n\n`;
    csv += `"${exportGrouping === 'classe' ? 'Classe' : 'Cycle'}";"Classe";"Nom";"Matricule";"Statut";"Téléphone parent";"Email";"Adresse"\n`;

    sorted.forEach(student => {
      const group = exportGrouping === 'classe' ? (student.class || 'Classe non renseignée') : getCycleFromClass(student.class);
      csv += [
        group,
        student.class || '',
        student.name || '',
        student.studentId || '',
        student.status || '',
        student.parentPhone || student.guardianPhone || student.phone || student.contact || '',
        student.email || '',
        student.address || '',
      ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Eleves_alphabetique_par_${exportGrouping}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalStudents = students.length;
  const activeStudents = students.filter(s => s.status === 'Actif').length;
  const uniqueClassesCount = classes.length > 1 ? classes.length - 1 : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner & Stats */}
      <div className="bg-white dark:bg-slate-800 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-[#1F4A59]/10 dark:bg-sky-400/10 text-[#1F4A59] dark:text-sky-300 text-[11px] font-black uppercase tracking-wider rounded-full border border-[#1F4A59]/20">
                Registre Académique
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Répertoire des Élèves & Effectifs
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Consultez les dossiers scolaires détaillés, générez les badges avec QR code et filtrez les effectifs par niveau et classe.
            </p>
          </div>
        </div>

        {/* Pro Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700/60">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Élèves Inscrits</span>
              <GraduationCap className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">{totalStudents}</p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dossiers Actifs</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeStudents}</p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/50 dark:border-slate-800 col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Classes Répertoriées</span>
              <School className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{uniqueClassesCount}</p>
          </div>
        </div>
      </div>
      
      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par nom, matricule ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-2xl py-2 pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#1F4A59]/20 focus:border-[#1F4A59]"
          />
        </div>

        {/* Dropdowns */}
        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/70 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Classe:</span>
            <select 
              id="classFilter" 
              value={classFilter} 
              onChange={e => setClassFilter(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none pr-2 cursor-pointer"
            >
              {classes.map(c => (
                <option key={c} value={c}>
                  {c === 'All' ? `Toutes les classes (${students.length})` : c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-900/70 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase px-2">Statut:</span>
            <select 
              value={statusFilter} 
              onChange={e => setStatusFilter(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none pr-2 cursor-pointer"
            >
              <option value="All">Tous statuts</option>
              <option value="Actif">Actif</option>
              <option value="Inactif">Inactif</option>
            </select>
          </div>

          {canExportStudents && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 p-1 rounded-2xl border border-emerald-200 dark:border-emerald-800 text-xs">
              <select
                value={exportGrouping}
                onChange={(e) => setExportGrouping(e.target.value as 'classe' | 'cycle')}
                className="bg-transparent text-xs font-bold text-emerald-800 dark:text-emerald-200 focus:outline-none px-2 cursor-pointer"
                title="Choisir le regroupement de l'export"
              >
                <option value="classe">Par classe</option>
                <option value="cycle">Par cycle</option>
              </select>
              <button
                onClick={handleExportStudentsAlphabetically}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black transition-colors"
                title="Exporter la liste des élèves par ordre alphabétique"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Exporter A-Z</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Professional Table */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="py-4 px-6">Élève & Identifiant</th>
                <th className="py-4 px-6">Classe & Niveau</th>
                <th className="py-4 px-6">Statut Dossier</th>
                <th className="py-4 px-6 text-right">Actions Directes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-200">
              {filteredStudents.map((student) => (
                <tr 
                  key={student.id} 
                  onClick={() => onViewProfile(student.id!)} 
                  className="cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition-colors group"
                >
                  {/* Student Info */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="relative shrink-0">
                        <UserAvatar
                          src={student.avatar}
                          name={student.name}
                          role="Élève"
                          size="md"
                          status={student.status}
                          showStatus
                          className="rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 dark:text-slate-100 group-hover:text-[#1F4A59] dark:group-hover:text-sky-400 transition-colors text-sm truncate">
                          {student.name}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                          <span className="font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                            {student.studentId || 'N/A'}
                          </span>
                          {student.email && (
                            <span className="truncate font-mono">{student.email}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Class */}
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/60 px-3 py-1 rounded-xl">
                      <School className="w-3.5 h-3.5 text-[#1F4A59] dark:text-sky-400" />
                      <span>{student.class || 'Non assigné'}</span>
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                      student.status === 'Actif' 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {student.status === 'Actif' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      )}
                      <span>{student.status}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Admin', 'Co-admin'].includes(currentUserRole) && onToggleActivateStudent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleActivateStudent(student.id!);
                          }}
                          className={`px-3 py-1 rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            student.isAccountActivated
                              ? 'bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                              : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md font-extrabold animate-pulse'
                          }`}
                          title={student.isAccountActivated ? "Compte activé (Cliquer pour désactiver)" : "Cliquer pour ACTIVER le compte de cet élève"}
                        >
                          {student.isAccountActivated ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Compte Activé</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                              <span>Activer</span>
                            </>
                          )}
                        </button>
                      )}

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewProfile(student.id!);
                        }}
                        className="p-2 text-[#1F4A59] dark:text-sky-400 hover:bg-[#1F4A59]/10 dark:hover:bg-sky-400/10 rounded-xl transition-colors cursor-pointer border border-[#1F4A59]/20"
                        title="Consulter le dossier académique et notes"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {canGenerateBadges && (
                        <button 
                          onClick={(e) => handleShowBadge(e, student)} 
                          className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-xl transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800" 
                          title="Générer la carte d'élève"
                        >
                          <CreditCard className="w-4 h-4" />
                        </button>
                      )}

                      {canDeleteStudent && (
                        <button 
                          onClick={(e) => handleDeleteStudentClick(e, student)} 
                          className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer border border-rose-200 dark:border-rose-800" 
                          title="Supprimer le dossier de l'élève"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>

                </tr>
              ))}

              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-slate-400">
                    <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold text-sm">Aucun élève trouvé</p>
                    <p className="text-xs text-slate-500 mt-1">Ajustez les termes de recherche ou la classe sélectionnée.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>Affichage de <strong>{filteredStudents.length}</strong> sur <strong>{students.length}</strong> élèves</span>
          <span className="font-bold text-[#1F4A59] dark:text-sky-400">{activeStudents} inscrits en règle</span>
        </div>
      </div>
      
      {/* Badge Modal */}
      <Modal isOpen={isBadgeModalOpen} onClose={() => setIsBadgeModalOpen(false)} title="Badge & Carte d'Élève" size="4xl">
        {selectedStudentForBadge && (
            <IdCard
                person={selectedStudentForBadge}
                schoolSettings={schoolSettings}
                onClose={() => setIsBadgeModalOpen(false)}
            />
        )}
      </Modal>

      {/* Delete Modal */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setStudentToDelete(null);
        }}
        onConfirm={confirmDeleteStudent}
        title="Confirmation de suppression - Élève"
        itemType="l'élève"
        itemName={studentToDelete?.name}
        itemDetails={studentToDelete ? `Classe : ${studentToDelete.class || 'N/A'} ${studentToDelete.studentId ? `• Matricule : ${studentToDelete.studentId}` : ''}` : undefined}
        warningNote="Attention : La suppression de cet élève supprimera définitivement son dossier scolaire, ses notes, son assiduité et son historique de paiements. Cette action est irréversible."
        confirmText="Supprimer l'élève"
        cancelText="Annuler"
      />
    </div>
  );
};

export default StudentListPage;
