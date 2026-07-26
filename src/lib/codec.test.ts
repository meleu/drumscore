import { describe, expect, it } from 'vitest';
import { decode, encode } from './codec';
import { KIT, type Hit } from './kit';
import {
  createPattern,
  DEFAULT_DIMENSIONS,
  seed,
  setBpm,
  setHit,
  toggle,
  totalSteps,
  type GridDimensions,
  type Pattern,
  type VoiceId,
} from './pattern';

/** Every cell on — the densest round-trip case. */
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

/** One of each variation the snare accepts, plus an accent on a drum in the other part. */
function variedPattern(): Pattern {
  const marks: [VoiceId, number, Hit][] = [
    ['snare', 4, 'accent'],
    ['snare', 6, 'ghost'],
    ['snare', 12, 'flam'],
    ['snare', 14, 'drag'],
    ['kick', 0, 'accent'],
    ['closedHiHat', 2, 'accent'],
    ['ride', 8, 'accent'],
  ];

  return marks.reduce(
    (pattern, [voice, step, hit]) => setHit(pattern, voice, step, hit),
    createPattern(),
  );
}

describe('encode/decode round-trip', () => {
  const cases: Record<string, Pattern> = {
    empty: createPattern(),
    full: fullPattern(),
    seeded: seed(),
    varied: variedPattern(),
    'seeded with a variation': setHit(seed(), 'snare', 4, 'accent'),
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
    // 6-byte header + 6 voices x 32 steps at half a byte = 102 bytes -> 136 base64 chars.
    // Four times version 1's width, still short enough to paste anywhere.
    expect(encoded).toHaveLength(136);
  });

  it('distinguishes patterns that differ by a single cell', () => {
    const a = createPattern();
    const b = toggle(a, 'snare', 5);
    expect(encode(a)).not.toEqual(encode(b));
  });

  it('distinguishes cells that differ only in how they are struck', () => {
    const plain = setHit(createPattern(), 'snare', 5, 'plain');

    expect(encode(plain)).not.toEqual(encode(setHit(plain, 'snare', 5, 'accent')));
  });

  /**
   * Captured from this version's encoder and frozen, so a link shared today is *proved*
   * to decode identically tomorrow. May only change when `FORMAT_VERSION` does.
   */
  it('decodes the strings this format version writes', () => {
    expect(
      decode(
        'AgQEBAJkEAAAABAAAAAQAAAAEAAAAAAAEAAAABAAAAAQAAAAEAAQEBAQEBAQEBAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toEqual(seed());
    expect(
      decode(
        'AgQEBAJkEAAAABAAAAAQAAAAEAAAAAAAIAAAABAAAAAQAAAAEAAQEBAQEBAQEBAQEBAQEBAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      ),
    ).toEqual(setHit(seed(), 'snare', 4, 'accent'));
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
   * What a hand-made link carries for a grid unreachable from the app: `encode` writes the
   * dimension bytes straight from the pattern, so this is what typing numbers into a URL
   * produces.
   */
  function linkFor(dimensions: GridDimensions): string {
    return encode(createPattern(dimensions));
  }

  /**
   * Unwritable or unlayoutable grids come back as the same `null` a corrupt string gives,
   * so the caller's fallback needs no new case. Before this each reached the engine: the
   * first two threw from its splitting logic, the last wedged the browser on 262,144 steps.
   */
  const refused: Record<string, GridDimensions> = {
    'three steps to a beat': { stepsPerBeat: 3, beatsPerBar: 4, beatValue: 4, bars: 2 },
    'sixteen steps to a beat': { stepsPerBeat: 16, beatsPerBar: 4, beatValue: 4, bars: 2 },
    'a zero in a field': { stepsPerBeat: 4, beatsPerBar: 4, beatValue: 4, bars: 0 },
    '64 in every field': { stepsPerBeat: 64, beatsPerBar: 64, beatValue: 64, bars: 64 },
  };

  for (const [name, dimensions] of Object.entries(refused)) {
    it(`returns null for a grid asking ${name}`, () => {
      expect(decode(linkFor(dimensions))).toBeNull();
    });
  }

  /**
   * The thirty-second grid the note value has just admitted. No control offers it, so a
   * crafted link is the only way in, and this is the door it comes through: it used to be
   * refused beside the triplet grid above.
   */
  it('accepts a link asking eight steps to a beat', () => {
    const dimensions: GridDimensions = { stepsPerBeat: 8, beatsPerBar: 4, beatValue: 4, bars: 2 };

    expect(decode(linkFor(dimensions))?.dimensions).toEqual(dimensions);
  });

  /**
   * The nibble layout arrived with version 2, so pre-v2 strings read as a grid they cannot
   * be. That is the whole migration story: they fall back to the next source, and no
   * reader is written (ADR-0012).
   */
  it('returns null for a string the previous format version wrote', () => {
    expect(decode('AQQEBAJkgICAgAgICAiqqqqqAAAAAAAAAAAAAAAA')).toBeNull();
  });

  /**
   * The 6-byte header is exactly two base64 groups, so cells begin at char 8 — all 'A' on
   * an empty pattern. '8' puts 0xF0 in the first cell byte: nibble 15, a code no Hit has.
   */
  it('returns null for a cell code that means nothing', () => {
    const empty = encode(createPattern());

    expect(decode(empty.slice(0, 8) + '8' + empty.slice(9))).toBeNull();
  });

  /**
   * A dragged crash is nonsense, so a link carrying one is malformed input rather than a
   * pattern to repair (ADR-0013). Row written directly, since `setHit` refuses it.
   */
  it('returns null for a variation the drum does not accept', () => {
    const base = createPattern();
    const crash = [...base.rows.crash];
    crash[0] = 'drag';

    expect(decode(encode({ ...base, rows: { ...base.rows, crash } }))).toBeNull();
  });

  it('returns null when the version byte is unknown', () => {
    // The first char carries the version nibble; flipping it makes the version unknown.
    const bogus = encode(createPattern());
    const corrupted = (bogus[0] === 'A' ? 'B' : 'A') + bogus.slice(1);
    expect(decode(corrupted)).toBeNull();
  });
});
