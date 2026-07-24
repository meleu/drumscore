<script lang="ts">
  import Grid from './components/Grid.svelte';
  import Staff from './components/Staff.svelte';
  import { toNotation } from '$lib/notation/engine';
  import { createPattern, toggle, type VoiceId } from '$lib/pattern';

  let pattern = $state(createPattern());
  const notation = $derived(toNotation(pattern));

  function handleToggle(voice: VoiceId, step: number) {
    pattern = toggle(pattern, voice, step);
  }
</script>

<main>
  <header>
    <h1>drumscore</h1>
    <p>Sketch a drum loop on the grid and read it back as percussion notation.</p>
  </header>

  <section aria-label="Pattern grid">
    <Grid {pattern} ontoggle={handleToggle} />
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
