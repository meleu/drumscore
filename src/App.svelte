<script lang="ts">
  import Grid from './components/Grid.svelte';
  import Staff from './components/Staff.svelte';
  import Transport from './components/Transport.svelte';
  import { AudioEngine } from '$lib/audio';
  import { toNotation } from '$lib/notation/engine';
  import { clear, seed, setBpm, toggle, type VoiceId } from '$lib/pattern';

  const initialPattern = seed();
  let pattern = $state(initialPattern);
  let playing = $state(false);
  // The column the audio engine is currently sounding; null when stopped.
  let currentStep = $state<number | null>(null);
  const notation = $derived(toNotation(pattern));

  // Seeded from the initial value; the effects below keep it in sync from here on.
  const engine = new AudioEngine(initialPattern);
  engine.onStep((step) => (currentStep = step));

  // Keep the engine in step with the pattern (cells and tempo) while it plays.
  $effect(() => engine.setPattern(pattern));
  $effect(() => engine.setBpm(pattern.bpm));
  $effect(() => () => engine.dispose());

  function handleToggle(voice: VoiceId, step: number) {
    pattern = toggle(pattern, voice, step);
  }

  async function play() {
    await engine.play();
    playing = true;
  }

  function stop() {
    engine.stop();
    playing = false;
  }

  function handleBpm(bpm: number) {
    pattern = setBpm(pattern, bpm);
  }

  function handleClear() {
    pattern = clear(pattern);
  }
</script>

<main>
  <header>
    <h1>drumscore</h1>
    <p>Sketch a drum loop on the grid and read it back as percussion notation.</p>
  </header>

  <section aria-label="Transport controls">
    <Transport
      {playing}
      bpm={pattern.bpm}
      onplay={play}
      onstop={stop}
      onbpm={handleBpm}
      onclear={handleClear}
    />
  </section>

  <section aria-label="Pattern grid">
    <Grid {pattern} {currentStep} ontoggle={handleToggle} />
  </section>

  <section aria-label="Notation">
    <Staff model={notation} />
  </section>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    max-width: 72rem;
    margin: 0 auto;
    padding: 2.5rem 1.5rem 4rem;
  }

  h1 {
    font-size: 1.75rem;
  }

  header p {
    margin: 0.375rem 0 0;
    color: var(--color-text-muted);
  }
</style>
