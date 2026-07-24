# drumscore

## Quickly sketch drum loops and see them in real musical notation

See it in action here: <https://meleu.github.io/drumscore/>

## The problem I want to solve

I want to sketch drum loops quickly and immediately see them written out as an
actual music notation. The options I've found force a trade-off:

- drum-machine grids that let me build a groove fast but never show
  me proper sheet music (or offer them as an easy way to print)
- music notation software shows me beautiful sheet music but is slow and
  clumsy for just trying out a beat.

When I have a pattern in my head, I want to both _hear_ it and
_see it as an actual music sheet_.

## Acknowledgements

This project stands on the shoulders of these excellent open source projects:

- [VexFlow](https://www.vexflow.com/) - renders the music notation
  ([repo](https://github.com/vexflow/vexflow))
- [Tone.js](https://tonejs.github.io/) - handles the audio playback
  ([repo](https://github.com/Tonejs/Tone.js))
- [Bravura](https://github.com/steinbergmedia/bravura) - the music font every
  notehead, clef and rest is drawn in, by Steinberg Media Technologies
- [Academico](https://www.npmjs.com/package/@vexflow-fonts/academico) - the text
  font on the staff, also by Steinberg Media Technologies

Both fonts are bundled with the app under the
[SIL Open Font License 1.1](https://scripts.sil.org/OFL); see [LICENSE](./LICENSE).
