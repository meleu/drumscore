/**
 * The notation engine's output: an abstract description of what the staff shows.
 *
 * It is deliberately free of VexFlow (and DOM) vocabulary — the renderer is the only
 * thing that knows how to draw it. That keeps the hard musical logic pure and
 * testable without a browser.
 */

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

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
}

export interface NotationRest {
  kind: 'rest';
  step: number;
  value: NoteValue;
}

/** Notes and rests share a measure's timeline, so they live in one ordered list. */
export type NotationEvent = NotationNote | NotationRest;

export interface NotationMeasure {
  /** In step order, together filling the measure exactly. */
  events: NotationEvent[];
}

export interface TimeSignature {
  beats: number;
  beatValue: number;
}

export interface NotationModel {
  timeSignature: TimeSignature;
  measures: NotationMeasure[];
}
