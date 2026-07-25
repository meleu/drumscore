/**
 * The pattern codec: a compact, URL-safe string form of a {@link Pattern}.
 *
 * The pattern state is tiny — a handful of grid dimensions, one BPM, and
 * `voices x steps` on/off bits — so it round-trips comfortably inside a URL. That
 * makes a single encoding serve two jobs: the "copy link" share format and the
 * localStorage autosave format.
 *
 * The module is pure: no DOM, no `Buffer`, no `btoa`/`atob`. Base64url is
 * implemented over `Uint8Array` so the same code runs in the browser and in the
 * Node test environment. Decoding is deliberately tolerant — any malformed or
 * absent input yields `null` rather than throwing, so callers can fall back to the
 * next source (autosave, then the seed).
 */

import { KIT, type VoiceId } from './kit';
import {
  createPattern,
  MAX_BPM,
  MIN_BPM,
  totalSteps,
  type GridDimensions,
  type Pattern,
} from './pattern';

/** Bumped only on a breaking change to the byte layout; old strings then decode to `null`. */
const FORMAT_VERSION = 1;

/** version + stepsPerBeat + beatsPerBar + beatValue + bars + bpm, one byte each. */
const HEADER_LENGTH = 6;

/** Guards against a malformed header allocating an absurd grid. */
const MAX_DIMENSION = 64;

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Encode a pattern to a compact URL-safe string. */
export function encode(pattern: Pattern): string {
  const { dimensions, bpm, rows } = pattern;
  const steps = totalSteps(dimensions);

  const cellBytes = new Uint8Array(Math.ceil((steps * KIT.length) / 8));
  let bit = 0;
  for (const voice of KIT) {
    const row = rows[voice.id];
    for (let step = 0; step < steps; step++, bit++) {
      if (row[step]) {
        const index = bit >> 3;
        cellBytes[index] = (cellBytes[index] ?? 0) | (0x80 >> (bit & 7));
      }
    }
  }

  const bytes = new Uint8Array(HEADER_LENGTH + cellBytes.length);
  bytes[0] = FORMAT_VERSION;
  bytes[1] = dimensions.stepsPerBeat;
  bytes[2] = dimensions.beatsPerBar;
  bytes[3] = dimensions.beatValue;
  bytes[4] = dimensions.bars;
  bytes[5] = clampBpm(bpm);
  bytes.set(cellBytes, HEADER_LENGTH);

  return bytesToBase64url(bytes);
}

/**
 * Decode a string produced by {@link encode} back into a pattern. Returns `null`
 * for absent, malformed, wrong-version, or truncated input so the caller can fall
 * back cleanly.
 */
export function decode(encoded: string | null | undefined): Pattern | null {
  if (!encoded) return null;

  const bytes = base64urlToBytes(encoded);
  if (!bytes || bytes.length < HEADER_LENGTH) return null;
  if (bytes[0] !== FORMAT_VERSION) return null;

  const dimensions: GridDimensions = {
    stepsPerBeat: bytes[1] ?? 0,
    beatsPerBar: bytes[2] ?? 0,
    beatValue: bytes[3] ?? 0,
    bars: bytes[4] ?? 0,
  };
  if (!isValidDimensions(dimensions)) return null;

  const steps = totalSteps(dimensions);
  const expectedLength = HEADER_LENGTH + Math.ceil((steps * KIT.length) / 8);
  if (bytes.length !== expectedLength) return null;

  const pattern = createPattern(dimensions, clampBpm(bytes[5] ?? MIN_BPM));
  const rows = Object.fromEntries(
    KIT.map((voice) => [voice.id, new Array<boolean>(steps).fill(false)]),
  ) as Record<VoiceId, boolean[]>;

  let bit = 0;
  for (const voice of KIT) {
    const row = rows[voice.id];
    for (let step = 0; step < steps; step++, bit++) {
      const byte = bytes[HEADER_LENGTH + (bit >> 3)] ?? 0;
      row[step] = (byte & (0x80 >> (bit & 7))) !== 0;
    }
  }

  return { ...pattern, rows };
}

function isValidDimensions(dimensions: GridDimensions): boolean {
  return Object.values(dimensions).every(
    (value) => Number.isInteger(value) && value >= 1 && value <= MAX_DIMENSION,
  );
}

function clampBpm(bpm: number): number {
  if (!Number.isFinite(bpm)) return MIN_BPM;
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

function bytesToBase64url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;

    out += BASE64URL_ALPHABET[b0 >> 2];
    out += BASE64URL_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (!hasB1) break;
    out += BASE64URL_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)];
    if (!hasB2) break;
    out += BASE64URL_ALPHABET[b2 & 0x3f];
  }
  return out;
}

function base64urlToBytes(str: string): Uint8Array | null {
  // A base64 group is 4 chars; a trailing group of length 1 is impossible.
  if (str.length % 4 === 1) return null;

  const values: number[] = [];
  for (const char of str) {
    const value = BASE64URL_ALPHABET.indexOf(char);
    if (value === -1) return null;
    values.push(value);
  }

  const byteLength = Math.floor((values.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);
  let byteIndex = 0;
  for (let i = 0; i < values.length; i += 4) {
    const v0 = values[i] ?? 0;
    const v1 = values[i + 1] ?? 0;
    const v2 = values[i + 2] ?? 0;
    const v3 = values[i + 3] ?? 0;

    if (byteIndex < byteLength) bytes[byteIndex++] = (v0 << 2) | (v1 >> 4);
    if (byteIndex < byteLength) bytes[byteIndex++] = ((v1 & 0x0f) << 4) | (v2 >> 2);
    if (byteIndex < byteLength) bytes[byteIndex++] = ((v2 & 0x03) << 6) | v3;
  }
  return bytes;
}
