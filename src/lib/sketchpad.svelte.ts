/**
 * The sketchpad: the pattern the user currently has open, whether it is playing, and
 * where the playhead is. Every action the app offers — draw a hit, set the tempo, clear,
 * play, stop, share — is a method here, so no state transition lives in a component.
 *
 * It reaches the outside world through two adapters it is handed rather than builds:
 * {@link Playback} makes sound, {@link PatternStore} remembers and shares. In the browser
 * those are the audio engine and the persistence module; in a test they are fakes, which
 * is what makes every transition below reachable without a DOM.
 *
 * A runes module rather than a plain object: reading `pattern`, `playing` or `currentStep`
 * from a component subscribes to it, so the app needs no effects to stay in step. There
 * are deliberately no `$effect`s inside — each transition pushes to the adapters itself,
 * which keeps the ordering explicit and keeps the tests free of an effect root.
 */

import {
  clear as clearHits,
  setBpm as withBpm,
  toggle as toggleHit,
  type Pattern,
  type VoiceId,
} from './pattern';

/** Whatever can sound a pattern. The audio engine satisfies this. */
export interface Playback {
  /**
   * Register (or clear, with `null`) the listener for the playing column. It is called
   * with `null` when playback stops.
   */
  onStep(listener: ((step: number | null) => void) | null): void;
  /** Point playback at the latest pattern; safe to call while it is running. */
  setPattern(pattern: Pattern): void;
  setBpm(bpm: number): void;
  /** May reject: starting audio needs a user gesture the browser can refuse. */
  play(): Promise<void>;
  stop(): void;
  dispose(): void;
}

/** Where a pattern comes from on open, and where it goes as the user works. */
export interface PatternStore {
  /** The pattern to open with, load precedence already applied. */
  load(): Pattern;
  save(pattern: Pattern): void;
  shareUrl(pattern: Pattern): string;
}

export interface SketchpadDeps {
  store: PatternStore;
  /**
   * Built with the pattern the sketchpad opened on, because playback cannot exist
   * without one and the store is what decides which one that is.
   */
  playback: (pattern: Pattern) => Playback;
}

export interface Sketchpad {
  readonly pattern: Pattern;
  readonly playing: boolean;
  /** The column currently sounding; null whenever playback is stopped. */
  readonly currentStep: number | null;
  toggle(voice: VoiceId, step: number): void;
  setBpm(bpm: number): void;
  clear(): void;
  /** Rejects if the audio context refuses to start, leaving `playing` false. */
  play(): Promise<void>;
  stop(): void;
  /** The absolute URL that reopens the pattern as it stands. */
  shareUrl(): string;
  dispose(): void;
}

export function createSketchpad({ store, playback: createPlayback }: SketchpadDeps): Sketchpad {
  const initial = store.load();

  // Raw because a Pattern is only ever replaced wholesale — every operation on it is
  // pure — so there is nothing for a deep proxy to notice.
  let pattern = $state.raw(initial);
  let playing = $state(false);
  let currentStep = $state<number | null>(null);

  const playback = createPlayback(initial);
  playback.onStep((step) => (currentStep = step));
  // What we opened on becomes the autosave straight away, so arriving on a share link
  // and closing the tab leaves that pattern waiting on the next visit.
  store.save(initial);

  /**
   * The one path a pattern changes by. The operations in `./pattern` hand back the very
   * same pattern when they decline a change — an out-of-range step, a tempo that would
   * not move — and that is where those no-ops stop.
   */
  function commit(next: Pattern): void {
    if (next === pattern) return;

    pattern = next;
    playback.setPattern(next);
    playback.setBpm(next.bpm);
    store.save(next);
  }

  return {
    get pattern() {
      return pattern;
    },
    get playing() {
      return playing;
    },
    get currentStep() {
      return currentStep;
    },

    toggle: (voice, step) => commit(toggleHit(pattern, voice, step)),
    setBpm: (bpm) => commit(withBpm(pattern, bpm)),
    clear: () => commit(clearHits(pattern)),

    async play() {
      await playback.play();
      playing = true;
    },

    stop() {
      playback.stop();
      playing = false;
    },

    shareUrl: () => store.shareUrl(pattern),

    dispose() {
      // Drop the listener first: a highlight already queued must not write into a
      // sketchpad whose playback is gone.
      playback.onStep(null);
      playback.dispose();
    },
  };
}
