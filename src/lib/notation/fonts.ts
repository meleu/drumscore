/**
 * The music fonts, vendored and served from the app's own origin.
 *
 * VexFlow reaches for its fonts in two ways, and neither suits a static site meant to
 * load fast and work offline. Its default entry point inlines six fonts as base64 data
 * URIs — four of which this app never draws — and `Font.load(name)` fetches from a CDN
 * (`Font.HOST_URL`, jsdelivr), so the staff cannot render until a third-party request
 * lands. Instead the renderer imports `vexflow/core`, the same library without the
 * bundled fonts, and this module points VexFlow at the two fonts we ship ourselves:
 * they come from the `@vexflow-fonts` packages (which carry their license and upstream
 * version alongside the bytes) and Vite emits them as ordinary hashed assets.
 *
 * Font handling stops here, at the {@link ./renderer.ts renderer} that waits on these
 * fonts before it draws, and at the {@link ../export.ts exporter} that inlines them into
 * a saved file: the engine and the rest of the pure modules know nothing about it.
 */

import academicoUrl from '@vexflow-fonts/academico/academico.woff2?url';
import bravuraUrl from '@vexflow-fonts/bravura/bravura.woff2?url';
import { Font, VexFlow } from 'vexflow/core';

/**
 * Family name → the woff2 we serve for it. Bravura draws the notation and Academico
 * the text; Bravura comes first because VexFlow reads this order as its font stack.
 *
 * Regular weights only. `academico-bold.woff2` is deliberately not shipped: nothing in
 * the notation output asks for bold, and a browser synthesizes it from the regular face
 * rather than fetching anything if VexFlow ever does.
 */
export const NOTATION_FONTS: Record<string, string> = {
  Bravura: bravuraUrl,
  Academico: academicoUrl,
};

// VexFlow resolves a font URL as `HOST_URL + FILES[name]`. Emptying the host leaves the
// bundler's own asset URL, and replacing the file table wholesale drops every remaining
// CDN path along with the fonts we do not ship.
Font.HOST_URL = '';
Font.FILES = NOTATION_FONTS;

// Configure the families explicitly rather than relying on VexFlow's default happening
// to name the same two we bundle.
VexFlow.setFonts(...Object.keys(NOTATION_FONTS));

/**
 * Resolves once the fonts are registered with the browser. Drawing before then measures
 * every glyph against a fallback face — a notehead comes out 30px wide instead of 12 —
 * and spreads the staff out wrong, so the renderer awaits this before every draw and
 * nobody else needs to know it exists. Rejects if a font fails to load; it never resolves
 * with a fallback quietly standing in.
 */
export const notationFontsReady: Promise<void> = VexFlow.loadFonts(...VexFlow.getFonts());
