# Every voice is struck; no ties

A drum is hit, not held, so every hit — the crash and the open hi-hat included — is
written as a single **stroke**: the longest note value that fits the gap to the next hit
in the same **part** without outlasting its own beat, with the remaining silence written
as rests. There are no ties anywhere in the engine, the **notation model**, or the
renderer.

## Considered options

Ties were built first, on the reasoning that a crash rings and should therefore be held
to the next hit across a tie. That was reversed: a tied crash reads as a sustained note —
the exact look the note-plus-rests treatment was introduced to remove — and it is not how
drum music is written. Since a stroke is always one value, ties then became unreachable
and were deleted rather than left as dead code.

## Consequences

A hit's written length says nothing about how long the drum rings; it is a rhythmic
position, read against the drum key. Any future proposal to reintroduce ties, sustained
values, or a "ringing voice" exception is re-opening this decision, not extending it.
