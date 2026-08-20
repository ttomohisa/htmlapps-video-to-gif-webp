# Video to GIF / WebP

動画の好きな範囲を、**Animated GIF** または **Animated WebP** に変換するブラウザーアプリです。

動画はサーバーへアップロードせず、FFmpeg 9の用途専用WebAssemblyを使って端末内だけで処理します。配布物は単一HTMLで、ローカルファイルとして直接開くこともGitHub Pagesへ配置することもできます。

## 特徴

- 動画の開始・終了位置をプレビューしながら指定
- Animated GIF / Animated WebPを切替
- 320 / 480 / 720px / 元サイズ
- 10 / 15 / 20 / 30 FPS
- 軽量 / 標準 / 高品質プリセット
- GIF: 色数・Ditherを詳細設定
- WebP: Quality・Compression level・Losslessを詳細設定
- 変換結果のプレビュー、ファイル名指定、保存、対応端末で共有
- 日本語 / English
- ライトUIのみ
- 実行時ネットワーク通信なし
- スマホ向け固定アクションバー

## FFmpeg WASM

このアプリは [htmlapps-ffmpeg-wasm-builder](https://github.com/ttomohisa/htmlapps-ffmpeg-wasm-builder) **v1.5.0** の次のprofileを使用します。

- `video-to-gif`
- `video-to-webp`

ビルド時にGitHub Releaseからprofile ZIPと`SHA256SUMS.txt`を取得し、SHA-256を検証してからgzip済みの`ffmpeg.js` / `ffmpeg.wasm`をHTMLへ埋め込みます。

ブラウザーでアプリを使うときにGitHubへアクセスすることはありません。GIF/WebPの両coreは圧縮されたままHTMLに入り、変換時には選択した形式のcoreだけを展開します。

入力動画はWORKERFSで扱うため、変換前に元動画全体をWASMのMEMFSへコピーしません。生成結果は現在MEMFSから返すため、非常に長い・高解像度・高FPSのアニメーションは端末メモリの影響を受けます。

## ビルド

Windows 10/11で実行します。

```bat
build-standalone.bat
```

初回はFFmpeg WASM Builder v1.5.0のRelease資産を`.cache/`へ取得します。2回目以降はキャッシュを利用します。

再取得する場合:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\build-standalone.ps1 -ForceDownload
```

生成物:

```text
dist/
├─ index.html
├─ index.self-extract.html
├─ dependency-manifest.json
├─ self-extract-manifest.json
└─ .nojekyll
```

`dist/index.html`は読みやすい単一HTML、`dist/index.self-extract.html`はgzipしたHTML本体を内包する自己解凍版です。

## 使い方

1. 動画を選択またはドロップします。
2. 再生ボタンとサムネイル付きタイムラインを使って、開始・終了位置を指定します。
3. GIF / WebP、横幅、FPS、品質を選びます。
4. 「作成」を押します。
5. 完成したアニメーションを確認し、ファイル名を指定して保存します。

ブラウザーが元動画のcodecを再生できない場合でも、FFmpeg WASMでは変換できる場合があります。その場合はプレビューなしで開始・終了秒を入力してください。

## 開発時の確認

```powershell
.\scripts\check-repository.ps1
```

最低限、次を確認してください。

- `dist/index.html`を`file://`で直接開く
- GIF / WebPをそれぞれ生成
- H.264 MP4、HEVCスマホ動画、縦動画を確認
- 360px幅のスマホUI
- 日本語 / English
- 変換中にNetwork通信が発生しない
- `dist/index.self-extract.html`でも同じ操作ができる

## プライバシー

動画・変換結果・設定はこのアプリから外部へ送信されません。Runtime CSPには`connect-src 'none'`を指定しています。

## ライセンス

アプリ本体のライセンスは [LICENSE](LICENSE) を参照してください。FFmpeg WASM coreとlibwebp等の第三者ライセンスについては [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) およびFFmpeg WASM Builder v1.5.0 Releaseを参照してください。

### UI

Output settings keep format and quality prominent while width, FPS, crop, and looping are grouped into compact setting rows. Custom width/FPS fields only appear when Custom is selected, with a small allowed-range hint beside the field. On mobile, the trim timeline sits directly below the video preview and source metadata moves below the timeline. Start/end fine tuning uses one shared step selector (1 output frame or 0.1 second) with simple minus/plus controls for each endpoint.
