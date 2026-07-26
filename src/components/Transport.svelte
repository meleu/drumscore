<script lang="ts">
  import { MAX_BPM, MIN_BPM } from '$lib/pattern';
  import type { Sheet } from '$lib/sheet/sheet.svelte';
  import type { Sketchpad } from '$lib/sketchpad.svelte';

  interface Props {
    // Handed over whole rather than unpacked per button: reading them here keeps the
    // display in step.
    sketchpad: Sketchpad;
    // Not ready before the staff's first draw, when there is nothing to export.
    sheet: Sheet;
    // Sharing is the app's, not the sketchpad's: the sketchpad says what the URL is,
    // the clipboard needs a browser.
    oncopylink: () => Promise<boolean>;
  }

  let { sketchpad, sheet, oncopylink }: Props = $props();

  // Which copy button shows its transient confirmation. One at a time, so a second copy
  // replaces the first rather than leaving both lit.
  let copied = $state<'link' | 'png' | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  async function handleCopy(what: 'link' | 'png', copy: () => Promise<boolean>) {
    const ok = await copy();
    if (!ok) return;
    copied = what;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied = null), 1500);
  }

  // Starting audio needs a gesture the browser can refuse, and it refuses by rejecting.
  // The sketchpad stays stopped either way, so there is nothing to show — but the
  // rejection still needs somewhere to land.
  function play() {
    sketchpad.play().catch((error: unknown) => console.error(error));
  }
</script>

<div class="transport">
  <button
    type="button"
    class="play"
    class:playing={sketchpad.playing}
    onclick={() => (sketchpad.playing ? sketchpad.stop() : play())}
    aria-pressed={sketchpad.playing}
  >
    {sketchpad.playing ? 'Stop' : 'Play'}
  </button>

  <label class="bpm">
    Tempo
    <input
      type="number"
      min={MIN_BPM}
      max={MAX_BPM}
      step="1"
      value={sketchpad.pattern.bpm}
      oninput={(event) => sketchpad.setBpm(event.currentTarget.valueAsNumber)}
    />
    BPM
  </label>

  <button type="button" class="clear" onclick={() => sketchpad.clear()}> Clear </button>

  <button type="button" class="copy" onclick={() => handleCopy('link', oncopylink)}>
    {copied === 'link' ? 'Copied!' : 'Copy link'}
  </button>

  <button
    type="button"
    class="copy"
    onclick={() => handleCopy('png', sheet.copy)}
    disabled={!sheet.ready}
  >
    {copied === 'png' ? 'Copied!' : 'Copy PNG'}
  </button>

  <button type="button" class="export" onclick={() => sheet.saveSvg()} disabled={!sheet.ready}>
    Export SVG
  </button>

  <button type="button" class="export" onclick={() => sheet.savePng()} disabled={!sheet.ready}>
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
