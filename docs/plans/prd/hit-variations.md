# Hit variations: accents, ghost notes, flams and drags

## Problem Statement

Every hit I draw in drumscore sounds and looks exactly like every other hit. A snare on beat 2
is indistinguishable from the quiet snare I sneak in on the "e" before it, and the thickened
snare I open a fill with. On the grid they are the same square; on the staff they are the same
notehead; through the speakers they are the same volume.

That is not how the grooves in my head work. What makes a backbeat sit right is the accent on
2 and 4 against ghosted sixteenths underneath. What makes a fill sound like a drummer played
it is the flam that opens it. Right now I can sketch the _rhythm_ of an idea but not the
_feel_ of it, so the loop I hear back is a mechanical outline of what I meant, and the sheet
music I print is missing the markings a drummer would need to play it the way I intended.

These are not advanced ornaments. Accents, ghost notes, flams and drags are the first things
taught after the basic strokes, and they appear in nearly every drum chart ever printed.
Sketching a loop without them means sketching something that isn't the loop.

## Solution

Each cell on the grid carries one variation rather than being merely on or off. Left-click
still marks an ordinary hit exactly as it does today. Right-click opens a small menu offering
that voice's variations, and picking one sets the cell outright — so placing a flam on an
empty step is one gesture, not two.

The grid shows what each cell holds using marks that echo the staff: an accent is a `>`, a
ghost is a dimmer, inset fill, and a flam and a drag carry one and two small pips on the
leading edge, the way their grace notes sit before the beat. Left-click always clears a cell
whatever it holds, so there is one rule to remember.

The staff writes them properly: an accent mark above the stem, parentheses around a ghosted
notehead, and real grace notes before a flammed or dragged stroke. Playback reflects them too
— accents louder, ghosts quieter, and flams and drags sounded as extra strikes a few
milliseconds ahead of the beat, so a flam sounds like a flam rather than like two notes.

Which variations a voice offers depends on the drum. The snare takes all four; the kick, the
hi-hats and the ride take an accent; the crash takes none for now. A variation is never
combined with another — there is no accented flam and no ghosted drag.

## User Stories

### Drawing

1. As a drummer sketching a groove, I want to left-click a cell to mark an ordinary hit, so
   that the fastest and most common action is unchanged from what I already know.
2. As a drummer sketching a groove, I want to right-click a cell to choose a variation, so
   that I can add feel to a hit without leaving the grid or learning a mode.
3. As a drummer sketching a groove, I want the menu to open on an empty cell too, so that
   placing a flam takes one gesture rather than clicking then right-clicking.
4. As a drummer sketching a groove, I want the menu to mark which variation the cell currently
   holds, so that I can see what I set without having to decode the cell's mark.
5. As a drummer sketching a groove, I want the menu to offer "plain" alongside the variations,
   so that I can demote a flam back to an ordinary hit without clearing it first.
6. As a drummer sketching a groove, I want left-click to clear any cell whatever it holds, so
   that one gesture always empties a step and I never have to click twice to undo a variation.
7. As a drummer sketching a groove, I want the menu to close when I press Escape or click
   away, so that opening it by accident costs me nothing.
8. As a drummer sketching a groove, I want the menu to appear next to the cell I right-clicked,
   so that I do not lose my place in a wide grid.
9. As a drummer sketching a groove, I want the menu to offer only what that drum can actually
   play, so that I am never presented with a dragged crash or a ghosted ride.
10. As a drummer sketching a groove, I want right-clicking the crash to still open a menu, so
    that the gesture means the same thing on every row even where there is little to choose.
11. As a drummer who works quickly, I want to accent a hit and later change it to a ghost in
    one action, so that trying out a dynamic is as cheap as trying out a rhythm.
12. As a drummer, I want variations to survive clearing and redrawing other cells, so that
    editing one part of the loop never disturbs another.
13. As a drummer, I want "Clear" to empty variations along with the hits, so that starting over
    genuinely starts over.

### Reading the grid

14. As a drummer scanning my grid, I want an accented cell to show a `>`, so that I can find
    the backbeat at a glance without hovering anything.
15. As a drummer scanning my grid, I want a ghosted cell to look quieter than a plain one, so
    that the grid's appearance matches what I will hear.
16. As a drummer scanning my grid, I want a flam and a drag to be distinguishable from each
    other at a glance, so that I can check a fill without clicking into each cell.
17. As a drummer scanning my grid, I want the marks to echo the staff's own symbols, so that
    the grid and the sheet teach each other rather than being two separate languages.
18. As a drummer scanning my grid, I want the marks to stay legible at the grid's small cell
    size, so that the feature is usable at the resolution the app actually renders.
19. As a drummer, I want a cell's mark to be unambiguous without colour, so that the grid
    remains readable if I cannot distinguish the shades.

### Reading the staff

20. As a drummer reading the sheet, I want an accented stroke to carry an accent mark above the
    stem, so that the chart tells a reader where the emphasis goes.
21. As a drummer reading the sheet, I want an accent on a foot stroke to sit below the staff,
    so that it does not collide with the hand part sharing the same staff.
22. As a drummer reading the sheet, I want a ghosted snare to be written in parentheses, so
    that the chart uses the convention a drummer already recognises.
23. As a drummer reading the sheet, I want only the ghosted drum's notehead to be
    parenthesised, so that a ghosted snare under a plain hi-hat reads correctly.
24. As a drummer reading the sheet, I want a flam written as a single grace note before the
    stroke, so that the chart matches what standard drum notation looks like.
25. As a drummer reading the sheet, I want a drag written as two beamed grace notes, so that it
    is distinguishable from a flam on the page.
26. As a drummer reading the sheet, I want the grace note drawn on the snare's own line, so
    that it is obvious which drum plays the grace.
27. As a drummer reading the sheet, I want the grace notes drawn without a slash, so that the
    chart follows the standardised drumset notation rather than melodic acciaccatura.
28. As a drummer reading the sheet, I want a variation to leave the underlying rhythm untouched,
    so that adding an accent never changes note values, rests or beaming.
29. As a drummer reading the sheet, I want grace notes not to disturb the alignment between the
    hand and foot parts, so that simultaneous strokes still share a column.
30. As a drummer reading the sheet, I want an accented stroke that also carries a hi-hat to be
    written with one accent mark, so that the chart reads the way a real chart does rather than
    trying to accent one head of a shared stem.

### Hearing it

31. As a drummer pressing play, I want accented hits to sound louder, so that the loop I hear
    matches the loop I drew.
32. As a drummer pressing play, I want ghosted hits to sound quieter, so that the groove
    breathes instead of sounding mechanical.
33. As a drummer pressing play, I want a flam to sound as a quiet grace strike just before the
    main hit, so that I hear one thickened stroke rather than two separate notes.
34. As a drummer pressing play, I want a drag to sound as two quiet grace strikes before the
    main hit, so that it is audibly different from a flam.
35. As a drummer pressing play, I want a flam to sound like a flam at every tempo, so that
    slowing the loop down to learn it does not turn the flam into a written-out figure.
36. As a drummer pressing play, I want a flam on the very first step of the loop to sound
    correctly, so that the loop's downbeat is not silently broken.
37. As a drummer pressing play, I want to change a hit's variation while the loop is running
    and hear it on the next pass, so that I can dial in a groove by ear.
38. As a drummer, I want the playhead to keep landing on the beat regardless of grace strikes,
    so that the highlight still tells me where I am.

### Sharing and returning

39. As a drummer, I want my variations included in the share link, so that the groove I send
    someone is the groove I drew and not a flattened version of it.
40. As a drummer, I want my variations autosaved, so that closing the tab and coming back does
    not lose the feel I worked out.
41. As a drummer, I want a share link to stay short enough to paste anywhere, so that sharing
    stays as easy as it is today.
42. As a drummer opening a link, I want a link that has become invalid to drop me on the
    starter beat rather than a broken page, so that a stale URL is never a dead end.
43. As a drummer, I want my variations to survive an export of the sheet, so that the printed
    or copied image carries the accent marks and grace notes.

### Reaching it without a mouse

44. As a keyboard user, I want to open the variation menu on the focused cell, so that the
    feature is not gated behind a right-click I cannot perform.
45. As a keyboard user, I want to move through the menu's options and choose one with the
    keyboard, so that I can complete the action once I have opened it.
46. As a keyboard user, I want focus to return to the cell after I choose or dismiss, so that I
    do not lose my position in the grid.
47. As a screen reader user, I want a cell to announce which variation it holds, so that the
    grid's meaning is not carried by its appearance alone.
48. As a screen reader user, I want the menu's options to announce which one is currently set,
    so that I know what I am changing from.

### Growing the kit

49. As the app's author, I want each drum to declare which variations it accepts, so that
    adding a cymbal choke later is a change to one row rather than a new exception to a general
    rule.
50. As the app's author, I want a variation that a drum does not accept to be rejected wherever
    it enters the app, so that no unwritable pattern can be drawn, decoded, shared or played.
51. As the app's author, I want the menu built from the drum's own declaration, so that adding
    a variation to a drum needs no edit to the interface.
52. As the app's author, I want combining two variations to be impossible rather than merely
    forbidden, so that no guard has to be written and maintained at each entry point.
53. As the app's author, I want the notation engine to keep deciding what is written and the
    renderer to keep only drawing it, so that the new marks stay testable without a browser.

## Implementation Decisions

### The pattern

- A cell stops being a boolean and becomes a single value drawn from a closed set: off, plain,
  accent, ghost, flam, drag. Exactly one at a time — combinations are unrepresentable rather
  than validated away. Recorded in ADR-0012.
- The Pattern's glossary entry for a **Hit** widens to cover how the hit is struck. No new
  vocabulary term is introduced; the five values are the whole vocabulary.
- The existing toggle operation stays, serving left-click: off becomes plain, and anything at
  all becomes off. A new setter takes an explicit variation and serves the menu. Both remain
  pure, returning the same pattern when they decline a change, so the sketchpad's existing
  identity-means-no-change rule keeps working.
- The setter refuses a variation the drum does not accept by returning the pattern unchanged,
  matching how the toggle already ignores an out-of-range step.
- The starter beat is unchanged: plain hits only.

### The kit

- Each drum's row gains the list of variations that drum accepts beyond plain. The kit remains
  the only place the fact is stated, and the kit publishes the question "does this drum accept
  this variation?" for everyone else to ask. Recorded in ADR-0013.
- The table: kick takes an accent; the snare takes accent, ghost, flam and drag; both hi-hats
  and the ride take an accent; the crash takes none. A cymbal choke is anticipated but not
  built.
- The set of variations stays one global list; what is per-drum is which members of it that
  drum admits.

### The notation model and engine

- Each fact sits on the object it is drawn against: ghosting on the notehead, accenting and
  grace notes on the note. Recorded in ADR-0014.
- Accenting is ORed across the drums struck at one step: if any of them is accented, the note
  carries one accent mark. The pattern retains which drum was meant; the staff cannot show it,
  and does not try.
- The grace notes are described fully in the model — their note values, whether they are
  beamed, whether they are slashed — so that the conventions live in the engine as data and are
  asserted without a browser. A flam is one unslashed eighth; a drag is two unslashed
  thirty-seconds, beamed. Neither is slurred to its main note.
- Variations do not affect stroke durations, rests, dots or beam grouping. The rhythm the
  engine writes is exactly the rhythm it writes today.
- The note value vocabulary gains the thirty-second, and it is added to the table that also
  answers which grid resolutions the staff can write. That table is the single source for both
  facts by design, so thirty-second-resolution grids become writable as a consequence — which
  ADR-0011 explicitly predicted. The beaming rule is widened to match. There is no interface
  for choosing such a grid, so it remains reachable only through a crafted link.

### The renderer

- The renderer gains the three drawing translations — an accent mark, notehead parentheses, and
  a grace note group — and no musical decisions. It derives only which side of the staff an
  accent sits on, from the part's stem direction, which is the same mechanical mapping it
  already makes for stems.

### The encoded pattern

- A cell occupies one nibble, two per byte, with nothing straddling a byte boundary. Sixteen
  states leaves room for the choke and for variations not yet imagined.
- The format version is bumped. Strings written by the current version stop decoding and fall
  back to the autosave and then to the starter beat. No reader for the old format is written,
  because the roadmap's additional drums will break those strings again regardless.
- A decoded cell whose variation the drum does not accept rejects the whole string, matching
  how an unsupported grid is already handled. Decoding yields only patterns the app considers
  valid; there is no repair step.

### The sketchpad and the grid

- Every state transition stays behind the sketchpad seam; the grid component calls into it and
  holds no transition of its own.
- The menu is built on the platform's own popover, so top-layer stacking, dismissal on Escape
  and dismissal on an outside click are not hand-written. Positioning, focus movement and
  arrow-key navigation are.
- The menu opens from a right-click, from the keyboard keys that already emit the same event,
  and from an explicit key on the focused cell for keyboards that have neither. The exact key
  is chosen to keep the handling minimal.
- The menu lists plain followed by that drum's variations, with the current one marked, and
  opens on filled and empty cells alike.
- Cell marks: an accent is a `>`, a ghost is a dimmer inset fill, and a flam and a drag carry
  one and two pips on the cell's leading edge. Each cell's accessible label names its variation.

### The audio engine

- Each drum's trigger takes a velocity. Ghosts sound at roughly a third, plain hits at roughly
  four fifths, accents at full. Velocity is the only mechanism — no per-hit envelope or filter
  changes, so the engine stays the thin adapter it is.
- Flams and drags schedule extra quiet strikes a fixed number of milliseconds before the main
  hit, not a fraction of the step, so the gesture is identical at every tempo. The offsets are
  clamped so a grace at the very start of the loop is never scheduled in the past.
- Nothing about the playhead changes: it continues to mark the step, not the grace.

### Verification

- The engine's decisions — which notes carry accents, which noteheads are parenthesised, what
  each grace group contains — are asserted as plain data without a browser, as the engine's
  existing cases are.
- The drawn output is pinned by the browser-based visual check, with a fixture for each
  variation plus one case of an accented drum sharing a step with an unaccented cymbal, which
  is what pins the ORing behaviour.

### Sequencing

The work is cut into four vertical slices, each going from the pattern through to sound and
each independently shippable:

1. **Accent.** Carries all the re-plumbing — the widened cell, the kit's new column, the new
   encoding and format version, the new setter, the menu widget, the grid mark, and velocity.
   It is the largest slice because it is the one that changes everything, and the simplest
   variation to draw.
2. **Ghost.** One notehead flag, one drawing modifier, one grid mark, one velocity.
3. **The thirty-second note value.** Small, and separated so that unlocking thirty-second grids
   is tested as the roadmap item it is rather than smuggled in beneath the drags.
4. **Flam and drag.** The grace group in the model, the grace drawing in the renderer, the pips
   on the grid, and the grace scheduling in the audio engine.

## Out of Scope

- **Combining variations.** Accented flams and ghosted drags are real playing and are
  deliberately not written by drumscore. Adding them is re-opening ADR-0012, not extending it.
- **Cymbal choke.** Named as the reason the variation list is per-drum, and not built. The
  crash therefore accepts nothing beyond a plain hit for now.
- **Rudiments on drums other than the snare.** Ruffs, four-stroke ruffs, buzz rolls and
  anything beyond a flam and a drag.
- **Velocity as a continuous value.** There are three loudnesses, named, not a slider.
- **Timbre changes.** A real ghost note is duller as well as quieter; drumscore's is only
  quieter.
- **Touch support.** Long-press to open the menu waits for the roadmap item that makes the whole
  app usable on small screens, where the grid is rethought anyway.
- **A user interface for thirty-second grids.** The note value lands; a control for choosing
  that resolution does not, so the roadmap's "32nd notes" item stays unticked.
- **Reading old share links.** Strings written by the current format version stop decoding.
- **A key on the sheet explaining the marks.** The staff draws standard notation and assumes a
  reader who knows it.
- **Additional drums.** Toms, hi-hat foot, ride bell and cowbell remain on the roadmap and are
  untouched here, though the per-drum variation list is what makes adding their rudiments cheap.

## Further Notes

**The decisions are already recorded.** Three ADRs were written before this PRD and carry the
reasoning, the rejected alternatives and the consequences: ADR-0012 on a hit carrying exactly
one variation, ADR-0013 on the kit declaring which variations a drum accepts, and ADR-0014 on
an accent being written once per chord. ADR-0009 carries a forward reference to ADR-0013. This
PRD should not restate their arguments; where the two disagree, the ADRs are the record.

**The accent is deliberately lossy on the staff and only on the staff.** An accented snare
beside a plain hi-hat draws identically to both accented. This looks like a defect in a diff
and is not one — it is how drum charts are written, and the pattern itself never loses which
drum was meant.

**The snare shares its staff part with every cymbal**, so the chord cases are the common cases
rather than the edge cases. Any work here that assumes a drum is struck alone is wrong on the
first bar of the starter beat.

**The thirty-second is a load-bearing side effect.** Adding it to the note value table is what
lets a drag be drawn, and the same table is what decides which grid resolutions are writable.
That coupling is intentional and documented in ADR-0011; the alternative was a carve-out that
would have to be un-invented later.

**Grace timings and velocities are starting values.** They are held in one place and expected
to be tuned by ear after the feature works. They are not worth debating before there is
something to listen to.

**The roadmap gains two ticks, not three.** "Flams and drags" and "dynamics: accents and ghost
notes" are completed by this work. "32nd notes" is not, because no interface exists for
choosing that resolution.
