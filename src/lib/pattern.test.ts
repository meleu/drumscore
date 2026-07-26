import { describe, expect, it } from 'vitest';
import { KIT, type Hit } from './kit';
import {
  clear,
  createPattern,
  DEFAULT_DIMENSIONS,
  hitAt,
  isHit,
  isSupportedGrid,
  seed,
  setHit,
  toggle,
  totalSteps,
  type GridDimensions,
  type Pattern,
  type VoiceId,
} from './pattern';

/** The struck steps of a voice, in order, however struck. */
function hitSteps(pattern: Pattern, voice: VoiceId): number[] {
  return pattern.rows[voice].flatMap((hit, step) => (hit === 'off' ? [] : [step]));
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

  it('strikes every hit plainly — the seed teaches the grid, not the variations', () => {
    for (const { id } of KIT) {
      for (const step of hitSteps(pattern, id)) expect(hitAt(pattern, id, step)).toBe('plain');
    }
  });
});

describe('toggle', () => {
  const empty = createPattern();

  it('strikes an empty cell plainly', () => {
    expect(hitAt(toggle(empty, 'snare', 4), 'snare', 4)).toBe('plain');
  });

  /** One gesture always empties a step: no variation takes two clicks to undo. */
  const struck: Hit[] = ['plain', 'accent', 'ghost', 'flam', 'drag'];

  it.each(struck)('clears a cell holding %s', (hit) => {
    const pattern = setHit(empty, 'snare', 4, hit);

    expect(hitAt(pattern, 'snare', 4)).toBe(hit);
    expect(hitAt(toggle(pattern, 'snare', 4), 'snare', 4)).toBe('off');
  });

  it('leaves a step outside the grid untouched', () => {
    expect(toggle(empty, 'kick', 999)).toBe(empty);
    expect(toggle(empty, 'kick', -1)).toBe(empty);
  });

  it('does not mutate the pattern it is given', () => {
    toggle(empty, 'snare', 4);

    expect(isHit(empty, 'snare', 4)).toBe(false);
  });
});

describe('setHit', () => {
  const empty = createPattern();

  it('places a variation on an empty cell in one go', () => {
    expect(hitAt(setHit(empty, 'snare', 4, 'accent'), 'snare', 4)).toBe('accent');
  });

  it('replaces one variation with another', () => {
    const accented = setHit(empty, 'snare', 4, 'accent');

    expect(hitAt(setHit(accented, 'snare', 4, 'ghost'), 'snare', 4)).toBe('ghost');
  });

  it('demotes a variation to a plain hit without clearing it first', () => {
    const flammed = setHit(empty, 'snare', 4, 'flam');

    expect(hitAt(setHit(flammed, 'snare', 4, 'plain'), 'snare', 4)).toBe('plain');
  });

  it('empties a cell when asked for silence', () => {
    const accented = setHit(empty, 'kick', 0, 'accent');

    expect(isHit(setHit(accented, 'kick', 0, 'off'), 'kick', 0)).toBe(false);
  });

  /** A refusal hands back its input — what the sketchpad reads as "nothing happened". */
  it('refuses a variation the drum does not accept', () => {
    expect(setHit(empty, 'crash', 0, 'accent')).toBe(empty);
    expect(setHit(empty, 'kick', 0, 'ghost')).toBe(empty);
    expect(setHit(empty, 'ride', 0, 'drag')).toBe(empty);
  });

  it('refuses a step outside the grid', () => {
    expect(setHit(empty, 'snare', 999, 'accent')).toBe(empty);
    expect(setHit(empty, 'snare', -1, 'accent')).toBe(empty);
  });

  it('refuses to set what the cell already holds', () => {
    const accented = setHit(empty, 'snare', 4, 'accent');

    expect(setHit(accented, 'snare', 4, 'accent')).toBe(accented);
    expect(setHit(empty, 'snare', 4, 'off')).toBe(empty);
  });

  it('lets every drum be struck plainly and silenced, the crash included', () => {
    for (const { id } of KIT) {
      expect(hitAt(setHit(empty, id, 0, 'plain'), id, 0)).toBe('plain');
    }
  });

  it('leaves the rest of the pattern alone', () => {
    const pattern = setHit(seed(), 'snare', 4, 'accent');

    expect(hitSteps(pattern, 'snare')).toEqual(hitSteps(seed(), 'snare'));
    expect(hitAt(pattern, 'snare', 12)).toBe('plain');
    expect(pattern.rows.kick).toEqual(seed().rows.kick);
  });
});

describe('clear', () => {
  it('empties every cell while preserving dimensions and tempo', () => {
    // Variations included: starting over must genuinely start over.
    const cleared = clear(setHit(seed(), 'snare', 4, 'accent'));
    const steps = totalSteps(cleared.dimensions);

    expect(cleared.bpm).toBe(seed().bpm);
    expect(cleared.dimensions).toEqual(seed().dimensions);
    for (const { id } of KIT) {
      for (let step = 0; step < steps; step++) {
        expect(hitAt(cleared, id, step)).toBe('off');
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
 * Which grids are supported, stated rather than derived, so the predicate's intent reads
 * without working it out from the note-value vocabulary.
 *
 * TEMPORARY refusals are down to today's vocabulary alone; a future note value lifts them
 * with no edit to the predicate. The rest are permanent: a zero grid has nothing to draw,
 * and the capacity guard is a deliberate ceiling.
 */
const VERDICTS: readonly Verdict[] = [
  // Writable today: each has a note value spanning exactly one step.
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
  { what: '4/4 at 32nd-note resolution', dimensions: grid(8, 4, 4, 2), supported: true },
  // 32-per-whole reached via the beat value, so the rule is visibly about the product of
  // the two rather than about the step count alone.
  { what: '32nds via the beat value', dimensions: grid(4, 4, 8, 2), supported: true },

  // TEMPORARY: triplets, and no value spans a third of a beat. Lifted by tuplet values.
  { what: 'three steps to a beat [TEMPORARY]', dimensions: grid(3, 4, 4, 2), supported: false },

  // TEMPORARY: needs a 64th — the same failure from the other end, one level finer now
  // that the 32nd has landed.
  { what: 'sixteen steps to a beat [TEMPORARY]', dimensions: grid(16, 4, 4, 2), supported: false },

  // Permanent: a grid with a zero in it has nothing to draw.
  { what: 'zero steps per beat', dimensions: grid(0, 4, 4, 2), supported: false },
  { what: 'zero beats per bar', dimensions: grid(4, 0, 4, 2), supported: false },
  { what: 'zero bars', dimensions: grid(4, 4, 4, 0), supported: false },
  { what: 'a fractional step count', dimensions: grid(1.5, 4, 4, 2), supported: false },

  // Capacity guard; each bound catches what the others do not.
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
