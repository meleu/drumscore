import { describe, expect, it } from 'vitest';
import {
  createPattern,
  DEFAULT_DIMENSIONS,
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

/** Switch on the listed steps for each voice, on the default grid unless told otherwise. */
function patternWith(
  hits: Partial<Record<VoiceId, number[]>>,
  dimensions?: GridDimensions,
): Pattern {
  return Object.entries(hits).reduce<Pattern>(
    (pattern, [voice, steps]) =>
      steps.reduce((current, step) => toggle(current, voice as VoiceId, step), pattern),
    createPattern(dimensions),
  );
}

/** Strike named ways over a pattern already carrying plain hits. */
function struck(hits: Partial<Record<VoiceId, number[]>>, marks: [VoiceId, number, Hit][]) {
  return marks.reduce(
    (pattern, [voice, step, hit]) => setHit(pattern, voice, step, hit),
    patternWith(hits),
  );
}

/** How long each value lasts on the default 16th-note grid; under a step is unwritable. */
const STEPS: Record<NoteValue, number> = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  sixteenth: 1,
  thirtysecond: 0.5,
};

const CODES: Record<NoteValue, string> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  sixteenth: '16',
  thirtysecond: '32',
};

/**
 * A measure as a rhythm string: `'rq q 8'` is quarter rest, quarter note, eighth. `r`
 * prefix = rest, trailing `.` = dot, so `8.` is a dotted eighth. Keeps the expectations
 * below short enough to check against the bar in your head.
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

/** Every part's rhythm and beaming: what a variation must leave untouched. */
function rhythmsOf(model: NotationModel): unknown[] {
  return model.measures.map(({ parts }) =>
    parts.map(({ events, beams }) => [rhythm(events), beams.map((group) => group.steps)]),
  );
}

const KICK: Notehead = { style: 'normal', position: { step: 'f', octave: 4 }, ghosted: false };
const SNARE: Notehead = { style: 'normal', position: { step: 'c', octave: 5 }, ghosted: false };
const CLOSED_HI_HAT: Notehead = {
  style: 'cross',
  position: { step: 'g', octave: 5 },
  ghosted: false,
};
const OPEN_HI_HAT: Notehead = {
  style: 'cross',
  position: { step: 'g', octave: 5 },
  ghosted: false,
};
const CRASH: Notehead = { style: 'cross', position: { step: 'a', octave: 5 }, ghosted: false };
const RIDE: Notehead = { style: 'cross', position: { step: 'f', octave: 5 }, ghosted: false };

/** The same drum, struck quietly: what the staff wraps in parentheses. */
function ghost(head: Notehead): Notehead {
  return { ...head, ghosted: true };
}

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
        // A dot adds half again: 1.5x the plain step count.
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
 * Which notes carry an accent mark. The interesting cases are chords: the snare shares the
 * hands part with every cymbal, the mark has one place to go, so the engine ORs it across
 * the drums under one stem and the staff says nothing about which was meant (ADR-0014).
 */
describe('accents', () => {
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

    // One note, both heads, one mark: the hi-hat draws accented because it shares the stem.
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

    expect(rhythmsOf(accented)).toEqual(rhythmsOf(plain));
  });
});

/**
 * Which noteheads are parenthesised. Ghosting is the opposite case to the accent: the
 * parentheses go round one head, so drums sharing a stem each keep their own answer.
 */
describe('ghost notes', () => {
  it('parenthesises the ghosted drum and leaves the rest of the chord alone', () => {
    const pattern = struck({ snare: [0], closedHiHat: [0] }, [['snare', 0, 'ghost']]);

    expect(firstChord(pattern, 'hands')).toEqual([ghost(SNARE), CLOSED_HI_HAT]);
  });

  /**
   * Written past the setter, which would refuse: the snare is the only drum whose row
   * accepts a ghost today. What the engine answers must be a property of the chord rather
   * than of that fact, so the day a second drum takes one, this already says what happens.
   */
  it('parenthesises each ghosted drum of a chord separately', () => {
    const plain = struck({ snare: [0], ride: [0] }, [['snare', 0, 'ghost']]);
    const pattern: Pattern = {
      ...plain,
      rows: {
        ...plain.rows,
        ride: plain.rows.ride.map((hit, step) => (step === 0 ? 'ghost' : hit)),
      },
    };

    expect(firstChord(pattern, 'hands')).toEqual([ghost(SNARE), ghost(RIDE)]);
  });

  /** A ghost says how a stroke is played, never how long it is. */
  it('leaves the rhythm, the rests, the dots and the beams exactly as they were', () => {
    const hits = { closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 7, 12], kick: [0, 8] };
    const plain = toNotation(patternWith(hits));
    const ghosted = toNotation(
      struck(hits, [
        ['snare', 7, 'ghost'],
        ['snare', 12, 'ghost'],
      ]),
    );

    expect(rhythmsOf(ghosted)).toEqual(rhythmsOf(plain));
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
   * The table says which head; this says which part. Together they pin what the engine now
   * derives from the Kit, so a drum drifting into the wrong part — or both — fails here.
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

    // 0,1 sixteenths; 2 an eighth reaching the beat line; then a rest to 6.
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
 * ADR-0011 said a refusal lifts when the vocabulary grows the value it was missing, with no
 * edit to the predicate. This is the first time that has happened, so it is asserted from
 * both ends: the value is inert where the app already writes, and it is the whole of what
 * makes a thirty-second grid writable.
 */
describe('the thirty-second note value', () => {
  /** 4/4 with eight steps to the beat: the grid the value has just admitted. */
  const THIRTYSECONDS: GridDimensions = {
    stepsPerBeat: 8,
    beatsPerBar: 4,
    beatValue: 4,
    bars: 1,
  };

  /** Every note value and rest value the staff writes for this pattern, in the order met. */
  function valuesIn(pattern: Pattern): NoteValue[] {
    return toNotation(pattern).measures.flatMap(({ parts }) =>
      parts.flatMap(({ events }) => events.map(({ value }) => value)),
    );
  }

  /** A hit on every step of every voice: the finest writing the grid can provoke. */
  function everyStep(dimensions: GridDimensions): Partial<Record<VoiceId, number[]>> {
    const steps = Array.from({ length: totalSteps(dimensions) }, (_, step) => step);

    return Object.fromEntries(
      (Object.keys(createPattern().rows) as VoiceId[]).map((voice) => [voice, steps]),
    );
  }

  it('writes a run of eight to the beat as thirty-seconds', () => {
    const pattern = patternWith({ closedHiHat: [0, 1, 2, 3, 4, 5, 6, 7] }, THIRTYSECONDS);

    expect(rhythmOf(pattern, 'hands')).toEqual(['32 32 32 32 32 32 32 32 rq rh']);
  });

  it('beams them by the beat, the way it beams eighths and sixteenths', () => {
    const pattern = patternWith({ closedHiHat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] }, THIRTYSECONDS);

    // The beat falls between step 7 and step 8, so the run splits there rather than
    // running on into one ten-note beam.
    expect(partOf(measureOf(pattern), 'hands').beams.map(({ steps }) => steps)).toEqual([
      [0, 1, 2, 3, 4, 5, 6, 7],
      [8, 9],
    ]);
  });

  it('leaves the sixteenth resolution the app ships writing sixteenths', () => {
    // The rhythm cases above are the fuller pin: every one of them still writes what it
    // wrote before the value existed. This one says why — the value is half a step long
    // here, so the vocabulary never offers it.
    expect(valuesIn(patternWith(everyStep(DEFAULT_DIMENSIONS)))).toEqual(
      new Array(totalSteps(DEFAULT_DIMENSIONS) * 2).fill('sixteenth'),
    );
  });
});

/**
 * `isSupportedGrid`'s claim, checked against the engine that must honour it: every grid it
 * admits survives the engine's worst case — a hit on every step of every voice, the
 * densest splitting and beaming there is.
 *
 * Only admitted grids are visited: the direction that reaches a user is the predicate
 * being too permissive, and a refused grid cannot arrive.
 *
 * The drift guard. When the vocabulary grows a value, this fails if "some value spans
 * exactly one step" turns out not to be enough for the grids it just let in.
 */
describe('the grids the predicate admits', () => {
  /**
   * Each dimension over 1-16, one bar or two — a second measure proves the engine repeats,
   * a third proves nothing further. Sixteen is past every meter and resolution today's
   * vocabulary can write, so this space holds the whole answer, not a sample.
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

  /** A hit on every step of every voice. */
  function denselyHit(dimensions: GridDimensions): Pattern {
    const pattern = createPattern(dimensions);
    const struck = new Array<Hit>(totalSteps(dimensions)).fill('plain');
    const rows: Record<VoiceId, readonly Hit[]> = { ...pattern.rows };

    for (const voice of Object.keys(rows) as VoiceId[]) rows[voice] = struck;

    return { ...pattern, rows };
  }

  /** The same arithmetic the engine's tables use. */
  function stepsOf(value: NoteValue, dimensions: GridDimensions): number {
    const entry = VALUES_PER_WHOLE.find(([candidate]) => candidate === value);
    if (!entry) throw new Error(`no such note value: ${value}`);

    return (dimensions.stepsPerBeat * dimensions.beatValue) / entry[1];
  }

  const nameOf = ({ stepsPerBeat, beatsPerBar, beatValue, bars }: GridDimensions): string =>
    `${stepsPerBeat} steps x ${beatsPerBar}/${beatValue} x ${bars} bar(s)`;

  /**
   * What goes wrong writing a dense pattern on this grid, or null. Stronger than "does not
   * throw": every part of every measure filled exactly, each event starting where the last
   * ended.
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
        // A dot adds half again: 1.5x the plain step count.
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
    // 19 stepsPerBeat x beatValue pairs multiply to a known value, x16 meters, x2 bar
    // counts. A number, so a change narrowing or widening the predicate moves it: the
    // thirty-second added the four pairs multiplying to 32, and 128 grids with them.
    expect(admitted).toHaveLength(608);
  });

  it('visits the odd meters and coarse resolutions that already work', () => {
    expect(admitted).toContainEqual({ stepsPerBeat: 2, beatsPerBar: 7, beatValue: 8, bars: 1 });
    expect(admitted).toContainEqual({ stepsPerBeat: 2, beatsPerBar: 6, beatValue: 8, bars: 2 });
    expect(admitted).toContainEqual({ stepsPerBeat: 4, beatsPerBar: 5, beatValue: 4, bars: 2 });
    expect(admitted).toContainEqual({ stepsPerBeat: 2, beatsPerBar: 4, beatValue: 4, bars: 2 });
  });

  it('visits the thirty-second resolutions the vocabulary has just learnt to write', () => {
    expect(admitted).toContainEqual({ stepsPerBeat: 8, beatsPerBar: 4, beatValue: 4, bars: 1 });
    expect(admitted).toContainEqual({ stepsPerBeat: 4, beatsPerBar: 4, beatValue: 8, bars: 2 });
  });

  it('does not visit the resolutions the vocabulary cannot write', () => {
    const triplets = admitted.filter(({ stepsPerBeat }) => stepsPerBeat % 3 === 0);
    const sixtyfourths = admitted.filter(
      ({ stepsPerBeat, beatValue }) => stepsPerBeat * beatValue === 64,
    );

    expect(triplets).toEqual([]);
    expect(sixtyfourths).toEqual([]);
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
