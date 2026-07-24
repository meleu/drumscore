# Music fonts are vendored byte-identical and never subsetted

Bravura and Academico ship inside the bundle, taken unmodified from the
`@vexflow-fonts/*` packages, and are embedded whole into every exported SVG.

The app draws a couple of dozen distinct glyphs out of Bravura's full SMuFL repertoire, so
subsetting is the obvious optimization — an exported SVG is currently about 97% font
bytes. It is also the one move the license forbids: both fonts are under the SIL Open Font
License 1.1 with Reserved Font Names, and clause 3 bars a Modified Version (which a subset
is) from carrying the name "Bravura" without Steinberg's written permission. VexFlow writes
`font-family="Bravura,Academico"` straight into its SVG output and measures glyph widths
against that family name, so a compliant subset means renaming the font and threading the
new name through the renderer, the export CSS, and every visual baseline.

## Consequences

Do not subset, re-encode, or format-convert the woff2 files. If export size becomes a real
complaint, the licence-free lever is making font embedding opt-out in export — omission is
unconstrained, modification is not. Publishing to GitHub Pages is distribution, so the
notice obligations (root `LICENSE` carve-out, `LICENSE.txt` shipped in `dist/`, the XML
comment in exported SVGs) travel with the bytes.
