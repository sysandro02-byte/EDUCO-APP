import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User } from './UserForm';
import { Grade } from './GradeForm';
import { ReportCardComments } from './ReportCardCommentsForm';
import { Subject } from './SubjectForm';
import { Camera, Edit3, QrCode, Download, Printer, ShieldCheck, UserCheck, ArrowLeft, CheckCircle, Trash2, CreditCard, Sparkles, Phone, MapPin, Calendar, Award, Scissors, CheckCircle2, Zap } from 'lucide-react';
import StudentPhotoCaptureModal from './StudentPhotoCaptureModal';
import ConfirmDialog from './ConfirmDialog';
import { QRCodeSVG } from 'qrcode.react';

interface StudentProfilePageProps {
  student: User;
  grades: Grade[];
  attendance: any[];
  comments: ReportCardComments | undefined;
  subjects: Subject[];
  schoolSettings: any;
  onBack: () => void;
  onUpdateStudent?: (student: User) => void;
  onDeleteStudent?: (studentId: number) => void;
  currentUserRole?: string;
  onToggleActivateStudent?: (studentId: number | string) => void;
}

const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ 
  student, 
  grades, 
  attendance, 
  comments, 
  subjects, 
  schoolSettings,
  onBack,
  onUpdateStudent,
  onDeleteStudent,
  currentUserRole = 'Admin',
  onToggleActivateStudent
}) => {
  const [currentAvatar, setCurrentAvatar] = useState<string>(student.avatar || '');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cardSide, setCardSide] = useState<'both' | 'recto' | 'verso'>('both');

  const canDelete = ['Admin', 'Responsable des finances'].includes(currentUserRole) && !!onDeleteStudent;

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.removeAttribute('data-print-target');
      document.body.classList.remove('printing-id-card');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const confirmDelete = () => {
    if (student.id && onDeleteStudent) {
      onDeleteStudent(student.id);
      setIsDeleteModalOpen(false);
      onBack();
    }
  };

  const matricule = student.studentId || `STD-${String(student.id).padStart(4, '0')}`;
  const academicYear = schoolSettings?.currentYear || '2025 - 2026';

  const qrData = useMemo(() => {
    return JSON.stringify({
      type: 'EDUCO_STUDENT_PASS',
      studentId: matricule,
      name: student.name,
      class: student.class || 'N/A',
      school: schoolSettings?.name || 'Établissement Scolaire',
      schoolId: student.id,
      contact: student.contact || student.fatherPhone || student.motherPhone || 'N/A',
      issuedAt: new Date().toISOString().split('T')[0]
    });
  }, [student, schoolSettings, matricule]);

  const gradesBySubject = useMemo(() => {
    const grouped = new Map<string, { grades: Grade[]; average: number | null }>();
    subjects.forEach(subject => grouped.set(subject.name, { grades: [], average: null }));
    
    grades.forEach(grade => {
      if (!grouped.has(grade.subject)) {
        grouped.set(grade.subject, { grades: [], average: null });
      }
      grouped.get(grade.subject)!.grades.push(grade);
    });

    grouped.forEach((value, key) => {
      if (value.grades.length > 0) {
        value.average = value.grades.reduce((sum, g) => sum + g.score, 0) / value.grades.length;
      }
    });
    return grouped;
  }, [grades, subjects]);
  
  const overallAverage = useMemo(() => {
    if (grades.length === 0) return null;
    return (grades.reduce((sum, g) => sum + g.score, 0) / grades.length).toFixed(2);
  }, [grades]);

  const attendanceSummary = useMemo(() => {
    const total = attendance.length;
    const absences = attendance.filter(a => a.status === 'Absent').length;
    return { total, absences };
  }, [attendance]);

  const handlePhotoCaptured = (newPhoto: string) => {
    setCurrentAvatar(newPhoto);
    if (onUpdateStudent) {
      onUpdateStudent({
        ...student,
        avatar: newPhoto
      });
    }
  };

  const handlePrintIdCard = () => {
    document.body.setAttribute('data-print-target', 'id-card');
    document.body.classList.add('printing-id-card');
    window.print();
    setTimeout(() => {
      document.body.removeAttribute('data-print-target');
      document.body.classList.remove('printing-id-card');
    }, 1200);
  };

  const handlePrintQrBadge = () => {
    handlePrintIdCard();
  };

  return (
    <div className="space-y-6 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* --------------------------------------------------------------------------
          SCREEN CONTENT (Hidden automatically when printing Carte ID via print target)
          -------------------------------------------------------------------------- */}
      <div className="hide-on-id-card-print space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 no-print">
          <button 
            onClick={onBack} 
            className="inline-flex items-center gap-2 text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à la liste des élèves</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {['Promoteur', 'Directeur Général', 'Directeur des Etudes', 'Admin', 'Co-admin'].includes(currentUserRole) && onToggleActivateStudent && (
              <button
                onClick={() => onToggleActivateStudent(student.id!)}
                className={`px-4 py-2 rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer ${
                  student.isAccountActivated
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold animate-pulse'
                }`}
                title={student.isAccountActivated ? "Compte activé (Cliquer pour désactiver)" : "Cliquer pour ACTIVER le compte de cet élève"}
              >
                {student.isAccountActivated ? (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-200" />
                    <span>Compte Élève Activé</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Activer le Compte Élève</span>
                  </>
                )}
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/50 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-rose-200 dark:border-rose-900/50 shadow-xs transition-all cursor-pointer"
                title="Supprimer définitivement le dossier de l'élève"
              >
                <Trash2 className="w-4 h-4" />
                <span>Supprimer l'élève</span>
              </button>
            )}

            <button
              onClick={() => setShowIdCardModal(true)}
              className="px-4 py-2 bg-[#1F4A59] hover:bg-[#275d70] text-white font-black text-xs rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-98"
              title="Aperçu et impression de la carte d'identité scolaire"
            >
              <CreditCard className="w-4 h-4 text-amber-300" />
              <span>CARTE D'IDENTITÉ (BADGE)</span>
            </button>

            <button
              onClick={handlePrintIdCard}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-slate-200 dark:border-slate-600 shadow-xs transition-all cursor-pointer"
              title="Imprimer directement la carte d'identité scolaire"
            >
              <Printer className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
              <span>Imprimer Carte ID</span>
            </button>

            <button
              onClick={() => setShowQrModal(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Pass QR</span>
            </button>
          </div>
        </div>

        {/* Header Profile Card */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative group shrink-0">
              <img 
                src={currentAvatar || 'https://via.placeholder.com/150'} 
                alt={student.name} 
                className="w-24 h-24 rounded-2xl object-cover border-4 border-sky-100 dark:border-slate-700 shadow-md" 
              />
              <button
                onClick={() => setIsPhotoModalOpen(true)}
                className="absolute -bottom-2 -right-2 p-2 bg-[#1F4A59] text-white rounded-full shadow-lg hover:scale-110 transition-transform cursor-pointer"
                title="Photographier ou changer la photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100">{student.name}</h2>
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                  Inscrit / Actif
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mt-1">Classe : <strong className="text-sky-700 dark:text-sky-400">{student.class}</strong></p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">N° Matricule Unique : <strong className="font-mono text-slate-800 dark:text-slate-200">{matricule}</strong></p>
            </div>
          </div>

          {/* Quick ID Card Action Preview Box */}
          <div 
            onClick={() => setShowIdCardModal(true)}
            className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4 cursor-pointer hover:border-[#1F4A59] dark:hover:border-sky-400 transition-all shadow-2xs group"
          >
            <div className="bg-[#1F4A59] text-white p-2.5 rounded-xl shadow-xs group-hover:scale-105 transition-transform flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-amber-300" />
            </div>
            <div className="text-left space-y-0.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1F4A59] dark:text-sky-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Carte Scolaire Officielle
              </span>
              <p className="text-xs font-black text-slate-900 dark:text-slate-100">Badge & Carte d'Identité</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 underline font-medium">Aperçu & Impression Haute Définition</p>
            </div>
          </div>
        </div>
        
        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Info & Attendance */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">
                Informations Personnelles
              </h3>
              <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                <p className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Date de Naissance :</span>
                  <strong className="font-semibold">{student.dob ? new Date(student.dob).toLocaleDateString('fr-FR') : 'N/A'}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Genre :</span>
                  <strong className="font-semibold">{student.gender || 'N/A'}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Parent / Tuteur :</span>
                  <strong className="font-semibold">{student.guardian || student.fatherName || 'N/A'}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Contact d'Urgence :</span>
                  <strong className="font-semibold">{student.contact || student.fatherPhone || 'N/A'}</strong>
                </p>
                <p className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Adresse :</span>
                  <strong className="font-semibold truncate max-w-[150px]">{student.address || 'N/A'}</strong>
                </p>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">
                Résumé des Présences
              </h3>
              <div className="text-center py-2">
                <p className="text-4xl font-black text-rose-600 dark:text-rose-400">{attendanceSummary.absences}</p>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mt-1">Absence(s) sur {attendanceSummary.total} jours enregistrés</p>
              </div>
            </div>
          </div>

          {/* Right column: Grades & Comments */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3 mb-3">
                <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">Résultats Académiques</h3>
                {overallAverage && (
                  <div className="text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Moyenne Générale : </span>
                    <span className="font-black text-base text-sky-600 dark:text-sky-400">{overallAverage} / 20</span>
                  </div>
                )}
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                {Array.from(gradesBySubject.entries()).map(([subject, data]) => (
                  <div key={subject} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">{subject}</h4>
                      {data.average !== null && (
                        <p className="text-xs font-black text-sky-600 dark:text-sky-400">Moy. : {data.average.toFixed(2)} / 20</p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {data.grades.length > 0 ? data.grades.map(g => (
                        <span key={g.id} className="text-xs font-bold px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300" title={g.assignment}>
                          {g.score}
                        </span>
                      )) : <span className="text-[11px] text-slate-400 italic">Aucune note enregistrée</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2 mb-3">
                Appréciations du Bulletin
              </h3>
              <p className="text-xs italic text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                "{comments?.generalAppreciation || "Aucune appréciation générale enregistrée pour le trimestre en cours."}"
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------------
          SPECIFIC PRINT-ONLY ID CARD VIEW (CARTE D'IDENTITÉ SCOLAIRE)
          Triggered via print media queries when printing ID card
          -------------------------------------------------------------------------- */}
      <div id="student-id-card-print-view" className="print-id-card-view">
        <div className="max-w-[190mm] mx-auto text-slate-900 font-sans space-y-6">
          
          {/* Header page for printout */}
          <div className="text-center pb-3 border-b-2 border-slate-900 flex justify-between items-center">
            <div className="text-left">
              <h1 className="text-lg font-black uppercase tracking-tight text-slate-900">{schoolSettings?.name || 'ÉTABLISSEMENT SCOLAIRE'}</h1>
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{schoolSettings?.address || 'MINISTÈRE DE L\'ÉDUCATION'}</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-black uppercase tracking-widest bg-slate-900 text-white px-2.5 py-1 rounded">
                CARTE D'IDENTITÉ SCOLAIRE
              </span>
              <p className="text-[9px] font-bold text-slate-500 mt-1">Année Scolaire {academicYear}</p>
            </div>
          </div>

          <p className="text-[10px] italic text-slate-500 text-center flex items-center justify-center gap-2">
            <Scissors className="w-3.5 h-3.5 text-slate-400" />
            Découper le badge le long des pointillés ci-dessous pour plastification ou insertion sous porte-carte format standard (85.6 × 54 mm)
          </p>

          {/* Side-by-side Recto & Verso on print page */}
          <div className="flex flex-row items-center justify-center gap-8 pt-2">
            
            {/* RECTO / FRONT OF CARD */}
            <div className="relative w-[85.6mm] h-[54mm] bg-gradient-to-br from-[#1F4A59] via-[#1a3e4b] to-[#0f2831] text-white rounded-2xl p-[3.5mm] border-2 border-slate-900 shadow-none flex flex-col justify-between overflow-hidden id-card-print-badge">
              
              {/* Card top banner */}
              <div className="flex justify-between items-center pb-1 border-b border-white/25">
                <div className="flex items-center gap-1.5">
                  {schoolSettings?.logo ? (
                    <img src={schoolSettings.logo} alt="Logo" className="w-6 h-6 object-contain rounded bg-white/10 p-0.5" />
                  ) : (
                    <div className="w-6 h-6 bg-amber-400 text-slate-900 rounded font-black text-[9px] flex items-center justify-center">
                      ED
                    </div>
                  )}
                  <div className="leading-tight">
                    <p className="text-[9px] font-black uppercase tracking-tight text-amber-300 truncate max-w-[130px]">
                      {schoolSettings?.name || 'EDUCO SCHOOL'}
                    </p>
                    <p className="text-[6.5px] font-bold uppercase tracking-widest text-sky-200">Carte d'Élève</p>
                  </div>
                </div>

                <div className="text-right leading-tight">
                  <span className="text-[7px] font-black uppercase text-amber-300 bg-black/30 px-1.5 py-0.5 rounded border border-amber-300/40">
                    {academicYear}
                  </span>
                </div>
              </div>

              {/* Card middle: Photo & Student Bio */}
              <div className="flex items-center gap-3 my-auto">
                <div className="relative shrink-0">
                  <img 
                    src={currentAvatar || 'https://via.placeholder.com/150'} 
                    alt={student.name}
                    className="w-[20mm] h-[24mm] rounded-lg object-cover border-2 border-amber-300 shadow-xs" 
                  />
                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                  </div>
                </div>

                <div className="space-y-0.5 text-left min-w-0 flex-1">
                  <p className="text-[6.5px] font-bold text-amber-200/90 uppercase tracking-widest">Nom & Prénom :</p>
                  <h3 className="font-black text-[11px] leading-tight truncate text-white uppercase">{student.name}</h3>

                  <div className="grid grid-cols-2 gap-x-2 pt-0.5 text-[7.5px]">
                    <div>
                      <span className="text-sky-200 font-medium">Classe : </span>
                      <strong className="text-white font-black">{student.class || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-sky-200 font-medium">Né(e) le : </span>
                      <strong className="text-white font-bold">{student.dob ? new Date(student.dob).toLocaleDateString('fr-FR') : 'N/A'}</strong>
                    </div>
                  </div>

                  <div className="pt-0.5">
                    <p className="text-[6.5px] font-mono text-amber-300 font-extrabold tracking-wide">
                      MAT : {matricule}
                    </p>
                  </div>
                </div>

                {/* QR Code */}
                <div className="bg-white p-1 rounded-md shrink-0 shadow-xs">
                  <QRCodeSVG value={qrData} size={48} level="M" />
                </div>
              </div>

              {/* Card bottom bar */}
              <div className="flex justify-between items-end pt-1 border-t border-white/20 text-[6.5px] text-sky-100/90">
                <span className="italic">Élève Régulier • Carte Officielle</span>
                <span className="font-bold uppercase tracking-wider text-amber-300">Visa & Direction</span>
              </div>
            </div>

            {/* VERSO / BACK OF CARD */}
            <div className="relative w-[85.6mm] h-[54mm] bg-slate-50 text-slate-800 rounded-2xl p-[3.5mm] border-2 border-slate-900 shadow-none flex flex-col justify-between overflow-hidden id-card-print-badge">
              
              {/* Back Top */}
              <div className="pb-1 border-b border-slate-300 flex justify-between items-center text-[7px] font-black uppercase tracking-wider text-slate-700">
                <span>Règlement & Urgence</span>
                <span>ID: {matricule}</span>
              </div>

              {/* Back Content */}
              <div className="space-y-1 my-auto text-[7px] text-slate-700 leading-tight">
                <div className="bg-amber-50 border border-amber-200 p-1.5 rounded">
                  <p className="font-bold text-amber-900 uppercase text-[6.5px] mb-0.5">Contacts d'Urgence :</p>
                  <p className="truncate"><strong>Tuteur / Parent :</strong> {student.guardian || student.fatherName || 'Parent de l\'élève'}</p>
                  <p className="font-mono font-bold text-slate-900"><strong>Tél d'Urgence :</strong> {student.contact || student.fatherPhone || student.motherPhone || 'Secrétariat'}</p>
                </div>

                <div className="text-[6px] text-slate-500 leading-tight space-y-0.5">
                  <p>• Cette carte est strictement personnelle et demeure la propriété de l'établissement.</p>
                  <p>• À présenter obligatoirement aux entrées, examens, bibliothèque et guichets.</p>
                  <p>• En cas de perte, merci de la rapporter à la direction de l'école.</p>
                </div>
              </div>

              {/* Back Footer */}
              <div className="pt-1 border-t border-slate-300 flex justify-between items-center text-[6.5px] text-slate-600">
                <div>
                  <p className="font-bold uppercase text-slate-800">{schoolSettings?.name}</p>
                  <p className="text-[6px]">{schoolSettings?.contact || 'Tél: +229 00 00 00 00'} • {schoolSettings?.address || 'Bénin'}</p>
                </div>
                <div className="text-right">
                  <div className="w-16 h-4 border-b border-slate-400 italic text-[5.5px] text-slate-400 flex items-end justify-center">
                    Cachet
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="text-center pt-8 border-t border-slate-200 text-[9px] text-slate-400 font-medium">
            Plateforme EDUCO • Généré le {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------------
          CARTE D'IDENTITÉ SCOLAIRE PREVIEW MODAL
          -------------------------------------------------------------------------- */}
      {showIdCardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl p-6 relative space-y-5 max-h-[95vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#1F4A59] text-white rounded-2xl shadow-sm">
                  <CreditCard className="w-6 h-6 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Carte d'Identité Scolaire
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Format Badge Standard
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Badge officiel de l'élève avec photo, matricule et QR Code de sécurité
                  </p>
                </div>
              </div>

              {/* Side toggle */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl text-xs font-bold">
                <button
                  onClick={() => setCardSide('both')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${cardSide === 'both' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  Recto + Verso
                </button>
                <button
                  onClick={() => setCardSide('recto')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${cardSide === 'recto' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  Recto seul
                </button>
                <button
                  onClick={() => setCardSide('verso')}
                  className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${cardSide === 'verso' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                >
                  Verso seul
                </button>
              </div>
            </div>

            {/* Visual Preview Container */}
            <div className="py-4 bg-slate-100 dark:bg-slate-900/60 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-center gap-6 overflow-x-auto">
              
              {/* RECTO */}
              {(cardSide === 'both' || cardSide === 'recto') && (
                <div className="relative w-[340px] h-[215px] bg-gradient-to-br from-[#1F4A59] via-[#245769] to-[#12313b] text-white rounded-2xl p-4 shadow-xl border-2 border-sky-400/40 flex flex-col justify-between shrink-0 transform transition-transform hover:scale-102">
                  {/* Top Bar */}
                  <div className="flex justify-between items-center pb-2 border-b border-white/20">
                    <div className="flex items-center gap-2">
                      {schoolSettings?.logo ? (
                        <img src={schoolSettings.logo} alt="Logo" className="w-7 h-7 object-contain rounded bg-white/10 p-0.5" />
                      ) : (
                        <div className="w-7 h-7 bg-amber-400 text-slate-900 rounded font-black text-xs flex items-center justify-center shadow-xs">
                          ED
                        </div>
                      )}
                      <div className="leading-tight">
                        <h4 className="text-[10px] font-black uppercase tracking-tight text-amber-300 truncate max-w-[170px]">
                          {schoolSettings?.name || 'EDUCO SCHOOL'}
                        </h4>
                        <p className="text-[8px] font-bold uppercase tracking-widest text-sky-200">Carte d'Identité Scolaire</p>
                      </div>
                    </div>

                    <span className="text-[8px] font-black uppercase text-amber-300 bg-black/40 px-2 py-0.5 rounded-md border border-amber-300/30">
                      {academicYear}
                    </span>
                  </div>

                  {/* Body: Photo & Info */}
                  <div className="flex items-center gap-3 my-auto">
                    <div className="relative shrink-0">
                      <img 
                        src={currentAvatar || 'https://via.placeholder.com/150'} 
                        alt={student.name}
                        className="w-18 h-20 rounded-xl object-cover border-2 border-amber-300 shadow-md" 
                      />
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                    </div>

                    <div className="space-y-1 text-left min-w-0 flex-1">
                      <p className="text-[8px] font-bold text-amber-200 uppercase tracking-wider">Élève :</p>
                      <h5 className="font-black text-xs leading-tight truncate text-white uppercase">{student.name}</h5>

                      <div className="text-[9px] space-y-0.5 pt-0.5">
                        <p><span className="text-sky-200 font-medium">Classe : </span><strong className="text-white font-bold">{student.class || 'N/A'}</strong></p>
                        <p><span className="text-sky-200 font-medium">Né(e) le : </span><strong className="text-white font-semibold">{student.dob ? new Date(student.dob).toLocaleDateString('fr-FR') : 'N/A'}</strong></p>
                        <p className="font-mono text-amber-300 font-black text-[9px] pt-0.5">MAT : {matricule}</p>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white p-1.5 rounded-lg shrink-0 shadow-inner">
                      <QRCodeSVG value={qrData} size={54} level="M" />
                    </div>
                  </div>

                  {/* Bottom footer */}
                  <div className="flex justify-between items-center pt-1.5 border-t border-white/20 text-[8px] text-sky-100/90 font-medium">
                    <span>Élève Régulier • Carte Officielle</span>
                    <span className="font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" /> Direction
                    </span>
                  </div>
                </div>
              )}

              {/* VERSO */}
              {(cardSide === 'both' || cardSide === 'verso') && (
                <div className="relative w-[340px] h-[215px] bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl p-4 shadow-xl border-2 border-slate-300 dark:border-slate-600 flex flex-col justify-between shrink-0 transform transition-transform hover:scale-102">
                  {/* Back Top */}
                  <div className="pb-1.5 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center text-[8px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    <span>Conditions d'Utilisation & Urgence</span>
                    <span className="font-mono text-[#1F4A59] dark:text-sky-400">ID: {matricule}</span>
                  </div>

                  {/* Back Content */}
                  <div className="space-y-2 my-auto text-[8px] text-slate-600 dark:text-slate-300 leading-tight">
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 p-2 rounded-xl">
                      <p className="font-bold text-amber-900 dark:text-amber-300 uppercase text-[7.5px] mb-0.5">Contact d'Urgence :</p>
                      <p className="truncate"><strong>Tuteur :</strong> {student.guardian || student.fatherName || 'Parent de l\'élève'}</p>
                      <p className="font-mono font-bold text-slate-900 dark:text-white"><strong>Tél :</strong> {student.contact || student.fatherPhone || student.motherPhone || 'N/A'}</p>
                    </div>

                    <div className="text-[7.5px] text-slate-500 dark:text-slate-400 space-y-0.5">
                      <p>• Cette carte est strictement personnelle et non cessible.</p>
                      <p>• Obligatoire pour le contrôle aux entrées et examens.</p>
                      <p>• En cas de perte, avertir sans délai le secrétariat.</p>
                    </div>
                  </div>

                  {/* Back Footer */}
                  <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center text-[7.5px] text-slate-500 dark:text-slate-400">
                    <div>
                      <p className="font-bold uppercase text-slate-800 dark:text-slate-200">{schoolSettings?.name}</p>
                      <p>{schoolSettings?.contact || 'Tél: +229 00 00 00 00'}</p>
                    </div>
                    <div className="text-right">
                      <div className="w-20 h-5 border-b border-slate-300 dark:border-slate-600 italic text-[6.5px] text-slate-400 flex items-end justify-center">
                        Cachet & Signature
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Format haute définition optimisé pour imprimantes à badges ou impression papier</span>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={handlePrintIdCard}
                  className="flex-1 sm:flex-initial py-2.5 px-5 bg-[#1F4A59] hover:bg-[#275d70] text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-98"
                >
                  <Printer className="w-4 h-4 text-amber-300" />
                  <span>Imprimer la Carte d'Identité</span>
                </button>

                <button
                  onClick={() => setShowIdCardModal(false)}
                  className="py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* QR Code Pass Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-fade-in no-print">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md p-6 relative space-y-5 overflow-hidden">
            
            {/* Top header badge */}
            <div className="text-center space-y-1">
              <div className="inline-flex p-3 bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 rounded-2xl mb-1">
                <QrCode className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Pass Digital & Badge QR Code</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Code unique pour contrôle d'accès aux entrées/sorties et paiements express
              </p>
            </div>

            {/* Printable ID Card Display */}
            <div className="bg-gradient-to-br from-[#1F4A59] via-[#285d70] to-[#1F4A59] text-white p-5 rounded-2xl shadow-lg border border-sky-400/30 space-y-4 relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-white/20">
                <div>
                  <h4 className="text-sm font-black tracking-wide text-amber-300 uppercase">{schoolSettings?.name || 'EDUCO SCHOOL'}</h4>
                  <p className="text-[10px] text-sky-100/80 uppercase font-semibold tracking-wider">Pass Officiel Élève</p>
                </div>
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>

              <div className="flex items-center gap-4">
                <img 
                  src={currentAvatar || 'https://via.placeholder.com/150'} 
                  alt={student.name}
                  className="w-20 h-20 rounded-xl object-cover border-2 border-white/50 shadow-md shrink-0" 
                />
                <div className="space-y-1 text-left min-w-0 flex-1">
                  <h5 className="font-extrabold text-base leading-tight truncate text-white">{student.name}</h5>
                  <p className="text-xs text-sky-200 font-semibold">Classe : {student.class || 'Non assignée'}</p>
                  <p className="text-[11px] font-mono text-amber-300 font-bold">Matricule : {matricule}</p>
                </div>
              </div>

              {/* Central QR Code SVG */}
              <div className="bg-white p-4 rounded-xl flex items-center justify-center shadow-inner my-2">
                <QRCodeSVG value={qrData} size={160} level="H" includeMargin />
              </div>

              <div className="text-center text-[10px] text-sky-100/70 font-semibold">
                Présentez ce QR Code au scanner de l'établissement à l'entrée ou au guichet de caisse.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                onClick={handlePrintQrBadge}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer Carte ID</span>
              </button>

              <button
                onClick={() => setShowQrModal(false)}
                className="py-2.5 px-5 bg-[#1F4A59] hover:bg-[#285d70] text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Fermer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Student Photo Modal */}
      <StudentPhotoCaptureModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onPhotoCaptured={handlePhotoCaptured}
        currentPhoto={currentAvatar}
        studentName={student.name}
      />

      {/* Delete Student Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Confirmation de suppression - Élève"
        itemType="l'élève"
        itemName={student.name}
        itemDetails={`Classe : ${student.class || 'N/A'} • Matricule : ${matricule}`}
        warningNote="Attention : La suppression de cet élève supprimera définitivement son dossier scolaire, ses notes, son assiduité et son historique de paiements. Cette action est irréversible."
        confirmText="Supprimer l'élève"
        cancelText="Annuler"
      />
    </div>
  );
};

export default StudentProfilePage;
