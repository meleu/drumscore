# drumscore

A browser sketchpad for drum loops: you draw a loop on a step grid, and the same loop
appears as real percussion notation you can hear, share, and print. The language
below separates the two halves deliberately — what the user _draws_ and what the staff
_shows_ are different things, and the code keeps them apart.

## Language

### The session

**Sketchpad**:
What the user is working on right now: the pattern they have open, whether it is playing,
and where the playhead has got to. Everything the user can do — draw a hit, set the tempo,
clear, play, stop, share — is a change to the sketchpad.
_Avoid_: app, editor, workspace, session, document, state

### The loop as drawn

**Pattern**:
The drum loop the user has drawn — every hit, plus the grid it sits on and its tempo.
The single source of truth; everything else is derived from it.
_Avoid_: beat, groove, loop, song, score, state

**Voice**:
One drum or cymbal that can be struck: kick, snare, closed hi-hat, open hi-hat, crash,
ride. Each has its own row on the grid.
_Avoid_: instrument, drum, track, lane, channel, row

**Kit**:
Every Voice there is, one row each: what the drum is called, whether it is played by the
hands or the feet, how it is written on the staff, and which variations it accepts. It maps
what the user draws onto what the staff shows, and is the one table that has to keep the two
in correspondence.
_Avoid_: kit piece, drum map, instrument table, drum set

**Step**:
One cell of time on the grid — the finest rhythmic position a hit can occupy. At v1's
resolution a step is a sixteenth note.
_Avoid_: tick, slot, cell, column, sixteenth

**Hit**:
One voice struck at one step, and how it is struck: not at all, plainly, or with exactly
one variation — an accent, a ghost note, a flam or a drag. One value, never a combination
and never a number; which variations a voice takes is the Kit's answer, row by row.
_Avoid_: note, onset, trigger, event, on-cell, velocity, dynamic, ornament

**Bar**:
One measure's worth of steps on the grid. Named _bar_ on the grid side and _measure_ on
the staff side, so it is always clear which half of the app is being talked about.
_Avoid_: measure (reserved for the staff)

**Grid dimensions**:
The four numbers that shape the grid — steps per beat, beats per bar, beat value, bars.
Data rather than constants, so a later version can change the resolution or the meter.
Which combinations the staff can write follows from the note values it knows: a grid is
writable when some value spans exactly one step. So the set is a growing one — finer
values and tuplets widen it — rather than a fixed list.
_Avoid_: resolution, size, layout, config, settings

**Seed**:
The default beat a first-time visitor lands on: hi-hats on every eighth, kick on 1 & 3,
snare on 2 & 4.
_Avoid_: default pattern, demo, example, starter, preset

**Playhead**:
The column highlighted during playback, marking the step currently sounding.
_Avoid_: cursor, marker, position indicator

### The loop as written

**Notation model**:
The abstract description of what the staff shows — measures, parts, notes, rests, beams.
Says nothing about how it is drawn; no drawing library's vocabulary appears in it.
_Avoid_: score, IR, AST, render model, sheet (reserved for the exported file)

**Measure**:
One bar as written on the staff.
_Avoid_: bar (reserved for the grid)

**Part**:
One of the two rhythms sharing the staff: **hands**, written stems up, and **feet**,
written stems down. Each carries its own rhythm and fills its own measure with its own
rests, so a kick never chops up a snare.
_Avoid_: voice (that is a drum), staff, layer, line, stave

**Stroke**:
How one hit is written: the longest note value that fits the gap to the next hit in the
same part without outlasting its own beat. Whatever silence is left over becomes rests.
Every voice is struck this way, cymbals included.
_Avoid_: duration, note length, hold, sustain

**Notehead**:
The glyph for one drum within a note — a cross for cymbals and hi-hats, an ordinary
notehead for the snare and kick. A note may carry several. Ghosting belongs here rather
than on the note, because the parentheses are drawn round one drum: a ghosted snare under
a plain hi-hat leaves the hi-hat bare.
_Avoid_: note (a note is the whole stroke), glyph, head, dot

**Staff position**:
The line or space a notehead sits on, named the way notation names heights (a letter and
an octave). On a percussion staff it identifies a drum, not a pitch.
_Avoid_: pitch, key, note name, height, row

**Chord**:
The drums of one part struck at the same step, written as one note carrying several
noteheads.
_Avoid_: stack, cluster, group, simultaneity

**Beam group**:
A run of consecutive flagged notes to be drawn under one beam instead of with separate
flags. Never crosses a beat.
_Avoid_: beam, run, ligature, group

### Sharing the loop

**Encoded pattern**:
The compact, URL-safe string form of a Pattern. One encoding serves two jobs: the payload
of a share link, and the format the working pattern is autosaved in.
_Avoid_: hash, permalink, serialization, save file, snapshot, blob

**Sheet**:
The staff as something you can take away: a self-contained SVG, a PNG file, or a PNG on the
clipboard. Always a copy of what is on screen — it is made from the `<svg>` the staff drew,
never drawn a second time of its own accord.
_Avoid_: export, image, download, printout, score
