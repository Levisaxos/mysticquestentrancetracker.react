import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// Which commit produced this build. CI hands it to us directly; locally we ask
// git; failing both, say so honestly rather than printing something misleading.
function commitHash() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig(({ command }) => ({
  // GitHub Pages serves from https://<user>.github.io/<repo>/, so a production
  // build needs the repo name as a base path. Dev serves from the root, so
  // http://localhost:3000 just works instead of bouncing through a redirect.
  // Override with VITE_BASE when deploying elsewhere (a custom domain wants '/').
  base: command === 'build'
    ? (process.env.VITE_BASE ?? '/mysticquestentrancetracker.react/')
    : '/',

  plugins: [react()],

  // Stamped in at build time so the footer can say exactly what is deployed.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
    __COMMIT_HASH__: JSON.stringify(commitHash()),
  },

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
