import React, { useState } from 'react';
import { LogoIcon, MailIcon, LockClosedIcon } from './Icons';
import { ShieldCheck, Lock, AlertCircle, Sparkles, KeyRound, User, Phone, CheckCircle2, UserPlus, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { getSupabaseClient, getStoredSupabaseConfig, isPlaceholderSupabaseUrl } from '../src/lib/supabase';
import { getApiUrl } from '../src/lib/apiConfig';

interface AdminSpecialLoginPageProps {
  onBack?: () => void;
  // The parent determines the active portal from its current page. The optional
  // third argument of its login handler is reserved for biometric authentication.
  onLogin?: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

const AdminSpecialLoginPage: React.FC<AdminSpecialLoginPageProps> = ({ onBack, onLogin }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'Admin',
    password: '',
    confirmPassword: '',
    securityKey: 'EDUCO-ADMIN-2026',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'confirm'>('request');
  const [resetChallenge, setResetChallenge] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!formData.email.trim() || !formData.password) {
      setError('Veuillez saisir votre email et mot de passe administrateur.');
      return;
    }

    setIsLoading(true);
    try {
      if (onLogin) {
        const res = await onLogin(formData.email.trim(), formData.password);
        if (!res.success) {
          setError(res.error || 'Identifiants administrateur incorrects.');
        }
      } else {
        const { url } = getStoredSupabaseConfig();
        if (!isPlaceholderSupabaseUrl(url)) {
          const supabase = getSupabaseClient();
          const { error: authError } = await supabase.auth.signInWithPassword({
            email: formData.email.trim(),
            password: formData.password,
          });
          if (authError && authError.message !== 'Failed to fetch') {
            setError(authError.message || 'Email ou mot de passe incorrect.');
            return;
          }
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la connexion administrateur.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Veuillez renseigner le nom complet de l\'administrateur.');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setError('Veuillez renseigner une adresse email valide.');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Call Backend API to register Admin
      const response = await fetch(getApiUrl('/api/auth/register-admin'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          password: formData.password,
          role: 'Admin',
          securityKey: formData.securityKey,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok && data.error) {
        throw new Error(data.error);
      }

      setSuccess(true);
      setSuccessMessage('Compte administrateur créé avec succès ! Connexion en cours...');

      // Auto login or switch to login mode
      setTimeout(async () => {
        if (onLogin) {
          await onLogin(formData.email.trim(), formData.password);
        } else {
          setSuccess(false);
          setMode('login');
        }
      }, 1500);

    } catch (err: any) {
      console.error("Register Admin Error:", err);
      setError(err?.message || 'Erreur lors de la création du compte administrateur.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.email.trim()) {
      setError('Veuillez saisir votre adresse email.');
      return;
    }

    try {
      setIsLoading(true);
      const email = formData.email.trim().toLowerCase();

      if (resetStep === 'request') {
        const response = await fetch(getApiUrl('/api/email/send-reset-password'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, adminOnly: true }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Impossible d’envoyer le code de réinitialisation.');
        }

        setResetChallenge(data.resetChallenge || '');
        setResetStep('confirm');
        setSuccess(true);
        setSuccessMessage('Un code de vérification a été envoyé à votre adresse e-mail.');
        return;
      }

      if (!resetCode.trim() || !newPassword || !confirmNewPassword) {
        throw new Error('Saisissez le code reçu et votre nouveau mot de passe.');
      }
      if (newPassword.length < 6) {
        throw new Error('Le nouveau mot de passe doit comporter au moins 6 caractères.');
      }
      if (newPassword !== confirmNewPassword) {
        throw new Error('Les deux mots de passe ne correspondent pas.');
      }

      const response = await fetch(getApiUrl('/api/email/confirm-reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otpCode: resetCode.trim(),
          newPassword,
          resetChallenge,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Impossible de réinitialiser le mot de passe.');
      }

      setSuccess(true);
      setSuccessMessage('Mot de passe réinitialisé. Vous pouvez maintenant vous connecter.');
      setTimeout(() => {
        setSuccess(false);
        setMode('login');
      }, 4000);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la demande. Vérifiez votre email.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderLoginForm = () => (
    <form className="mt-6 space-y-5" onSubmit={handleAdminLogin}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Identifiant / Email Administrateur
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <MailIcon className="w-5 h-5" />
            </div>
            <input
              name="email"
              type="email"
              required
              className="w-full pl-12 pr-4 py-3.5 border border-slate-300 dark:border-slate-700 rounded-2xl placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] transition-all bg-slate-50/50 dark:bg-slate-800 text-sm font-medium"
              placeholder="admin@educo-ecole.com"
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Mot de Passe Sécurisé
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <LockClosedIcon className="w-5 h-5" />
            </div>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              className="w-full pl-12 pr-12 py-3.5 border border-slate-300 dark:border-slate-700 rounded-2xl placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] transition-all bg-slate-50/50 dark:bg-slate-800 text-sm font-medium"
              placeholder="••••••••••••"
              value={formData.password}
              onChange={handleInputChange}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-4 px-4 text-sm font-extrabold rounded-2xl text-white bg-[#1F4A59] hover:bg-[#153540] shadow-lg shadow-[#1F4A59]/20 transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        <ShieldCheck className="w-5 h-5" />
        {isLoading ? 'Authentification en cours...' : 'Connexion Espace Administration'}
      </button>

      {/* Button to Create Admin Account */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => {
            setError('');
            setSuccess(false);
            setMode('register');
          }}
          className="w-full py-3 px-4 text-xs font-bold rounded-2xl text-[#1F4A59] dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/40 border border-sky-200 dark:border-sky-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Créer un compte Administrateur</span>
        </button>
      </div>

      <div className="flex items-center justify-between px-2 pt-1">
        <button 
          type="button" 
          onClick={() => {
            setError('');
            setMode('forgot');
          }} 
          className="text-xs font-bold text-slate-500 hover:text-[#1F4A59] dark:hover:text-sky-400 transition-colors cursor-pointer"
        >
          Mot de passe oublié ?
        </button>

        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
          <Lock className="w-3 h-3 text-slate-400" />
          <span>Accès Privé Sécurisé</span>
        </div>
      </div>
    </form>
  );

  const renderRegisterForm = () => (
    <form className="mt-6 space-y-4" onSubmit={handleAdminRegister}>
      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          Nom et Prénom(s) de l'Administrateur *
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <User className="w-4 h-4" />
          </div>
          <input
            name="name"
            type="text"
            required
            className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] transition-all bg-slate-50/50 dark:bg-slate-800 text-xs font-medium"
            placeholder="Dr. Jean-Marc KOUASSI"
            value={formData.name}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
          Adresse E-mail Institutionnelle *
        </label>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <MailIcon className="w-4 h-4" />
          </div>
          <input
            name="email"
            type="email"
            required
            className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] transition-all bg-slate-50/50 dark:bg-slate-800 text-xs font-medium"
            placeholder="admin@educo-ecole.com"
            value={formData.email}
            onChange={handleInputChange}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Téléphone / WhatsApp
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <Phone className="w-4 h-4" />
            </div>
            <input
              name="phone"
              type="tel"
              className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] transition-all bg-slate-50/50 dark:bg-slate-800 text-xs font-medium"
              placeholder="+242 06 123 45 67"
              value={formData.phone}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Rôle unique
          </label>
          <select
            name="role"
            value="Admin"
            disabled
            className="w-full px-3 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 text-xs font-bold cursor-not-allowed"
          >
            <option value="Admin">Administrateur unique</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Mot de passe *
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <LockClosedIcon className="w-4 h-4" />
            </div>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] transition-all bg-slate-50/50 dark:bg-slate-800 text-xs font-medium"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Confirmer mot de passe *
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <LockClosedIcon className="w-4 h-4" />
            </div>
            <input
              name="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              className="w-full pl-11 pr-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl placeholder-slate-400 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F4A59] transition-all bg-slate-50/50 dark:bg-slate-800 text-xs font-medium"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 text-sm font-extrabold rounded-2xl text-white bg-[#1F4A59] hover:bg-[#153540] shadow-lg shadow-[#1F4A59]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4" />
          {isLoading ? 'Création du compte en cours...' : 'Valider et Créer le Compte Administrateur'}
        </button>
      </div>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => {
            setError('');
            setMode('login');
          }}
          className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-[#1F4A59] dark:hover:text-sky-400 transition-colors cursor-pointer"
        >
          Vous avez déjà un compte ? <span className="text-[#1F4A59] dark:text-sky-400 underline">Se connecter</span>
        </button>
      </div>
    </form>
  );

  const renderForgotForm = () => (
    <form className="mt-8 space-y-6" onSubmit={handleForgotSubmit}>
      <div className="text-center space-y-4">
        <p className="text-sm text-slate-500 leading-relaxed">
          {resetStep === 'request'
            ? "Entrez votre adresse e-mail d’administrateur. Nous vous enverrons un code de réinitialisation sécurisé."
            : 'Saisissez le code reçu et choisissez votre nouveau mot de passe.'}
        </p>
        <div className="relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
            <MailIcon className="w-5 h-5" />
          </div>
          <input
            type="email"
            required
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className="w-full pl-12 pr-4 py-4 border border-slate-300 rounded-2xl placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4A59] transition-all bg-slate-50/50"
            placeholder="admin@educo-ecole.com"
          />
        </div>

        {resetStep === 'confirm' && (
          <div className="space-y-3 text-left">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 border border-slate-300 rounded-2xl text-center tracking-[0.45em] font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
              placeholder="000000"
              aria-label="Code de vérification reçu par e-mail"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
              placeholder="Nouveau mot de passe"
            />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={6}
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
              placeholder="Confirmer le nouveau mot de passe"
            />
          </div>
        )}
      </div>
      
      <button type="submit" disabled={isLoading} className="w-full py-4 text-sm font-extrabold rounded-2xl text-white bg-[#1F4A59] hover:bg-[#153540] transition-all cursor-pointer disabled:opacity-50">
        {isLoading ? 'Traitement en cours...' : resetStep === 'request' ? 'Recevoir le code de récupération' : 'Réinitialiser mon mot de passe'}
      </button>
      
      <div className="text-center">
        <button 
          type="button" 
          onClick={() => {
            setError('');
            setSuccess(false);
            setResetStep('request');
            setResetCode('');
            setNewPassword('');
            setConfirmNewPassword('');
            setMode('login');
          }} 
          className="text-xs font-bold text-[#1F4A59] hover:underline flex items-center justify-center gap-2 mx-auto cursor-pointer"
        >
          &larr; Retour à la connexion admin
        </button>
      </div>
    </form>
  );

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#EBF3F8] dark:bg-slate-950 p-4 transition-colors">
      <div className="w-full max-w-lg p-8 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="text-center">
          <div className="flex justify-center mx-auto mb-4 transform hover:scale-105 transition-transform cursor-pointer">
            <LogoIcon className="w-16 h-16" />
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[#1F4A59] dark:text-sky-400 text-xs font-bold mb-3 border border-slate-200 dark:border-slate-700">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Portail Restreint • Super Admin & Co-Admins</span>
          </div>

          <h2 className="text-2xl font-black text-[#1F4A59] dark:text-white tracking-tight">
            {mode === 'login' && 'Administration Centrale EDUCO'}
            {mode === 'register' && 'Création de Compte Administrateur'}
            {mode === 'forgot' && 'Récupération de Compte'}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1.5 font-medium max-w-sm mx-auto">
            {mode === 'login' && 'Seul le Super Administrateur et les Co-Administrateurs habilités peuvent se connecter à cet espace.'}
            {mode === 'register' && 'Remplissez ce formulaire pour créer et enregistrer un profil administrateur système.'}
            {mode === 'forgot' && 'Récupérez l\'accès à votre compte administrateur.'}
          </p>
        </div>

        {error && (
          <div className="mt-6 p-4 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}
        
        {success && (
          <div className="mt-6 p-4 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage || 'Opération réussie avec succès.'}</span>
          </div>
        )}

        {mode === 'login' && renderLoginForm()}
        {mode === 'register' && renderRegisterForm()}
        {mode === 'forgot' && renderForgotForm()}

        {onBack && (
          <div className="text-center mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button 
              onClick={onBack} 
              className="text-xs font-bold text-slate-500 hover:text-[#1F4A59] dark:hover:text-sky-400 transition-colors flex items-center justify-center mx-auto gap-2 cursor-pointer"
            >
              <span>&larr;</span>
              <span>Retour à la page de connexion des établissements</span>
            </button>
          </div>
        )}

        <div className="text-center mt-10 pt-4 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
          <span className="font-bold text-slate-600 dark:text-slate-300">EDUCO APP</span> développée par <strong className="text-[#1F4A59] dark:text-teal-400 font-black">LoukaTech</strong>
        </div>
      </div>
    </div>
  );
};

export default AdminSpecialLoginPage;
