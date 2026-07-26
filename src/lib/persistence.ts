/**
 * Persistence: a thin adapter over `localStorage` and the URL; all encoding is delegated
 * to the pure {@link ./codec pattern codec}.
 *
 * Load precedence (PRD): URL pattern > autosave > seeded default beat. So a shared link
 * always shows its own pattern, while a returning visitor resumes their last edit.
 */

import { decode, encode } from './codec';
import { seed, type Pattern } from './pattern';
import type { PatternStore } from './sketchpad.svelte';

const STORAGE_KEY = 'drumscore:pattern';
/** The query parameter a share link carries the encoded pattern in. */
const URL_PARAM = 'p';

export function loadInitialPattern(): Pattern {
  return fromUrl() ?? fromStorage() ?? seed();
}

/** Storage failures (quota, private mode) are ignored: an autosave is not worth an interruption. */
export function save(pattern: Pattern): void {
  try {
    localStorage.setItem(STORAGE_KEY, encode(pattern));
  } catch {
    // best effort
  }
}

/** Absolute URL reproducing this exact pattern and tempo. */
export function shareUrl(pattern: Pattern): string {
  const url = new URL(window.location.href);
  url.searchParams.set(URL_PARAM, encode(pattern));
  return url.toString();
}

/** The browser adapter for the sketchpad's store: three operations, so a test can fake it. */
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
