# Plan: drumscore

> Source PRD: [PRD.md](./PRD.md) — grid-to-notation drum loop sketchpad (static site).
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

## Phase 10: Export SVG + PNG — **Done**

**User stories**: 21, 22

Export module (thin, browser-only): clones the live staff `<svg>`, embeds the
Bravura/Academico music fonts as base64 `@font-face` data URIs (VexFlow draws glyphs as
`<text>`, so an un-embedded file renders every notehead/clef/rest blank), and paints a
white background to match the on-screen paper. SVG downloads that self-contained markup;
PNG rasterizes it through an `<img>` onto a 2×-scaled canvas. Staff exposes its `<svg>`
via a bindable prop; App wires Export SVG / Export PNG controls (disabled until first
draw) into the transport. Font bytes come from `Font.getURLForFont`, so Phase 11's local
vendoring is a drop-in.

- [x] Export SVG downloads a crisp scalable copy; Export PNG downloads a raster image.
- [x] Both reflect the exact notation currently on screen.

---

## Phase 11: Bundle notation fonts locally (offline-capable static site) — **Done**

**User stories**: 24 (reinforces "fast static page, no wait"); supports the PRD's
"fully static, no backend" goal.

VexFlow loads its music fonts lazily from a CDN (`Font.HOST_URL` →
`https://cdn.jsdelivr.net/npm/@vexflow-fonts/`), so the app makes a runtime
third-party request and the staff cannot render before that request lands. The
Staff component already preloads the configured fonts (Bravura + Academico) and
holds the first draw until they resolve, but the bytes still come from jsdelivr.
This phase ships those fonts inside the bundle so the app renders offline with no
external dependency, and no first-paint dependence on network latency.

Vendoring is via the `@vexflow-fonts/*` npm packages resolved through Vite's asset
pipeline (`?url` import), not files committed by hand: the packages carry
`LICENSE.txt` and a `README.txt` recording the exact upstream version, so provenance
and the notice obligation below come along with the dependency instead of relying on
someone remembering to copy them.

New module: `src/lib/notation/fonts.ts` — the one place that knows where the fonts
come from. It maps family → asset URL, empties `Font.HOST_URL` and replaces
`Font.FILES` with that map (so no CDN path survives), calls `setFonts`, and exports
`notationFontsReady` for Staff and the visual page to await before their first draw.
Export embeds from the same map instead of `Font.getURLForFont`, so its bytes are the
bytes we ship and it no longer depends on VexFlow's host configuration.

**Correction to the premise above:** the CDN fetch was real but redundant, and the
bundle was already carrying the fonts. `import ... from 'vexflow'` pulls an entry
point that inlines *six* fonts as base64 data URIs and registers them at import time —
~790KB of the around 1.4MB `dist/`, four of them (Gonville, Petaluma, Petaluma Script,
Academico Bold) never drawn here. So the app already rendered offline; what it did not
do was render *small*, and `Staff`'s `loadFonts` preload then re-fetched Bravura and
Academico from jsdelivr on top. The fix is to import `vexflow/core` (same library, no
bundled fonts) everywhere and register only our two. Bundle JS therefore **shrank**
1416KB → 634KB; with the 270KB of woff2 assets, `dist/` went from around 1.4MB → ~912KB. The
"+19%" projection in the size note below was wrong in sign — measured, this is −35%.

- [x] The two configured fonts (Bravura, Academico) are vendored from the `@vexflow-fonts` packages and served from the app's own origin under `base: /drumscore/`.
- [x] Regular weights only: `bravura.woff2` and `academico.woff2`. `academico-bold.woff2` is dropped from the bundle entirely (−23KB) and its `@font-face` not registered, unlike the upstream `index.css` which declares both faces. `Font.getURLForFont` returns one URL per family and nothing in the current notation output asks for bold; should VexFlow ever emit bold text, the browser synthesizes it from the regular face rather than fetching anything, so there is no CDN fallback path to reintroduce.
- [x] VexFlow resolves fonts to the local assets, not the CDN; no request to `cdn.jsdelivr.net` occurs at runtime.
- [x] `pnpm build` output loads and renders the staff correctly with the network offline / blocked. Verified by serving `dist/` from a plain static server with every non-localhost request aborted in a real browser: staff draws, both faces report loaded, four same-origin requests total, zero to jsdelivr. Export SVG under the same conditions still embeds both faces. (Note for whoever repeats this: `vite preview` is not usable for it — it 404s the built `<script crossorigin>` because of its CORS-mode check. Serve the directory statically, as Pages does.)
- [x] Font handling stays isolated to the renderer/Staff boundary; the pure modules remain untouched.
- [x] All 13 `verify:visual` baselines are byte-identical, confirming the `vexflow/core` switch changed nothing about what is drawn.

### Licensing (SIL OFL 1.1)

Both fonts are © Steinberg Media Technologies GmbH under the SIL Open Font License
1.1, with Reserved Font Names — Bravura 1.392 (from `steinbergmedia/bravura/redist`)
and Academico 0.902. OFL clause 2 expressly permits bundling and redistributing the
fonts with any software, so this phase is clear on its face; what follows are the
attached conditions. Note that publishing to GitHub Pages *is* distribution, and the
obligations attach to distributing the bytes, not to selling them — a free project
carries the same duties as a paid one. Note also that clause 2 is satisfied by the
license text, not by credit: acknowledging Steinberg is welcome but does not discharge
it.

Two of these items cover ground that already shipped: `src/lib/export.ts` embeds the
font bytes into every exported SVG (Phase 10), which is itself redistribution.

- [x] Root `LICENSE` (MIT, the project's own choice) carries an explicit carve-out excluding the vendored font files — OFL clause 5 says the Font Software "must not be distributed under any other license", so an unqualified repo-wide MIT would conflict.
- [x] `package.json` gets `"license": "MIT"`, scoped to our own code and *not* reaching the vendored fonts. npm documents the field as the license of the package's own source, and it does not override the per-directory licensing of vendored third-party material — that is carried by the fonts' own `LICENSE-*.txt` plus the root `LICENSE` carve-out above. Deliberately **not** the SPDX composite `"MIT AND OFL-1.1"`: it would describe the distributed bundle accurately but reads as putting our code under OFL as well. A sibling `"//license"` key says so in the file itself.
- [x] Each font's `LICENSE.txt` ships **in `dist/`**, at `dist/fonts/<font>/LICENSE.txt`, next to the package's `README.txt` recording the upstream version. A `?url` import emits only the woff2, so a ~20-line `vendoredFontLicenses()` plugin in `vite.config.ts` reads both files out of the installed package at `generateBundle` — tied to the dependency rather than to a hand-copied snapshot. (Belt-and-braces: both woff2 `name` tables already carry the full OFL text and copyright internally, verified by decompressing them, so the bytes are self-documenting even bare. Shipping the text anyway removes the argument.)
- [x] Exported SVGs carry an XML comment with the copyright and `https://scripts.sil.org/OFL`, since they embed the fonts base64. PNG export needs nothing — it rasterizes, carries no font bytes, and clause 5 explicitly exempts "any document created using the Font Software".
- [x] README acknowledgements list Bravura and Academico alongside VexFlow and Tone.js (optional, permitted by clause 4, and it documents provenance where people look).
- [x] The woff2 files are shipped byte-identical. **Do not subset, re-encode, or format-convert them** — see below.

### Bundle size, and why we are not subsetting

*(Written before the phase; superseded on the numbers by the correction above, which
measured `dist/` shrinking ~1.4MB → ~912KB. The reasoning about subsetting stands.)*

Adding the fonts grows `dist/` by ~264KB (`bravura.woff2` 247,200 B +
`academico.woff2` 22,704 B; `academico-bold.woff2` is not shipped) against a current
~1.4MB, so roughly +19%. That is an artifact-size cost, not a
user-download cost: the browser already fetches those exact bytes from jsdelivr at
runtime today, blocking the first staff draw until they land. This phase relocates
the transfer and drops a third-party handshake — woff2 is already Brotli-compressed
internally, so there is no further gzip difference either way.

Where the bytes actually hurt is export, and that predates this phase: base64
inflates by 4/3, so an exported SVG is ~330KB of Bravura plus ~30KB of Academico
around 10KB of notation — about 97% font. Subsetting is the obvious fix, since the
app draws only a couple dozen distinct glyphs out of Bravura's full SMuFL repertoire,
and it would plausibly cut that by over 90%.

It is also the one move the license forbids: a subset is a Modified Version, and
clause 3 bars a Modified Version from using the primary name "Bravura" without
written permission from Steinberg. VexFlow writes `font-family="Bravura,Academico"`
straight into its SVG output and measures glyph widths against that family name
through `canvas.measureText` (`src/components/Staff.svelte:21`, `visual/page.ts:25`),
so a compliant subset means renaming the font and remapping that name through the
renderer, the export CSS, and every visual snapshot. Not in this phase. If export
size ever becomes a real complaint, the licensing-free lever is to make font
embedding opt-out in export — omission is unconstrained, modification is not.

**Unresolved questions**: none.
