# A hit carries exactly one variation

A **Hit** is one of `off`, `plain`, `accent`, `ghost`, `flam` or `drag` — one value, never a
combination. There is no accented flam and no ghosted drag, and there is no field to put one
in.

Accented flams are real playing. drumscore does not write them. This is a decision about how
much vocabulary the sketchpad carries, not a claim about drumming: two independent axes double
the states a cell can hold, the grid has to draw every product of them, the menu has to offer
every product of them, and the engine has to decide what an accented drag looks like on a
staff. A single closed union costs one glyph per member and nothing else.

So the constraint is expressed by the shape of the type rather than by a rule enforced on top
of it. A pattern holding an accented flam does not fail validation; it does not typecheck.

## Considered options

**Two optional fields — a dynamic and an ornament — with a guard forbidding both.** Keeps the
door open to accented flams later, at the price of illegal states being representable now. The
guard would be needed at every door into the pattern (the codec, `setHit`, the menu), and its
failure mode is the bad one: a pattern that exists, encodes, shares and plays, and has no way
of being written on a staff. That is the failure `isSupportedGrid` was introduced to remove
from grid dimensions (ADR-0011), reintroduced one level down.

**Boolean rows plus a sparse table of the cells that differ.** The smallest diff to the
existing code — `rows` keeps its shape, the codec keeps its bitmap — and the worst place to
put the truth about one cell. `toggle`, `clear`, `encode` and `decode` would each have to keep
two structures in step, and every one of them is a place they can fall out of it.

**A per-voice conditional type**, so the compiler proves a drag never lands on a crash. The
strongest guarantee available and rejected on the same ceremony grounds as ADR-0011's branded
grid type: the parameterisation ripples through `Pattern`, every operation on it, every test
that builds rows inline and every component prop, to protect a codebase whose doors are one
codec and one setter.

## Consequences

**The encoded cell widens from a bit to a nibble, and `FORMAT_VERSION` goes to 2.** Six states
do not fit in one bit and will not fit in three for long — choke is already named (ADR-0013) —
so a cell is half a byte, two per byte, nothing straddling a boundary. Existing share links
and autosaves decode to `null` and fall back to the seed. No v1 reader is written: the roadmap
adds four toms and more cymbals, and `codec.ts` already records that changing the voice count
breaks every string, so a reader bought today would not outlive the next kit change.

**Left-click stays a two-state toggle: `off ↔ plain`, and anything → `off`.** A cell holds one
value with no history behind it, so there is nothing for a click on a flam to demote to except
`plain`, and picking that would make one gesture mean two things depending on the cell.
Clearing a flam and re-drawing it is two clicks, deliberately.

**The grid draws one mark per variation and they never stack.** An accent is a `>`, a ghost is
a dimmer inset fill, a flam and a drag are one and two leading pips. Because the values are
exclusive, no cell ever has to combine two of these, which is what keeps them legible at
twenty pixels.

**Reopening, not extending.** Any future proposal to add a second axis — a dynamic alongside
an ornament, a velocity number beside the variation — is re-opening this decision. It is not a
small change: it changes the type, the codec's cell width, the menu's shape and the grid's
marks at once.
