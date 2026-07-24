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
 * Spell a measure out as a rhythm: `'rq q~8 8'` is a quarter rest, then a quarter note
 * tied to an eighth, then another eighth — an `r` prefix marks a rest and `~` ties one
 * stroke's pieces together. Steps come from laying the events end to end, which is
 * exactly how a measure is read.
 */
function measure(spec: string): NotationEvent[] {
  let step = 0;

  return spec.split(' ').flatMap((token) => {
    const isRest = token.startsWith('r');
    const codes = (isRest ? token.slice(1) : token).split('~');

    return codes.map((code, index): NotationEvent => {
      const value = valueOf(code);
      const event: NotationEvent = isRest
        ? { kind: 'rest', step, value }
        : { kind: 'note', step, value, tiedToNext: index < codes.length - 1 };
      step += STEPS[value];

      return event;
    });
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
      name: 'a backbeat rests up to the first snare, then holds across the beats',
      hits: { snare: [4, 12] },
      expected: ['rq q~q q', 'rw'],
    },
    {
      name: 'syncopated hits keep their off-beat placement',
      hits: { kick: [0, 3, 6] },
      expected: ['8~16 16~8 8~h', 'rw'],
    },
    {
      name: 'a hit held across a beat boundary is split and tied at the beat',
      hits: { kick: [6, 10] },
      expected: ['rq r8 8~8 8~q', 'rw'],
    },
    {
      name: 'a span of three sixteenths becomes an eighth tied to a sixteenth',
      hits: { kick: [12, 15] },
      expected: ['rh rq 8~16 16', 'rw'],
    },
    {
      name: 'a span of five sixteenths becomes a quarter tied to a sixteenth',
      hits: { kick: [8, 13] },
      expected: ['rh q~16 16~8', 'rw'],
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
      expected: ['rw', 'rq q~q q'],
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

  it.each(cases)('never ties into a rest or across the bar line: $name', ({ hits }) => {
    for (const { events } of toNotation(patternWith(hits)).measures) {
      for (const [index, event] of events.entries()) {
        if (event.kind === 'note' && event.tiedToNext) expect(events[index + 1]?.kind).toBe('note');
      }
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
