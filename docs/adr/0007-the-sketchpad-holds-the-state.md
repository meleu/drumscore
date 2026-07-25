# The sketchpad holds the app's state, not the components

Every state transition in the app — draw a hit, set the tempo, clear, play, stop, share —
lives in `src/lib/sketchpad.svelte.ts`, behind a seam that takes two adapters: **Playback**
(the audio engine) and a **PatternStore** (the URL and localStorage). `App.svelte` builds
one, reads `pattern`, `playing` and `currentStep` from it, and does nothing else.

They used to live in `App.svelte`, where nothing could reach them: the pattern, four
`$effect`s pushing it into the engine and the autosave, and six handlers. Not one of those
transitions was covered, because reaching them meant mounting a component that constructs
Tone.js and touches `localStorage`. The pure modules underneath — the pattern operations,
the codec, the notation engine — were thoroughly tested while the wiring that calls them
was not, which is the wrong way round: the pure functions are the easy part.

## Considered options

**A plain class with a change callback**, so the module needs no compiler. The component
would then hold its own `$state` copy and subscribe to keep it in sync — the same glue
this change removes, moved one file over, plus a second copy of the truth. The runes
module instead publishes its state directly: a component that reads `sketchpad.pattern`
subscribes by reading it.

**Component tests** against `App.svelte` as it stood. That needs a DOM environment, a
Svelte testing library, and fakes injected through module mocking rather than through an
interface — a lot of machinery to test transitions that have nothing to do with markup.
The project's vitest runs in `node` with no setup file, and it still does: a runes module
is compiled by the Svelte plugin vitest already loads.

## Consequences

There are deliberately **no `$effect`s inside the sketchpad**. Each transition funnels
through one `commit` that pushes to playback and the store in a fixed order, so what
happens on an edit is readable in one place and the tests need no effect root. Keep it
that way: an `$effect` in here would be untestable in the current setup and would put the
ordering back at the mercy of the scheduler.

The pattern operations in `./pattern` return the _same_ pattern when they decline a change
— an out-of-range step, a tempo that would not move — and `commit` treats identity as "no
change". A future operation that returns a fresh object for a no-op would silently start
autosaving and rebuilding the sequence on every keystroke.

`AudioEngine` and `patternStore` now name the interfaces they satisfy (`implements
Playback`, `: PatternStore`), so a change to either lands as an error in the adapter rather
than at the wiring in `App.svelte`. What is left in the component is what genuinely needs
the DOM: the clipboard write, the exported `<svg>` bound from the Staff, and the notation
projection.

The exported `<svg>` has since moved out to the Sheet (ADR-0008), which found that needing
the DOM makes a module browser-only rather than component-only — and that this particular
residue grew a third handler and a fourth prop one commit later.
