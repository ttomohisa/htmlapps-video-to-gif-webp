const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "選択した形式のFFmpeg coreだけを読み込みます。",
  "Only the selected FFmpeg core is loaded.",
  "小さい画面ではダイアログ内をスクロールできます。",
  "On a small screen, scroll inside the dialog. ",
  "FFmpeg 9の用途専用WASMをHTML内へ埋め込んでいます。GIF/WebPのうち、選択した形式のcoreだけを展開して使います。",
  "Purpose-built FFmpeg 9 WASM cores are embedded in this HTML. Only the GIF or WebP core you select is inflated and loaded."
];
for (const file of ["src/index.template.html", "video-to-gif-webp.html"]) {
  test(`${file}: user help omits implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
