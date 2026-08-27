import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, size = 'lg' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-3xl',
    '2xl': 'max-w-5xl',
    '4xl': 'max-w-7xl',
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[100] flex justify-center items-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto" 
      onClick={onClose}
    >
      <div 
        className={`bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full ${sizeClasses[size]} p-4 sm:p-6 md:p-8 relative max-h-[92vh] flex flex-col border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 duration-200 my-auto overflow-hidden`} 
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4 sm:mb-6 shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-base sm:text-xl font-black text-[#1F4A59] dark:text-sky-400 tracking-tight truncate pr-4">{title}</h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer shrink-0"
            aria-label="Fermer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1">
          {children}
        </div>
      </div>
    </div>
  , document.body);
};

export default Modal;
