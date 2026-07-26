import { KIT, type KitVoice } from '$lib/kit';
import { isHit, stepsPerBar, type GridDimensions, type Pattern } from '$lib/pattern';
import {
  VALUES_PER_WHOLE,
  type BeamGroup,
  type NotationEvent,
  type NotationMeasure,
  type NotationModel,
  type NotationPart,
  type Notehead,
  type NoteValue,
  type PartId,
  type StaffPosition,
  type StemDirection,
} from './model';

/**
 * Translate a pattern into the notation model.
 *
 * The staff carries two rhythms rather than one: the hands, stems up, and the feet,
 * stems down. Each is written from its own hits, so a snare on 2 and 4 is not chopped up
 * by the kick playing underneath it, and each fills its own measure with its own rests.
 * Drums struck together in the same part become one chord.
 *
 * Every voice is struck, not held: a stroke is written as a note no longer than its own
 * beat and the time until the next hit is filled with rests. That is what turns a grid of
 * 16th-note cells into readable rhythm while keeping the pulse visible, and it is the same
 * treatment for every drum — the crash and the open hi-hat included.
 *
 * Which drums there are, how each one is written and which part it is written into are the
 * Kit's answers, read from there rather than restated here. What stays is what is true of a
 * part rather than of a drum.
 */

/** How a part is written: which way its stems point, and where its rests sit. */
interface Part {
  id: PartId;
  stemDirection: StemDirection;
  /** Rests keep out of the noteheads' way by sitting in their own part of the staff. */
  restPosition: StaffPosition;
  /** The whole rest is the odd one out: it hangs from the line above the others. */
  wholeRestPosition: StaffPosition;
}

const PARTS: readonly Part[] = [
  {
    id: 'hands',
    stemDirection: 'up',
    restPosition: { step: 'b', octave: 4 },
    wholeRestPosition: { step: 'd', octave: 5 },
  },
  {
    id: 'feet',
    stemDirection: 'down',
    restPosition: { step: 'f', octave: 4 },
    wholeRestPosition: { step: 'g', octave: 4 },
  },
];

/**
 * The drums written into one part, in canonical order — a filter over the Kit rather than a
 * second list beside it, so the two cannot disagree about which drum belongs where.
 */
function voicesOf(part: Part): readonly KitVoice[] {
  return KIT.filter((voice) => voice.part === part.id);
}

interface Duration {
  value: NoteValue;
  /** Augmentation dots; 1 makes the value half again as long. */
  dots: number;
  steps: number;
  /** A value may begin only where the step is a multiple of this. */
  align: number;
}

/**
 * The plain (undotted) note values expressible at this resolution, longest first. Derived
 * from the dimensions rather than hardcoded, so a finer grid or a different beat value
 * just yields a different table. Each aligns to its own length, so a half note only
 * begins on a half-note boundary, a quarter only on a beat, and so on.
 */
function plainDurations(dimensions: GridDimensions): Duration[] {
  const stepsPerWhole = dimensions.stepsPerBeat * dimensions.beatValue;

  return VALUES_PER_WHOLE.map(([value, perWhole]) => ({
    value,
    dots: 0,
    steps: stepsPerWhole / perWhole,
    align: stepsPerWhole / perWhole,
  })).filter(({ steps }) => Number.isInteger(steps) && steps >= 1);
}

/**
 * The dotted form of each plain value, longest first.
 *
 * A dot lengthens a value by half, so a dotted eighth spans three sixteenths — exactly the
 * gap that a bare eighth leaves a rest dangling off. A dotted value aligns to twice its
 * plain length, one binary level coarser: a dotted eighth begins only on a beat, so its
 * borrowed sixteenth falls inside that beat rather than reaching across the next one.
 */
function dottedDurations(plain: Duration[]): Duration[] {
  return plain
    .map(({ value, steps }) => ({ value, dots: 1, steps: steps * 1.5, align: steps * 2 }))
    .filter(({ steps }) => Number.isInteger(steps));
}

const byLongest = (a: Duration, b: Duration): number => b.steps - a.steps;

/** The plain values plus every dotted form, longest first — the vocabulary for notes. */
function noteDurations(dimensions: GridDimensions): Duration[] {
  const plain = plainDurations(dimensions);

  return [...plain, ...dottedDurations(plain)].sort(byLongest);
}

/**
 * The plain values plus the dotted forms that fit inside a single beat, longest first.
 *
 * A dotted rest reads cleanly only when it stays within one beat, so it never swallows a
 * beat line the way a dotted half rest across three beats would. That is the same bound a
 * struck note lives under, so notes and rests dot in step: where a beat's silence is three
 * sixteenths from its start, it becomes one dotted-eighth rest, not an eighth and a
 * sixteenth rest.
 */
function restDurations(dimensions: GridDimensions): Duration[] {
  const plain = plainDurations(dimensions);
  const dotted = dottedDurations(plain).filter(({ steps }) => steps <= dimensions.stepsPerBeat);

  return [...plain, ...dotted].sort(byLongest);
}

/**
 * The longest duration that fits in `length` and may legally begin on `step`.
 *
 * The alignment test is what keeps the rhythm readable: nothing straddles a subdivision it
 * has no business crossing.
 *
 * There is always an answer, but not by luck: `isSupportedGrid` admits only grids on which
 * some note value spans exactly one step, and a one-step value aligns to 1 and so fits any
 * step and any length of 1 or more. That predicate is the guarantee the throw below rests
 * on — the grids it refuses are exactly the ones that would reach it.
 */
function longestFit(table: Duration[], step: number, length: number): Duration {
  const fit = table.find((duration) => duration.steps <= length && step % duration.align === 0);

  /* v8 ignore next -- unreachable while `isSupportedGrid` guards the door; see above */
  if (!fit) throw new Error(`no note value fits ${length} step(s) at step ${step}`);

  return fit;
}

interface Piece extends Duration {
  step: number;
}

/**
 * Cover `length` steps from `step` with as few legal values as the alignment rule
 * allows.
 *
 * Because each piece has to be able to start where the previous one ended, the splits
 * land on the metrical boundaries a reader looks for: a span crossing a beat is cut at
 * that beat, and a span of 3, 5 or 7 sixteenths comes back as the pieces summing to it.
 */
function split(table: Duration[], step: number, length: number): Piece[] {
  const pieces: Piece[] = [];

  for (let at = step, left = length; left > 0;) {
    const fit = longestFit(table, at, left);
    pieces.push({ step: at, ...fit });
    at += fit.steps;
    left -= fit.steps;
  }

  return pieces;
}

function restsFor(table: Duration[], part: Part, step: number, length: number): NotationEvent[] {
  return split(table, step, length).map(({ step: at, value, dots }) => ({
    kind: 'rest',
    step: at,
    value,
    dots,
    position: value === 'whole' ? part.wholeRestPosition : part.restPosition,
  }));
}

interface Hit {
  step: number;
  noteheads: Notehead[];
}

/**
 * How one hit is written: the longest value that fits the gap to the next hit without
 * outlasting its own beat. Drums are struck, so what is left of the gap becomes rests.
 */
function strokeFor(table: Duration[], hit: Hit, gap: number, beatSteps: number): Duration {
  return longestFit(table, hit.step, Math.min(gap, beatSteps));
}

const DIATONIC: readonly string[] = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

/** How high a position sits, so a chord's noteheads can be ordered bottom to top. */
function heightOf({ step, octave }: StaffPosition): number {
  return octave * DIATONIC.length + DIATONIC.indexOf(step);
}

/**
 * The chord struck at one step, low to high.
 *
 * Drums sharing a position and a notehead — the two hi-hats, which v1 tells apart only by
 * whether they ring — collapse into one head, because writing them twice would stack two
 * identical glyphs on the same line.
 */
function noteheadsAt(pattern: Pattern, voices: readonly KitVoice[], at: number): Notehead[] {
  const struck = voices.filter((voice) => isHit(pattern, voice.id, at));
  const heads = new Map(
    struck.map(({ notehead: head }) => [
      `${head.style}:${head.position.step}${head.position.octave}`,
      head,
    ]),
  );

  return [...heads.values()].sort((a, b) => heightOf(a.position) - heightOf(b.position));
}

/** The hits of one part within one bar, at steps relative to that bar. */
function hitsIn(pattern: Pattern, part: Part, bar: number, barLength: number): Hit[] {
  const voices = voicesOf(part);
  const hits: Hit[] = [];

  for (let step = 0; step < barLength; step += 1) {
    const at = bar * barLength + step;
    const noteheads = noteheadsAt(pattern, voices, at);

    if (noteheads.length > 0) hits.push({ step, noteheads });
  }

  return hits;
}

/** The note values worth beaming: everything shorter than a beat carries a flag. */
const BEAMABLE: ReadonlySet<NoteValue> = new Set<NoteValue>(['eighth', 'sixteenth']);

/**
 * Group the flagged notes into beams the conventional way: one beam per beat.
 *
 * A run is broken by anything that cannot join it — a rest, an unflagged note, or the
 * start of a new beat — so the beat stays visible through the beaming, just as it does
 * through the note values. A lone flagged note keeps its flag; a beam needs at least two.
 */
function beamsFor(events: NotationEvent[], stepsPerBeat: number): BeamGroup[] {
  const groups: BeamGroup[] = [];
  let run: number[] = [];
  let beat = -1;

  const flush = () => {
    if (run.length >= 2) groups.push({ steps: run });
    run = [];
  };

  for (const event of events) {
    if (event.kind !== 'note' || !BEAMABLE.has(event.value)) {
      flush();
      continue;
    }

    const eventBeat = Math.floor(event.step / stepsPerBeat);
    if (eventBeat !== beat) {
      flush();
      beat = eventBeat;
    }
    run.push(event.step);
  }
  flush();

  return groups;
}

interface Tables {
  /** Rests dot only within a beat, so a silence never hides a beat line. */
  rest: Duration[];
  /** Notes may take a dot, so a struck span reads as one head, not a note and a rest. */
  note: Duration[];
}

function partFor(pattern: Pattern, part: Part, bar: number, tables: Tables): NotationPart {
  const { stepsPerBeat } = pattern.dimensions;
  const barLength = stepsPerBar(pattern.dimensions);
  const hits = hitsIn(pattern, part, bar, barLength);

  const events: NotationEvent[] = [];
  let filled = 0;

  for (const [index, hit] of hits.entries()) {
    // Notes stop at the bar line; a hit's tail never carries into the next measure.
    const until = hits[index + 1]?.step ?? barLength;
    const stroke = strokeFor(tables.note, hit, until - hit.step, stepsPerBeat);

    events.push(...restsFor(tables.rest, part, filled, hit.step - filled), {
      kind: 'note',
      step: hit.step,
      value: stroke.value,
      dots: stroke.dots,
      noteheads: hit.noteheads,
    });
    filled = hit.step + stroke.steps;
  }

  events.push(...restsFor(tables.rest, part, filled, barLength - filled));

  return {
    id: part.id,
    stemDirection: part.stemDirection,
    events,
    beams: beamsFor(events, stepsPerBeat),
  };
}

export function toNotation(pattern: Pattern): NotationModel {
  const { dimensions } = pattern;
  const tables: Tables = { rest: restDurations(dimensions), note: noteDurations(dimensions) };

  return {
    timeSignature: { beats: dimensions.beatsPerBar, beatValue: dimensions.beatValue },
    measures: Array.from({ length: dimensions.bars }, (_, bar): NotationMeasure => ({
      parts: PARTS.map((part) => partFor(pattern, part, bar, tables)),
    })),
  };
}
