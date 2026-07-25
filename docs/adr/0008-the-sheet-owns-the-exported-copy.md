# The Sheet owns the exported copy of the notation

The exported copy of the notation — a self-contained SVG, a PNG file, or a PNG on the
clipboard — belongs to `src/lib/sheet/`, a runes module handed the `<svg>` the Staff drew.
It publishes `ready` and three zero-argument methods (`saveSvg`, `savePng`, `copy`), each
resolving to whether it landed. `App.svelte` builds one, wires the Staff's `ondrawn` into
it and hands it to `Transport`; no component holds an `SVGSVGElement`.

ADR-0007 left "the exported `<svg>` bound from the Staff" in the component as one of the
things that "genuinely needs the DOM". Needing the DOM makes a module browser-only, not
component-only, and the residue did not stay small: `fdc7814`, the very next commit, added
a third guarded handler, a fourth callback prop, and threaded `canexport` down to
`Transport`. Four modules ended up knowing about one element only one of them drew, every
new export destination cost an edit in three files, and both download handlers were
fire-and-forget `void` calls on promises that reject when a canvas will not encode.

## Considered options

**A Sheet that draws its own staff**, needing no element from anyone. It would have to
choose a width, where the Staff reads one from `bind:clientWidth`, so the file would stop
being a copy of what is on screen — the property `export.ts` was written to guarantee — and
ADR-0006's font-gated draw would run twice per edit, with a second copy of the stale-redraw
race.

**The Staff calling `sheet.drawn()` itself** rather than reporting through an `ondrawn`
callback. The Staff knows `NotationModel` and `renderNotation`, and has no reason to learn
that exports exist; `Grid` reports a toggle the same way and does not know the sketchpad is
there.

**No published readiness**, deleting `canexport` rather than moving it. When the fonts fail
the Staff shows its message permanently, and three live buttons beside it that silently do
nothing when clicked read as broken — the two download buttons have no feedback channel at
all.

**A port over the browser calls**, with a fake for tests, as `Playback` and `PatternStore`
have. A narrow port over delivery alone buys no test: `saveSvg` dies in `cloneNode` long
before it reaches delivery. So the port has to make the blobs too, which takes the font
embedding, the OFL notice and the rasterization into the adapter and leaves the Sheet
holding a guard and a filename. The seam would be real by the two-adapter rule; the module
behind it would be shallow.

## Consequences

The filename is derived inside the Sheet from a `name: () => string` dependency, read at
call time rather than passed per call. When a pattern carries a name, slugging it, falling
back to `drumscore`, and choosing the extension all stay behind the seam instead of
appearing twice at the call site. Until then `App` passes `() => ''`, so the fallback path
is live from the first commit.

Failure is a fact of the interface: all three methods resolve to `false` rather than
rejecting, on ADR-0006's reasoning that an error mode belongs in the interface and not in
an unhandled rejection. `false` discards the reason, which is logged.

The Sheet is browser-only and takes no port. Its tests cover what needs no browser — the
readiness transitions, and every method refusing before it touches the DOM when nothing is
drawn. Do not assert `false` from a stub element: in the node environment that passes
because there is no `document`, not because of anything the Sheet decided.

`copyLink` stays in `App.svelte`. It is the last of ADR-0007's residue and is deliberately
not absorbed — every method of the Sheet depends on the drawn staff, and copying a share
link does not.

CONTEXT.md reserves **sheet** for the exported file, so the notation model may not be
called one.
