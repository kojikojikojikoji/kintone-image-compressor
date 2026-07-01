# Release checklist

Run before packing a release. The manual matrix covers browsers (Chrome, Edge,
Firefox, Safari latest, iOS Safari) against the record screens.

## Gates

- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` produces `dist/desktop.js`, `dist/mobile.js`,
      `dist/config.js`.
- [ ] `npm run lint` is clean.
- [ ] `npm run pack` produces `dist/plugin.zip` with the intended `private.ppk`.

## Manual matrix (browser x screen)

Legend: create / edit (desktop), mobile edit.

| Case | Chrome | Edge | Firefox | Safari | iOS Safari |
| --- | --- | --- | --- | --- | --- |
| Button appears in the configured space | | | | | |
| Single 8 MB JPEG compresses and attaches (TC-19) | | | | | |
| Edit screen keeps existing attachment, adds one (TC-20) | | | | | |
| Five files attach in selection order with a total (TC-21) | | | | | |
| Drag and drop matches click selection (TC-22, desktop) | | | | | n/a |
| Below-threshold file attaches unchanged (TC-23) | | | | | |
| Opaque PNG: convert on -> JPEG, off -> PNG (TC-24) | | | | | |
| Transparent PNG keeps transparency (TC-25) | | | | | |
| GIF attached unchanged (TC-26) | | | | | |
| 0-byte file fails, valid file still attaches (TC-27) | | | | | |
| Duplicate name gets ` (2)` (TC-28) | | | | | |
| Capture-date prefix on JPEG (TC-29) | | | | | |
| Mobile edit compresses like desktop (TC-30) | n/a | n/a | n/a | n/a | |
| Unconfigured app: no button, no console error (TC-31) | | | | | |
| Settings round-trip (TC-32) | | | | | |
| Deleted field warning in settings (TC-33) | | | | | |
| Aborted upload shows a failure row, others continue (TC-34) | | | | | |

## Device checks

- [ ] iPhone Safari: camera photo in portrait keeps orientation; exiftool shows
      EXIF and GPS removed (TC-35).
- [ ] iPhone Safari: HEIC attached unchanged (TC-36).
- [ ] iOS Safari: oversized canvas falls back to the original file, no red row
      (TC-37).
- [ ] Offline then online retry works (TC-38).
- [ ] CMYK JPEG: decodable browsers compress, others fall back, none error out
      (TC-39).
- [ ] Ten 5 MB photos finish within 60 seconds and other fields stay editable
      during processing (TC-40).
- [ ] JPEG quality 0.5 vs 0.95 produces different output sizes (TC-41).
