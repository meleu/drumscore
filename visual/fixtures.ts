import {
  createPattern,
  setHit,
  toggle,
  type GridDimensions,
  type Hit,
  type Pattern,
  type VoiceId,
} from '$lib/pattern';

/**
 * The patterns the visual check draws.
 *
 * They shadow the notation engine's test table: the engine asserts that a pattern comes
 * out as the right run of note values, and these assert that those values reach the page
 * as the right glyphs, laid out in the right places. Each name is also the baseline's
 * filename, so it has to stay filesystem-safe and stable.
 *
 * Most of them draw the default grid, because that is what the app ships. One does not: the
 * grid dimensions are data, and until something drew a different set of them the claim that
 * other grids work was untested in a browser.
 */

export interface Fixture {
  name: string;
  /** The plain hits. A step listed here and in `variations` is drawn with its variation. */
  hits: Partial<Record<VoiceId, number[]>>;
  /**
   * Struck some other way — voice, step, variation. Needs no entry in `hits`: a variation
   * is placed in one go, whether or not the cell was already struck.
   */
  variations?: [VoiceId, number, Hit][];
  /**
   * The grid to draw this one on; the default grid when it says nothing. A whole record
   * rather than a partial merged over the default, because one fixture names it and a merge
   * helper would be more machinery than the saving is worth.
   */
  dimensions?: GridDimensions;
}

export const FIXTURES: readonly Fixture[] = [
  { name: 'empty', hits: {} },
  { name: 'four-on-the-floor', hits: { kick: [0, 4, 8, 12] } },
  { name: 'straight-eighths', hits: { closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { name: 'backbeat', hits: { snare: [4, 12] } },
  { name: 'syncopation', hits: { kick: [0, 3, 6] } },
  { name: 'dotted-rest', hits: { kick: [3] } },
  { name: 'struck-past-the-beat', hits: { kick: [6, 10] } },
  { name: 'struck-odd-span', hits: { kick: [8, 13] } },
  { name: 'crash-struck', hits: { crash: [0] } },
  { name: 'crash-across-a-beat', hits: { crash: [0], ride: [6] } },
  { name: 'open-hi-hat-odd-span', hits: { openHiHat: [8, 13] } },
  { name: 'chord', hits: { kick: [0], snare: [0], crash: [0], ride: [8] } },
  {
    name: 'rock-beat',
    hits: {
      closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
      kick: [0, 8, 16, 24],
      snare: [4, 12, 20, 28],
    },
  },
  // An accent above the stem, and a plain stroke of the same value beside it to read it
  // against. Two bars, so the second says the mark does not leak into the measures after it.
  { name: 'accented-hand', hits: { snare: [12] }, variations: [['snare', 4, 'accent']] },
  // The same, in the part written stems down: the mark belongs under the staff there, clear
  // of the hands sharing it.
  { name: 'accented-foot', hits: { kick: [8] }, variations: [['kick', 0, 'accent']] },
  // What ADR-0014 is about: the accented snare and the plain hi-hat share a stem, so the
  // chord draws one accent. This baseline is what pins that, and it is the common case
  // rather than an edge one.
  {
    name: 'accented-chord',
    hits: { closedHiHat: [0, 4, 8, 12] },
    variations: [['snare', 0, 'accent']],
  },
  // The ghost's counterpart to `accented-chord`, and the opposite answer: the parentheses go
  // round the snare alone, while the hi-hat sharing its stem stays bare. The plain snare on
  // the backbeat is there to read the ghosted one against.
  {
    name: 'ghosted-chord',
    hits: { closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4] },
    variations: [['snare', 10, 'ghost']],
  },
  {
    // One bar of 7/8 at sixteenth resolution: fourteen steps, the beat an eighth rather than
    // the quarter every other fixture assumes. An odd number of beats is what makes the
    // beaming and the closing rest say something, and the beat value is the half of the meter
    // no baseline had ever exercised.
    //
    // Hits chosen to show the meter rather than to be dense: the hi-hat marks every beat and
    // closes with two sixteenths, and the kick and snare fall on the 3+2+2 groups a drummer
    // hears 7/8 in.
    name: 'seven-eight',
    dimensions: { stepsPerBeat: 2, beatsPerBar: 7, beatValue: 8, bars: 1 },
    hits: {
      closedHiHat: [0, 2, 4, 6, 8, 10, 12, 13],
      snare: [6],
      kick: [0, 10],
    },
  },
];

export function patternFor(fixture: Fixture): Pattern {
  const struck = Object.entries(fixture.hits).reduce<Pattern>(
    (pattern, [voice, steps]) =>
      steps.reduce((current, step) => toggle(current, voice as VoiceId, step), pattern),
    createPattern(fixture.dimensions),
  );

  return (fixture.variations ?? []).reduce<Pattern>(
    (pattern, [voice, step, hit]) => setHit(pattern, voice, step, hit),
    struck,
  );
}
