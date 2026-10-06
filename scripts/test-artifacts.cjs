// Byte-level artifact checks, not a browser or real encoder test.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {gunzipSync} = require('node:zlib');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');
const os = require('node:os');
const root = path.join(__dirname,'..');
const readablePath = process.argv[2] || path.join(root,'dist/index.html');
const wrapperPath = process.argv[3] || path.join(root,'dist/index.self-extract.html');
const catalogPath = process.argv[4] || path.join(root,'video-to-gif-webp.html');
const readable = fs.readFileSync(readablePath);
const wrapper = fs.readFileSync(wrapperPath,'utf8');
assert.ok(readable.equals(fs.readFileSync(catalogPath)),'catalog artifact must equal readable build');
const payload = /<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\s]+)<\/script>/.exec(wrapper);
assert.ok(payload,'self-extract payload exists');
const restored = gunzipSync(Buffer.from(payload[1].replace(/\s/g,''),'base64'));
assert.ok(readable.equals(restored),'restored payload must match readable build byte-for-byte');
const html = readable.toString('utf8');
const manifest = JSON.parse(/const BUILD_MANIFEST = (.+);/.exec(html)[1]);
assert.equal(manifest.ffmpeg.version,'1.5.0');
for (const profile of manifest.ffmpeg.profiles) {
  const prefix = profile.id==='video-to-gif'?'gif':'webp';
  for (const [kind,hashKey] of [['js','ffmpegJsGzipSha256'],['wasm','ffmpegWasmGzipSha256']]) {
    const match = new RegExp(`<script id="${prefix}-${kind}-gzip" type="application/octet-stream">([^<]+)</script>`).exec(html);
    assert.ok(match,`${prefix} ${kind} asset exists`);
    assert.equal(createHash('sha256').update(Buffer.from(match[1],'base64')).digest('hex'),profile[hashKey]);
  }
}
for (const document of [html,wrapper]) {
  assert.match(document,/connect-src 'none'/);
  for (const script of document.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (!script[1].includes('application/octet-stream')) new vm.Script(script[2]);
  }
}
console.log('[OK] Catalog parity, self-extract bytes, asset hashes, CSP and JavaScript syntax.');
// Run the actual application logic from the restored release as well as source.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(),'video-gif-trim-'));
try {
  const restoredPath = path.join(temporary,'restored.html');fs.writeFileSync(restoredPath,restored);
  const result = spawnSync(process.execPath,[path.join(__dirname,'test-trim.cjs'),restoredPath],{stdio:'inherit'});
  assert.equal(result.status,0,'restored artifact trim regressions pass');
} finally { fs.rmSync(temporary,{recursive:true,force:true}); }
