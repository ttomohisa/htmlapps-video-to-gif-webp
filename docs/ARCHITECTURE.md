# Architecture

## Runtime

```text
single index.html
├─ UI / video preview / trim controls
├─ browser-ffmpeg.js runtime
├─ gzip: video-to-gif ffmpeg.js + ffmpeg.wasm
└─ gzip: video-to-webp ffmpeg.js + ffmpeg.wasm
          ↓ only selected pair is inflated
      Blob Web Worker
          ↓
       WORKERFS
          ↓
    source File / Blob
          ↓
      output MEMFS
          ↓
      Uint8Array
          ↓
  Blob URL preview/save/share
```

The video preview uses the native `<video>` element and is independent of FFmpeg decoding. A codec can therefore be convertible by FFmpeg even when the browser cannot preview it.

## GIF path

The pinned Builder profile performs trim, FPS reduction, autorotation, resize, then a two-pass palette workflow (`palettegen` followed by `paletteuse`) before GIF encoding.

## WebP path

The pinned Builder profile performs the same preprocessing and uses FFmpeg's `libwebp_anim` wrapper. Only this profile links libwebp.

## Build-time supply chain

`ffmpeg.config.json` pins Builder v1.5.0 and exact release archive names. `build-standalone.ps1` downloads `SHA256SUMS.txt`, verifies each profile ZIP, extracts the profile bundle, checks that the runtime matches between the two profiles, then embeds the gzip assets.

No FFmpeg release download occurs during normal app runtime.
