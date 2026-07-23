# drumscore — Product Requirements Document

## Problem Statement

I want to sketch drum loops quickly and immediately see them written out as real
percussion notation. Existing options force a trade-off: drum-machine grids let me
build a groove fast but never show me proper sheet music, while notation software
shows me sheet music but is slow and clumsy for just trying out a beat. When I have
a pattern in my head, I have no low-friction way to both *hear* it and *see it as an
actual music sheet* at the same time — the sheet I'd bring to a kit or share with
another drummer.

## Solution

A browser app where I build a drum loop on a step-sequencer grid and instantly see
it rendered as standard percussion notation, with audio playback. I toggle cells on
a 6-voice × 2-bar grid; the staff below updates live to show the corresponding sheet
music using real drum-notation conventions. I can play the loop back (synthesized
sounds), watch a playhead sweep the grid, adjust the tempo, share the pattern as a
link, and export the notation as an image to print or practice from. The whole thing
is a static site with no accounts and no backend.

## User Stories

1. As a drummer, I want to toggle a hit on/off in any grid cell, so that I can build
   a pattern quickly.
2. As a drummer, I want the grid laid out as 6 voices (Kick, Snare, Closed Hi-hat,
   Open Hi-hat, Crash, Ride) across 2 bars of 4/4 at 16th-note resolution, so that I
   can express common drum loops.
3. As a drummer, I want to place hits on multiple voices at the same step, so that I
   can notate simultaneous events (e.g. kick + hi-hat).
4. As a drummer, I want the staff below the grid to update the instant I change a
   cell, so that I immediately see how my pattern looks as sheet music.
5. As a drummer, I want the notation to follow real percussion conventions
   (percussion clef, `x` noteheads for cymbals/hi-hats, normal noteheads for
   snare/kick, hands stems-up and kick stems-down), so that the output looks like an
   actual music sheet.
6. As a drummer, I want consecutive empty steps to be absorbed into longer note
   durations rather than shown as a wall of sixteenth notes and rests, so that the
   notation is readable.
7. As a drummer, I want durations that cross a beat boundary or don't map to a single
   note value to be written as tied notes, so that the rhythm reads correctly.
8. As a drummer, I want runs of hits to be automatically beamed, so that the notation
   is clean and conventional.
9. As a drummer, I want to press play and hear my loop, so that I can judge the feel,
   not just the look.
10. As a drummer, I want the loop to play back synthesized drum sounds, so that it
    works instantly with no samples to load.
11. As a drummer, I want to stop playback, so that I can go back to editing.
12. As a drummer, I want to set the tempo in BPM (default 100, range 40–240), so that
    I can audition the groove at the right speed.
13. As a drummer, I want a playhead that highlights the currently-playing column on
    the grid during playback, so that I can follow along where I'm editing.
14. As a drummer, I want the loop to repeat seamlessly while playing, so that I can
    listen to it cycle.
15. As a drummer, I want a "Clear" action that empties the grid, so that I can start
    a new pattern from scratch.
16. As a first-time visitor, I want the app to open with a recognizable default beat
    already loaded, so that I immediately see the grid-to-notation behavior and have
    something to play.
17. As a drummer, I want my current pattern to be saved automatically, so that I don't
    lose my work if I close or refresh the tab.
18. As a drummer, I want to copy a link that encodes my exact pattern and tempo, so
    that I can share it or bookmark it.
19. As a recipient of a shared link, I want opening it to load that exact pattern and
    tempo, so that I see what was shared.
20. As a drummer, I want a shared/saved pattern to take precedence over the default
    beat on load, so that my link shows my pattern, not the seed.
21. As a drummer, I want to export the notation as an SVG, so that I have a crisp,
    scalable copy of the sheet.
22. As a drummer, I want to export the notation as a PNG, so that I can easily paste
    or share an image of the sheet.
23. As a user on a laptop/desktop, I want the layout to be comfortable on my screen,
    so that the grid and staff are easy to read and use.
24. As a returning user, I want the app to load fast as a static page, so that there's
    no wait and no sign-in.

## Implementation Decisions

**Stack & delivery**
- Vite + TypeScript + Svelte.
- Audio via Tone.js.
- Notation via VexFlow, rendered through its **SVG backend** (crisp output and cheap
  image export).
- Deployed to GitHub Pages via a GitHub Actions workflow on push to `main`, with Vite
  `base` set to `/drumscore/`.
- Fully static: no backend, no accounts.

**Musical scope (v1)**
- Fixed 4/4, 16th-note resolution, 2 bars → grid is 6 rows × 32 columns.
- Resolution, meter, and bar count are **parameterized in the data model** (no magic
  `16`/`32` constants) to allow later expansion without a rewrite.
- 6 voices: Kick, Snare, Closed Hi-hat, Open Hi-hat, Crash, Ride.
- Cells are **binary** (on/off); uniform velocity.
- Simultaneous hits across voices are supported.

**Modules — pure/deep (no DOM, no VexFlow, no Tone.js):**
- **Pattern model** — types and the single source of truth for the grid (voices, grid
  dimensions, BPM), plus pure operations: `toggle`, `clear`, `seed` (default beat).
- **Pattern codec** — encodes/decodes a Pattern ↔ a compact URL-safe string.
  Round-trippable; used for both share links and (as the serialization format) URL
  sync.
- **Notation engine** — the core deep module. Pure function `Pattern → NotationModel`,
  with **no VexFlow dependency**. It outputs an abstract intermediate representation:
  two rhythmic voices (stems-up "hands" = crash/ride/hi-hats/snare merged into chords;
  stems-down "feet" = kick), where each note's duration equals the gap until the next
  hit in that voice, leading gaps become rests, durations crossing quarter-note beat
  boundaries or not mapping to a single note value become tied notes, runs are grouped
  for beaming, and each notehead carries its style (`x` vs normal) and staff position.

**Modules — thin adapters / glue:**
- **Notation renderer** — translates `NotationModel → VexFlow SVG` draw calls. Contains
  no musical logic.
- **Audio engine** — wraps Tone.js: builds a Transport loop from a Pattern, handles
  play/stop and BPM, uses synthesized voices (`MembraneSynth` for kick, `NoiseSynth`
  for snare/hi-hats, `MetalSynth` for cymbals/ride), and emits `currentStep` events to
  drive the grid playhead.
- **Export** — serializes the rendered notation SVG and rasterizes it to PNG.
- **Persistence** — localStorage autosave of the working pattern and URL sync on
  explicit "copy link"; delegates encoding/decoding to the Pattern codec.

**UI (Svelte components):**
- App shell; Grid (with playhead highlight); Staff container (hosts the VexFlow SVG);
  Transport controls (play/stop, BPM, Clear, Copy link, Export SVG, Export PNG).

**Notation conventions (v1, non-configurable):**
- Percussion clef, 4/4 time signature, no key signature.
- Hands (crash, ride, hi-hats, snare) render stems-up as a single merged voice with
  chords; kick renders stems-down as a separate voice.
- Cymbals and hi-hats use `x` noteheads; snare and kick use normal noteheads.
- Beat-boundary/tie handling follows standard readable behavior (split and tie across
  quarter-note beats) — implemented per conventional rules.

**Load precedence:** URL-encoded pattern (if present) → else localStorage autosave (if
present) → else the seeded default beat (a basic rock beat: hi-hats on every 8th, kick
on 1 & 3, snare on 2 & 4).

## Testing Decisions

Good tests here exercise **external behavior through a stable interface** — given an
input pattern, assert the produced output — rather than internal steps. The two pure
modules are the test targets because they carry all the risk and need no browser:

- **Notation engine** (`Pattern → NotationModel`): table-driven Vitest cases over
  known patterns, asserting the resulting notation model. Coverage includes: an empty
  bar (full-bar rests), four-on-the-floor, a straight-8ths hi-hat line collapsing to
  eighth notes rather than sixteenths-plus-rests, a backbeat snare on 2 & 4,
  syncopated hits, gaps that cross a quarter-note beat boundary (asserting ties),
  durations that don't map to a single note value (asserting ties), simultaneous hits
  across voices (asserting chords with correct per-notehead styles and staff
  positions), and correct beam grouping. Assertions target durations, ties, notehead
  styles, staff positions, and beam groups.
- **Pattern codec** (`Pattern ↔ string`): round-trip tests asserting
  `decode(encode(p)) === p` across representative patterns (empty, full, seeded,
  varied BPM), plus tolerance of malformed/absent input (falls back cleanly).

Not unit-tested in v1 (visual/timing/DOM, low return for a solo static app): notation
renderer, audio engine, export, persistence wiring, and Svelte UI components.

Prior art: none — this is a greenfield repo. The Vitest + Vite integration is the
conventional setup; tests colocate with the pure modules.

## Out of Scope

Deferred to a later version:
- Additional voices (toms).
- Triplets, other resolutions, odd/other time signatures, and more than 2 bars (the
  data model is parameterized to allow these later).
- Dynamics: accented, normal, and ghost notes (and their accent glyphs / velocity).
- A playhead on the staff (v1 highlights the grid only; the staff is static).
- MIDI and MusicXML export.
- Per-voice mute / solo / volume controls.
- Sampled/acoustic drum kits (v1 is synthesized only).
- A named, multi-pattern library and any backend/accounts.
- Mobile/touch optimization (v1 is desktop-first; responsive-friendly but not tuned
  for touch).

## Further Notes

- The **Notation engine** is the highest-value and highest-risk component and the
  primary reason to use VexFlow rather than drawing dots; it is worth prototyping
  first to de-risk the grid-to-notation translation. Keeping VexFlow entirely out of
  it (it emits an abstract model consumed by the separate renderer) is deliberate, so
  the hard logic stays pure and testable.
- Because pattern state is tiny (6 voices × 32 steps of on/off plus BPM), the codec's
  output is short enough to live comfortably in a URL, which makes "copy link" serve as
  both sharing and portable persistence.
- Synthesized voices keep the app a single static bundle with no asset pipeline or
  licensing concerns; swapping in a sampled kit later is an isolated change behind the
  audio engine's voice abstraction.
- Confirmed defaults: BPM default 100, range 40–240; desktop-first responsive layout.
