import { Formatter, Renderer, Stave, StaveNote, Stem, Voice } from 'vexflow';
import type {
  NotationEvent,
  NotationModel,
  NotationPart,
  Notehead,
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

function keyOf({ style, position }: Notehead): string {
  return keyFor(position, style === 'cross' ? '/x' : '');
}

/** VexFlow spells a rest as the note value's code with an `r` suffix. */
function toStaveNote(event: NotationEvent, stemDirection: StemDirection): StaveNote {
  const isRest = event.kind === 'rest';

  return new StaveNote({
    keys: isRest ? [keyFor(event.position)] : event.noteheads.map(keyOf),
    duration: DURATION_CODES[event.value] + (isRest ? 'r' : ''),
    stemDirection: STEM_DIRECTIONS[stemDirection],
    clef: CLEF,
  });
}

const HEIGHT = 160;
const STAVE_TOP = 32;
const STAVE_LEFT = 10;
/** The first measure also carries the clef and time signature, so it needs more room. */
const FIRST_MEASURE_EXTRA_WIDTH = 60;
const MIN_MEASURE_WIDTH = 180;

function toVoice(part: NotationPart, beats: number, beatValue: number): Voice {
  const notes = part.events.map((event) => toStaveNote(event, part.stemDirection));
  const voice = new Voice({ numBeats: beats, beatValue });
  voice.addTickables(notes);

  return voice;
}

export function renderNotation(container: HTMLDivElement, model: NotationModel, width: number) {
  container.replaceChildren();

  const { beats, beatValue } = model.timeSignature;
  const measureCount = model.measures.length;
  if (measureCount === 0) return;

  const plainWidth = Math.max(
    MIN_MEASURE_WIDTH,
    (width - STAVE_LEFT * 2 - FIRST_MEASURE_EXTRA_WIDTH) / measureCount,
  );

  const renderer = new Renderer(container, Renderer.Backends.SVG);
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

    const voices = measure.parts
      .filter((part) => part.events.length > 0)
      .map((part) => toVoice(part, beats, beatValue));

    if (voices.length > 0) {
      // formatToStave measures the room left after the clef and time signature, so the
      // first measure's notes stay clear of them. Joining the parts first lines the hands
      // up with the feet, so simultaneous strokes share a column.
      new Formatter().joinVoices(voices).formatToStave(voices, stave);

      for (const voice of voices) voice.draw(context, stave);
    }

    x += measureWidth;
  }
}
