/**
 * The sheet: the staff as something you can take away — a self-contained SVG, a PNG file,
 * or a PNG on the clipboard. It never draws: the staff hands it the `<svg>` VexFlow drew
 * and everything here is made from that, so an export always matches the screen.
 *
 * A runes module, like the sketchpad: a component reading `ready` subscribes by reading
 * it, so the buttons enable themselves on the first draw with no wiring (ADR-0007/0008).
 *
 * The browser calls are reached directly, with no port over them: a port narrow enough to
 * fake would sit past the point where these methods fail, and a wide one would take the
 * font embedding and rasterization with it, leaving nothing here — ADR-0008.
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
  // Raw: replaced wholesale, and a live DOM node is the last thing to hand a deep proxy.
  let element = $state.raw<SVGSVGElement | null>(null);

  /**
   * The one path every export goes down. A browser that will not encode a canvas, hand
   * over the clipboard or read back a font is a fact of this interface rather than an
   * unhandled rejection — the reason is logged, the caller gets `false`.
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
