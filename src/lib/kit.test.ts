import { describe, expect, it } from 'vitest';
import {
  accepts,
  DISPLAY_ORDER,
  HIT_LABELS,
  HIT_LOUDNESS,
  KIT,
  strikesFor,
  type Hit,
  type Variation,
  type VoiceId,
} from './kit';

/**
 * The codec's bit layout, which the compiler cannot see: a reorder keeps every type happy
 * while silently changing what every existing share link and autosave decodes to. Pinned
 * here, so a reorder must be a deliberate edit to this list too.
 */
const CANONICAL_ORDER: VoiceId[] = ['kick', 'snare', 'closedHiHat', 'openHiHat', 'crash', 'ride'];

describe('canonical order', () => {
  it('matches the pinned order the codec encodes in', () => {
    expect(KIT.map((voice) => voice.id)).toEqual(CANONICAL_ORDER);
  });
});

describe('the kit rows', () => {
  it('names every voice exactly once', () => {
    expect(new Set(KIT.map((voice) => voice.id)).size).toBe(KIT.length);
  });

  it('gives every voice a label', () => {
    for (const voice of KIT) {
      expect(voice.label).not.toBe('');
    }
  });

  it('puts every voice in exactly one part', () => {
    for (const voice of KIT) {
      expect(['hands', 'feet']).toContain(voice.part);
    }
    expect(KIT.filter((voice) => voice.part === 'hands').length).toBeGreaterThan(0);
    expect(KIT.filter((voice) => voice.part === 'feet').length).toBeGreaterThan(0);
  });

  it('gives every voice a notehead on the staff', () => {
    for (const { notehead } of KIT) {
      expect(['normal', 'cross']).toContain(notehead.style);
      expect(notehead.position.step).toMatch(/^[a-g]$/);
      expect(Number.isInteger(notehead.position.octave)).toBe(true);
    }
  });
});

/**
 * ADR-0013's table. The Kit rows are the codebase's only statement of this, so it is
 * checked against the decision rather than against itself. Dropping a variation makes
 * every share link carrying it decode to `null` — a deliberate act, so a deliberate edit
 * here too.
 */
const ACCEPTED: Record<VoiceId, Variation[]> = {
  kick: ['accent'],
  snare: ['accent', 'ghost', 'flam', 'drag'],
  closedHiHat: ['accent'],
  openHiHat: ['accent'],
  crash: [],
  ride: ['accent'],
};

describe('the variations each voice accepts', () => {
  it('matches the table the decision records', () => {
    expect(Object.fromEntries(KIT.map(({ id, variations }) => [id, variations]))).toEqual(ACCEPTED);
  });

  it.each(KIT)('lets $label be silent and struck plainly', ({ id }) => {
    expect(accepts(id, 'off')).toBe(true);
    expect(accepts(id, 'plain')).toBe(true);
  });

  it.each(KIT)('answers for $label exactly what its row says', ({ id }) => {
    const variations: Variation[] = ['accent', 'ghost', 'flam', 'drag'];

    for (const variation of variations) {
      expect(accepts(id, variation)).toBe(ACCEPTED[id].includes(variation));
    }
  });

  /** The menu is a projection of the row, so this is also what the menus offer. */
  it('lets the snare alone be ghosted', () => {
    const ghosting = KIT.filter(({ id }) => accepts(id, 'ghost'));

    expect(ghosting.map(({ id }) => id)).toEqual(['snare']);
  });

  it.each<Variation>(['flam', 'drag'])(
    'offers a %s on the snare and on nothing else',
    (gesture) => {
      const gesturing = KIT.filter(({ id }) => accepts(id, gesture));

      expect(gesturing.map(({ id }) => id)).toEqual(['snare']);
    },
  );

  it('gives the snare every variation and the crash none', () => {
    expect(accepts('snare', 'drag')).toBe(true);
    expect(accepts('crash', 'accent')).toBe(false);
    expect(accepts('ride', 'ghost')).toBe(false);
  });

  it('names every way a drum can be struck', () => {
    const hits: Hit[] = ['off', 'plain', 'accent', 'ghost', 'flam', 'drag'];

    for (const hit of hits) expect(HIT_LABELS[hit]).not.toBe('');
  });
});

describe('how hard each way of striking hits', () => {
  const struck: Hit[] = ['plain', 'accent', 'ghost', 'flam', 'drag'];

  it('strikes an accent harder than a plain hit, and a plain hit harder than a ghost', () => {
    expect(HIT_LOUDNESS.ghost).toBeLessThan(HIT_LOUDNESS.plain);
    expect(HIT_LOUDNESS.plain).toBeLessThan(HIT_LOUDNESS.accent);
  });

  it('strikes a flam and a drag as hard as a plain hit — the grace strikes carry the gesture', () => {
    expect(HIT_LOUDNESS.flam).toBe(HIT_LOUDNESS.plain);
    expect(HIT_LOUDNESS.drag).toBe(HIT_LOUDNESS.plain);
  });

  it('names three loudnesses and no more', () => {
    expect(new Set(struck.map((hit) => HIT_LOUDNESS[hit])).size).toBe(3);
  });

  it('strikes every way audibly, and none beyond what a trigger takes', () => {
    for (const hit of struck) {
      expect(HIT_LOUDNESS[hit]).toBeGreaterThan(0);
      expect(HIT_LOUDNESS[hit]).toBeLessThanOrEqual(1);
    }
  });

  it('strikes a silent cell not at all', () => {
    expect(HIT_LOUDNESS.off).toBe(0);
  });
});

/**
 * The strikes one cell sounds as. A flam and a drag are gestures rather than single hits,
 * and this is where that is settled — in seconds ahead of the stroke, with no synth and no
 * transport anywhere near it.
 */
describe('the strikes a cell sounds as', () => {
  /** Well into a run, so there is room to schedule ahead of the stroke. */
  const TIME = 10;
  const START = 0;

  /** How far ahead of the stroke each strike lands, in the order they sound. */
  function leadsOf(hit: Hit, time = TIME, earliest = START): number[] {
    return strikesFor(hit, time, earliest).map((strike) => time - strike.time);
  }

  function loudnessesOf(hit: Hit, time = TIME, earliest = START): number[] {
    return strikesFor(hit, time, earliest).map((strike) => strike.loudness);
  }

  /** The gap the gesture is built out of, taken from the shortest gesture there is. */
  const [LEAD = 0] = leadsOf('flam');

  it('sounds nothing for an empty cell', () => {
    expect(strikesFor('off', TIME, START)).toEqual([]);
  });

  it.each<Hit>(['plain', 'accent', 'ghost'])('sounds a %s cell as the stroke alone', (hit) => {
    expect(strikesFor(hit, TIME, START)).toEqual([{ time: TIME, loudness: HIT_LOUDNESS[hit] }]);
  });

  it('sounds a flam as one grace strike, then the stroke on the beat', () => {
    expect(leadsOf('flam')).toEqual([LEAD, 0]);
    expect(LEAD).toBeGreaterThan(0);
  });

  it('sounds a drag as two grace strikes, evenly spaced ahead of the stroke', () => {
    const [first = 0, second = 0, ...rest] = leadsOf('drag');

    expect(rest).toEqual([0]);
    expect(second).toBeCloseTo(LEAD);
    expect(first).toBeCloseTo(LEAD * 2);
  });

  it('plays the graces quietly and the stroke at its own weight', () => {
    expect(loudnessesOf('flam')).toEqual([HIT_LOUDNESS.ghost, HIT_LOUDNESS.flam]);
    expect(loudnessesOf('drag')).toEqual([
      HIT_LOUDNESS.ghost,
      HIT_LOUDNESS.ghost,
      HIT_LOUDNESS.drag,
    ]);
  });

  /**
   * The gesture is a fixed span of milliseconds rather than a fraction of the step, so a
   * flam is a flam at 40 BPM and at 240 BPM. All a tempo changes is when the stroke lands,
   * which is the argument — so two wildly separated strokes must lead identically.
   */
  it('leads the stroke by the same gap wherever the stroke falls', () => {
    const millisecondsBefore = (time: number): number[] =>
      leadsOf('drag', time).map((lead) => Math.round(lead * 1000));

    expect(millisecondsBefore(1)).toEqual(millisecondsBefore(1000));
  });

  /**
   * A flam on the loop's first step wants its grace before the loop began. Nothing can be
   * played in the past, so the graces pile up on the floor instead — late, but audible,
   * and the stroke still lands on the beat.
   */
  it('schedules nothing before the earliest time it is given', () => {
    expect(strikesFor('drag', START, START).map(({ time }) => time)).toEqual([START, START, START]);
  });
});

describe('display order', () => {
  it('reads top to bottom the way a drummer reads a chart', () => {
    expect(DISPLAY_ORDER.map((voice) => voice.id)).toEqual([...CANONICAL_ORDER].toReversed());
  });

  it('holds the same voices as the canonical order', () => {
    expect([...DISPLAY_ORDER].toReversed()).toEqual([...KIT]);
  });
});
