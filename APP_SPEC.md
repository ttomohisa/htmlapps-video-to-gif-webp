# APP_SPEC.md

## 1. Product identity

- **Name:** Video to GIF / WebP / 動画をGIF / WebPに変換
- **Repository:** `ttomohisa/htmlapps-video-to-gif-webp`
- **Version:** `1.0.0`
- **Purpose:** Convert a chosen range of a local video into an animated GIF or animated WebP without uploading the source file.
- **Primary users:** Smartphone and desktop users who need a short animation for chat, documentation, social posts, issue reports, or web pages.
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`

## 2. Core user flow

1. Open the page locally or through GitHub Pages.
2. Select or drop a video.
3. Preview the video when the browser can play it.
4. Choose the start and end of the animation with the trim controls or current playback position.
5. Choose GIF or WebP, output width, FPS, and a simple quality preset.
6. Optionally open advanced settings for GIF colors/dithering or WebP quality/compression/lossless mode.
7. Create the animation locally with the pinned FFmpeg 9 WASM profile.
8. Preview, rename, save, or share the result.

## 3. Functional requirements

- Accept local video files via file picker and drag/drop.
- Never upload the input or output.
- Use `video-to-gif` and `video-to-webp` from FFmpeg WASM Builder v1.5.0.
- Vendor/embed release assets at build time. Do not fetch FFmpeg assets during app runtime.
- Keep the source `File` as WORKERFS input; do not copy the full input video to MEMFS before conversion.
- Inflate/load only the selected output format's gzip core.
- Support trim start/end and current-position-to-start/end. The preview exposes only play/pause; seeking belongs to the thumbnail timeline.
- Support width presets 320/480/720/original plus custom integer width 16–4096px, and FPS presets 10/15/20/30 plus custom integer FPS 1–60.
- Support light/standard/high quality presets.
- GIF advanced settings: 16-256 colors and supported dither modes.
- WebP advanced settings: quality 0-100, compression 0-6, and lossless mode.
- Show output preview, byte size, duration/settings summary, editable filename, Save, and Web Share when supported.
- Preserve Japanese/English switching without reload.
- Light-only UI.
- Provide help as “使い方と注意事項” from the upper-right `?` button.
- Use an in-app confirmation for unusually heavy settings and for repeating an identical conversion when a result already exists.

## 4. Data and privacy

- Source video remains on the user's device.
- FFmpeg WASM runs in a Blob Worker.
- Runtime CSP blocks network connections with `connect-src 'none'`.
- Build time may download the pinned FFmpeg WASM Builder v1.5.0 release assets and checksum file.
- No analytics, telemetry, login, cloud storage, or server conversion.

## 5. UX and accessibility

- Mobile-first from 320px upward.
- Main controls fit at 360px without horizontal scrolling.
- Video, settings, create, and save are reachable from the reusable smartphone bottom bar.
- Visible focus states and proper accessible names.
- Status/progress uses an `aria-live` region.
- If the browser cannot preview a codec, explain that conversion may still work and allow numeric trim input.
- Warn rather than silently blocking long/high-resolution/high-FPS conversions.

## 6. Performance and memory

- Default output: WebP, 480px, 15fps, Standard.
- Initial selected range: first 5 seconds when duration is known.
- Keep both cores compressed in the HTML; inflate only the currently selected format during conversion.
- Dispose the runner after each job.
- Revoke obsolete Blob URLs.
- Output is currently returned through MEMFS, so very large animations can exceed browser/device memory.

## 7. Browser target

Current stable Chromium, Firefox, and Safari on desktop and mobile. Direct `file://` opening is required. The app requires WebAssembly, Blob Worker support, and `DecompressionStream('gzip')` for the compact embedded cores.

## 8. Acceptance criteria

- `build-standalone.bat` downloads/verifies v1.5.0 assets and generates the two standalone HTML variants.
- `scripts/verify-standalone.ps1` passes.
- No unresolved app/FFmpeg build placeholders remain.
- No runtime external script, stylesheet, frame, module import, or CSS asset URL remains.
- Runtime CSP contains `connect-src 'none'`.
- GIF conversion uses `BrowserFFmpeg.videoToGifArgs()`.
- WebP conversion uses `BrowserFFmpeg.videoToWebpArgs()`.
- Input is mounted through WORKERFS.
- Changing between GIF and WebP changes the advanced settings and output extension.
- A generated result can be previewed and downloaded.
- Japanese and English copy fit on a 360px-wide screen.

## 9. Non-goals for v1.0.0

- Video editing beyond selecting one continuous range.
- Audio preservation; GIF/WebP outputs are visual animations only.
- Batch conversion.
- Side-by-side GIF/WebP generation in one click.
- Automatic target-file-size optimization.
- Server fallback.

## UI organization

- Keep format and quality as the primary visible choices.
- Present width, FPS, crop, and looping as compact setting rows instead of large button grids.
- Show custom width/FPS inputs only when Custom is selected, with a compact visible allowed-range hint.
- On mobile, keep the trim timeline immediately after the video preview; place source metadata below the trim controls.
- Fine tuning uses one shared step selector (1 output frame or 0.1 second) and simple minus/plus controls for Start and End.
- Keep the output filename next to the Create action rather than in the main settings cluster.
- Use progressive disclosure for codec-specific advanced settings.
