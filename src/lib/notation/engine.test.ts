import { describe, expect, it } from 'vitest';
import { createPattern, stepsPerBar, toggle, type Pattern, type VoiceId } from '$lib/pattern';
import { toNotation } from './engine';
import type { NotationEvent, NoteValue } from './model';

/** Build a pattern by switching on the listed steps for each voice. */
function patternWith(hits: Partial<Record<VoiceId, number[]>>): Pattern {
  return Object.entries(hits).reduce<Pattern>(
    (pattern, [voice, steps]) =>
      steps.reduce((current, step) => toggle(current, voice as VoiceId, step), pattern),
    createPattern(),
  );
}

/** How long each value lasts on the default 16th-note grid. */
const STEPS: Record<NoteValue, number> = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  sixteenth: 1,
};

const CODES: Record<string, NoteValue> = {
  w: 'whole',
  h: 'half',
  q: 'quarter',
  '8': 'eighth',
  '16': 'sixteenth',
};

function valueOf(code: string): NoteValue {
  const value = CODES[code];
  if (!value) throw new Error(`unknown rhythm code: ${code}`);

  return value;
}

/**
 * Spell a measure out as a rhythm: `'rq q rq q'` is a quarter rest, a quarter note,
 * another quarter rest and another quarter note — an `r` prefix marks a rest. Steps
 * come from laying the events end to end, which is exactly how a measure is read.
 */
function measure(spec: string): NotationEvent[] {
  let step = 0;

  return spec.split(' ').map((token) => {
    const isRest = token.startsWith('r');
    const value = valueOf(isRest ? token.slice(1) : token);
    const event: NotationEvent = { kind: isRest ? 'rest' : 'note', step, value };
    step += STEPS[value];

    return event;
  });
}

describe('toNotation', () => {
  it('carries the time signature from the pattern dimensions', () => {
    expect(toNotation(createPattern()).timeSignature).toEqual({ beats: 4, beatValue: 4 });
  });

  it('emits one measure per bar', () => {
    expect(toNotation(createPattern()).measures).toHaveLength(2);
  });

  const cases: { name: string; hits: Partial<Record<VoiceId, number[]>>; expected: string[] }[] = [
    {
      name: 'an empty bar is a single full-bar rest',
      hits: {},
      expected: ['rw', 'rw'],
    },
    {
      name: 'four on the floor collapses to quarter notes',
      hits: { kick: [0, 4, 8, 12] },
      expected: ['q q q q', 'rw'],
    },
    {
      name: 'straight 8ths collapse to eighth notes, not 16ths and rests',
      hits: { closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14] },
      expected: ['8 8 8 8 8 8 8 8', 'rw'],
    },
    {
      name: 'a backbeat rests through the beats before each snare',
      hits: { snare: [4, 12] },
      expected: ['rq q rq q', 'rw'],
    },
    {
      name: 'syncopated hits keep their off-beat placement',
      hits: { kick: [0, 3, 6] },
      expected: ['8 r16 16 r8 8 rh', 'rw'],
    },
    {
      name: 'a hit near the end of a bar is cut off by the bar line',
      hits: { kick: [12] },
      expected: ['rh rq q', 'rw'],
    },
    {
      name: 'the last hit of a bar runs to the bar line',
      hits: { crash: [0] },
      expected: ['w', 'rw'],
    },
    {
      name: 'simultaneous hits on different voices collapse into a single note',
      hits: { kick: [0], closedHiHat: [0], crash: [0] },
      expected: ['w', 'rw'],
    },
    {
      name: 'steps in the second bar are numbered relative to that bar',
      hits: { snare: [20, 28] },
      expected: ['rw', 'rq q rq q'],
    },
  ];

  it.each(cases)('$name', ({ hits, expected }) => {
    const { measures } = toNotation(patternWith(hits));

    expect(measures.map(({ events }) => events)).toEqual(expected.map(measure));
  });

  it.each(cases)('fills every measure exactly: $name', ({ hits }) => {
    const pattern = patternWith(hits);
    const barLength = stepsPerBar(pattern.dimensions);

    for (const { events } of toNotation(pattern).measures) {
      const lengths = events.map(({ value }) => STEPS[value]);
      const total = lengths.reduce((sum, steps) => sum + steps, 0);

      expect(total).toBe(barLength);
      expect(events.map(({ step }) => step)).toEqual(runningTotals(lengths));
    }
  });
});

/** [4, 4, 8] -> [0, 4, 8]: where each event starts once the earlier ones are laid out. */
function runningTotals(lengths: number[]): number[] {
  let total = 0;

  return lengths.map((length) => {
    const start = total;
    total += length;

    return start;
  });
}
