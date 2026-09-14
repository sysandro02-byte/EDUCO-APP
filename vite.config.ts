import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DEV_API_TARGET = 'https://educo-app.onrender.com';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const devApiTarget = (env.VITE_DEV_API_TARGET || DEFAULT_DEV_API_TARGET).replace(/\/$/, '');

  return {
    server: {
      port: 3001,
      strictPort: false,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
          secure: true,
        },
        '/auth': {
          target: devApiTarget,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('node_modules')) {
              if (normalizedId.includes('/components/')) return 'app-components';
              if (normalizedId.includes('/src/services/')) return 'app-services';
              if (normalizedId.includes('/src/lib/')) return 'app-lib';
              return undefined;
            }
            if (normalizedId.includes('lucide-react')) return 'vendor-icons';
            if (
              normalizedId.includes('react-dom') ||
              normalizedId.includes('react/') ||
              normalizedId.endsWith('/react/index.js')
            ) return 'vendor-react';
            if (normalizedId.includes('recharts') || normalizedId.includes('d3-')) return 'vendor-charts';
            if (
              normalizedId.includes('jspdf') ||
              normalizedId.includes('html2canvas') ||
              normalizedId.includes('dompurify')
            ) return 'vendor-pdf';
            if (normalizedId.includes('@supabase')) return 'vendor-supabase';
            if (normalizedId.includes('@google/genai') || normalizedId.includes('groq-sdk')) return 'vendor-ai';
            if (normalizedId.includes('@simplewebauthn') || normalizedId.includes('@react-oauth')) return 'vendor-auth';
            if (normalizedId.includes('@e965/xlsx')) return 'vendor-xlsx';
            return undefined;
          },
        },
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
