import React from 'react';
import { XIcon } from './Icons';
import { AlertCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export interface AlertDialogModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string | React.ReactNode;
  type?: 'info' | 'warning' | 'error' | 'success';
  buttonText?: string;
}

const AlertDialogModal: React.FC<AlertDialogModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  buttonText = 'Compris'
}) => {
  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'warning':
      case 'error':
        return {
          bgIcon: 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
          icon: <AlertTriangle className="w-7 h-7" />,
          defaultTitle: 'Information / Avertissement',
          btnBg: 'bg-[#1F4A59] hover:bg-[#2c5a6e] text-white',
        };
      case 'success':
        return {
          bgIcon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
          icon: <CheckCircle2 className="w-7 h-7" />,
          defaultTitle: 'Succès',
          btnBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
        };
      case 'info':
      default:
        return {
          bgIcon: 'bg-sky-100 text-sky-700 dark:bg-sky-950/80 dark:text-sky-400 border border-sky-200 dark:border-sky-800',
          icon: <Info className="w-7 h-7" />,
          defaultTitle: 'Notification',
          btnBg: 'bg-[#1F4A59] hover:bg-[#2c5a6e] text-white',
        };
    }
  };

  const style = getTypeStyles();
  const displayTitle = title || style.defaultTitle;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 w-full max-w-md overflow-hidden transform transition-all animate-in zoom-in-95 duration-300 p-10 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Fermer"
        >
          <XIcon className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-current/10 ${style.bgIcon}`}>
            {React.cloneElement(style.icon as React.ReactElement<any>, { className: 'w-10 h-10' })}
          </div>

          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3 tracking-tight leading-tight">
            {displayTitle}
          </h3>

          <div className="text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 px-2">
            {message}
          </div>

          <button
            onClick={onClose}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95 ${style.btnBg}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDialogModal;
