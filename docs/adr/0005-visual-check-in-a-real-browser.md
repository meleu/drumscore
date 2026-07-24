# The renderer is checked as SVG markup in a real browser

The notation renderer is not unit-tested. It is covered by `verify:visual`, which draws a
set of fixture patterns in a pinned Playwright Chromium and diffs the emitted SVG markup
against committed baselines.

A DOM shim was not an option: VexFlow sizes every glyph with `canvas.measureText` against
Bravura, and jsdom and happy-dom have no 2D context — every glyph measures zero wide and
the whole staff collapses onto the clef, so the check would pass on output nobody would
accept. Comparing markup rather than pixels keeps a failure readable as a diff (a stray
rest, a moved stem) and free of anti-aliasing noise.

## Consequences

The check needs a browser download and is far slower than the pure tests, so it is kept
out of `pnpm run verify` and run deliberately. The baselines are the renderer's
specification: a diff is a review, not a nuisance, and `--update` is an acceptance, not a
fix.
