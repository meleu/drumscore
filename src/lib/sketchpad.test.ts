import { describe, expect, it } from 'vitest';
import { createPattern, isHit, seed, VOICE_IDS, type Pattern } from './pattern';
import { createSketchpad, type PatternStore, type Playback } from './sketchpad.svelte';

/**
 * The two adapters the sketchpad reaches the world through, in their test shape. They
 * record rather than act, so every transition can be checked from the outside — which
 * is the whole point of the seam.
 */

class FakePlayback implements Playback {
  readonly patterns: Pattern[] = [];
  readonly bpms: number[] = [];
  stops = 0;
  disposed = false;
  /** Makes the next `play()` reject, the way a browser refusing audio does. */
  refuse = false;

  private listener: ((step: number | null) => void) | null = null;

  onStep(listener: ((step: number | null) => void) | null): void {
    this.listener = listener;
  }

  setPattern(pattern: Pattern): void {
    this.patterns.push(pattern);
  }

  setBpm(bpm: number): void {
    this.bpms.push(bpm);
  }

  async play(): Promise<void> {
    if (this.refuse) throw new Error('the audio context refused to start');
  }

  stop(): void {
    this.stops++;
    // The real engine clears the playhead as it stops.
    this.listener?.(null);
  }

  dispose(): void {
    this.disposed = true;
  }

  /** Advance the playhead the way the running sequence does. */
  reachStep(step: number): void {
    this.listener?.(step);
  }

  get listening(): boolean {
    return this.listener !== null;
  }
}

class FakeStore implements PatternStore {
  readonly saved: Pattern[] = [];

  constructor(private readonly initial: Pattern) {}

  load(): Pattern {
    return this.initial;
  }

  save(pattern: Pattern): void {
    this.saved.push(pattern);
  }

  shareUrl(pattern: Pattern): string {
    return `https://drumscore.test/?bpm=${pattern.bpm}`;
  }
}

function setup(initial: Pattern = seed()) {
  const store = new FakeStore(initial);
  const playback = new FakePlayback();
  const opened: Pattern[] = [];
  const sketchpad = createSketchpad({
    store,
    playback: (pattern) => {
      opened.push(pattern);
      return playback;
    },
  });

  return { sketchpad, store, playback, opened };
}

/** The patterns saved after the one the sketchpad opened on. */
function savedEdits(store: FakeStore): Pattern[] {
  return store.saved.slice(1);
}

describe('opening', () => {
  it('opens on the pattern the store loads', () => {
    const initial = seed();
    const { sketchpad } = setup(initial);

    expect(sketchpad.pattern).toBe(initial);
    expect(sketchpad.playing).toBe(false);
    expect(sketchpad.currentStep).toBeNull();
  });

  it('builds playback with the pattern it opened on', () => {
    const initial = seed();
    const { opened } = setup(initial);

    expect(opened).toEqual([initial]);
  });

  it('autosaves what it opened on, so a shared link survives the next visit', () => {
    const initial = seed();
    const { store } = setup(initial);

    expect(store.saved).toEqual([initial]);
  });
});

describe('drawing', () => {
  it('flips a hit on and off again', () => {
    const { sketchpad } = setup(createPattern());

    sketchpad.toggle('snare', 4);
    expect(isHit(sketchpad.pattern, 'snare', 4)).toBe(true);

    sketchpad.toggle('snare', 4);
    expect(isHit(sketchpad.pattern, 'snare', 4)).toBe(false);
  });

  it('pushes every edit to playback and the store', () => {
    const { sketchpad, store, playback } = setup(createPattern());

    sketchpad.toggle('kick', 0);

    expect(playback.patterns).toEqual([sketchpad.pattern]);
    expect(savedEdits(store)).toEqual([sketchpad.pattern]);
  });

  it('lets a step outside the grid change nothing', () => {
    const { sketchpad, store, playback } = setup(createPattern());
    const before = sketchpad.pattern;

    sketchpad.toggle('kick', 999);

    expect(sketchpad.pattern).toBe(before);
    expect(playback.patterns).toEqual([]);
    expect(savedEdits(store)).toEqual([]);
  });
});

describe('tempo', () => {
  it('clamps the tempo and hands it to playback', () => {
    const { sketchpad, playback } = setup(createPattern());

    sketchpad.setBpm(1000);

    expect(sketchpad.pattern.bpm).toBe(240);
    expect(playback.bpms).toEqual([240]);
  });

  it('lets a tempo that would not move change nothing', () => {
    const { sketchpad, store, playback } = setup(createPattern());
    const before = sketchpad.pattern;

    sketchpad.setBpm(before.bpm);
    sketchpad.setBpm(Number.NaN);

    expect(sketchpad.pattern).toBe(before);
    expect(playback.bpms).toEqual([]);
    expect(savedEdits(store)).toEqual([]);
  });
});

describe('clearing', () => {
  it('empties every voice while keeping the tempo and the grid', () => {
    const { sketchpad } = setup(seed());
    const before = sketchpad.pattern;

    sketchpad.clear();

    const { pattern } = sketchpad;
    expect(VOICE_IDS.every((voice) => pattern.rows[voice].every((on) => !on))).toBe(true);
    expect(pattern.bpm).toBe(before.bpm);
    expect(pattern.dimensions).toEqual(before.dimensions);
  });

  it('pushes the cleared pattern to playback and the store', () => {
    const { sketchpad, store, playback } = setup(seed());

    sketchpad.clear();

    expect(playback.patterns).toEqual([sketchpad.pattern]);
    expect(savedEdits(store)).toEqual([sketchpad.pattern]);
  });
});

describe('playback', () => {
  it('starts playing', async () => {
    const { sketchpad } = setup();

    await sketchpad.play();

    expect(sketchpad.playing).toBe(true);
  });

  it('stays stopped when the audio context refuses to start', async () => {
    const { sketchpad, playback } = setup();
    playback.refuse = true;

    await expect(sketchpad.play()).rejects.toThrow();
    expect(sketchpad.playing).toBe(false);
  });

  it('follows the playhead while it runs', async () => {
    const { sketchpad, playback } = setup();
    await sketchpad.play();

    playback.reachStep(7);

    expect(sketchpad.currentStep).toBe(7);
  });

  it('stops and clears the playhead', async () => {
    const { sketchpad, playback } = setup();
    await sketchpad.play();
    playback.reachStep(7);

    sketchpad.stop();

    expect(sketchpad.playing).toBe(false);
    expect(sketchpad.currentStep).toBeNull();
    expect(playback.stops).toBe(1);
  });

  it('keeps playing across an edit', async () => {
    const { sketchpad } = setup();
    await sketchpad.play();

    sketchpad.toggle('crash', 0);

    expect(sketchpad.playing).toBe(true);
  });
});

describe('sharing', () => {
  it('shares the pattern as it stands', () => {
    const { sketchpad } = setup(createPattern());

    sketchpad.setBpm(140);

    expect(sketchpad.shareUrl()).toBe('https://drumscore.test/?bpm=140');
  });
});

describe('disposing', () => {
  it('disposes playback and stops listening to it', () => {
    const { sketchpad, playback } = setup();

    sketchpad.dispose();
    playback.reachStep(3);

    expect(playback.disposed).toBe(true);
    expect(playback.listening).toBe(false);
    expect(sketchpad.currentStep).toBeNull();
  });
});
