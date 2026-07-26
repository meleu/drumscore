/**
 * Pattern codec: a compact, URL-safe string form of a {@link Pattern}, serving both the
 * "copy link" share format and the localStorage autosave.
 *
 * Pure: no DOM, no `Buffer`, no `btoa`/`atob` — base64url over `Uint8Array` runs the same
 * in the browser and in Node. Decoding is tolerant: malformed or absent input yields
 * `null` rather than throwing, so callers fall back to the next source.
 */

/**
 * The format is built out of three Kit properties: canonical row order, a `voices x steps`
 * payload, and which cells are real. So adding or removing a voice breaks every existing
 * share link and autosave. Accepted: the kit is expected to grow, no migration path is
 * built, and bumping the version below would not rescue those strings.
 */
import { accepts, KIT, type Hit, type VoiceId } from './kit';
import {
  createPattern,
  isSupportedGrid,
  MAX_BPM,
  MIN_BPM,
  totalSteps,
  type GridDimensions,
  type Pattern,
} from './pattern';

/**
 * Bumped only on a breaking byte-layout change; old strings then decode to `null`. Version
 * 2 widened a cell from a bit to a nibble to carry the variation. No version 1 reader:
 * those strings fall back to autosave then seed, and one bought today would not survive
 * the next voice the kit gains.
 */
const FORMAT_VERSION = 2;

/** version + stepsPerBeat + beatsPerBar + beatValue + bars + bpm, one byte each. */
const HEADER_LENGTH = 6;

/**
 * A cell on the wire: one nibble, two to a byte, so nothing straddles a boundary. Sixteen
 * codes for six states is deliberate headroom (the cymbal choke lands without touching the
 * layout). These numbers *are* the format; `codec.test.ts` pins them. A record, so a new
 * `Hit` without a code here is a compile error rather than a mis-encoded cell.
 */
const CELL_CODES: Record<Hit, number> = {
  off: 0,
  plain: 1,
  accent: 2,
  ghost: 3,
  flam: 4,
  drag: 5,
};

/** The same table backwards. Codes with no entry are not cells, and reject. */
const HITS_BY_CODE: ReadonlyMap<number, Hit> = new Map(
  Object.entries(CELL_CODES).map(([hit, code]) => [code, hit as Hit]),
);

/** Even cell in the high nibble, so a dump reads left to right. */
const CELLS_PER_BYTE = 2;

function cellBytesFor(steps: number): number {
  return Math.ceil((steps * KIT.length) / CELLS_PER_BYTE);
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function encode(pattern: Pattern): string {
  const { dimensions, bpm, rows } = pattern;
  const steps = totalSteps(dimensions);

  const cellBytes = new Uint8Array(cellBytesFor(steps));
  let cell = 0;
  for (const voice of KIT) {
    const row = rows[voice.id];
    for (let step = 0; step < steps; step++, cell++) {
      const code = CELL_CODES[row[step] ?? 'off'];
      const index = cell >> 1;
      cellBytes[index] = (cellBytes[index] ?? 0) | (cell % 2 === 0 ? code << 4 : code);
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
 * Inverse of {@link encode}. `null` for absent, malformed, wrong-version or truncated
 * input, so the caller can fall back cleanly.
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
  // Which grids exist is the Pattern's question: four bytes name four billion grids and
  // the app supports a vanishing fraction. The format reads bytes, so it asks; a refusal
  // is just another malformed input.
  if (!isSupportedGrid(dimensions)) return null;

  const steps = totalSteps(dimensions);
  const expectedLength = HEADER_LENGTH + cellBytesFor(steps);
  if (bytes.length !== expectedLength) return null;

  const pattern = createPattern(dimensions, clampBpm(bytes[5] ?? MIN_BPM));
  const rows = Object.fromEntries(
    KIT.map((voice) => [voice.id, new Array<Hit>(steps).fill('off')]),
  ) as Record<VoiceId, Hit[]>;

  let cell = 0;
  for (const voice of KIT) {
    const row = rows[voice.id];
    for (let step = 0; step < steps; step++, cell++) {
      const byte = bytes[HEADER_LENGTH + (cell >> 1)] ?? 0;
      const hit = HITS_BY_CODE.get(cell % 2 === 0 ? byte >> 4 : byte & 0x0f);

      // Unknown code, or a way this drum cannot be struck: the whole string is malformed.
      // Decoding yields only valid patterns; there is no repair step (ADR-0013).
      if (hit === undefined || !accepts(voice.id, hit)) return null;
      row[step] = hit;
    }
  }

  return { ...pattern, rows };
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
  // A group is 4 chars; a trailing group of 1 is impossible.
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
