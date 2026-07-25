import { describe, expect, it } from 'vitest';
import { filenameFor } from './filename';

describe('naming an exported sheet', () => {
  it('uses the beat name as it stands when it is already a slug', () => {
    expect(filenameFor('funk', 'svg')).toBe('funk.svg');
  });

  it('lowercases and joins words with hyphens', () => {
    expect(filenameFor('Half Time Shuffle', 'svg')).toBe('half-time-shuffle.svg');
  });

  it('folds accented and decorated letters to their ASCII bases', () => {
    expect(filenameFor('Batida Nº1', 'png')).toBe('batida-no1.png');
    expect(filenameFor('Ação Café', 'png')).toBe('acao-cafe.png');
  });

  it('collapses runs of punctuation into a single hyphen and trims the ends', () => {
    expect(filenameFor('  ...groove — v2!  ', 'svg')).toBe('groove-v2.svg');
  });

  it('names the file after the extension it is asked for', () => {
    expect(filenameFor('funk', 'svg')).toBe('funk.svg');
    expect(filenameFor('funk', 'png')).toBe('funk.png');
  });

  it('caps a long name, leaving no hyphen where it cut', () => {
    const slug = filenameFor('a '.repeat(80), 'svg').replace('.svg', '');

    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('falls back to drumscore when the name slugs to nothing', () => {
    expect(filenameFor('', 'svg')).toBe('drumscore.svg');
    expect(filenameFor('   ', 'svg')).toBe('drumscore.svg');
    expect(filenameFor('!!! ---', 'png')).toBe('drumscore.png');
  });
});
