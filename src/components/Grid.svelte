<script lang="ts">
  import HitMenu from './HitMenu.svelte';
  import { DISPLAY_ORDER, HIT_LABELS, type Hit, type KitVoice } from '$lib/kit';
  import { hitAt, stepsPerBar, totalSteps, type Pattern, type VoiceId } from '$lib/pattern';

  interface Props {
    pattern: Pattern;
    /** Playhead column; null when stopped. */
    currentStep?: number | null;
    ontoggle: (voice: VoiceId, step: number) => void;
    onsethit: (voice: VoiceId, step: number, hit: Hit) => void;
  }

  let { pattern, currentStep = null, ontoggle, onsethit }: Props = $props();

  const steps = $derived(Array.from({ length: totalSteps(pattern.dimensions) }, (_, step) => step));
  const stepsPerBeat = $derived(pattern.dimensions.stepsPerBeat);
  const barLength = $derived(stepsPerBar(pattern.dimensions));

  let menu: HitMenu;

  /** The count read out loud: 1 2 3 4 per bar, blank on the off-steps. */
  function beatLabel(step: number): string {
    if (step % stepsPerBeat !== 0) return '';
    return String(Math.floor((step % barLength) / stepsPerBeat) + 1);
  }

  /**
   * Reached by right-click, by the keyboard's context-menu key (same event), and by Down
   * on the focused cell, for keyboards with neither.
   */
  function openMenu(event: Event, voice: KitVoice, step: number): void {
    event.preventDefault();
    void menu.openAt(
      voice,
      step,
      hitAt(pattern, voice.id, step),
      event.currentTarget as HTMLElement,
    );
  }
</script>

<div class="grid" style="--step-count: {steps.length}">
  <div class="corner"></div>
  {#each steps as step (step)}
    <div class="count" class:bar={step % barLength === 0} class:playing={step === currentStep}>
      {beatLabel(step)}
    </div>
  {/each}

  {#each DISPLAY_ORDER as voice (voice.id)}
    <div class="label">{voice.label}</div>
    {#each steps as step (step)}
      {@const hit = hitAt(pattern, voice.id, step)}
      <button
        type="button"
        class="cell"
        class:on={hit !== 'off'}
        class:ghost={hit === 'ghost'}
        class:beat={step % stepsPerBeat === 0}
        class:bar={step % barLength === 0}
        class:playing={step === currentStep}
        aria-pressed={hit !== 'off'}
        aria-label="{voice.label}, step {step + 1}, {HIT_LABELS[hit]}"
        aria-haspopup="menu"
        onclick={() => ontoggle(voice.id, step)}
        oncontextmenu={(event) => openMenu(event, voice, step)}
        onkeydown={(event) => event.key === 'ArrowDown' && openMenu(event, voice, step)}
      >
        <!--
          The struck cell's block, and inside it the accent's own symbol — the staff's, so
          grid and sheet teach each other. Shape not shade throughout: the block shrinks for
          a ghost and the mark is a glyph, so both survive at a cell's size and without
          colour. The aria-label carries the variation to a screen reader.
        -->
        {#if hit !== 'off'}
          <span class="fill" aria-hidden="true">{hit === 'accent' ? '>' : ''}</span>
        {/if}
      </button>
    {/each}
  {/each}
</div>

<HitMenu bind:this={menu} onchoose={onsethit} />

<style>
  .grid {
    display: grid;
    grid-template-columns: max-content repeat(var(--step-count), minmax(1rem, 1fr));
    gap: 2px;
    align-items: center;
  }

  .label {
    padding-right: 0.75rem;
    font-size: 0.8125rem;
    color: var(--color-text-muted);
    text-align: right;
    white-space: nowrap;
  }

  .count {
    font-size: 0.6875rem;
    color: var(--color-text-muted);
    text-align: center;
  }

  .cell {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    min-height: 1.25rem;
    padding: 0;
    border: 1px solid var(--color-border);
    border-radius: 3px;
    background: var(--color-surface);
    cursor: pointer;
  }

  /* Heavier left edge at beat and bar starts, so the pulse is easy to see. */
  .cell.beat,
  .count.bar {
    border-left-color: var(--color-text-muted);
  }

  .cell.bar {
    border-left: 2px solid var(--color-accent);
  }

  .cell:hover {
    border-color: var(--color-accent);
  }

  .cell.on {
    border-color: var(--color-accent);
  }

  /*
   * The block that fills a struck cell. Its own element rather than the cell's background,
   * so how hard the cell was struck is a matter of how much of the cell it covers — and the
   * playhead's wash stays on the cell, under it.
   *
   * The `>` is knocked out of it, so the mark reads at any of the theme's colours.
   */
  .fill {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border-radius: 2px;
    background: var(--color-accent);
    color: var(--color-surface);
    font-size: 0.8125rem;
    font-weight: 700;
    line-height: 1;
  }

  /*
   * A ghost is the same stroke played quietly, and its cell is filled quietly: the block
   * pulls back off the edges and pales. Smaller as well as paler, so it reads in greyscale
   * at a cell's size, and looks nothing like the accent's `>`.
   */
  .cell.ghost .fill {
    width: 45%;
    height: 45%;
    background: color-mix(in srgb, var(--color-accent) 55%, var(--color-surface));
  }

  /* Playhead: a soft wash over the whole column, cells and count label. */
  .cell.playing {
    background: color-mix(in srgb, var(--color-accent) 22%, var(--color-surface));
  }

  .cell.playing .fill {
    background: color-mix(in srgb, var(--color-accent) 78%, white);
  }

  .cell.ghost.playing .fill {
    background: color-mix(in srgb, var(--color-accent) 55%, white);
  }

  .count.playing {
    color: var(--color-accent);
    font-weight: 700;
  }

  .cell:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
