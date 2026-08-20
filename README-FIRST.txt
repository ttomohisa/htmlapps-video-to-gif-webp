Video to GIF / WebP
===================

1. Run build-standalone.bat on Windows.
2. The build downloads the pinned FFmpeg WASM Builder v1.5.0 GIF/WebP profile ZIPs once and caches them under .cache/.
3. The release SHA256SUMS.txt is used to verify both ZIP archives.
4. Open dist\index.html directly and test with a short MP4 first.
5. Also test dist\index.self-extract.html before release.

Runtime conversion is fully local. GitHub is accessed only while building/updating the app, never while a user converts a video.

Before Builder v1.5.0 is released, you can test against a local Builder checkout:
  1. Build video-to-gif and video-to-webp in the Builder repo.
  2. Run: build-standalone-local.bat C:\path\to\htmlapps-ffmpeg-wasm-builder\dist
After v1.5.0 is released, use build-standalone.bat normally.
