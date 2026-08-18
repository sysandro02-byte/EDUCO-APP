import React, { useState, useEffect, useRef } from 'react';
import { XIcon } from './Icons';

interface Message {
  id: string;
  senderName: string;
  senderRole: string;
  avatar: string;
  text: string;
  timestamp: string;
}

interface UserProfile {
    name: string;
    avatar: string;
    role: string;
}

interface MessagingPanelProps {
  messages: Message[];
  currentUserProfile: UserProfile;
  onSendMessage: (text: string) => void;
  onClose: () => void;
}

const MessagingPanel: React.FC<MessagingPanelProps> = ({ messages, currentUserProfile, onSendMessage, onClose }) => {
  const [newMessage, setNewMessage] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  return (
    <div ref={panelRef} className="fixed top-16 right-4 sm:right-6 lg:right-8 w-[90vw] max-w-md h-[70vh] bg-white rounded-lg shadow-xl border border-gray-200 z-50 flex flex-col">
      <div className="flex justify-between items-center p-3 border-b">
        <h4 className="font-semibold text-gray-800">Messagerie de Groupe</h4>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><XIcon /></button>
      </div>
      <div className="flex-grow p-4 overflow-y-auto bg-gray-50">
        {messages.map((msg) => {
          const isCurrentUser = msg.senderName === currentUserProfile.name;
          return (
            <div key={msg.id} className={`flex items-start gap-2.5 my-4 ${isCurrentUser ? 'justify-end' : ''}`}>
              {!isCurrentUser && <img className="w-8 h-8 rounded-full" src={msg.avatar || 'https://via.placeholder.com/32'} alt={msg.senderName} />}
              <div className={`flex flex-col w-full max-w-[320px] leading-1.5 p-3 border-gray-200 ${isCurrentUser ? 'bg-blue-100 rounded-s-xl rounded-ee-xl' : 'bg-gray-100 rounded-e-xl rounded-es-xl'}`}>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <span className="text-sm font-semibold text-gray-900">{isCurrentUser ? 'Vous' : msg.senderName}</span>
                </div>
                <p className="text-sm font-normal py-2 text-gray-900">{msg.text}</p>
              </div>
               {isCurrentUser && <img className="w-8 h-8 rounded-full" src={msg.avatar || 'https://via.placeholder.com/32'} alt={msg.senderName} />}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-3 border-t bg-white">
        <div className="flex items-center">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Écrivez un message..."
            className="flex-grow bg-gray-100 text-gray-700 placeholder-gray-400 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-[#1F4A59]"
          />
          <button type="submit" className="ml-3 px-4 py-2 bg-[#1F4A59] text-white rounded-full hover:bg-[#2c5a6e] transition-colors">
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
};

export default MessagingPanel;