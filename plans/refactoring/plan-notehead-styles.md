# Plan: A notehead style the renderer has never heard of

> Follows [the Kit](./plan-drum-kit-module.md). Source: the *New notehead styles* item in
> [prd-drum-kit.md](./prd-drum-kit.md)'s Out of Scope — candidate 2 of the architecture
> review, and the step the PRD puts between the Kit and the new voices.

One conditional decides how every drum is drawn. Make it a table, so that widening the
style union is a compile error rather than a wrong glyph.

## What is actually wrong

`renderer.ts:46` is the whole of it:

```ts
return keyFor(position, style === 'cross' ? '/x' : '');
```

Every style that is not `cross` takes the empty branch and draws an ordinary notehead.
Add `diamond` to `NoteheadStyle` tomorrow and nothing objects: the type checks, VexFlow
reads a key with no glyph code, its `codeNoteHead` switch falls through to its default, and
the ride bell is drawn as a plain black notehead — at build time, at draw time and on
screen, nothing says so. The only way to find out is to look at the staff and know what a
bell is supposed to look like.

The renderer's two other translations from the model — `DURATION_CODES` over `NoteValue`
and `STEM_DIRECTIONS` over `StemDirection` — are already exhaustive records over their
unions. The notehead is the one that got a conditional, and it is the one whose failure is
silent.

## Architectural decisions

- **The fix is a record**, `Record<NoteheadStyle, string>`, sitting with the two beside it
  that already work this way. Adding a member to the union then fails to compile at the one
  place that knows what the glyph should be.
- **`diamond` does not ship here.** It arrives with the ride bell, in the same change as
  the row that needs it. Two reasons: nothing in this repo can exercise a style no drum
  uses — the visual fixtures run Pattern → engine → renderer, so an unused style has no
  path to a baseline — and the guard's entire purpose is that the bell's kit row will not
  compile until the style and its glyph are added together. Shipping the style early would
  ship an untested branch and spend the compile error this work exists to buy.
- **No ADR.** Easy to reverse, unsurprising to a reader, and there is no rejected
  alternative worth remembering. The record's comment carries the reasoning.
- **No new test.** The guarantee is a type, and a test cannot assert a compile error. The
  renderer is covered by the visual baselines, which must not move.

## Phase 1: The style-to-glyph mapping becomes a table

### What to build

`renderer.ts` gains a `NOTEHEAD_GLYPHS: Record<NoteheadStyle, string>` — `normal: ''`,
`cross: '/x'` — and `keyOf` reads from it instead of branching. The comment on it says why
it is a record: an unknown style silently draws an ordinary notehead, so the compiler has
to be the one that catches a missing entry.

Nothing else changes. The notation model keeps the same two styles, the engine is
untouched, the Kit is untouched, and every drum is drawn with exactly the glyph it is drawn
with today.

### Acceptance criteria

- [x] The renderer holds no conditional on notehead style; the mapping is a record over
      `NoteheadStyle`.
- [x] Adding a member to `NoteheadStyle` is a compile error in `renderer.ts`. Verify by
      adding one, running `pnpm check`, and reverting.
- [x] `NoteheadStyle` still has exactly two members; no new style, no new voice.
- [x] `pnpm verify` passes and `pnpm verify:visual` reports no diff — every baseline SVG
      byte-identical, since nothing about what is drawn has changed.

## Notes for the ride bell, which is the next work

Findings from this pass, recorded so the bell is a row and a glyph rather than a research
task:

- **The diamond's glyph code is `/di`.** VexFlow's `Tables.codeNoteHead` treats `DI` (and
  its alias `H`) as duration-aware: it picks the double-whole, whole, half or black diamond
  from the note value, exactly the way `X` does for the cross. The `/d0`–`/d3` codes pin one
  weight instead, so a bell on a whole note would come out black. Use `diamond: '/di'`.
- **`kit.test.ts:41` pins the styles as a literal** `['normal', 'cross']`, so a third style
  makes that test fail. That is the same kind of deliberate pin as the canonical order — it
  forces the change to be made twice, on purpose. Decide when the bell lands whether it
  stays a pin or becomes a derived list; do not pre-emptively loosen it here.
- **The bell needs more than a style**: a staff position, a synth in the audio engine (the
  compiler will ask), and a visual fixture, since the diamond's first real coverage is a
  baseline of it being drawn.
