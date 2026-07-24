import { Formatter, Renderer, Stave, StaveNote, Voice } from 'vexflow';
import type { NotationEvent, NotationModel, NoteValue } from './model';

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

/**
 * Rests sit in the middle of the staff, except the whole rest, which by convention
 * hangs from the line above.
 */
const REST_KEYS: Partial<Record<NoteValue, string>> = { whole: 'd/5' };
const DEFAULT_REST_KEY = 'b/4';

const HEIGHT = 140;
const STAVE_TOP = 24;
const STAVE_LEFT = 10;
/** The first measure also carries the clef and time signature, so it needs more room. */
const FIRST_MEASURE_EXTRA_WIDTH = 60;
const MIN_MEASURE_WIDTH = 180;

/** VexFlow spells a rest as the note value's code with an `r` suffix. */
function toStaveNote(event: NotationEvent): StaveNote {
  const isRest = event.kind === 'rest';

  return new StaveNote({
    keys: [isRest ? (REST_KEYS[event.value] ?? DEFAULT_REST_KEY) : PLACEHOLDER_KEY],
    duration: DURATION_CODES[event.value] + (isRest ? 'r' : ''),
    clef: CLEF,
  });
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

    if (measure.events.length > 0) {
      const voice = new Voice({ numBeats: beats, beatValue });
      voice.addTickables(measure.events.map(toStaveNote));

      // formatToStave measures the room left after the clef and time signature, so the
      // first measure's notes stay clear of them.
      new Formatter().joinVoices([voice]).formatToStave([voice], stave);
      voice.draw(context, stave);
    }

    x += measureWidth;
  }
}
