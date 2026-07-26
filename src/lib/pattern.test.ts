import { describe, expect, it } from 'vitest';
import { KIT } from './kit';
import {
  clear,
  createPattern,
  DEFAULT_DIMENSIONS,
  isHit,
  isSupportedGrid,
  seed,
  totalSteps,
  type GridDimensions,
  type Pattern,
  type VoiceId,
} from './pattern';

/** The steps switched on for a voice, in order. */
function hitSteps(pattern: Pattern, voice: VoiceId): number[] {
  return pattern.rows[voice].flatMap((on, step) => (on ? [step] : []));
}

describe('seed', () => {
  const pattern = seed();

  it('places the closed hi-hat on every eighth note', () => {
    expect(hitSteps(pattern, 'closedHiHat')).toEqual([
      0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
    ]);
  });

  it('places the kick on beats 1 & 3 of each bar', () => {
    expect(hitSteps(pattern, 'kick')).toEqual([0, 8, 16, 24]);
  });

  it('places the snare on beats 2 & 4 of each bar', () => {
    expect(hitSteps(pattern, 'snare')).toEqual([4, 12, 20, 28]);
  });

  it('leaves the remaining voices empty', () => {
    expect(hitSteps(pattern, 'openHiHat')).toEqual([]);
    expect(hitSteps(pattern, 'crash')).toEqual([]);
    expect(hitSteps(pattern, 'ride')).toEqual([]);
  });
});

describe('clear', () => {
  it('empties every cell while preserving dimensions and tempo', () => {
    const cleared = clear(seed());
    const steps = totalSteps(cleared.dimensions);

    expect(cleared.bpm).toBe(seed().bpm);
    expect(cleared.dimensions).toEqual(seed().dimensions);
    for (const { id } of KIT) {
      for (let step = 0; step < steps; step++) {
        expect(isHit(cleared, id, step)).toBe(false);
      }
    }
  });

  it('does not mutate the input pattern', () => {
    const before = seed();
    clear(before);
    expect(hitSteps(before, 'kick')).toEqual([0, 8, 16, 24]);
  });
});

describe('seed dimensions', () => {
  it('matches a freshly created empty pattern in shape', () => {
    const s = seed();
    const empty = createPattern();
    expect(s.dimensions).toEqual(empty.dimensions);
    expect(totalSteps(s.dimensions)).toBe(empty.rows.kick.length);
  });
});

/** A row of the verdict table below, spelled out so the table reads as a table. */
interface Verdict {
  what: string;
  dimensions: GridDimensions;
  supported: boolean;
}

function grid(
  stepsPerBeat: number,
  beatsPerBar: number,
  beatValue: number,
  bars: number,
): GridDimensions {
  return { stepsPerBeat, beatsPerBar, beatValue, bars };
}

/**
 * Which grids drumscore supports, stated rather than derived, so the predicate's intent is
 * readable without working it out from the note-value vocabulary.
 *
 * Refusals marked TEMPORARY are refused only because that vocabulary is what it is today.
 * They are the ones a future note value lifts on its own, with no edit to the predicate —
 * which is the whole reason the predicate asks the vocabulary instead of restating it. The
 * other refusals are permanent: a zero grid has nothing to draw, and the capacity guard is
 * a deliberate ceiling.
 */
const VERDICTS: readonly Verdict[] = [
  // Writable today: each of these has a note value spanning exactly one step.
  { what: "today's default, 4/4 sixteenths", dimensions: DEFAULT_DIMENSIONS, supported: true },
  { what: '4/4 at eighth-note resolution', dimensions: grid(2, 4, 4, 2), supported: true },
  { what: '4/4 at quarter-note resolution', dimensions: grid(1, 4, 4, 2), supported: true },
  { what: '7/8 at eighth-note beats', dimensions: grid(2, 7, 8, 1), supported: true },
  { what: '6/8 at eighth-note beats', dimensions: grid(2, 6, 8, 1), supported: true },
  { what: '5/4 sixteenths', dimensions: grid(4, 5, 4, 1), supported: true },
  { what: '3/4 sixteenths', dimensions: grid(4, 3, 4, 2), supported: true },
  { what: '2/2 at half-note beats', dimensions: grid(1, 2, 2, 1), supported: true },
  { what: 'one whole note per bar', dimensions: grid(1, 1, 1, 1), supported: true },
  { what: 'the step ceiling exactly', dimensions: grid(4, 4, 4, 256), supported: true },

  // TEMPORARY: a triplet resolution, and no value spans a third of a beat. Lifted the day
  // the vocabulary gains tuplet values. Today this grid reaches the engine from a hand-made
  // link and throws from inside its splitting logic.
  { what: 'three steps to a beat [TEMPORARY]', dimensions: grid(3, 4, 4, 2), supported: false },

  // TEMPORARY: needs a 32nd, which the vocabulary stops short of — the same failure from
  // the other end. Lifted the day it gains `thirtysecond`.
  { what: 'eight steps to a beat [TEMPORARY]', dimensions: grid(8, 4, 4, 2), supported: false },

  // TEMPORARY: the same 32-per-whole-note resolution reached through the beat value rather
  // than the step count, so the rule is visibly about the product of the two.
  { what: '32nds via the beat value [TEMPORARY]', dimensions: grid(4, 4, 8, 2), supported: false },

  // Permanently refused: a grid with a zero in it has nothing to draw.
  { what: 'zero steps per beat', dimensions: grid(0, 4, 4, 2), supported: false },
  { what: 'zero beats per bar', dimensions: grid(4, 0, 4, 2), supported: false },
  { what: 'zero bars', dimensions: grid(4, 4, 4, 0), supported: false },
  { what: 'a fractional step count', dimensions: grid(1.5, 4, 4, 2), supported: false },

  // Refused by the capacity guard, each bound catching what the others do not.
  { what: 'the maximal header, 64 everywhere', dimensions: grid(64, 64, 64, 64), supported: false },
  { what: 'too many steps, few enough bars', dimensions: grid(4, 8, 4, 256), supported: false },
  { what: 'too many bars, few enough steps', dimensions: grid(1, 4, 4, 257), supported: false },
  { what: 'a sixty-beat bar, though a tiny grid', dimensions: grid(1, 60, 4, 1), supported: false },
];

describe('isSupportedGrid', () => {
  for (const { what, dimensions, supported } of VERDICTS) {
    it(`${supported ? 'supports' : 'refuses'} ${what}`, () => {
      expect(isSupportedGrid(dimensions)).toBe(supported);
    });
  }
});
