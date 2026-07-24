import { describe, expect, it } from 'vitest';
import { decode, encode } from './codec';
import {
  createPattern,
  DEFAULT_DIMENSIONS,
  seed,
  setBpm,
  toggle,
  totalSteps,
  VOICES,
  type Pattern,
} from './pattern';

/** Every cell switched on — the densest round-trip case. */
function fullPattern(): Pattern {
  const steps = totalSteps(DEFAULT_DIMENSIONS);
  let pattern = createPattern();
  for (const voice of VOICES) {
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

  it('returns null when the version byte is unknown', () => {
    // 'B' -> value 1 in our alphabet; a leading version of 2 would start elsewhere.
    // Corrupt the version by re-encoding bytes with a bad first byte via a known-bad string.
    const bogus = encode(createPattern());
    // Flip the first character to change the version nibble.
    const corrupted = (bogus[0] === 'A' ? 'B' : 'A') + bogus.slice(1);
    expect(decode(corrupted)).toBeNull();
  });
});
