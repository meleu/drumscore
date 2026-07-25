/**
 * The sheet: the staff as something you can take away — a self-contained SVG, a PNG
 * file, or a PNG on the clipboard. It never draws anything. The staff hands it the
 * `<svg>` VexFlow drew and everything here is made from that, so what you take away is
 * always a copy of what is on screen.
 *
 * A runes module rather than a plain object, for the same reason as the sketchpad: a
 * component that reads `ready` subscribes by reading it, so the buttons enable themselves
 * on the staff's first draw with no wiring in between (ADR-0007, ADR-0008).
 *
 * The browser calls underneath are reached directly, with no port over them. A port
 * narrow enough to be worth faking would sit past the point where these methods actually
 * fail, and a port wide enough to test would take the font embedding and the
 * rasterization with it, leaving nothing here — see ADR-0008.
 */

import { copyPng, exportPng, exportSvg } from './export';
import { filenameFor } from './filename';

export interface SheetDeps {
  /** The current beat's name, '' while unnamed. Read at call time, never stored. */
  name: () => string;
}

export interface Sheet {
  /** False until the staff has drawn something exportable. */
  readonly ready: boolean;
  /** The staff reports what it drew, or null when it has nothing. */
  drawn(svg: SVGSVGElement | null): void;
  /** Each resolves to whether it landed — never rejects. False when nothing is drawn. */
  saveSvg(): Promise<boolean>;
  savePng(): Promise<boolean>;
  copy(): Promise<boolean>;
}

export function createSheet({ name }: SheetDeps): Sheet {
  // Raw because the element is only ever replaced wholesale, and a live DOM node is the
  // last thing that should be handed to a deep proxy.
  let element = $state.raw<SVGSVGElement | null>(null);

  /**
   * The one path everything you can take away goes down. Nothing drawn means nothing to
   * do, and a browser that will not encode a canvas, will not hand over the clipboard or
   * will not read back a font is a fact of this interface rather than an unhandled
   * rejection — the reason is logged, the caller gets `false`.
   */
  async function attempt(action: (svg: SVGSVGElement) => Promise<boolean>): Promise<boolean> {
    if (element === null) return false;

    try {
      return await action(element);
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  return {
    get ready() {
      return element !== null;
    },

    drawn(svg) {
      element = svg;
    },

    saveSvg: () =>
      attempt(async (svg) => {
        await exportSvg(svg, filenameFor(name(), 'svg'));
        return true;
      }),

    savePng: () =>
      attempt(async (svg) => {
        await exportPng(svg, filenameFor(name(), 'png'));
        return true;
      }),

    copy: () => attempt((svg) => copyPng(svg)),
  };
}
