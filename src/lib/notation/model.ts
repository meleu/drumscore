/**
 * The notation engine's output: an abstract description of what the staff shows.
 *
 * It is deliberately free of VexFlow (and DOM) vocabulary — the renderer is the only
 * thing that knows how to draw it. That keeps the hard musical logic pure and
 * testable without a browser.
 */

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

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
   * True when this note is tied into the one that follows: the two are struck once and
   * held. Only voices that ring on are written this way, and a span no single note
   * value can spell comes back as a run of notes with this set on every piece but the
   * last.
   */
  tiedToNext: boolean;
  /**
   * The drums struck together here, low to high. More than one is a chord; a tied
   * stroke repeats the same noteheads on each of its pieces.
   */
  noteheads: Notehead[];
}

export interface NotationRest {
  kind: 'rest';
  step: number;
  value: NoteValue;
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

export interface NotationPart {
  id: PartId;
  stemDirection: StemDirection;
  /** In step order, together filling the measure exactly. */
  events: NotationEvent[];
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
