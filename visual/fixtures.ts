import { createPattern, toggle, type Pattern, type VoiceId } from '$lib/pattern';

/**
 * The patterns the visual check draws.
 *
 * They shadow the notation engine's test table: the engine asserts that a pattern comes
 * out as the right run of note values, and these assert that those values reach the page
 * as the right glyphs, laid out in the right places. Each name is also the baseline's
 * filename, so it has to stay filesystem-safe and stable.
 */

export interface Fixture {
  name: string;
  hits: Partial<Record<VoiceId, number[]>>;
}

export const FIXTURES: readonly Fixture[] = [
  { name: 'empty', hits: {} },
  { name: 'four-on-the-floor', hits: { kick: [0, 4, 8, 12] } },
  { name: 'straight-eighths', hits: { closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14] } },
  { name: 'backbeat', hits: { snare: [4, 12] } },
  { name: 'syncopation', hits: { kick: [0, 3, 6] } },
  { name: 'struck-past-the-beat', hits: { kick: [6, 10] } },
  { name: 'struck-odd-span', hits: { kick: [8, 13] } },
  { name: 'ringing-whole-bar', hits: { crash: [0] } },
  { name: 'ringing-tied-across-a-beat', hits: { crash: [0], ride: [6] } },
  { name: 'ringing-odd-span', hits: { openHiHat: [8, 13] } },
  { name: 'chord', hits: { kick: [0], snare: [0], crash: [0], ride: [8] } },
  {
    name: 'rock-beat',
    hits: {
      closedHiHat: [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
      kick: [0, 8, 16, 24],
      snare: [4, 12, 20, 28],
    },
  },
];

export function patternFor(fixture: Fixture): Pattern {
  return Object.entries(fixture.hits).reduce<Pattern>(
    (pattern, [voice, steps]) =>
      steps.reduce((current, step) => toggle(current, voice as VoiceId, step), pattern),
    createPattern(),
  );
}
