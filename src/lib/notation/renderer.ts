import { Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import type { NotationModel, NoteValue } from './model';

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

/**
 * Every notehead sits on the same line for now. Phase 4 gives each one its own staff
 * position and `x`/normal style per percussion convention.
 */
const PLACEHOLDER_KEY = 'c/5';

const HEIGHT = 140;
const STAVE_TOP = 24;
const STAVE_LEFT = 10;
/** The first measure also carries the clef and time signature, so it needs more room. */
const FIRST_MEASURE_EXTRA_WIDTH = 60;
const MIN_MEASURE_WIDTH = 180;

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

    if (measure.notes.length > 0) {
      const notes = measure.notes.map(
        (note) =>
          new StaveNote({
            keys: [PLACEHOLDER_KEY],
            duration: DURATION_CODES[note.value],
            clef: CLEF,
          }),
      );

      // SOFT mode: until the engine emits rests, a measure's notes rarely add up to a
      // full bar, and a strict voice would refuse to format.
      const voice = new Voice({ numBeats: beats, beatValue }).setMode(Voice.Mode.SOFT);
      voice.addTickables(notes);

      // formatToStave measures the room left after the clef and time signature, so the
      // first measure's notes stay clear of them.
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(context, stave);
    }

    x += measureWidth;
  }
}
