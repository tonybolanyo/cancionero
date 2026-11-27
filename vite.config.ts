import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const base = process.env.VITE_BASE_URL || process.env.BASE_PATH || '/cancionero/';
  return {
    base: base.endsWith('/') ? base : `${base}/`,
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'sync-assets-plugin',
        buildStart() {
          try {
            const rootCatalog = path.resolve(rootDir, 'catalog.json');
            const publicDir = path.resolve(rootDir, 'public');
            const publicCatalog = path.resolve(publicDir, 'catalog.json');
            if (!fs.existsSync(publicDir)) {
              fs.mkdirSync(publicDir, { recursive: true });
            }
            if (fs.existsSync(rootCatalog)) {
              fs.copyFileSync(rootCatalog, publicCatalog);
            }
            const bundledPath = path.resolve(rootDir, 'src/data/bundledSongs.json');
            if (fs.existsSync(rootCatalog) && !fs.existsSync(bundledPath)) {
              fs.copyFileSync(rootCatalog, bundledPath);
            }
            const wasmSource = path.resolve(rootDir, 'node_modules/essentia.js/dist/essentia-wasm.web.wasm');
            const publicWasm = path.resolve(publicDir, 'essentia-wasm.web.wasm');
            if (fs.existsSync(wasmSource) && !fs.existsSync(publicWasm)) {
              fs.copyFileSync(wasmSource, publicWasm);
            }
            const publicDataDir = path.resolve(publicDir, 'data');
            if (!fs.existsSync(publicDataDir)) {
              fs.mkdirSync(publicDataDir, { recursive: true });
            }
            for (const dictFile of ['chord-dictionary.json', 'scale-dictionary.json']) {
              const srcDict = path.resolve(rootDir, 'data', dictFile);
              const dstDict = path.resolve(publicDataDir, dictFile);
              if (fs.existsSync(srcDict)) {
                fs.copyFileSync(srcDict, dstDict);
              }
            }
          } catch (err) {
            console.warn('Vite assets sync plugin notice:', err);
          }
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
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
