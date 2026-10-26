import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const base = process.env.VITE_BASE_URL || process.env.BASE_PATH || '/cancionero/';
  return {
    base: base.endsWith('/') ? base : `${base}/`,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'sync-catalog-file',
        buildStart() {
          try {
            const rootCatalog = path.resolve(__dirname, 'catalog.json');
            const publicDir = path.resolve(__dirname, 'public');
            const publicCatalog = path.resolve(publicDir, 'catalog.json');
            if (!fs.existsSync(publicDir)) {
              fs.mkdirSync(publicDir, { recursive: true });
            }
            if (fs.existsSync(rootCatalog)) {
              fs.copyFileSync(rootCatalog, publicCatalog);
            }
          } catch (err) {
            console.warn('Vite sync-catalog plugin notice:', err);
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
