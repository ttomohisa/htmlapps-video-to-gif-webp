#!/usr/bin/env bash
# Package the exact upstream texts shipped with the two pinned runtime profiles.
set -euo pipefail
cd "$(dirname "$0")/.."
root="$PWD"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/upstream" "$work/license-bundle"
cd "$work"
base='https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder/releases/download/v1.10.1'
for profile in video-to-gif video-to-webp; do
  archive="ffmpeg-wasm-${profile}-v1.10.1.zip"
  curl --fail --location --retry 3 --silent --show-error "$base/$archive" -o "upstream/$archive"
done
(
  cd upstream
  printf '%s\n' \
    'f165f455a6033998de55b0fdf55622199f5cadb8ed27e5af4e6285d1947b08f8  ffmpeg-wasm-video-to-gif-v1.10.1.zip' \
    'b37711ed8cb05a299ee865c676446e8c400686953ca8e837e43a58e6402dcae4  ffmpeg-wasm-video-to-webp-v1.10.1.zip' | sha256sum -c -
)
for profile in video-to-gif video-to-webp; do
  unzip -q "upstream/ffmpeg-wasm-${profile}-v1.10.1.zip" -d "upstream/$profile"
  mkdir -p "license-bundle/$profile"
  cp -R "upstream/$profile/LICENSES" "upstream/$profile/BUILDINFO.txt" "upstream/$profile/THIRD_PARTY_NOTICES.md" "license-bundle/$profile/"
  for notice in FFmpeg-COPYING.LGPLv2.1 Builder-MIT.txt Emscripten-LICENSE Emscripten-musl-COPYRIGHT Emscripten-compiler-rt-LICENSE.txt; do
    test -s "license-bundle/$profile/LICENSES/$notice"
  done
done
test -s license-bundle/video-to-webp/LICENSES/libwebp-COPYING
cp "$root/LICENSE" "$root/THIRD_PARTY_NOTICES.md" license-bundle/
printf '%s\n' 'Corresponding source (pinned Builder release):' "$base/ffmpeg-wasm-sources-v1.10.1.tar.gz" > license-bundle/SOURCE.txt
(cd license-bundle && zip -qr "$work/third-party-licenses.zip" .)
unzip -tq "$work/third-party-licenses.zip"
mv "$work/third-party-licenses.zip" "$root/third-party-licenses.zip"
echo 'LICENSE_BUNDLE_PASS'
