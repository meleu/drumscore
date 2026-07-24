<script lang="ts">
  import Grid from './components/Grid.svelte';
  import Staff from './components/Staff.svelte';
  import Transport from './components/Transport.svelte';
  import { AudioEngine } from '$lib/audio';
  import { exportPng, exportSvg } from '$lib/export';
  import { toNotation } from '$lib/notation/engine';
  import { clear, setBpm, toggle, type VoiceId } from '$lib/pattern';
  import { loadInitialPattern, save, shareUrl } from '$lib/persistence';

  // Load precedence (URL -> autosave -> seed) lives in the persistence module.
  const initialPattern = loadInitialPattern();
  let pattern = $state(initialPattern);
  let playing = $state(false);
  // The column the audio engine is currently sounding; null when stopped.
  let currentStep = $state<number | null>(null);
  // The live notation SVG, bound from the Staff, that the export controls act on.
  let staffSvg = $state<SVGSVGElement | null>(null);
  const notation = $derived(toNotation(pattern));

  // Seeded from the initial value; the effects below keep it in sync from here on.
  const engine = new AudioEngine(initialPattern);
  engine.onStep((step) => (currentStep = step));

  // Keep the engine in step with the pattern (cells and tempo) while it plays.
  $effect(() => engine.setPattern(pattern));
  $effect(() => engine.setBpm(pattern.bpm));
  $effect(() => () => engine.dispose());

  // Autosave every edit so a refresh restores the working pattern.
  $effect(() => save(pattern));

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

  async function copyLink(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(shareUrl(pattern));
      return true;
    } catch {
      return false;
    }
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
      oncopylink={copyLink}
      onexportsvg={handleExportSvg}
      onexportpng={handleExportPng}
      canexport={staffSvg !== null}
    />
  </section>

  <section aria-label="Pattern grid">
    <Grid {pattern} {currentStep} ontoggle={handleToggle} />
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

  h1 {
    font-size: 1.75rem;
  }

  header p {
    margin: 0.375rem 0 0;
    color: var(--color-text-muted);
  }
</style>
