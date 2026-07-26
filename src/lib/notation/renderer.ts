// `vexflow/core` is the library without its six bundled fonts; the two this app draws
// with are registered by `./fonts`, which this module waits on before it draws.
import {
  Articulation,
  Beam,
  Dot,
  Formatter,
  Modifier,
  Renderer,
  Stave,
  StaveNote,
  Stem,
  Voice,
} from 'vexflow/core';
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
 * Draws a NotationModel with VexFlow's SVG backend. No musical logic — everything it draws
 * was decided by the notation engine.
 */

const CLEF = 'percussion';

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

/** VexFlow's articulation code for `>`. */
const ACCENT = 'a>';

/** Above for the hands, below for the feet, so it never lands in the other part's way. */
const ACCENT_POSITIONS: Record<StemDirection, number> = {
  up: Modifier.Position.ABOVE,
  down: Modifier.Position.BELOW,
};

/**
 * VexFlow reads a notehead as `letter/octave` plus an optional glyph code. `X` is the
 * cross and picks its own weight per note value. `DI` (the diamond) behaves the same, so a
 * ride bell wants `/di`, not `/d0`–`/d3`, which pin one weight and draw a whole note black.
 */
function keyFor(position: StaffPosition, glyph = ''): string {
  return `${position.step}/${position.octave}${glyph}`;
}

/**
 * A record so the compiler catches a missing entry: a style VexFlow does not know draws as
 * an ordinary notehead without complaint, at build time and on screen alike.
 */
const NOTEHEAD_GLYPHS: Record<NoteheadStyle, string> = {
  normal: '',
  cross: '/x',
};

function keyOf({ style, position }: Notehead): string {
  return keyFor(position, NOTEHEAD_GLYPHS[style]);
}

/** VexFlow spells a rest as the value's code with an `r` suffix. */
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
  if (!isRest && event.accented) {
    note.addModifier(new Articulation(ACCENT).setPosition(ACCENT_POSITIONS[stemDirection]));
  }

  return note;
}

const HEIGHT = 160;
const STAVE_TOP = 32;
const STAVE_LEFT = 10;
/** The first measure also carries the clef and time signature. */
const FIRST_MEASURE_EXTRA_WIDTH = 60;
const MIN_MEASURE_WIDTH = 180;

interface DrawablePart {
  voice: Voice;
  beams: Beam[];
}

/**
 * Beams are built from the same StaveNote objects the voice holds — creating a Beam
 * suppresses those notes' flags — so they must be constructed here and drawn after the
 * voice, once the notes are placed.
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
 * Draws at the given width and resolves to the `<svg>` — or null when there are no
 * measures. Where that element goes is the caller's business.
 *
 * Async on purpose: VexFlow sizes every glyph against Bravura via `canvas.measureText`, so
 * drawing before the font arrives measures a fallback face and misplaces stems and beams —
 * silently, until some later redraw. Waiting here means no caller can draw too early.
 * Rejects if the fonts never load, having drawn nothing.
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
  // `<svg>` comes back out. Glyphs measure against a standalone canvas, not live layout,
  // so the host need not be in the document.
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
      // first measure's notes stay clear of them. Joining first lines the hands up with
      // the feet, so simultaneous strokes share a column.
      new Formatter().joinVoices(voices).formatToStave(voices, stave);

      for (const voice of voices) voice.draw(context, stave);
      // After the notes are placed; each beam already suppressed its notes' flags.
      for (const { beams } of drawable) for (const beam of beams) beam.setContext(context).draw();
    }

    x += measureWidth;
  }

  return (context as SVGContext).svg;
}
