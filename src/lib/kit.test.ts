import { describe, expect, it } from 'vitest';
import { DISPLAY_ORDER, KIT, type VoiceId } from './kit';

/**
 * The canonical order, written out.
 *
 * This is the pattern codec's bit layout, and the compiler cannot see that: reordering
 * the Kit would keep every type happy while silently changing what every existing share
 * link and autosave decodes to. So it is pinned here, and a reorder has to be a deliberate
 * edit to this list too.
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

describe('display order', () => {
  it('reads top to bottom the way a drummer reads a chart', () => {
    expect(DISPLAY_ORDER.map((voice) => voice.id)).toEqual([...CANONICAL_ORDER].toReversed());
  });

  it('holds the same voices as the canonical order', () => {
    expect([...DISPLAY_ORDER].toReversed()).toEqual([...KIT]);
  });
});
