<script lang="ts">
  import { notationFontsReady } from '$lib/notation/fonts';
  import type { NotationModel } from '$lib/notation/model';
  import { renderNotation } from '$lib/notation/renderer';

  interface Props {
    model: NotationModel;
    // The live `<svg>` VexFlow drew, exposed so the app can export it. Null until the
    // first successful draw.
    svg?: SVGSVGElement | null;
  }

  // `svg` is written outward for the parent to bind and never read here, so
  // no-useless-assignment can't see that its default and updates matter.
  // eslint-disable-next-line no-useless-assignment
  let { model, svg = $bindable(null) }: Props = $props();

  let width = $state(0);
  let fontsReady = $state(false);

  // VexFlow measures every glyph against its music font (Bravura, with Academico for
  // text). Until those fonts arrive, a draw uses fallback metrics and stems/beams land
  // in the wrong place — visible on the very first render, then silently corrected by
  // any later redraw. They are served from our own bundle (see `$lib/notation/fonts`),
  // so this is a local load, but still hold the first draw until it resolves.
  notationFontsReady.then(() => (fontsReady = true));

  // The attachment re-runs whenever the model changes, the container is resized, or the
  // fonts become ready, redrawing the staff from scratch each time.
  const draw = (node: HTMLDivElement) => {
    if (width > 0 && fontsReady) {
      renderNotation(node, model, width);
      svg = node.querySelector('svg');
    } else {
      svg = null;
    }
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
