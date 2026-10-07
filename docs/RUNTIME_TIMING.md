# Animation runtime timing and provenance

## Pinned release

App v1.0.2 uses the GIF and WebP profiles from the published
[Builder v1.10.1 release](https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder/releases/tag/v1.10.1),
Builder source commit `5f3f2752fd4bc13627ba34604fe7f550fec329fa`.

- `ffmpeg-wasm-video-to-gif-v1.10.1.zip`: SHA-256
  `f165f455a6033998de55b0fdf55622199f5cadb8ed27e5af4e6285d1947b08f8`.
- `ffmpeg-wasm-video-to-webp-v1.10.1.zip`: SHA-256
  `b37711ed8cb05a299ee865c676446e8c400686953ca8e837e43a58e6402dcae4`.

The canonical build verifies ZIPs against the release `SHA256SUMS.txt`, checks
that both profiles carry the same browser runtime, and records archive hashes and
upstream manifests in `dist/dependency-manifest.json`. Artifact tests additionally
check the above released archive hashes, Builder/profile/license provenance, and
both compressed and decompressed embedded JavaScript/WASM hashes. Local Builder
development builds retain their explicit `local-build` provenance.

Both profiles identify FFmpeg `n9.0.1`, commit
`bf1b838f2ab88b4f8fd83443325c782ea0e0f7fa`, and LGPL-2.1-or-later binary licensing.
The WebP profile links libwebp v1.6.0, commit
`4fa21912338357f89e4fd51cf2368325b59e9bd9`; the GIF profile does not. Source,
BUILDINFO and complete licenses/notices are available in the release, including
[the corresponding source archive](https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder/releases/download/v1.10.1/ffmpeg-wasm-sources-v1.10.1.tar.gz).
See also [third-party notices](../THIRD_PARTY_NOTICES.md).

## Regression and fix

The old v1.5.0 GIF core emitted a one-centisecond final frame, even when the
selected rate required a longer interval. v1.10.1 preserves normalized frame
duration through encoding. This consumer update uses the released core without
modifying it or patching GIF frame delays. Trim, crop, quality and app loop
postprocessing are unchanged.

GIF timing uses centiseconds. At 15 or 30 fps, the test compares adjacent rounded
presentation timestamps and separately rounds the final interval. It does not
require every interval to equal an unrepresentable fractional centisecond.
Playback software may normalize short delays, so these are encoded-file checks,
not claims about visibly measured playback speed.

## Automated verification

```powershell
./scripts/check-repository.ps1
```

The aggregate check runs:

- 10 structural-reader tests, including truncation, loop metadata, palettes,
  opaque compressed bytes and WebP chunk boundaries.
- Existing synthetic trim/header regressions on source and restored release.
- Canonical readable and self-extract builds, standalone/CSP checks, catalog
  byte parity, JavaScript syntax and embedded asset provenance.
- `node scripts/test-runtime-timing.cjs`: the actual JavaScript and WASM extracted
  from each generated HTML form, with the embedded runtime and the app's actual
  `profileArgs` and loop handlers. Two tiny committed synthetic videos are loaded
  into MEMFS. No conversion result or timing is mocked.

For each HTML form the runtime suite checks six encodes and both loop states:
three-second GIF at 10, 15 and 30 fps; a 0.5–2.5-second trimmed GIF at 10 fps; a
single-frame GIF; and a three-second WebP control. That is 24 loop-result checks
across both artifacts. GIF dimensions, frame count, every GCE delay, total time
and loop metadata are asserted. WebP permits lossless timing coalescence of
identical adjacent frames and must retain the 3000-ms endpoint.

The same script accepts an explicit previously built HTML path for a red check:

```sh
node scripts/test-runtime-timing.cjs path/to/v1.5.0/index.html
```

Observed red on the old emitted v1.5.0 core: final GIF delays were 1 cs instead of
10, 7 and 3 cs respectively, and both trimmed/single-frame 10-fps cases failed.
WebP passed at 3000 ms. On the emitted v1.10.1 core all 24 loop-result checks
passed; the WebP control output hashes were unchanged in both loop states.
Set `TIMING_OUTPUT_DIR` to save synthetic outputs for independent inspection;
stdout includes arguments, output hashes and structural timing receipts.

## Browser checks still required

Node/MEMFS does not exercise Blob Workers, WORKERFS, browser loading, visual
playback, save/share, console/network observation, or direct `file://` execution.
Before treating the app as browser-verified, test the exact PR preview and both
HTML forms directly: load a synthetic video, trim 2–8 seconds at 10 fps, save GIF
with loop ON/OFF, and independently inspect 60 × 10-cs frame delays. Also check
15/30 fps, single-frame GIF, WebP, source replacement/repeated conversions, JA/EN
help, narrow/mobile layout and no runtime network requests. Do not infer encoded
duration from the selected-range label alone.
