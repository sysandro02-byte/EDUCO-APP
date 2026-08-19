import React, { useState, useEffect } from 'react';
import { LogoIcon } from './Icons';
import { getSupabaseClient, getStoredSupabaseConfig, isPlaceholderSupabaseUrl } from '../src/lib/supabase';
import { registerSchool } from '../src/services/api';
import { brevoEmailService } from '../src/services/brevoEmailService';
import WelcomeEmailModal from './WelcomeEmailModal';
import { 
  Building2, 
  UserCheck, 
  FileText, 
  Lock, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Upload, 
  AlertCircle, 
  ArrowLeft,
  ArrowRight,
  FileCheck,
  Shield,
  Sparkles,
  School,
  GraduationCap,
  KeyRound,
  RotateCw,
  Zap,
  Check,
  HelpCircle
} from 'lucide-react';

interface SchoolRegistrationPageProps {
  onBackToLogin: () => void;
}

// Define the structure for teaching levels
const teachingLevels = {
  garderie: { label: 'Garderie (Crèche)', classes: null },
  prescolaire: { label: 'Cycle Préscolaire (Maternelle)', classes: ['Petite Section', 'Moyenne Section', 'Grande Section'] },
  primaire: { label: 'Cycle Primaire', classes: ['CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2'] },
  secondaireCollege: { label: 'Cycle Secondaire: Collège', classes: ['6ème', '5ème', '4ème', '3ème'] },
  secondaireLycee: { label: 'Cycle Secondaire: Lycée', classes: ['Seconde', 'Première', 'Terminale'] },
};

// Initial state for levels
const getInitialLevelsState = () => {
  const state: { [key: string]: any } = {};
  for (const [cycleKey, cycleValue] of Object.entries(teachingLevels)) {
    if (cycleValue.classes) {
      state[cycleKey] = cycleValue.classes.reduce((acc, className) => {
        acc[className] = false;
        return acc;
      }, {} as { [key: string]: boolean });
    } else {
      state[cycleKey] = false;
    }
  }
  return state;
};

const STEPS = [
  { id: 1, title: 'Établissement', desc: 'Identité de l\'école', icon: Building2 },
  { id: 2, title: 'Cycles & Niveaux', desc: 'Classes proposées', icon: GraduationCap },
  { id: 3, title: 'Pièces Légales', desc: 'Agrément & Justificatifs', icon: FileCheck },
  { id: 4, title: 'Compte Promoteur', desc: 'Accès administrateur', icon: UserCheck },
  { id: 5, title: 'Vérification OTP', desc: 'Validation de sécurité', icon: KeyRound },
];

const SchoolRegistrationPage: React.FC<SchoolRegistrationPageProps> = ({ onBackToLogin }) => {
  const [currentStep, setCurrentStep] = useState(1);

  const [formData, setFormData] = useState({
    schoolName: '',
    schoolAddress: '',
    schoolPhone: '',
    schoolLevels: getInitialLevelsState(),
    creationDate: '',
    promoterName: '',
    promoterContact: '',
    adminEmail: '',
    adminPassword: '',
  });

  const [files, setFiles] = useState<{
    openingAuthorization: File | null;
    promoterId: File | null;
    statutes: File | null;
  }>({
    openingAuthorization: null,
    promoterId: null,
    statutes: null,
  });

  const [stepError, setStepError] = useState('');
  
  // OTP State
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(60);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Welcome Email Modal State
  const [showWelcomeEmail, setShowWelcomeEmail] = useState(false);
  const [createdSchoolIdentifier, setCreatedSchoolIdentifier] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setStepError('');
  };

  const handleLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked, dataset } = e.target;
    const cycle = dataset.cycle as string;

    setFormData(prev => {
      const newLevels = { ...prev.schoolLevels };
      if (cycle === 'garderie') {
        (newLevels as any)[cycle] = checked;
      } else {
        (newLevels as any)[cycle][name] = checked;
      }
      return { ...prev, schoolLevels: newLevels };
    });
    setStepError('');
  };

  const toggleAllInCycle = (cycleKey: string, enable: boolean) => {
    setFormData(prev => {
      const newLevels = { ...prev.schoolLevels };
      const cycleInfo = (teachingLevels as any)[cycleKey];
      if (cycleInfo.classes) {
        cycleInfo.classes.forEach((cls: string) => {
          newLevels[cycleKey][cls] = enable;
        });
      } else {
        newLevels[cycleKey] = enable;
      }
      return { ...prev, schoolLevels: newLevels };
    });
  };

  const handleFileChange = (name: keyof typeof files, file: File | null) => {
    setFiles(prev => ({ ...prev, [name]: file }));
    setStepError('');
  };

  // Timer countdown for OTP
  useEffect(() => {
    let interval: any;
    if (currentStep === 5 && otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentStep, otpTimer]);

  // Step Validation & Navigation
  const handleNextStep = () => {
    setStepError('');

    if (currentStep === 1) {
      if (!formData.schoolName.trim()) {
        setStepError("Veuillez renseigner le nom officiel de l'établissement.");
        return;
      }
      if (!formData.schoolPhone.trim()) {
        setStepError("Le numéro de téléphone officiel de l'établissement est obligatoire.");
        return;
      }
      if (!formData.schoolAddress.trim()) {
        setStepError("Veuillez indiquer l'adresse ou la localisation géographique de l'établissement.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      // Check if at least one level or class is selected
      let hasSelection = false;
      if (formData.schoolLevels.garderie) hasSelection = true;
      for (const cycleKey of ['prescolaire', 'primaire', 'secondaireCollege', 'secondaireLycee']) {
        const clsObj = formData.schoolLevels[cycleKey];
        if (clsObj && Object.values(clsObj).some(Boolean)) {
          hasSelection = true;
          break;
        }
      }
      if (!hasSelection) {
        setStepError("Veuillez sélectionner au moins un cycle ou une classe dispensée dans votre école.");
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (!files.openingAuthorization) {
        setStepError("Le document « Autorisation ministérielle d'ouverture » est obligatoire.");
        return;
      }
      if (!files.promoterId) {
        setStepError("La « Pièce d'identité du Promoteur » (CNI / Passeport) est obligatoire.");
        return;
      }
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (!formData.promoterName.trim()) {
        setStepError("Veuillez indiquer le nom complet du promoteur / responsable légal.");
        return;
      }
      if (!formData.adminEmail.trim()) {
        setStepError("Veuillez renseigner une adresse email de connexion valide.");
        return;
      }
      if (!formData.adminPassword || formData.adminPassword.length < 6) {
        setStepError("Le mot de passe de connexion doit contenir au moins 6 caractères.");
        return;
      }
      
      // Dispatch real Brevo OTP email to promoter's email
      brevoEmailService.sendOtp({
        email: formData.adminEmail,
        name: formData.promoterName,
        purpose: 'school_registration'
      }).then(res => {
        if (!res.success) {
          console.warn("Notice Brevo OTP:", res.error);
        }
      }).catch(err => console.warn("Notice Brevo OTP err:", err));

      // Everything ready -> move to OTP verification step
      setCurrentStep(5);
      setOtpTimer(60);
    }
  };

  const handleResendOtp = async () => {
    setOtpError('');
    setOtpTimer(60);
    try {
      const res = await brevoEmailService.sendOtp({
        email: formData.adminEmail,
        name: formData.promoterName,
        purpose: 'school_registration'
      });
      if (!res.success) {
        setOtpError(res.error || "Impossible d'envoyer le code par email");
      }
    } catch (err: any) {
      setOtpError(err.message || "Erreur lors de l'envoi du code");
    }
  };

  const handlePrevStep = () => {
    setStepError('');
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      onBackToLogin();
    }
  };

  // Final OTP Submission & Account Creation
  const handleVerifyOtpAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 4) {
      setOtpError('Veuillez saisir le code OTP à 6 chiffres.');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');

    try {
      // 0. Verify OTP via Brevo OTP Verification API
      const otpVerifyRes = await brevoEmailService.verifyOtp({
        email: formData.adminEmail,
        otpCode: otpCode.trim(),
        purpose: 'school_registration'
      });

      if (!otpVerifyRes.success) {
        setOtpError(otpVerifyRes.error || "Code OTP invalide ou expiré.");
        setIsVerifyingOtp(false);
        return;
      }

      // 1. Create User in Supabase Auth.
      let userUid: string | null = null;
      try {
        const { url } = getStoredSupabaseConfig();
        if (!isPlaceholderSupabaseUrl(url)) {
          const supabase = getSupabaseClient();
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: formData.adminEmail,
            password: formData.adminPassword,
            options: {
              data: {
                name: formData.promoterName,
                role: 'Promoteur',
              }
            }
          });
          
          if (signUpError) {
            setOtpError(signUpError.message || "Impossible de créer le compte promoteur dans Supabase Auth.");
            setIsVerifyingOtp(false);
            return;
          } else if (signUpData?.user?.id) {
            userUid = signUpData.user.id;
          }
        } else {
          setOtpError("Supabase Auth doit être configuré avant de créer un établissement.");
          setIsVerifyingOtp(false);
          return;
        }
      } catch (authErr: any) {
        setOtpError(authErr?.message || "Supabase Auth indisponible pour l'inscription.");
        setIsVerifyingOtp(false);
        return;
      }
      
      // 2. Register School in DB with full dossier
      const result = await registerSchool({
        schoolName: formData.schoolName,
        schoolAddress: formData.schoolAddress,
        schoolPhone: formData.schoolPhone,
        creationDate: formData.creationDate,
        promoterName: formData.promoterName,
        promoterContact: formData.promoterContact,
        promoterEmail: formData.adminEmail,
        levels: formData.schoolLevels,
        openingAuthorizationDoc: files.openingAuthorization ? files.openingAuthorization.name : 'Autorisation_Ouverture_Officielle.pdf',
        promoterIdDoc: files.promoterId ? files.promoterId.name : 'Piece_Identite_Promoteur.pdf',
        statutesDoc: files.statutes ? files.statutes.name : null,
        uid: userUid, // Send userUid explicitly so backend sets the correct UID!
      } as any);
      
      if (result && !result.error) {
        const schId = result.schoolIdentifier || result.school?.identifier;
        if (!schId) {
          setOtpError("L'établissement a été créé mais aucun matricule réel n'a été renvoyé par le serveur.");
          return;
        }
        setCreatedSchoolIdentifier(schId);
        
        // Save local subscription initial state (discovery mode)
        localStorage.setItem('educo_local_subscription', JSON.stringify({
          isActive: false,
          isPreSubscription: true,
          planType: null,
          isAiEnabled: false,
          daysRemaining: 0,
          schoolIdentifier: schId,
          schoolName: formData.schoolName,
          promoterName: formData.promoterName,
        }));

        setShowWelcomeEmail(true);
      } else {
        setOtpError(result?.error || "Erreur lors de l'enregistrement de l'établissement.");
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setOtpError('Cette adresse email est déjà associée à un compte.');
      } else if (err.code === 'auth/weak-password') {
        setOtpError('Le mot de passe doit contenir au moins 6 caractères.');
      } else {
        setOtpError(err.message || "Erreur lors de l'inscription.");
      }
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleFinishAndRedirect = () => {
    setShowWelcomeEmail(false);
    window.location.reload();
  };

  // Helper count of selected classes
  const countSelectedClasses = () => {
    let count = 0;
    if (formData.schoolLevels.garderie) count++;
    for (const cycleKey of ['prescolaire', 'primaire', 'secondaireCollege', 'secondaireLycee']) {
      const clsObj = formData.schoolLevels[cycleKey];
      if (clsObj) {
        count += Object.values(clsObj).filter(Boolean).length;
      }
    }
    return count;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 py-8 px-4 sm:px-6 lg:px-8">
      
      {/* Welcome Email Modal Displayed After Successful Registration */}
      <WelcomeEmailModal
        isOpen={showWelcomeEmail}
        onClose={handleFinishAndRedirect}
        schoolName={formData.schoolName}
        promoterName={formData.promoterName}
        promoterEmail={formData.adminEmail}
        schoolIdentifier={createdSchoolIdentifier}
        onOpenSubscriptionModal={handleFinishAndRedirect}
      />

      <div className="w-full max-w-4xl mx-auto space-y-6">
        
        {/* Top Bar Navigation */}
        <div className="flex items-center justify-between">
          <button 
            type="button" 
            onClick={handlePrevStep}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-xl shadow-xs border border-slate-200 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{currentStep === 1 ? 'Retour à la connexion' : `Étape précédente (${currentStep - 1}/5)`}</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dossier Officiel Établissement</span>
            </span>
          </div>
        </div>

        {/* Main Card Container */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#1F4A59] via-[#24586B] to-[#1F4A59] p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-inner">
                <LogoIcon />
              </div>
              <div className="text-center sm:text-left">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Inscription & Enregistrement Établissement
                </h1>
                <p className="text-xs sm:text-sm text-sky-100/90 font-medium mt-1">
                  Créez votre dossier scolaire pas-à-pas en quelques minutes pour accéder à la plateforme EDUCO.
                </p>
              </div>
            </div>

            {/* Stepper Progress Bar */}
            <div className="mt-6 pt-6 border-t border-white/15">
              <div className="grid grid-cols-5 gap-2">
                {STEPS.map((s) => {
                  const StepIcon = s.icon;
                  const isCompleted = currentStep > s.id;
                  const isCurrent = currentStep === s.id;

                  return (
                    <div 
                      key={s.id}
                      onClick={() => {
                        if (isCompleted) setCurrentStep(s.id);
                      }}
                      className={`flex flex-col items-center text-center group ${isCompleted ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center w-full">
                        <div 
                          className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs font-black transition-all ${
                            isCurrent 
                              ? 'bg-amber-400 text-slate-900 ring-4 ring-amber-400/30 scale-110 shadow-lg' 
                              : isCompleted 
                              ? 'bg-emerald-400 text-slate-900' 
                              : 'bg-white/20 text-white/70'
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : s.id}
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold mt-2 hidden sm:block truncate max-w-full ${
                        isCurrent ? 'text-amber-300 font-extrabold' : isCompleted ? 'text-emerald-200' : 'text-white/60'
                      }`}>
                        {s.title}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {/* Linear Progress Indicator */}
              <div className="w-full bg-white/20 h-1.5 rounded-full mt-4 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-8">
            
            {/* Error Banner */}
            {stepError && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs font-bold animate-shake">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{stepError}</span>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 1: INFORMATIONS SUR L'ÉTABLISSEMENT                                  */}
            {/* ========================================================================= */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                  <div className="p-2.5 bg-sky-50 text-[#1F4A59] rounded-xl border border-sky-200 shadow-2xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Étape 1 : Identité de l'Établissement</h2>
                    <p className="text-xs text-slate-600 font-medium">Renseignez les coordonnées fondamentales de votre école.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
                      Nom officiel de l'Établissement Scolaire <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <School className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        name="schoolName"
                        value={formData.schoolName}
                        onChange={handleChange}
                        placeholder="Ex: Groupe Scolaire Les Hirondelles d'Excellence"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
                      N° de Téléphone Officiel de l'école <span className="text-rose-600">* (Obligatoire)</span>
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        name="schoolPhone"
                        value={formData.schoolPhone}
                        onChange={handleChange}
                        placeholder="Ex: +229 97 00 00 00 / 01 20 30 40"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
                      Date de création de l'école
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        name="creationDate"
                        value={formData.creationDate}
                        onChange={handleChange}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
                      Adresse géographique & Ville <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                      <textarea
                        name="schoolAddress"
                        value={formData.schoolAddress}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Ex: Quartier Agla, Rue 240, Lot 15, Cotonou, Bénin"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all font-semibold resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 2: CYCLES & NIVEAUX D'ENSEIGNEMENT                                   */}
            {/* ========================================================================= */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200 shadow-2xs">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-slate-900">Étape 2 : Cycles & Classes d'Enseignement</h2>
                      <p className="text-xs text-slate-600 font-medium">Cochez les cycles et sections ouverts dans votre établissement.</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-sky-50 text-[#1F4A59] text-xs font-black rounded-lg border border-sky-200">
                    {countSelectedClasses()} classe(s) choisie(s)
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Garderie */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Garderie & Crèche</h3>
                      <p className="text-xs text-slate-600 font-medium">Accueil de la petite enfance (0 à 2 ans)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        dataset-cycle="garderie"
                        name="garderie"
                        checked={formData.schoolLevels.garderie}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            schoolLevels: { ...prev.schoolLevels, garderie: e.target.checked }
                          }));
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1F4A59]" />
                    </label>
                  </div>

                  {/* Cycles with classes */}
                  {Object.entries(teachingLevels).filter(([key]) => key !== 'garderie').map(([cycleKey, cycleValue]) => {
                    const classes = cycleValue.classes || [];
                    const allChecked = classes.every(c => formData.schoolLevels[cycleKey]?.[c]);

                    return (
                      <div key={cycleKey} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-black text-slate-900">{cycleValue.label}</h3>
                          <button
                            type="button"
                            onClick={() => toggleAllInCycle(cycleKey, !allChecked)}
                            className="text-xs font-bold text-[#1F4A59] hover:underline cursor-pointer"
                          >
                            {allChecked ? 'Tout décocher' : 'Tout sélectionner'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                          {classes.map(className => {
                            const isChecked = Boolean(formData.schoolLevels[cycleKey]?.[className]);
                            return (
                              <label
                                key={className}
                                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition-all ${
                                  isChecked 
                                    ? 'bg-[#1F4A59]/10 border-[#1F4A59] text-[#1F4A59] shadow-2xs' 
                                    : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  name={className}
                                  data-cycle={cycleKey}
                                  checked={isChecked}
                                  onChange={handleLevelChange}
                                  className="rounded border-slate-300 text-[#1F4A59] focus:ring-[#1F4A59]"
                                />
                                <span className="truncate">{className}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 3: PIÈCES JUSTIFICATIVES & AGRÉMENTS OFFICIELS                      */}
            {/* ========================================================================= */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                  <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 shadow-2xs">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Étape 3 : Pièces Justificatives Officielles</h2>
                    <p className="text-xs text-slate-600 font-medium">Joignez les documents requis pour l'homologation de votre établissement.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Autorisation d'ouverture (Obligatoire) */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    files.openingAuthorization 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">1. Arrêté / Autorisation d'Ouverture Ministérielle</span>
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black rounded-md uppercase">
                            Obligatoire
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-1">
                          {files.openingAuthorization 
                            ? `Fichier sélectionné : ${files.openingAuthorization.name} (${(files.openingAuthorization.size / 1024).toFixed(0)} KB)` 
                            : "Format PDF, PNG ou JPG de l'arrêté ministériel accordé à votre école."}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 cursor-pointer shadow-xs shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{files.openingAuthorization ? 'Remplacer le fichier' : 'Parcourir & Joindre'}</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleFileChange('openingAuthorization', e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Pièce d'identité du Promoteur (Obligatoire) */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    files.promoterId 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">2. Pièce d'Identité du Promoteur (CNI / Passeport / CIP)</span>
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-black rounded-md uppercase">
                            Obligatoire
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-1">
                          {files.promoterId 
                            ? `Fichier sélectionné : ${files.promoterId.name} (${(files.promoterId.size / 1024).toFixed(0)} KB)` 
                            : "Document d'identité officiel du représentant légal de l'établissement."}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 cursor-pointer shadow-xs shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{files.promoterId ? 'Remplacer le fichier' : 'Parcourir & Joindre'}</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleFileChange('promoterId', e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Statuts ou Règlement Intérieur (Optionnel) */}
                  <div className={`p-4 rounded-xl border transition-all ${
                    files.statutes 
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">3. Statuts ou Règlement Intérieur de l'École</span>
                          <span className="px-2 py-0.5 bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-bold rounded-md uppercase">
                            Optionnel
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-1">
                          {files.statutes 
                            ? `Fichier sélectionné : ${files.statutes.name} (${(files.statutes.size / 1024).toFixed(0)} KB)` 
                            : "Statuts notariés ou règlement intérieur de l'établissement."}
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 cursor-pointer shadow-xs shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{files.statutes ? 'Remplacer le fichier' : 'Parcourir & Joindre'}</span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => handleFileChange('statutes', e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 4: COMPTE ADMINISTRATEUR DU PROMOTEUR                               */}
            {/* ========================================================================= */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                  <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 shadow-2xs">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Étape 4 : Compte Administrateur du Promoteur</h2>
                    <p className="text-xs text-slate-600 font-medium">Créez les identifiants qui vous permettront de piloter l'application.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
                      Nom complet du Promoteur / Directeur <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        name="promoterName"
                        value={formData.promoterName}
                        onChange={handleChange}
                        placeholder="Ex: Dr. Martin KASSA"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
                      Contact Téléphonique Direct / WhatsApp
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        name="promoterContact"
                        value={formData.promoterContact}
                        onChange={handleChange}
                        placeholder="Ex: +229 95 11 22 33"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
                      E-mail de Connexion <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        name="adminEmail"
                        value={formData.adminEmail}
                        onChange={handleChange}
                        placeholder="Ex: promoteur@ecole-excellence.com"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-900 uppercase tracking-wider mb-1.5">
                      Mot de Passe de Sécurité <span className="text-rose-600">* (min. 6 car.)</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        name="adminPassword"
                        value={formData.adminPassword}
                        onChange={handleChange}
                        placeholder="••••••••••••"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Info Note on Notification */}
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-800 space-y-1">
                    <p className="font-black text-slate-900">Transmission Automatique au Panneau Administratif</p>
                    <p className="text-slate-700 font-medium">
                      Dès confirmation, l'équipe d'administration globale recevra immédiatement une notification pour enregistrer et valider votre dossier d'établissement.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* STEP 5: VÉRIFICATION DE SÉCURITÉ OTP                                     */}
            {/* ========================================================================= */}
            {currentStep === 5 && (
              <div className="space-y-6 max-w-xl mx-auto">
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 bg-amber-50 text-amber-800 rounded-2xl border border-amber-200 shadow-2xs">
                    <KeyRound className="w-8 h-8" />
                  </div>
                  <h2 className="text-lg font-black text-slate-900">Étape 5 : Vérification de Sécurité</h2>
                  <p className="text-xs text-slate-600 font-medium">
                    Un code de confirmation a été transmis pour valider l'adresse <strong className="text-slate-900">{formData.adminEmail}</strong> et le numéro <strong className="text-slate-900">{formData.schoolPhone}</strong>.
                  </p>
                </div>

                {otpError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{otpError}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyOtpAndCreate} className="space-y-5">
                  <div>
                    <label className="block text-xs font-black text-slate-900 text-center uppercase tracking-wider mb-2">
                      Code de Vérification OTP (6 chiffres)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •"
                      className="w-full bg-slate-50 border-2 border-slate-300 focus:border-[#1F4A59] focus:bg-white rounded-2xl py-3.5 text-center text-2xl tracking-[0.5em] font-black text-slate-900 focus:outline-none transition-all shadow-inner"
                      autoFocus
                    />
                  </div>

                  {/* Resend & Demo Helper */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                    <div className="text-slate-600 font-medium">
                      {otpTimer > 0 ? (
                        <span>Renvoyer le code dans <strong className="text-slate-900 font-bold">{otpTimer}s</strong></span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          className="font-black text-[#1F4A59] hover:underline cursor-pointer"
                        >
                          Renvoyer un nouveau code de sécurité
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1 font-medium">
                    <div className="flex items-center justify-between text-slate-900 font-bold">
                      <span>Établissement :</span>
                      <span className="font-black text-slate-900">{formData.schoolName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-800">
                      <span>Promoteur :</span>
                      <span className="font-semibold">{formData.promoterName}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-800">
                      <span>Classes configurées :</span>
                      <span className="font-semibold">{countSelectedClasses()} niveau(x)</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingOtp || otpCode.length < 4}
                    className="w-full py-3.5 px-6 rounded-xl font-black text-sm bg-[#1F4A59] hover:bg-[#285d70] text-white shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isVerifyingOtp ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        <span>Création du dossier & Inscription en cours...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Valider le code & Finaliser l'Inscription</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            {/* Bottom Stepper Action Buttons (Steps 1 to 4) */}
            {currentStep < 5 && (
              <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
                >
                  {currentStep === 1 ? 'Annuler' : 'Précédent'}
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs bg-[#1F4A59] hover:bg-[#285d70] text-white shadow-md transition-all cursor-pointer"
                >
                  <span>{currentStep === 4 ? 'Vérifier par OTP' : 'Étape suivante'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
};

export default SchoolRegistrationPage;
