# The Kit says what the drums are, and everyone else derives from it

`src/lib/kit.ts` holds one row per **Voice** — id, label, part, notehead style, staff
position — and is the only place any of those are stated. `VoiceId` is derived from the
rows, the codec walks them in declaration order, the notation engine projects its noteheads
and its parts' membership out of them, and the grid draws the display order they publish.
It sits at the same level as `pattern.ts` and `notation/`, and it is the one module allowed
to meet both halves of the app, which is why it stays small and declarative.

What it replaced was a drum described in four files, with two edits that failed silently: a
voice named in the id list but missing from the labelled list crashed on first read, and a
voice left out of a part's membership list was playable, audible, shareable and absent from
the staff. Neither was caught by the compiler and neither was caught by the tests. Both are
now unreachable — there is one list, and part is a required field of a row.

## Considered options

**A section of the Pattern module**, since the Pattern already owned the voice list. It
would put `NoteheadStyle` and `StaffPosition` — notation vocabulary — into the module that
models what the user drew, which is the separation CONTEXT.md and ADR-0002 exist to keep.

**Moving `NoteheadStyle` and `StaffPosition` into the Kit** so a row depends on nothing.
That inverts a dependency the engine and the renderer already read the right way round, to
no gain. The Kit depends on the notation model; the notation model does not depend on the
Kit.

**Leaving the engine's tables written out** and testing that they agree with the Kit. A
test that two lists match is a worse guarantee than one list: it fails after the mistake is
made rather than preventing it, and it grows a maintenance burden per drum.

**A hand-written display order** beside the canonical one. Two lists that must hold the
same voices is exactly the failure mode this work removes. Display order is published from
the Kit as one derivation — canonical order reversed — so the day it needs to diverge there
is a single line to change and a single module to test.

## Consequences

**Synth construction deliberately stayed in the audio engine.** No envelope, filter or
volume moved into a kit row: they are true of how the app makes a noise, not of the drum.
What the Kit does buy is that the trigger map is an exhaustive `Record<VoiceId, …>` over
Kit-derived ids, so a row added without a synth is a compile error rather than a drum that
is drawable and silent. The seam to watch is the first request to put a colour, a keyboard
shortcut or a synth parameter in a row — the question to ask is whether it is true of the
drum or true of the module asking.

**Declaration order is the wire format.** The codec encodes rows in the order the Kit
declares them, so reordering the list silently changes what every existing share link and
autosave decodes to. The compiler cannot see that, so `kit.test.ts` pins the order against
a literal list; a reorder has to be a deliberate edit there too. Changing the _number_ of
voices changes the payload width and breaks those strings outright — accepted breakage, no
migration built, recorded at the codec's import of the Kit.

**Adding a drum is a row and a synth.** That was the point. A reviewer can tell a change is
complete by looking at two files, and the compiler names the second one.

A row has since gained the variations its voice accepts (ADR-0013), which is the seam above
answered in the affirmative: which variations a drum takes is true of the drum. It is also
the first row field that changes what the codec will _accept_ rather than only how wide its
payload is — decode asks the Kit whether a variation is legal for that voice, and refuses the
whole string when it is not.
