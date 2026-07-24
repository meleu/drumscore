import { hasHitAt, stepsPerBar, type GridDimensions, type Pattern } from '$lib/pattern';
import type { NotationEvent, NotationMeasure, NotationModel, NoteValue } from './model';

/**
 * Translate a pattern into the notation model.
 *
 * A hit sounds until the next one, so each note's written duration is the gap that
 * follows it — that is what turns a grid of 16th-note cells into readable rhythm. Only
 * the space before a measure's first hit is left silent, as rests.
 *
 * A gap no single note value can spell — because it crosses a beat boundary, or because
 * it is simply an odd number of steps — is written as legal values joined by ties, the
 * way a reader expects to see it.
 *
 * Still one merged voice: per-voice noteheads, chords, and beaming arrive later.
 */

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

interface Piece {
  step: number;
  value: NoteValue;
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
    const { value, steps } = longestFit(table, at, left);
    pieces.push({ step: at, value });
    at += steps;
    left -= steps;
  }

  return pieces;
}

function restsFor(table: Duration[], step: number, length: number): NotationEvent[] {
  return split(table, step, length).map((piece) => ({ kind: 'rest', ...piece }));
}

/** One sustained hit, as pieces tied together so they still read as a single stroke. */
function notesFor(table: Duration[], step: number, length: number): NotationEvent[] {
  const pieces = split(table, step, length);

  return pieces.map((piece, index) => ({
    kind: 'note',
    ...piece,
    tiedToNext: index < pieces.length - 1,
  }));
}

/** The steps of one bar that carry a hit, as indices relative to that bar. */
function hitSteps(pattern: Pattern, bar: number, barLength: number): number[] {
  const steps: number[] = [];

  for (let step = 0; step < barLength; step += 1) {
    if (hasHitAt(pattern, bar * barLength + step)) steps.push(step);
  }

  return steps;
}

function measureFor(pattern: Pattern, bar: number, table: Duration[]): NotationMeasure {
  const barLength = stepsPerBar(pattern.dimensions);
  const hits = hitSteps(pattern, bar, barLength);

  // Every hit sounds until the next one, so the only silence a measure can hold is the
  // stretch before its first hit — or, with no hits at all, the whole measure.
  const [first = barLength] = hits;
  const events: NotationEvent[] = restsFor(table, 0, first);

  for (const [index, step] of hits.entries()) {
    // Notes stop at the bar line; a hit's tail never carries into the next measure.
    const until = hits[index + 1] ?? barLength;
    events.push(...notesFor(table, step, until - step));
  }

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
