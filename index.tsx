import React from 'react';
import ReactDOM from 'react-dom/client';
import InstitutionalEntryApp from './components/InstitutionalEntryApp';
import './src/index.css';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Analytics } from '@vercel/analytics/react';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { installSessionExpiryGuard } from './src/services/sessionExpiryGuard';

installSessionExpiryGuard();

// An installed PWA opens in a new browsing context, so sessionStorage is not
// shared with the browser tab that performed the login. localStorage and the
// Supabase auth storage are origin-scoped and are shared. Restore only the
// transient "session active" marker when an authenticated credential exists;
// App.tsx still performs the normal user/session restoration afterwards.
const restoreInstalledPwaSessionMarker = () => {
  if (sessionStorage.getItem('EDUCO_SESSION_ACTIVE') === 'true') return;

  const hasEducoSessionToken = Boolean(localStorage.getItem('EDUCO_USER_TOKEN'));
  let hasSupabaseSession = false;

  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const stored = JSON.parse(raw);
      const expiresAt = Number(stored?.expires_at || stored?.currentSession?.expires_at || 0);
      if (!expiresAt || expiresAt * 1000 > Date.now()) {
        hasSupabaseSession = true;
        break;
      }
    }
  } catch {
    hasSupabaseSession = false;
  }

  if (hasEducoSessionToken || hasSupabaseSession) {
    sessionStorage.setItem('EDUCO_SESSION_ACTIVE', 'true');
  }
};

restoreInstalledPwaSessionMarker();

class AppErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[EDUCO] Erreur de rendu non récupérée :', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'sans-serif' }}>
          <section style={{ maxWidth: 560, textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, marginBottom: 12 }}>EDUCO n’a pas pu afficher cette page</h1>
            <p style={{ marginBottom: 20 }}>
              Rechargez l’application. Si le problème persiste, videz le cache du site puis réessayez.
            </p>
            <button type="button" onClick={() => window.location.reload()} style={{ padding: '10px 16px', cursor: 'pointer' }}>
              Recharger EDUCO
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').then(registration => {
        registration.update().catch(() => undefined);
      }).catch(error => {
        console.warn('Impossible d’activer le mode hors connexion :', error);
      });
      return;
    }

    // A previously installed production worker can intercept Vite assets and
    // leave the AI Studio/local preview blank or stale. Development must stay
    // entirely controlled by Vite.
    const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
    await Promise.all(registrations.map(registration => registration.unregister()));
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}
const root = ReactDOM.createRoot(rootElement);

root.render(
  <AppErrorBoundary>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id'}>
      <InstitutionalEntryApp />
      <PwaInstallPrompt />
      <Analytics />
    </GoogleOAuthProvider>
  </AppErrorBoundary>
);
