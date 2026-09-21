import React from 'react';
import ReactDOM from 'react-dom/client';
import InstitutionalEntryApp from './components/InstitutionalEntryApp';
import './src/index.css';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Analytics } from '@vercel/analytics/react';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import { installSessionExpiryGuard, restorePersistentSession } from './src/services/sessionExpiryGuard';

installSessionExpiryGuard();


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

const renderApp = async () => {
  // Installed PWAs open with a fresh sessionStorage. A persistent credential
  // must be verified by /api/auth/me before EDUCO restores the session marker.
  await restorePersistentSession();

  root.render(
    <AppErrorBoundary>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id'}>
        <InstitutionalEntryApp />
        <PwaInstallPrompt />
        <Analytics />
      </GoogleOAuthProvider>
    </AppErrorBoundary>
  );
};

void renderApp();
