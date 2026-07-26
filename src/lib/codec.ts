/**
 * The pattern codec: a compact, URL-safe string form of a {@link Pattern}.
 *
 * The pattern state is tiny — a handful of grid dimensions, one BPM, and
 * `voices x steps` cells of half a byte each — so it round-trips comfortably inside a URL. That
 * makes a single encoding serve two jobs: the "copy link" share format and the
 * localStorage autosave format.
 *
 * The module is pure: no DOM, no `Buffer`, no `btoa`/`atob`. Base64url is
 * implemented over `Uint8Array` so the same code runs in the browser and in the
 * Node test environment. Decoding is deliberately tolerant — any malformed or
 * absent input yields `null` rather than throwing, so callers can fall back to the
 * next source (autosave, then the seed).
 */

/**
 * The Kit, named at the import because this format is built out of three of its properties:
 * rows are encoded in canonical order, the payload is `voices x steps` cells wide, and which
 * cells are real is the Kit's answer rather than the format's.
 *
 * Adding or removing a voice therefore changes the payload width, which breaks every
 * string the old kit encoded — share links and autosaves alike. That breakage is accepted:
 * the kit is expected to grow, and no migration path is built. The format version below is
 * not what rescues those strings, and bumping it would not.
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
 * Bumped only on a breaking change to the byte layout; old strings then decode to `null`.
 *
 * Version 2 widened a cell from a bit to a nibble to carry the variation. No reader for
 * version 1 is written: those strings fall back to the autosave and then to the seed, and a
 * reader bought today would not survive the next voice the kit gains anyway.
 */
const FORMAT_VERSION = 2;

/** version + stepsPerBeat + beatsPerBar + beatValue + bars + bpm, one byte each. */
const HEADER_LENGTH = 6;

/**
 * A cell on the wire: one nibble, two to a byte, so nothing straddles a byte boundary.
 *
 * Sixteen codes for six states is deliberate headroom — the cymbal choke is already named
 * (ADR-0013) and lands without touching the layout. The numbers are the format, so changing
 * one silently rewrites the meaning of every string ever shared; `codec.test.ts` pins them.
 *
 * A record rather than a list, so a `Hit` added to the union without a code here is a
 * compile error rather than a cell that encodes as something else.
 */
const CELL_CODES: Record<Hit, number> = {
  off: 0,
  plain: 1,
  accent: 2,
  ghost: 3,
  flam: 4,
  drag: 5,
};

/** The same table read the other way. Codes with no entry are not cells, and reject. */
const HITS_BY_CODE: ReadonlyMap<number, Hit> = new Map(
  Object.entries(CELL_CODES).map(([hit, code]) => [code, hit as Hit]),
);

/** Two cells to a byte: the even one in the high nibble, so a dump reads left to right. */
const CELLS_PER_BYTE = 2;

function cellBytesFor(steps: number): number {
  return Math.ceil((steps * KIT.length) / CELLS_PER_BYTE);
}

const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Encode a pattern to a compact URL-safe string. */
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
  // Which grids exist is the Pattern's question, not the format's. Four bytes name any of
  // four billion grids and the app supports a vanishing fraction of them; the format's job is
  // reading the bytes, so it asks rather than deciding, and a refusal is just another
  // malformed input.
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

      // A code nothing decodes to, or a way this drum cannot be struck, and the whole
      // string is malformed — the same answer an unsupported grid gets. Decoding yields
      // only patterns the app considers valid; there is no repair step (ADR-0013).
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
