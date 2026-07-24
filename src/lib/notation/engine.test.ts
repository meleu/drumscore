import { describe, expect, it } from 'vitest';
import { createPattern, toggle, type Pattern, type VoiceId } from '$lib/pattern';
import { toNotation } from './engine';
import type { NotationNote } from './model';

/** Build a pattern by switching on the listed steps for each voice. */
function patternWith(hits: Partial<Record<VoiceId, number[]>>): Pattern {
  return Object.entries(hits).reduce<Pattern>(
    (pattern, [voice, steps]) =>
      steps.reduce((current, step) => toggle(current, voice as VoiceId, step), pattern),
    createPattern(),
  );
}

function sixteenthsAt(steps: number[]): NotationNote[] {
  return steps.map((step) => ({ step, value: 'sixteenth' as const }));
}

describe('toNotation', () => {
  it('carries the time signature from the pattern dimensions', () => {
    expect(toNotation(createPattern()).timeSignature).toEqual({ beats: 4, beatValue: 4 });
  });

  it('emits one measure per bar', () => {
    expect(toNotation(createPattern()).measures).toHaveLength(2);
  });

  const cases: { name: string; hits: Partial<Record<VoiceId, number[]>>; expected: number[][] }[] =
    [
      {
        name: 'an empty pattern produces no notes',
        hits: {},
        expected: [[], []],
      },
      {
        name: 'kick on beats 1 and 3 of the first bar',
        hits: { kick: [0, 8] },
        expected: [[0, 8], []],
      },
      {
        name: 'steps in the second bar are numbered relative to that bar',
        hits: { snare: [20, 28] },
        expected: [[], [4, 12]],
      },
      {
        name: 'hits are ordered by step regardless of the order they were toggled',
        hits: { crash: [12], kick: [0], snare: [4] },
        expected: [[0, 4, 12], []],
      },
      {
        name: 'simultaneous hits on different voices collapse into a single note',
        hits: { kick: [0], closedHiHat: [0], crash: [0] },
        expected: [[0], []],
      },
    ];

  it.each(cases)('$name', ({ hits, expected }) => {
    const measures = toNotation(patternWith(hits)).measures;

    expect(measures.map((measure) => measure.notes)).toEqual(expected.map(sixteenthsAt));
  });
});
