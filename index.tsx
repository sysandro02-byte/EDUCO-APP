import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Analytics } from '@vercel/analytics/react';
import PwaInstallPrompt from './components/PwaInstallPrompt';

// Cache the full current Vite build at installation. The worker is deliberately
// registered here (instead of relying on a remote CDN) so installed EDUCO keeps
// its layout when the device is offline.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      registration.update().catch(() => undefined);
    }).catch(error => {
      console.warn('Impossible d’activer le mode hors connexion :', error);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}
const root = ReactDOM.createRoot(rootElement);

root.render(
  <GoogleOAuthProvider clientId={(import.meta as any).env.VITE_GOOGLE_CLIENT_ID || 'dummy-client-id'}>
    <App />
    <PwaInstallPrompt />
    <Analytics />
  </GoogleOAuthProvider>
);
