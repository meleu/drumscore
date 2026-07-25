<script lang="ts">
  import { MAX_BPM, MIN_BPM } from '$lib/pattern';

  interface Props {
    playing: boolean;
    bpm: number;
    onplay: () => void;
    onstop: () => void;
    onbpm: (bpm: number) => void;
    onclear: () => void;
    oncopylink: () => Promise<boolean>;
    oncopypng: () => Promise<boolean>;
    onexportsvg: () => void;
    onexportpng: () => void;
    // False before the staff's first draw, when there is nothing to export yet.
    canexport: boolean;
  }

  let {
    playing,
    bpm,
    onplay,
    onstop,
    onbpm,
    onclear,
    oncopylink,
    oncopypng,
    onexportsvg,
    onexportpng,
    canexport,
  }: Props = $props();

  // Which copy button is currently showing its transient confirmation, if any. Only one
  // at a time, so a second copy replaces the first rather than leaving both lit.
  let copied = $state<'link' | 'png' | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  async function handleCopy(what: 'link' | 'png', copy: () => Promise<boolean>) {
    const ok = await copy();
    if (!ok) return;
    copied = what;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = null), 1500);
  }
</script>

<div class="transport">
  <button
    type="button"
    class="play"
    class:playing
    onclick={() => (playing ? onstop() : onplay())}
    aria-pressed={playing}
  >
    {playing ? 'Stop' : 'Play'}
  </button>

  <label class="bpm">
    Tempo
    <input
      type="number"
      min={MIN_BPM}
      max={MAX_BPM}
      step="1"
      value={bpm}
      oninput={(event) => onbpm(event.currentTarget.valueAsNumber)}
    />
    BPM
  </label>

  <button type="button" class="clear" onclick={() => onclear()}> Clear </button>

  <button type="button" class="copy" onclick={() => handleCopy('link', oncopylink)}>
    {copied === 'link' ? 'Copied!' : 'Copy link'}
  </button>

  <button
    type="button"
    class="copy"
    onclick={() => handleCopy('png', oncopypng)}
    disabled={!canexport}
  >
    {copied === 'png' ? 'Copied!' : 'Copy PNG'}
  </button>

  <button type="button" class="export" onclick={() => onexportsvg()} disabled={!canexport}>
    Export SVG
  </button>

  <button type="button" class="export" onclick={() => onexportpng()} disabled={!canexport}>
    Export PNG
  </button>
</div>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }

  .play {
    min-width: 5rem;
    padding: 0.5rem 1.25rem;
    border: 1px solid var(--color-accent);
    border-radius: 6px;
    background: var(--color-accent);
    color: var(--color-surface);
    font-weight: 600;
    cursor: pointer;
  }

  .play.playing {
    background: var(--color-surface);
    color: var(--color-accent);
  }

  .play:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .bpm {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }

  .bpm input {
    width: 4.5rem;
    padding: 0.375rem 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-surface);
    color: var(--color-text);
  }

  .clear,
  .copy,
  .export {
    padding: 0.5rem 1rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
  }

  .copy:disabled,
  .export:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .clear:focus-visible,
  .copy:focus-visible,
  .export:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
