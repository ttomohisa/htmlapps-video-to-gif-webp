# Offline verification

1. Run `build-standalone.bat` once while online so the pinned FFmpeg release assets can be downloaded and cached.
2. Disconnect the network.
3. Open `dist/index.html` directly from Explorer.
4. Convert a short video to GIF and WebP.
5. Confirm both results preview and save successfully.
6. Open DevTools Network before each conversion and confirm there are no requests.
7. Repeat with `dist/index.self-extract.html`.

After the first successful build, rebuilding can also work offline while the verified `.cache/ffmpeg-wasm-builder-v1.5.0` files remain present.
