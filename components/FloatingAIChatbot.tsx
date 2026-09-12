import React, { useEffect, useMemo, useState } from 'react';
import { Bot, LoaderCircle, Send, ShieldCheck, Sparkles, X } from 'lucide-react';
import { User } from './UserForm';
import { SchoolSettings } from '../App';
import { askLuna } from '../src/services/api';

interface FloatingAIChatbotProps {
  currentUser: User | null;
  currentUserRole?: string | null;
  schoolSettings?: SchoolSettings;
  transactions?: any[];
  users?: User[];
  payments?: any[];
  hasCriticalAlert?: boolean;
}

type LunaConfig = { enabled?: boolean; name?: string; allowAccountSettings?: boolean; model?: string; temperature?: number; };
const getStoredConfig = (): LunaConfig => {
  try { return JSON.parse(localStorage.getItem('EDUCO_AI_CHATBOT_CONFIG') || '{}'); } catch { return {}; }
};

const FloatingAIChatbot: React.FC<FloatingAIChatbotProps> = ({ currentUser, currentUserRole, schoolSettings, transactions = [], users = [], payments = [], hasCriticalAlert = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [ownerApproved, setOwnerApproved] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<{ from: 'user' | 'assistant'; text: string }[]>([]);
  const [config, setConfig] = useState<LunaConfig>(() => getStoredConfig());
  const isEnabled = config.enabled !== false;
  const assistantName = !config.name || config.name === 'Assistant EDUCO IA' ? 'Luna' : config.name.slice(0, 40);
  const role = currentUserRole || currentUser?.role || 'Utilisateur';
  const context = useMemo(() => ({
    rôle: role,
    établissement: schoolSettings?.name || 'EDUCO',
    élèves_actifs: users.filter(user => user.role === 'Élève').length,
    paiements_suivis: payments.length,
    opérations_en_attente: transactions.filter(transaction => transaction.status === 'En attente').length,
    alerte_critique: hasCriticalAlert,
  }), [role, schoolSettings, users, payments, transactions, hasCriticalAlert]);

  // Configuration is applied immediately when the administrator saves it in
  // the same tab, and also follows cross-tab localStorage updates.
  useEffect(() => {
    const refreshConfig = () => setConfig(getStoredConfig());
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'EDUCO_AI_CHATBOT_CONFIG') refreshConfig();
    };
    window.addEventListener('educo:luna-config', refreshConfig);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('educo:luna-config', refreshConfig);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const localFallback = (question: string) => {
    if (/réglage|paramètre|parametre|config/i.test(question)) return ownerApproved && config.allowAccountSettings !== false ? 'Je peux vous guider dans les réglages. Les changements sensibles nécessitent toujours votre confirmation dans l’écran concerné.' : 'Je peux expliquer les réglages, mais leur modification nécessite l’accord explicite du propriétaire du compte.';
    if (/paiement|caisse|validation/i.test(question)) return `Il y a ${context.opérations_en_attente} opération(s) en attente. Les validations restent soumises aux droits de votre rôle.`;
    return `Je fonctionne actuellement en mode d’aide local. Votre rôle est ${role} et ${context.élèves_actifs} élève(s) actif(s) sont comptabilisés. Configurez la clé du fournisseur sélectionné (GROQ_API_KEY ou GEMINI_API_KEY) sur le serveur pour activer les réponses génératives de Luna.`;
  };

  const handleSend = async (suggestedMessage?: string) => {
    const trimmed = String(suggestedMessage ?? message).trim();
    if (!trimmed || isSending) return;
    setMessages(previous => [...previous, { from: 'user', text: trimmed }]);
    setMessage('');
    setIsSending(true);
    const response = await askLuna({ message: trimmed, model: config.model, temperature: config.temperature, context });
    const reply = response?.success && response.reply ? response.reply : localFallback(trimmed);
    setMessages(previous => [...previous, { from: 'assistant', text: reply }]);
    setIsSending(false);
  };

  if (!isEnabled) return null;
  return <div className="fixed right-5 bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4.5rem))] sm:bottom-6 z-50 print:hidden">
    {isOpen && <div className="mb-3 w-[min(380px,calc(100vw-2.5rem))] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
      <div className={`${hasCriticalAlert ? 'bg-rose-700' : 'bg-[#1F4A59]'} text-white px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2"><Bot className="w-5 h-5 text-emerald-300" /><div><p className="text-sm font-black">{assistantName}</p><p className="text-[10px] text-slate-200">Assistant sécurisé · données agrégées uniquement</p></div></div>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg" aria-label="Fermer Luna"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-3 space-y-3 max-h-80 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-700 dark:text-slate-200"><p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Bonjour, je suis {assistantName}</p><p className="mt-1">Posez une question sur l’application, demandez une synthèse ou un guide. Je ne modifie jamais vos données à votre place.</p></div>
        {messages.length === 0 && <div className="flex flex-wrap gap-1.5"><button onClick={() => handleSend('Fais une synthèse de mon tableau de bord.')} className="rounded-full border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">Synthèse</button><button onClick={() => handleSend('Quels réglages puis-je modifier avec mon rôle ?')} className="rounded-full border border-sky-200 dark:border-sky-800 px-2.5 py-1 text-[10px] font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40">Mes droits</button><button onClick={() => handleSend('Explique les opérations en attente.')} className="rounded-full border border-amber-200 dark:border-amber-800 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40">Alertes</button></div>}
        {messages.map((entry, index) => <div key={index} className={`rounded-xl px-3 py-2 text-xs ${entry.from === 'user' ? 'bg-[#1F4A59] text-white ml-8' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-100 mr-8'}`}>{entry.text}</div>)}
        {isSending && <div className="text-xs text-slate-500 dark:text-slate-300 flex gap-2 items-center"><LoaderCircle className="w-4 h-4 animate-spin" /> Luna réfléchit…</div>}
      </div>
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
        <label className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300"><input type="checkbox" checked={ownerApproved} onChange={event => setOwnerApproved(event.target.checked)} className="mt-0.5 rounded text-[#1F4A59]" /><span><ShieldCheck className="w-3.5 h-3.5 inline mr-1" />J’autorise Luna à me guider dans les réglages.</span></label>
        <div className="flex gap-2"><input value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') handleSend(); }} placeholder="Demander une synthèse ou une aide…" className="flex-1 rounded-xl border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs focus:ring-[#1F4A59]" /><button onClick={() => handleSend()} disabled={!message.trim() || isSending} className="p-2 rounded-xl bg-[#1F4A59] text-white hover:bg-[#2c5a6e] disabled:opacity-40" aria-label="Envoyer à Luna"><Send className="w-4 h-4" /></button></div>
      </div>
    </div>}
    <button onClick={() => setIsOpen(value => !value)} className={`w-14 h-14 rounded-full text-white shadow-2xl border-4 border-white dark:border-slate-800 flex items-center justify-center hover:scale-105 transition-transform ${hasCriticalAlert ? 'bg-rose-600 animate-pulse ring-4 ring-rose-300/70' : 'bg-[#1F4A59]'}`} title={assistantName} aria-label={`Ouvrir ${assistantName}`}><Bot className="w-6 h-6" /></button>
  </div>;
};

export default FloatingAIChatbot;
