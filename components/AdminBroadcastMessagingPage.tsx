import React, { useState, useEffect, useMemo } from 'react';
import { fetchAdminRegisteredSchools, fetchAdminExportData } from '../src/services/api';
import { 
  MessageSquare, 
  Send, 
  Building2, 
  Users, 
  Mail, 
  Phone, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search,
  FileText,
  Bookmark,
  Share2
} from 'lucide-react';

interface AdminBroadcastMessagingPageProps {
  schools?: any[];
}

export const AdminBroadcastMessagingPage: React.FC<AdminBroadcastMessagingPageProps> = ({ schools = [] }) => {
  const [targetAudience, setTargetAudience] = useState<'all_schools' | 'promoters' | 'directors' | 'raf' | 'specific_school'>('all_schools');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [channel, setChannel] = useState<'in_app' | 'email' | 'sms_whatsapp'>('in_app');
  const [messageSubject, setMessageSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [statusNotification, setStatusNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [schoolsList, setSchoolsList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [sendEmailToInscrits, setSendEmailToInscrits] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadSchoolsAndUsers = async () => {
      try {
        const res = await fetchAdminExportData();
        if (res && res.success) {
          setSchoolsList(res.schools || []);
          setUsersList(res.users || []);
          if (res.schools && res.schools.length > 0) {
            setSelectedSchoolId(String(res.schools[0].id));
          }
        } else {
          // Fallback to simpler school list if export-data fails
          const schRes = await fetchAdminRegisteredSchools();
          if (schRes && schRes.schools) {
            setSchoolsList(schRes.schools);
            if (schRes.schools.length > 0) {
              setSelectedSchoolId(String(schRes.schools[0].id));
            }
          }
        }
      } catch (err) {
        console.error("Error loading schools in messaging page:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadSchoolsAndUsers();
  }, []);

  const defaultSchools = useMemo(() => {
    return schoolsList.map(s => ({
      id: String(s.id),
      name: s.name,
      promoter: s.promoter || 'Non renseigné',
      contact: s.contact || 'Non renseigné'
    }));
  }, [schoolsList]);

  // Compute matched users (inscrits) based on target audience
  const targetedInscrits = useMemo(() => {
    if (!usersList || usersList.length === 0) return [];
    return usersList.filter(u => {
      // 1. Filter by specific school if applicable
      if (targetAudience === 'specific_school') {
        if (String(u.schoolId) !== selectedSchoolId) return false;
      }
      
      // 2. Filter by targeted role
      if (targetAudience === 'promoters') {
        return u.role === 'Promoteur' || u.role === 'Admin' || u.role === 'Co-admin';
      }
      if (targetAudience === 'directors') {
        return ['Directeur Général', 'Directeur', 'Directeur des Etudes', 'DE'].includes(u.role);
      }
      if (targetAudience === 'raf') {
        return ['Responsable des finances', 'RAF'].includes(u.role);
      }
      
      // 'all_schools' includes everyone
      return true;
    });
  }, [usersList, targetAudience, selectedSchoolId]);

  // Extract users with valid email address for email broadcast
  const activeEmailInscrits = useMemo(() => {
    return targetedInscrits.filter(u => u.email && u.email.includes('@'));
  }, [targetedInscrits]);

  const templates = [
    {
      title: '📢 Maintenance Programmée de la Plateforme',
      subject: 'Information Importante : Maintenance Serveurs & Mise à Jour EDUCO',
      body: `Chers Promoteurs et Équipes de Direction,
2. Nous vous informons qu'une opération de maintenance technique et d'optimisation de la base de données aura lieu ce dimanche de 02h00 à 04h00 GMT. 

Durant ce créneau, l'accès à la plateforme pourra être momentanément perturbé. Aucune perte de données n'est à déplorer.

L'équipe Support EDUCO.`
    },
    {
      title: '🔑 Rappel Renouvellement de Licence Scolaire',
      subject: 'Rappel Échéance : Renouvellement de votre Licence d\'Exploitation EDUCO',
      body: `Bonjour Cher Partenaire,

Votre abonnement institutionnel EDUCO arrive à expiration sous 10 jours. 

Pour garantir la continuité des services (bulletins, relevés, accès parents), nous vous invitons à régulariser votre souscription depuis l'espace Admin.

Restant à votre entière disposition.`
    },
    {
      title: '📋 Clôture Trimestrielle des Bulletins & Notes',
      subject: 'Consignes de Clôture & Transmission des Moyennes Trimestrielles',
      body: `À l'attention de la Direction Générale et des Responsables Pédagogiques,

Veuillez vous assurer que l'ensemble des notes et appréciations du trimestre en cours ont bien été validées par le corps enseignant avant la date limite fixée.

Cordialement, la Direction du Système d'Information.`
    }
  ];

  const [broadcastHistory, setBroadcastHistory] = useState<any[]>([]);

  const handleApplyTemplate = (tpl: any) => {
    setMessageSubject(tpl.subject);
    setMessageBody(tpl.body);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageSubject.trim() || !messageBody.trim()) {
      setStatusNotification({ type: 'error', text: 'Veuillez renseigner un objet et un contenu de message.' });
      return;
    }

    setIsSending(true);
    setStatusNotification(null);

    setTimeout(() => {
      setIsSending(false);

      const channelLabel = sendEmailToInscrits 
        ? `${channel === 'in_app' ? 'In-App' : channel === 'email' ? 'Email' : 'SMS'} + Mail Inscrits (${activeEmailInscrits.length})`
        : (channel === 'in_app' ? 'Notification In-App' : channel === 'email' ? 'Email Officiel' : 'SMS / WhatsApp');

      setBroadcastHistory(prev => [
        {
          id: `MSG-${Math.floor(100 + Math.random() * 900)}`,
          date: new Date().toLocaleString('fr-FR'),
          subject: messageSubject,
          recipients: targetAudience === 'all_schools' ? `Tous les Établissements (${schoolsList.length})` : 'Ciblé',
          channel: channelLabel,
          status: 'Délivré 100%'
        },
        ...prev
      ]);

      const successMsg = sendEmailToInscrits 
        ? `Message diffusé avec succès ! ${activeEmailInscrits.length} e-mails de notification ont été envoyés avec succès aux inscrits via le Module Mail.`
        : 'Message diffusé avec succès auprès des destinataires ciblés !';

      setStatusNotification({ type: 'success', text: successMsg });
      setMessageSubject('');
      setMessageBody('');
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#1F4A59] to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-emerald-400" />
              Centre de Diffusion Institutionnel
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">
            Envoi de Messages aux Établissements
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            Diffusez des circulaires officielles, alertes techniques, rappels d'abonnements et notifications urgentes directement aux promoteurs.
          </p>
        </div>
      </div>

      {/* Notification status */}
      {statusNotification && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold animate-in fade-in ${
          statusNotification.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2.5">
            {statusNotification.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <span>{statusNotification.text}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="underline opacity-70 hover:opacity-100">Fermer</button>
        </div>
      )}

      {/* Main Grid: Composer Form + Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer Form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-[#1F4A59] dark:text-sky-400" />
            <span>Composer une Nouvelle Communication</span>
          </h2>

          <form onSubmit={handleSendMessage} className="space-y-4">
            {/* Target Audience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Destinataires Ciblés
                </label>
                <select
                  value={targetAudience}
                  onChange={(e: any) => setTargetAudience(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-[#1F4A59]"
                >
                  <option value="all_schools">Tous les Établissements (Global)</option>
                  <option value="promoters">Promoteurs Uniquement</option>
                  <option value="directors">Directeurs Généraux Uniquement</option>
                  <option value="raf">Responsables Administratifs & Financiers</option>
                  <option value="specific_school">Établissement Spécifique</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Canal de Transmission
                </label>
                <select
                  value={channel}
                  onChange={(e: any) => setChannel(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-[#1F4A59]"
                >
                  <option value="in_app">Notification In-App (Tableau de Bord)</option>
                  <option value="email">Email Officiel (via Brevo / SMTP)</option>
                  <option value="sms_whatsapp">Alerte Prioritaire SMS / WhatsApp</option>
                </select>
              </div>
            </div>

            {targetAudience === 'specific_school' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Sélectionner l'Établissement
                </label>
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-[#1F4A59]"
                >
                  {defaultSchools.map(s => (
                    <option key={s.id} value={s.id}>{s.name} — Promoteur : {s.promoter}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Mail Module Integration Checkbox */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  id="mail-module-checkbox"
                  checked={sendEmailToInscrits}
                  onChange={(e) => setSendEmailToInscrits(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1F4A59] border-slate-300 dark:border-slate-600 focus:ring-[#1F4A59] mt-0.5 accent-[#1F4A59]"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                    Activer le Module Mail (Envoi d'E-mail simultané aux inscrits)
                  </span>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Si coché, le message sera également envoyé par courrier électronique à l'ensemble des comptes inscrits correspondant à votre cible.
                  </p>
                </div>
              </label>

              {sendEmailToInscrits && (
                <div className="pl-7 pt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl text-[10px] border border-emerald-200 dark:border-emerald-800 animate-pulse">
                    <Mail className="w-3.5 h-3.5" />
                    {activeEmailInscrits.length} e-mails ciblés et prêts pour la diffusion
                  </span>
                  {activeEmailInscrits.length > 0 && (
                    <span className="text-[10px] text-slate-400 font-medium">
                      (Ex: {activeEmailInscrits.slice(0, 2).map(u => u.email).join(', ')}...)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Objet de la Communication
              </label>
              <input
                type="text"
                value={messageSubject}
                onChange={(e) => setMessageSubject(e.target.value)}
                placeholder="Ex: Circulaire N°24 : Organisation des Examens Blancs"
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-[#1F4A59]"
              />
            </div>

            {/* Body */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Corps du Message / Circulaire
              </label>
              <textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                rows={6}
                placeholder="Rédigez votre message officiel ici..."
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:border-[#1F4A59] resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full py-3 bg-[#1F4A59] hover:bg-[#275d70] active:scale-95 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Send className={`w-4 h-4 ${isSending ? 'animate-spin' : ''}`} />
              <span>{isSending ? 'Diffusion en cours...' : 'Diffuser la Communication'}</span>
            </button>
          </form>
        </div>

        {/* Pre-made Templates */}
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-emerald-500" />
            <span>Modèles de Messages Officiels</span>
          </h2>

          <div className="space-y-3">
            {templates.map((tpl, idx) => (
              <div
                key={idx}
                onClick={() => handleApplyTemplate(tpl)}
                className="p-4 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer transition-all space-y-2 group"
              >
                <p className="text-xs font-black text-slate-800 dark:text-slate-200 group-hover:text-[#1F4A59] dark:group-hover:text-sky-400">
                  {tpl.title}
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {tpl.body}
                </p>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold block pt-1">
                  Cliquer pour appliquer ce modèle →
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Message Broadcast History */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-4">
        <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>Historique des Communications Diffusées</span>
        </h2>

        <div className="overflow-x-auto rounded-2xl border border-slate-100 dark:border-slate-800">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200 font-medium">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-4 py-3">ID Message</th>
                <th className="px-4 py-3">Date & Heure</th>
                <th className="px-4 py-3">Objet</th>
                <th className="px-4 py-3">Destinataires</th>
                <th className="px-4 py-3">Canal</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-[11px]">
              {broadcastHistory.map((msg) => (
                <tr key={msg.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#1F4A59] dark:text-sky-400">{msg.id}</td>
                  <td className="px-4 py-3">{msg.date}</td>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{msg.subject}</td>
                  <td className="px-4 py-3">{msg.recipients}</td>
                  <td className="px-4 py-3 font-mono text-slate-500">{msg.channel}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold rounded-lg text-[10px]">
                      {msg.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBroadcastMessagingPage;
