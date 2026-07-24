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

## Phase 7: Grid playhead during playback — **Done**

**User stories**: 13

Audio engine emits `currentStep`; Grid highlights the current column, cleared on stop.

- [x] Currently-playing column is visibly highlighted, advancing in time.
- [x] Highlight tracks tempo changes; stopping clears it.

---

## Phase 8: Seed default beat + Clear — **Done**

**User stories**: 15, 16

Add pure `seed` (hi-hats on every 8th, kick on 1 & 3, snare on 2 & 4) and `clear` to
the Pattern model, plus a Clear transport control. Fresh load with nothing saved/shared
opens on the seed. Seed layout is derived from grid dimensions (no hard-coded step
numbers) and locked down by colocated Vitest cases.

- [x] Fresh load (no URL, no autosave) shows the seeded rock beat in grid and staff, playable immediately.
- [x] Clear empties the grid (staff shows full-bar rests).
- [x] `seed` and `clear` are pure Pattern-model ops.

---

## Phase 9: Persistence + share link + load precedence (codec) — **Done**

**User stories**: 17, 18, 19, 20

Pure Pattern codec (`Pattern ↔ compact URL-safe string`, round-trippable, tolerant of
bad input): a byte layout of `[version, dims…, bpm, packed cells]` behind a hand-rolled
base64url (no `Buffer`/`btoa`, so it runs in browser and Node alike). Persistence (thin):
localStorage autosave on every edit, `?p=` share URL on Copy link, and the precedence
resolver (URL → autosave → seed). Transport gains a Copy link button with transient
"Copied!" feedback.

- [x] `decode(encode(p)) === p` for empty, full, seeded, varied-BPM (Vitest).
- [x] Malformed/absent input falls back cleanly (autosave or seed).
- [x] Editing autosaves; refresh restores; Copy link encodes exact pattern + tempo.
- [x] Opening a shared/saved link loads that exact pattern + tempo, taking precedence over autosave and seed.

---

## Phase 10: Export SVG + PNG

**User stories**: 21, 22

Export module: serialize the rendered SVG for download; rasterize to PNG. Wire Export
SVG / Export PNG controls into the transport.

- [ ] Export SVG downloads a crisp scalable copy; Export PNG downloads a raster image.
- [ ] Both reflect the exact notation currently on screen.

---

## Phase 11: Bundle notation fonts locally (offline-capable static site)

**User stories**: 24 (reinforces "fast static page, no wait"); supports the PRD's
"fully static, no backend" goal.

VexFlow loads its music fonts lazily from a CDN (`Font.HOST_URL` →
`https://cdn.jsdelivr.net/npm/@vexflow-fonts/`), so the app makes a runtime
third-party request and the staff cannot render before that request lands. The
Staff component already preloads the configured fonts (Bravura + Academico) and
holds the first draw until they resolve, but the bytes still come from jsdelivr.
This phase ships those fonts inside the bundle so the app renders offline with no
external dependency, and no first-paint dependence on network latency.

- [ ] The two configured fonts (Bravura, Academico) are vendored into the repo/bundle (e.g. from the `@vexflow-fonts` packages) and served from the app's own origin under `base: /drumscore/`.
- [ ] VexFlow resolves fonts to the local assets, not the CDN (override `Font.HOST_URL` or register the `FontFace`s ourselves before first render); no request to `cdn.jsdelivr.net` occurs at runtime.
- [ ] `pnpm build` output loads and renders the staff correctly with the network offline / blocked.
- [ ] Font handling stays isolated to the renderer/Staff boundary; the pure modules remain untouched.

**Unresolved questions**
- Vendor the woff2 via an npm dependency (`@vexflow-fonts/*`) resolved through Vite's asset pipeline, or commit the files directly under a static assets dir? (Leaning: npm dep + Vite `?url` import, to keep licensing/provenance clear and updates tractable.)
- Confirm the license terms for Bravura (SIL OFL) and Academico permit redistribution in the bundle — expected fine, worth noting in the repo.
