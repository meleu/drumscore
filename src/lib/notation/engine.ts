import { isHit, stepsPerBar, type GridDimensions, type Pattern, type VoiceId } from '$lib/pattern';
import type {
  NotationEvent,
  NotationMeasure,
  NotationModel,
  NotationPart,
  Notehead,
  NoteValue,
  PartId,
  StaffPosition,
  StemDirection,
} from './model';

/**
 * Translate a pattern into the notation model.
 *
 * The staff carries two rhythms rather than one: the hands, stems up, and the feet,
 * stems down. Each is written from its own hits, so a snare on 2 and 4 is not chopped up
 * by the kick playing underneath it, and each fills its own measure with its own rests.
 * Drums struck together in the same part become one chord.
 *
 * Within a part, drums are struck, not held: a stroke is written as a note no longer than
 * its own beat and the time until the next hit is filled with rests. That is what turns a
 * grid of 16th-note cells into readable rhythm while keeping the pulse visible.
 *
 * Cymbals that ring on — the crash and the open hi-hat — are the exception. They are
 * written as sounding until the next hit, and a span no single note value can spell,
 * because it crosses a beat or is simply an odd number of steps, becomes legal values
 * joined by ties.
 */

/** The voices left ringing rather than damped, and so written as held notes. */
const RINGING: readonly VoiceId[] = ['openHiHat', 'crash'];

/** Where each drum sits on the staff, and what its notehead looks like. */
const NOTEHEADS: Readonly<Record<VoiceId, Notehead>> = {
  kick: { style: 'normal', position: { step: 'f', octave: 4 } },
  snare: { style: 'normal', position: { step: 'c', octave: 5 } },
  closedHiHat: { style: 'cross', position: { step: 'g', octave: 5 } },
  openHiHat: { style: 'cross', position: { step: 'g', octave: 5 } },
  crash: { style: 'cross', position: { step: 'a', octave: 5 } },
  ride: { style: 'cross', position: { step: 'f', octave: 5 } },
};

interface Part {
  id: PartId;
  stemDirection: StemDirection;
  voices: readonly VoiceId[];
  /** Rests keep out of the noteheads' way by sitting in their own part of the staff. */
  restPosition: StaffPosition;
  /** The whole rest is the odd one out: it hangs from the line above the others. */
  wholeRestPosition: StaffPosition;
}

const PARTS: readonly Part[] = [
  {
    id: 'hands',
    stemDirection: 'up',
    voices: ['snare', 'closedHiHat', 'openHiHat', 'crash', 'ride'],
    restPosition: { step: 'b', octave: 4 },
    wholeRestPosition: { step: 'd', octave: 5 },
  },
  {
    id: 'feet',
    stemDirection: 'down',
    voices: ['kick'],
    restPosition: { step: 'f', octave: 4 },
    wholeRestPosition: { step: 'g', octave: 4 },
  },
];

/** How many of each note value make a whole note. */
const VALUES_PER_WHOLE: readonly [NoteValue, number][] = [
  ['whole', 1],
  ['half', 2],
  ['quarter', 4],
  ['eighth', 8],
  ['sixteenth', 16],
];

interface Duration {
  value: NoteValue;
  steps: number;
}

/**
 * The note values expressible at this resolution, longest first. Derived from the
 * dimensions rather than hardcoded, so a finer grid or a different beat value just
 * yields a different table.
 */
function durations(dimensions: GridDimensions): Duration[] {
  const stepsPerWhole = dimensions.stepsPerBeat * dimensions.beatValue;

  return VALUES_PER_WHOLE.map(([value, perWhole]) => ({
    value,
    steps: stepsPerWhole / perWhole,
  })).filter(({ steps }) => Number.isInteger(steps) && steps >= 1);
}

/**
 * The longest duration that fits in `length` and may legally begin on `step`.
 *
 * The alignment test is what keeps the rhythm readable: a half note only starts on a
 * half-note boundary, a quarter only on a beat, and so on, so nothing straddles a
 * subdivision it has no business crossing. The one-step value always qualifies, so
 * there is always an answer.
 */
function longestFit(table: Duration[], step: number, length: number): Duration {
  const fit = table.find((duration) => duration.steps <= length && step % duration.steps === 0);

  /* v8 ignore next -- unreachable: the one-step value fits any step and any length >= 1 */
  if (!fit) throw new Error(`no note value fits ${length} step(s) at step ${step}`);

  return fit;
}

interface Piece extends Duration {
  step: number;
}

/**
 * Cover `length` steps from `step` with as few legal values as the alignment rule
 * allows.
 *
 * Because each piece has to be able to start where the previous one ended, the splits
 * land on the metrical boundaries a reader looks for: a span crossing a beat is cut at
 * that beat, and a span of 3, 5 or 7 sixteenths comes back as the pieces summing to it.
 */
function split(table: Duration[], step: number, length: number): Piece[] {
  const pieces: Piece[] = [];

  for (let at = step, left = length; left > 0;) {
    const fit = longestFit(table, at, left);
    pieces.push({ step: at, ...fit });
    at += fit.steps;
    left -= fit.steps;
  }

  return pieces;
}

function lengthOf(pieces: Piece[]): number {
  return pieces.reduce((total, piece) => total + piece.steps, 0);
}

function restsFor(table: Duration[], part: Part, step: number, length: number): NotationEvent[] {
  return split(table, step, length).map(({ step: at, value }) => ({
    kind: 'rest',
    step: at,
    value,
    position: value === 'whole' ? part.wholeRestPosition : part.restPosition,
  }));
}

/** The pieces of one stroke, tied so that together they still read as a single hit. */
function notesFrom(pieces: Piece[], noteheads: Notehead[]): NotationEvent[] {
  return pieces.map(({ step, value }, index) => ({
    kind: 'note',
    step,
    value,
    tiedToNext: index < pieces.length - 1,
    noteheads,
  }));
}

interface Hit {
  step: number;
  /** A ringing voice was struck here, so the hit is held instead of cut short. */
  rings: boolean;
  noteheads: Notehead[];
}

/**
 * How one hit is written, as the pieces it occupies.
 *
 * A ringing cymbal is held until the next hit, in tied pieces when no single value
 * spells the span. Every other voice is struck: the longest value that fits the gap
 * without outlasting its own beat, leaving the remainder to be filled with rests.
 */
function strokeFor(table: Duration[], hit: Hit, gap: number, beatSteps: number): Piece[] {
  if (hit.rings) return split(table, hit.step, gap);

  return [{ step: hit.step, ...longestFit(table, hit.step, Math.min(gap, beatSteps)) }];
}

const DIATONIC: readonly string[] = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

/** How high a position sits, so a chord's noteheads can be ordered bottom to top. */
function heightOf({ step, octave }: StaffPosition): number {
  return octave * DIATONIC.length + DIATONIC.indexOf(step);
}

/**
 * The chord struck at one step, low to high.
 *
 * Drums sharing a position and a notehead — the two hi-hats, which v1 tells apart only by
 * whether they ring — collapse into one head, because writing them twice would stack two
 * identical glyphs on the same line.
 */
function noteheadsAt(pattern: Pattern, part: Part, at: number): Notehead[] {
  const struck = part.voices.filter((voice) => isHit(pattern, voice, at));
  const heads = new Map(
    struck.map((voice) => {
      const head = NOTEHEADS[voice];

      return [`${head.style}:${head.position.step}${head.position.octave}`, head];
    }),
  );

  return [...heads.values()].sort((a, b) => heightOf(a.position) - heightOf(b.position));
}

/** The hits of one part within one bar, at steps relative to that bar. */
function hitsIn(pattern: Pattern, part: Part, bar: number, barLength: number): Hit[] {
  const hits: Hit[] = [];

  for (let step = 0; step < barLength; step += 1) {
    const at = bar * barLength + step;
    const noteheads = noteheadsAt(pattern, part, at);

    if (noteheads.length > 0) {
      hits.push({
        step,
        rings: RINGING.some((voice) => part.voices.includes(voice) && isHit(pattern, voice, at)),
        noteheads,
      });
    }
  }

  return hits;
}

function partFor(pattern: Pattern, part: Part, bar: number, table: Duration[]): NotationPart {
  const { stepsPerBeat } = pattern.dimensions;
  const barLength = stepsPerBar(pattern.dimensions);
  const hits = hitsIn(pattern, part, bar, barLength);

  const events: NotationEvent[] = [];
  let filled = 0;

  for (const [index, hit] of hits.entries()) {
    // Notes stop at the bar line; a hit's tail never carries into the next measure.
    const until = hits[index + 1]?.step ?? barLength;
    const stroke = strokeFor(table, hit, until - hit.step, stepsPerBeat);

    events.push(
      ...restsFor(table, part, filled, hit.step - filled),
      ...notesFrom(stroke, hit.noteheads),
    );
    filled = hit.step + lengthOf(stroke);
  }

  events.push(...restsFor(table, part, filled, barLength - filled));

  return { id: part.id, stemDirection: part.stemDirection, events };
}

export function toNotation(pattern: Pattern): NotationModel {
  const { dimensions } = pattern;
  const table = durations(dimensions);

  return {
    timeSignature: { beats: dimensions.beatsPerBar, beatValue: dimensions.beatValue },
    measures: Array.from({ length: dimensions.bars }, (_, bar): NotationMeasure => ({
      parts: PARTS.map((part) => partFor(pattern, part, bar, table)),
    })),
  };
}
