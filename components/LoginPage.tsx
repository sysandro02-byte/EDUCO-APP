import React, { useState } from 'react';
import { LogoIcon, MailIcon, LockClosedIcon } from './Icons';
import SchoolRegistrationPage from './SchoolRegistrationPage';
import Modal from './Modal';
import { Fingerprint, Scan, ShieldCheck, Sparkles, Building2, UserCheck, CheckCircle2, AlertCircle, Phone, ArrowLeft, ArrowRight, User, KeyRound, Check } from 'lucide-react';
import BiometricAuthModal from './BiometricAuthModal';
import { BiometricLoginButton } from './auth/BiometricLoginButton';
import { loginWithWebAuthn } from '../src/services/webauthnService';
import { LoadingDots } from './LoadingDots';
import { brevoEmailService } from '../src/services/brevoEmailService';
import { getSupabaseClient, getStoredSupabaseConfig } from '../src/lib/supabase';

interface LoginPageProps {
  onLogin: (email: string, password: string, isBiometric?: boolean) => Promise<{ success: boolean; error?: string }>;
  onNavigateToAdmin?: () => void;
  users?: any[];
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onNavigateToAdmin, users = [] }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isParentRegistering, setIsParentRegistering] = useState(false);
  const [modalType, setModalType] = useState<'none' | 'accountNotFound' | 'incorrectPassword' | 'invalidCredentials'>('none');
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  // Parent OTP State
  const [parentOtpStep, setParentOtpStep] = useState<'form' | 'otp'>('form');
  const [parentOtpCode, setParentOtpCode] = useState('');

  // Parent Registration Form State
  const [parentForm, setParentForm] = useState({
    schoolMatricule: '',
    studentMatricule: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    password: '',
  });
  const [parentRegError, setParentRegError] = useState('');
  const [parentRegSuccess, setParentRegSuccess] = useState('');
  const [isVerifyingSchool, setIsVerifyingSchool] = useState(false);
  const [verifiedSchoolInfo, setVerifiedSchoolInfo] = useState<{ name: string; identifier: string } | null>(null);
  const [isSubmittingParent, setIsSubmittingParent] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Veuillez saisir l\'e-mail et le mot de passe.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const result = await onLogin(email, password);
      if (!result.success) {
        if (result.error === 'userNotFound') {
          setModalType('accountNotFound');
        } else if (result.error === 'incorrectPassword') {
          setModalType('incorrectPassword');
        } else {
          setError(result.error || 'Identifiants invalides.');
        }
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleWebAuthnLogin = async () => {
    setError('');
    setIsLoggingIn(true);
    try {
      const res = await loginWithWebAuthn(email || undefined);
      if (res.success && res.userEmail) {
        setEmail(res.userEmail);
        const result = await onLogin(res.userEmail, 'BIOMETRIC_PASS', true);
        if (!result.success) {
          const message = result.error || `Échec de connexion biométrique pour ${res.userEmail}.`;
          setError(message);
          alert(message);
        }
      } else {
        const message = res.error || 'Erreur lors de la vérification biométrique.';
        setError(message);
        alert(message);
      }
    } catch (err: any) {
      const message = err?.message || "Erreur lors de l'accès biométrique.";
      setError(message);
      alert(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleBiometricSuccess = async (authenticatedUser?: any) => {
    const userEmail = (typeof authenticatedUser === 'string' ? authenticatedUser : authenticatedUser?.email) || email || 'sysandro02@gmail.com';
    setEmail(userEmail);
    setIsBiometricModalOpen(false);
    setIsLoggingIn(true);
    setError('');
    try {
      const result = await onLogin(userEmail, 'BIOMETRIC_PASS', true);
      if (!result.success) {
        const message = result.error || `Échec de connexion biométrique pour ${userEmail}.`;
        setError(message);
        alert(message);
      }
    } catch (err: any) {
      const message = err?.message || "Erreur lors de l'accès biométrique.";
      setError(message);
      alert(message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifySchoolMatricule = async () => {
    if (!parentForm.schoolMatricule.trim()) {
      setParentRegError('Veuillez saisir le N° Matricule d\'établissement.');
      return;
    }
    setIsVerifyingSchool(true);
    setParentRegError('');
    setVerifiedSchoolInfo(null);

    try {
      const res = await fetch(`/api/auth/verify-school-matricule/${encodeURIComponent(parentForm.schoolMatricule.trim())}`);
      const data = await res.json();
      if (data.valid && data.school) {
        setVerifiedSchoolInfo({ name: data.school.name, identifier: data.school.identifier });
      } else {
        setParentRegError(data.error || 'N° Matricule d\'établissement introuvable.');
      }
    } catch (err) {
      setParentRegError('Erreur de communication avec le serveur.');
    } finally {
      setIsVerifyingSchool(false);
    }
  };

  const handleParentRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentRegError('');
    setParentRegSuccess('');

    if (!parentForm.schoolMatricule.trim()) {
      setParentRegError('Le N° Matricule d\'établissement est obligatoire.');
      return;
    }
    if (!parentForm.parentName.trim()) {
      setParentRegError('Veuillez renseigner votre nom complet.');
      return;
    }
    if (!parentForm.parentEmail.trim()) {
      setParentRegError('Veuillez renseigner votre adresse e-mail.');
      return;
    }
    if (!parentForm.password || parentForm.password.length < 6) {
      setParentRegError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setIsSubmittingParent(true);

    try {
      // Send OTP first via Brevo Email Service
      const res = await brevoEmailService.sendOtp({
        email: parentForm.parentEmail,
        name: parentForm.parentName,
        purpose: 'general'
      });
      if (res.success) {
        setParentOtpStep('otp');
        setParentRegSuccess('Un code de confirmation OTP à 6 chiffres a été envoyé à votre adresse e-mail.');
      } else {
        setParentRegError(res.error || "Impossible d'envoyer le code de confirmation OTP.");
      }
    } catch (err: any) {
      setParentRegError(err.message || "Erreur lors de l'envoi du code OTP.");
    } finally {
      setIsSubmittingParent(false);
    }
  };

  const handleVerifyParentOtpAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentRegError('');
    setParentRegSuccess('');
    
    if (!parentOtpCode.trim() || parentOtpCode.trim().length < 4) {
      setParentRegError('Veuillez saisir le code OTP à 6 chiffres.');
      return;
    }

    setIsSubmittingParent(true);
    try {
      // 1. Verify OTP with backend
      const verifyRes = await brevoEmailService.verifyOtp({
        email: parentForm.parentEmail,
        otpCode: parentOtpCode.trim(),
        purpose: 'general'
      });

      if (!verifyRes.success) {
        setParentRegError(verifyRes.error || 'Code OTP invalide ou expiré.');
        setIsSubmittingParent(false);
        return;
      }

      // 2. Try Supabase Auth SignUp if configured
      let userUid = `parent_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      try {
        const { url } = getStoredSupabaseConfig();
        if (url && !url.includes('demo-educo.supabase.co')) {
          const supabase = getSupabaseClient();
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: parentForm.parentEmail,
            password: parentForm.password,
            options: {
              data: {
                name: parentForm.parentName,
                role: 'Parent',
              }
            }
          });
          if (signUpError) {
            console.warn("Supabase Auth parent registration fallback:", signUpError.message);
          } else if (signUpData?.user?.id) {
            userUid = signUpData.user.id;
          }
        }
      } catch (authErr: any) {
        console.warn("Supabase Auth not available for parent registration, creating locally.");
      }

      // 3. Complete Parent Registration in DB
      const res = await fetch('/api/auth/register-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parentForm,
          uid: userUid
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setParentRegSuccess(data.message || 'Votre compte Parent a été créé avec succès.');
        setTimeout(async () => {
          setEmail(parentForm.parentEmail);
          setPassword(parentForm.password);
          setIsParentRegistering(false);
          setParentOtpStep('form');
          setParentOtpCode('');
          sessionStorage.setItem('otpVerified', 'true');
          window.location.reload(); // Reload page to automatically trigger autologin
        }, 1500);
      } else {
        setParentRegError(data.error || 'Erreur lors de l\'enregistrement du compte parent.');
      }
    } catch (err: any) {
      setParentRegError(err.message || 'Erreur lors de la validation.');
    } finally {
      setIsSubmittingParent(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    setError('');
    setResetLoading(true);
    try {
      const res = await brevoEmailService.sendPasswordReset({ email: resetEmail });
      if (res.success) {
        setResetStep('verify');
        setResetMessage('Un code OTP à 6 chiffres a été envoyé par e-mail.');
      } else {
        setError(res.error || 'Erreur lors de la demande de réinitialisation.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion au serveur.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    setError('');
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setResetLoading(true);
    try {
      const res = await brevoEmailService.confirmPasswordReset({
        email: resetEmail,
        otpCode: resetOtpCode,
        newPassword,
      });
      if (res.success) {
        setResetMessage('Mot de passe modifié avec succès ! Vous pouvez maintenant vous connecter.');
        setTimeout(() => {
          setIsForgotPassword(false);
          setResetStep('request');
          setResetOtpCode('');
          setNewPassword('');
          setResetMessage('');
          setEmail(resetEmail);
        }, 2000);
      } else {
        setError(res.error || 'Code OTP invalide ou expiré.');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la réinitialisation.');
    } finally {
      setResetLoading(false);
    }
  };

  if (isRegistering) {
    return <SchoolRegistrationPage onBackToLogin={() => setIsRegistering(false)} />;
  }

  // Parent Account Registration View
  if (isParentRegistering) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-900 p-4">
        <div className="w-full max-w-lg p-6 sm:p-8 space-y-6 bg-white rounded-3xl shadow-xl border border-slate-200 animate-fade-in">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <button 
              onClick={() => setIsParentRegistering(false)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour à la connexion</span>
            </button>
            <span className="px-3 py-1 bg-sky-50 text-sky-700 font-bold text-[11px] rounded-full border border-sky-200">
              Espace Parents d'Élèves
            </span>
          </div>

          <div className="text-center space-y-2">
            <div className="inline-flex p-3 bg-[#1F4A59] text-white rounded-2xl shadow-inner mb-1">
              <UserCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-slate-900">Création de Compte Parent</h1>
            <p className="text-xs text-slate-500">
              Saisissez le N° Matricule unique fourni par l'établissement de votre enfant.
            </p>
          </div>

          {parentRegError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{parentRegError}</span>
            </div>
          )}

          {parentRegSuccess && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{parentRegSuccess}</span>
            </div>
          )}

          {parentOtpStep === 'otp' ? (
            <form onSubmit={handleVerifyParentOtpAndSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Code de confirmation OTP <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={parentOtpCode}
                    onChange={(e) => setParentOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center font-mono font-black text-xl tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500 text-center">
                  Saisissez le code de sécurité à 6 chiffres envoyé à l'adresse <strong>{parentForm.parentEmail}</strong>.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setParentOtpStep('form');
                    setParentRegSuccess('');
                    setParentRegError('');
                  }}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Modifier les informations
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingParent || parentOtpCode.length < 4}
                  className="flex-1 py-3 px-4 bg-[#1F4A59] hover:bg-[#285d70] text-white font-black text-xs rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingParent ? 'Validation...' : 'Valider & S\'inscrire'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleParentRegisterSubmit} className="space-y-4">
              
              {/* School Matricule Input + Verify */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  N° Matricule Établissement <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={parentForm.schoolMatricule}
                      onChange={(e) => {
                        setParentForm(prev => ({ ...prev, schoolMatricule: e.target.value }));
                        setVerifiedSchoolInfo(null);
                      }}
                      placeholder="Ex: EDUCO-SCH-8492"
                      className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifySchoolMatricule}
                    disabled={isVerifyingSchool || !parentForm.schoolMatricule.trim()}
                    className="px-4 py-2.5 bg-[#1F4A59] hover:bg-[#285d70] text-white text-xs font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isVerifyingSchool ? 'Vérification...' : 'Vérifier'}
                  </button>
                </div>

                {verifiedSchoolInfo && (
                  <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Établissement trouvé : <strong>{verifiedSchoolInfo.name}</strong> ({verifiedSchoolInfo.identifier})</span>
                  </div>
                )}
              </div>

              {/* Student Matricule Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  N° Matricule / Code Élève (Optionnel)
                </label>
                <input
                  type="text"
                  value={parentForm.studentMatricule}
                  onChange={(e) => setParentForm(prev => ({ ...prev, studentMatricule: e.target.value }))}
                  placeholder="Ex: GSMT-2026-MAT-101"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                />
              </div>

              {/* Parent Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nom Complet du Parent <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={parentForm.parentName}
                    onChange={(e) => setParentForm(prev => ({ ...prev, parentName: e.target.value }))}
                    placeholder="Ex: Paul MBEMBA"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Numéro de Téléphone
                  </label>
                  <input
                    type="tel"
                    value={parentForm.parentPhone}
                    onChange={(e) => setParentForm(prev => ({ ...prev, parentPhone: e.target.value }))}
                    placeholder="+242 06 000 0000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Adresse E-mail de Connexion <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={parentForm.parentEmail}
                  onChange={(e) => setParentForm(prev => ({ ...prev, parentEmail: e.target.value }))}
                  placeholder="Ex: parent@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Créer un Mot de passe <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  value={parentForm.password}
                  onChange={(e) => setParentForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingParent}
                className="w-full py-3.5 px-4 bg-[#1F4A59] hover:bg-[#285d70] text-white font-black text-sm rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmittingParent ? 'Envoi du code...' : 'Recevoir le code de validation'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (isForgotPassword) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#EBF3F8] dark:bg-slate-900 p-4">
        <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700">
          <div className="text-center">
            <div className="flex justify-center mx-auto mb-3">
              <LogoIcon />
            </div>
            <h2 className="text-2xl font-black text-[#1F4A59] dark:text-sky-400">
              {resetStep === 'request' ? 'Réinitialisation de mot de passe' : 'Saisir le code OTP & Nouveau mot de passe'}
            </h2>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
              {resetStep === 'request'
                ? 'Renseignez votre e-mail pour recevoir votre code de sécurité.'
                : `Un code OTP a été transmis à ${resetEmail}.`}
            </p>
          </div>

          {error && (
            <div className="p-3 text-xs text-rose-800 bg-rose-50 rounded-xl border border-rose-200 flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {resetMessage && (
            <div className="p-3 text-xs text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{resetMessage}</span>
            </div>
          )}

          {resetStep === 'request' ? (
            <form className="space-y-5" onSubmit={handleForgotPasswordSubmit}>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <MailIcon />
                  </div>
                  <input
                    type="email"
                    required
                    className="w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-xl placeholder-slate-400 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                    placeholder="votre-email@domaine.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3.5 px-4 text-sm font-bold text-white bg-[#1F4A59] hover:bg-[#153440] rounded-xl transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {resetLoading ? 'Envoi du code...' : 'Recevoir le code de réinitialisation'}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 cursor-pointer"
                >
                  &larr; Annuler et retourner à la connexion
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleConfirmPasswordReset}>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Code OTP (6 chiffres)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    className="w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-xl text-center font-mono font-black text-xl tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                    placeholder="123456"
                    value={resetOtpCode}
                    onChange={(e) => setResetOtpCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nouveau Mot de passe (min. 6 car.)
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <LockClosedIcon />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-xl placeholder-slate-400 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={resetLoading || resetOtpCode.length < 4 || newPassword.length < 6}
                className="w-full py-3.5 px-4 text-sm font-bold text-white bg-[#1F4A59] hover:bg-[#153440] rounded-xl transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
              >
                {resetLoading ? 'Réinitialisation...' : 'Changer mon mot de passe'}
              </button>

              <div className="text-center pt-2 flex justify-between items-center text-xs">
                <button
                  type="button"
                  onClick={() => setResetStep('request')}
                  className="text-slate-500 font-bold hover:underline cursor-pointer"
                >
                  &larr; Changer d'email
                </button>
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-slate-500 font-bold hover:underline cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#EBF3F8] dark:bg-slate-950 p-4 transition-colors">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800">
        <div className="text-center">
            <button 
              className="flex justify-center mx-auto mb-4 hover:scale-105 transition-transform active:scale-95 duration-200 cursor-pointer" 
              onClick={onNavigateToAdmin}
              title="Accès Administration"
            >
                <LogoIcon />
            </button>
          <h1 className="text-3xl font-extrabold text-[#1F4A59] dark:text-sky-400 tracking-tight">Bienvenue sur EDUCO</h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-slate-400">Connectez-vous pour accéder à votre tableau de bord scolaire</p>
        </div>

        {/* Biometric WebAuthn Quick Login */}
        <BiometricLoginButton 
          onBiometricClick={handleWebAuthnLogin} 
          isLoading={isLoggingIn} 
          userEmail={email} 
        />

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <p className="text-center text-sm text-red-600 bg-red-50 dark:bg-rose-950 border border-red-200 dark:border-rose-800 p-3 rounded-xl">{error}</p>}
          
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Adresse E-mail</label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <MailIcon />
              </div>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-xl placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all"
                placeholder="Ex: directeur@educo.ci"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-slate-300 mb-1">Mot de passe</label>
            <div className="relative">
               <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <LockClosedIcon />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-slate-700 dark:bg-slate-900 dark:text-white rounded-xl placeholder-gray-400 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4A59] focus:border-transparent transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm pt-1">
            <button type="button" onClick={() => setIsForgotPassword(true)} className="text-xs font-bold text-[#1F4A59] dark:text-sky-400 hover:underline cursor-pointer">
              Mot de passe oublié ?
            </button>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoggingIn}
              className="group relative w-full flex items-center justify-center py-3.5 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-[#1F4A59] hover:bg-[#2c5a6e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1F4A59] transition-all shadow-md active:scale-[0.99] cursor-pointer disabled:opacity-70"
            >
              {isLoggingIn ? (
                <>
                  <span>Connexion en cours</span>
                  <LoadingDots />
                </>
              ) : (
                <span>Se connecter</span>
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-600 dark:text-slate-400 pt-2 border-t border-gray-100 dark:border-slate-800">
          Vous êtes un promoteur ?{' '}
          <button onClick={() => setIsRegistering(true)} className="font-bold text-[#1F4A59] dark:text-sky-400 hover:underline cursor-pointer">
            Inscrivez votre établissement
          </button>
        </p>
      </div>

      <Modal isOpen={modalType !== 'none'} onClose={() => setModalType('none')} title={modalType === 'accountNotFound' ? 'Compte non trouvé' : modalType === 'incorrectPassword' ? 'Mot de passe incorrect' : 'Erreur de connexion'}>
        <div className="p-4">
          <p className="text-gray-700 dark:text-slate-300">
            {modalType === 'accountNotFound' 
              ? 'Le compte associé à cet e-mail n\'existe pas. Voulez-vous créer un nouveau compte ?'
              : modalType === 'incorrectPassword'
              ? 'Le mot de passe saisi est incorrect. Veuillez réessayer.'
              : 'Identifiants invalides. Veuillez réessayer.'
            }
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setModalType('none')} className="btn-secondary">Fermer</button>
            {modalType === 'accountNotFound' && (
              <button onClick={() => { setModalType('none'); setIsRegistering(true); }} className="btn-primary">Créer un compte</button>
            )}
          </div>
        </div>
      </Modal>

      {/* Biometric Authentication Modal */}
      <BiometricAuthModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        onSuccess={handleBiometricSuccess}
        availableUsers={users}
      />
    </div>
  );
};

export default LoginPage;
