<script lang="ts">
  import type { NotationModel } from '$lib/notation/model';
  import { renderNotation } from '$lib/notation/renderer';
  import { VexFlow } from 'vexflow';

  interface Props {
    model: NotationModel;
  }

  let { model }: Props = $props();

  let width = $state(0);
  let fontsReady = $state(false);

  // VexFlow measures every glyph against its music font (Bravura, with Academico for
  // text), which it loads lazily on first use. Until that font arrives, a draw uses
  // fallback metrics and stems/beams land in the wrong place — visible on the very
  // first render, then silently corrected by any later redraw. Preload the fonts and
  // hold the first draw until they're ready. `getFonts()` returns the configured
  // family list, so we load whatever VexFlow is actually set to use.
  VexFlow.loadFonts(...VexFlow.getFonts()).then(() => (fontsReady = true));

  // The attachment re-runs whenever the model changes, the container is resized, or the
  // fonts become ready, redrawing the staff from scratch each time.
  const draw = (node: HTMLDivElement) => {
    if (width > 0 && fontsReady) renderNotation(node, model, width);
  };
</script>

<div class="staff" bind:clientWidth={width} {@attach draw}></div>

<style>
  /*
   * The staff stays black-on-white in either theme: notation reads that way, and the
   * SVG/PNG export should look the same as what's on screen.
   */
  .staff {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-paper);
    color: var(--color-ink);
  }
</style>
