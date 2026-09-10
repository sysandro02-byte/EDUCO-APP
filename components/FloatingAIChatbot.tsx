import React, { useMemo, useState } from 'react';
import { Bot, Send, X, ShieldCheck, FileText, Settings2 } from 'lucide-react';
import { User } from './UserForm';
import { SchoolSettings } from '../App';

interface FloatingAIChatbotProps {
  currentUser: User | null;
  currentUserRole?: string | null;
  schoolSettings?: SchoolSettings;
  transactions?: any[];
  users?: User[];
  payments?: any[];
  hasCriticalAlert?: boolean;
}

const getStoredConfig = () => {
  try {
    return JSON.parse(localStorage.getItem('EDUCO_AI_CHATBOT_CONFIG') || '{}');
  } catch {
    return {};
  }
};

const FloatingAIChatbot: React.FC<FloatingAIChatbotProps> = ({
  currentUser,
  currentUserRole,
  schoolSettings,
  transactions = [],
  users = [],
  payments = [],
  hasCriticalAlert = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [ownerApproved, setOwnerApproved] = useState(false);
  const [messages, setMessages] = useState<{ from: 'user' | 'assistant'; text: string }[]>([]);
  const config = getStoredConfig();

  const isEnabled = config.enabled !== false;
  const assistantName = !config.name || config.name === 'Assistant EDUCO IA' ? 'Luna' : config.name;
  const canConfigure = ownerApproved && config.allowAccountSettings !== false;

  const contextSummary = useMemo(() => {
    const role = currentUserRole || currentUser?.role || 'Utilisateur';
    const activeStudents = users.filter(u => u.role === 'Élève').length;
    const pendingOps = transactions.filter(t => t.status === 'En attente').length;
    const paidAmount = transactions
      .filter(t => t.type === 'Revenu' && t.status !== 'Rejeté')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    return `Compte: ${role}. Établissement: ${schoolSettings?.name || 'EDUCO'}. Élèves: ${activeStudents}. Paiements suivis: ${payments.length}. Opérations en attente: ${pendingOps}. Recettes enregistrées: ${paidAmount.toLocaleString('fr-FR')} ${schoolSettings?.currency || 'FCFA'}.`;
  }, [currentUserRole, currentUser, schoolSettings, users, payments, transactions]);

  if (!isEnabled) return null;

  const answerMessage = (raw: string) => {
    const text = raw.toLowerCase();
    if (/rapport|synthèse|synthese|résume|resume/.test(text)) {
      return `Synthèse rapide : ${contextSummary}`;
    }
    if (/param|config|réglage|reglage/.test(text)) {
      return canConfigure
        ? "Je peux vous guider dans les réglages du compte. Pour toute action sensible, une confirmation du propriétaire du compte restera obligatoire."
        : "Je peux expliquer les réglages disponibles, mais je ne peux pas modifier ce compte sans autorisation explicite du propriétaire.";
    }
    if (/paiement|caisse|validation/.test(text)) {
      const pendingOps = transactions.filter(t => t.status === 'En attente').length;
      return `Caisse : ${pendingOps} opération(s) attendent une validation. Les validations restent réservées au RAF et au Directeur Général.`;
    }
    return `Je suis ${assistantName}. Je peux expliquer les informations du compte, résumer les paiements, préparer des synthèses et guider les réglages autorisés. ${contextSummary}`;
  };

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessages(prev => [...prev, { from: 'user', text: trimmed }, { from: 'assistant', text: answerMessage(trimmed) }]);
    setMessage('');
  };

  return (
    <div className="fixed right-5 bottom-5 z-50 print:hidden">
      {isOpen && (
        <div className="mb-3 w-[min(360px,calc(100vw-2.5rem))] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
          <div className={`${hasCriticalAlert ? 'bg-rose-700' : 'bg-[#1F4A59]'} text-white px-4 py-3 flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-emerald-300" />
              <div>
                <p className="text-sm font-black">{assistantName}</p>
                <p className="text-[10px] text-slate-200">{hasCriticalAlert ? 'Alerte détectée, vérification recommandée' : 'Piloté par IA, sécurisé par autorisation'}</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg" aria-label="Fermer le chatbot">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-3 max-h-80 overflow-y-auto bg-slate-50">
            <div className="rounded-xl bg-white border border-slate-200 p-3 text-xs text-slate-700">
              <p className="font-bold text-slate-900 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Capacités</p>
              <p className="mt-1">Informations, synthèses, rapports courts et aide aux réglages autorisés selon le compte.</p>
            </div>
            {messages.map((entry, index) => (
              <div key={index} className={`rounded-xl px-3 py-2 text-xs ${entry.from === 'user' ? 'bg-[#1F4A59] text-white ml-8' : 'bg-white border border-slate-200 text-slate-700 mr-8'}`}>
                {entry.text}
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-slate-200 space-y-2">
            <label className="flex items-start gap-2 text-[11px] text-slate-600">
              <input type="checkbox" checked={ownerApproved} onChange={e => setOwnerApproved(e.target.checked)} className="mt-0.5 rounded text-[#1F4A59]" />
              <span><ShieldCheck className="w-3.5 h-3.5 inline mr-1" />J'autorise l'assistant à guider les réglages de ce compte.</span>
            </label>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                placeholder="Demander une synthèse, un rapport, une aide..."
                className="flex-1 rounded-xl border-slate-300 text-xs focus:ring-[#1F4A59]"
              />
              <button onClick={handleSend} className="p-2 rounded-xl bg-[#1F4A59] text-white hover:bg-[#2c5a6e]" aria-label="Envoyer">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
      <button
        onClick={() => setIsOpen(v => !v)}
        className={`w-14 h-14 rounded-full text-white shadow-2xl border-4 border-white flex items-center justify-center hover:scale-105 transition-transform ${
          hasCriticalAlert ? 'bg-rose-600 animate-pulse ring-4 ring-rose-300/70' : 'bg-[#1F4A59]'
        }`}
        title={assistantName}
      >
        {isOpen ? <Settings2 className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>
    </div>
  );
};

export default FloatingAIChatbot;
