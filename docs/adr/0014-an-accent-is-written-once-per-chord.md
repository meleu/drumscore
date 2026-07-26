# An accent is written once per chord, a ghost once per notehead

In the **notation model**, each fact sits on the object it is drawn against:

| fact   | lives on       | because                                                     |
| ------ | -------------- | ----------------------------------------------------------- |
| ghost  | `Notehead`     | the parentheses wrap one head; two ghosts make two pairs     |
| accent | `NotationNote` | the `>` has one place to go — above the stem, below for feet |
| graces | `NotationNote` | one grace group sits before the chord, whatever fed it       |

The asymmetry is not an oversight. A **chord** is several drums on one stem, and the marks
that describe it do not all have the same reach: a parenthesis is drawn around a notehead, an
accent and a grace group are drawn against a stem. Putting each fact where its glyph goes is
what leaves the renderer with nothing to decide.

**So the accent is lossy, on purpose.** An accented snare beside a plain hi-hat draws
identically to both accented: the engine ORs the accent across the hits at that step and emits
one mark. The **Pattern** still knows which voice you accented — the share link and playback
are unaffected — but the staff cannot show it, and a reader resolves the mark against the drum
key. That is how drum charts are written, and given the Kit's table (ADR-0013) it happens
constantly: the snare is the only voice with ghosts and rudiments, and it shares the hands
**part** with every hi-hat and cymbal.

## Considered options

**All four facts on the `Notehead`**, which is truest to what the user drew. It hands the
renderer a chord whose heads disagree — an accented snare, a plain hi-hat — and no rule for
what to draw. Deciding that is musical judgement, in the one module ADR-0002 says holds none,
and testable only through the browser snapshot harness rather than as plain data in Node.

**Forbidding disagreement in the Sketchpad**, by making the accent a property of the
(part, step) column rather than of the hit. It removes the ambiguity by removing the choice:
accenting a snare would accent the hi-hat above it, and there would be no way to say otherwise
even though the Pattern has room to.

**Graces on the `Notehead`.** Purely mechanical today, since the snare is the only voice that
flams — the renderer would just lift the head's graces onto its parent note. It stops being
mechanical the moment two voices at one step carry graces, and toms are on the roadmap. A flam
on the snare and a flam on a tom is written as **one** grace group holding **two** heads, not
two groups, so the container is note-level even then; only its contents are per-voice. Ghost
has the opposite shape, which is why the two are split.

## Consequences

**The engine does the ORing; the renderer draws what it is told.** Accent placement is the one
thing the renderer derives, from `part.stemDirection` — above the staff for hands, below for
feet — which is the same mechanical mapping it already makes to `Stem.UP` and `Stem.DOWN`.

**The grace group spells itself out.** It carries its own note values, whether it is beamed and
whether it is slashed, so that "a flam is one unslashed eighth, a drag is two beamed
thirty-seconds" lives in the engine as data and is asserted in Node, rather than living as
convention inside the VexFlow adapter (ADR-0002).

**Round-tripping through the staff loses which voice was accented; round-tripping through the
codec does not.** Anything reading a pattern back out of a rendered sheet would be reading a
lossy copy. Nothing does, and nothing should — the **Encoded pattern** is the round-trip
format.

**One conflict is deferred rather than solved.** A flam on one voice and a drag on another at
the same step has no answer here, because the Kit gives rudiments to the snare alone and the
case is unreachable. When toms make it reachable the rule will be needed, and this decision
says where it goes: in the engine, resolved into one grace group, before the model is emitted.
