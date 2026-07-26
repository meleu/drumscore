import { describe, expect, it } from 'vitest';
import {
  accepts,
  DISPLAY_ORDER,
  HIT_LABELS,
  HIT_LOUDNESS,
  KIT,
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

describe('display order', () => {
  it('reads top to bottom the way a drummer reads a chart', () => {
    expect(DISPLAY_ORDER.map((voice) => voice.id)).toEqual([...CANONICAL_ORDER].toReversed());
  });

  it('holds the same voices as the canonical order', () => {
    expect([...DISPLAY_ORDER].toReversed()).toEqual([...KIT]);
  });
});
