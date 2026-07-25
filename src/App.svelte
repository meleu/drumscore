<script lang="ts">
  import Grid from './components/Grid.svelte';
  import RepoLink from './components/RepoLink.svelte';
  import Staff from './components/Staff.svelte';
  import Transport from './components/Transport.svelte';
  import { AudioEngine } from '$lib/audio';
  import { toNotation } from '$lib/notation/engine';
  import { patternStore } from '$lib/persistence';
  import { createSheet } from '$lib/sheet/sheet.svelte';
  import { createSketchpad } from '$lib/sketchpad.svelte';

  // Every state transition lives behind this seam — the app below only draws what the
  // sketchpad holds and calls back into it. Sound and storage are handed in, so nothing
  // here decides how a pattern is remembered or played.
  const sketchpad = createSketchpad({
    store: patternStore,
    playback: (pattern) => new AudioEngine(pattern),
  });
  $effect(() => () => sketchpad.dispose());

  // Everything you can take away from the staff lives behind this seam, which holds the
  // drawn `<svg>` so no component here has to. The name is what an exported file is
  // named after; '' until a pattern carries one, which the sheet reads as unnamed.
  const sheet = createSheet({ name: () => '' });

  const notation = $derived(toNotation(sketchpad.pattern));

  async function copyLink(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(sketchpad.shareUrl());
      return true;
    } catch {
      return false;
    }
  }
</script>

<main>
  <header>
    <div class="header-text">
      <h1>drumscore</h1>
      <p>Quickly sketch drum loops and see them in real musical notation.</p>
    </div>
    <RepoLink href="https://github.com/meleu/drumscore" />
  </header>

  <section aria-label="Transport controls">
    <Transport {sketchpad} {sheet} oncopylink={copyLink} />
  </section>

  <section aria-label="Pattern grid">
    <Grid
      pattern={sketchpad.pattern}
      currentStep={sketchpad.currentStep}
      ontoggle={sketchpad.toggle}
    />
  </section>

  <section aria-label="Notation">
    <Staff model={notation} ondrawn={sheet.drawn} />
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

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  h1 {
    font-size: 1.75rem;
  }

  header p {
    margin: 0.375rem 0 0;
    color: var(--color-text-muted);
  }
</style>
