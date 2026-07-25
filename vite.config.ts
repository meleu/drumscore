import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

// The app is served from https://<user>.github.io/drumscore/ in production,
// but from the root during local dev.
const GITHUB_PAGES_BASE = '/drumscore/';

/** The vendored music fonts (see `src/lib/notation/fonts.ts`), by package name. */
const FONT_PACKAGES = ['@vexflow-fonts/bravura', '@vexflow-fonts/academico'];

/**
 * Ship each vendored font's license and provenance notes with the build. The fonts are
 * under the SIL Open Font License 1.1, whose clause 2 allows bundling them only "provided
 * that ... each copy contains the above copyright notice and this license" — and the
 * `?url` imports that pull the fonts in emit the woff2 alone. Reading the files out of
 * the packages, rather than committing copies, keeps the notice and the recorded upstream
 * version tied to the dependency actually installed.
 */
function vendoredFontLicenses(): Plugin {
  const NOTICES = ['LICENSE.txt', 'README.txt'];

  return {
    name: 'vendored-font-licenses',
    async generateBundle() {
      for (const pkg of FONT_PACKAGES) {
        const from = dirname(fileURLToPath(import.meta.resolve(`${pkg}/package.json`)));
        const name = pkg.split('/').pop();

        for (const notice of NOTICES) {
          this.emitFile({
            type: 'asset',
            fileName: `fonts/${name}/${notice}`,
            source: await readFile(join(from, notice)),
          });
        }
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? GITHUB_PAGES_BASE : '/',
  plugins: [svelte(), vendoredFontLicenses()],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  server: {
    open: true,
  },
  test: {
    // No DOM needed. The pure modules — notation engine, pattern codec — need none by
    // nature, and the runes modules are written so their logic needs none either: the
    // sketchpad's transitions run against fake adapters, and the sheet's readiness is
    // decided before it reaches a browser call. What genuinely needs a browser is the
    // drawing, and `verify:visual` renders that in a real one.
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.{test,spec}.ts'],
      // Runes modules (`*.svelte.ts`) never appear in this report: the Svelte plugin
      // compiles them and the v8 provider does not attribute the result back. The
      // sketchpad is missing here despite `sketchpad.test.ts` covering it end to end.
    },
  },
}));
