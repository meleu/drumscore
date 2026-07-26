/**
 * The notation engine's output: an abstract description of what the staff shows.
 *
 * It is deliberately free of VexFlow (and DOM) vocabulary — the renderer is the only
 * thing that knows how to draw it. That keeps the hard musical logic pure and
 * testable without a browser.
 */

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

/**
 * How many of each note value make a whole note — the fact about the union above that says
 * how long each of its members is, and so the whole of what the staff can write.
 *
 * It lives here, beside the union, rather than inside the engine that consumes it, because
 * the engine is not the only thing that needs to know. The engine reads it to build the
 * tables it chooses among; the Pattern reads it to ask which grids the staff can write. A
 * value added here widens both answers at once.
 */
export const VALUES_PER_WHOLE: readonly (readonly [NoteValue, number])[] = [
  ['whole', 1],
  ['half', 2],
  ['quarter', 4],
  ['eighth', 8],
  ['sixteenth', 16],
];

export type DiatonicStep = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

/**
 * A height on the staff, named the way notation has always named heights — a letter and
 * an octave. On a percussion staff it says nothing about pitch: it is only which line or
 * space the glyph sits on, read against the drum key.
 */
export interface StaffPosition {
  step: DiatonicStep;
  octave: number;
}

/** Cymbals and hi-hats are written with a cross; drums with an ordinary notehead. */
export type NoteheadStyle = 'normal' | 'cross';

export interface Notehead {
  style: NoteheadStyle;
  position: StaffPosition;
}

export interface NotationNote {
  kind: 'note';
  /** Where the note starts, as a step index within its own measure. */
  step: number;
  value: NoteValue;
  /**
   * Augmentation dots. 0 is a plain note; 1 lengthens the value by half, so a dotted
   * eighth fills the three-sixteenth gap that a bare eighth leaves a rest hanging off.
   */
  dots: number;
  /** The drums struck together here, low to high. More than one is a chord. */
  noteheads: Notehead[];
  /**
   * Whether the stroke is marked with an accent.
   *
   * On the note rather than on a notehead because that is where the glyph goes: one `>`
   * against the stem, whichever of the drums below it was the accented one. The engine ORs
   * it across them, so this is deliberately lossy and the Pattern is where the full truth
   * stays (ADR-0014).
   */
  accented: boolean;
}

export interface NotationRest {
  kind: 'rest';
  step: number;
  value: NoteValue;
  /** Augmentation dots, matching the note: a dotted-eighth rest covers three sixteenths. */
  dots: number;
  position: StaffPosition;
}

/** Notes and rests share a measure's timeline, so they live in one ordered list. */
export type NotationEvent = NotationNote | NotationRest;

/**
 * Drum music is written as two rhythms sharing one staff: what the hands play, stems up,
 * and what the feet play, stems down. Each carries its own rhythm and its own rests.
 */
export type PartId = 'hands' | 'feet';

export type StemDirection = 'up' | 'down';

/**
 * A run of consecutive beamable notes to be drawn under one beam instead of with flags.
 * Notes are named by their step within the measure — the same step the events carry — so
 * a group is unambiguous without pointing into the events array by index.
 */
export interface BeamGroup {
  /** Steps of the notes joined by this beam, in order. Always two or more. */
  steps: number[];
}

export interface NotationPart {
  id: PartId;
  stemDirection: StemDirection;
  /** In step order, together filling the measure exactly. */
  events: NotationEvent[];
  /** Which notes to beam together; per-beat runs of eighths/sixteenths. */
  beams: BeamGroup[];
}

export interface NotationMeasure {
  parts: NotationPart[];
}

export interface TimeSignature {
  beats: number;
  beatValue: number;
}

export interface NotationModel {
  timeSignature: TimeSignature;
  measures: NotationMeasure[];
}
