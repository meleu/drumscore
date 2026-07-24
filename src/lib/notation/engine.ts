import { hasHitAt, stepsPerBar, type GridDimensions, type Pattern } from '$lib/pattern';
import type { NotationEvent, NotationMeasure, NotationModel, NoteValue } from './model';

/**
 * Translate a pattern into the notation model.
 *
 * A hit sounds until the next one, so each note's written duration is the gap that
 * follows it — that is what turns a grid of 16th-note cells into readable rhythm.
 * Anything the gap leaves over, and any space before the first hit, becomes rests.
 *
 * Still one merged voice: per-voice noteheads, chords, and beaming arrive later. Gaps
 * that no single note value can express are approximated here by writing the largest
 * legal note and resting out the remainder; Phase 3 replaces that remainder with ties.
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

/** Cover `length` steps from `step` with as few rests as the alignment rule allows. */
function restsFor(table: Duration[], step: number, length: number): NotationEvent[] {
  const rests: NotationEvent[] = [];

  for (let at = step, left = length; left > 0;) {
    const { value, steps } = longestFit(table, at, left);
    rests.push({ kind: 'rest', step: at, value });
    at += steps;
    left -= steps;
  }

  return rests;
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
  const events: NotationEvent[] = [];

  // Where the measure is filled up to. A note may fall short of the next hit when no
  // single value spans the gap, which is what leaves room for the rests in between.
  let filled = 0;

  for (const [index, step] of hits.entries()) {
    events.push(...restsFor(table, filled, step - filled));

    // Notes stop at the bar line; a hit's tail never carries into the next measure.
    const until = hits[index + 1] ?? barLength;
    const { value, steps } = longestFit(table, step, until - step);
    events.push({ kind: 'note', step, value });
    filled = step + steps;
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
