# Video to GIF / WebP

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-video-to-gif-webp/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-video-to-gif-webp/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-video-to-gif-webp/)

[English README](README.md)

動画の好きな範囲を、ファイルを外部へアップロードせずブラウザ内だけでアニメーションGIFまたはWebPに変換できる単一HTMLアプリです。

## 🚀 デモ

### [GitHub PagesでVideo to GIF / WebPを開く](https://ttomohisa.github.io/htmlapps-video-to-gif-webp/)

GitHub Pagesから最初のHTMLを読み込んだ後、範囲指定・動画デコード・クロップ・リサイズ・FPS変換・GIF/WebP生成・プレビュー・保存は端末内で処理されます。選択した動画がアプリからサーバーへアップロードされることはありません。

## 主な機能

- 動画の好きな範囲をAnimated GIF / Animated WebPへ変換
- サムネイル付きタイムラインで開始位置 `S`・終了位置 `E`・現在位置を操作
- **選択範囲を再生**して、変換される部分だけを事前確認
- 開始・終了位置を**0.1秒**または**出力1フレーム分**ずつ微調整
- 動画プレビューをクリック / タップして再生・一時停止。シーク操作はタイムラインへ集約
- 1:1 / 4:3 / 16:9 / 9:16でクロップし、プレビュー上の枠をドラッグして位置調整
- 無限ループON / 1回再生で停止を切り替え
- 横幅 320 / 480 / 720px / 元サイズ
- 横幅を16〜4096pxの整数で自由入力
- 10 / 15 / 20 / 30 FPS
- FPSを1〜60の整数で自由入力
- 軽量 / 標準 / 高品質プリセット
- GIF詳細設定：色数・Dither
- WebP詳細設定：Quality・Compression level・Lossless
- 出力ファイル名を編集し、`.gif` / `.webp` 拡張子を形式に合わせて自動調整
- 生成結果のプレビュー・ファイルサイズ表示・保存・対応端末で共有
- 1つのHTML内で日本語 / Englishを切り替え
- スマートフォン優先のレスポンシブUIと固定アクションバー
- SVG faviconをHTML内に埋め込み
- 実行時のCDN・外部JavaScript依存なし
- GIF / WebP用の小型FFmpeg WASMをgzip圧縮して内包し、選択した形式だけを展開して使用

## すぐに使う

### Webで使う

[デモを開く](https://ttomohisa.github.io/htmlapps-video-to-gif-webp/)だけで利用できます。インストールやアカウント登録は不要です。

### 単一HTMLをビルドして使う

1. このリポジトリをダウンロードまたはクローンします。
2. Windowsで `build-standalone.bat` をダブルクリックします。
3. 初回だけ、`ffmpeg.config.json` で固定されたFFmpeg WASM Builder Releaseを取得し、ハッシュを検証します。
4. 生成された `dist/index.html` を開きます。
5. 以降はその単一HTMLを任意の場所へコピーし、`file://` から直接利用できます。

同時に `dist/index.self-extract.html` も生成されます。こちらはアプリ本体HTMLをgzip圧縮して内包し、起動時に展開する自己解凍版です。

Python、Node.js、ローカルWebサーバーは不要です。Windows標準のPowerShellと `tar.exe` を使用します。

## 使い方

1. 動画を選択またはドロップします。
2. サムネイル付きタイムラインで開始位置 `S` と終了位置 `E` を決めます。
3. 白い再生位置をドラッグしてシークし、動画プレビューはクリック / タップで再生・一時停止します。
4. **選択範囲を再生**して、アニメーションになる部分だけを確認します。
5. 必要に応じて、開始・終了を1フレームまたは0.1秒ずつ微調整します。
6. GIF / WebP、品質、横幅、FPS、クロップ、ループを設定します。
7. 出力ファイル名を入力して **作成** を押します。
8. 完成したアニメーションを確認し、保存または共有します。

ブラウザが元動画のcodecをプレビューできなくても、FFmpeg WASMでは変換できる場合があります。その場合は開始・終了時刻を直接入力して変換を試してください。

## GIFとWebPの違い

| | GIF | WebP |
| --- | --- | --- |
| 色 | 最大256色 | フルカラー |
| 互換性 | 非常に広い | Animated WebP対応先ではおすすめ |
| 容量 | 同程度の見た目では大きくなりやすい | 小さくしやすい |
| 詳細設定 | 色数・Dither | Quality・圧縮レベル・Lossless |
| ループ | 無限 / 1回再生 | 無限 / 1回再生 |

初期設定は **WebP / 横幅480px / 15fps / 標準品質** です。互換性を優先する場合はGIF、色や容量を重視できる環境ではWebPがおすすめです。

## GitHub Pagesで公開する

このリポジトリには、完全内包版をビルドしてGitHub Pagesへ自動公開するワークフローが含まれています。

1. リポジトリ名を `htmlapps-video-to-gif-webp` としてGitHubへプッシュします。
2. **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選択します。
3. `main` ブランチへプッシュするか、Actions画面から **Deploy standalone app to GitHub Pages** を手動実行します。
4. ビルド成功後、`https://ttomohisa.github.io/htmlapps-video-to-gif-webp/` で公開されます。

`main` へのプッシュ時には、固定したFFmpeg WASM資産から単一HTMLを再生成し、リポジトリ検証を通してから `dist` を公開します。GitHub Pagesをまだ有効化していない場合は、`configure-pages` で失敗させず、ビルド後に初回設定手順を表示する構成です。

## 開発とビルド

```text
.
├─ src/index.template.html          # アプリ本体のテンプレート
├─ app.config.json                  # アプリ名・バージョンなど
├─ ffmpeg.config.json               # FFmpeg WASM Builderの固定Release / profile
├─ build-standalone.bat             # Windows用ビルド入口
├─ build-standalone-local.bat       # ローカルBuilder distを使うビルド
├─ build-standalone.ps1             # 単一HTML生成処理
├─ components/                      # 確認ダイアログ・スマホ下部バーなど
├─ scripts/                         # 検証・自己解凍版生成スクリプト
├─ dist/
│  ├─ index.html                    # 生成される単一HTML
│  └─ index.self-extract.html       # 生成される自己解凍版
└─ .github/workflows/
   ├─ build-standalone.yml          # Pull Request時のビルド検証
   └─ deploy-pages.yml              # mainからPagesへ自動公開
```

### FFmpeg WASM profile

このアプリは [htmlapps-ffmpeg-wasm-builder](https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder) を `ffmpeg.config.json` で固定し、次の用途専用profileを内包します。

- `video-to-gif`
- `video-to-webp`

通常ビルドでは、固定Releaseのprofile ZIPと `SHA256SUMS.txt` を取得し、SHA-256を検証してからgzip済みの `ffmpeg.js` / `ffmpeg.wasm` をHTMLへ埋め込みます。アプリを使うブラウザが、実行時にGitHubからFFmpegをダウンロードすることはありません。

入力動画はWORKERFSへ `File` / `Blob` のままマウントするため、変換開始前に元動画全体をMEMFSへコピーしません。一方、生成結果は現在MEMFS経由で返すため、非常に大きな出力はブラウザ・端末の利用可能メモリに依存します。

GitHub Releaseではなく、ローカルでビルドしたFFmpeg WASM Builderを使って開発する場合：

```bat
build-standalone-local.bat ..\htmlapps-ffmpeg-wasm-builder-main\dist
```

### キャッシュを破棄して再取得する

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-standalone.ps1 -ForceDownload
```

### リポジトリ検証

```powershell
.\scripts\check-repository.ps1
```

ビルド・検証処理では、主に次を確認します。

- 必須ファイルと共通コンポーネントの存在
- FFmpeg WASM Builderの固定バージョンと必要profile
- Builder Release ZIPのSHA-256
- 未置換のビルド用プレースホルダーが残っていないこと
- 実行時の外部script / stylesheet / module参照が残っていないこと
- CSPに `connect-src 'none'` が含まれること
- 一般JavaScriptの `unsafe-eval` を許可せず、WebAssemblyだけを `wasm-unsafe-eval` で実行できること
- GIF / WebP用runner APIが含まれること
- 元動画がWORKERFS経由で渡されること
- 動画プレビューにブラウザ標準のシークUIが出ないこと
- 通常版と自己解凍版の両方が生成・検証できること

## プライバシーと通信防止

生成された単一HTMLは、選択した動画をブラウザセッション外へ送信しない構成です。

- 動画デコードとアニメーション生成はFFmpeg WebAssemblyで端末内処理
- Runtime CSPに `connect-src 'none'` を指定
- FFmpeg資産はビルド時だけ取得し、生成HTMLへ埋め込み
- 変換時には選択したGIFまたはWebP coreだけを展開・起動
- Analytics、Telemetry、ログイン、Cloud storage、Server conversionなし

GitHub Pages版ではページを開くためのHTML配信は発生しますが、選択した動画の内容はアプリから外部へ送信されません。完全にネットワークを切って使う場合は、生成済みの `dist/index.html` をローカルで開いてください。

## 制限事項

- 1回の変換で扱えるのは1つの連続した範囲です。汎用的な動画編集アプリではありません。
- Animated GIF / WebPには元動画の音声は引き継がれません。
- GIFは256色までです。
- 長時間・高解像度・高FPS・Lossless WebP・多色GIFは、処理時間とメモリ使用量が大きくなります。
- ブラウザでプレビューできないcodecでもFFmpegでは変換できる場合があります。
- 出力は保存前にブラウザメモリ上へ作るため、メモリの少ない端末では非常に大きなアニメーションを生成できない場合があります。
- 小型WASMの展開には、WebAssembly・Blob Worker・`DecompressionStream('gzip')` に対応した比較的新しいブラウザが必要です。

4Kなどの大きな動画では、まず**短い範囲・横幅480px・15fps**程度から試し、必要に応じて品質を上げるのがおすすめです。

## 使用ライブラリ

| コンポーネント | 固定方法 | ライセンス | 用途 |
| --- | --- | --- | --- |
| FFmpeg 9 compact WASM (`video-to-gif`) | `ffmpeg.config.json` のFFmpeg WASM Builder Release | LGPL-2.1-or-later | デコード、範囲切り出し、クロップ、リサイズ、パレット生成、GIF生成 |
| FFmpeg 9 compact WASM (`video-to-webp`) | `ffmpeg.config.json` のFFmpeg WASM Builder Release | LGPL-2.1-or-later | デコード、範囲切り出し、クロップ、リサイズ、Animated WebP生成 |
| libwebp | WebP用Builder profileにのみ含有 | upstream license | Animated WebP encoder |

詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) と、固定しているFFmpeg WASM Builder Releaseのライセンス・BUILDINFOを確認してください。

## コントリビューション

バグ報告や機能提案はIssueからお願いします。開発への参加方法は [CONTRIBUTING.md](CONTRIBUTING.md) を確認してください。

## ライセンス

Copyright © 2026 ttomohisa

このリポジトリのアプリ本体ソースは [MIT License](LICENSE) で公開されています。

生成された単一HTMLにはFFmpeg / libwebp由来のバイナリも、それぞれのライセンスに従って内包されます。リポジトリのMIT Licenseで第三者バイナリを再ライセンスするものではありません。詳細は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) を確認してください。
