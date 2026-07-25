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

declare global {
  interface Window {
    /** Set once every fixture is drawn; the driver waits on it. */
    visualCheck?: { name: string; svg: string }[];
  }
}

async function draw() {
  const results: NonNullable<Window['visualCheck']> = [];

  for (const fixture of FIXTURES) {
    const section = document.createElement('section');
    const heading = document.createElement('h2');
    heading.textContent = fixture.name;

    const staff = document.createElement('div');
    // The renderer holds its own draw until the music fonts arrive, which is what makes
    // the baselines mean anything, and rejects rather than recording a bad layout if they
    // never do — surfacing as a page error the snapshot driver fails on.
    const drawn = await renderNotation(toNotation(patternFor(fixture)), WIDTH);
    if (drawn) staff.append(drawn);

    section.append(heading, staff);
    document.body.append(section);

    results.push({ name: fixture.name, svg: staff.innerHTML });
  }

  window.visualCheck = results;
}

void draw();
