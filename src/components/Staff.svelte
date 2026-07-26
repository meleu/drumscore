<script lang="ts">
  import type { NotationModel } from '$lib/notation/model';
  import { renderNotation } from '$lib/notation/renderer';

  interface Props {
    model: NotationModel;
    // The live `<svg>` VexFlow drew, or null. Called on every draw, so a listener always
    // holds what is on screen.
    ondrawn: (svg: SVGSVGElement | null) => void;
  }

  let { model, ondrawn }: Props = $props();

  let width = $state(0);
  let failed = $state(false);

  // Re-runs on a model change or a resize, redrawing from scratch. The renderer waits for
  // the music fonts, so a redraw starting while an earlier one is in flight marks that one
  // stale and drops its result.
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
        // Nothing to draw; grid, playback and sharing are unaffected.
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
  <!-- The renderer owns this node's children; nothing else may render into it. -->
  <div bind:clientWidth={width} {@attach draw}></div>
  {#if failed}
    <p class="failed">
      The music fonts didn't load, so the staff can't be drawn. Reloading may fix it.
    </p>
  {/if}
</div>

<style>
  /* Black-on-white in either theme: notation reads that way, and exports must match. */
  .staff {
    overflow-x: auto;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-paper);
    color: var(--color-ink);
  }

  /* Sits where the notation would be, so the box is never blank without a reason. */
  .failed {
    margin: 0;
    padding: 2rem 1rem;
    text-align: center;
  }
</style>
