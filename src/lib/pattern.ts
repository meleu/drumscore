/**
 * Pattern model: source of truth for what the user drew.
 *
 * Dimensions live in data, not literals, so resolution/meter/bars can change later.
 * Operations are pure — they return a new pattern.
 */

import { accepts, KIT, type Hit, type VoiceId } from './kit';
import { VALUES_PER_WHOLE } from './notation/model';

/** Re-exported for the interfaces below; the lists live in `kit.ts`. */
export type { Hit, VoiceId };

export interface GridDimensions {
  /** 4 gives 16th-note resolution. */
  stepsPerBeat: number;
  /** Time signature numerator. */
  beatsPerBar: number;
  /** Time signature denominator: 4 = the quarter note gets the beat. */
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
  /**
   * One row per voice, `totalSteps(dimensions)` cells long. A cell holds how it is struck,
   * `'off'` included, so silence and variations need no second structure.
   */
  readonly rows: Readonly<Record<VoiceId, readonly Hit[]>>;
}

export function stepsPerBar(dimensions: GridDimensions): number {
  return dimensions.stepsPerBeat * dimensions.beatsPerBar;
}

export function totalSteps(dimensions: GridDimensions): number {
  return stepsPerBar(dimensions) * dimensions.bars;
}

/**
 * Capacity guard, not a taste judgement — sizes well under these already look bad on one
 * unwrapped staff. Stops grids a browser cannot lay out at all: 4096 steps is 256 bars of
 * 4/4 sixteenths, ~24k grid cells, twice a full-song transcription.
 */
const MAX_TOTAL_STEPS = 4096;
const MAX_BARS = 256;
const MAX_BEATS_PER_BAR = 32;

/**
 * The one answer to "is this grid supported?". Called by the codec, the only door an
 * unchecked grid enters by; engine, grid, audio and renderer trust their input because
 * of this.
 */
export function isSupportedGrid(dimensions: GridDimensions): boolean {
  // Integral, min 1: the codec feeds raw bytes, and a zero leaves nothing to draw.
  if (!Object.values(dimensions).every((value) => Number.isInteger(value) && value >= 1)) {
    return false;
  }

  // Writability: some note value must span exactly one step, or a hit on an off-step has
  // nothing to express it. Asks the staff's vocabulary rather than restating it, so adding
  // a 32nd (or tuplets) to `VALUES_PER_WHOLE` widens this with no edit here. Deliberately
  // no power-of-two test and no allow-list — both would be a staler copy of the same fact.
  const stepsPerWhole = dimensions.stepsPerBeat * dimensions.beatValue;
  if (!VALUES_PER_WHOLE.some(([, perWhole]) => perWhole === stepsPerWhole)) return false;

  // Beats per bar is bounded separately: one bar of sixty one-step beats is a tiny grid
  // and an absurd meter.
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
    KIT.map((voice) => [voice.id, new Array<Hit>(steps).fill('off')]),
  ) as Record<VoiceId, Hit[]>;

  return { dimensions, bpm, rows };
}

/** How this cell is struck; a step outside the grid reads as silent. */
export function hitAt(pattern: Pattern, voice: VoiceId, step: number): Hit {
  return pattern.rows[voice][step] ?? 'off';
}

/** Struck at all — what everything that ignores the variation asks. */
export function isHit(pattern: Pattern, voice: VoiceId, step: number): boolean {
  return hitAt(pattern, voice, step) !== 'off';
}

/** Clamped to range. Non-finite (e.g. a cleared number field) changes nothing. */
export function setBpm(pattern: Pattern, bpm: number): Pattern {
  if (!Number.isFinite(bpm)) return pattern;
  const clamped = Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
  if (clamped === pattern.bpm) return pattern;
  return { ...pattern, bpm: clamped };
}

/**
 * Strike one cell this way, or silence it with `'off'`.
 *
 * Refuses by handing back the same pattern — out-of-grid step, unaccepted variation, or
 * setting what the cell already holds — so the sketchpad's identity-means-no-change rule
 * covers all three (ADR-0013).
 */
export function setHit(pattern: Pattern, voice: VoiceId, step: number, hit: Hit): Pattern {
  const row = pattern.rows[voice];
  if (step < 0 || step >= row.length) return pattern;
  if (!accepts(voice, hit)) return pattern;
  if (row[step] === hit) return pattern;

  const next = [...row];
  next[step] = hit;

  return { ...pattern, rows: { ...pattern.rows, [voice]: next } };
}

/**
 * Left-click: flip between silent and plain. Two states whatever the cell holds — a cell
 * has no history to demote a flam to, and one gesture must not mean two things (ADR-0012).
 */
export function toggle(pattern: Pattern, voice: VoiceId, step: number): Pattern {
  return setHit(pattern, voice, step, isHit(pattern, voice, step) ? 'off' : 'plain');
}

/** Empty every cell; dimensions and tempo survive. */
export function clear(pattern: Pattern): Pattern {
  return createPattern(pattern.dimensions, pattern.bpm);
}

/**
 * The default beat: closed hi-hat on every 8th, kick on 1 & 3, snare on 2 & 4. Derived
 * from the dimensions rather than hard-coded steps, so it survives a resolution change.
 * Plain hits only — the seed teaches the grid, not the variations.
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

  // Every 8th: one hit per half-beat's worth of steps.
  const hiHatEvery = Math.max(1, Math.round(stepsPerBeat / 2));
  for (let step = 0; step < rows.closedHiHat.length; step += hiHatEvery) {
    rows.closedHiHat[step] = 'plain';
  }

  for (let bar = 0; bar < bars; bar++) {
    for (let beat = 0; beat < beatsPerBar; beat++) {
      const step = (bar * beatsPerBar + beat) * stepsPerBeat;
      if (beat % 2 === 0) rows.kick[step] = 'plain';
      else rows.snare[step] = 'plain';
    }
  }

  return { ...pattern, rows };
}
