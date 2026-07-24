import { isHit, stepsPerBar, type GridDimensions, type Pattern, type VoiceId } from '$lib/pattern';
import type {
  BeamGroup,
  NotationEvent,
  NotationMeasure,
  NotationModel,
  NotationPart,
  Notehead,
  NoteValue,
  PartId,
  StaffPosition,
  StemDirection,
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
 */

/** Where each drum sits on the staff, and what its notehead looks like. */
const NOTEHEADS: Readonly<Record<VoiceId, Notehead>> = {
  kick: { style: 'normal', position: { step: 'f', octave: 4 } },
  snare: { style: 'normal', position: { step: 'c', octave: 5 } },
  closedHiHat: { style: 'cross', position: { step: 'g', octave: 5 } },
  openHiHat: { style: 'cross', position: { step: 'g', octave: 5 } },
  crash: { style: 'cross', position: { step: 'a', octave: 5 } },
  ride: { style: 'cross', position: { step: 'f', octave: 5 } },
};

interface Part {
  id: PartId;
  stemDirection: StemDirection;
  voices: readonly VoiceId[];
  /** Rests keep out of the noteheads' way by sitting in their own part of the staff. */
  restPosition: StaffPosition;
  /** The whole rest is the odd one out: it hangs from the line above the others. */
  wholeRestPosition: StaffPosition;
}

const PARTS: readonly Part[] = [
  {
    id: 'hands',
    stemDirection: 'up',
    voices: ['snare', 'closedHiHat', 'openHiHat', 'crash', 'ride'],
    restPosition: { step: 'b', octave: 4 },
    wholeRestPosition: { step: 'd', octave: 5 },
  },
  {
    id: 'feet',
    stemDirection: 'down',
    voices: ['kick'],
    restPosition: { step: 'f', octave: 4 },
    wholeRestPosition: { step: 'g', octave: 4 },
  },
];

/** How many of each note value make a whole note. */
const VALUES_PER_WHOLE: readonly [NoteValue, number][] = [
  ['whole', 1],
  ['half', 2],
  ['quarter', 4],
  ['eighth', 8],
  ['sixteenth', 16],
];

interface Duration {
  value: NoteValue;
  steps: number;
}

/**
 * The note values expressible at this resolution, longest first. Derived from the
 * dimensions rather than hardcoded, so a finer grid or a different beat value just
 * yields a different table.
 */
function durations(dimensions: GridDimensions): Duration[] {
  const stepsPerWhole = dimensions.stepsPerBeat * dimensions.beatValue;

  return VALUES_PER_WHOLE.map(([value, perWhole]) => ({
    value,
    steps: stepsPerWhole / perWhole,
  })).filter(({ steps }) => Number.isInteger(steps) && steps >= 1);
}

/**
 * The longest duration that fits in `length` and may legally begin on `step`.
 *
 * The alignment test is what keeps the rhythm readable: a half note only starts on a
 * half-note boundary, a quarter only on a beat, and so on, so nothing straddles a
 * subdivision it has no business crossing. The one-step value always qualifies, so
 * there is always an answer.
 */
function longestFit(table: Duration[], step: number, length: number): Duration {
  const fit = table.find((duration) => duration.steps <= length && step % duration.steps === 0);

  /* v8 ignore next -- unreachable: the one-step value fits any step and any length >= 1 */
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
  return split(table, step, length).map(({ step: at, value }) => ({
    kind: 'rest',
    step: at,
    value,
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
function noteheadsAt(pattern: Pattern, part: Part, at: number): Notehead[] {
  const struck = part.voices.filter((voice) => isHit(pattern, voice, at));
  const heads = new Map(
    struck.map((voice) => {
      const head = NOTEHEADS[voice];

      return [`${head.style}:${head.position.step}${head.position.octave}`, head];
    }),
  );

  return [...heads.values()].sort((a, b) => heightOf(a.position) - heightOf(b.position));
}

/** The hits of one part within one bar, at steps relative to that bar. */
function hitsIn(pattern: Pattern, part: Part, bar: number, barLength: number): Hit[] {
  const hits: Hit[] = [];

  for (let step = 0; step < barLength; step += 1) {
    const at = bar * barLength + step;
    const noteheads = noteheadsAt(pattern, part, at);

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

function partFor(pattern: Pattern, part: Part, bar: number, table: Duration[]): NotationPart {
  const { stepsPerBeat } = pattern.dimensions;
  const barLength = stepsPerBar(pattern.dimensions);
  const hits = hitsIn(pattern, part, bar, barLength);

  const events: NotationEvent[] = [];
  let filled = 0;

  for (const [index, hit] of hits.entries()) {
    // Notes stop at the bar line; a hit's tail never carries into the next measure.
    const until = hits[index + 1]?.step ?? barLength;
    const stroke = strokeFor(table, hit, until - hit.step, stepsPerBeat);

    events.push(...restsFor(table, part, filled, hit.step - filled), {
      kind: 'note',
      step: hit.step,
      value: stroke.value,
      noteheads: hit.noteheads,
    });
    filled = hit.step + stroke.steps;
  }

  events.push(...restsFor(table, part, filled, barLength - filled));

  return {
    id: part.id,
    stemDirection: part.stemDirection,
    events,
    beams: beamsFor(events, stepsPerBeat),
  };
}

export function toNotation(pattern: Pattern): NotationModel {
  const { dimensions } = pattern;
  const table = durations(dimensions);

  return {
    timeSignature: { beats: dimensions.beatsPerBar, beatValue: dimensions.beatValue },
    measures: Array.from({ length: dimensions.bars }, (_, bar): NotationMeasure => ({
      parts: PARTS.map((part) => partFor(pattern, part, bar, table)),
    })),
  };
}
