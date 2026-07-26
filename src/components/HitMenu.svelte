<script lang="ts">
  import { tick } from 'svelte';
  import { HIT_LABELS, type Hit, type KitVoice } from '$lib/kit';
  import type { VoiceId } from '$lib/pattern';

  /**
   * The menu of ways one cell can be struck, opened on the cell pointed at.
   *
   * Items are a projection of the drum's Kit row — plain, then what it accepts — so a new
   * variation appears here with no edit, and a drum that takes none still opens a
   * one-item menu (ADR-0013).
   *
   * The platform popover gives the top layer, Escape and click-outside for free; what is
   * written here is where it opens, which item is focused, and arrow-key movement.
   *
   * One instance serves the whole grid — the cell hands itself in through `openAt`.
   */

  interface Props {
    /** How the chosen cell should now be struck. Refusals are the sketchpad's business. */
    onchoose: (voice: VoiceId, step: number, hit: Hit) => void;
  }

  let { onchoose }: Props = $props();

  /** The cell the menu is open on, and how it is struck right now. */
  interface Target {
    voice: KitVoice;
    step: number;
    current: Hit;
    /** Focus goes back here whenever the menu closes. */
    anchor: HTMLElement;
  }

  /** Distance from the cell, and closest approach to the viewport edge. */
  const GAP = 4;
  const MARGIN = 8;

  let menu: HTMLDivElement | undefined = $state();
  // Raw: replaced wholesale, and a proxied target would not compare equal to the object
  // `openAt` holds while it waits.
  let target = $state.raw<Target | null>(null);
  let left = $state(0);
  let top = $state(0);

  /** Plain first, then the drum's own variations: the menu is the row. */
  const items = $derived<Hit[]>(target ? ['plain', ...target.voice.variations] : []);

  const buttons = (): HTMLButtonElement[] => (menu ? [...menu.querySelectorAll('button')] : []);

  /**
   * Wait out the rest of the gesture that asked for the menu.
   *
   * A popover opened during `contextmenu` is light-dismissed moments later by that same
   * click's `pointerup` — the pointer went down outside it, which is what dismissal is
   * for. Showing a task later puts it up after the click, so dismissal stays the
   * platform's rather than being disabled.
   */
  const gestureOver = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

  /** Awaits the items being in the DOM, so the menu measures at the size it will draw at. */
  export async function openAt(
    voice: KitVoice,
    step: number,
    current: Hit,
    anchor: HTMLElement,
  ): Promise<void> {
    const opening: Target = { voice, step, current, anchor };
    target = opening;
    await tick();
    await gestureOver();
    // Another cell asked while this one waited; that one wins.
    if (!menu || target !== opening) return;

    // Below the cell, left edges aligned, then pulled back inside the viewport — measured
    // after showing, since a popover has no size until it is in the top layer.
    const cell = anchor.getBoundingClientRect();
    left = cell.left;
    top = cell.bottom + GAP;
    menu.showPopover();

    const box = menu.getBoundingClientRect();
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - box.width - MARGIN));
    if (top + box.height > window.innerHeight - MARGIN) {
      top = Math.max(MARGIN, cell.top - box.height - GAP);
    }

    const focused = buttons()[items.indexOf(current)] ?? buttons()[0];
    focused?.focus();
  }

  function choose(hit: Hit): void {
    if (target) onchoose(target.voice.id, target.step, hit);
    menu?.hidePopover();
  }

  /**
   * Where focus goes home. Escape and click-away are handled by the popover itself and
   * never pass through `choose`, so this is the one place that can put focus back.
   */
  function closed(event: ToggleEvent): void {
    if (event.newState !== 'closed') return;

    const anchor = target?.anchor;
    target = null;
    anchor?.focus();
  }

  /** Up and down walk the items, wrapping; Home and End jump to the ends. */
  function move(event: KeyboardEvent, from: number): void {
    const all = buttons();
    const to = {
      ArrowDown: from + 1,
      ArrowUp: from - 1,
      Home: 0,
      End: all.length - 1,
    }[event.key];
    if (to === undefined) return;

    event.preventDefault();
    all[(to + all.length) % all.length]?.focus();
  }
</script>

<div
  bind:this={menu}
  popover="auto"
  role="menu"
  class="menu"
  aria-label={target ? `${target.voice.label}, step ${target.step + 1}` : undefined}
  style="left: {left}px; top: {top}px"
  ontoggle={closed}
>
  {#each items as hit, index (hit)}
    <button
      type="button"
      role="menuitemradio"
      aria-checked={hit === target?.current}
      onclick={() => choose(hit)}
      onkeydown={(event) => move(event, index)}
    >
      <span class="tick" aria-hidden="true">{hit === target?.current ? '•' : ''}</span>
      {HIT_LABELS[hit]}
    </button>
  {/each}
</div>

<style>
  /*
   * The popover's own styles centre it; these put it where `openAt` measured. `margin: 0`
   * matters — the default `margin: auto` would fight the offsets.
   */
  .menu {
    position: fixed;
    margin: 0;
    padding: 0.25rem;
    min-width: 8rem;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
  }

  .menu button {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    width: 100%;
    padding: 0.3rem 0.6rem 0.3rem 0.25rem;
    border: 0;
    border-radius: 4px;
    background: none;
    color: inherit;
    font-size: 0.8125rem;
    text-align: left;
    cursor: pointer;
  }

  .menu button:hover {
    background: color-mix(in srgb, var(--color-accent) 16%, transparent);
  }

  .menu button:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  /* Fixed column, so labels line up whichever item carries the marker. */
  .tick {
    width: 0.75rem;
    color: var(--color-accent);
    text-align: center;
  }
</style>
