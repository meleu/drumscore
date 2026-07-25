# Plan: the Sheet module

> Source: [ADR-0008](../docs/adr/0008-the-sheet-owns-the-exported-copy.md) — read it first, it
> records the four rejected alternatives. Vocabulary: **Sheet**, **Notation model** in
> [CONTEXT.md](../CONTEXT.md). Amends the residue paragraph of
> [ADR-0007](../docs/adr/0007-the-sketchpad-holds-the-state.md).
>
> Each step below is a self-contained unit of work (plan → implement → `pnpm run verify` →
> commit). Steps are ordered so the app builds and runs after every one.

## What this changes and why

The exported copy of the notation is currently wiring spread across four modules.
`renderNotation` draws an `<svg>`; `Staff.svelte` binds it outward; `App.svelte` holds it in
`staffSvg` and guards it three times over in `handleCopyPng`, `handleExportSvg` and
`handleExportPng`; and its null-ness travels on to `Transport.svelte` as `canexport`. One
element, four modules, and no test can reach any of it.

After this plan there is one module — `src/lib/sheet/` — that owns the drawn `<svg>` and the
three things you can take away from it. `App.svelte` holds no element. `Transport.svelte`
goes from 11 props to 3.

## Durable rules

- **The Sheet never draws.** It is handed the `<svg>` the Staff drew. What you export is
  what is on screen; that is the property `export.ts` was written to guarantee.
- **The Sheet takes no port over the browser.** No injected `{ svgBlob, download, … }`
  adapter. See ADR-0008's fourth rejected option before reaching for one.
- **`copyLink` stays in `App.svelte`.** Out of scope, deliberately.
- **The notation projection stays in `App.svelte`.** Separate candidate, out of scope.
- **Visual baselines must not move.** `visual/page.ts` calls `renderNotation` directly and
  touches none of the files in this plan. A changed baseline means something is wrong.
- **Runes modules do not appear in coverage.** `vite.config.ts` already documents this for
  the sketchpad; the Sheet will be invisible there too. Do not chase it.

---

## Step 1: `src/lib/sheet/` exists — **Done**

Create the directory and move the existing exporter into it, unchanged. Mirrors
`src/lib/notation/`, which is the precedent for a multi-file concern.

- [x] `git mv src/lib/export.ts src/lib/sheet/export.ts`
- [x] Fix its own relative paths, which all gain a level:
  - `import { NOTATION_FONTS } from './notation/fonts'` → `'../notation/fonts'`
  - the `{@link ../components/Staff.svelte Staff}` doc link → `../../components/Staff.svelte`
- [x] Fix the inbound doc link in `src/lib/notation/fonts.ts` (the `{@link ../export.ts
      exporter}` reference) → `../sheet/export.ts`
- [x] Update the import in `src/App.svelte` to `$lib/sheet/export` (temporary — step 4
      removes it entirely)

**Done when** `pnpm run verify` passes and the app still exports SVG and PNG by hand.

**Note for later**: candidate 1 of the architecture review splits this file into the
document rules (`standaloneSvg`) and delivery. Nothing here should make that harder; leave
the filename `export.ts` so that split lands as a clean diff.

---

## Step 2: the naming rule — **Done**

A future feature lets the user name their beats; the Sheet derives filenames from that name.
The rule lives here, tested directly. This is an internal seam — it is not part of the
Sheet's interface.

Create `src/lib/sheet/filename.ts`:

```ts
/**
 * The filename an exported sheet is saved under, derived from the beat's name. A name that
 * slugs to nothing — empty, whitespace, punctuation only — falls back to `drumscore`, so
 * every export lands somewhere sensible.
 */
export function filenameFor(name: string, extension: string): string;
```

Slug rules, in order:

- [x] `normalize('NFKD')` and strip combining marks, so `Batida Nº1` → `batida-no1`
      (this plan first said `batida-n1`; NFKD folds `º` to `o` rather than dropping it,
      which is the better answer — the letter survives)
- [x] lowercase
- [x] anything not `a-z0-9` becomes a hyphen
- [x] collapse runs of hyphens; trim leading and trailing ones
- [x] cap at 60 characters, trimming any hyphen the cut leaves behind
- [x] empty result → `drumscore`
- [x] return `` `${slug}.${extension}` ``

Create `src/lib/sheet/filename.test.ts` covering: a plain name; a name with capitals and
spaces; accented characters; punctuation-only (falls back); empty string (falls back);
whitespace-only (falls back); a name longer than the cap; both extensions.

**Done when** `pnpm run test` shows the new cases passing.

---

## Step 3: the Sheet module — **Done**

Create `src/lib/sheet/sheet.svelte.ts`. A runes module, so a component that reads
`sheet.ready` subscribes by reading it — ADR-0007 settled this over a plain class with a
change callback.

```ts
export interface SheetDeps {
  /** The current beat's name, '' while unnamed. Read at call time, never stored. */
  name: () => string;
}

export interface Sheet {
  /** False until the staff has drawn something exportable. */
  readonly ready: boolean;
  /** The staff reports what it drew, or null when it has nothing. */
  drawn(svg: SVGSVGElement | null): void;
  /** Each resolves to whether it landed — never rejects. False when nothing is drawn. */
  saveSvg(): Promise<boolean>;
  savePng(): Promise<boolean>;
  copy(): Promise<boolean>;
}

export function createSheet({ name }: SheetDeps): Sheet;
```

Implementation shape:

- [x] `let element = $state.raw<SVGSVGElement | null>(null)` — raw, as the sketchpad does:
      the element is only ever replaced wholesale and must not be proxied
- [x] `get ready() { return element !== null; }`
- [x] `drawn(svg) { element = svg; }`
- [x] One private `attempt(action)` helper that all three methods funnel through: it reads
      `element`, **returns `false` before the `try` block** when there is none, and otherwise
      runs the action inside `try/catch`, logging with `console.error` and returning `false`
      on a throw. This is the single place the fire-and-forget defect is fixed.
- [x] `saveSvg` and `savePng` call `exportSvg` / `exportPng` with
      `filenameFor(name(), 'svg' | 'png')`; `copy` calls `copyPng`. The `scale` parameter
      keeps its default — no caller varies it.

Create `src/lib/sheet/sheet.test.ts`, in the existing `node` environment, no new setup:

- [x] `ready` is false on a fresh sheet
- [x] `ready` is true after `drawn(stub)` and false again after `drawn(null)`, where `stub`
      is `{} as SVGSVGElement`
- [x] each of the three methods **resolves** to `false` when nothing is drawn
- [x] each of the three methods **resolves** rather than rejecting when an element is drawn

**On that last case, and this is the point:** in the node environment it resolves `false`
because there is no `document`, not because the Sheet decided anything. Assert only
*non-rejection* there — that is the real defect being fixed, and it is genuinely provable.
Do not dress it up as a test of the guard. ADR-0008 says the same thing.

**Not in the plan, needed anyway**: `sheet.test.ts` is the first node test to import
`notation/fonts`, which starts `VexFlow.loadFonts()` at module scope. That promise rejects
with no `FontFace` API and nothing was attached to it, so vitest failed the run on an
unhandled rejection. `notationFontsReady.catch(() => {})` in `fonts.ts` fixes it, and fixes
the same latent case in the browser: a staff of zero width never draws, so nothing awaits
the promise there either. Everyone who does await it still sees the failure.

**Done when** `pnpm run verify` passes. The module is not wired to anything yet.

---

## Step 4: wire it — **Done**

### `src/components/Staff.svelte`

- [x] Replace the `svg?: SVGSVGElement | null` bindable prop with
      `ondrawn: (svg: SVGSVGElement | null) => void`
- [x] Replace all three writes to `svg` with `ondrawn(…)`: the zero-width early return
      (`ondrawn(null)`), the success path (`ondrawn(drawn)`), and the error path
      (`ondrawn(null)`)
- [x] Delete the `// eslint-disable-next-line no-useless-assignment` comment and the
      paragraph above it explaining the bindable — both exist only because of the binding
- [x] Leave everything else alone: the `{@attach}`, the `stale` flag, the `failed` message
      and the ADR-0006 contract are untouched

### `src/App.svelte`

- [x] Delete `let staffSvg = $state<SVGSVGElement | null>(null)`
- [x] Delete `handleCopyPng`, `handleExportSvg`, `handleExportPng`
- [x] Delete the `$lib/export` import
- [x] Add `const sheet = createSheet({ name: () => '' })` beside the sketchpad, with a
      comment noting the `''` is the unnamed-beat case until Pattern carries a name
- [x] `<Staff model={notation} ondrawn={sheet.drawn} />`
- [x] Keep `copyLink` exactly as it is

### `src/components/Transport.svelte`

- [x] Replace `oncopypng`, `onexportsvg`, `onexportpng` and `canexport` with one `sheet: Sheet` prop
- [x] The two export buttons call `sheet.saveSvg()` / `sheet.savePng()`; both are
      `disabled={!sheet.ready}`
- [x] Copy PNG goes through the existing `handleCopy('png', sheet.copy)`
- [x] The export buttons may keep ignoring their booleans for now — the interface no longer
      lies about failure, which is the point

**Done when** `pnpm run verify` passes, `pnpm run verify:visual` reports every baseline
matching, and by hand: Export SVG and Export PNG download named `drumscore.svg` /
`drumscore.png`, Copy PNG flashes "Copied!", and all three are disabled until the staff has
drawn.

---

## Step 5: fold Transport down to three props — **Todo**

Candidate 4 of the architecture review, folded in on request. `Transport` currently takes
six props that are just the sketchpad unpacked.

- [ ] Props become exactly: `sketchpad: Sketchpad`, `sheet: Sheet`, `oncopylink: () => Promise<boolean>`
- [ ] Read `sketchpad.playing` and `sketchpad.pattern.bpm` directly; call `sketchpad.stop()`,
      `sketchpad.setBpm(…)`, `sketchpad.clear()`
- [ ] **Watch out:** `sketchpad.play()` returns a promise that rejects when the browser
      refuses audio, and `onplay={sketchpad.play}` currently leaves that rejection
      unhandled. Calling it directly must not repeat that — `catch` it and `console.error`.
      The sketchpad already leaves `playing` false, so behaviour is otherwise unchanged.
- [ ] `App.svelte` passes `<Transport {sketchpad} {sheet} oncopylink={copyLink} />`
- [ ] The `copied` / `copiedTimer` flash state stays local to `Transport` — it is
      presentation, and it is shared by both copy buttons

**Done when** `pnpm run verify` passes and, by hand: play/stop, the tempo field, Clear, the
playhead, Copy link, Copy PNG and both exports all behave as before.

---

## Step 6: tidy — **Todo**

- [ ] `vite.config.ts`'s `test.environment` comment reads "The tested modules (notation
      engine, pattern codec) are pure: no DOM needed." That has been stale since the
      sketchpad arrived. Widen it to say the node environment covers the pure modules plus
      the runes modules' logic — the sketchpad's transitions and the Sheet's readiness —
      and that anything needing a real browser is covered by `verify:visual`.

---

## Definition of done

- [ ] `pnpm run verify` clean
- [ ] `pnpm run verify:visual` — 13 of 13 baselines match, none updated
- [ ] No `SVGSVGElement` appears in `src/App.svelte`
- [ ] `src/components/Transport.svelte` has 3 props
- [ ] `grep -rn "lib/export" src/` returns nothing
- [ ] New tests: the naming rule, and the Sheet's readiness and non-rejection

## Do not

- Add a port, adapter or injected delivery object to the Sheet (ADR-0008)
- Make the Sheet call `renderNotation` (ADR-0008)
- Move `copyLink` or the `toNotation` derivation (out of scope)
- Update a visual baseline (nothing in this plan can legitimately change one)
- Add a DOM environment, jsdom or happy-dom to vitest (ADR-0005)
