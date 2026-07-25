# The Kit — Product Requirements Document

> Source: discussion about an architecture review. Vocabulary: **Voice**, **Pattern**,
> **Part**, **Notehead**, **Staff position** in [CONTEXT.md](../../CONTEXT.md).
> Constrained by [ADR-0002](../../docs/adr/0002-notation-model-not-vexflow.md) (the notation
> model carries no drawing vocabulary) and [ADR-0003](../../docs/adr/0003-grid-dimensions-are-data.md).

## Problem Statement

I am about to add several voices to drumscore — toms, a ride bell, a hi-hat played with the
foot — and adding one voice today means assembling it out of four modules in the right order.
What a Voice *is* has no home in the codebase: its label and canonical order live with the
Pattern, its notehead and staff position live with the notation engine, its part membership
lives in a separate table beside them, its sound lives with the audio engine, and its position
on the grid is an accident of the order the Pattern happens to declare.

Two of those edits fail silently, which is what makes this more than tedium:

- A voice named in the id list but absent from the labelled list produces a pattern with no
  row for it. Nothing complains at compile time; the app crashes the first time that voice is
  read.
- A voice that is not listed in a Part is simply never written to the staff. No error, no
  warning, no note — the drum is playable, shareable and audible, and invisible in the
  notation. This is the one I expect to lose an afternoon to, four times over.

Meanwhile the grid's row order is derived by reversing the Pattern's canonical order, and that
canonical order is the pattern codec's bit layout. A purely visual preference — cymbals at the
top, kick at the bottom — is silently welded to the wire format, so I cannot reorder rows on
screen without changing what a share link means, and I cannot choose where a new voice sits in
the encoding without deciding where it sits on screen.

Understanding a single drum means reading four files. Adding one means editing four, and being
right about all of them without help.

## Solution

One module — the **Kit** — that says what the drums are. One row per Voice, carrying everything
that is true of that drum regardless of who is asking: its id, the label a human reads, whether
it is played by the hands or the feet, the notehead it is written with, and where that notehead
sits on the staff.

Everyone else reads from it. The Pattern takes its voice ids and canonical order from the Kit.
The notation engine derives its notehead table and its parts' membership from the Kit instead of
restating them. The grid takes its labels and its row order from the Kit instead of reversing
someone else's list. The audio engine keeps its Tone-specific synths, keyed by the same ids,
where the compiler already insists every voice has one.

Adding a drum becomes describing it: one row, plus a synth the compiler asks for by name. Both
silent failures become impossible — part membership is a required field of the row rather than
an entry in a list you can forget, and there is no second list to fall out of step with the
first.

Nothing the user sees or hears changes. No voice is added by this work. The grid renders the
same six rows in the same order, the staff draws the same notation, existing share links decode
to the same patterns, and the visual baselines do not move. This is the preparation, done on its
own, so that the voices that follow are a table edit rather than a scavenger hunt.

## User Stories

1. As a maintainer, I want a single module that describes every drum in the kit, so that I can
   understand what a voice is without reading four files.
2. As a maintainer, I want each drum described by one row, so that adding a voice is one edit
   rather than five.
3. As a maintainer, I want a voice's part — hands or feet — to be a required field of its row,
   so that I cannot add a drum that is silently never written to the staff.
4. As a maintainer, I want the voice id list and the labelled voice list collapsed into one, so
   that they cannot fall out of step and crash the app at runtime.
5. As a maintainer, I want the compiler to reject a kit row that is missing any of its fields,
   so that an incomplete drum never reaches the app.
6. As a maintainer, I want the notation engine to derive its notehead table from the Kit, so
   that a drum's appearance is stated once.
7. As a maintainer, I want the notation engine to derive each part's voice membership from the
   Kit, so that the two tables that must agree cannot disagree.
8. As a maintainer, I want the grid to take its row labels from the Kit, so that renaming a
   drum is one edit.
9. As a maintainer, I want the grid's row order to come from the Kit rather than from reversing
   the Pattern's list, so that where a drum appears on screen is a decision someone made rather
   than a side effect.
10. As a maintainer, I want the Kit to own the canonical order the codec encodes in, so that the
    constraint "this order is the wire format" is stated where the order is declared.
11. As a maintainer, I want a test that pins the canonical order, so that reordering the kit
    fails loudly rather than quietly changing what every existing share link means.
12. As a maintainer, I want the audio engine to keep its Tone-specific synth construction, so
    that the Kit does not become a dumping ground for things that are not true of a drum in
    general.
13. As a maintainer, I want a missing synth for a new voice to be a compile error, so that a
    drum can never be drawable but silent.
14. As a maintainer, I want the Kit to be its own module rather than an extension of the
    Pattern, so that notation vocabulary does not leak into the half of the app that models what
    the user drew.
15. As a maintainer, I want tests that assert the Kit's invariants — every voice has exactly one
    part, every voice has a notehead — so that the guarantees the module claims are checked
    rather than described.
16. As a maintainer, I want the notation engine's existing tests to pass unchanged, so that I
    know the derivation reproduces the tables it replaced exactly.
17. As a maintainer, I want the visual baselines to be untouched by this work, so that any diff
    is proof I changed behaviour I meant to leave alone.
18. As a maintainer, I want existing share links to decode to identical patterns, so that a pure
    refactor does not become a data migration.
19. As a maintainer, I want the term **Kit** added to the project's domain language, so that the
    module has a name the whole team and every future reader agrees on.
20. As a maintainer about to add toms, I want to add a tom by writing one row, so that the work
    is bounded and reviewable.
21. As a maintainer about to add a hi-hat foot, I want to put a second voice in the feet part by
    writing `feet` in its row, so that I do not have to discover that parts hold lists.
22. As a maintainer about to add a ride bell, I want the Kit to tell me exactly which field is
    missing — its notehead style — so that the gap in the notation model surfaces immediately
    rather than as a wrong glyph on the staff.
23. As a maintainer, I want the two hi-hats to keep collapsing into a single notehead when
    struck together, so that a behaviour the notation depends on survives the refactor.
24. As a maintainer, I want chords to keep ordering their noteheads by staff height, so that
    drums added later chord correctly without any further work.
25. As a maintainer, I want the Kit to be readable as a table, so that reviewing a change to the
    kit is reading a diff of rows rather than a diff of scattered edits.
26. As an AI agent working in this codebase, I want one file that answers "what drums are
    there and how is each written", so that I do not have to infer it from four partial views.
27. As an AI agent asked to add a voice, I want the required fields to be enforced by types, so
    that I cannot produce a plausible-looking change that silently omits the staff.
28. As a reviewer, I want a change adding a drum to touch one table and one synth, so that I can
    tell at a glance whether it is complete.
29. As a drummer, I want the app to look, sound and behave exactly as it does today after this
    change, so that a refactor costs me nothing.
30. As a drummer, I want new drums to arrive sooner and with fewer mistakes, so that the kit
    grows without the notation quietly going wrong.
31. As a first-time visitor, I want the Seed to open exactly as it does today, so that nothing
    about my first impression changes.

## Implementation Decisions

### The Kit module

- The Kit is a **new module of its own**, at the same level as the Pattern and the notation
  engine — not a section of the Pattern module and not part of the notation model. It is the one
  place where the grid half and the staff half of the app are allowed to meet, which is why it
  must be small and declarative.
- One entry per Voice — the type is **`KitVoice`** — carrying: **id**, **label**, **part** (hands
  or feet), **notehead style**, **staff position**. Nothing else. If a field is not true of the
  drum itself — how loud its synth is, how it is filtered, where rests go — it does not belong
  here.
- **The Kit depends on the notation model, not the other way round.** `NoteheadStyle` and
  `StaffPosition` stay where they are, in the notation model, and the Kit imports them. Moving
  them into the Kit would invert a dependency the engine and renderer already read the right way
  round, to no gain.
- The entry list's **declaration order is the canonical order**, which is the pattern codec's bit
  layout. This constraint is documented on the Kit, where the order is declared, rather than in
  the codec that consumes it.
- The **VoiceId type is derived from the Kit's entries**, so there is exactly one list of voices
  in the codebase. The Pattern module re-exports the `VoiceId` type — its own interfaces are
  stated in terms of it — and nothing more. Every module that needs the *list* imports the Kit
  directly, so there is one import to follow rather than a chain of re-exports.
- The Kit **publishes display order** — the order the grid draws rows in, cymbals at top and kick
  at bottom. Its implementation stays what it is today (the reverse of canonical order); what
  changes is that the rule lives on the Kit rather than in the grid component. This is
  deliberately not a second hand-maintained list: it is one derivation, owned in one place, so
  that the day display order needs to diverge from canonical order there is a single line to
  change and a single module to test.

### The notation engine

- The engine's notehead table stops being a literal and becomes a **projection of the Kit**.
- The engine's parts keep everything that is true of a **Part** rather than of a Voice: stem
  direction, rest position, whole-rest position. What they lose is their hand-written voice
  membership list, which becomes a filter over the Kit by part.
- The engine's musical logic is unchanged. Chord noteheads continue to be ordered by staff
  height, so voices added later chord correctly with no further work; parts continue to hold any
  number of voices; the duplicate-notehead collapse that writes the two hi-hats as one head
  continues to key off notehead style and staff position.
- ADR-0002 stands: the notation model gains no drawing vocabulary, and the Kit carries none.

### The pattern grid

- The grid reads labels and row order from the Kit and stops reversing the Pattern's list. It
  keeps everything else — beat counting, playhead highlighting, the toggle callback.

### The audio engine

- The audio engine keeps building its own Tone nodes and keeps its trigger map **keyed by voice
  id**, which is already exhaustive, so a new Kit row that has no synth is a compile error. No
  synth parameters move into the Kit.

### The pattern codec

- The codec continues to walk voices in canonical order, now taken from the Kit, which it imports
  by name rather than reaching through the Pattern — the module the constraint is about should
  say so at its import. Its byte layout, format version and validation are untouched by this
  work.
- A comment records that changing the number of voices changes the payload width and therefore
  breaks every existing encoded pattern. Per the decision taken during the architecture review,
  that breakage is **accepted** when the new voices land; it is not this work's problem, and no
  migration path is built.

### Verification

- **No behaviour changes.** The full test suite passes with no test weakened, and the visual
  baselines are byte-identical. A moved baseline means the derivation is wrong, not that the
  baseline needs accepting. "Unmodified" is the wrong bar for the test files: collapsing the two
  voice lists deletes exports that existing tests import, so those tests must swap the old name
  for the Kit. What must not change is what they assert — no expectation edited, no test deleted
  or skipped.
- New tests cover the Kit's invariants — every voice resolves to exactly one part, every voice
  has a notehead, canonical order matches the pinned expected order — and the fact that the
  derived engine tables reproduce what they replaced.
- The pinned canonical-order test is the one that must fail loudly on a careless reorder, since
  the compiler cannot see that constraint.
- **No new codec test.** Story 18 is guaranteed by the codec's existing round-trip tests passing
  unmodified over a canonical order that has not moved; pinning an encoded string as a fixture
  would be pinning a format that is expected to break the moment new voices land.
- **No dry run of adding a voice.** Stories 20–22 and 28 describe how cheap the *next* change
  should be. They are answered by the Kit's shape and the ADR, not by adding a seventh row to
  watch the compiler complain and then reverting it.

### Documentation

- **Kit** is added to the domain language in `CONTEXT.md`, under *the loop as drawn*, with the
  terms it is not (kit piece, drum map, instrument table). It sits between the two halves, but
  it is filed with the half whose vocabulary — Voice — it is built out of.
- An ADR records the decision, principally so that a future reader knows why the notehead and
  part tables are derived rather than written out, why synth construction deliberately stayed
  behind in the audio engine, and why display order is published from the Kit rather than left
  in the grid.

## Out of Scope

- **Adding any new voice.** No toms, no ride bell, no hi-hat foot. This work prepares the ground
  and stops. The kit ends with the same six voices it starts with.
- **New notehead styles.** The ride bell will need a diamond notehead, which means widening the
  notation model's style union and making the renderer's style-to-glyph mapping exhaustive. That
  is candidate 2 of the architecture review, and it is a separate piece of work — though a short
  one, and the natural next one.
- **Any change to the pattern codec's format**, including a version bump. Nothing about the wire
  format changes here.
- **Any migration path for existing share links or autosaves.** Settled: breaking them when voice
  count changes is accepted.
- **Refactoring how audio synths are built.** The trigger map's keying is confirmed, not changed.
- **Grid layout work for a taller kit.** More rows will make the grid taller; whether that needs
  scrolling, grouping or a different cell size is a question for when the rows exist.
- **The pattern store's injectable sources**, the sheet's browser-level check, and the grid
  dimensions' second adapter — candidates 3, 4 and 5 of the review, untouched here.
- **Renaming or relabelling existing voices**, and any change to their staff positions or
  noteheads. The kit table's first version states exactly what the code states today.

## Further Notes

- **The engine is readier than it looks.** Two things that would normally be the hard part of
  adding voices are already done: chords sort their noteheads by staff height rather than by
  position in a list, and a part already carries several voices (the hands carry five). This is
  why the work is a table refactor and not an engine rewrite — the engine needs rows, not code.
- **The seam to watch.** The Kit sits between the loop as drawn and the loop as written, and it
  is the only module allowed to. The risk is that it becomes a general-purpose bag: the first
  time something wants to put a synth envelope, a colour or a keyboard shortcut in a kit row is
  the moment to ask whether that is true of the drum or true of the module asking.
- **The display-order decision is the one to revisit if the work feels over-built.** Publishing
  display order from the Kit is one derived value, not a second list — but if the grid ends up as
  the only reader and the derivation stays a reversal forever, a future review may reasonably
  fold it back. It is written down here so that the choice is visible rather than assumed.
- **Sequencing.** This work, then the notehead-style exhaustiveness fix, then the voices
  themselves. The middle step is minutes and it is what stops the ride bell from being drawn as
  an ordinary notehead with nothing to say so.
- **What "silently" means here.** Both failure modes this PRD targets are real and reachable
  today, not hypothetical: a voice missing from the labelled list crashes on first read, and a
  voice in no part is drawable, audible, shareable and absent from the staff. Neither is caught
  by the compiler, and neither is caught by the current tests.
