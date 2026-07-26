/**
 * Export: turn the rendered notation SVG into downloadable files, or a PNG on the
 * clipboard. Browser-only, no musical logic — it reads the live `<svg>` the
 * {@link ../../components/Staff.svelte Staff} drew, so exports match the screen.
 *
 * VexFlow draws its glyphs as `<text>` in Bravura/Academico, referenced by family name
 * only. That works in-page, but a saved `.svg` opened elsewhere — or the same markup
 * rasterized through an `<img>` — has no access to them and comes out blank. So the fonts
 * are embedded as base64 `@font-face`, making each export self-contained.
 */

import { NOTATION_FONTS } from '../notation/fonts';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Embedding the fonts is redistributing them, so every export carrying their bytes carries
 * this too (SIL OFL 1.1, clause 2). PNG needs nothing: it keeps no font bytes, and clause
 * 5 exempts documents created with the font.
 */
const FONT_NOTICE = `
  This file embeds the Bravura and Academico fonts.
  Copyright © Steinberg Media Technologies GmbH (http://www.steinberg.net/),
  with Reserved Font Names "Bravura" and "Academico".
  Licensed under the SIL Open Font License, Version 1.1: https://scripts.sil.org/OFL
`;

export async function exportSvg(svg: SVGSVGElement, filename = 'drumscore.svg'): Promise<void> {
  const markup = await buildStandaloneSvg(svg);
  downloadBlob(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

export async function exportPng(
  svg: SVGSVGElement,
  filename = 'drumscore.png',
  scale = 2,
): Promise<void> {
  downloadBlob(await renderPng(svg, scale), filename);
}

/**
 * Resolves to whether it landed: the clipboard image API is missing in some browsers, and
 * elsewhere the write is refused without focus and permission — none worth failing loudly.
 *
 * The rasterization is handed to `ClipboardItem` still pending rather than awaited first:
 * clipboard writes are only allowed while the click is being handled, and awaiting
 * beforehand spends that window. Passing the promise holds the gesture open.
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

/** Drawn onto a canvas scaled up (default 2x) to stay sharp, over white paper. */
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
 * Clone the live SVG into a portable document: declare the namespace, paint white behind
 * the staff (drawn black-on-white in either theme), embed the fonts.
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

/** From the viewBox, falling back to width/height. */
function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const box = svg.viewBox.baseVal;
  const width = box && box.width ? box.width : svg.width.baseVal.value;
  const height = box && box.height ? box.height : svg.height.baseVal.value;
  return { width, height };
}

/** The fonts never change within a session. */
const fontCache = new Map<string, string | null>();

/**
 * `@font-face` rules with each woff2 inlined as a data URI. Fonts that cannot be fetched
 * are skipped rather than failing the export; empty when none resolve.
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

/** Our own bundled asset, so this is a same-origin request the browser has likely cached. */
async function fontDataUri(name: string, url: string): Promise<string | null> {
  if (fontCache.has(name)) return fontCache.get(name) ?? null;

  let dataUri: string | null = null;
  try {
    const response = await fetch(url);
    if (response.ok) {
      dataUri = `data:font/woff2;base64,${base64(await response.arrayBuffer())}`;
    }
  } catch {
    // unreadable: fall through with no embedded font
  }

  fontCache.set(name, dataUri);
  return dataUri;
}

/** Chunked to avoid call-stack limits. */
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
