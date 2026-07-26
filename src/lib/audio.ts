/**
 * Audio engine: a thin adapter over Tone.js, holding no musical logic — it maps the
 * Pattern's on-cells onto synthesized voices and drives Tone's Transport.
 *
 * One synth per voice, so simultaneous hits sound together instead of stealing a
 * monophonic voice. The grid is a looping `Sequence` whose callback reads the *current*
 * pattern, so edits and tempo changes land live and the loop repeats seamlessly.
 */

import {
  Filter,
  getDestination,
  getDraw,
  getTransport,
  MembraneSynth,
  MetalSynth,
  NoiseSynth,
  Sequence,
  start,
} from 'tone';
import { KIT, type VoiceId } from './kit';
import { isHit, totalSteps, type Pattern } from './pattern';
import type { Playback } from './sketchpad.svelte';

/** Notified of the playing column; `null` when playback stops. */
export type StepListener = (step: number | null) => void;

/**
 * One trigger per voice plus a disposer for every Tone node created. Exhaustive over the
 * Kit deliberately: a new drum with no synth here is a compile error, not a silent drum.
 * Envelopes, filters and volumes stay this side of the seam.
 */
interface VoiceKit {
  triggers: Record<VoiceId, (time: number) => void>;
  dispose(): void;
}

function buildVoices(): VoiceKit {
  const destination = getDestination();
  const nodes: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(node: T): T => {
    nodes.push(node);
    return node;
  };

  const kick = track(
    new MembraneSynth({
      pitchDecay: 0.03,
      octaves: 6,
      envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.1 },
    }),
  ).connect(destination);

  const snare = track(
    new NoiseSynth({
      volume: -6,
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    }),
  ).connect(destination);

  // Highpassed white noise, so the hats read as metal rather than snare.
  const hiHatFilter = track(new Filter(7000, 'highpass')).connect(destination);
  const closedHiHat = track(
    new NoiseSynth({ volume: -12, envelope: { attack: 0.001, decay: 0.04, sustain: 0 } }),
  ).connect(hiHatFilter);
  const openHiHat = track(
    new NoiseSynth({ volume: -12, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }),
  ).connect(hiHatFilter);

  const crash = track(
    new MetalSynth({
      volume: -16,
      envelope: { attack: 0.001, decay: 1.2, release: 0.4, sustain: 0 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 3000,
      octaves: 1.5,
    }),
  ).connect(destination);

  const ride = track(
    new MetalSynth({
      volume: -18,
      envelope: { attack: 0.001, decay: 0.4, release: 0.2, sustain: 0 },
      harmonicity: 8,
      modulationIndex: 40,
      resonance: 6000,
      octaves: 1,
    }),
  ).connect(destination);

  const triggers: Record<VoiceId, (time: number) => void> = {
    kick: (time) => kick.triggerAttackRelease('C1', '8n', time),
    snare: (time) => snare.triggerAttackRelease('8n', time),
    closedHiHat: (time) => closedHiHat.triggerAttackRelease('16n', time),
    openHiHat: (time) => openHiHat.triggerAttackRelease('8n', time),
    crash: (time) => crash.triggerAttackRelease('C4', '2n', time),
    ride: (time) => ride.triggerAttackRelease('C6', '8n', time),
  };

  return { triggers, dispose: () => nodes.forEach((node) => node.dispose()) };
}

/** The sketchpad's Playback adapter that actually makes noise. */
export class AudioEngine implements Playback {
  private pattern: Pattern;
  private readonly voices: VoiceKit;
  private sequence: Sequence<number> | null = null;
  private stepCount = 0;
  private stepListener: StepListener | null = null;
  private running = false;

  constructor(pattern: Pattern) {
    this.pattern = pattern;
    this.voices = buildVoices();
    getTransport().bpm.value = pattern.bpm;
  }

  /** Register, or clear with `null`, the playhead listener. */
  onStep(listener: StepListener | null): void {
    this.stepListener = listener;
  }

  /** Cell edits need no rebuild — the callback reads the pattern. Only a resize does. */
  setPattern(pattern: Pattern): void {
    this.pattern = pattern;
    if (totalSteps(pattern.dimensions) !== this.stepCount) this.buildSequence();
  }

  setBpm(bpm: number): void {
    getTransport().bpm.value = bpm;
  }

  /** Resume the audio context (needs a user gesture) and start from the top. */
  async play(): Promise<void> {
    await start();
    if (!this.sequence) this.buildSequence();
    this.running = true;
    getTransport().start();
  }

  stop(): void {
    // Guard down first: a draw queued just before the stop can still fire next frame.
    this.running = false;
    getTransport().stop();
    this.stepListener?.(null);
  }

  dispose(): void {
    this.sequence?.dispose();
    this.voices.dispose();
  }

  private buildSequence(): void {
    this.sequence?.dispose();
    const { dimensions } = this.pattern;
    this.stepCount = totalSteps(dimensions);
    const steps = Array.from({ length: this.stepCount }, (_, step) => step);
    // e.g. quarter beat (4) x 4 steps/beat = 16th notes -> "16n".
    const subdivision = `${dimensions.beatValue * dimensions.stepsPerBeat}n`;

    this.sequence = new Sequence<number>(
      (time, step) => {
        for (const { id } of KIT) {
          if (isHit(this.pattern, id, step)) this.voices.triggers[id](time);
        }
        // The callback fires ahead of the audible moment; Draw defers the highlight to it,
        // so the playhead lands in sync. The guard drops draws due after a stop.
        const listener = this.stepListener;
        if (listener) getDraw().schedule(() => this.running && listener(step), time);
      },
      steps,
      subdivision,
    ).start(0);
  }
}
