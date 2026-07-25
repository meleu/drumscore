/**
 * The naming rule for an exported sheet. A beat's name is written for people — accents,
 * punctuation, capitals, whatever length — and a filename has to survive every filesystem
 * it lands on, so the name is slugged down to lowercase ASCII words joined by hyphens.
 *
 * An internal seam: the Sheet derives its filenames through here, and nothing outside
 * `src/lib/sheet/` needs to know the rule exists.
 */

/** Beyond this the name stops being a filename and starts being a paragraph. */
const MAX_SLUG_LENGTH = 60;

/** What an unnamed beat — or a name of nothing but punctuation — is saved as. */
const FALLBACK = 'drumscore';

/**
 * The filename an exported sheet is saved under, derived from the beat's name. A name
 * that slugs to nothing — empty, whitespace, punctuation only — falls back to
 * `drumscore`, so every export lands somewhere sensible.
 */
export function filenameFor(name: string, extension: string): string {
  return `${slug(name) || FALLBACK}.${extension}`;
}

/**
 * Accented and decorated letters are folded to their ASCII bases rather than dropped, so
 * `Batida Nº1` keeps its letters as `batida-no1`. NFKD splits them into a base plus
 * combining marks and the compatibility forms into plain ones; discarding the marks
 * leaves the base behind.
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
