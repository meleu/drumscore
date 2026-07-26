# The Kit says which variations a voice accepts

Every Kit row carries the variations that voice accepts beyond `plain`, and that list is the
only statement of the fact in the codebase:

| voice                       | beyond plain                |
| --------------------------- | --------------------------- |
| kick                        | accent                      |
| snare                       | accent, ghost, flam, drag   |
| closed hi-hat, open hi-hat  | accent                      |
| ride                        | accent                      |
| crash                       | —                           |

The alternative — one uniform set every voice shares — is smaller today and has nowhere to put
a cymbal choke. A choke is a variation no drum can take, and it is on the roadmap. The day it
arrives, a uniform rule either lets you choke a kick drum or acquires its first exception, and
an exception inside a rule stated as uniform is exactly the drift ADR-0009 exists to prevent.
The set is voice-shaped by nature; stating it per voice is not a restriction bolted onto a
general rule, it is the general rule.

`Hit` stays one global union (ADR-0012). What is per-voice is which of its members that voice
admits: one type, many subsets. Choke will join the union once and one row's list once.

This extends ADR-0009 rather than qualifying it. The Kit already holds everything true of a
drum whoever is asking; which variations it takes is such a fact, and it sits beside the
label, the part and the notehead for the same reason they do.

## Considered options

**Uniform — every variation on every voice.** The Kit stays untouched, the codec has no
illegal states to police, and the menu is identical on every row. It offers a dragged crash
and a ghosted ride, which is drawable nonsense, and it has nowhere to put choke.

**A `kind` column — drum or cymbal — with the variations stated per kind.** One fact per kind
rather than per row, which is fewer places to edit. It breaks at the first exception, and the
exceptions are visible before it is written: the closed hi-hat is a cymbal that cannot be
choked, and the crash is a cymbal that takes no accent while the ride does. Two exceptions in
a six-row table is not an abstraction, it is a second table.

**Leaving the rule in the menu component**, since the menu is the only thing that has to
offer the right options. That is the four-files-one-drum failure ADR-0009 was written about:
the codec would keep accepting a dragged crash from a hand-made link, the engine would keep
drawing it, and only the UI would disagree.

## Consequences

**The codec asks the Kit, and a refusal is malformed input.** A decoded cell whose variation
the voice does not accept rejects the whole string, the same shape as an unsupported grid
(ADR-0011): the codec parses bytes and asks the owner whether what it read is real. Decode
therefore yields only patterns the app considers valid, with no repair step and no partially
salvaged pattern — the same stance `codec.ts` already takes on migration.

**`setHit` refuses the same way `toggle` ignores an out-of-range step**, by returning the
pattern it was given. The sketchpad's `commit` treats identity as no change (ADR-0007), so the
refusal costs no autosave and no sequence rebuild, and the invariant holds at every door
rather than only at the codec.

**The menu is a projection of the row, not a list.** The crash shows a one-item menu today and
gains choke the day the row does, with no edit to the component. That is also why the crash
opens a menu at all: the gesture means the same thing on every row, and a one-item menu is
itself the answer.

**Revoking a variation invalidates existing links.** Taking a variation off a row makes every
string containing it decode to `null`. This is the same breakage `codec.ts` already accepts
for adding a voice, and it is accepted for the same reason: the format version is not what
rescues those strings, and bumping it would not.

**The Kit meets both halves of the app here too.** Which variations a drum takes is a fact
about the drum that the notation engine, the codec and the grid all read. That is the mapping
role ADR-0009 describes and ADR-0011 narrowed, unchanged by this.
