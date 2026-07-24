import { hasHitAt, stepsPerBar, type Pattern } from '$lib/pattern';
import type { NotationMeasure, NotationModel, NotationNote } from './model';

/**
 * Translate a pattern into the notation model.
 *
 * This is the walking-skeleton version: every step carrying a hit becomes one
 * standalone 16th note, and all voices striking that step collapse into it. Readable
 * durations, rests, ties, per-voice noteheads, and beaming arrive in later phases.
 */
export function toNotation(pattern: Pattern): NotationModel {
  const { dimensions } = pattern;
  const barLength = stepsPerBar(dimensions);
  const measures: NotationMeasure[] = [];

  for (let bar = 0; bar < dimensions.bars; bar += 1) {
    const notes: NotationNote[] = [];

    for (let step = 0; step < barLength; step += 1) {
      if (hasHitAt(pattern, bar * barLength + step)) {
        notes.push({ step, value: 'sixteenth' });
      }
    }

    measures.push({ notes });
  }

  return {
    timeSignature: { beats: dimensions.beatsPerBar, beatValue: dimensions.beatValue },
    measures,
  };
}
