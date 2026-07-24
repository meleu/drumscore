# The notation engine emits an abstract notation model, not VexFlow objects

The notation engine is a pure function from **Pattern** to **notation model**, with no
import of VexFlow, Tone.js, or the DOM. A separate, thin renderer translates that model
into VexFlow draw calls and holds no musical logic of its own.

The obvious alternative — building `StaveNote`s directly in the engine — was rejected
because the engine carries all the risk in this app (durations, rests, chords, staff
positions, beam grouping) and VexFlow drags a browser in with it: it measures every glyph
through `canvas.measureText`, so an engine coupled to it could only be tested in a real
browser, one glyph position at a time.

## Consequences

The extra model is the price of testing the hard part as plain data — table-driven cases
asserting durations, notehead styles, staff positions and beams, in Node, in
milliseconds. It also means the drawing library is replaceable at one seam. Any proposal
to "cut out the middle model" is trading that away; the two modules are not a pass-through
pair.
