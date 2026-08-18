import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './src/index.css';
import './index.css';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Analytics } from '@vercel/analytics/react';

// Service Worker auto-update and cache buster strategy
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Force update check on load
      reg.update().catch(() => {});
      
      reg.addEventListener('updatefound', () => {
        const installingWorker = reg.installing;
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('Nouvelle version d\'EDUCO disponible. Actualisation automatique...');
              window.location.reload();
            }
          });
        }
      });
    }).catch(err => {
      console.warn('Erreur enregistrement Service Worker:', err);
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
    <Analytics />
  </GoogleOAuthProvider>
);

