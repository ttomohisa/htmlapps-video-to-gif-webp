# Synthetic animation timing fixtures

Copied from the MIT-licensed FFmpeg WASM Builder v1.10.1 timing suite. These are
64×48 synthetic test patterns with no audio, input B-frames, private user media,
or runtime download. Regeneration requires a native FFmpeg with libx264; running
the committed tests needs only Node.js 22+ and the emitted HTML.

- `timing-cfr.mp4`: 72 frames at 24 fps, exactly 3 seconds.
  SHA-256: `2246b147b823f90cc4a2eae210fb68c6d4547dffba5b9eafbafadc80fb3020e3`.
- `timing-single.mp4`: one frame lasting 0.1 seconds at 10 fps.
  SHA-256: `f164c3d2b7809d539cf862ff51d46985e8599738d88bc467f651380cf98bcc7e`.

Optional regeneration (encoder/toolchain versions can change fixture bytes):

```sh
ffmpeg -v error -f lavfi -i 'testsrc2=size=64x48:rate=24:duration=3' -c:v libx264 -preset veryfast -crf 28 -bf 0 -an -y scripts/fixtures/timing-cfr.mp4
ffmpeg -v error -f lavfi -i 'testsrc2=size=64x48:rate=10:duration=0.1' -c:v libx264 -preset veryfast -crf 28 -bf 0 -an -y scripts/fixtures/timing-single.mp4
```
