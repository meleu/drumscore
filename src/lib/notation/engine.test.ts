import { describe, expect, it } from 'vitest';
import {
  createPattern,
  isSupportedGrid,
  setHit,
  stepsPerBar,
  toggle,
  totalSteps,
  type GridDimensions,
  type Hit,
  type Pattern,
  type VoiceId,
} from '$lib/pattern';
import { toNotation } from './engine';
import {
  VALUES_PER_WHOLE,
  type NotationEvent,
  type NotationMeasure,
  type NotationModel,
  type NotationPart,
  type Notehead,
  type NoteValue,
  type PartId,
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
      { kind: 'note', step: 12, value: 'quarter', dots: 0, noteheads: [SNARE], accented: false },
    ]);
  });
});

/**
 * Which notes carry an accent mark, asserted as plain data.
 *
 * The interesting cases are all chords, because the snare shares the hands part with every
 * cymbal: the mark has one place to go, so the engine ORs the accent across the drums under
 * one stem and the staff says nothing about which of them was meant (ADR-0014).
 */
describe('accents', () => {
  /** Strike some cells a named way over a pattern already carrying plain hits. */
  function struck(hits: Partial<Record<VoiceId, number[]>>, marks: [VoiceId, number, Hit][]) {
    return marks.reduce(
      (pattern, [voice, step, hit]) => setHit(pattern, voice, step, hit),
      patternWith(hits),
    );
  }

  /** Which steps of a part's first measure are written with an accent. */
  function accentedSteps(pattern: Pattern, id: PartId): number[] {
    return partOf(measureOf(pattern), id)
      .events.filter((event) => event.kind === 'note' && event.accented)
      .map(({ step }) => step);
  }

  it('marks no note when nothing is accented', () => {
    expect(accentedSteps(patternWith({ snare: [4, 12] }), 'hands')).toEqual([]);
  });

  it('marks the accented hand stroke and no other', () => {
    const pattern = struck({ snare: [4, 12] }, [['snare', 4, 'accent']]);

    expect(accentedSteps(pattern, 'hands')).toEqual([4]);
  });

  it('marks an accented foot stroke in the feet part alone', () => {
    const pattern = struck({ kick: [0, 8], snare: [4] }, [['kick', 0, 'accent']]);

    expect(accentedSteps(pattern, 'feet')).toEqual([0]);
    expect(accentedSteps(pattern, 'hands')).toEqual([]);
  });

  it('marks the whole chord when one of its drums is accented', () => {
    const pattern = struck({ snare: [0], closedHiHat: [0] }, [['snare', 0, 'accent']]);
    const note = partOf(measureOf(pattern), 'hands').events[0];

    // One note, both heads, one mark: the hi-hat is drawn accented because it shares the stem.
    expect(note).toMatchObject({ kind: 'note', noteheads: [SNARE, CLOSED_HI_HAT], accented: true });
  });

  it('marks the chord whichever of its drums carries the accent', () => {
    const pattern = struck({ snare: [0], ride: [0] }, [['ride', 0, 'accent']]);

    expect(accentedSteps(pattern, 'hands')).toEqual([0]);
  });

  it('keeps an accent out of the other part sharing the step', () => {
    const pattern = struck({ kick: [0], crash: [0] }, [['kick', 0, 'accent']]);

    expect(accentedSteps(pattern, 'feet')).toEqual([0]);
    expect(accentedSteps(pattern, 'hands')).toEqual([]);
  });

  it('marks every accented stroke of a busy bar', () => {
    const hits = { closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14] };
    const pattern = struck(hits, [
      ['closedHiHat', 0, 'accent'],
      ['closedHiHat', 8, 'accent'],
    ]);

    expect(accentedSteps(pattern, 'hands')).toEqual([0, 8]);
  });

  it('numbers accented steps relative to their own bar', () => {
    const pattern = struck({ snare: [4, 20] }, [['snare', 20, 'accent']]);

    expect(accentedSteps(pattern, 'hands')).toEqual([]);
    expect(
      partOf(measureOf(pattern, 1), 'hands')
        .events.filter((event) => event.kind === 'note' && event.accented)
        .map(({ step }) => step),
    ).toEqual([4]);
  });

  /** An accent says how a stroke is played, never how long it is. */
  it('leaves the rhythm, the rests, the dots and the beams exactly as they were', () => {
    const hits = { closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12], kick: [0, 3, 8] };
    const plain = toNotation(patternWith(hits));
    const accented = toNotation(
      struck(hits, [
        ['snare', 4, 'accent'],
        ['kick', 3, 'accent'],
      ]),
    );

    const rhythms = (model: NotationModel) =>
      model.measures.map(({ parts }) =>
        parts.map(({ events, beams }) => [rhythm(events), beams.map((group) => group.steps)]),
      );

    expect(rhythms(accented)).toEqual(rhythms(plain));
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

  /**
   * The table above says which head each drum is written with; this says which part writes
   * it. Together they pin what the engine used to state as two literals and now derives
   * from the Kit — so a drum that drifted into the wrong part, or into both, fails here.
   */
  it.each(drums)('writes %s into no part but the %s', (voice, part) => {
    const other: PartId = part === 'hands' ? 'feet' : 'hands';
    const silent = partOf(measureOf(patternWith({ [voice]: [0] })), other);

    expect(rhythm(silent.events)).toBe('rw');
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

/**
 * The claim `isSupportedGrid` makes, checked against the engine that has to honour it.
 *
 * The predicate says a grid is writable when the note-value vocabulary holds a value spanning
 * exactly one step. This sweep is what makes that a testable claim rather than an argument:
 * every grid it admits must survive the worst case the engine has — a hit on every step of
 * every voice, which is the densest splitting and beaming there is.
 *
 * Only the admitted grids are visited. The direction that reaches a user is the predicate
 * being too permissive; a grid it refuses cannot arrive, so nothing is owed about it.
 *
 * This is the drift guard. When the vocabulary grows a value, this is the test that fails if
 * "some value spans exactly one step" turns out not to be enough for the grids it just let in.
 */
describe('the grids the predicate admits', () => {
  /**
   * Each dimension over 1-16, and one bar or two — a second measure is what proves the engine
   * repeats correctly, and a third proves nothing further. Sixteen is past every meter and
   * resolution today's vocabulary can write, so the space contains the whole answer rather
   * than a sample of it.
   */
  const RANGE = 16;
  const BARS = 2;

  function everyGrid(): GridDimensions[] {
    const grids: GridDimensions[] = [];

    for (let stepsPerBeat = 1; stepsPerBeat <= RANGE; stepsPerBeat++) {
      for (let beatsPerBar = 1; beatsPerBar <= RANGE; beatsPerBar++) {
        for (let beatValue = 1; beatValue <= RANGE; beatValue++) {
          for (let bars = 1; bars <= BARS; bars++) {
            grids.push({ stepsPerBeat, beatsPerBar, beatValue, bars });
          }
        }
      }
    }

    return grids;
  }

  const admitted = everyGrid().filter(isSupportedGrid);

  /** A hit on every step of every voice: the most splitting and beaming a grid can ask for. */
  function denselyHit(dimensions: GridDimensions): Pattern {
    const pattern = createPattern(dimensions);
    const struck = new Array<Hit>(totalSteps(dimensions)).fill('plain');
    const rows: Record<VoiceId, readonly Hit[]> = { ...pattern.rows };

    for (const voice of Object.keys(rows) as VoiceId[]) rows[voice] = struck;

    return { ...pattern, rows };
  }

  /** How many steps a value lasts on this grid — the same arithmetic the engine's tables use. */
  function stepsOf(value: NoteValue, dimensions: GridDimensions): number {
    const entry = VALUES_PER_WHOLE.find(([candidate]) => candidate === value);
    if (!entry) throw new Error(`no such note value: ${value}`);

    return (dimensions.stepsPerBeat * dimensions.beatValue) / entry[1];
  }

  const nameOf = ({ stepsPerBeat, beatsPerBar, beatValue, bars }: GridDimensions): string =>
    `${stepsPerBeat} steps x ${beatsPerBar}/${beatValue} x ${bars} bar(s)`;

  /**
   * What goes wrong when the engine writes a dense pattern on this grid, or null if nothing
   * does. Stronger than "does not throw": every part of every measure has to be filled
   * exactly, each event starting where the one before it ended.
   */
  function faultIn(dimensions: GridDimensions): string | null {
    let model: NotationModel;

    try {
      model = toNotation(denselyHit(dimensions));
    } catch (error) {
      return `${nameOf(dimensions)}: threw ${String(error)}`;
    }

    const barLength = stepsPerBar(dimensions);

    for (const { parts } of model.measures) {
      for (const { id, events } of parts) {
        // A dot adds half again, so a dotted value covers 1.5x its plain step count.
        const lengths = events.map(
          (event) => stepsOf(event.value, dimensions) * (2 - 2 ** -event.dots),
        );
        const total = lengths.reduce((sum, steps) => sum + steps, 0);

        if (total !== barLength) {
          return `${nameOf(dimensions)}: the ${id} fill ${total} of ${barLength} steps`;
        }
        if (events.map(({ step }) => step).join() !== runningTotals(lengths).join()) {
          return `${nameOf(dimensions)}: the ${id} events do not follow one another`;
        }
      }
    }

    return null;
  }

  it('admits every writable step-and-beat-value pair against every meter in the space', () => {
    // Fifteen pairs of stepsPerBeat x beatValue multiply to a value the vocabulary knows,
    // times sixteen meters, times one bar or two. Asserted as a number so that a change
    // quietly narrowing or widening the predicate moves it rather than passing silently.
    expect(admitted).toHaveLength(480);
  });

  it('visits the odd meters and coarse resolutions that already work', () => {
    expect(admitted).toContainEqual({ stepsPerBeat: 2, beatsPerBar: 7, beatValue: 8, bars: 1 });
    expect(admitted).toContainEqual({ stepsPerBeat: 2, beatsPerBar: 6, beatValue: 8, bars: 2 });
    expect(admitted).toContainEqual({ stepsPerBeat: 4, beatsPerBar: 5, beatValue: 4, bars: 2 });
    expect(admitted).toContainEqual({ stepsPerBeat: 2, beatsPerBar: 4, beatValue: 4, bars: 2 });
  });

  it('does not visit the resolutions the vocabulary cannot write', () => {
    const triplets = admitted.filter(({ stepsPerBeat }) => stepsPerBeat % 3 === 0);
    const thirtyseconds = admitted.filter(
      ({ stepsPerBeat, beatValue }) => stepsPerBeat * beatValue === 32,
    );

    expect(triplets).toEqual([]);
    expect(thirtyseconds).toEqual([]);
  });

  it('writes a densely-hit pattern on every one of them', () => {
    expect(admitted.map(faultIn).filter((fault) => fault !== null)).toEqual([]);
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
