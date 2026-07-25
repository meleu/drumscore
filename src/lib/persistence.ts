/**
 * Persistence: where a pattern comes from on load and where it goes as the user
 * works. A thin adapter over `localStorage` and the URL — all encoding/decoding is
 * delegated to the pure {@link ./codec pattern codec}.
 *
 * Load precedence (PRD): a URL-encoded pattern wins over the autosave, which wins
 * over the seeded default beat. That order lets a shared link always show its own
 * pattern, while a returning visitor with no link resumes their last edit.
 */

import { decode, encode } from './codec';
import { seed, type Pattern } from './pattern';
import type { PatternStore } from './sketchpad.svelte';

const STORAGE_KEY = 'drumscore:pattern';
/** The query parameter a share link carries the encoded pattern in. */
const URL_PARAM = 'p';

/**
 * Resolve the pattern to open with, applying load precedence:
 * URL param -> localStorage autosave -> seeded default beat.
 */
export function loadInitialPattern(): Pattern {
  return fromUrl() ?? fromStorage() ?? seed();
}

/** Autosave the working pattern. Storage failures (quota, private mode) are ignored. */
export function save(pattern: Pattern): void {
  try {
    localStorage.setItem(STORAGE_KEY, encode(pattern));
  } catch {
    // Best-effort: losing an autosave is not worth interrupting the user.
  }
}

/** The absolute URL that reproduces this exact pattern and tempo when opened. */
export function shareUrl(pattern: Pattern): string {
  const url = new URL(window.location.href);
  url.searchParams.set(URL_PARAM, encode(pattern));
  return url.toString();
}

/**
 * The browser adapter for the sketchpad's pattern store: the URL and localStorage. The
 * sketchpad knows only the three operations, so a test can stand in for the lot.
 */
export const patternStore: PatternStore = {
  load: loadInitialPattern,
  save,
  shareUrl,
};

function fromUrl(): Pattern | null {
  try {
    return decode(new URLSearchParams(window.location.search).get(URL_PARAM));
  } catch {
    return null;
  }
}

function fromStorage(): Pattern | null {
  try {
    return decode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}
