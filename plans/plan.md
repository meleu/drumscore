# Plan: drumscore

> Source PRD: `docs/PRD.md` — grid-to-notation drum loop sketchpad (static site)

## Architectural decisions

Durable decisions that apply across all phases:

- **Stack**: Vite + TypeScript + Svelte. Audio via Tone.js. Notation via VexFlow (SVG backend). Vitest for tests.
- **Delivery**: Fully static, no backend, no accounts. Deployed to GitHub Pages via GitHub Actions on push to `main`, with Vite `base` set to `/drumscore/`.
- **Grid dimensions (parameterized, no magic constants)**: `voices` (6), `stepsPerBeat` (4 = 16th), `beatsPerBar` (4), `bars` (2) → 6 rows × 32 columns for v1. All derived from the data model so later expansion needs no rewrite.
- **Voices (fixed order)**: Kick, Snare, Closed Hi-hat, Open Hi-hat, Crash, Ride.
- **Cells**: binary on/off, uniform velocity. Simultaneous hits across voices supported.
- **Module boundaries** (the load-bearing decision):
  - **Pattern model** (pure) — types + single source of truth for the grid + BPM; ops: `toggle`, `clear`, `seed`.
  - **Notation engine** (pure, no VexFlow) — `Pattern → NotationModel`. Emits an abstract IR: two rhythmic voices (stems-up "hands" = crash/ride/hi-hats/snare merged into chords; stems-down "feet" = kick). Each note's duration = gap until next hit; leading gaps → rests; durations crossing quarter-note beats or not mapping to a single note value → tied notes; runs grouped for beaming; each notehead carries style (`x` vs normal) and staff position.
  - **Notation renderer** (thin) — `NotationModel → VexFlow SVG`. No musical logic.
  - **Audio engine** (thin) — wraps Tone.js Transport loop; play/stop, BPM; synth voices (`MembraneSynth` kick, `NoiseSynth` snare/hi-hats, `MetalSynth` cymbals/ride); emits `currentStep`.
  - **Pattern codec** (pure) — `Pattern ↔ compact URL-safe string`, round-trippable.
  - **Persistence** (thin) — localStorage autosave + URL sync on copy-link; delegates to codec.
  - **Export** (thin) — serialize rendered SVG, rasterize to PNG.
- **Notation conventions (v1, non-configurable)**: percussion clef, 4/4, no key signature. Hands stems-up (single merged voice, chords); kick stems-down (separate voice). `x` noteheads for cymbals/hi-hats, normal for snare/kick. Split-and-tie across quarter-note beats.
- **Load precedence**: URL-encoded pattern → else localStorage autosave → else seeded default beat (hi-hats on every 8th, kick on 1 & 3, snare on 2 & 4).
- **BPM**: default 100, range 40–240.
- **Layout**: desktop-first, responsive-friendly (not touch-tuned).
- **Testing**: pure modules only (notation engine + codec), table-driven Vitest, colocated. Renderer/audio/export/persistence/UI not unit-tested in v1.

---

## Phase 1: Walking skeleton (scaffold + deploy + grid→staff pipeline)

**User stories**: 1, 2, 4, 23, 24

### What to build

Stand up the Vite + TS + Svelte project with Vitest wired. Build the thinnest end-to-end pipeline that touches every layer: the **Pattern model** (parameterized dimensions, `toggle`) as the single source of truth; a **Grid** component (6 × 32) whose cells toggle on click; a **trivial Notation engine** (`Pattern → NotationModel` where each hit is a standalone 16th note, one voice, one notehead style, no merging/rests/ties/beams); a **Notation renderer** drawing that model to a VexFlow SVG in a **Staff container**; and an **App shell** with a comfortable desktop layout. Toggling any cell updates the staff live. Deploy so the URL loads fast and static.

### Acceptance criteria

- [x] `npm run dev` serves the app; `npm run build` produces a static bundle with `base: /drumscore/`.
- [x] Grid renders 6 rows × 32 columns; clicking a cell toggles it on/off with visible state.
- [x] Grid dimensions come from parameterized model config — no literal `16`/`32` in logic.
- [x] Toggling a cell re-renders the VexFlow SVG staff live (even if notation is crude 16ths).
- [x] Notation engine has zero imports from VexFlow/Tone.js/DOM; a first Vitest test asserts its output for a simple pattern.
- [x] Layout is readable on a laptop/desktop screen.

---

## Phase 2: Readable durations (collapse empties into longer notes + rests)

**User stories**: 6

### What to build

Grow the notation engine so consecutive empty steps are absorbed into the preceding note's duration instead of a wall of 16ths. Each note's duration equals the gap until the next hit in that voice; leading gaps (before the first hit, and a fully empty bar) become rests. A straight-8ths line collapses to eighth notes, four-on-the-floor to quarter notes, an empty bar to full-bar rests. Still a single melodic voice (two-voice split comes in Phase 4). Table-driven Vitest cases assert the resulting durations and rests.

### Acceptance criteria

- [x] Duration of each note = number of steps until the next hit (or bar/pattern end).
- [x] Steps before the first hit render as rest(s) of correct duration; a fully empty bar renders as full-bar rest(s).
- [x] Straight 8ths collapse to eighth notes (not 16th + 16th-rest); four-on-the-floor collapses to quarter notes.
- [x] Vitest table covers: empty bar, four-on-the-floor, straight-8ths, backbeat, a syncopated pattern — asserting durations and rests.
- [ ] Staff visibly reflects the collapsed durations. _(renderer draws rests and collapsed values; not yet confirmed on screen)_

---

## Phase 3: Ties (beat-boundary splits, non-mappable durations)

**User stories**: 7

### What to build

Extend the engine's duration logic so a gap that crosses a quarter-note beat boundary is split and tied, and any duration that doesn't map to a single note value (e.g. a dotted-ish span of 3 or 5 or 7 sixteenths) is written as tied notes of legal values. The `NotationModel` carries tie relationships between the split notes. Table-driven tests assert the tie groups.

### Acceptance criteria

- [ ] A note whose duration spans across a quarter-note beat boundary is split into tied notes at the boundary.
- [ ] A duration not expressible as one note value is decomposed into legal values joined by ties.
- [ ] `NotationModel` explicitly represents ties between the resulting notes.
- [ ] Vitest cases assert tie groups for at least: a hit sustained across a beat boundary, and a 3- and 5-sixteenth duration.
- [ ] Renderer draws the ties on the staff.

---

## Phase 4: Two voices + noteheads + chords + staff positions

**User stories**: 3, 5

### What to build

Split the engine output into the two conventional rhythmic voices: **hands** (crash, ride, hi-hats, snare) stems-up, merged so simultaneous hits at the same step become a single chord; and **feet** (kick) stems-down as a separate voice. Each notehead carries its style (`x` for cymbals/hi-hats, normal for snare/kick) and its staff position per percussion convention. The renderer draws percussion clef, both voices, and per-notehead styles. This is where the output first looks like real drum sheet music.

### Acceptance criteria

- [ ] Hands voice is stems-up; kick is a separate stems-down voice.
- [ ] Simultaneous hands hits at one step merge into a single chord with per-notehead styles/positions.
- [ ] Cymbals and hi-hats use `x` noteheads; snare and kick use normal noteheads.
- [ ] Each notehead in `NotationModel` carries style + staff position.
- [ ] Renderer draws percussion clef, 4/4, no key signature, both voices.
- [ ] Vitest cases assert chords with correct per-notehead styles and staff positions for simultaneous multi-voice hits.

---

## Phase 5: Automatic beaming

**User stories**: 8

### What to build

Group runs of beamable notes so the engine emits beam groups (conventional per-beat grouping), and the renderer draws beams instead of individual flags. Purely an addition to the `NotationModel` (beam-group metadata) plus renderer handling.

### Acceptance criteria

- [ ] Engine emits beam groups over runs of beamable notes following conventional per-beat grouping.
- [ ] Rests and note values that shouldn't beam are excluded from groups.
- [ ] Renderer draws beams from the group metadata.
- [ ] Vitest cases assert beam grouping for a straight-16ths run and a mixed run with a gap.

---

## Phase 6: Audio playback (synth voices, play/stop, tempo, seamless loop)

**User stories**: 9, 10, 11, 12, 14

### What to build

Add the **Audio engine** wrapping Tone.js: build a Transport loop from the Pattern using synthesized voices (`MembraneSynth` kick, `NoiseSynth` snare/hi-hats, `MetalSynth` cymbals/ride), with play/stop and a BPM control (default 100, range 40–240). The loop repeats seamlessly. Wire **Transport controls** (play/stop, BPM) into the App shell.

### Acceptance criteria

- [ ] Play schedules all on-cells as synthesized hits on the correct voices; Stop halts playback and returns to editing.
- [ ] BPM control accepts 40–240, defaults to 100, and changes playback speed live.
- [ ] The loop repeats seamlessly with no gap/click at the loop point.
- [ ] Simultaneous hits sound together.
- [ ] Editing the grid while stopped, then playing, reflects the current pattern.

---

## Phase 7: Grid playhead during playback

**User stories**: 13

### What to build

Have the audio engine emit `currentStep` events during playback and highlight the corresponding grid column in the Grid component, so the user can follow along. Highlight clears on stop.

### Acceptance criteria

- [ ] During playback the currently-playing column is visibly highlighted, advancing in time.
- [ ] The highlight tracks tempo changes.
- [ ] Stopping clears the highlight.

---

## Phase 8: Seed default beat + Clear

**User stories**: 15, 16

### What to build

Add `seed` (basic rock beat: hi-hats on every 8th, kick on 1 & 3, snare on 2 & 4) and `clear` to the Pattern model, and a **Clear** control in the transport. On a fresh load with no saved/shared pattern, the app opens with the seed already loaded so first-time visitors immediately see and can play the grid-to-notation behavior.

### Acceptance criteria

- [ ] Fresh load (no URL pattern, no autosave) shows the seeded rock beat in the grid and staff.
- [ ] The seed is playable immediately.
- [ ] Clear empties the grid (and staff shows full-bar rests).
- [ ] `seed` and `clear` are pure Pattern-model ops.

---

## Phase 9: Persistence + share link + load precedence (codec)

**User stories**: 17, 18, 19, 20

### What to build

Build the pure **Pattern codec** (`Pattern ↔ compact URL-safe string`, round-trippable, tolerant of malformed/absent input) with round-trip Vitest tests. Add **Persistence**: localStorage autosave of the working pattern on change, URL sync on an explicit **Copy link** control, and the load-precedence resolver (URL-encoded pattern → localStorage autosave → seed). Opening a shared link loads that exact pattern and tempo.

### Acceptance criteria

- [ ] `decode(encode(p)) === p` for empty, full, seeded, and varied-BPM patterns (Vitest).
- [ ] Malformed/absent encoded input falls back cleanly (to autosave or seed).
- [ ] Editing autosaves to localStorage; refresh restores the working pattern.
- [ ] Copy link produces a URL encoding the exact pattern + tempo.
- [ ] Opening a shared/saved link loads that exact pattern + tempo and takes precedence over both autosave and seed.

---

## Phase 10: Export SVG + PNG

**User stories**: 21, 22

### What to build

Add the **Export** module: serialize the rendered notation SVG for an SVG download, and rasterize it to a PNG for download. Wire **Export SVG** and **Export PNG** controls into the transport.

### Acceptance criteria

- [ ] Export SVG downloads a crisp, scalable copy of the current notation.
- [ ] Export PNG downloads a raster image of the current notation.
- [ ] Both reflect the exact notation currently on screen.
