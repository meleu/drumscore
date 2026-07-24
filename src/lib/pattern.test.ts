import { describe, expect, it } from 'vitest';
import {
  clear,
  createPattern,
  isHit,
  seed,
  totalSteps,
  VOICE_IDS,
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
    for (const voice of VOICE_IDS) {
      for (let step = 0; step < steps; step++) {
        expect(isHit(cleared, voice, step)).toBe(false);
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
