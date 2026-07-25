# Plan: The Kit

> Source PRD: [prd-drum-kit.md](./prd-drum-kit.md)

One module that says what the drums are. Everyone else reads from it. Nothing the user
sees or hears changes.

## Architectural decisions

Durable decisions that apply across all phases:

- **Module**: a new `src/lib/kit.ts`, with `src/lib/kit.test.ts` beside it. A sibling of
  `pattern.ts` and `notation/`, not a section of either. It is the one module allowed to
  meet the grid half and the staff half, which is why it stays small and declarative.
- **Row shape**: one entry per Voice — the type is `KitVoice` — carrying `id`, `label`,
  `part` (`hands` or `feet`), and its notehead: style plus staff position. Every field
  required. Nothing that is not true of the drum itself belongs here.
- **Types**: `NoteheadStyle` and `StaffPosition` stay in `notation/model.ts`; the Kit
  imports them. The Kit depends on the notation model; the notation model does not depend
  on the Kit.
- **Canonical order**: the entry list's declaration order is the canonical order, which is
  the pattern codec's bit layout. The constraint is documented on the Kit, where the order
  is declared, and pinned by a test the compiler cannot replace.
- **`VoiceId`**: derived from the Kit's entries, so there is exactly one list of voices in
  the codebase. `pattern.ts` re-exports the `VoiceId` type — its own interfaces are stated
  in terms of it — and nothing else. Every module that needs the *list* imports `kit.ts`,
  so there is one import to follow rather than a chain of re-exports.
- **Display order**: published by the Kit — the order the grid draws rows in, cymbals top
  and kick bottom. Implemented as it is today, the reverse of canonical order, but owned
  and tested in one place.
- **Import path**: the codec and the notation engine import `kit.ts` directly rather than
  reaching it through `pattern.ts`, so the module the canonical-order constraint is about
  names it at the import.
- **Unchanged by this work**: the codec's byte layout, format version and validation; the
  audio engine's Tone node construction and its trigger map keyed by voice id; the
  engine's musical logic; every visual baseline.

---

## Phase 1: The Kit, and the Pattern derived from it

**User stories**: 1, 2, 3, 4, 5, 10, 11, 14, 15, 18, 25, 26, 27

### What to build

The Kit module, holding all six voices exactly as the code states them today: id, label,
part, notehead style, staff position. `VoiceId` is derived from its entries. `pattern.ts`
loses its own `VOICE_IDS`/`VOICES` literals and keeps only the re-exported `VoiceId` type,
so the two lists that could fall out of step become one. Everything that walked the
Pattern's list — the codec, the audio engine's step callback — imports the Kit instead.

The notation engine still holds its own notehead and part tables; the grid still reverses
the list it is given, now the Kit's. Both are dealt with in their own phases. The app
behaves identically.

### Acceptance criteria

- [x] `src/lib/kit.ts` exists with one `KitVoice` entry per voice, each carrying id, label,
      part, notehead style and staff position, and the canonical-order constraint
      documented on the list.
- [x] `VoiceId` is derived from the Kit's entries; no second list of voice ids or labels
      exists anywhere in the codebase.
- [x] Omitting any field from an entry is a compile error.
- [x] `pattern.ts` re-exports the `VoiceId` type and nothing more; every other module that
      needs the list imports `kit.ts`.
- [x] The Kit publishes display order — canonical order reversed — with a test.
- [x] Tests assert the invariants: every voice resolves to exactly one part, every voice
      has a notehead, and canonical order matches a pinned expected order that fails
      loudly on a reorder.
- [x] The codec's format version, header, byte layout and validation are unchanged, and
      its existing round-trip tests pass unmodified.
- [x] `pnpm verify` passes, and no test was weakened: the only edits to existing tests
      swap the deleted `VOICES`/`VOICE_IDS` for `KIT`, renaming loop variables. No
      assertion, expectation or test name changed, and no test was deleted or skipped.

This criterion first read "no test modified other than additions", which no faithful
refactor could have met: deleting an export forces an edit in every test that imported it.
The three that changed — `codec.test.ts`, `pattern.test.ts`, `sketchpad.test.ts` — swap
`VOICES`/`VOICE_IDS` for `KIT` and nothing else. What the criterion was protecting is that
no test was weakened to make the refactor pass, so it now says that instead.

---

## Phase 2: The notation engine derives its tables from the Kit

**User stories**: 6, 7, 16, 17, 23, 24

### What to build

The engine's notehead table stops being a literal and becomes a projection of the Kit. Its
parts keep what is true of a Part — stem direction, rest position, whole-rest position —
and lose their hand-written voice membership lists, which become a filter over the Kit by
part.

No musical logic moves. Chord noteheads keep sorting by staff height, parts keep holding
any number of voices, and the two hi-hats keep collapsing into a single head.

### Acceptance criteria

- [x] The engine holds no literal mapping from voice to notehead, and no literal list of a
      part's voices.
- [x] The engine imports `kit.ts` directly.
- [x] Every existing engine test passes unmodified.
- [x] A test asserts the derived tables reproduce what they replaced — each voice's
      notehead and each part's membership.
- [x] `pnpm verify:visual` reports no diff; every baseline SVG is byte-identical.
- [x] ADR-0002 still holds: no drawing vocabulary enters the notation model or the Kit.

The notehead half of the fourth item is carried by a test that predates this phase — the
per-drum table in `describe('noteheads')`, which pins all six heads against literals in the
test file. This phase added the membership half: each drum writes into its own part and
leaves the other a full-bar rest. `model.ts` was not touched, and `kit.ts` borrows only the
notation model's vocabulary (`Notehead`, `PartId`), never the renderer's.

---

## Phase 3: The grid takes its labels and row order from the Kit

**User stories**: 8, 9, 29, 31

### What to build

`Grid.svelte` reads row labels and row order from the Kit's published display order and
stops reversing a canonical list of its own accord. Where a drum appears on screen becomes
a decision someone made rather than a side effect of the wire format.

Everything else in the grid stays: beat counting, bar and beat edges, playhead
highlighting, the toggle callback, the aria labels.

### Acceptance criteria

- [ ] The grid imports the Kit for labels and row order and no longer reverses anything.
- [ ] The rendered grid shows the same six rows, in the same order, with the same labels
      and the same aria labels as before this phase.
- [ ] The Seed opens exactly as it does today.
- [ ] `pnpm verify` passes.

---

## Phase 4: Close the seam — audio, the codec's note, and the documentation

**User stories**: 12, 13, 19, 28, 30. Stories 20–22 — adding a tom, a hi-hat foot, a ride
bell — follow from the Kit's shape and the ADR that explains it; they are not exercised by
a throwaway row.

### What to build

Confirm rather than change the audio engine: it keeps building its own Tone nodes, and its
trigger map stays an exhaustive record keyed by `VoiceId` — which now comes from the Kit,
so a row added without a synth is a compile error by construction.

Record the decision: **Kit** joins the domain language in `CONTEXT.md`, under *the loop as
drawn*, with the terms it is not (kit piece, drum map, instrument table). An ADR states why
the notehead and part tables are derived rather than written out, why synth construction
deliberately stayed behind in the audio engine, and why display order is published from the
Kit. The codec gains a comment recording that changing the number of voices changes the
payload width and therefore breaks every existing encoded pattern — accepted breakage, no
migration built.

### Acceptance criteria

- [ ] No synth parameters have moved into the Kit; the audio engine's Tone construction is
      unchanged.
- [ ] The trigger map is typed as an exhaustive record over the Kit-derived `VoiceId`, so a
      new row with no synth cannot compile.
- [ ] The codec carries a comment on payload width and the accepted breakage.
- [ ] `CONTEXT.md` defines **Kit** under the appropriate heading, with its avoid-list.
- [ ] An ADR is added under `docs/adr/` recording the decision.
- [ ] The kit still has exactly six voices; no new voice and no new notehead style shipped.
- [ ] `pnpm verify` and `pnpm verify:visual` both pass clean.
