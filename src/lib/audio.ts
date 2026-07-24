/**
 * Audio engine: a thin adapter over Tone.js. It holds no musical logic — it maps the
 * Pattern's on-cells onto synthesized voices and drives Tone's Transport.
 *
 * Each voice is its own synth so simultaneous hits sound together rather than stealing
 * one monophonic voice. The step grid is scheduled as a looping `Sequence`; its callback
 * reads the *current* pattern, so edits (including tempo) are reflected live and the loop
 * repeats seamlessly. Voice count/character and the synth choices come from the PRD:
 * MembraneSynth kick, NoiseSynth snare/hi-hats, MetalSynth cymbals/ride.
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
import { isHit, totalSteps, VOICE_IDS, type Pattern, type VoiceId } from './pattern';

/** Notified of the playing column as the loop advances; `null` when playback stops. */
export type StepListener = (step: number | null) => void;

/** One trigger fn per voice, plus a disposer for every Tone node it created. */
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

  // Hi-hats are white noise pushed through a highpass so they read as metal, not snare.
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

export class AudioEngine {
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

  /** Register (or clear, with `null`) the playhead listener for the playing column. */
  onStep(listener: StepListener | null): void {
    this.stepListener = listener;
  }

  /**
   * Point the engine at the latest pattern. The sequence callback reads it on every
   * step, so cell edits need no rebuild; only a change in grid size rebuilds the loop.
   */
  setPattern(pattern: Pattern): void {
    this.pattern = pattern;
    if (totalSteps(pattern.dimensions) !== this.stepCount) this.buildSequence();
  }

  setBpm(bpm: number): void {
    getTransport().bpm.value = bpm;
  }

  /** Resume the audio context (requires a user gesture) and start the loop from the top. */
  async play(): Promise<void> {
    await start();
    if (!this.sequence) this.buildSequence();
    this.running = true;
    getTransport().start();
  }

  /** Stop and rewind so the next play starts at the top of the loop. */
  stop(): void {
    // Clear first: a draw queued just before the stop can still fire on the next
    // animation frame, so the running guard below must already be down when it does.
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
    // e.g. quarter-note beat (4) x 4 steps/beat = 16th notes → "16n".
    const subdivision = `${dimensions.beatValue * dimensions.stepsPerBeat}n`;

    this.sequence = new Sequence<number>(
      (time, step) => {
        for (const id of VOICE_IDS) {
          if (isHit(this.pattern, id, step)) this.voices.triggers[id](time);
        }
        // The sequence callback fires ahead of the audible moment; Draw defers the
        // highlight to that moment so the playhead lands in sync with the sound. The
        // running guard drops draws that come due after a stop has cleared the highlight.
        const listener = this.stepListener;
        if (listener) getDraw().schedule(() => this.running && listener(step), time);
      },
      steps,
      subdivision,
    ).start(0);
  }
}
