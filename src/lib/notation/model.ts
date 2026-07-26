/**
 * The notation engine's output: an abstract description of what the staff shows.
 *
 * Free of VexFlow and DOM vocabulary — the renderer is the only thing that knows how to
 * draw it, which keeps the musical logic pure and testable without a browser.
 */

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth' | 'thirtysecond';

/**
 * How many of each value make a whole note — the whole of what the staff can write.
 *
 * Beside the union rather than inside the engine, because the engine is not the only
 * reader: the engine builds its duration tables from it, the Pattern asks it which grids
 * are writable. A value added here widens both at once.
 */
export const VALUES_PER_WHOLE: readonly (readonly [NoteValue, number])[] = [
  ['whole', 1],
  ['half', 2],
  ['quarter', 4],
  ['eighth', 8],
  ['sixteenth', 16],
  ['thirtysecond', 32],
];

export type DiatonicStep = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';

/**
 * A height on the staff, named as notation names heights. On a percussion staff it says
 * nothing about pitch — only which line or space the glyph sits on.
 */
export interface StaffPosition {
  step: DiatonicStep;
  octave: number;
}

/** Cymbals and hi-hats are written with a cross; drums with an ordinary notehead. */
export type NoteheadStyle = 'normal' | 'cross';

/** The glyph and the line it sits on: what is true of a drum before anyone strikes it. */
export interface NoteheadGlyph {
  style: NoteheadStyle;
  position: StaffPosition;
}

export interface Notehead extends NoteheadGlyph {
  /**
   * Parenthesised. On the head rather than on the note, because that is what the
   * parentheses are drawn round: a ghosted snare under a plain hi-hat leaves the hi-hat
   * bare, and two ghosted drums draw two pairs.
   */
  ghosted: boolean;
}

/** One small strike ahead of a note, on the line of the drum that plays it. */
export interface GraceNote {
  value: NoteValue;
  notehead: NoteheadGlyph;
}

/**
 * The strikes squeezed in before a note: a flam's one, a drag's two.
 *
 * Spelled out rather than named, so what the convention *is* — the values, the beam, the
 * absent slash and slur — is asserted here in Node instead of living as a handful of flags
 * inside the drawing library's adapter. The strikes take no time from the bar: they are
 * played out of the beat's own room, which is why they hang off a note rather than sitting
 * in the events list beside one.
 */
export interface GraceGroup {
  /** Earliest first. Never empty. */
  notes: GraceNote[];
  /** Drawn under one beam. A lone grace note keeps its flag, as a lone note does. */
  beamed: boolean;
  /** The stroke through the stem. Drumset notation writes flams and drags without it. */
  slashed: boolean;
  /** The curve tying the group to its note. Standard drumset notation omits it. */
  slurred: boolean;
}

export interface NotationNote {
  kind: 'note';
  /** Step index within its own measure. */
  step: number;
  value: NoteValue;
  /** 1 dot lengthens by half: a dotted eighth fills the three-sixteenth gap a bare eighth
   * leaves a rest hanging off. */
  dots: number;
  /** The drums struck together here, low to high. More than one is a chord. */
  noteheads: Notehead[];
  /**
   * On the note, not a notehead, because that is where the glyph goes: one `>` against the
   * stem whichever drum under it was accented. The engine ORs it across them, so this is
   * deliberately lossy — the Pattern keeps the full truth (ADR-0014).
   */
  accented: boolean;
  /**
   * The grace strikes drawn before this note, or `null` for the great majority carrying
   * none. On the note, like the accent and for the same reason: one group is drawn ahead
   * of the whole stem, whichever drum under it was flammed.
   */
  grace: GraceGroup | null;
}

export interface NotationRest {
  kind: 'rest';
  step: number;
  value: NoteValue;
  dots: number;
  position: StaffPosition;
}

/** Notes and rests share a measure's timeline, so they live in one ordered list. */
export type NotationEvent = NotationNote | NotationRest;

/**
 * Drum music is two rhythms on one staff: the hands, stems up, and the feet, stems down.
 * Each carries its own rhythm and its own rests.
 */
export type PartId = 'hands' | 'feet';

export type StemDirection = 'up' | 'down';

/**
 * A run of consecutive beamable notes drawn under one beam instead of with flags. Notes
 * are named by their step within the measure, so a group is unambiguous without indexing
 * into the events array.
 */
export interface BeamGroup {
  /** Steps joined by this beam, in order. Always two or more. */
  steps: number[];
}

export interface NotationPart {
  id: PartId;
  stemDirection: StemDirection;
  /** In step order, together filling the measure exactly. */
  events: NotationEvent[];
  /** Per-beat runs of eighths/sixteenths. */
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
