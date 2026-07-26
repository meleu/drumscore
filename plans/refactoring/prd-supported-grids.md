# Supported grids — Product Requirements Document

> Source: the architecture review's candidate 2, "Let the Pattern say which grids exist",
> and the grilling session that followed it. Vocabulary: **Pattern**, **Grid dimensions**,
> **Step**, **Hit**, **Bar**, **Measure**, **Notation model**, **Encoded pattern** in
> [CONTEXT.md](../../CONTEXT.md).
> Constrained by [ADR-0002](../../docs/adr/0002-notation-model-not-vexflow.md) (the notation
> model carries no drawing vocabulary),
> [ADR-0003](../../docs/adr/0003-grid-dimensions-are-data.md) (grid dimensions are data, and
> the claim that other grids work is explicitly unverified),
> [ADR-0009](../../docs/adr/0009-the-kit-says-what-the-drums-are.md) (the Kit is the one
> module allowed to meet both halves) and
> [ADR-0010](../../docs/adr/0010-the-pattern-store-stays-thin.md) (the share link is a proof
> of concept).
> The decision itself, its rejected alternatives and its consequences are recorded in
> [ADR-0011](../../docs/adr/0011-the-pattern-asks-the-staff-which-grids-it-can-write.md);
> this document describes the work.

## Problem Statement

drumscore ships one grid — sixteenths, 4/4, two bars — but **grid dimensions** are data, and
the pattern codec will decode any four numbers in the range 1–64 into a Pattern and hand it
to the rest of the app. The only thing in the codebase that answers the question "which
grids does drumscore support?" is a byte-plausibility guard inside the wire format, and its
answer is 65,536 grids. The app draws one of them.

That gap is not theoretical. Three things reachable from a hand-made link today:

- **Three steps to a beat throws.** The notation engine builds its note-value table by
  keeping only the values that land on a whole number of steps. At three steps per beat,
  eighths and sixteenths fall out of the table, no value spans a single step, and a hit on an
  off-step has nothing that can express it. The engine raises an error from deep inside its
  splitting logic — an error whose own comment says it is unreachable, and which the coverage
  tooling is told to ignore for that reason.
- **Eight steps to a beat throws too**, for the same reason from the other end: the shortest
  value the staff writes is a sixteenth, which spans two steps on that grid, so single steps
  again cannot be written.
- **A maximal grid wedges the browser.** Sixty-four in every field decodes to 262,144 steps —
  over 1.5 million grid cells, 64 measures on a single staff line, and a quarter-megabyte
  link.

Meanwhile the reverse failure is just as real: legitimate grids that the app handles
perfectly well — 7/8, 6/8, 5/4, eighth-note resolution — have never been drawn by a test or a
fixture, so nothing distinguishes "works" from "nobody has tried".

The knowledge that decides all of this exists, but it is scattered and none of it is stated
as a rule. The engine knows which note values it can write. The grid knows how wide a column
can be. The staff knows it draws one unwrapped line. The codec, which knows none of these
things, is the module doing the deciding.

## Solution

The Pattern answers the question, because the Pattern is what the question is about. One
predicate — *is this a grid drumscore supports?* — with everything behind it, and one caller:
the pattern codec asks it after parsing a header, instead of range-checking bytes.

The important part is what the predicate is made of. It does not restate what the staff can
write; it **asks**. The rule is that some note value must span exactly one step, tested by
looking in the note-value vocabulary itself for an entry of that length. Today's vocabulary
admits sixteenth-resolution and coarser, in any meter, and refuses triplet resolutions and
32nds. The day the staff learns 32nd notes, 32nd grids become supported. The day it learns
tuplets, triplet grids become supported. **The predicate is not edited for either.**

Alongside that sits a capacity clause, honest about being a different kind of statement: a
guard against a grid a browser cannot lay out, sized far past a full-song transcription so
that no planned feature has to move it.

Finally, the claim gets backed. A sweep asserts that every grid the predicate admits is one
the engine can actually write, so the day the note-value vocabulary changes, any disagreement
fails a test rather than reaching a user. And one odd-meter fixture is drawn in a real
browser — the first non-default grid this project has ever rendered, which is precisely the
verification ADR-0003 asked for and did not get.

Nothing the user sees changes. Every existing share link and autosave decodes to exactly the
same pattern; the default grid, the seed, the staff and the visual baselines are untouched.

## User Stories

1. As a maintainer, I want one module to answer "which grids does drumscore support", so that
   the answer is a decision someone made rather than the by-product of a byte range.
2. As a maintainer, I want that answer to live with the Pattern, so that it sits beside the
   grid dimensions it is about rather than inside the wire format.
3. As a maintainer, I want the pattern codec to ask the question rather than answer it, so
   that the format's job stays parsing bytes.
4. As a maintainer, I want the codec's dimension guard deleted rather than kept alongside the
   new predicate, so that there is one answer in the codebase and not two.
5. As a maintainer, I want the rule derived from the staff's note values rather than restated
   as a bound, so that it cannot drift from what the staff can actually write.
6. As a maintainer planning 32nd-note support, I want adding that note value to widen the set
   of supported grids on its own, so that the feature is not silently half-delivered by a
   predicate that was left behind.
7. As a maintainer planning triplet support, I want adding tuplet values to admit triplet
   grids on its own, so that the same is true there.
8. As a maintainer, I want no list of "allowed" numbers anywhere in the Pattern, so that
   there is nothing to forget to update.
9. As a maintainer, I want the note-value table to live with the note values it describes
   rather than inside the engine that consumes them, so that both the engine and the Pattern
   read one source.
10. As a maintainer, I want a hand-made link asking for three steps to a beat to be refused
    cleanly, so that the app never throws from inside its notation logic.
11. As a maintainer, I want a hand-made link asking for a 262,144-step grid to be refused, so
    that a link cannot wedge someone's browser.
12. As a maintainer, I want the refusal to look exactly like every other malformed input, so
    that the codec keeps its single, tolerant failure mode.
13. As a maintainer, I want the capacity limits labelled as a guard rather than as a product
    statement, so that nobody later reads them as a claim about what the app presents well.
14. As a maintainer intending to support full-song transcription, I want the capacity limits
    sized past a full song, so that this is not a number I have to keep raising.
15. As a maintainer, I want the meter bounded independently of the total step count, so that a
    single bar of sixty beats is refused even though it is small.
16. As a maintainer, I want the notation engine's "unreachable" comment to name the guarantee
    it depends on, so that its precondition is documented rather than folklore.
17. As a maintainer, I want a test that sweeps every grid the predicate admits and asserts the
    engine can write it, so that the two cannot disagree without a test failing.
18. As a maintainer, I want that sweep to be the thing that catches a mistake when the
    note-value vocabulary grows, so that a future feature gets told immediately rather than
    shipping a grid that throws.
19. As a maintainer, I want a table of grids and expected verdicts, so that the predicate's
    intent is readable without deriving it from the vocabulary.
20. As a maintainer, I want the refused cases in that table annotated with why they are
    refused today, so that a reader knows which refusals are temporary.
21. As a maintainer, I want one odd-meter fixture drawn in a real browser, so that ADR-0003's
    unverified claim about other grids becomes a verified one.
22. As a maintainer, I want the visual fixture list to be able to carry dimensions, so that
    future grids can be snapshotted without restructuring the check.
23. As a maintainer, I want all thirteen existing baselines untouched, so that any movement is
    proof I changed behaviour I meant to leave alone.
24. As a maintainer, I want existing share links and autosaves to decode identically, so that
    a refactor does not become a data migration.
25. As a maintainer, I want no change to the encoded pattern's byte layout or format version,
    so that nothing about sharing is affected by this work.
26. As a maintainer adding a bar-count control later, I want a predicate already in place to
    validate against, so that the control is a widget rather than a design question.
27. As a maintainer, I want the project's glossary to say that which grids the staff can write
    follows from the note values it knows, so that the growing set is described rather than
    frozen.
28. As a maintainer, I want the Kit's "one place the halves meet" claim corrected rather than
    quietly falsified, so that the glossary keeps meaning what it says.
29. As a maintainer, I want ADR-0009's matching claim narrowed by a later record, so that a
    reader of that file is not misled.
30. As a maintainer, I want an ADR explaining why the capacity number is what it is, so that
    nobody reads it as a product limit and nobody tunes it without cause.
31. As a maintainer, I want the ADR to record that triplets and 32nds are deferred rather than
    refused, so that a future reader does not mistake today's answer for a permanent one.
32. As an AI agent working in this codebase, I want one named predicate to consult, so that I
    do not infer supported grids from a byte range and produce a plausible, wrong change.
33. As an AI agent asked to add a note value, I want the supported-grid set to follow
    automatically, so that I cannot deliver half the feature.
34. As a reviewer, I want each clause of the predicate to carry the reason it exists, so that
    reviewing a change to it is reading an argument rather than guessing at intent.
35. As a drummer, I want the app to look, sound and behave exactly as it does today, so that
    this work costs me nothing.
36. As a drummer opening an old share link, I want the same pattern I saved, so that nothing
    about this change reaches me.
37. As a first-time visitor, I want the seed to open exactly as it does today, so that nothing
    about my first impression changes.

## Implementation Decisions

### Where the answer lives

- The Pattern module gains **one exported predicate** taking grid dimensions and returning a
  boolean. That is the whole interface. Every reason lives in comments beside the clause it
  justifies; no reason codes, no structured result, no error type.
- **A boolean, not a parsed or branded type** — see ADR-0011 for why the compiler-enforced
  version was rejected.
- **The pattern codec is the only caller.** It is the one place an unchecked grid enters the
  app, so one call covers every path; the engine, the grid, the audio engine and the renderer
  keep trusting their input. When a bar-count control arrives it becomes the second caller,
  and the seam stops being hypothetical.

### What the predicate is made of

- **Integrality and a floor.** Every dimension must be an integer of at least one. The codec
  feeds it raw bytes, where zero is reachable.
- **Writability, by asking rather than restating.** The predicate computes steps per whole
  note from the dimensions and looks for a note value of exactly that many per whole note. If
  one exists, some value spans exactly one step and every hit has a way to be written. This
  is the entire musical rule; there is no power-of-two test and no ceiling constant.
- **Capacity, as a guard.** Bounds on total steps, on bars, and on beats per bar,
  commented as protection against a grid the browser cannot lay out. Sized so that a
  full-song transcription — roughly 120 bars — passes with room to spare, and so the
  million-cell case does not.
- The bound on beats per bar exists **because the other two do not imply it**: one bar of
  sixty beats at one step each is a small grid and an absurd meter.

### The note-value table

- The table of note values and their counts per whole note **moves out of the notation engine
  and into the notation model**, beside the value union it is a fact about. The engine keeps
  the job of choosing among values — building the plain, dotted and rest tables, alignment,
  splitting — and reads the vocabulary rather than owning it.
- The Pattern reads the same table. This is a **one-way question**, not a mapping: the grid
  half asks the staff half what it can write, and nothing is kept in correspondence between
  them. It does mean the Pattern now depends on the notation model, retiring the Kit's claim
  to be the only module that meets both halves — ADR-0011 records that and narrows ADR-0009.
- ADR-0002 stands: the notation model gains no drawing vocabulary. A table of note values and
  their lengths is not drawing vocabulary.

### The notation engine

- No musical logic changes. The engine's tables, alignment rules, splitting, chording, beaming
  and part construction are all untouched apart from importing the vocabulary from its new
  home.
- The engine's internal error for "no note value fits" keeps its coverage-ignore, but its
  comment stops asserting that the case is impossible and starts naming the predicate as the
  reason it cannot fire. The case is reachable today; that is the bug being fixed, and the
  comment was part of it.

### The pattern codec

- Its dimension guard and its maximum-dimension constant are **deleted**, not kept as a cheap
  pre-filter. Two answers to one question is the condition this work exists to remove.
- The order of operations is unchanged: parse the header, check the dimensions, check the
  payload length, then build. Only the middle step changes hands.
- `decode` still returns nothing for a refused grid, exactly as it does for a corrupt string
  or a wrong version. The codec keeps one tolerant failure mode and callers keep their
  fallback chain.
- **No format change of any kind.** No version bump, no new header field, no change to the bit
  layout. Every existing encoded pattern decodes to the identical Pattern.

### Verification

- **A verdict table** in the Pattern's tests: grids in, expected answers out, including the
  two throwing cases from the problem statement, and with the temporary refusals annotated as
  temporary.
- **A sweep** in the notation engine's tests over a bounded space of dimensions: for every
  grid the predicate admits, a densely-hit pattern must produce a notation model without
  throwing, with each part filling its measure exactly. This is the drift guard, and it is
  the test that will fail if a future note value makes the membership rule insufficient.
- **One visual fixture on a non-default grid** — an odd meter with a non-default beat value —
  taking the visual check into a real browser on a grid it has never drawn. The fixture list
  gains an optional dimensions field; fixtures that omit it keep using the default grid, so
  the thirteen existing baselines are unaffected.
- The new baseline is generated once and **reviewed by eye before it is committed**, because a
  baseline is only worth what the first look at it was worth.
- No existing test is weakened, skipped or deleted, and no expectation is edited.

### Documentation

- The glossary's **Grid dimensions** entry gains a sentence saying that which combinations the
  staff can write follows from the note values it knows, so the set grows as tuplets and finer
  values are added. **No new term is coined** — the concept is still moving, and a term whose
  definition would need revising twice in the next year is worse than no term.
- The glossary's **Kit** entry loses its claim to be the one place the two halves meet, since
  the claim is now false.
- **ADR-0011 is already written** and carries the decision, the rejected alternatives, and the
  consequences — including the narrowing of ADR-0009 and the closing of ADR-0003's
  outstanding request for a non-default-grid test or fixture. Nothing further is needed from
  this work except keeping it accurate if the implementation diverges.

## Out of Scope

- **Triplet and tuplet support.** A triplet is not a finer grid; it is a value carrying a
  ratio, which needs the notation model to gain tuplets, the engine to align them, and the
  renderer to bracket them. This work makes that feature widen the supported set for free — it
  does not deliver any part of it.
- **32nd-note support.** Same shape, smaller: adding the value to the vocabulary and its
  drawing code is a separate change, which this work is designed to require nothing from.
- **A user-facing way to change the grid.** No bar-count control, no resolution picker, no
  meter selector. The predicate is what a future control validates against; it is not the
  control.
- **Making long scores look good.** Wrapping the staff onto multiple lines and giving the grid
  something better than one very wide row are both real and both needed before full-song
  transcription is pleasant. The capacity guard deliberately permits sizes that will not look
  good yet, rather than pretending the layout work is done.
- **Any change to the encoded pattern's format**, its version, or its size limits. A full
  song's encoded pattern would be too long for a comfortable URL; that is a link problem, the
  link is already recorded as a proof of concept in ADR-0010, and it is not this work's
  problem.
- **The pattern store**, its browser sources and its coverage. Settled in ADR-0010 and
  untouched here.
- **Splitting the sheet exporter's making from its delivering**, and **moving the staff's draw
  loop out of the component** — candidates 3 and 4 of the architecture review, both unexplored
  and both independent of this.
- **Fixtures for every supported grid.** One non-default grid is drawn in a browser. The sweep
  covers the rest at the notation-model level, which is where the risk actually is.
- **Changing the default grid**, the seed, or anything about what a first-time visitor sees.

## Further Notes

- **The evidence is empirical, not inferred.** Every failure in the problem statement was
  reproduced by driving the notation engine directly across a spread of grids: the two throws,
  and the four odd meters and coarse resolutions that work today and are untested. The
  predicate's rule was derived from that result rather than the other way round.
- **Why this is the deepening and not just a validation function.** Deleting the predicate
  does not move complexity; it scatters it back out. The codec would have to know about note
  values, the engine would keep an unreachable-but-reachable throw, the grid would keep no
  opinion about how many cells is too many, and the question would go back to having no
  owner. Complexity concentrating in one place under a small interface is the whole test.
- **Sequencing.** This work is on the critical path for user-chosen bars, and it is cheapest
  now, while the answer is still one grid and there is no control to keep in step with it.
  After it, the natural next steps are the note-value vocabulary growing (32nds, then
  tuplets), and the layout work that makes long scores readable.
- **The one thing to watch during implementation.** If the sweep shows that "some value spans
  exactly one step" is not sufficient — a grid where the value exists but cannot legally begin
  where it needs to — then ADR-0011's central rule is wrong and the ADR needs amending before
  the work lands, not after. The probe validated the rule across eight grids for today's
  vocabulary, so this is a tuplet-era risk rather than a present one.
