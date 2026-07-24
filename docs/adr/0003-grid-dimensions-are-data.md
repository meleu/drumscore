# Grid dimensions are data, not constants

v1 ships one grid — 16th notes, 4/4, two bars, six voices — but the **grid dimensions**
live in the Pattern as four numbers (steps per beat, beats per bar, beat value, bars) and
every module reads them from there. No `16` or `32` is written down anywhere; the note
value tables, the seed's layout, the codec's header, and the audio subdivision are all
derived.

This is deliberate spending against a known roadmap: triplets, other resolutions, odd
meters, and longer loops are all explicitly deferred features, and they are the kind that
turn into a rewrite if the current grid is baked in as literals.

## Consequences

There is exactly one set of dimensions in use, so the parameterization is a seam nothing
crosses yet — it buys optionality, not present-day variation, and it should not be read as
evidence that other grids work. Removing it is a decision to accept that rewrite later;
verifying it (a test or fixture on a non-default grid) is the cheap way to make the claim
real.
