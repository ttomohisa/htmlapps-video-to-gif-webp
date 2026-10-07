// Execute the emitted HTML's real WASM, runtime argument builder and app loop handling.
// Node/MEMFS only: this does not test a browser, WORKERFS, rendering or downloads.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {gunzipSync} = require('node:zlib');
const {createHash} = require('node:crypto');
const readers = require('./test-support/timing-readers.js');
const root = path.join(__dirname, '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fixtures = Object.fromEntries(['cfr', 'single'].map(name => [name,
  fs.readFileSync(path.join(__dirname, `fixtures/timing-${name}.mp4`))]));
const files = process.argv.slice(2);
if (!files.length) files.push(path.join(root, 'dist/index.html'), path.join(root, 'dist/index.self-extract.html'));

function readHtml(filename) {
  let html = fs.readFileSync(filename, 'utf8');
  const payload = /<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\s]+)<\/script>/.exec(html);
  if (payload) html = gunzipSync(Buffer.from(payload[1].replace(/\s/g, ''), 'base64')).toString('utf8');
  return html;
}
function contextFor(html, format, fps) {
  const fields = {
    'input[name="width"]:checked': {value: 'custom'}, '#customWidth': {value: '64'},
    'input[name="fps"]:checked': {value: 'custom'}, '#customFps': {value: String(fps)},
    '#gifColors': {value: '64'}, '#gifDither': {value: 'sierra2_4a'},
    '#webpQuality': {value: '70'}, '#webpCompression': {value: '4'}, '#webpLossless': {checked: false}
  };
  for (const name of ['Dialog', 'Title', 'Message', 'Close', 'Cancel', 'Ok'])
    fields[`#appConfirm${name}`] = {addEventListener() {}};
  const context = {window: {}, self: {location: {href: 'file:///ffmpeg.js'}}, console,
    document: {querySelector(selector) { assert.ok(selector in fields, `Unexpected test selector ${selector}`); return fields[selector]; }},
    URL, WebAssembly, TextDecoder, TextEncoder, performance, setTimeout, clearTimeout, Uint8Array, ArrayBuffer};
  vm.createContext(context);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter(match => !match[1].includes('application/octet-stream')).map(match => match[2]);
  const runtime = scripts.find(script => script.includes('window.BrowserFFmpeg ='));
  const app = scripts.find(script => script.includes('const APP_CONFIG ='));
  assert.ok(runtime && app, 'Emitted runtime and application scripts exist');
  assert.equal((app.match(/      init\(\);/g) || []).length, 1, 'One application entry point');
  vm.runInContext(runtime, context);
  context.BrowserFFmpeg = context.window.BrowserFFmpeg;
  vm.runInContext(app.replace('      init();',
    '      globalThis.app = {state, profileArgs, applyLoopPreference};'), context);
  context.app.state.format = format;
  const embedded = kind => {
    const match = new RegExp(`<script id="${format}-${kind}-gzip" type="application/octet-stream">([^<]+)</script>`).exec(html);
    assert.ok(match, `Embedded ${format} ${kind} exists`);
    return gunzipSync(Buffer.from(match[1], 'base64'));
  };
  const wasm = embedded('wasm');
  vm.runInContext(embedded('js').toString('utf8'), context);
  return {context, wasm};
}
async function encode(html, format, fps, fixture, range) {
  const {context, wasm} = contextFor(html, format, fps);
  const logs = [];
  const core = await context.createFFmpegCore({wasmBinary: wasm,
    instantiateWasm(imports, success) {
      const module = new WebAssembly.Module(wasm), instance = new WebAssembly.Instance(module, imports);
      success(instance, module); return instance.exports;
    }, print() {}, printErr(value) { logs.push(String(value)); }});
  core.FS.mkdirTree('/workerfs');
  core.FS.writeFile('/workerfs/input.bin', fixtures[fixture]);
  const args = context.app.profileArgs(range);
  assert.equal(args[args.indexOf('--fps') + 1], String(fps), 'Application forwards selected FPS');
  assert.equal(args[args.indexOf('--start') + 1], String(range.start), 'Application forwards selected start');
  assert.equal(args[args.indexOf('--end') + 1], String(range.end), 'Application forwards selected end');
  const recordedArgs = Array.from(args);
  let exitCode;
  try { exitCode = core.callMain(args); }
  catch (error) { if (typeof error.status !== 'number') throw error; exitCode = error.status; }
  assert.equal(exitCode, 0, `Real core exited successfully: ${logs.slice(-4).join(' | ')}`);
  const raw = Uint8Array.from(core.FS.readFile(`/output.${format}`));
  return {raw, applyLoop: loop => context.app.applyLoopPreference(raw, format, loop), args: recordedArgs};
}

async function main() {
  let passed = 0;
  const failures = [];
  const cases = [
    ...[10, 15, 30].map(fps => ({name: `gif-${fps}-fps`, format: 'gif', fps, fixture: 'cfr', start: 0, end: 3})),
    {name: 'gif-trimmed-10-fps', format: 'gif', fps: 10, fixture: 'cfr', start: .5, end: 2.5},
    {name: 'gif-single-frame', format: 'gif', fps: 10, fixture: 'single', start: 0, end: .1},
    {name: 'webp-duration-control', format: 'webp', fps: 10, fixture: 'cfr', start: 0, end: 3}
  ];
  for (const filename of files) {
    const html = readHtml(filename), artifact = path.basename(filename);
    const manifest = JSON.parse(/const BUILD_MANIFEST = (.+);/.exec(html)[1]);
    console.log(`TIMING_ARTIFACT ${artifact} Builder ${manifest.ffmpeg.version} sha256=${sha256(html)}`);
    for (const item of cases) {
      const {name, format, fps, fixture, start, end} = item;
      try {
        const {raw, applyLoop, args} = await encode(html, format, fps, fixture, {start, end});
        const inspect = format === 'gif' ? readers.readGif : readers.readWebp;
        const original = inspect(raw);
        const count = Math.round((end - start) * fps);
        if (format === 'gif') {
          assert.equal(original.width, 64); assert.equal(original.height, 48);
          assert.equal(original.frameCount, count, 'GIF frame count');
          const expected = Array.from({length: count}, (_, i) => i + 1 < count
            ? Math.round((i + 1) * 100 / fps) - Math.round(i * 100 / fps) : Math.round(100 / fps));
          original.delaysCs.forEach((delay, i) => assert.equal(delay, expected[i], `GIF frame ${i} delay (centiseconds)`));
          assert.equal(original.totalDurationCs, expected.reduce((sum, value) => sum + value, 0), 'GIF encoded duration');
        } else {
          assert.ok(original.frameCount > 1 && original.frameCount <= count, 'WebP frame count allows adjacent-frame coalescing');
          assert.ok(original.durationsMs.every(value => value > 0 && value % 100 === 0), 'WebP cadence');
          assert.equal(original.totalDurationMs, 3000, 'WebP encoded endpoint');
        }
        assert.equal(original.loopCount, 0, 'Core looping remains enabled');
        for (const loop of [true, false]) {
          const output = applyLoop(loop), timing = inspect(output);
          assert.equal(timing.loopCount, loop ? 0 : format === 'gif' ? null : 1, 'App loop preference');
          assert.deepEqual({...timing, loopCount: 0}, original, 'Loop handling preserves frames and timing');
          const receipt = {artifact, name, loop, args, bytes: output.length, sha256: sha256(output), timing};
          console.log(`TIMING_PASS ${JSON.stringify(receipt)}`);
          if (process.env.TIMING_OUTPUT_DIR) {
            fs.mkdirSync(process.env.TIMING_OUTPUT_DIR, {recursive: true});
            fs.writeFileSync(path.join(process.env.TIMING_OUTPUT_DIR, `${artifact}-${name}-loop-${loop}.${format}`), output);
          }
          passed++;
        }
      } catch (error) {
        failures.push(`${artifact} ${name}: ${error.message}`);
        console.error(`TIMING_FAIL ${failures.at(-1)}`);
      }
    }
  }
  console.log(`TIMING_SUMMARY ${passed} loop cases passed; ${failures.length} encoding cases failed`);
  assert.equal(failures.length, 0, failures.join('\n'));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
