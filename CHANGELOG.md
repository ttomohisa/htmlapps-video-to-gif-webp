# Changelog

## 1.0.0 - 2026-08-20

- 横幅 / FPS のスマホ表示を縦型レイアウトへ変更し、自由入力時の崩れを修正。
- 自由入力の許容範囲を入力欄直下へ控えめに表示。
- 微調整UIを「調整幅 + 開始/終了の − / ＋」へ整理し、ボタンの重複を削減。
- 出力設定UIを再構成。横幅 / FPS / クロップをコンパクトな設定行へ統合し、自由入力は選択時のみ表示。
- ループ設定をスイッチ化し、出力ファイル名を「作成」セクションへ移動。
- 選択範囲だけをプレビュー再生できる操作を追加。
- 開始・終了に ±0.1秒 / ±1出力フレームの微調整を追加。
- 1:1 / 4:3 / 16:9 / 9:16 のクロップとプレビュー上の位置調整を追加。
- GIF / WebP の「ループする」設定を追加。OFF時は1回再生で停止する出力に変更。
- プレビュー画面のクリック/タップで再生・一時停止できるように変更。
- FFmpeg WASM Builder v1.5.0 のcrop対応coreへ更新。

- スマホでは動画情報をタイムラインの下へ移し、プレビューと切り出しタイムラインを隣接させて操作しやすくした。
- 横幅 / FPS の自由入力時に、入力欄の横へ許容範囲を小さく表示するようにした。

- Simplified the source preview to a play/pause-only control; seeking stays in the trim timeline.
- Added validated custom width (16–4096px) and FPS (1–60) inputs alongside presets.

- Initial Video to GIF / WebP application implementation.
- Added local video preview and trim controls.
- Added Animated GIF generation with palette/color/dither settings.
- Added Animated WebP generation with quality/compression/lossless settings.
- Added build-time pinning and SHA-256 verification for FFmpeg WASM Builder v1.5.0 release assets.
- Added mobile bottom actions, bilingual help, output preview, filename editing, save, and share support.
