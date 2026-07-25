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
  },
  {
    id: 'snare',
    label: 'Snare',
    part: 'hands',
    notehead: { style: 'normal', position: { step: 'c', octave: 5 } },
  },
  {
    id: 'closedHiHat',
    label: 'Closed Hi-hat',
    part: 'hands',
    notehead: { style: 'cross', position: { step: 'g', octave: 5 } },
  },
  {
    id: 'openHiHat',
    label: 'Open Hi-hat',
    part: 'hands',
    notehead: { style: 'cross', position: { step: 'g', octave: 5 } },
  },
  {
    id: 'crash',
    label: 'Crash',
    part: 'hands',
    notehead: { style: 'cross', position: { step: 'a', octave: 5 } },
  },
  {
    id: 'ride',
    label: 'Ride',
    part: 'hands',
    notehead: { style: 'cross', position: { step: 'f', octave: 5 } },
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
