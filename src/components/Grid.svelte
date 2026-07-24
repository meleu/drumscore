<script lang="ts">
  import { isHit, stepsPerBar, totalSteps, VOICES, type Pattern, type VoiceId } from '$lib/pattern';

  interface Props {
    pattern: Pattern;
    ontoggle: (voice: VoiceId, step: number) => void;
  }

  let { pattern, ontoggle }: Props = $props();

  // The model's canonical order runs low-to-high (kick first); a drummer reads a grid
  // the other way up, with the cymbals on top and the kick at the bottom.
  const rows = $derived([...VOICES].toReversed());

  const steps = $derived(Array.from({ length: totalSteps(pattern.dimensions) }, (_, step) => step));
  const stepsPerBeat = $derived(pattern.dimensions.stepsPerBeat);
  const barLength = $derived(stepsPerBar(pattern.dimensions));

  /** The count read out loud: 1 2 3 4 for each bar, blank on the off-steps. */
  function beatLabel(step: number): string {
    if (step % stepsPerBeat !== 0) return '';
    return String(Math.floor((step % barLength) / stepsPerBeat) + 1);
  }
</script>

<div class="grid" style="--step-count: {steps.length}">
  <div class="corner"></div>
  {#each steps as step (step)}
    <div class="count" class:bar={step % barLength === 0}>{beatLabel(step)}</div>
  {/each}

  {#each rows as voice (voice.id)}
    <div class="label">{voice.label}</div>
    {#each steps as step (step)}
      {@const on = isHit(pattern, voice.id, step)}
      <button
        type="button"
        class="cell"
        class:on
        class:beat={step % stepsPerBeat === 0}
        class:bar={step % barLength === 0}
        aria-pressed={on}
        aria-label="{voice.label}, step {step + 1}"
        onclick={() => ontoggle(voice.id, step)}
      ></button>
    {/each}
  {/each}
</div>

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

  .cell:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
</style>
