import { describe, expect, it } from 'vitest';
import { createPattern, stepsPerBar, toggle, type Pattern, type VoiceId } from '$lib/pattern';
import { toNotation } from './engine';
import type {
  NotationEvent,
  NotationMeasure,
  NotationPart,
  Notehead,
  NoteValue,
  PartId,
} from './model';

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

const CODES: Record<NoteValue, string> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  sixteenth: '16',
};

/**
 * Spell a measure out as a rhythm: `'rq q 8'` is a quarter rest, then a quarter note, then
 * an eighth — an `r` prefix marks a rest and a trailing `.` an augmentation dot, so `8.` is
 * a dotted eighth. Reading the events back this way keeps the expectations below short
 * enough to check against the bar you have in your head.
 */
function rhythm(events: NotationEvent[]): string {
  return events
    .map((event, index) => {
      const separator = index === 0 ? '' : ' ';
      const dots = '.'.repeat(event.dots);

      return separator + (event.kind === 'rest' ? 'r' : '') + CODES[event.value] + dots;
    })
    .join('');
}

function partOf(measure: NotationMeasure, id: PartId): NotationPart {
  const part = measure.parts.find((candidate) => candidate.id === id);
  if (!part) throw new Error(`no ${id} part in the measure`);

  return part;
}

function measureOf(pattern: Pattern, bar = 0): NotationMeasure {
  const measure = toNotation(pattern).measures[bar];
  if (!measure) throw new Error(`the notation has no bar ${bar}`);

  return measure;
}

function rhythmOf(pattern: Pattern, id: PartId): string[] {
  return toNotation(pattern).measures.map((measure) => rhythm(partOf(measure, id).events));
}

const KICK: Notehead = { style: 'normal', position: { step: 'f', octave: 4 } };
const SNARE: Notehead = { style: 'normal', position: { step: 'c', octave: 5 } };
const CLOSED_HI_HAT: Notehead = { style: 'cross', position: { step: 'g', octave: 5 } };
const OPEN_HI_HAT: Notehead = { style: 'cross', position: { step: 'g', octave: 5 } };
const CRASH: Notehead = { style: 'cross', position: { step: 'a', octave: 5 } };
const RIDE: Notehead = { style: 'cross', position: { step: 'f', octave: 5 } };

/** The noteheads of the first note in a part's first measure. */
function firstChord(pattern: Pattern, id: PartId): Notehead[] {
  const note = partOf(measureOf(pattern), id).events.find((event) => event.kind === 'note');
  if (!note) throw new Error(`the ${id} part has no notes`);

  return note.noteheads;
}

describe('toNotation', () => {
  it('carries the time signature from the pattern dimensions', () => {
    expect(toNotation(createPattern()).timeSignature).toEqual({ beats: 4, beatValue: 4 });
  });

  it('emits one measure per bar', () => {
    expect(toNotation(createPattern()).measures).toHaveLength(2);
  });

  interface Case {
    name: string;
    hits: Partial<Record<VoiceId, number[]>>;
    hands: string[];
    feet: string[];
  }

  const cases: Case[] = [
    {
      name: 'an empty bar is a single full-bar rest in both parts',
      hits: {},
      hands: ['rw', 'rw'],
      feet: ['rw', 'rw'],
    },
    {
      name: 'four on the floor collapses to quarter notes',
      hits: { kick: [0, 4, 8, 12] },
      hands: ['rw', 'rw'],
      feet: ['q q q q', 'rw'],
    },
    {
      name: 'straight 8ths collapse to eighth notes, not 16ths and rests',
      hits: { closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14] },
      hands: ['8 8 8 8 8 8 8 8', 'rw'],
      feet: ['rw', 'rw'],
    },
    {
      name: 'a backbeat is a quarter on 2 and on 4, with rests between',
      hits: { snare: [4, 12] },
      hands: ['rq q rq q', 'rw'],
      feet: ['rw', 'rw'],
    },
    {
      name: 'a hit three sixteenths before the next is a dotted eighth on the beat',
      hits: { kick: [0, 3, 6] },
      hands: ['rw', 'rw'],
      feet: ['8. 16 r8 8 rh', 'rw'],
    },
    {
      name: 'silence for three sixteenths from a beat is a dotted-eighth rest',
      hits: { kick: [3] },
      hands: ['rw', 'rw'],
      feet: ['r8. 16 rq rh', 'rw'],
    },
    {
      name: 'a struck hit never sounds past its own beat',
      hits: { kick: [6, 10] },
      hands: ['rw', 'rw'],
      feet: ['rq r8 8 r8 8 rq', 'rw'],
    },
    {
      name: 'a struck span of three sixteenths on the beat is a dotted eighth',
      hits: { kick: [12, 15] },
      hands: ['rw', 'rw'],
      feet: ['rh rq 8. 16', 'rw'],
    },
    {
      name: 'a struck span of five sixteenths is a note and a rest',
      hits: { kick: [8, 13] },
      hands: ['rw', 'rw'],
      feet: ['rh q r16 16 r8', 'rw'],
    },
    {
      name: 'a crash is struck like any voice, not held for the whole bar',
      hits: { crash: [0] },
      hands: ['q rq rh', 'rw'],
      feet: ['rw', 'rw'],
    },
    {
      name: 'a crash no longer sustains across the beat into the next hit',
      hits: { crash: [0], ride: [6] },
      hands: ['q r8 8 rh', 'rw'],
      feet: ['rw', 'rw'],
    },
    {
      name: 'a struck open hi-hat span of three sixteenths on the beat is a dotted eighth',
      hits: { openHiHat: [12, 15] },
      hands: ['rh rq 8. 16', 'rw'],
      feet: ['rw', 'rw'],
    },
    {
      name: 'a struck open hi-hat span of five sixteenths is a note and a rest',
      hits: { openHiHat: [8, 13] },
      hands: ['rh q r16 16 r8', 'rw'],
      feet: ['rw', 'rw'],
    },
    {
      name: 'a struck crash near the bar line rests out to the bar line',
      hits: { crash: [13] },
      hands: ['rh rq r16 16 r8', 'rw'],
      feet: ['rw', 'rw'],
    },
    {
      name: 'simultaneous hands hits collapse into one note, and the kick keeps its own',
      hits: { kick: [0], snare: [0], closedHiHat: [0] },
      hands: ['q rq rh', 'rw'],
      feet: ['q rq rh', 'rw'],
    },
    {
      name: 'the hands and feet each rest out their own bar independently',
      hits: { kick: [0], crash: [0] },
      hands: ['q rq rh', 'rw'],
      feet: ['q rq rh', 'rw'],
    },
    {
      name: 'a kick between two snares no longer chops up the snare rhythm',
      hits: { snare: [4, 12], kick: [0, 6, 8] },
      hands: ['rq q rq q', 'rw'],
      feet: ['q r8 8 q rq', 'rw'],
    },
    {
      name: 'a rock beat writes each part from its own hits',
      hits: {
        closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14],
        snare: [4, 12],
        kick: [0, 8],
      },
      hands: ['8 8 8 8 8 8 8 8', 'rw'],
      feet: ['q rq q rq', 'rw'],
    },
    {
      name: 'steps in the second bar are numbered relative to that bar',
      hits: { snare: [20, 28] },
      hands: ['rw', 'rq q rq q'],
      feet: ['rw', 'rw'],
    },
  ];

  it.each(cases)('$name', ({ hits, hands, feet }) => {
    const pattern = patternWith(hits);

    expect(rhythmOf(pattern, 'hands')).toEqual(hands);
    expect(rhythmOf(pattern, 'feet')).toEqual(feet);
  });

  it.each(cases)('fills every measure of every part exactly: $name', ({ hits }) => {
    const pattern = patternWith(hits);
    const barLength = stepsPerBar(pattern.dimensions);

    for (const { parts } of toNotation(pattern).measures) {
      for (const { events } of parts) {
        // A dot adds half again, so a dotted value covers 1.5x its plain step count.
        const lengths = events.map((event) => STEPS[event.value] * (2 - 2 ** -event.dots));
        const total = lengths.reduce((sum, steps) => sum + steps, 0);

        expect(total).toBe(barLength);
        expect(events.map(({ step }) => step)).toEqual(runningTotals(lengths));
      }
    }
  });

  it.each(cases)('gives every note at least one notehead: $name', ({ hits }) => {
    for (const { parts } of toNotation(patternWith(hits)).measures) {
      for (const { events } of parts) {
        for (const event of events) {
          if (event.kind === 'note') expect(event.noteheads.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('parts', () => {
  it('writes the hands stems-up and the feet stems-down', () => {
    const measure = measureOf(createPattern());

    expect(measure.parts.map(({ id, stemDirection }) => [id, stemDirection])).toEqual([
      ['hands', 'up'],
      ['feet', 'down'],
    ]);
  });

  it('rests in each part sit clear of the other part', () => {
    const measure = measureOf(patternWith({}));

    expect(measure.parts.map(({ events }) => events)).toEqual([
      [{ kind: 'rest', step: 0, value: 'whole', dots: 0, position: { step: 'd', octave: 5 } }],
      [{ kind: 'rest', step: 0, value: 'whole', dots: 0, position: { step: 'g', octave: 4 } }],
    ]);
  });

  it('sits shorter rests on the line below the whole rest', () => {
    const hands = partOf(measureOf(patternWith({ snare: [12] })), 'hands');

    expect(hands.events).toEqual([
      { kind: 'rest', step: 0, value: 'half', dots: 0, position: { step: 'b', octave: 4 } },
      { kind: 'rest', step: 8, value: 'quarter', dots: 0, position: { step: 'b', octave: 4 } },
      { kind: 'note', step: 12, value: 'quarter', dots: 0, noteheads: [SNARE] },
    ]);
  });
});

describe('noteheads', () => {
  const drums: [VoiceId, PartId, Notehead][] = [
    ['kick', 'feet', KICK],
    ['snare', 'hands', SNARE],
    ['closedHiHat', 'hands', CLOSED_HI_HAT],
    ['openHiHat', 'hands', OPEN_HI_HAT],
    ['crash', 'hands', CRASH],
    ['ride', 'hands', RIDE],
  ];

  it.each(drums)('writes %s with its conventional notehead and position', (voice, part, head) => {
    expect(firstChord(patternWith({ [voice]: [0] }), part)).toEqual([head]);
  });

  it('merges simultaneous hands hits into one chord, ordered low to high', () => {
    const pattern = patternWith({ snare: [0], crash: [0], ride: [0] });

    expect(firstChord(pattern, 'hands')).toEqual([SNARE, RIDE, CRASH]);
  });

  it('keeps the kick out of the hands chord', () => {
    const pattern = patternWith({ kick: [0], snare: [0], closedHiHat: [0] });

    expect(firstChord(pattern, 'hands')).toEqual([SNARE, CLOSED_HI_HAT]);
    expect(firstChord(pattern, 'feet')).toEqual([KICK]);
  });

  it('writes both hi-hats struck together as a single notehead', () => {
    const pattern = patternWith({ closedHiHat: [0], openHiHat: [0] });

    expect(firstChord(pattern, 'hands')).toEqual([CLOSED_HI_HAT]);
  });
});

describe('beaming', () => {
  function beamsOf(pattern: Pattern, id: PartId, bar = 0): number[][] {
    return partOf(measureOf(pattern, bar), id).beams.map((group) => group.steps);
  }

  it('beams a straight run of sixteenths one beam per beat', () => {
    const pattern = patternWith({ closedHiHat: [0, 1, 2, 3, 4, 5, 6, 7] });

    expect(beamsOf(pattern, 'hands')).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]);
  });

  it('beams straight eighths per beat, two to a beam', () => {
    const pattern = patternWith({ closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14] });

    expect(beamsOf(pattern, 'hands')).toEqual([
      [0, 2],
      [4, 6],
      [8, 10],
      [12, 14],
    ]);
  });

  it('breaks a beam at a rest and starts a fresh one after the gap', () => {
    const pattern = patternWith({ closedHiHat: [0, 1, 2, 6, 7] });

    // 0,1 are sixteenths; 2 becomes an eighth reaching the beat line; then a rest to 6.
    expect(beamsOf(pattern, 'hands')).toEqual([
      [0, 1, 2],
      [6, 7],
    ]);
  });

  it('does not beam a lone flagged note', () => {
    const pattern = patternWith({ snare: [2] });

    expect(beamsOf(pattern, 'hands')).toEqual([]);
  });

  it('leaves unbeamable quarter notes alone', () => {
    const pattern = patternWith({ kick: [0, 4, 8, 12] });

    expect(beamsOf(pattern, 'feet')).toEqual([]);
  });

  it('does not join sixteenths across a beat line into one beam', () => {
    const pattern = patternWith({ closedHiHat: [2, 3, 4, 5] });

    // The beat falls between step 3 and step 4, so the run splits there.
    expect(beamsOf(pattern, 'hands')).toEqual([
      [2, 3],
      [4, 5],
    ]);
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
