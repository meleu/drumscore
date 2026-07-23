import { fileURLToPath, URL } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

// The app is served from https://<user>.github.io/drumscore/ in production,
// but from the root during local dev.
const GITHUB_PAGES_BASE = '/drumscore/';

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? GITHUB_PAGES_BASE : '/',
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: {
    open: true,
  },
  test: {
    // The tested modules (notation engine, pattern codec) are pure: no DOM needed.
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.{test,spec}.ts'],
    },
  },
}));
