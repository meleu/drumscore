# Plan: Supported grids

> Source PRD: [prd-supported-grids.md](./prd-supported-grids.md). Decision, rejected
> alternatives and consequences in
> [ADR-0011](../../docs/adr/0011-the-pattern-asks-the-staff-which-grids-it-can-write.md).

One predicate says which grids drumscore supports, and it derives its answer by asking the
staff's note values rather than restating them. The codec stops deciding. Nothing the user
sees, hears or has saved changes.

## Architectural decisions

Durable decisions that apply across all phases:

- **Where the answer lives**: `src/lib/pattern.ts` gains **one exported predicate** taking
  `GridDimensions` and returning a boolean. That is the whole interface — no reason codes,
  no structured result, no error type, no branded type. Every reason lives in a comment
  beside the clause it justifies.
- **One caller**: `src/lib/codec.ts`, after parsing the header. It is the one place an
  unchecked grid enters the app. The engine, the grid, the audio engine and the renderer
  keep trusting their input.
- **The membership rule**: steps per whole note is `stepsPerBeat * beatValue`; the grid is
  writable if the note-value vocabulary contains a value of exactly that many per whole
  note, because then some value spans exactly one step and every hit has a way to be
  written. No power-of-two test, no ceiling constant, no list of allowed numbers.
- **The capacity clause**, commented as a browser-layout guard rather than a product
  statement: **total steps ≤ 4096**, **bars ≤ 256**, **beats per bar ≤ 32**. 4096 steps is
  256 bars of 4/4 sixteenths, about twice a full-song transcription, and roughly 24k grid
  cells at the ceiling. The beats-per-bar bound exists because the other two do not imply
  it: one bar of sixty beats is a small grid and an absurd meter.
- **The vocabulary's home**: the table of note values and their counts per whole note lives
  in `src/lib/notation/model.ts`, beside the `NoteValue` union it is a fact about. The
  engine and the Pattern both read it; neither owns it. ADR-0002 stands — a table of note
  values and their lengths is not drawing vocabulary.
- **Direction of dependency**: `pattern.ts` → `notation/model.ts`, one way, a question with
  no mapping kept in correspondence. The notation model depends on nothing of the Pattern's.
- **No format change of any kind**: no version bump, no header field, no bit-layout change.
  Every existing share link and autosave decodes to the identical Pattern.
- **Failure mode unchanged**: `decode` returns `null` for a refused grid exactly as it does
  for a corrupt string or a wrong version. Callers keep their fallback chain.
- **Untouched throughout**: the default dimensions, the seed, the engine's musical logic
  (tables, alignment, splitting, chording, beaming, part construction), the renderer, the
  audio engine, the pattern store, and the thirteen existing visual baselines.
- **No test is weakened, skipped or deleted, and no existing expectation is edited.**

---

## Phase 1: The note values move in beside their union

**User stories**: 9

### What to build

The table of note values and how many of each make a whole note leaves the notation engine
and lands in the notation model, next to the `NoteValue` union it describes. The engine
imports it and goes on building its plain, dotted, note and rest tables from it exactly as
it does today — it keeps the work of choosing among values and stops owning what the values
are.

Nothing else moves. This is the phase that makes the next one able to ask a question rather
than restate an answer, and on its own it changes no behaviour at all.

### Acceptance criteria

- [x] `notation/model.ts` exports the note-value table, commented as the fact about the
      union that it is, and the engine holds no second copy.
- [x] The engine's `plainDurations` reads the exported table; every other function in the
      engine is unchanged.
- [x] `pnpm verify` passes with no test edited.
- [x] `pnpm verify:visual` reports no diff.

---

## Phase 2: The Pattern answers, and the codec asks

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 19, 20, 24, 25, 32, 33,
34, 35, 36, 37

### What to build

The Pattern gains the predicate. Three clauses, each carrying its reason in a comment
beside it: integrality and a floor of one, because the codec feeds it raw bytes where zero
is reachable; writability, computed by looking in the model's vocabulary for a value
spanning exactly one step; and the capacity guard with the bounds recorded above, labelled
as protection against a grid a browser cannot lay out rather than as a claim about what the
app presents well.

The codec's `isValidDimensions` and `MAX_DIMENSION` are **deleted** — not kept as a cheap
pre-filter — and it calls the predicate in their place. Its order of operations is
unchanged: parse the header, check the dimensions, check the payload length, then build.
Only the middle step changes hands.

End to end this is the phase that closes the hole: a hand-made link asking for three steps
to a beat, or eight, or 64 in every field, now comes back from `decode` as `null` and the
app falls through to autosave and then the seed, exactly as it does for a corrupt string.

The Pattern's tests gain a verdict table — grids in, expected answers out — including
today's default, the odd meters and coarse resolutions that already work, both throwing
cases from the problem statement, and the maximal grid. Refusals that are refused only
because the vocabulary is what it is today are annotated as temporary, so a reader can tell
which refusals a future note value will lift.

### Acceptance criteria

- [x] `pattern.ts` exports exactly one predicate over `GridDimensions` returning a boolean,
      with each clause commented with the reason it exists.
- [x] The writability clause reads the model's vocabulary. There is no power-of-two test,
      no ceiling constant, and no list of allowed numbers anywhere in `pattern.ts`.
- [x] Adding a shorter value to the vocabulary would widen the supported set with no edit to
      the predicate. Verify by adding `thirtysecond` to the table, checking that a
      32nd-resolution grid becomes supported, and reverting.
- [x] `codec.ts` contains no dimension bound of its own: `MAX_DIMENSION` and
      `isValidDimensions` are gone, and the predicate is the only dimension check.
- [x] `decode` returns `null` for 3 and for 8 steps per beat, for 64 in every field, and for
      a zero in any field — indistinguishably from any other malformed input.
- [x] The capacity bounds sit in one place with their reasoning attached, and admit 4/4
      sixteenths at 256 bars while refusing 64/64/64/64 and refusing a 60-beat bar.
- [x] The Pattern's tests carry a verdict table covering the default grid, at least the
      known-good odd meters and coarse resolutions, both throwing cases, and the maximal
      grid, with temporary refusals annotated as such.
- [x] The codec's existing round-trip tests are unedited and pass, and a string encoded
      before this change decodes to the identical Pattern.
- [x] `FORMAT_VERSION`, `HEADER_LENGTH` and the bit layout are untouched.
- [x] The seed, the default dimensions and everything a first-time visitor sees are
      unchanged; `pnpm verify` and `pnpm verify:visual` both pass clean.

---

## Phase 3: A sweep makes the claim testable

**User stories**: 16, 17, 18

### What to build

A sweep in the notation engine's tests over a bounded space of grid dimensions: for every
combination the predicate admits, build a densely-hit pattern — a hit on every step of every
voice, which is the worst case for splitting and beaming — run it through the engine, and
assert it produces a notation model without throwing, with each part's events filling its
measure exactly. Grids the predicate refuses are skipped: the sweep asserts the predicate is
not too permissive, which is the direction that reaches a user.

The space is `stepsPerBeat`, `beatsPerBar` and `beatValue` each over 1–16, and `bars` over
1–2. That is 8,192 combinations to filter, of which the predicate admits 480: every
`stepsPerBeat × beatValue` pair the vocabulary can write, against every meter up to sixteen
beats. Refusals cost a predicate call; the largest admitted grid is 512 steps, well inside
the capacity guard. Two bars rather than three because a second measure is what proves the
engine repeats correctly and a third proves nothing further.

This is the drift guard. The day the vocabulary grows a value, this is the test that fails
if "some value spans exactly one step" turns out not to be sufficient for the grids that
value has just admitted.

The engine's internal "no note value fits" error keeps its coverage-ignore, but its comment
stops claiming the case is impossible and starts naming the predicate as the guarantee that
keeps it from firing. The case is reachable today; that is the bug this work fixes, and the
comment was part of it.

### Acceptance criteria

- [ ] A sweep test enumerates 1–16 × 1–16 × 1–16 × 1–2, filters it through the predicate,
      and asserts every admitted grid produces a notation model from a densely-hit pattern.
- [ ] The assertion is stronger than "does not throw": each part's events sum to exactly its
      measure's length.
- [ ] The sweep visits the known-good odd meters and coarse resolutions — 7/8, 6/8, 5/4,
      eighth-note resolution — and does not visit the grids the predicate refuses.
- [ ] The count of admitted grids is asserted, so a change that quietly narrows or widens the
      predicate moves a number rather than passing silently.
- [ ] Deliberately loosening the predicate to admit three steps per beat fails the sweep.
      Verify, then revert.
- [ ] The engine's coverage-ignore comment names the predicate rather than asserting
      impossibility, and no musical logic in the engine has changed.
- [ ] `pnpm verify` passes; the sweep runs in a time that keeps the suite comfortable.

---

## Phase 4: An odd meter drawn in a real browser

**User stories**: 21, 22, 23

### What to build

The visual fixture list gains an optional `dimensions?: GridDimensions` — a whole record
rather than a partial merged over the default, because one fixture uses it and a merge helper
is more machinery than the saving is worth. A fixture that omits the field keeps using the
default grid, so the thirteen existing baselines are unaffected.

One new fixture uses it: **7/8 at eighth-note beats**, one bar — `stepsPerBeat: 2`,
`beatsPerBar: 7`, `beatValue: 8`, `bars: 1`, fourteen steps. 7/8 over 6/8 because an odd
number of beats is what makes the beaming and the final rest say something; a non-default
beat value because that is the half of the meter no baseline has ever exercised. Hits chosen
to show the meter rather than to be dense.

This takes the visual check into a real browser on a grid this project has never drawn,
which is precisely the verification ADR-0003 asked for and did not get.

The new baseline is generated once with `--update` and **reviewed by the author of this plan,
by eye, before the commit** — not by the implementer, and not after. Implementation stops at
the generated baseline and hands over. A baseline is only worth what the first look at it was
worth.

### Acceptance criteria

- [ ] The fixture type carries `dimensions?: GridDimensions`, and the page builds each
      fixture's pattern on the dimensions it names or the default when it names none.
- [ ] One fixture is 7/8 at eighth-note beats over one bar, with a stable, filesystem-safe
      name.
- [ ] The baseline is generated and left uncommitted, and the phase is not done until it has
      been looked at and accepted by hand.
- [ ] All thirteen existing baseline SVGs are byte-identical.
- [ ] `pnpm verify:visual` passes with fourteen fixtures and reports no stale baselines.

---

## Phase 5: The glossary catches up

**User stories**: 27, 28, 29, 30, 31

### What to build

Two edits to `CONTEXT.md`. **Grid dimensions** gains a sentence saying that which
combinations the staff can write follows from the note values it knows, so the set grows as
tuplets and finer values are added — describing the moving set rather than freezing it. **No
new term is coined**: a term whose definition would need revising twice in the next year is
worse than no term. **Kit** loses its claim to be the one place the two halves of the app
meet, because that claim is now false.

ADR-0011 is already written and already narrows ADR-0009, records the capacity numbers'
reasoning, and records that triplets and 32nds are deferred rather than refused. The work
here is to read it against what actually landed and correct it if the implementation
diverged — particularly its central rule, if the sweep taught us anything.

### Acceptance criteria

- [ ] `CONTEXT.md`'s **Grid dimensions** entry says the writable set follows from the note
      values, and coins no new term.
- [ ] `CONTEXT.md`'s **Kit** entry no longer claims to be the one place the two halves meet.
- [ ] ADR-0011 matches what was built, including the capacity numbers as implemented.
- [ ] No other ADR is edited: ADR-0009 is narrowed by ADR-0011's record, not rewritten.
- [ ] `pnpm verify` and `pnpm verify:visual` pass.

---

## The one behaviour that does change

This is a refactor and nothing a user does today behaves differently: the default grid, the
seed, the staff, the sound, every existing share link and every autosave are untouched, and
the visual baselines prove it. The single behavioural change is at the door — an encoded
pattern naming a grid the staff cannot write now decodes to `null` instead of reaching the
engine. Reaching the engine meant a thrown error or a wedged browser, so no working input
loses anything; a `null` there is the same `null` a corrupt string has always produced, and
the caller's fallback chain already handles it.

## Questions settled

Recorded so the reasoning is not re-derived mid-implementation:

- **The fixture's meter is 7/8 at eighth-note beats**, one bar. See Phase 4.
- **The sweep's space is 1–16 × 1–16 × 1–16 × 1–2**, admitting 480 grids. See Phase 3.
- **The fixture's dimensions field is a whole `GridDimensions`**, not a partial.
- **The new baseline is reviewed by hand before it is committed**, by the plan's author.
  Implementation generates it and stops.
