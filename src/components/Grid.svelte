<script lang="ts">
  import { DISPLAY_ORDER } from '$lib/kit';
  import { isHit, stepsPerBar, totalSteps, type Pattern, type VoiceId } from '$lib/pattern';

  interface Props {
    pattern: Pattern;
    /** Column highlighted by the playhead during playback; null when stopped. */
    currentStep?: number | null;
    ontoggle: (voice: VoiceId, step: number) => void;
  }

  let { pattern, currentStep = null, ontoggle }: Props = $props();

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
    <div class="count" class:bar={step % barLength === 0} class:playing={step === currentStep}>
      {beatLabel(step)}
    </div>
  {/each}

  {#each DISPLAY_ORDER as voice (voice.id)}
    <div class="label">{voice.label}</div>
    {#each steps as step (step)}
      {@const on = isHit(pattern, voice.id, step)}
      <button
        type="button"
        class="cell"
        class:on
        class:beat={step % stepsPerBeat === 0}
        class:bar={step % barLength === 0}
        class:playing={step === currentStep}
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
