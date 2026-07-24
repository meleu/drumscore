/**
 * The notation engine's output: an abstract description of what the staff shows.
 *
 * It is deliberately free of VexFlow (and DOM) vocabulary — the renderer is the only
 * thing that knows how to draw it. That keeps the hard musical logic pure and
 * testable without a browser.
 */

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export interface NotationNote {
  /** Where the note starts, as a step index within its own measure. */
  step: number;
  value: NoteValue;
}

export interface NotationMeasure {
  notes: NotationNote[];
}

export interface TimeSignature {
  beats: number;
  beatValue: number;
}

export interface NotationModel {
  timeSignature: TimeSignature;
  measures: NotationMeasure[];
}
