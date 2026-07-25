<script lang="ts">
  import Grid from './components/Grid.svelte';
  import RepoLink from './components/RepoLink.svelte';
  import Staff from './components/Staff.svelte';
  import Transport from './components/Transport.svelte';
  import { AudioEngine } from '$lib/audio';
  import { copyPng, exportPng, exportSvg } from '$lib/sheet/export';
  import { toNotation } from '$lib/notation/engine';
  import { patternStore } from '$lib/persistence';
  import { createSketchpad } from '$lib/sketchpad.svelte';

  // Every state transition lives behind this seam — the app below only draws what the
  // sketchpad holds and calls back into it. Sound and storage are handed in, so nothing
  // here decides how a pattern is remembered or played.
  const sketchpad = createSketchpad({
    store: patternStore,
    playback: (pattern) => new AudioEngine(pattern),
  });
  $effect(() => () => sketchpad.dispose());

  // The live notation SVG, bound from the Staff, that the export controls act on.
  let staffSvg = $state<SVGSVGElement | null>(null);
  const notation = $derived(toNotation(sketchpad.pattern));

  async function copyLink(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(sketchpad.shareUrl());
      return true;
    } catch {
      return false;
    }
  }

  function handleCopyPng(): Promise<boolean> {
    return staffSvg ? copyPng(staffSvg) : Promise.resolve(false);
  }

  function handleExportSvg() {
    if (staffSvg) void exportSvg(staffSvg);
  }

  function handleExportPng() {
    if (staffSvg) void exportPng(staffSvg);
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
    <Transport
      playing={sketchpad.playing}
      bpm={sketchpad.pattern.bpm}
      onplay={sketchpad.play}
      onstop={sketchpad.stop}
      onbpm={sketchpad.setBpm}
      onclear={sketchpad.clear}
      oncopylink={copyLink}
      oncopypng={handleCopyPng}
      onexportsvg={handleExportSvg}
      onexportpng={handleExportPng}
      canexport={staffSvg !== null}
    />
  </section>

  <section aria-label="Pattern grid">
    <Grid
      pattern={sketchpad.pattern}
      currentStep={sketchpad.currentStep}
      ontoggle={sketchpad.toggle}
    />
  </section>

  <section aria-label="Notation">
    <Staff model={notation} bind:svg={staffSvg} />
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
