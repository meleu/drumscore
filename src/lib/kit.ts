/**
 * The Kit: what the drums are.
 *
 * One row per Voice, carrying everything true of that drum whoever is asking — the label a
 * human reads, whether it is played by the hands or the feet, and how it is written on the
 * staff. Everyone else reads from here rather than restating it: the Pattern takes its
 * voice ids, the codec its bit order, the notation engine its noteheads and part
 * membership, the grid its labels and row order.
 *
 * What is *not* true of the drum itself stays out. How loud its synth is and how it is
 * filtered belong to the audio engine; where its rests sit belongs to the Part. The Kit is
 * the one module allowed to meet the grid half and the staff half of the app, which is why
 * it stays this small.
 *
 * It depends on the notation model rather than the other way round: `Notehead`, `PartId`
 * and the vocabulary under them are the notation model's words, and the Kit borrows them.
 */

import type { Notehead, PartId } from './notation/model';

/**
 * A way of striking a drum beyond an ordinary stroke. One global list; what is per-drum is
 * which of its members that drum admits, which is the `variations` column below (ADR-0013).
 */
export type Variation = 'accent' | 'ghost' | 'flam' | 'drag';

/**
 * How one cell of the grid is struck: not at all, plainly, or with exactly one variation.
 *
 * A closed union rather than a set of flags, so an accented flam does not typecheck rather
 * than being validated away (ADR-0012). It lives here, beside the column that says which
 * members each drum admits, so that the question "may this drum be struck this way?" has
 * one place to be asked — {@link accepts} — and one place to be answered.
 */
export type Hit = 'off' | 'plain' | Variation;

/**
 * What a human reads for each way of striking a drum: the menu's items and the word a grid
 * cell announces. Beside the vocabulary rather than inside a component, so a variation
 * added to the union is a compile error until it has been named.
 */
export const HIT_LABELS: Record<Hit, string> = {
  off: 'Empty',
  plain: 'Plain',
  accent: 'Accent',
  ghost: 'Ghost',
  flam: 'Flam',
  drag: 'Drag',
};

/**
 * What every row of the Kit has to state. The list below is checked against it, so a drum
 * missing any of these never compiles.
 */
interface KitRow {
  id: string;
  /** What a human reads: the grid's row label. */
  label: string;
  /** Which of the staff's two rhythms this drum is written into. */
  part: PartId;
  /** How the drum is written: its glyph, and the line or space it sits on. */
  notehead: Notehead;
  /**
   * The variations this drum accepts beyond a plain stroke, in menu order. Empty means it
   * is struck one way only — which is a statement about the drum, not a gap in the row.
   */
  variations: readonly Variation[];
}

/**
 * Every drum in the kit, in **canonical order**.
 *
 * This order is the pattern codec's bit layout: rows are encoded in the order they are
 * declared here, so reordering this list silently changes what every existing share link
 * and autosave means. The compiler cannot see that constraint, so `kit.test.ts` pins it.
 * How the grid *displays* the rows is a separate decision, published as
 * {@link DISPLAY_ORDER}.
 */
export const KIT = [
  {
    id: 'kick',
    label: 'Kick',
    part: 'feet',
    notehead: { style: 'normal', position: { step: 'f', octave: 4 } },
    variations: ['accent'],
  },
  {
    id: 'snare',
    label: 'Snare',
    part: 'hands',
    notehead: { style: 'normal', position: { step: 'c', octave: 5 } },
    variations: ['accent', 'ghost', 'flam', 'drag'],
  },
  {
    id: 'closedHiHat',
    label: 'Closed Hi-hat',
    part: 'hands',
    notehead: { style: 'cross', position: { step: 'g', octave: 5 } },
    variations: ['accent'],
  },
  {
    id: 'openHiHat',
    label: 'Open Hi-hat',
    part: 'hands',
    notehead: { style: 'cross', position: { step: 'g', octave: 5 } },
    variations: ['accent'],
  },
  {
    // The one drum struck exactly one way. A choke is the variation it is waiting for, and
    // an empty list is what says so without pretending the general rule has an exception.
    id: 'crash',
    label: 'Crash',
    part: 'hands',
    notehead: { style: 'cross', position: { step: 'a', octave: 5 } },
    variations: [],
  },
  {
    id: 'ride',
    label: 'Ride',
    part: 'hands',
    notehead: { style: 'cross', position: { step: 'f', octave: 5 } },
    variations: ['accent'],
  },
] as const satisfies readonly KitRow[];

/**
 * The voices, named. Derived from the Kit's entries, so there is exactly one list of
 * voices in the codebase and no second list for it to fall out of step with.
 */
export type VoiceId = (typeof KIT)[number]['id'];

/**
 * One drum, as the Kit states it — a row whose id is one of the voices above, so that
 * reading a row hands you a voice the rest of the app already knows how to use.
 */
export interface KitVoice extends KitRow {
  id: VoiceId;
}

/**
 * The order the grid draws its rows in: cymbals at the top, kick at the bottom — the way a
 * drummer reads a chart, which is canonical order upside down.
 *
 * A derivation rather than a second hand-maintained list, owned here so that the day
 * display order needs to diverge from canonical order there is one line to change.
 */
export const DISPLAY_ORDER: readonly KitVoice[] = [...KIT].toReversed();

/** The rows by id, so the predicate below is a lookup rather than a scan per cell. */
const BY_ID: ReadonlyMap<VoiceId, KitVoice> = new Map(KIT.map((voice) => [voice.id, voice]));

/**
 * May this drum be struck this way? The question everyone else asks instead of restating
 * the table above (ADR-0013) — the setter, which refuses by returning the pattern it was
 * given; the codec, which refuses by rejecting the whole string; the menu, which never
 * offers what would be refused.
 *
 * Silence and a plain stroke are available on every drum, so only the variations are looked
 * up: a row saying nothing is a row that takes no variations, not one that cannot be struck.
 */
export function accepts(voice: VoiceId, hit: Hit): boolean {
  if (hit === 'off' || hit === 'plain') return true;

  return BY_ID.get(voice)?.variations.includes(hit) ?? false;
}
