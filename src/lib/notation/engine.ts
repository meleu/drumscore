import {
  hasHitAt,
  isHit,
  stepsPerBar,
  type GridDimensions,
  type Pattern,
  type VoiceId,
} from '$lib/pattern';
import type { NotationEvent, NotationMeasure, NotationModel, NoteValue } from './model';

/**
 * Translate a pattern into the notation model.
 *
 * Drums are struck, not held: a stroke is written as a note no longer than its own beat
 * and the time until the next hit is filled with rests. That is what turns a grid of
 * 16th-note cells into readable rhythm while keeping the pulse visible.
 *
 * Cymbals that ring on — the crash and the open hi-hat — are the exception. They are
 * written as sounding until the next hit, and a span no single note value can spell,
 * because it crosses a beat or is simply an odd number of steps, becomes legal values
 * joined by ties.
 *
 * Still one merged voice: per-voice noteheads, chords, and beaming arrive later.
 */

/** The voices left ringing rather than damped, and so written as held notes. */
const RINGING: readonly VoiceId[] = ['openHiHat', 'crash'];

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

function restsFor(table: Duration[], step: number, length: number): NotationEvent[] {
  return split(table, step, length).map(({ step: at, value }) => ({
    kind: 'rest',
    step: at,
    value,
  }));
}

/** The pieces of one stroke, tied so that together they still read as a single hit. */
function notesFrom(pieces: Piece[]): NotationEvent[] {
  return pieces.map(({ step, value }, index) => ({
    kind: 'note',
    step,
    value,
    tiedToNext: index < pieces.length - 1,
  }));
}

interface Hit {
  step: number;
  /** A ringing voice was struck here, so the hit is held instead of cut short. */
  rings: boolean;
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

/** The hits of one bar, at steps relative to that bar. */
function hitsIn(pattern: Pattern, bar: number, barLength: number): Hit[] {
  const hits: Hit[] = [];

  for (let step = 0; step < barLength; step += 1) {
    const at = bar * barLength + step;
    if (hasHitAt(pattern, at)) {
      hits.push({ step, rings: RINGING.some((voice) => isHit(pattern, voice, at)) });
    }
  }

  return hits;
}

function measureFor(pattern: Pattern, bar: number, table: Duration[]): NotationMeasure {
  const { stepsPerBeat } = pattern.dimensions;
  const barLength = stepsPerBar(pattern.dimensions);
  const hits = hitsIn(pattern, bar, barLength);

  const events: NotationEvent[] = [];
  let filled = 0;

  for (const [index, hit] of hits.entries()) {
    // Notes stop at the bar line; a hit's tail never carries into the next measure.
    const until = hits[index + 1]?.step ?? barLength;
    const stroke = strokeFor(table, hit, until - hit.step, stepsPerBeat);

    events.push(...restsFor(table, filled, hit.step - filled), ...notesFrom(stroke));
    filled = hit.step + lengthOf(stroke);
  }

  events.push(...restsFor(table, filled, barLength - filled));

  return { events };
}

export function toNotation(pattern: Pattern): NotationModel {
  const { dimensions } = pattern;
  const table = durations(dimensions);

  return {
    timeSignature: { beats: dimensions.beatsPerBar, beatValue: dimensions.beatValue },
    measures: Array.from({ length: dimensions.bars }, (_, bar) => measureFor(pattern, bar, table)),
  };
}
