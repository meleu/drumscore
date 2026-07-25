# The notation renderer waits for its own fonts

`renderNotation` is asynchronous. It awaits the music fonts itself and resolves to the
`<svg>` it drew, rather than taking a container and trusting its callers to have waited
first.

VexFlow sizes every glyph against Bravura through `canvas.measureText`, so a draw that
happens before the font arrives measures against whatever face the browser falls back to
— a notehead comes out 30px wide instead of 12 — and puts stems and beams in the wrong
place. Nothing goes visibly wrong: the layout is merely incorrect, and any later redraw
quietly replaces it. That precondition used to live outside the function, and it cost us
`7851871`, "Fix misplaced stems/beams on first staff render" — fixed at the call site, in
the Staff, not at the seam. The second caller, the visual check's fixture page, then wrote
its own copy of the wait, plus a `document.fonts.check` assertion the Staff never had.

Three alternatives were rejected. A factory whose existence proves readiness
(`createNotationRenderer(): Promise<…>`) keeps the draw synchronous, but the Staff still
holds a piece of state gating the first render — the same shape, holding an object instead
of a boolean. Awaiting the fonts in `main.ts` before mounting satisfies the precondition by
global ordering, which is invisible at the seam and reintroduces the bug the moment a third
entry point appears — and the fixture page is already a second one. Drawing immediately and
redrawing when the fonts land keeps the interface synchronous at the price of making the
visual baselines depend on timing, which ADR-0005 cannot tolerate.

## Consequences

Font failure is a real error mode of the interface, not an unhandled rejection: the
returned promise rejects, and the Staff — the only place that can answer for it — says so
in the space the notation would have occupied. Because the renderer no longer owns a
container, the caller mounts the result, so a redraw that supersedes one still in flight
can be dropped whole rather than racing it into the DOM.

Do not restore the synchronous signature to "simplify" it. The `await` is the only thing
standing between a caller and a silently wrong staff, and it is free after the first
resolution.
