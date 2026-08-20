# Dependencies

There are no npm runtime dependencies.

The application build embeds two binary profiles from `ttomohisa/htmlapps-ffmpeg-wasm-builder` v1.5.0:

- `ffmpeg-wasm-video-to-gif-v1.5.0.zip`
- `ffmpeg-wasm-video-to-webp-v1.5.0.zip`

The build verifies both archives using the release `SHA256SUMS.txt` before embedding `ffmpeg.js.gz`, `ffmpeg.wasm.gz`, and the shared `browser-ffmpeg.js` runtime.

See `ffmpeg.config.json` and `THIRD_PARTY_NOTICES.md`.
