import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSheet } from './sheet.svelte';

/**
 * The sheet is browser-only, so these tests cover the part that is not: what it does
 * before it touches the DOM, and the promise it hands back.
 *
 * A drawn element here is a stub — enough for the sheet to consider itself ready, and
 * nothing more. Note what is *not* asserted below: that the browser calls resolve
 * `false` with a stub. They do, but only because there is no `document` in this
 * environment, which is not a decision the sheet made. The provable claim is that they
 * resolve at all rather than rejecting, and that is the defect being fixed (ADR-0008).
 */
const drawn = {} as SVGSVGElement;

function setup() {
  return createSheet({ name: () => '' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('readiness', () => {
  it('has nothing to take away before the staff draws', () => {
    expect(setup().ready).toBe(false);
  });

  it('is ready once the staff reports what it drew', () => {
    const sheet = setup();

    sheet.drawn(drawn);

    expect(sheet.ready).toBe(true);
  });

  it('is not ready again when the staff reports it has nothing', () => {
    const sheet = setup();
    sheet.drawn(drawn);

    sheet.drawn(null);

    expect(sheet.ready).toBe(false);
  });

  it('reports what it drew even detached from the sheet, as a callback prop is', () => {
    const sheet = setup();
    const report = sheet.drawn;

    report(drawn);

    expect(sheet.ready).toBe(true);
  });
});

describe('with nothing drawn', () => {
  it('refuses every way of taking it away, without failing', async () => {
    const sheet = setup();

    await expect(sheet.saveSvg()).resolves.toBe(false);
    await expect(sheet.savePng()).resolves.toBe(false);
    await expect(sheet.copy()).resolves.toBe(false);
  });
});

describe('when the browser cannot deliver', () => {
  it('resolves rather than rejecting, whatever the browser does', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const sheet = setup();
    sheet.drawn(drawn);

    await expect(sheet.saveSvg()).resolves.toBeTypeOf('boolean');
    await expect(sheet.savePng()).resolves.toBeTypeOf('boolean');
    await expect(sheet.copy()).resolves.toBeTypeOf('boolean');
  });

  it('logs why, since `false` keeps none of the reason', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sheet = setup();
    sheet.drawn(drawn);

    await sheet.saveSvg();

    expect(logged).toHaveBeenCalled();
  });
});
