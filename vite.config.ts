import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages serves this project from /cresco/, not from the domain root.
  // The client resolves its one data fetch off import.meta.env.BASE_URL, so
  // setting this is all that differs between the two deployments.
  base: process.env.VITE_BASE || '/',
  build: { outDir: 'dist/client', emptyOutDir: true },
});
