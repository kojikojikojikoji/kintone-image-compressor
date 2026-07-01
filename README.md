# kintone-image-compressor

Documentation in Japanese: [README.ja.md](./README.ja.md)

Resize and re-encode images in the browser before attaching them to a kintone
attachment field. A phone photo of 4-12 MB is scaled to a long edge of 1920 px
and re-encoded as JPEG at quality 0.8, which usually brings it down to a few
hundred KB. All processing runs in the browser and through the kintone REST API;
the plugin sends nothing to any external server.

Re-encoding drops the EXIF metadata, including GPS location, so this also removes
the location tag from photos before they are stored.

## Screenshots

Add screenshots under `docs/` and link them here:

1. The settings screen with default values.
2. The button on the edit screen, including the drag-over state.
3. The result list after processing five files (success, skipped, incompatible,
   and failed rows, with the total row).
4. A before/after size comparison on the record detail screen.

## What it does

- Adds one button to a space field on the record create and edit screens (desktop
  and mobile).
- Opens a file picker, or accepts files dropped on the button (drop is desktop
  only).
- Detects the real image format from the file bytes, not the extension.
- Scales the long edge down to the configured limit and re-encodes JPEG, PNG, and
  WebP. JPEG and (optionally) opaque PNG become JPEG; transparent PNG stays PNG;
  WebP becomes JPEG.
- Attaches GIF, SVG, HEIC, animated PNG, images over 100 MP, and files below the
  size threshold without changing them.
- Uploads each result and appends it to the target attachment field in selection
  order. Existing attachments are kept.
- You save the record yourself; the plugin only fills the field.

## Install

1. Build the plugin zip:
   ```
   npm install
   npm run pack
   ```
   `npm run pack` writes `dist/plugin.zip`. On the first run it also generates
   `private.ppk` and keeps it out of git. Reuse the same `private.ppk` for later
   builds so the plugin id stays the same.
2. In kintone, open the system settings, go to Plugins, and upload
   `dist/plugin.zip`.
3. Add the plugin to an app, then configure it (below) and update the app.

## Settings

| Setting | What it does | Default |
| --- | --- | --- |
| Button space | The space field where the button appears | none (required) |
| Target attachment field | The field new files are appended to | none (required) |
| Long-edge limit (px) | Downscales the long edge to this size | 1920 |
| JPEG quality | 0.5 to 0.95; lower is smaller and coarser | 0.8 |
| Skip threshold (KB) | Files smaller than this are attached unchanged | 300 |
| Convert opaque PNG to JPEG | Encode PNGs without transparency as JPEG | on |
| Prepend capture date | Add a `YYYYMMDD_` prefix to re-encoded files | off |
| Button label | The text on the button | 画像を圧縮して添付 |

## How files are handled

- Format is decided from the leading bytes. A `.jpg` file that is really a PNG is
  treated as a PNG, and the output extension follows the real output format.
- JPEG, PNG, and WebP are compressed. GIF, SVG, HEIC, animated PNG, images over
  100 MP, and files below the skip threshold are attached as-is.
- If the re-encoded file is not smaller than the original, the original is
  attached instead, and its EXIF is kept.
- Re-encoding removes all EXIF, including GPS location. Turn on "Prepend capture
  date" to keep the capture date in the file name.
- Duplicate names get a ` (2)`, ` (3)` suffix, compared without case.
- A 0-byte file or a file over 100 MB is not attached and is shown as a failure.

## Limitations

- The standard attachment field's own file picker is not intercepted. Files chosen
  there are not compressed. Use this plugin's button instead.
- HEIC is not decoded or converted. Browsers have no HEIC decoder, so HEIC files
  are attached unchanged.
- Animated GIF and animated PNG are attached unchanged; their animation is not
  resized.
- Output is JPEG or PNG only. WebP and AVIF output are not used because Safari's
  `toBlob('image/webp')` support is inconsistent.
- On iOS Safari, canvases larger than the device limit can fail to encode. Those
  files fall back to being attached unchanged.

## Privacy

No external transmission. The plugin uses only the browser and the kintone REST
API under the logged-in user's session. It stores no API tokens and writes
nothing to localStorage.

## Development

```
npm install
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit tests for the core logic
npm run build       # builds desktop.js, mobile.js, config.js into dist/
npm run pack        # builds, then packs dist/plugin.zip (generates private.ppk once)
```

`test/e2e` holds Playwright specs for the main flows. They run against a
development kintone environment and read the connection from `KINTONE_BASE_URL`,
`KINTONE_USERNAME`, `KINTONE_PASSWORD`, and `KINTONE_APP_ID`. They are not part of
CI.

### TODO

- FR-10: uploads are currently serialized with the record append step to keep
  file-name deduplication deterministic. The spec allows uploads to run in
  parallel while only the append is serialized. Parallelizing the upload is a
  performance improvement, not a correctness change.

## License

MIT. See [LICENSE](LICENSE).
