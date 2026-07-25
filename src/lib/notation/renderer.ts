// `vexflow/core` is the library without its six bundled fonts; the two this app draws
// with are registered by `./fonts`, which this module waits on before it draws.
import { Beam, Dot, Formatter, Renderer, Stave, StaveNote, Stem, Voice } from 'vexflow/core';
import type { SVGContext } from 'vexflow/core';
import { notationFontsReady } from './fonts';
import type {
  NotationEvent,
  NotationModel,
  NotationPart,
  Notehead,
  NoteheadStyle,
  NoteValue,
  StaffPosition,
  StemDirection,
} from './model';

/**
 * The thin adapter that draws a NotationModel with VexFlow's SVG backend. It holds no
 * musical logic — everything it draws is decided by the notation engine.
 */

const CLEF = 'percussion';

/** VexFlow's duration codes for the note values the engine emits. */
const DURATION_CODES: Record<NoteValue, string> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  sixteenth: '16',
};

const STEM_DIRECTIONS: Record<StemDirection, number> = {
  up: Stem.UP,
  down: Stem.DOWN,
};

/**
 * VexFlow reads a notehead as `letter/octave`, optionally followed by a glyph code. `X`
 * is the cross, and it picks the right weight for the note value on its own.
 */
function keyFor(position: StaffPosition, glyph = ''): string {
  return `${position.step}/${position.octave}${glyph}`;
}

/**
 * A record rather than a conditional, so the compiler is what catches a missing entry. A
 * style VexFlow does not know is drawn as an ordinary notehead without complaint — at
 * build time, at draw time and on screen — so widening `NoteheadStyle` has to fail here,
 * in the one place that knows what the glyph should be.
 */
const NOTEHEAD_GLYPHS: Record<NoteheadStyle, string> = {
  normal: '',
  cross: '/x',
};

function keyOf({ style, position }: Notehead): string {
  return keyFor(position, NOTEHEAD_GLYPHS[style]);
}

/** VexFlow spells a rest as the note value's code with an `r` suffix. */
function toStaveNote(event: NotationEvent, stemDirection: StemDirection): StaveNote {
  const isRest = event.kind === 'rest';
  // The count feeds the tick math; the glyph is a separate modifier that must be attached.
  const dots = event.dots;

  const note = new StaveNote({
    keys: isRest ? [keyFor(event.position)] : event.noteheads.map(keyOf),
    duration: DURATION_CODES[event.value] + (isRest ? 'r' : ''),
    dots,
    stemDirection: STEM_DIRECTIONS[stemDirection],
    clef: CLEF,
  });
  if (dots > 0) Dot.buildAndAttach([note], { all: true });

  return note;
}

const HEIGHT = 160;
const STAVE_TOP = 32;
const STAVE_LEFT = 10;
/** The first measure also carries the clef and time signature, so it needs more room. */
const FIRST_MEASURE_EXTRA_WIDTH = 60;
const MIN_MEASURE_WIDTH = 180;

interface DrawablePart {
  voice: Voice;
  beams: Beam[];
}

/**
 * A part becomes a voice plus the beams over it. The beams are built from the same
 * StaveNote objects the voice holds — creating a Beam suppresses those notes' flags — so
 * they must be constructed here, then drawn after the voice, once the notes are placed.
 */
function toDrawablePart(part: NotationPart, beats: number, beatValue: number): DrawablePart {
  const notes = part.events.map((event) => toStaveNote(event, part.stemDirection));
  const voice = new Voice({ numBeats: beats, beatValue });
  voice.addTickables(notes);

  const byStep = new Map(part.events.map((event, index) => [event.step, notes[index]]));
  const beams = part.beams.map(
    (group) => new Beam(group.steps.map((step) => byStep.get(step) as StaveNote)),
  );

  return { voice, beams };
}

/**
 * Draws a NotationModel at the given width and resolves to the `<svg>` it drew — or null
 * when the model has no measures. Where that element goes is the caller's business.
 *
 * Asynchronous on purpose. VexFlow sizes every glyph against Bravura through
 * `canvas.measureText`, so drawing before the font arrives measures against whatever face
 * the browser falls back to and puts stems and beams in the wrong place — silently, and
 * only until some later redraw. Waiting here rather than at the call sites means no caller
 * can draw too early. Rejects if the fonts never load, having drawn nothing.
 */
export async function renderNotation(
  model: NotationModel,
  width: number,
): Promise<SVGSVGElement | null> {
  await notationFontsReady;

  const { beats, beatValue } = model.timeSignature;
  const measureCount = model.measures.length;
  if (measureCount === 0) return null;

  const plainWidth = Math.max(
    MIN_MEASURE_WIDTH,
    (width - STAVE_LEFT * 2 - FIRST_MEASURE_EXTRA_WIDTH) / measureCount,
  );

  // VexFlow builds into an element it is given, so it gets a throwaway one and only the
  // `<svg>` inside comes back out. Glyphs are measured against a standalone canvas rather
  // than live layout, so nothing here needs the host to be in the document.
  const host = document.createElement('div');
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(STAVE_LEFT * 2 + plainWidth * measureCount + FIRST_MEASURE_EXTRA_WIDTH, HEIGHT);
  const context = renderer.getContext();

  let x = STAVE_LEFT;

  for (const [index, measure] of model.measures.entries()) {
    const isFirst = index === 0;
    const measureWidth = plainWidth + (isFirst ? FIRST_MEASURE_EXTRA_WIDTH : 0);

    const stave = new Stave(x, STAVE_TOP, measureWidth);
    if (isFirst) {
      stave.addClef(CLEF).addTimeSignature(`${beats}/${beatValue}`);
    }
    stave.setContext(context).draw();

    const drawable = measure.parts
      .filter((part) => part.events.length > 0)
      .map((part) => toDrawablePart(part, beats, beatValue));
    const voices = drawable.map(({ voice }) => voice);

    if (voices.length > 0) {
      // formatToStave measures the room left after the clef and time signature, so the
      // first measure's notes stay clear of them. Joining the parts first lines the hands
      // up with the feet, so simultaneous strokes share a column.
      new Formatter().joinVoices(voices).formatToStave(voices, stave);

      for (const voice of voices) voice.draw(context, stave);
      // Beams draw after the notes are placed; each already suppressed its notes' flags.
      for (const { beams } of drawable) for (const beam of beams) beam.setContext(context).draw();
    }

    x += measureWidth;
  }

  return (context as SVGContext).svg;
}
