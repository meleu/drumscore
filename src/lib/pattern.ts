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
