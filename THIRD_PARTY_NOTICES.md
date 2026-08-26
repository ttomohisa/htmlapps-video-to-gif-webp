# Third-party notices

This application source is distributed under the repository license. The generated standalone HTML also embeds profile-specific binary assets built by **FFmpeg WASM Builder v1.5.0**.

## FFmpeg WASM Builder v1.5.0

- Repository: `ttomohisa/htmlapps-ffmpeg-wasm-builder`
- Profiles embedded by this app: `video-to-gif`, `video-to-webp`
- The builder's own source is MIT-licensed.
- The generated GIF/WebP FFmpeg cores are distributed under LGPL-2.1-or-later according to the builder release metadata.
- The WebP profile also links libwebp and carries its upstream notice/license in the release bundle.

The application build downloads the official v1.5.0 profile ZIPs, verifies them against the release `SHA256SUMS.txt`, and embeds only the runtime files needed by this app. The full upstream notices remain available in the pinned Builder release.

See `ffmpeg.config.json` for the exact pinned release and profile archive names.


## Big Buck Bunny — documentation screenshots

The repository screenshots (`assets/screenshot.png` and `assets/screenshot-en.png`) use media from **Big Buck Bunny** as sample video content.

- Copyright: © 2008 Blender Foundation / www.bigbuckbunny.org
- License: Creative Commons Attribution 3.0 Unported (CC BY 3.0)
- License URL: https://creativecommons.org/licenses/by/3.0/
- Project/license information: https://peach.blender.org/about/
- Usage in this repository: documentation screenshots only; the screenshot-capture sample video is not redistributed in the repository.

The Big Buck Bunny project states that reused parts of the movie should be attributed as: `(c) copyright 2008, Blender Foundation / www.bigbuckbunny.org`.
