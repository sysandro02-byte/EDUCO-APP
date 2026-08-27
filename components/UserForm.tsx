import React, { useState, useEffect } from 'react';
import { USER_ROLES } from '../constants';
import { Class } from './ClassForm';
import { Fee } from './FeeForm';
import { 
  Camera, 
  Trash2, 
  User as UserIcon, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  UserCheck, 
  GraduationCap, 
  Users, 
  FileText, 
  Sparkles,
  Phone,
  Mail,
  MapPin,
  Calendar,
  AlertCircle,
  Building,
  HeartPulse,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import StudentPhotoCaptureModal from './StudentPhotoCaptureModal';
import { LoadingDots } from './LoadingDots';

// Enhanced type for the user object supporting comprehensive student & parent info
export interface User {
  id: number | null;
  name: string;
  email: string;
  role: string;
  status: string;
  password?: string;
  tempPassword?: string;
  studentId?: string;
  studentName?: string;
  dob?: string;
  birthPlace?: string;
  gender?: string;
  contact?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  nationality?: string;
  class?: string;
  previousClass?: string;
  registrationType?: string;
  previousSchool?: string;
  familyId?: number;
  avatar?: string;
  isBilingual?: boolean;
  isFormerStudent?: boolean;
  regime?: string;
  transportRequired?: boolean;
  parentName?: string;
  parentPhone?: string;
  guardian?: string;
  guardianPhone?: string;
  guardianRelation?: string;
  fatherName?: string;
  fatherPhone?: string;
  fatherJob?: string;
  fatherEmail?: string;
  motherName?: string;
  motherPhone?: string;
  motherJob?: string;
  motherEmail?: string;
  emergencyContact?: string;
  bloodGroup?: string;
  medicalNotes?: string;
  isAccountActivated?: boolean;
  activatedBy?: string;
  activatedAt?: string;
  enrollmentType?: string;
  schoolId?: number;
  matricule?: string;
}

interface UserFormProps {
  user: User | null;
  onSave: (user: User) => void;
  onCancel: () => void;
  defaultRole?: string;
  currentUserRole?: string;
  isLicenseActive?: boolean;
  onOpenSubscriptionModal?: () => void;
  classes: Class[];
  fees: Fee[];
  schoolSettings?: { name?: string; id?: number };
}

const UserForm: React.FC<UserFormProps> = ({ 
  user, 
  onSave, 
  onCancel, 
  defaultRole, 
  currentUserRole, 
  isLicenseActive = true,
  onOpenSubscriptionModal,
  classes, 
  fees,
  schoolSettings
}) => {
  const getAllowedRoles = () => {
    if (currentUserRole === 'Admin') {
      return [
        'Co-admin',
        'Promoteur',
        'Directeur Général',
        'Directeur des Etudes',
        'Directeur du Primaire',
        'Responsable des finances',
        'Surveillant Général',
        'Surveillant Général Adjoint',
        'Caissière',
        'Enseignant',
        'Élève',
        'Parent'
      ];
    }
    if (currentUserRole === 'Co-admin') {
      return [
        'Promoteur',
        'Directeur Général',
        'Directeur des Etudes',
        'Directeur du Primaire',
        'Responsable des finances',
        'Surveillant Général',
        'Surveillant Général Adjoint',
        'Caissière',
        'Enseignant',
        'Élève',
        'Parent'
      ];
    }
    if (currentUserRole === 'Promoteur') {
      // 1) En Mode Licence Non Activée : le compte promoteur aura droit de: creer que le compte caissier et inscrire des élèves.
      if (!isLicenseActive) {
        return [
          'Caissière',
          'Élève'
        ];
      }
      return [
        'Directeur Général',
        'Directeur des Etudes',
        'Directeur du Primaire',
        'Responsable des finances',
        'Surveillant Général',
        'Surveillant Général Adjoint',
        'Caissière',
        'Enseignant',
        'Élève',
        'Parent'
      ];
    }
    if (currentUserRole === 'Caissière') {
      return ['Élève'];
    }
    if (currentUserRole === 'Responsable des finances' || currentUserRole === 'Directeur Général') {
      return [
        'Élève',
        'Caissière',
        'Enseignant',
        'Parent',
        'Directeur des Etudes',
        'Surveillant Général',
        'Surveillant Général Adjoint'
      ];
    }
    return [
      'Élève'
    ];
  };

  const allowedRoles = getAllowedRoles();

  const getInitialFormData = (): User => ({
    id: null,
    name: '',
    email: '',
    role: defaultRole && allowedRoles.includes(defaultRole) ? defaultRole : (allowedRoles[0] || 'Élève'),
    status: 'Actif',
    password: '',
    tempPassword: '',
    studentId: '',
    dob: '',
    birthPlace: '',
    gender: 'Masculin',
    contact: '',
    address: '',
    postalCode: '',
    city: 'Brazzaville',
    nationality: 'Congolaise',
    class: classes.length > 0 ? classes[0].name : '',
    previousClass: '',
    registrationType: 'Inscription',
    previousSchool: '',
    isBilingual: false,
    isFormerStudent: false,
    regime: 'Externe',
    transportRequired: false,
    guardian: '',
    guardianPhone: '',
    guardianRelation: 'Tuteur légal',
    fatherName: '',
    fatherPhone: '',
    fatherJob: '',
    fatherEmail: '',
    motherName: '',
    motherPhone: '',
    motherJob: '',
    motherEmail: '',
    emergencyContact: '',
    bloodGroup: '',
    medicalNotes: '',
    avatar: '',
  });

  const [formData, setFormData] = useState<User>(getInitialFormData());
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pwd = 'Educo@';
    for (let i = 0; i < 4; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, password: pwd, tempPassword: pwd }));
    setFormErrors(prev => {
      const next = { ...prev };
      delete next.password;
      return next;
    });
  };

  const isStudent = formData.role === 'Élève';

  const getSchoolAcronym = () => {
    const words = String(schoolSettings?.name || 'EDUCO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[A-Za-z0-9]+/g) || [];
    const acronym = words.length > 1 ? words.map(word => word[0]).join('') : (words[0] || 'EDUCO').slice(0, 5);
    return acronym.toUpperCase().slice(0, 6) || 'EDUCO';
  };

  // Steps definition
  const studentSteps = [
    { number: 1, title: 'Informations personnelles', subtitle: 'Identité & Coordonnées', icon: UserIcon },
    { number: 2, title: 'Informations scolaires', subtitle: 'Classe, Matricule & Options', icon: GraduationCap },
    { number: 3, title: 'Informations parents', subtitle: 'Filiation & Contacts Tuteurs', icon: Users },
    { number: 4, title: 'Récapitulatif', subtitle: 'Vérification & Validation', icon: FileText },
  ];

  const staffSteps = [
    { number: 1, title: 'Informations personnelles', subtitle: 'Identité & Contact', icon: UserIcon },
    { number: 2, title: 'Rôle & Affectation', subtitle: 'Poste & Autorisations', icon: Building },
    { number: 3, title: 'Récapitulatif', subtitle: 'Vérification & Validation', icon: FileText },
  ];

  const steps = isStudent ? studentSteps : staffSteps;
  const totalSteps = steps.length;

  useEffect(() => {
    if (user) {
      setFormData({
        ...getInitialFormData(),
        ...user,
        name: user.name || '',
        email: user.email || '',
        studentId: user.studentId || '',
        birthPlace: user.birthPlace || '',
        dob: user.dob || '',
        contact: user.contact || '',
        address: user.address || '',
        postalCode: user.postalCode || '',
        city: user.city || 'Brazzaville',
        nationality: user.nationality || 'Congolaise',
        class: user.class || (classes.length > 0 ? classes[0].name : ''),
        previousClass: user.previousClass || '',
        previousSchool: user.previousSchool || '',
        guardian: user.guardian || '',
        guardianPhone: user.guardianPhone || '',
        guardianRelation: user.guardianRelation || 'Tuteur légal',
        fatherName: user.fatherName || '',
        fatherPhone: user.fatherPhone || '',
        fatherJob: user.fatherJob || '',
        fatherEmail: user.fatherEmail || '',
        motherName: user.motherName || '',
        motherPhone: user.motherPhone || '',
        motherJob: user.motherJob || '',
        motherEmail: user.motherEmail || '',
        emergencyContact: user.emergencyContact || '',
        bloodGroup: user.bloodGroup || '',
        medicalNotes: user.medicalNotes || '',
        avatar: user.avatar || '',
        isBilingual: !!user.isBilingual,
        isFormerStudent: !!user.isFormerStudent,
        regime: user.regime || 'Externe',
        transportRequired: !!user.transportRequired,
      });
    } else {
      setFormData(getInitialFormData());
    }
    setCurrentStep(1);
    setFormErrors({});
  }, [user, defaultRole]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const generateStudentId = () => {
    const year = new Date().getFullYear();
    const randomNum = String(Math.floor(Math.random() * 900) + 100);
    const prefix = formData.class ? formData.class.substring(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, '') : 'GSMT';
    const newId = `${prefix}-${year}-MAT-${randomNum}`;
    setFormData(prev => ({ ...prev, studentId: newId }));
    if (formErrors.studentId) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next.studentId;
        return next;
      });
    }
  };

  const validateStep = (stepNumber: number): boolean => {
    const errors: { [key: string]: string } = {};

    if (stepNumber === 1) {
      if (!formData.name.trim()) {
        errors.name = "Le nom complet est obligatoire";
      }
      if (!isStudent && !formData.email.trim()) {
        errors.email = "L'adresse email est requise pour le personnel";
      }
    } else if (stepNumber === 2 && isStudent) {
      if (!formData.class) {
        errors.class = "Veuillez sélectionner une classe";
      }
      if (!formData.studentId) {
        errors.studentId = "Le matricule est requis (vous pouvez le générer)";
      }
    } else if (stepNumber === 3 && isStudent) {
      if (!formData.fatherPhone && !formData.motherPhone && !formData.contact && !formData.guardianPhone) {
        errors.contact = "Veuillez renseigner au moins un numéro de contact pour les parents/tuteurs";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < totalSteps) {
        setCurrentStep(prev => prev + 1);
      }
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateStep(1) && (isStudent ? validateStep(2) && validateStep(3) : true)) {
      setIsSubmitting(true);
      // Auto-generate email if missing for students
      const finalData = { ...formData };
      if (!isStudent && !finalData.id && !finalData.matricule) {
        finalData.matricule = `${getSchoolAcronym()}-EMP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      }
      if (!finalData.email && finalData.studentId) {
        const cleanName = finalData.name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
        finalData.email = `${cleanName || 'eleve'}@ecole-educo.cg`;
      } else if (!finalData.email) {
        finalData.email = `user.${Date.now()}@ecole-educo.cg`;
      }
      try {
        await onSave(finalData);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const formFieldClass = "mt-1 block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 py-2.5 px-3.5 text-xs font-medium shadow-2xs focus:border-[#1F4A59] focus:ring-2 focus:ring-[#1F4A59]/20 transition-all";
  const labelClass = "block text-xs font-bold text-slate-700 dark:text-slate-300 mb-0.5";

  // Calculate progress percentage
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  return (
    <>
      <div className="space-y-6 max-h-[82vh] overflow-y-auto pr-1">
        
        {/* ========================================================================= */}
        {/* STEPPER / PROGRESS BAR                                                    */}
        {/* ========================================================================= */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-[#1F4A59] dark:text-sky-400">
                Étape {currentStep} sur {totalSteps}
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {steps[currentStep - 1]?.title}
              </h3>
            </div>
            <span className="text-xs font-black text-slate-600 dark:text-slate-300 font-mono bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
              {progressPercent}% complété
            </span>
          </div>

          {/* Linear Progress Bar */}
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-4">
            <div 
              className="bg-[#1F4A59] dark:bg-sky-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Stepper Nodes */}
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {steps.map((step) => {
              const Icon = step.icon;
              const isPassed = currentStep > step.number;
              const isCurrent = currentStep === step.number;

              return (
                <button
                  key={step.number}
                  type="button"
                  onClick={() => {
                    if (isPassed || step.number <= currentStep) {
                      setCurrentStep(step.number);
                    }
                  }}
                  className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all ${
                    isCurrent
                      ? 'bg-white dark:bg-slate-900 border-2 border-[#1F4A59] dark:border-sky-400 shadow-xs'
                      : isPassed
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/60 cursor-pointer'
                      : 'bg-slate-100/50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 text-slate-400 opacity-70 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${
                    isCurrent
                      ? 'bg-[#1F4A59] text-white'
                      : isPassed
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                  }`}>
                    {isPassed ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <p className={`text-[11px] font-black truncate ${isCurrent ? 'text-[#1F4A59] dark:text-sky-300' : 'text-slate-700 dark:text-slate-300'}`}>
                      {step.title}
                    </p>
                    <p className="text-[9px] text-slate-400 truncate">{step.subtitle}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Banner Mode Licence Non Activée pour le Promoteur */}
          {currentUserRole === 'Promoteur' && !isLicenseActive && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-300 dark:border-amber-700 flex items-start gap-3 text-xs">
              <div className="p-1.5 bg-amber-200/70 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded-lg shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="font-extrabold text-amber-950 dark:text-amber-100">
                    Mode Licence Non Activée
                  </h4>
                  {onOpenSubscriptionModal && (
                    <button
                      type="button"
                      onClick={onOpenSubscriptionModal}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] cursor-pointer"
                    >
                      Acheter code d'abonnement
                    </button>
                  )}
                </div>
                <p className="mt-1 text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                  En tant que Promoteur sans licence active, vous êtes autorisé à <strong>créer le compte Caissière</strong> et à <strong>inscrire des élèves</strong>. Pour déverrouiller l'accès complet à tous les modules (Notes, Comptabilité, Trésorerie) et créer les autres comptes de personnel, vous devez activer votre code d'abonnement.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 1 : INFORMATIONS PERSONNELLES                                      */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Photo & Identity Section */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-24 h-28 rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0 shadow-inner group">
                  {formData.avatar ? (
                    <img src={formData.avatar} alt="Photo élève" className="w-full h-full object-cover" />
                  ) : (
                    <UserIcon className="w-10 h-10 text-slate-400" />
                  )}
                </div>

                <div className="flex-1 space-y-2 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                      Photo d'identité / Badge Scolaire
                    </h4>
                    <span className="text-[10px] bg-[#1F4A59]/10 text-[#1F4A59] dark:text-sky-300 font-bold px-2 py-0.5 rounded-md">
                      Format officiel
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Prenez une photo en direct via la caméra ou chargez un fichier numérique pour le badge et les dossiers.
                  </p>
                  
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsPhotoModalOpen(true)}
                      className="px-3.5 py-1.5 bg-[#1F4A59] hover:bg-[#285d70] text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{formData.avatar ? "Changer la Photo" : "Prendre / Insérer Photo"}</span>
                    </button>

                    {formData.avatar && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, avatar: '' }))}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Rôle & Statut (pour le personnel ou modifiable par l'admin/promoteur) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="role" className={labelClass}>Rôle dans l'établissement *</label>
                  <select
                    id="role"
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    className={formFieldClass}
                  >
                    {allowedRoles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="status" className={labelClass}>Statut du compte</label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className={formFieldClass}
                  >
                    <option value="Actif">Actif</option>
                    <option value="Inactif">Inactif / En attente</option>
                    <option value="Suspendu">Suspendu</option>
                  </select>
                </div>
              </div>

              {/* Nom complet & Sexe */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="name" className={labelClass}>Nom de famille & Prénoms complets *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ex: MBOUNGOU Jean-Marc"
                    className={`${formFieldClass} ${formErrors.name ? 'border-rose-500 focus:ring-rose-200' : ''}`}
                    required
                  />
                  {formErrors.name && <p className="text-[10px] text-rose-600 font-bold mt-1">{formErrors.name}</p>}
                </div>

                <div>
                  <span className={labelClass}>Sexe</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, gender: 'Masculin' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                        formData.gender === 'Masculin'
                          ? 'bg-[#1F4A59] text-white border-[#1F4A59]'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      Masculin
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, gender: 'Féminin' }))}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border text-center transition-all cursor-pointer ${
                        formData.gender === 'Féminin'
                          ? 'bg-[#1F4A59] text-white border-[#1F4A59]'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      Féminin
                    </button>
                  </div>
                </div>
              </div>

              {/* Date & Lieu de Naissance + Nationalité */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="dob" className={labelClass}>Date de naissance</label>
                  <input
                    type="date"
                    id="dob"
                    name="dob"
                    value={formData.dob}
                    onChange={handleChange}
                    className={formFieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="birthPlace" className={labelClass}>Lieu de naissance</label>
                  <input
                    type="text"
                    id="birthPlace"
                    name="birthPlace"
                    value={formData.birthPlace}
                    onChange={handleChange}
                    placeholder="Ex: Brazzaville, Talangaï"
                    className={formFieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="nationality" className={labelClass}>Nationalité</label>
                  <input
                    type="text"
                    id="nationality"
                    name="nationality"
                    value={formData.nationality}
                    onChange={handleChange}
                    placeholder="Ex: Congolaise"
                    className={formFieldClass}
                  />
                </div>
              </div>

              {/* Adresse & Ville */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="address" className={labelClass}>Adresse de résidence</label>
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="Ex: 45 Rue Mbama, Moungali"
                    className={formFieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="city" className={labelClass}>Ville / Commune</label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Brazzaville"
                    className={formFieldClass}
                  />
                </div>
              </div>

              {/* Email & Contact personnel */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="contact" className={labelClass}>Numéro de Téléphone principal</label>
                  <input
                    type="tel"
                    id="contact"
                    name="contact"
                    value={formData.contact}
                    onChange={handleChange}
                    placeholder="Ex: +242 06 123 4567"
                    className={formFieldClass}
                  />
                </div>

                <div>
                  <label htmlFor="email" className={labelClass}>
                    {isStudent ? "Email élève / compte (optionnel)" : "Email professionnel *"}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder={isStudent ? "jean.mboungou@ecole.cg" : "enseignant@ecole.cg"}
                    className={`${formFieldClass} ${formErrors.email ? 'border-rose-500' : ''}`}
                    required={!isStudent}
                  />
                  {formErrors.email && <p className="text-[10px] text-rose-600 font-bold mt-1">{formErrors.email}</p>}
                </div>
              </div>

              {/* Attribution du Mot de passe par le Promoteur/Admin */}
              <div className="p-4 bg-sky-50/70 dark:bg-slate-800/80 border border-sky-200 dark:border-slate-700 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#1F4A59] text-white flex items-center justify-center text-xs font-black shadow-xs">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        Attribution du Mot de Passe de Connexion
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Définissez le mot de passe initial de connexion pour ce compte.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="px-3 py-1.5 bg-[#1F4A59] hover:bg-[#153540] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer transition-colors shadow-xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Générer un mot de passe</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password || ''}
                    onChange={handleChange}
                    placeholder="Ex: Educo@2026! (ou saisissez un mot de passe personnalisé)"
                    className={`${formFieldClass} pr-24 font-mono text-xs font-bold`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline flex items-center gap-1 cursor-pointer bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Masquer</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Afficher</span>
                      </>
                    )}
                  </button>
                </div>
                {formData.password && (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Mot de passe assigné : <strong className="font-mono bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">{formData.password}</strong>
                    </span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 2 : INFORMATIONS SCOLAIRES (POUR ÉLÈVE)                             */}
          {/* ========================================================================= */}
          {currentStep === 2 && isStudent && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Classe & Matricule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="class" className={labelClass}>Classe / Section d'affectation *</label>
                  <select
                    id="class"
                    name="class"
                    value={formData.class}
                    onChange={handleChange}
                    required
                    className={`${formFieldClass} ${formErrors.class ? 'border-rose-500' : ''}`}
                  >
                    <option value="" disabled>-- Choisir une classe --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  {formErrors.class && <p className="text-[10px] text-rose-600 font-bold mt-1">{formErrors.class}</p>}
                </div>

                <div>
                  <label htmlFor="studentId" className={labelClass}>N° Matricule Scolaire Unique *</label>
                  <div className="flex mt-1">
                    <input
                      type="text"
                      id="studentId"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleChange}
                      placeholder="GSMT-2026-MAT-101"
                      className="block w-full rounded-l-xl border-r-0 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 py-2.5 px-3 text-xs font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={generateStudentId}
                      className="px-3.5 py-2.5 bg-[#1F4A59] hover:bg-[#285d70] text-white rounded-r-xl text-xs font-black whitespace-nowrap flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Générer</span>
                    </button>
                  </div>
                  {formErrors.studentId && <p className="text-[10px] text-rose-600 font-bold mt-1">{formErrors.studentId}</p>}
                </div>
              </div>

              {/* Type d'inscription & Régime */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="registrationType" className={labelClass}>Type d'inscription</label>
                  <select
                    id="registrationType"
                    name="registrationType"
                    value={formData.registrationType}
                    onChange={handleChange}
                    className={formFieldClass}
                  >
                    <option value="Inscription">Nouvelle Inscription (Nouveau)</option>
                    <option value="Réinscription">Réinscription (Ancien de l'école)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="regime" className={labelClass}>Régime de présence</label>
                  <select
                    id="regime"
                    name="regime"
                    value={formData.regime}
                    onChange={handleChange}
                    className={formFieldClass}
                  >
                    <option value="Externe">Externe (Cours uniquement)</option>
                    <option value="Demi-pensionnaire">Demi-pensionnaire (Cantine scolaire)</option>
                    <option value="Interne">Interne (Pension complète)</option>
                  </select>
                </div>
              </div>

              {/* Antécédents scolaires */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Établissement & Scolarité Antérieure
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="previousSchool" className={labelClass}>École précédente / Origine</label>
                    <input
                      type="text"
                      id="previousSchool"
                      name="previousSchool"
                      value={formData.previousSchool}
                      onChange={handleChange}
                      placeholder="Ex: École Publique de Moungali"
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="previousClass" className={labelClass}>Classe antérieure</label>
                    <input
                      type="text"
                      id="previousClass"
                      name="previousClass"
                      value={formData.previousClass}
                      onChange={handleChange}
                      placeholder="Ex: CM2"
                      className={formFieldClass}
                    />
                  </div>
                </div>
              </div>

              {/* Options & Programmes spécifiques */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Options Pédagogiques & Services
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-sky-400 transition-all">
                    <input
                      type="checkbox"
                      name="isBilingual"
                      checked={formData.isBilingual}
                      onChange={handleCheckboxChange}
                      className="mt-0.5 rounded text-[#1F4A59] focus:ring-[#1F4A59]"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">Programme Bilingue (Français/Anglais)</span>
                      <p className="text-[10px] text-slate-500">Renforcement immersif dès le primaire</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-sky-400 transition-all">
                    <input
                      type="checkbox"
                      name="transportRequired"
                      checked={formData.transportRequired}
                      onChange={handleCheckboxChange}
                      className="mt-0.5 rounded text-[#1F4A59] focus:ring-[#1F4A59]"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">Transport Scolaire / Bus</span>
                      <p className="text-[10px] text-slate-500">Service de ramassage aller-retour</p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-sky-400 transition-all sm:col-span-2">
                    <input
                      type="checkbox"
                      name="isFormerStudent"
                      checked={formData.isFormerStudent}
                      onChange={handleCheckboxChange}
                      className="mt-0.5 rounded text-[#1F4A59] focus:ring-[#1F4A59]"
                    />
                    <div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100">Ancien élève réinscrit</span>
                      <p className="text-[10px] text-slate-500">Déjà enregistré dans l'historique scolaire de l'établissement</p>
                    </div>
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 2 POUR LE PERSONNEL (Rôle & Affectation)                            */}
          {/* ========================================================================= */}
          {currentStep === 2 && !isStudent && (
            <div className="space-y-5 animate-fadeIn">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Affectation & Informations Professionnelles
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="class" className={labelClass}>Classe / Section assignée (si applicable)</label>
                    <select
                      id="class"
                      name="class"
                      value={formData.class}
                      onChange={handleChange}
                      className={formFieldClass}
                    >
                      <option value="">-- Aucune / Toutes les classes --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="studentId" className={labelClass}>Matricule Employé / Code Enseignant</label>
                    <input
                      type="text"
                      id="studentId"
                      name="studentId"
                      value={formData.studentId}
                      onChange={handleChange}
                      placeholder="ENS-2026-008"
                      className={formFieldClass}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE 3 : INFORMATIONS PARENTS & TUTEURS (POUR ÉLÈVE)                     */}
          {/* ========================================================================= */}
          {currentStep === 3 && isStudent && (
            <div className="space-y-5 animate-fadeIn">
              
              {/* Père */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-100 dark:bg-sky-900/60 text-[#1F4A59] dark:text-sky-300 flex items-center justify-center text-xs font-bold">
                    P
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Informations du Père
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="fatherName" className={labelClass}>Nom complet du père</label>
                    <input
                      type="text"
                      id="fatherName"
                      name="fatherName"
                      value={formData.fatherName}
                      onChange={handleChange}
                      placeholder="Ex: MBOUNGOU Michel"
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="fatherPhone" className={labelClass}>Téléphone / WhatsApp</label>
                    <input
                      type="tel"
                      id="fatherPhone"
                      name="fatherPhone"
                      value={formData.fatherPhone}
                      onChange={handleChange}
                      placeholder="Ex: +242 06 600 1122"
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="fatherJob" className={labelClass}>Profession / Fonction</label>
                    <input
                      type="text"
                      id="fatherJob"
                      name="fatherJob"
                      value={formData.fatherJob}
                      onChange={handleChange}
                      placeholder="Ex: Ingénieur Télécoms"
                      className={formFieldClass}
                    />
                  </div>
                </div>
              </div>

              {/* Mère */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center text-xs font-bold">
                    M
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Informations de la Mère
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="motherName" className={labelClass}>Nom complet de la mère</label>
                    <input
                      type="text"
                      id="motherName"
                      name="motherName"
                      value={formData.motherName}
                      onChange={handleChange}
                      placeholder="Ex: LOUBOU Clarisse"
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="motherPhone" className={labelClass}>Téléphone / WhatsApp</label>
                    <input
                      type="tel"
                      id="motherPhone"
                      name="motherPhone"
                      value={formData.motherPhone}
                      onChange={handleChange}
                      placeholder="Ex: +242 05 500 3344"
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="motherJob" className={labelClass}>Profession / Fonction</label>
                    <input
                      type="text"
                      id="motherJob"
                      name="motherJob"
                      value={formData.motherJob}
                      onChange={handleChange}
                      placeholder="Ex: Médecin"
                      className={formFieldClass}
                    />
                  </div>
                </div>
              </div>

              {/* Tuteur & Contact d'urgence */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 flex items-center justify-center text-xs font-bold">
                    T
                  </div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                    Tuteur Légal & Contact d'Urgence
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="guardian" className={labelClass}>Nom du tuteur (si différent)</label>
                    <input
                      type="text"
                      id="guardian"
                      name="guardian"
                      value={formData.guardian}
                      onChange={handleChange}
                      placeholder="Ex: Oncle / Tante"
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="guardianPhone" className={labelClass}>Téléphone Tuteur</label>
                    <input
                      type="tel"
                      id="guardianPhone"
                      name="guardianPhone"
                      value={formData.guardianPhone}
                      onChange={handleChange}
                      placeholder="Ex: +242 06 999 8877"
                      className={formFieldClass}
                    />
                  </div>

                  <div>
                    <label htmlFor="emergencyContact" className={labelClass}>Contact Urgence Prioritaire</label>
                    <input
                      type="tel"
                      id="emergencyContact"
                      name="emergencyContact"
                      value={formData.emergencyContact}
                      onChange={handleChange}
                      placeholder="Ex: +242 06 123 0000"
                      className={formFieldClass}
                    />
                  </div>
                </div>

                {/* Remarques médicales & Groupe sanguin */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label htmlFor="bloodGroup" className={labelClass}>Groupe Sanguin</label>
                    <select
                      id="bloodGroup"
                      name="bloodGroup"
                      value={formData.bloodGroup}
                      onChange={handleChange}
                      className={formFieldClass}
                    >
                      <option value="">Non renseigné</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="medicalNotes" className={labelClass}>Allergies / Particularités médicales</label>
                    <input
                      type="text"
                      id="medicalNotes"
                      name="medicalNotes"
                      value={formData.medicalNotes}
                      onChange={handleChange}
                      placeholder="Ex: Asthme léger, allergie aux arachides"
                      className={formFieldClass}
                    />
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* ÉTAPE FINALE : RÉCAPITULATIF & VALIDATION                                 */}
          {/* ========================================================================= */}
          {((isStudent && currentStep === 4) || (!isStudent && currentStep === 3)) && (
            <div className="space-y-5 animate-fadeIn">
              
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase">
                    Fiche Dossier Prête pour Enregistrement
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                    Veuillez vérifier les informations ci-dessous avant d'enregistrer l'inscription dans la base de données.
                  </p>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                
                {/* Header with Photo & Name */}
                <div className="flex items-center gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                  <div className="w-16 h-18 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                    {formData.avatar ? (
                      <img src={formData.avatar} alt="Photo" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-8 h-8 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <span className="px-2 py-0.5 bg-[#1F4A59] text-white text-[10px] font-black rounded-md uppercase">
                      {formData.role}
                    </span>
                    <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                      {formData.name || 'Nom non spécifié'}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      Matricule : {formData.studentId || 'Non attribué'}
                    </p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Classe / Section</span>
                    <p className="font-black text-slate-800 dark:text-slate-100 mt-0.5">{formData.class || 'N/A'}</p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Date de Naissance & Sexe</span>
                    <p className="font-black text-slate-800 dark:text-slate-100 mt-0.5">
                      {formData.dob || 'N/A'} ({formData.gender})
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Régime & Inscription</span>
                    <p className="font-black text-slate-800 dark:text-slate-100 mt-0.5">
                      {formData.regime} • {formData.registrationType}
                    </p>
                  </div>

                  <div className="p-3 bg-sky-50/70 dark:bg-slate-900 rounded-xl border border-sky-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase text-sky-800 dark:text-sky-300">Mot de passe de connexion</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                      {formData.password ? formData.password : '(Généré automatiquement ou par défaut)'}
                    </p>
                  </div>

                  {isStudent && (
                    <>
                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Contact Père</span>
                        <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                          {formData.fatherName || 'Père'} : {formData.fatherPhone || 'Non renseigné'}
                        </p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Contact Mère</span>
                        <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                          {formData.motherName || 'Mère'} : {formData.motherPhone || 'Non renseigné'}
                        </p>
                      </div>

                      <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Options</span>
                        <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                          {formData.isBilingual ? '✓ Bilingue ' : ''}
                          {formData.transportRequired ? '✓ Transport ' : ''}
                          {!formData.isBilingual && !formData.transportRequired ? 'Standard' : ''}
                        </p>
                      </div>
                    </>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* NAVIGATION BUTTONS                                                        */}
          {/* ========================================================================= */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Étape précédente</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Annuler
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-[#1F4A59] hover:bg-[#285d70] text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer"
                >
                  <span>Continuer</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <span>Enregistrement en cours</span>
                      <LoadingDots />
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Enregistrer l'inscription</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        </form>
      </div>

      {/* Modal for Photo Capture / Photo Card Upload */}
      <StudentPhotoCaptureModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        onPhotoCaptured={(photoBase64) => {
          setFormData(prev => ({ ...prev, avatar: photoBase64 }));
        }}
        currentPhoto={formData.avatar}
        studentName={formData.name}
      />
    </>
  );
};

export default UserForm;
