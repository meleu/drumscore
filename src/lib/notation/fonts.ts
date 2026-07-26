/**
 * The music fonts, vendored and served from the app's own origin.
 *
 * Neither of VexFlow's own routes suits a fast, offline-capable static site: its default
 * entry point inlines six fonts as base64 (four unused here), and `Font.load(name)` fetches
 * from a CDN, so the staff cannot render until a third-party request lands. Instead the
 * renderer imports `vexflow/core` and this module points VexFlow at the two fonts we ship
 * from the `@vexflow-fonts` packages, which Vite emits as ordinary hashed assets.
 *
 * Font handling stops here, at the {@link ./renderer.ts renderer} that waits on these
 * fonts and the {@link ../sheet/export.ts exporter} that inlines them into a saved file.
 */

import academicoUrl from '@vexflow-fonts/academico/academico.woff2?url';
import bravuraUrl from '@vexflow-fonts/bravura/bravura.woff2?url';
import { Font, VexFlow } from 'vexflow/core';

/**
 * Family name -> the woff2 we serve. Bravura draws the notation, Academico the text;
 * Bravura first because VexFlow reads this order as its font stack.
 *
 * Regular weights only: nothing in the output asks for bold, and a browser synthesizes it
 * rather than fetching if VexFlow ever does.
 */
export const NOTATION_FONTS: Record<string, string> = {
  Bravura: bravuraUrl,
  Academico: academicoUrl,
};

// VexFlow resolves a font URL as `HOST_URL + FILES[name]`. Emptying the host leaves the
// bundler's own asset URL; replacing the table wholesale drops every remaining CDN path.
Font.HOST_URL = '';
Font.FILES = NOTATION_FONTS;

// Explicit, rather than relying on VexFlow's default naming the same two we bundle.
VexFlow.setFonts(...Object.keys(NOTATION_FONTS));

/**
 * Resolves once the fonts are registered. Drawing before then measures against a fallback
 * face — a notehead comes out 30px wide instead of 12 — and spreads the staff out wrong,
 * so the renderer awaits this before every draw. Rejects if a font fails to load; it never
 * resolves with a fallback quietly standing in.
 */
export const notationFontsReady: Promise<void> = VexFlow.loadFonts(...VexFlow.getFonts());

// Started at import time, so it may reject with nobody awaiting it — a zero-width staff
// never draws, nor does a test importing this for `NOTATION_FONTS` alone. This keeps that
// from surfacing as an unhandled rejection; awaiters still see the failure.
notationFontsReady.catch(() => {});
