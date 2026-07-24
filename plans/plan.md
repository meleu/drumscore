# Plan: drumscore

> Source PRD: `plans/PRD.md` — grid-to-notation drum loop sketchpad (static site).
> Durable stack, module boundaries, and notation conventions live in the PRD; this
> file tracks the phased build.

## Durable rules (plan-relevant)

- **Grid**: parameterized dimensions — `voices` (6), `stepsPerBeat` (4), `beatsPerBar` (4), `bars` (2) → 6×32 for v1. No magic constants.
- **Module boundaries**: Pattern model (pure), Notation engine (pure, no VexFlow) → `NotationModel`, Notation renderer (thin, `NotationModel → VexFlow SVG`), Audio engine (thin, Tone.js), Pattern codec (pure), Persistence (thin), Export (thin).
- **Every voice is struck**: each hit → longest note value fitting the gap to the next hit in the *same voice* without outlasting its own beat; remaining silence → rests. No ties, no ringing exception. (Ties were tried in Phase 3 and reversed; see git.)
- **Testing**: pure modules only (notation engine + codec), table-driven Vitest, colocated. Renderer covered by `verify:visual` SVG snapshots. Audio/export/persistence/UI not unit-tested in v1.

---

## Phase 1: Walking skeleton (scaffold + grid→staff pipeline) — **Done**

**User stories**: 1, 2, 4, 23, 24

- [x] `dev`/`build` serve a static bundle (`base: /drumscore/`).
- [x] Grid renders 6×32; clicking a cell toggles it with visible state; dimensions from parameterized config.
- [x] Toggling a cell re-renders the VexFlow SVG staff live.
- [x] Notation engine has zero VexFlow/Tone.js/DOM imports; first Vitest test asserts its output.
- [x] Layout readable on laptop/desktop.

---

## Phase 2: Readable durations (collapse empties into notes + rests) — **Done**

**User stories**: 6

- [x] Each note is the longest value fitting the gap to the next hit (or bar end) without outlasting its own beat.
- [x] Silence before the first hit / after a note renders as rests of correct duration; empty bar → full-bar rest(s).
- [x] Straight 8ths collapse to eighth notes; four-on-the-floor to quarter notes.
- [x] Vitest table: empty bar, four-on-the-floor, straight-8ths, backbeat, syncopated.

---

## Phase 3: Duration policy settled (no ties) — **Done**

**User stories**: 7

Phase 3 originally added ties for ringing voices (crash, open hi-hat). That was
reversed: a held cymbal reads as a sustained note, the very sound Phase 2 removed.
Every voice is now struck with the note-plus-rests treatment and ties are gone from
the engine, model, and renderer.

- [x] All voices, including crash and open hi-hat, get note-plus-rests; no held spans, no ties.

---

## Phase 4: Two voices + noteheads + chords + staff positions — **Done**

**User stories**: 3, 5

- [x] Hands (crash, ride, hi-hats, snare) stems-up as one merged voice; kick stems-down as a separate voice.
- [x] Durations measured per voice (gap to next hit in the *same* voice); each voice filled with its own rests.
- [x] Simultaneous hands hits at a step merge into one chord with per-notehead styles/positions.
- [x] `x` noteheads for cymbals/hi-hats, normal for snare/kick; each notehead carries style + staff position.
- [x] Renderer draws percussion clef, 4/4, no key signature, both voices.
- [x] Vitest asserts chords with correct per-notehead styles/positions for simultaneous multi-voice hits.

---

## Phase 5: Automatic beaming — **Done**

**User stories**: 8

Engine emits beam-group metadata over runs of beamable notes (conventional per-beat
grouping); renderer draws beams instead of flags. Purely additive to `NotationModel`.

- [x] Engine emits beam groups over runs of beamable notes, per-beat grouping.
- [x] Rests and non-beamable values excluded from groups.
- [x] Renderer draws beams from the group metadata.
- [x] Vitest asserts beam grouping for a straight-16ths run and a mixed run with a gap.

---

## Phase 6: Audio playback (synth voices, play/stop, tempo, seamless loop) — **Done**

**User stories**: 9, 10, 11, 12, 14

Audio engine wraps a Tone.js Transport loop from the Pattern: `MembraneSynth` kick,
`NoiseSynth` snare/hi-hats (hats highpass-filtered), `MetalSynth` cymbals/ride; play/stop,
BPM (default 100, 40–240); seamless loop via a looping `Sequence` whose callback reads the
current pattern, so edits/tempo apply live. Transport controls wired into the App shell.

- [x] Play schedules on-cells as synth hits on the correct voices; Stop returns to editing.
- [x] BPM accepts 40–240, defaults to 100, changes speed live.
- [x] Loop repeats with no gap/click; simultaneous hits sound together.
- [x] Editing while stopped, then playing, reflects the current pattern.

---

## Phase 7: Grid playhead during playback

**User stories**: 13

Audio engine emits `currentStep`; Grid highlights the current column, cleared on stop.

- [ ] Currently-playing column is visibly highlighted, advancing in time.
- [ ] Highlight tracks tempo changes; stopping clears it.

---

## Phase 8: Seed default beat + Clear

**User stories**: 15, 16

Add pure `seed` (hi-hats on every 8th, kick on 1 & 3, snare on 2 & 4) and `clear` to
the Pattern model, plus a Clear transport control. Fresh load with nothing saved/shared
opens on the seed.

- [ ] Fresh load (no URL, no autosave) shows the seeded rock beat in grid and staff, playable immediately.
- [ ] Clear empties the grid (staff shows full-bar rests).
- [ ] `seed` and `clear` are pure Pattern-model ops.

---

## Phase 9: Persistence + share link + load precedence (codec)

**User stories**: 17, 18, 19, 20

Pure Pattern codec (`Pattern ↔ compact URL-safe string`, round-trippable, tolerant of
bad input). Persistence: localStorage autosave on change, URL sync on Copy link, and the
precedence resolver (URL → autosave → seed).

- [ ] `decode(encode(p)) === p` for empty, full, seeded, varied-BPM (Vitest).
- [ ] Malformed/absent input falls back cleanly (autosave or seed).
- [ ] Editing autosaves; refresh restores; Copy link encodes exact pattern + tempo.
- [ ] Opening a shared/saved link loads that exact pattern + tempo, taking precedence over autosave and seed.

---

## Phase 10: Export SVG + PNG

**User stories**: 21, 22

Export module: serialize the rendered SVG for download; rasterize to PNG. Wire Export
SVG / Export PNG controls into the transport.

- [ ] Export SVG downloads a crisp scalable copy; Export PNG downloads a raster image.
- [ ] Both reflect the exact notation currently on screen.
