/**
 * The pattern model: the single source of truth for what the user has drawn.
 *
 * Grid dimensions live in data rather than as literals so a later version can change
 * the resolution, meter, or bar count without rewriting the logic that reads them.
 * v1 ships 6 voices x 32 steps (16th notes, 4/4, two bars).
 *
 * Operations are pure: they return a new pattern rather than mutating the old one.
 */

import { KIT, type VoiceId } from './kit';
import { VALUES_PER_WHOLE } from './notation/model';

/**
 * Which drums there are is the Kit's business, not the Pattern's. The type is re-exported
 * because the interfaces below are stated in terms of it; anything that needs the *list*
 * reads `kit.ts` directly.
 */
export type { VoiceId };

export interface GridDimensions {
  /** Steps per beat. 4 gives 16th-note resolution. */
  stepsPerBeat: number;
  /** Beats per bar — the time signature's numerator. */
  beatsPerBar: number;
  /** The time signature's denominator: 4 means the quarter note gets the beat. */
  beatValue: number;
  bars: number;
}

export const DEFAULT_DIMENSIONS: GridDimensions = {
  stepsPerBeat: 4,
  beatsPerBar: 4,
  beatValue: 4,
  bars: 2,
};

export const DEFAULT_BPM = 100;
export const MIN_BPM = 40;
export const MAX_BPM = 240;

export interface Pattern {
  readonly dimensions: GridDimensions;
  readonly bpm: number;
  /** One on/off row per voice, each `totalSteps(dimensions)` cells long. */
  readonly rows: Readonly<Record<VoiceId, readonly boolean[]>>;
}

export function stepsPerBar(dimensions: GridDimensions): number {
  return dimensions.stepsPerBeat * dimensions.beatsPerBar;
}

export function totalSteps(dimensions: GridDimensions): number {
  return stepsPerBar(dimensions) * dimensions.bars;
}

/**
 * The capacity guard's bounds. These are **not** a statement about what drumscore presents
 * well — the staff is one unwrapped line and the grid is one very wide row, so sizes well
 * under these will look bad long before they are refused. They are protection against a
 * grid a browser cannot lay out at all.
 *
 * Sized past the work they have to survive: 4096 steps is 256 bars of 4/4 sixteenths, about
 * twice a full-song transcription, and roughly 24k grid cells at the ceiling. Nothing
 * planned should have to raise them.
 */
const MAX_TOTAL_STEPS = 4096;
const MAX_BARS = 256;
const MAX_BEATS_PER_BAR = 32;

/**
 * Is this a grid drumscore supports? The one answer in the codebase to that question.
 *
 * Called by the pattern codec, which is the one place an unchecked grid enters the app;
 * everything downstream — the engine, the grid, the audio engine, the renderer — trusts its
 * input because of this.
 */
export function isSupportedGrid(dimensions: GridDimensions): boolean {
  // Integrality and a floor of one. The codec feeds this raw bytes, where zero is reachable
  // and a grid with a zero in it has no steps to draw.
  if (!Object.values(dimensions).every((value) => Number.isInteger(value) && value >= 1)) {
    return false;
  }

  // Writability. Some note value must span exactly one step, or a hit on an off-step has
  // nothing that can express it and the engine has no way to write the pattern.
  //
  // This asks the staff's vocabulary rather than restating what it can write, so the answer
  // follows the vocabulary rather than drifting from it: the day `VALUES_PER_WHOLE` gains a
  // 32nd, 32nd-resolution grids become supported here with no edit; the day it gains tuplet
  // values, triplet resolutions do. There is deliberately no power-of-two test and no list
  // of allowed numbers — both would be a second, staler copy of the same fact.
  const stepsPerWhole = dimensions.stepsPerBeat * dimensions.beatValue;
  if (!VALUES_PER_WHOLE.some(([, perWhole]) => perWhole === stepsPerWhole)) return false;

  // Capacity — the guard, not a product statement. See the bounds above.
  //
  // Beats per bar is bounded separately because the other two do not imply it: one bar of
  // sixty beats at one step each is a tiny grid and an absurd meter.
  if (totalSteps(dimensions) > MAX_TOTAL_STEPS) return false;
  if (dimensions.bars > MAX_BARS) return false;
  if (dimensions.beatsPerBar > MAX_BEATS_PER_BAR) return false;

  return true;
}

export function createPattern(
  dimensions: GridDimensions = DEFAULT_DIMENSIONS,
  bpm: number = DEFAULT_BPM,
): Pattern {
  const steps = totalSteps(dimensions);
  const rows = Object.fromEntries(
    KIT.map((voice) => [voice.id, new Array<boolean>(steps).fill(false)]),
  ) as Record<VoiceId, boolean[]>;

  return { dimensions, bpm, rows };
}

export function isHit(pattern: Pattern, voice: VoiceId, step: number): boolean {
  return pattern.rows[voice][step] ?? false;
}

/**
 * Set the tempo, clamped to the supported range. Non-finite input (e.g. a cleared
 * number field) leaves the pattern untouched.
 */
export function setBpm(pattern: Pattern, bpm: number): Pattern {
  if (!Number.isFinite(bpm)) return pattern;
  const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
  if (clamped === pattern.bpm) return pattern;
  return { ...pattern, bpm: clamped };
}

/** Flip one cell. Out-of-range steps leave the pattern untouched. */
export function toggle(pattern: Pattern, voice: VoiceId, step: number): Pattern {
  const row = pattern.rows[voice];
  if (step < 0 || step >= row.length) return pattern;

  const next = [...row];
  next[step] = !next[step];

  return { ...pattern, rows: { ...pattern.rows, [voice]: next } };
}

/** Empty every cell, preserving dimensions and tempo. */
export function clear(pattern: Pattern): Pattern {
  return createPattern(pattern.dimensions, pattern.bpm);
}

/**
 * The default beat a fresh visitor lands on: a basic rock groove — closed hi-hat on
 * every 8th, kick on beats 1 & 3, snare on beats 2 & 4 — laid out from the grid
 * dimensions rather than hard-coded step numbers so it survives a resolution change.
 */
export function seed(
  dimensions: GridDimensions = DEFAULT_DIMENSIONS,
  bpm: number = DEFAULT_BPM,
): Pattern {
  const pattern = createPattern(dimensions, bpm);
  const { stepsPerBeat, beatsPerBar, bars } = dimensions;
  const rows = {
    ...pattern.rows,
    kick: [...pattern.rows.kick],
    snare: [...pattern.rows.snare],
    closedHiHat: [...pattern.rows.closedHiHat],
  };

  // A hi-hat every eighth note: one hit every half-beat's worth of steps.
  const hiHatEvery = Math.max(1, Math.round(stepsPerBeat / 2));
  for (let step = 0; step < rows.closedHiHat.length; step += hiHatEvery) {
    rows.closedHiHat[step] = true;
  }

  for (let bar = 0; bar < bars; bar++) {
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const step = (bar * beatsPerBar + beat) * stepsPerBeat;
      // Beats 1 & 3 (even index) get the kick; beats 2 & 4 (odd index) get the snare.
      if (beat % 2 === 0) rows.kick[step] = true;
      else rows.snare[step] = true;
    }
  }

  return { ...pattern, rows };
}
