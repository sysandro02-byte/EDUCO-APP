export type AppFeedbackType = 'info' | 'warning' | 'error' | 'success';

export const showAppFeedback = (
  message: string,
  type: AppFeedbackType = 'info',
  title?: string
) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('educo:modal-feedback', {
    detail: {
      message,
      type,
      title: title || (type === 'success' ? 'Succès' : type === 'error' ? 'Erreur' : type === 'warning' ? 'Avertissement' : 'Information')
    }
  }));
};
