<script lang="ts">
  import { tick } from 'svelte';
  import { HIT_LABELS, type Hit, type KitVoice } from '$lib/kit';
  import type { VoiceId } from '$lib/pattern';

  /**
   * The menu of ways one cell can be struck, opened on the cell the user pointed at.
   *
   * Its items are a projection of the drum's own row — plain, then whatever that row says
   * the drum accepts — so a variation added to the Kit appears here with no edit, and a
   * drum that takes none still opens a menu with one item in it (ADR-0013).
   *
   * Built on the platform's popover, which is what puts it in the top layer, closes it on
   * Escape and closes it on a click outside, none of it hand-written. What is written here
   * is where it opens, which item is focused, and how the arrow keys move between them.
   *
   * One instance serves the whole grid: the cell hands itself in through `openAt`, so the
   * page holds one menu rather than one per cell.
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
    /** Focus goes back here when the menu closes, however it closes. */
    anchor: HTMLElement;
  }

  /** How far from the cell the menu sits, and how close to the viewport edge it may get. */
  const GAP = 4;
  const MARGIN = 8;

  let menu: HTMLDivElement | undefined = $state();
  // Raw because a target is only ever replaced wholesale, and because a proxied one would
  // not compare equal to the object `openAt` is holding while it waits.
  let target = $state.raw<Target | null>(null);
  let left = $state(0);
  let top = $state(0);

  /** Plain first, then the drum's own variations: the menu is the row, not a list of its own. */
  const items = $derived<Hit[]>(target ? ['plain', ...target.voice.variations] : []);

  const buttons = (): HTMLButtonElement[] => (menu ? [...menu.querySelectorAll('button')] : []);

  /**
   * The rest of the gesture that asked for the menu, waited out.
   *
   * A popover opened during a right-click's `contextmenu` is light-dismissed moments later
   * by that same click's `pointerup`: the pointer went down outside the menu, which is
   * exactly what dismissal is for. Showing a task later puts the menu up after the click is
   * over, so the platform's dismissal stays the platform's rather than being disabled.
   */
  const gestureOver = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

  /**
   * Open on a cell. Awaits the items being in the DOM before showing, so the menu is
   * measured at the size it will be drawn at rather than at the size it was last time.
   */
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
    // A second cell asked for the menu while this one waited; that one wins.
    if (!menu || target !== opening) return;

    // Below the cell and aligned to its left edge, then pulled back inside the viewport —
    // measured after showing, because a popover has no size until it is in the top layer.
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
   * Closing is where focus goes home, whether the user chose an item, pressed Escape or
   * clicked away — the last two the popover handles on its own, and neither passes through
   * `choose`, so this is the one place that can put focus back.
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
   * The popover's own styles centre it in the viewport; these put it where `openAt`
   * measured instead. `margin: 0` matters — the default `margin: auto` would fight the
   * offsets above.
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

  /* A fixed column for the marker, so the labels line up whichever item carries it. */
  .tick {
    width: 0.75rem;
    color: var(--color-accent);
    text-align: center;
  }
</style>
