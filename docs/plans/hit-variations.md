# Plan: Hit variations — accents, ghost notes, flams and drags

> Source PRD: [docs/plans/prd/hit-variations.md](prd/hit-variations.md)
> Decisions: [ADR-0012](../adr/0012-a-hit-carries-exactly-one-variation.md),
> [ADR-0013](../adr/0013-the-kit-says-which-variations-a-voice-accepts.md),
> [ADR-0014](../adr/0014-an-accent-is-written-once-per-chord.md)

## Architectural decisions

Durable across every phase. Where this section and an ADR disagree, the ADR is the record.

- **Key model — `Hit`.** A cell is one of `off | plain | accent | ghost | flam | drag`. One
  value, never a combination; a `Pattern`'s rows become rows of `Hit` rather than of `boolean`.
  The full union lands in phase 1 even though phases 3 and 5 are what make its later members
  reachable — a union that grows a member per phase would churn the codec and every exhaustive
  switch five times.

- **The Kit owns the per-voice subset.** A row states which variations beyond `plain` its voice
  accepts, and publishes the predicate everyone else asks. Kick: accent. Snare: accent, ghost,
  flam, drag. Closed hi-hat, open hi-hat, ride: accent. Crash: none. The rows are written once,
  in phase 1, complete — a phase that adds a variation to the union does not also edit the Kit.

- **Refusal is uniform and silent.** Setting a variation a voice does not accept returns the
  pattern unchanged, the way an out-of-range step already does. Decoding one rejects the whole
  string, the way an unsupported grid already does.

- **Wire format — one nibble per cell, two per byte, nothing straddling a byte.** The format
  version goes to 2 in phase 1 and stays there for the rest of the plan; phases 3 and 5 make
  previously-unused nibble values reachable without changing the layout. No v1 reader.

- **Notation model — the fact sits on the object it is drawn against.** Ghosting on the
  notehead; accenting and the grace group on the note. The engine ORs accents across the hits
  at a step and emits one mark. The renderer derives only which side of the staff the accent
  goes, from the part's stem direction.

- **The grace group spells itself out.** Note values, beamed or not, slashed or not, all stated
  in the model so the convention is asserted in Node rather than living inside the VexFlow
  adapter.

- **One table answers both "what note values exist" and "which grid resolutions are writable".**
  Adding the thirty-second is therefore what unlocks thirty-second grids. That is phase 4's
  whole point, and it is why it comes before the drags that need it.

- **Layering is unchanged.** No state transition leaves the sketchpad seam; no musical decision
  enters the renderer; the audio engine gains no per-hit envelope or filter, only a velocity.

- **Interaction.** Left-click stays a two-state toggle — `off → plain`, anything → `off`. The
  menu is the only way to reach a variation, opens on filled and empty cells alike, lists
  `plain` followed by that voice's variations with the current one marked, and is built on the
  platform popover so top-layer stacking, Escape and outside-click are not hand-written.

- **Verification.** Engine decisions are asserted as plain data without a browser. Drawn output
  is pinned by the existing browser-based visual check. Every phase that changes what is drawn
  adds a fixture; every phase that changes the wire format re-pins the round-trip.

---

## Phase 1: Accent, drawn and written

**User stories**: 1–14, 17–19, 20, 21, 28, 30, 39–42, 44–48, 49–53

### What to build

The cell stops being a boolean and starts carrying a variation, and `accent` is the first one a
user can reach. Right-clicking a cell — or reaching it from the keyboard — opens a menu built
from that voice's own declaration; picking `Accent` sets the cell outright, whether or not it
was already struck. The grid draws a `>` on the cell, the staff draws an accent mark above the
stem (below, for the feet), and the share link and autosave carry it.

This is the phase that changes everything downstream of the pattern, so it lands the full `Hit`
union, the complete per-voice Kit table, the nibble encoding and the format bump — even though
only `plain` and `accent` are reachable through the interface when it ships. It does not change
what anything sounds like: an accented hit still plays at the volume it plays today.

Breaking existing share links and autosaves happens here, once.

### Acceptance criteria

- [x] A cell holds one of six values; combining two of them does not typecheck
- [x] Left-click sets an empty cell to `plain` and clears any cell whatever it holds
- [x] The setter refuses a variation the voice does not accept by returning the same pattern,
      and the sketchpad treats that as no change — no autosave, no sequence rebuild
- [x] Each Kit row declares its accepted variations; nothing else in the codebase restates them
- [x] Right-click opens the menu on filled and empty cells alike, positioned by the cell
- [x] The menu lists `plain` plus that voice's variations, marks the current one, and offers
      nothing the voice cannot play — the crash's menu has one item and still opens
- [x] The menu is reachable and operable from the keyboard, focus returns to the cell on choose
      or dismiss, and the cell's accessible label names its variation
- [x] Escape and an outside click dismiss the menu
- [x] An accented cell is distinguishable from a plain one without relying on colour, at the
      grid's real cell size
- [x] The staff draws one accent above the stem for hands, below for feet, with note values,
      rests, dots and beams identical to what it draws today
- [x] An accented snare sharing a step with a plain hi-hat draws one accent mark
- [x] A pattern with accents round-trips through encode/decode unchanged
- [x] The format version is 2; a v1 string decodes to `null` and the app falls back rather than
      breaking
- [x] A decoded cell holding a variation its voice does not accept rejects the whole string
- [x] Engine tests assert which notes carry accents as plain data, without a browser
- [x] Visual fixtures cover an accented hand stroke, an accented foot stroke, and an accented
      drum sharing a step with an unaccented cymbal
- [x] `CONTEXT.md`'s **Hit** entry no longer says a hit is binary

---

## Phase 2: Velocity

**User stories**: 31, 38

### What to build

An accent becomes audible. Each voice's trigger takes a velocity alongside its time, and the
sequencer passes one derived from the cell's variation: plain around four fifths, accent full.
Velocity is the only mechanism — no envelope, filter or synth parameter varies per hit, so the
audio engine stays the thin adapter it is.

The values are starting values, held in one place, expected to be tuned by ear.

### Acceptance criteria

- [x] Every voice's trigger accepts a velocity and applies it
- [x] An accented hit is audibly louder than a plain one on every voice that accepts an accent
- [x] The three loudnesses are named constants in one place, not scattered literals
- [x] Changing a cell's variation while the loop runs is heard on the next pass
- [x] The playhead still marks the step, unaffected

---

## Phase 3: Ghost

**User stories**: 15, 22, 23, 32

### What to build

`ghost` becomes reachable on the snare — the only voice whose row accepts it. The menu offers
it because the row does, with no edit to the menu. The grid draws a dimmer, inset fill; the
staff wraps that one notehead in parentheses, leaving a plain hi-hat on the same stem
untouched; playback drops it to roughly a third.

The ghost is quieter and nothing else — no duller timbre.

### Acceptance criteria

- [x] The snare's menu offers Ghost; no other voice's does
- [x] A ghosted cell reads as quieter than a plain one and is not confusable with an accent
- [x] Only the ghosted voice's notehead is parenthesised; others sharing the stem are not
- [x] Two ghosted voices at one step draw two separate parenthesis pairs
- [x] Note values, rests, dots and beams are unchanged by ghosting
- [x] Ghosted hits sound quieter than plain ones
- [x] Engine tests assert which noteheads are parenthesised, without a browser
- [x] A visual fixture covers a ghosted snare under a plain hi-hat

---

## Phase 4: The thirty-second note value

**User stories**: 25 (prerequisite), 28

### What to build

The note-value vocabulary gains the thirty-second, and the beaming rule widens to include it.
Because the same table that lists note values is the table that decides which grid resolutions
the staff can write, thirty-second-resolution grids become writable as a consequence — which
ADR-0011 predicted in as many words.

Nothing else changes. No interface offers that resolution, so it stays reachable only through a
crafted link, and the roadmap's "32nd notes" item stays unticked. This is its own phase so that
the unlock is tested as the roadmap item it is, rather than smuggled in underneath the drags
that need it.

### Acceptance criteria

- [x] The thirty-second is a note value and the renderer maps it to the right duration code
- [x] It beams like the eighth and sixteenth do
- [x] Adding it changes nothing about how a sixteenth-resolution grid is written — the value is
      inert at today's resolution and a test pins that
- [x] A thirty-second-resolution grid is accepted rather than refused, and writes correctly
- [x] A visual fixture covers a thirty-second-resolution grid
- [x] No control anywhere offers to change the resolution

---

## Phase 5: Flam and drag

**User stories**: 16, 24, 26, 27, 29, 33–37, 43

### What to build

`flam` and `drag` become reachable on the snare. The grid carries one and two small pips on the
cell's leading edge, echoing where the grace notes sit. The notation model gains a grace group
on the note that states its own contents — a flam is one unslashed eighth, a drag is two
unslashed thirty-seconds, beamed, neither slurred — and the renderer draws that group before
the chord, on the voice's own line, without disturbing the alignment between the hand and foot
parts.

Playback schedules the grace strikes quietly, a fixed number of milliseconds before the main
hit rather than a fraction of the step, so a flam is a flam at every tempo. The offsets are
clamped so a grace on the loop's first step is never scheduled in the past.

### Acceptance criteria

- [x] The snare's menu offers Flam and Drag; no other voice's does
- [x] A flam and a drag are distinguishable from each other, and from an accent and a ghost, on
      the grid at its real cell size
- [x] A flam draws one grace note, a drag two beamed grace notes, both unslashed and unslurred
- [x] The grace notes sit on the struck voice's own line
- [x] The grace group's values, beaming and slashing are stated in the model and asserted
      without a browser
- [x] Grace notes leave note values, rests, dots, beams and hand/foot alignment untouched
- [x] A flam sounds as one quiet strike before the main hit, a drag as two
- [x] The gesture's timing is identical at 40 BPM and at 240 BPM
- [x] A flam on the loop's first step sounds correctly and schedules nothing in the past
- [x] The playhead still marks the step, not the grace
- [x] Visual fixtures cover a flam and a drag
- [x] The README roadmap's "flams and drags" and "dynamics: accents and ghost notes" are ticked;
      "32nd notes" is not
