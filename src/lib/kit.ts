/**
 * The Kit: what the drums are.
 *
 * One row per voice carrying everything true of that drum whoever is asking — label, part,
 * notehead, accepted variations. Everyone else reads from here: the Pattern takes its voice
 * ids, the codec its bit order, the notation engine its noteheads and parts, the grid its
 * labels and row order.
 *
 * What is not true of the drum itself stays out: how a drum is synthesized — its voice's
 * volume, its filtering — belongs to the audio engine, rest positions to the Part. How hard
 * each *way of striking* lands is a fact about the variation rather than about any one drum,
 * so it sits here with the union it enumerates. Borrows `Notehead`/`PartId` from the notation
 * model rather than the other way round.
 */

import type { NoteheadGlyph, PartId } from './notation/model';

/** One global list; which of these a drum admits is the `variations` column (ADR-0013). */
export type Variation = 'accent' | 'ghost' | 'flam' | 'drag';

/**
 * How one cell is struck: not at all, plainly, or with exactly one variation. A closed
 * union rather than flags, so an accented flam fails to typecheck rather than being
 * validated away (ADR-0012). Lives beside the table so {@link accepts} is the one place
 * "may this drum be struck this way?" is answered.
 */
export type Hit = 'off' | 'plain' | Variation;

/**
 * Menu items and the word a grid cell announces. Here rather than in a component, so a new
 * variation is a compile error until it is named.
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
 * Three loudnesses, 0–1, tuned by ear. Plain sits short of full so an accent has somewhere
 * louder to go without the mix clipping; a ghost is the same stroke played quietly and
 * nothing else — no duller timbre.
 */
const GHOST_LOUDNESS = 0.35;
const PLAIN_LOUDNESS = 0.8;
const ACCENT_LOUDNESS = 1;

/**
 * How hard each way of striking lands, as the fraction of full force a trigger takes. The
 * one statement of it: the audio engine reads this rather than deciding, so it stays the
 * thin adapter it is. Exhaustive over the union, so a new variation is a compile error until
 * its loudness is named.
 *
 * A flam and a drag land as hard as a plain hit — their grace strikes, quiet and ahead of
 * the beat, are what makes the gesture, not the main stroke's force.
 */
export const HIT_LOUDNESS: Record<Hit, number> = {
  off: 0,
  plain: PLAIN_LOUDNESS,
  accent: ACCENT_LOUDNESS,
  ghost: GHOST_LOUDNESS,
  flam: PLAIN_LOUDNESS,
  drag: PLAIN_LOUDNESS,
};

/** What every Kit row must state; the list below is checked against it. */
interface KitRow {
  id: string;
  /** The grid's row label. */
  label: string;
  /** Which of the staff's two rhythms this drum is written into. */
  part: PartId;
  /** Glyph, and the line or space it sits on. How a hit is struck is not the Kit's to say. */
  notehead: NoteheadGlyph;
  /** Accepted variations, in menu order. Empty = struck one way only. */
  variations: readonly Variation[];
}

/**
 * Every drum, in **canonical order** — which is the codec's bit layout, so reordering
 * silently changes what every existing share link and autosave means. The compiler cannot
 * see that; `kit.test.ts` pins it. Display order is separate: {@link DISPLAY_ORDER}.
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
    // Struck exactly one way. A choke is the variation it awaits; the empty list says so
    // without pretending the general rule has an exception.
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

/** Derived from the Kit, so there is exactly one list of voices in the codebase. */
export type VoiceId = (typeof KIT)[number]['id'];

/** One drum, with its id narrowed to a known voice. */
export interface KitVoice extends KitRow {
  id: VoiceId;
}

/**
 * Grid row order: cymbals top, kick bottom — how a drummer reads a chart, canonical order
 * upside down. Derived, so the day it must diverge there is one line to change.
 */
export const DISPLAY_ORDER: readonly KitVoice[] = [...KIT].toReversed();

/** Rows by id, so {@link accepts} is a lookup rather than a scan per cell. */
const BY_ID: ReadonlyMap<VoiceId, KitVoice> = new Map(KIT.map((voice) => [voice.id, voice]));

/**
 * May this drum be struck this way? Asked instead of restating the table (ADR-0013) — by
 * the setter, which refuses by returning its input; the codec, which rejects the whole
 * string; the menu, which never offers what would be refused.
 *
 * Silence and plain are available on every drum, so only variations are looked up.
 */
export function accepts(voice: VoiceId, hit: Hit): boolean {
  if (hit === 'off' || hit === 'plain') return true;

  return BY_ID.get(voice)?.variations.includes(hit) ?? false;
}
