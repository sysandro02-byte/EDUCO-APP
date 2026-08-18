import React, { useEffect } from 'react';
import { XIcon } from './Icons';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemType?: string;
  itemName?: string;
  itemDetails?: string;
  message?: React.ReactNode;
  warningNote?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmer la suppression',
  itemType,
  itemName,
  itemDetails,
  message,
  warningNote = 'Cette action est définitive et ne pourra pas être annulée.',
  confirmText = 'Supprimer définitivement',
  cancelText = 'Annuler',
  isDestructive = true,
  size = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/20 dark:border-slate-800 w-full ${sizeClasses[size]} overflow-hidden transform transition-all animate-in zoom-in-95 duration-300`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Icon */}
        <div className="p-8 pb-4">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-5">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                  isDestructive 
                    ? 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 shadow-red-200/50 dark:shadow-none' 
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 shadow-amber-200/50 dark:shadow-none'
                }`}
              >
                {isDestructive ? (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                ) : (
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                )}
              </div>

              <div>
                <h3 id="confirm-dialog-title" className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  {title}
                </h3>
                {itemType && (
                  <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 mt-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    {itemType}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              aria-label="Fermer"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Body content */}
          <div className="mt-6 text-base text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {message ? (
              <div>{message}</div>
            ) : (
              <div>
                <p>
                  Êtes-vous sûr de vouloir supprimer {itemType ? `${itemType} ` : ''}
                  {itemName ? <strong className="text-slate-900 dark:text-white font-black underline decoration-red-500/30 underline-offset-4">{itemName}</strong> : 'cet élément'} ?
                </p>
                {itemDetails && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {itemDetails}
                  </div>
                )}
              </div>
            )}

            {warningNote && (
              <div className="p-4 mt-6 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/50 text-xs font-bold text-amber-700 dark:text-amber-400 flex items-start gap-3">
                <svg className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="leading-relaxed uppercase tracking-wider">{warningNote}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm active:scale-95"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-white transition-all shadow-lg active:scale-95 flex items-center gap-3 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 shadow-red-200/50 dark:shadow-none'
                : 'bg-[#1F4A59] hover:bg-[#153540] shadow-[#1F4A59]/20 dark:shadow-none'
            }`}
          >
            {isDestructive && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
