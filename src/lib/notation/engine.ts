import { KIT, type Hit, type KitVoice } from '$lib/kit';
import { hitAt, stepsPerBar, type GridDimensions, type Pattern } from '$lib/pattern';
import {
  VALUES_PER_WHOLE,
  type BeamGroup,
  type GraceGroup,
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
 * Two rhythms, not one: hands stems-up, feet stems-down, each written from its own hits so
 * a snare on 2 and 4 is not chopped up by the kick underneath, and each filling its own
 * measure with its own rests. Drums struck together in one part become a chord.
 *
 * Every voice is struck, not held: a stroke is a note no longer than its own beat, the
 * time until the next hit is rests. Same treatment for every drum, crash and open hi-hat
 * included — that is what turns 16th-note cells into readable rhythm with a visible pulse.
 *
 * An accent reaches the staff as a mark, ORed across the drums sharing that stem. A
 * variation never changes a note value, a rest, a dot or a beam.
 *
 * Which drums exist, how each is written and which part it belongs to are the Kit's
 * answers. What stays here is what is true of a part rather than of a drum.
 */

interface Part {
  id: PartId;
  stemDirection: StemDirection;
  /** Rests keep out of the noteheads' way by sitting in their own part of the staff. */
  restPosition: StaffPosition;
  /** The whole rest hangs from the line above the others. */
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

/** A filter over the Kit rather than a second list, so the two cannot disagree. */
function voicesOf(part: Part): readonly KitVoice[] {
  return KIT.filter((voice) => voice.part === part.id);
}

interface Duration {
  value: NoteValue;
  /** 1 makes the value half again as long. */
  dots: number;
  steps: number;
  /** A value may begin only where the step is a multiple of this. */
  align: number;
}

/**
 * The plain values expressible at this resolution, longest first. Derived from the
 * dimensions, so a finer grid or a different beat value just yields a different table.
 * Each aligns to its own length: a half note only on a half-note boundary, and so on.
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
 * A dotted eighth spans three sixteenths — exactly the gap a bare eighth leaves a rest
 * dangling off. Alignment is twice the plain length, one binary level coarser, so the
 * borrowed sixteenth falls inside its beat rather than reaching across the next one.
 */
function dottedDurations(plain: Duration[]): Duration[] {
  return plain
    .map(({ value, steps }) => ({ value, dots: 1, steps: steps * 1.5, align: steps * 2 }))
    .filter(({ steps }) => Number.isInteger(steps));
}

const byLongest = (a: Duration, b: Duration): number => b.steps - a.steps;

/** Plain plus every dotted form, longest first — the vocabulary for notes. */
function noteDurations(dimensions: GridDimensions): Duration[] {
  const plain = plainDurations(dimensions);

  return [...plain, ...dottedDurations(plain)].sort(byLongest);
}

/**
 * Plain plus the dotted forms fitting inside one beat, longest first.
 *
 * A dotted rest reads cleanly only within a beat, so it never swallows a beat line. Same
 * bound a struck note lives under, so notes and rests dot in step.
 */
function restDurations(dimensions: GridDimensions): Duration[] {
  const plain = plainDurations(dimensions);
  const dotted = dottedDurations(plain).filter(({ steps }) => steps <= dimensions.stepsPerBeat);

  return [...plain, ...dotted].sort(byLongest);
}

/**
 * Longest duration fitting in `length` that may legally begin on `step`. The alignment
 * test keeps the rhythm readable: nothing straddles a subdivision it has no business
 * crossing.
 *
 * There is always an answer: `isSupportedGrid` admits only grids where some value spans
 * exactly one step, and a one-step value aligns to 1. That predicate is what the throw
 * rests on.
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
 * Cover `length` steps from `step` with as few legal values as alignment allows. Since
 * each piece must start where the last ended, splits land on the metrical boundaries a
 * reader looks for: a span crossing a beat is cut at that beat.
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

/** What one part is struck with at one step: the drums, and how the stroke is marked. */
interface Chord {
  step: number;
  noteheads: Notehead[];
  accented: boolean;
  grace: GraceGroup | null;
}

/**
 * The longest value fitting the gap to the next chord without outlasting its own beat.
 * Drums are struck, so what is left of the gap becomes rests.
 */
function strokeFor(table: Duration[], chord: Chord, gap: number, beatSteps: number): Duration {
  return longestFit(table, chord.step, Math.min(gap, beatSteps));
}

const DIATONIC: readonly string[] = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

/** How high a position sits, so a chord's noteheads can be ordered bottom to top. */
function heightOf({ step, octave }: StaffPosition): number {
  return octave * DIATONIC.length + DIATONIC.indexOf(step);
}

/**
 * The chord struck at one step, low to high. Drums sharing a position and notehead — the
 * two hi-hats, which v1 tells apart only by ring — collapse into one head rather than
 * stacking two identical glyphs on the same line; one pair of parentheses covers both,
 * since one glyph is all the reader sees.
 *
 * Ghosting rides on the head rather than on the note: it is drawn round that drum alone.
 */
function noteheadsAt(pattern: Pattern, voices: readonly KitVoice[], at: number): Notehead[] {
  const heads = new Map<string, Notehead>();

  for (const { id, notehead: glyph } of voices) {
    const hit = hitAt(pattern, id, at);
    if (hit === 'off') continue;

    const key = `${glyph.style}:${glyph.position.step}${glyph.position.octave}`;
    const ghosted = heads.get(key)?.ghosted || hit === 'ghost';
    heads.set(key, { ...glyph, ghosted });
  }

  return [...heads.values()].sort((a, b) => heightOf(a.position) - heightOf(b.position));
}

/** A gesture's grace strikes as the convention writes them, before a drum is named. */
interface GraceStrokes extends Omit<GraceGroup, 'notes'> {
  values: NoteValue[];
}

/**
 * What each gesture is written as: the whole convention, as data. A flam is one unslashed
 * eighth; a drag is two unslashed thirty-seconds under a beam. Neither is slurred to the
 * stroke it precedes — the slur and the slash are melodic notation, and drumset charts
 * write these without them.
 *
 * Exhaustive over the union, so a rudiment added to it is a compile error here until it
 * says what it looks like.
 */
const GRACE_STROKES: Record<Hit, GraceStrokes | null> = {
  off: null,
  plain: null,
  accent: null,
  ghost: null,
  flam: { values: ['eighth'], beamed: false, slashed: false, slurred: false },
  drag: { values: ['thirtysecond', 'thirtysecond'], beamed: true, slashed: false, slurred: false },
};

/**
 * The group in front of one chord, or null. The staff has one place for it — ahead of the
 * whole stem — so the first drum of the part carrying a gesture supplies it, lossy in the
 * same way the accent is and for the same reason, with the Pattern keeping what was meant
 * (ADR-0014). The snare is the only drum whose row accepts a gesture, so there is nothing
 * to lose today.
 *
 * The grace notes take that drum's own notehead, which is what puts them on its line.
 */
function graceAt(pattern: Pattern, voices: readonly KitVoice[], at: number): GraceGroup | null {
  for (const { id, notehead } of voices) {
    const strokes = GRACE_STROKES[hitAt(pattern, id, at)];
    if (!strokes) continue;

    const { values, ...shape } = strokes;

    return { ...shape, notes: values.map((value) => ({ value, notehead })) };
  }

  return null;
}

/**
 * Accented if *any* drum struck there is. The staff has one place for the mark, so drums
 * under one stem cannot disagree on the page — an accented snare beside a plain hi-hat
 * draws as one accented note. The Pattern keeps which drum was meant (ADR-0014).
 */
function accentedAt(pattern: Pattern, voices: readonly KitVoice[], at: number): boolean {
  return voices.some((voice) => hitAt(pattern, voice.id, at) === 'accent');
}

/** The chords of one part within one bar, at steps relative to that bar. */
function chordsIn(pattern: Pattern, part: Part, bar: number, barLength: number): Chord[] {
  const voices = voicesOf(part);
  const chords: Chord[] = [];

  for (let step = 0; step < barLength; step += 1) {
    const at = bar * barLength + step;
    const noteheads = noteheadsAt(pattern, voices, at);

    if (noteheads.length > 0) {
      chords.push({
        step,
        noteheads,
        accented: accentedAt(pattern, voices, at),
        grace: graceAt(pattern, voices, at),
      });
    }
  }

  return chords;
}

/** Worth beaming: everything shorter than a beat carries a flag. */
const BEAMABLE: ReadonlySet<NoteValue> = new Set<NoteValue>([
  'eighth',
  'sixteenth',
  'thirtysecond',
]);

/**
 * One beam per beat, the conventional way. A run breaks on anything that cannot join it —
 * a rest, an unflagged note, a new beat — so the beat stays visible through the beaming.
 * A lone flagged note keeps its flag; a beam needs two.
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
  const chords = chordsIn(pattern, part, bar, barLength);

  const events: NotationEvent[] = [];
  let filled = 0;

  for (const [index, chord] of chords.entries()) {
    // Notes stop at the bar line; a stroke's tail never carries into the next measure.
    const until = chords[index + 1]?.step ?? barLength;
    const stroke = strokeFor(tables.note, chord, until - chord.step, stepsPerBeat);

    events.push(...restsFor(tables.rest, part, filled, chord.step - filled), {
      kind: 'note',
      step: chord.step,
      value: stroke.value,
      dots: stroke.dots,
      noteheads: chord.noteheads,
      accented: chord.accented,
      grace: chord.grace,
    });
    filled = chord.step + stroke.steps;
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
