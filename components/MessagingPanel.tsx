import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Send, UserRound } from 'lucide-react';
import { XIcon } from './Icons';
import { User } from './UserForm';

interface Message {
  id: string;
  senderName: string;
  senderRole: string;
  avatar: string;
  text: string;
  timestamp: string;
  recipientId?: number | null;
}

interface UserProfile { name: string; avatar: string; role: string; }
interface MessagingPanelProps {
  messages: Message[];
  currentUserProfile: UserProfile;
  currentUserId: number | null;
  recipients: User[];
  onSendMessage: (text: string, recipient?: User | null) => void;
  onClose: () => void;
}

const MessagingPanel: React.FC<MessagingPanelProps> = ({ messages, currentUserProfile, currentUserId, recipients, onSendMessage, onClose }) => {
  const [newMessage, setNewMessage] = useState('');
  const [mode, setMode] = useState<'channel' | 'direct'>('channel');
  const [recipientId, setRecipientId] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recipient = useMemo(() => recipients.find(user => String(user.id) === recipientId) || null, [recipients, recipientId]);
  const visibleMessages = useMemo(() => {
    if (mode === 'channel') return messages.filter(message => !message.recipientId);
    if (!recipient) return [];
    return messages.filter(message => String(message.recipientId) === String(recipient.id));
  }, [messages, mode, recipient]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [visibleMessages]);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMessage.trim() || (mode === 'direct' && !recipient)) return;
    onSendMessage(newMessage.trim(), mode === 'direct' ? recipient : null);
    setNewMessage('');
  };

  return (
    <div ref={panelRef} className="fixed top-16 right-4 sm:right-6 lg:right-8 w-[92vw] max-w-md h-[72vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 flex flex-col overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
        <div><h4 className="font-black text-slate-900 dark:text-white text-sm">Messagerie</h4><p className="text-[11px] text-slate-500 dark:text-slate-300">Canal d’équipe ou destinataire précis</p></div>
        <button onClick={onClose} className="text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white" aria-label="Fermer la messagerie"><XIcon /></button>
      </div>
      <div className="px-3 pt-3 space-y-2 bg-white dark:bg-slate-900">
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-bold">
          <button type="button" onClick={() => setMode('channel')} className={`rounded-lg py-2 flex items-center justify-center gap-1 ${mode === 'channel' ? 'bg-white dark:bg-slate-700 shadow text-[#1F4A59] dark:text-sky-300' : 'text-slate-500 dark:text-slate-300'}`}><Hash className="w-3.5 h-3.5" /> Canal général</button>
          <button type="button" onClick={() => setMode('direct')} className={`rounded-lg py-2 flex items-center justify-center gap-1 ${mode === 'direct' ? 'bg-white dark:bg-slate-700 shadow text-[#1F4A59] dark:text-sky-300' : 'text-slate-500 dark:text-slate-300'}`}><UserRound className="w-3.5 h-3.5" /> Individuel</button>
        </div>
        {mode === 'direct' && <select value={recipientId} onChange={event => setRecipientId(event.target.value)} className="w-full rounded-xl border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-[#1F4A59]"><option value="">Choisir un destinataire de l’établissement</option>{recipients.map(user => <option key={String(user.id)} value={String(user.id)}>{user.name} — {user.role}</option>)}</select>}
      </div>
      <div className="flex-grow p-4 overflow-y-auto bg-slate-50 dark:bg-slate-950 space-y-3">
        {mode === 'direct' && !recipient ? <p className="text-center text-xs text-slate-500 dark:text-slate-300 pt-10">Choisissez un destinataire pour ouvrir la conversation.</p> : visibleMessages.length === 0 ? <p className="text-center text-xs text-slate-500 dark:text-slate-300 pt-10">Aucun message dans cette conversation.</p> : visibleMessages.map(msg => {
          const isCurrentUser = msg.senderName === currentUserProfile.name || (msg.recipientId && String(msg.senderName) === String(currentUserId));
          return <div key={msg.id} className={`flex items-start gap-2.5 ${isCurrentUser ? 'justify-end' : ''}`}>
            {!isCurrentUser && <img className="w-8 h-8 rounded-full bg-slate-200" src={msg.avatar || 'https://via.placeholder.com/32'} alt="" />}
            <div className={`flex flex-col max-w-[78%] p-3 border ${isCurrentUser ? 'bg-[#1F4A59] text-white border-[#1F4A59] rounded-s-xl rounded-ee-xl' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-700 rounded-e-xl rounded-es-xl'}`}><span className={`text-[11px] font-black ${isCurrentUser ? 'text-emerald-100' : 'text-slate-700 dark:text-slate-200'}`}>{isCurrentUser ? 'Vous' : msg.senderName}</span><p className="text-sm font-medium py-1">{msg.text}</p><span className={`text-[10px] ${isCurrentUser ? 'text-slate-200' : 'text-slate-500 dark:text-slate-300'}`}>{msg.timestamp}</span></div>
          </div>;
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center gap-2"><input type="text" value={newMessage} onChange={event => setNewMessage(event.target.value)} placeholder={mode === 'direct' ? (recipient ? `Écrire à ${recipient.name}…` : 'Choisissez d’abord un destinataire') : 'Écrire au canal général…'} disabled={mode === 'direct' && !recipient} className="flex-grow bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-300 rounded-full py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F4A59] disabled:opacity-60" /><button type="submit" disabled={!newMessage.trim() || (mode === 'direct' && !recipient)} className="p-2.5 bg-[#1F4A59] text-white rounded-full hover:bg-[#2c5a6e] disabled:opacity-40" aria-label="Envoyer"><Send className="w-4 h-4" /></button></form>
    </div>
  );
};

export default MessagingPanel;
