/**
 * Export: turn the rendered notation SVG into downloadable files, or a PNG on the
 * clipboard. A thin, browser-only adapter — it carries no musical logic and reads the
 * pixels straight off the live `<svg>` the {@link ../../components/Staff.svelte Staff}
 * drew, so every output reflects exactly what is on screen.
 *
 * The SVG VexFlow emits draws its glyphs as `<text>` in the Bravura/Academico music
 * fonts, referenced only by family name. That renders in-page because the app has
 * loaded those fonts, but a saved `.svg` opened elsewhere — or the same markup
 * rasterized through an `<img>` for PNG — has no access to them, and every notehead,
 * clef and rest would come out blank. So we embed the fonts as base64 data URIs in a
 * `@font-face` block, making each export self-contained.
 */

import { NOTATION_FONTS } from '../notation/fonts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Embedding the fonts is redistributing them, so every export that carries their bytes
 * carries this too (SIL OFL 1.1, clause 2). PNG needs nothing: it rasterizes, keeps no
 * font bytes, and clause 5 exempts documents created with the font.
 */
const FONT_NOTICE = `
  This file embeds the Bravura and Academico fonts.
  Copyright © Steinberg Media Technologies GmbH (http://www.steinberg.net/),
  with Reserved Font Names "Bravura" and "Academico".
  Licensed under the SIL Open Font License, Version 1.1: https://scripts.sil.org/OFL
`;

/** Save a crisp, scalable, self-contained copy of the current notation as SVG. */
export async function exportSvg(svg: SVGSVGElement, filename = 'drumscore.svg'): Promise<void> {
  const markup = await buildStandaloneSvg(svg);
  downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

/** Save the current notation as a raster PNG. */
export async function exportPng(
  svg: SVGSVGElement,
  filename = 'drumscore.png',
  scale = 2,
): Promise<void> {
  downloadBlob(await renderPng(svg, scale), filename);
}

/**
 * Put the current notation on the clipboard as a PNG, so it can be pasted straight into
 * a chat, a doc or a slide. Resolves to whether it landed: the clipboard image API is
 * missing in some browsers, and elsewhere the write is refused unless the document has
 * focus and permission, none of which is worth failing loudly over.
 *
 * The rasterization is handed to `ClipboardItem` still pending rather than awaited first.
 * Clipboard writes are only allowed while the user's click is being handled, and awaiting
 * anything beforehand spends that window — passing the promise lets the browser hold the
 * gesture open until the blob arrives.
 */
export async function copyPng(svg: SVGSVGElement, scale = 2): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;

  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderPng(svg, scale) })]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rasterize the notation to a PNG blob. The SVG is drawn onto a canvas scaled up
 * (default 2×) so the image stays sharp, over a white background matching the paper.
 */
async function renderPng(svg: SVGSVGElement, scale: number): Promise<Blob> {
  const markup = await buildStandaloneSvg(svg);
  const { width, height } = svgSize(svg);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Failed to encode PNG');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Clone the live SVG into a portable document: declare the namespace, paint a white
 * background behind the staff (which is drawn black-on-white in either theme), and
 * embed the music fonts so the file renders anywhere.
 */
async function buildStandaloneSvg(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  const { width, height } = svgSize(svg);
  const background = document.createElementNS(SVG_NS, 'rect');
  background.setAttribute('x', '0');
  background.setAttribute('y', '0');
  background.setAttribute('width', String(width));
  background.setAttribute('height', String(height));
  background.setAttribute('fill', 'white');
  clone.insertBefore(background, clone.firstChild);

  const fontCss = await embeddedFontCss();
  if (fontCss) {
    const style = document.createElementNS(SVG_NS, 'style');
    style.textContent = fontCss;
    clone.insertBefore(style, clone.firstChild);
    clone.insertBefore(document.createComment(FONT_NOTICE), clone.firstChild);
  }

  return new XMLSerializer().serializeToString(clone);
}

/** The SVG's intrinsic size, read from its viewBox (falling back to width/height). */
function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const box = svg.viewBox.baseVal;
  const width = box && box.width ? box.width : svg.width.baseVal.value;
  const height = box && box.height ? box.height : svg.height.baseVal.value;
  return { width, height };
}

/** Cache the fetched-and-encoded fonts; they never change within a session. */
const fontCache = new Map<string, string | null>();

/**
 * `@font-face` rules for the fonts the staff is drawn with, each with its woff2 inlined
 * as a data URI. Fonts that cannot be fetched are skipped rather than failing the
 * export. Empty when none resolve.
 */
async function embeddedFontCss(): Promise<string> {
  const faces = await Promise.all(
    Object.entries(NOTATION_FONTS).map(async ([name, url]) => {
      const dataUri = await fontDataUri(name, url);
      return dataUri
        ? `@font-face { font-family: '${name}'; src: url(${dataUri}) format('woff2'); }`
        : null;
    }),
  );
  return faces.filter(Boolean).join('\n');
}

/**
 * Fetch a font's woff2 and encode it as a data URI. The URL is our own bundled asset,
 * so this is a same-origin request the browser has almost certainly cached already.
 */
async function fontDataUri(name: string, url: string): Promise<string | null> {
  if (fontCache.has(name)) return fontCache.get(name) ?? null;

  let dataUri: string | null = null;
  try {
    const response = await fetch(url);
    if (response.ok) {
      dataUri = `data:font/woff2;base64,${base64(await response.arrayBuffer())}`;
    }
  } catch {
    // Unreadable for whatever reason: fall through with no embedded font.
  }

  fontCache.set(name, dataUri);
  return dataUri;
}

/** Base64-encode a binary buffer in browser-safe chunks (avoids call-stack limits). */
function base64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load SVG for rasterization'));
    image.src = src;
  });
}

/** Trigger a browser download of a blob under the given filename. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
