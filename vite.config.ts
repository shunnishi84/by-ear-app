import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' so the build works from any sub path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  plugins: [react()],
  worker: { format: 'es' },
  // tfjs (lazy-loaded for chord mode) is ~1 MB on its own.
  build: { chunkSizeWarningLimit: 1100 },
});
