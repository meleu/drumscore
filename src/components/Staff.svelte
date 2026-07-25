<script lang="ts">
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
  let failed = $state(false);

  // The attachment re-runs whenever the model changes or the container is resized,
  // redrawing the staff from scratch each time. The renderer waits for the music fonts
  // before it draws anything, so a redraw that starts while an earlier one is still in
  // flight marks that one stale and its result is dropped rather than mounted.
  const draw = (node: HTMLDivElement) => {
    if (width === 0) {
      svg = null;

      return;
    }

    let stale = false;
    renderNotation(model, width).then(
      (drawn) => {
        if (stale) return;
        node.replaceChildren(...(drawn ? [drawn] : []));
        svg = drawn;
        failed = false;
      },
      (error: unknown) => {
        if (stale) return;
        // Nothing to draw, but the grid, playback and sharing are all unaffected.
        console.error(error);
        svg = null;
        failed = true;
      },
    );

    return () => {
      stale = true;
    };
  };
</script>

<div class="staff">
  <!-- The renderer owns this node's children outright, so nothing else may render into it. -->
  <div bind:clientWidth={width} {@attach draw}></div>
  {#if failed}
    <p class="failed">
      The music fonts didn't load, so the staff can't be drawn. Reloading may fix it.
    </p>
  {/if}
</div>

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

  /* Sits where the notation would have been, so the box is never blank without a reason. */
  .failed {
    margin: 0;
    padding: 2rem 1rem;
    text-align: center;
  }
</style>
