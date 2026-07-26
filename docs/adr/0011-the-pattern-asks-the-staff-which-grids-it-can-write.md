# The Pattern asks the staff which grids it can write

**Grid dimensions** are data (ADR-0003), and the pattern codec was the only module with an
opinion about which of them are real: a byte-plausibility check accepting any value from 1 to
64 in all four fields. That is 65,536 grids, of which the app draws one. A hand-made link
asking for three steps to a beat reaches the notation engine, finds no note value spanning a
single step, and throws from inside the engine's splitting logic — from a line whose own
comment calls it unreachable. A link asking for 64 in every field decodes to 262,144 steps
and over a million grid cells.

The Pattern now answers the question instead, through one predicate over grid dimensions, and
the codec asks it after parsing the header rather than range-checking bytes. The codec's
maximum-dimension constant is deleted; there is one answer in the codebase, and it lives with
the thing the question is about.

**The rule is derived, not stated.** The predicate does not restate what the staff can write;
it looks in the note-value vocabulary for a value spanning exactly one step, which is the
precise condition for every hit to have a way of being written. The table of note values
moves out of the notation engine and into the notation model, beside the value union it is a
fact about, so that both the engine and the Pattern read one source. The engine keeps the
work of choosing among values; it stops owning what the values are.

Alongside it sits a capacity clause — bounds on total steps, bars and beats per bar — and it
is a different kind of statement, labelled as such. It guards against a grid a browser cannot
lay out. It is sized past a full-song transcription (roughly 120 bars) so that no planned
feature has to move it, and it claims nothing about whether what it permits looks good.
Making long scores readable means wrapping the staff and paging the grid, which is separate
work.

## Considered options

**A rule restated in the Pattern** — steps per whole note must be a power of two, no greater
than sixteen. Correct today, and the first version of this design. Two roadmap items kill it:
32nd notes move the ceiling, and triplets move the shape, because a triplet is a value
carrying a ratio rather than a finer division. A restated rule needs editing for both, and
its failure mode is silent — the feature ships and the predicate goes on refusing the grids
that feature just enabled. The derived version is the same size and cannot fail that way.

**An enumerated set of supported grids**, one row per grid with a fixture behind it. Auditable
and honest, but it cannot express a range, and user-chosen bar counts need one.

**The predicate living in the notation engine**, next to the vocabulary. No duplication and no
new dependency, but the capacity clause has nothing to do with the engine, so the predicate
would end up half in the wrong house.

**A branded grid type carried on the Pattern**, so the compiler proves an unwritable grid
never reaches the engine. The strongest guarantee available, and rejected on ceremony: the
brand ripples into the default dimensions, the pattern constructor, every test that builds
dimensions inline, and every component prop, to protect a codebase with exactly one door.

**Teaching the engine to cope with triplet resolutions** instead of refusing them. That is a
feature — tuplets in the notation model, alignment in the engine, brackets in the renderer —
not a validation decision, and it is deferred, not declined.

## Consequences

**The Pattern depends on the notation model, and the Kit is no longer the only module that
meets both halves.** This ADR narrows the claim in ADR-0009 that the Kit "is the one module
allowed to meet both halves of the app", and the same sentence has been removed from the
Kit's glossary entry. The two meetings are not the same kind — the Kit maps one half onto the
other and must keep them in correspondence, whereas this is a one-way question with no
mapping in it — but the singularity claim was false as written, and narrowing it in prose
while leaving two places is worse than saying there are two.

**Refusals are temporary, and nothing records which.** Triplet resolutions and 32nd grids are
refused today because the note-value vocabulary has no values of those lengths. Adding
`thirtysecond` admits 32nd grids; adding tuplet values admits triplet grids. The predicate is
not edited for either — that is the point of deriving it — so a reader who wants to know
which refusals are permanent has only this paragraph to go on. None of them are.

**The membership rule is a claim, and a test carries it.** "Some value spans exactly one step"
is sufficient today because the vocabulary is a chain of halvings. Tuplets may break that: a
grid where a one-step value exists but cannot legally begin where it needs to. A sweep in the
engine's tests asserts that every grid the predicate admits can actually be written, so the
disagreement surfaces on the grid the predicate has just started admitting, at the moment the
vocabulary changes.

**ADR-0003's outstanding request is closed.** It asked for "a test or fixture on a non-default
grid" as the cheap way to make the claim real, and until now the project had neither — every
test and all thirteen visual baselines use the default grid. The sweep covers the notation
model, and one odd-meter fixture takes a non-default grid into a real browser.

**The capacity numbers are the part not derived from anything.** They are a judgement about
what a browser can lay out, not about music, and they are the clause most likely to look wrong
later. They are kept in one place with their reasoning attached so that revisiting them is
cheap.

**The engine's throw is still marked unreachable, but for a stated reason.** Its comment now
names the predicate as the guarantee rather than asserting impossibility it did not have.
