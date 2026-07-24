<script lang="ts">
  import type { NotationModel } from '$lib/notation/model';
  import { renderNotation } from '$lib/notation/renderer';

  interface Props {
    model: NotationModel;
  }

  let { model }: Props = $props();

  let width = $state(0);

  // The attachment re-runs whenever the model changes or the container is resized,
  // redrawing the staff from scratch each time.
  const draw = (node: HTMLDivElement) => {
    if (width > 0) renderNotation(node, model, width);
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
