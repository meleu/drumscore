<script lang="ts">
  import type { NotationModel } from '$lib/notation/model';
  import { renderNotation } from '$lib/notation/renderer';

  interface Props {
    model: NotationModel;
    // Reports the live `<svg>` VexFlow drew, or null when there is nothing drawn. Called
    // on every draw, so whoever listens always holds what is currently on screen.
    ondrawn: (svg: SVGSVGElement | null) => void;
  }

  let { model, ondrawn }: Props = $props();

  let width = $state(0);
  let failed = $state(false);

  // The attachment re-runs whenever the model changes or the container is resized,
  // redrawing the staff from scratch each time. The renderer waits for the music fonts
  // before it draws anything, so a redraw that starts while an earlier one is still in
  // flight marks that one stale and its result is dropped rather than mounted.
  const draw = (node: HTMLDivElement) => {
    if (width === 0) {
      ondrawn(null);

      return;
    }

    let stale = false;
    renderNotation(model, width).then(
      (drawn) => {
        if (stale) return;
        node.replaceChildren(...(drawn ? [drawn] : []));
        ondrawn(drawn);
        failed = false;
      },
      (error: unknown) => {
        if (stale) return;
        // Nothing to draw, but the grid, playback and sharing are all unaffected.
        console.error(error);
        ondrawn(null);
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
