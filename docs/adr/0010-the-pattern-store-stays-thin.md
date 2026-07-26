# The pattern store stays thin, and its 0% coverage is not a finding

`src/lib/persistence.ts` reads `window.location` and `localStorage` directly. It takes no
injectable sources, holds no pure counterpart, and has no tests — it is the one module in
`src/lib/` deliberately left at 0% statement coverage.

The coverage report is what makes this look wrong, so it is worth saying what those 67
lines actually contain: one line of load precedence (`fromUrl() ?? fromStorage() ?? seed()`),
two lines of `URLSearchParams`, two tolerant `catch` arms, a storage key and a parameter
name. The part of sharing that carries risk — the **encoded pattern** itself — belongs to
the codec, which is pure, has no browser in it, and is tested at 94%. What is left here is
plumbing, and a seam through it would be shallow: the interface would be nearly as wide as
the implementation, and the assertions behind it would mostly establish that the browser's
`URL` class works.

The second reason is that the share link is a proof of concept. More voices and
user-chosen bars are both coming, and both change the payload; users know links will
break, and ADR-0009 and the codec's own comment already record that breakage as accepted.
Building test scaffolding around a format that is expected to change buys a guarantee
about the wrong thing.

## Considered options

**Injectable sources for the store** — a link source and an autosave source handed in, as
`Playback` and `PatternStore` are handed to the sketchpad. Those two seams earned
themselves by making every state transition reachable (ADR-0007). This one would have
fakes and nothing else behind it — hypothetical by the two-adapter rule — in exchange for
a test of a `??` chain.

**A pure link module**, taking the href as a string rather than reading it from the global:
`patternFromLink(href)` and `linkFor(href, pattern)`. Better shaped, and genuinely cheap.
It was rejected on what the resulting tests would say rather than on cost: they assert that
a query parameter can be read back after being written, which is a fact about the browser,
not a decision drumscore made.

## Consequences

**Load precedence is untested.** A share link wins over the autosave, which wins over the
**seed** — stated in the v1 PRD and in the module's own comment, asserted nowhere. Accepted:
it is one line, and getting it wrong is visible the first time anyone opens a link.

**What would change the answer.** The moment the link carries something that is a decision
rather than plumbing — a pattern's name, a format version with a migration behind it, a
link that has to survive a kit change — the deciding stops being a `??` chain and this ADR
should be reopened. Until then, a review that finds `persistence.ts` at 0% and proposes a
seam through it has found the coverage report, not a problem.
