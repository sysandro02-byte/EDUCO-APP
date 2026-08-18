import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const hasApostropheInProjectPath = __dirname.includes("'");

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3001,
        strictPort: false,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          disable: hasApostropheInProjectPath,
          registerType: 'autoUpdate',
          includeAssets: ['icon-192.png', 'icon-512.png'],
          manifest: {
            name: 'EDUCO - Gestion Scolaire & Financière',
            short_name: 'EDUCO',
            description: 'Application PWA complète de gestion scolaire, comptabilité, notes, bulletins et paie de l\'établissement',
            theme_color: '#1F4A59',
            background_color: '#1F4A59',
            display: 'standalone',
            display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
            orientation: 'portrait-primary',
            scope: '/',
            start_url: '/',
            id: '/?source=pwa',
            lang: 'fr-FR',
            dir: 'ltr',
            categories: ['education', 'finance', 'productivity', 'business'],
            icons: [
              {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable'
              },
              {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any'
              },
              {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
              }
            ],
            shortcuts: [
              {
                name: 'Tableau de Bord',
                short_name: 'Dashboard',
                description: 'Accéder directement au tableau de bord',
                url: '/?page=Tableau+de+Bord',
                icons: [{ src: '/icon-192.png', sizes: '192x192' }]
              },
              {
                name: 'Paiements & Caisse',
                short_name: 'Caisse',
                description: 'Enregistrer un paiement de frais scolaire',
                url: '/?page=Paiements',
                icons: [{ src: '/icon-192.png', sizes: '192x192' }]
              },
              {
                name: 'Gestion des Élèves',
                short_name: 'Élèves',
                description: 'Consulter la liste et les dossiers des élèves',
                url: '/?page=Élèves',
                icons: [{ src: '/icon-192.png', sizes: '192x192' }]
              }
            ]
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'gstatic-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          },
          devOptions: {
            enabled: false
          }
        })
      ],
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom'],
              'vendor-charts': ['recharts'],
              'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas']
            }
          }
        }
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
