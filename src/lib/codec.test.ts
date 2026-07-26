import { describe, expect, it } from 'vitest';
import { decode, encode } from './codec';
import { KIT } from './kit';
import {
  createPattern,
  DEFAULT_DIMENSIONS,
  seed,
  setBpm,
  toggle,
  totalSteps,
  type GridDimensions,
  type Pattern,
} from './pattern';

/** Every cell switched on — the densest round-trip case. */
function fullPattern(): Pattern {
  const steps = totalSteps(DEFAULT_DIMENSIONS);
  let pattern = createPattern();
  for (const voice of KIT) {
    for (let step = 0; step < steps; step++) {
      pattern = toggle(pattern, voice.id, step);
    }
  }
  return pattern;
}

describe('encode/decode round-trip', () => {
  const cases: Record<string, Pattern> = {
    empty: createPattern(),
    full: fullPattern(),
    seeded: seed(),
    'slow bpm': setBpm(seed(), 40),
    'fast bpm': setBpm(seed(), 240),
    'mid bpm': setBpm(seed(), 137),
  };

  for (const [name, pattern] of Object.entries(cases)) {
    it(`preserves the ${name} pattern`, () => {
      expect(decode(encode(pattern))).toEqual(pattern);
    });
  }

  it('produces a compact, URL-safe string', () => {
    const encoded = encode(seed());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    // 6-byte header + 24 cell bytes = 30 bytes -> 40 base64 chars.
    expect(encoded.length).toBeLessThan(64);
  });

  /**
   * Strings captured from the encoder before the Pattern took over the dimension check,
   * frozen here so a shared link or an autosave from before that change is proved to decode
   * to the identical pattern rather than merely believed to. Nothing about the format moved,
   * so nothing about these should ever move either.
   */
  it('decodes strings encoded before the dimension check moved', () => {
    expect(decode('AQQEBAJkgICAgAgICAiqqqqqAAAAAAAAAAAAAAAA')).toEqual(seed());
    expect(decode('AQQEBAKJgICAgAgICAiqqqqqAAAAAAAAAAAAAAAA')).toEqual(setBpm(seed(), 137));
  });

  it('distinguishes patterns that differ by a single cell', () => {
    const a = createPattern();
    const b = toggle(a, 'snare', 5);
    expect(encode(a)).not.toEqual(encode(b));
  });
});

describe('decode tolerance', () => {
  it('returns null for empty or absent input', () => {
    expect(decode('')).toBeNull();
    expect(decode(null)).toBeNull();
    expect(decode(undefined)).toBeNull();
  });

  it('returns null for a string with non-base64url characters', () => {
    expect(decode('not valid!!! @#$')).toBeNull();
  });

  it('returns null for a truncated payload', () => {
    const encoded = encode(seed());
    expect(decode(encoded.slice(0, 4))).toBeNull();
  });

  /**
   * The string a hand-made link would carry for a grid nobody can reach from the app —
   * `encode` writes the dimension bytes straight from the pattern, so this is exactly what
   * someone typing numbers into a URL produces.
   */
  function linkFor(dimensions: GridDimensions): string {
    return encode(createPattern(dimensions));
  }

  /**
   * Grids the staff cannot write, or cannot lay out, come back as `null` — the same `null`
   * a corrupt string has always produced, so the caller's fallback to autosave and then the
   * seed needs no new case. Before this, each of these reached the engine: the first two
   * threw from inside its splitting logic, and the last wedged the browser on 262,144 steps.
   */
  const refused: Record<string, GridDimensions> = {
    'three steps to a beat': { stepsPerBeat: 3, beatsPerBar: 4, beatValue: 4, bars: 2 },
    'eight steps to a beat': { stepsPerBeat: 8, beatsPerBar: 4, beatValue: 4, bars: 2 },
    'a zero in a field': { stepsPerBeat: 4, beatsPerBar: 4, beatValue: 4, bars: 0 },
    '64 in every field': { stepsPerBeat: 64, beatsPerBar: 64, beatValue: 64, bars: 64 },
  };

  for (const [name, dimensions] of Object.entries(refused)) {
    it(`returns null for a grid asking ${name}`, () => {
      expect(decode(linkFor(dimensions))).toBeNull();
    });
  }

  it('returns null when the version byte is unknown', () => {
    // 'B' -> value 1 in our alphabet; a leading version of 2 would start elsewhere.
    // Corrupt the version by re-encoding bytes with a bad first byte via a known-bad string.
    const bogus = encode(createPattern());
    // Flip the first character to change the version nibble.
    const corrupted = (bogus[0] === 'A' ? 'B' : 'A') + bogus.slice(1);
    expect(decode(corrupted)).toBeNull();
  });
});
