/**
 * Naming an exported sheet. A beat's name is written for people; a filename has to survive
 * every filesystem it lands on, so it is slugged to lowercase ASCII words joined by
 * hyphens. Internal to `src/lib/sheet/`.
 */

/** Beyond this the name stops being a filename and starts being a paragraph. */
const MAX_SLUG_LENGTH = 60;

const FALLBACK = 'drumscore';

/** A name slugging to nothing — empty, whitespace, punctuation — falls back. */
export function filenameFor(name: string, extension: string): string {
  return `${slug(name) || FALLBACK}.${extension}`;
}

/**
 * Accented letters fold to their ASCII bases rather than being dropped, so `Batida Nº1`
 * keeps its letters as `batida-no1`: NFKD splits them into base plus combining marks, and
 * discarding the marks leaves the base.
 */
function slug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}
