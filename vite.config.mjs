import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  // GitHub Pages serves from https://<user>.github.io/<repo>/, so a production
  // build needs the repo name as a base path. Dev serves from the root, so
  // http://localhost:3000 just works instead of bouncing through a redirect.
  // Override with VITE_BASE when deploying elsewhere (a custom domain wants '/').
  base: command === 'build'
    ? (process.env.VITE_BASE ?? '/mysticquestentrancetracker.react/')
    : '/',

  plugins: [react()],

  server: {
    port: 3000,
    open: true,
  },

  build: {
    outDir: 'build',
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js',
    css: false,
  },
}));
