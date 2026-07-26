<script lang="ts">
  import HitMenu from './HitMenu.svelte';
  import { DISPLAY_ORDER, HIT_LABELS, type Hit, type KitVoice } from '$lib/kit';
  import { hitAt, stepsPerBar, totalSteps, type Pattern, type VoiceId } from '$lib/pattern';

  interface Props {
    pattern: Pattern;
    /** Column highlighted by the playhead during playback; null when stopped. */
    currentStep?: number | null;
    ontoggle: (voice: VoiceId, step: number) => void;
    onsethit: (voice: VoiceId, step: number, hit: Hit) => void;
  }

  let { pattern, currentStep = null, ontoggle, onsethit }: Props = $props();

  const steps = $derived(Array.from({ length: totalSteps(pattern.dimensions) }, (_, step) => step));
  const stepsPerBeat = $derived(pattern.dimensions.stepsPerBeat);
  const barLength = $derived(stepsPerBar(pattern.dimensions));

  let menu: HitMenu;

  /** The count read out loud: 1 2 3 4 for each bar, blank on the off-steps. */
  function beatLabel(step: number): string {
    if (step % stepsPerBeat !== 0) return '';
    return String(Math.floor((step % barLength) / stepsPerBeat) + 1);
  }

  /**
   * Open the menu on a cell. Reached by right-click, by the keyboard's own context-menu key
   * — browsers raise the same event for both — and by Down on the focused cell, for
   * keyboards that have neither.
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
          The variation's mark, echoing the staff's own symbol so the grid and the sheet
          teach each other. Shape rather than shade, so it survives at a cell's size and
          without colour; the label above is what carries it to a screen reader.
        -->
        {#if hit === 'accent'}<span class="mark" aria-hidden="true">&gt;</span>{/if}
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

  /* Beat and bar starts get a heavier left edge so the pulse is easy to see. */
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
    background: var(--color-accent);
  }

  /* Knocked out of the filled cell, so the mark reads at any of the theme's colours. */
  .mark {
    color: var(--color-surface);
    font-size: 0.8125rem;
    font-weight: 700;
    line-height: 1;
  }

  /* The playhead: a soft wash over the whole column, on cells and its count label. */
  .cell.playing {
    background: color-mix(in srgb, var(--color-accent) 22%, var(--color-surface));
  }

  .cell.on.playing {
    background: color-mix(in srgb, var(--color-accent) 78%, white);
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
