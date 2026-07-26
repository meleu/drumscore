/**
 * The sketchpad: the open pattern, whether it plays, and where the playhead is. Every
 * action the app offers is a method here, so no state transition lives in a component.
 *
 * It reaches the world through two adapters it is handed: {@link Playback} makes sound,
 * {@link PatternStore} remembers and shares. Fakes in tests, which is what makes every
 * transition reachable without a DOM.
 *
 * A runes module, so reading `pattern`, `playing` or `currentStep` subscribes. No
 * `$effect`s inside — each transition pushes to the adapters itself, keeping the ordering
 * explicit and the tests free of an effect root.
 */

import {
  clear as clearHits,
  setBpm as withBpm,
  setHit as withHit,
  toggle as toggleHit,
  type Hit,
  type Pattern,
  type VoiceId,
} from './pattern';

/** Whatever can sound a pattern. The audio engine satisfies this. */
export interface Playback {
  /** Register, or clear with `null`. Called with `null` when playback stops. */
  onStep(listener: ((step: number | null) => void) | null): void;
  /** Safe to call while running. */
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
  /** Built with the opened pattern: playback cannot exist without one. */
  playback: (pattern: Pattern) => Playback;
}

export interface Sketchpad {
  readonly pattern: Pattern;
  readonly playing: boolean;
  /** The column sounding; null whenever stopped. */
  readonly currentStep: number | null;
  /** Left-click: strike an empty cell plainly, or clear one however it is struck. */
  toggle(voice: VoiceId, step: number): void;
  /** Strike a named way whatever the cell held. An unaccepted way changes nothing, so no
   * caller has to check first. */
  setHit(voice: VoiceId, step: number, hit: Hit): void;
  setBpm(bpm: number): void;
  clear(): void;
  /** Rejects if the audio context refuses to start, leaving `playing` false. */
  play(): Promise<void>;
  stop(): void;
  /** Absolute URL reopening the pattern as it stands. */
  shareUrl(): string;
  dispose(): void;
}

export function createSketchpad({ store, playback: createPlayback }: SketchpadDeps): Sketchpad {
  const initial = store.load();

  // Raw: a Pattern is only ever replaced wholesale, so a deep proxy has nothing to notice.
  let pattern = $state.raw(initial);
  let playing = $state(false);
  let currentStep = $state<number | null>(null);

  const playback = createPlayback(initial);
  playback.onStep((step) => (currentStep = step));
  // Autosave what we opened on, so arriving via share link and closing the tab leaves
  // that pattern waiting next visit.
  store.save(initial);

  /**
   * The one path a pattern changes by. `./pattern` hands back the same pattern when it
   * declines a change, and that is where those no-ops stop.
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
    setHit: (voice, step, hit) => commit(withHit(pattern, voice, step, hit)),
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
      // Listener first: a queued highlight must not write into a dead sketchpad.
      playback.onStep(null);
      playback.dispose();
    },
  };
}
