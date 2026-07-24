import { toNotation } from '$lib/notation/engine';
import { renderNotation } from '$lib/notation/renderer';
import { FIXTURES, patternFor } from './fixtures';

/**
 * Draws every fixture, once for the snapshot driver to scrape and once for a human to
 * look at — it is the same page either way, so what the driver compares is what you see
 * when you open it.
 */

/** Fixed so the output never depends on the window the page happens to open in. */
const WIDTH = 900;

/** The size VexFlow draws noteheads at, and so the one worth asking the font about. */
const GLYPH_SIZE = '30pt';

declare global {
  interface Window {
    /** Set once every fixture is drawn; the driver waits on it. */
    visualCheck?: { name: string; svg: string }[];
  }
}

async function draw() {
  // VexFlow measures every glyph against Bravura through canvas.measureText, and it only
  // starts loading that font at import time. Drawing before it arrives silently measures
  // whatever face the browser falls back to — a notehead comes out 30px wide instead of
  // 12 — and spreads the staff out wrong. Waiting is what makes the baselines mean
  // anything, so the check refuses to run rather than quietly recording a bad layout.
  await document.fonts.ready;
  if (!document.fonts.check(`${GLYPH_SIZE} Bravura`)) {
    throw new Error('Bravura did not load; every glyph would be measured against a fallback');
  }

  const results = FIXTURES.map((fixture) => {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = fixture.name;

    const staff = document.createElement('div');
    renderNotation(staff, toNotation(patternFor(fixture)), WIDTH);

    section.append(heading, staff);
    document.body.append(section);

    return { name: fixture.name, svg: staff.innerHTML };
  });

  window.visualCheck = results;
}

void draw();
