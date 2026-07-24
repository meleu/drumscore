import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

/**
 * Renders every fixture in a real browser and compares the SVG it emits against the
 * committed baselines.
 *
 * A real browser is the point. VexFlow sizes every glyph with canvas.measureText against
 * the Bravura font, so a DOM shim — which has no 2D context — measures them all as zero
 * wide and stacks the whole staff on top of the clef. Comparing markup rather than pixels
 * keeps the result diffable and free of anti-aliasing noise.
 *
 * Run with --update to accept the current output as the new baselines.
 */

const here = dirname(fileURLToPath(import.meta.url));
const baselines = join(here, '__snapshots__');

interface Capture {
  name: string;
  svg: string;
}

/** What the fixture page leaves behind. Declared here because this file runs in Node. */
declare const window: { visualCheck?: Capture[] };

/**
 * VexFlow stamps every element with a counter that depends on how much was drawn before
 * it, which would make each fixture's baseline depend on its neighbours. Dropping the ids
 * and putting one tag per line leaves a diff that points at the shape that changed.
 */
function normalize(svg: string): string {
  return svg.replaceAll(/ id="vf-auto\d+"/g, '').replaceAll('><', '>\n<') + '\n';
}

async function capture(): Promise<Capture[]> {
  const server = await createServer({ server: { port: 0 }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch();

  try {
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error('the dev server reported no local URL');

    const page = await browser.newPage();

    // Without this a page that threw — a missing font, a renderer crash — never sets its
    // results and the wait below just runs out the clock on a timeout that says nothing.
    const crashed = new Promise<never>((_, reject) => {
      page.on('pageerror', reject);
    });

    await page.goto(new URL('visual/', url).href);
    await Promise.race([page.waitForFunction(() => window.visualCheck !== undefined), crashed]);

    return await page.evaluate(() => window.visualCheck ?? []);
  } finally {
    await browser.close();
    await server.close();
  }
}

/** The first line that differs, which is where to start reading the diff. */
function firstDifference(expected: string, actual: string): string {
  const [before, after] = [expected.split('\n'), actual.split('\n')];
  const at = before.findIndex((line, index) => line !== after[index]);

  return `line ${at + 1}:\n    baseline: ${before[at] ?? '(end of file)'}\n    rendered: ${after[at] ?? '(end of file)'}`;
}

async function main() {
  const update = process.argv.includes('--update');
  const captured = await capture();
  await mkdir(baselines, { recursive: true });

  const failures: string[] = [];

  for (const { name, svg } of captured) {
    const path = join(baselines, `${name}.svg`);
    const rendered = normalize(svg);

    if (update) {
      await writeFile(path, rendered);
      continue;
    }

    const baseline = await readFile(path, 'utf8').catch(() => undefined);
    if (baseline === undefined) failures.push(`${name}: no baseline — run with --update`);
    else if (baseline !== rendered)
      failures.push(`${name}: ${firstDifference(baseline, rendered)}`);
  }

  // A fixture that was renamed or dropped leaves its baseline behind, where it would sit
  // unnoticed and unchecked.
  const stale = (await readdir(baselines))
    .filter((file) => file.endsWith('.svg'))
    .filter((file) => !captured.some(({ name }) => `${name}.svg` === file));

  if (update) {
    console.log(`wrote ${captured.length} baseline(s) to visual/__snapshots__/`);
    if (stale.length > 0) console.log(`stale, delete by hand: ${stale.join(', ')}`);

    return;
  }

  for (const file of stale) failures.push(`${file}: no fixture produces this baseline`);

  if (failures.length > 0) {
    console.error(`${failures.length} of ${captured.length} fixture(s) differ:\n`);
    for (const failure of failures) console.error(`  ${failure}\n`);
    console.error('Open visual/index.html with `pnpm run dev` to look, or accept with --update.');
    process.exitCode = 1;

    return;
  }

  console.log(`${captured.length} fixture(s) match their baselines`);
}

await main();
