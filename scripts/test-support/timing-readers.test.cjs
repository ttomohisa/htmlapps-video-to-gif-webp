// Adapted GIF/WebP subset of Builder v1.10.1 tests. MIT; see LICENSE.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const readerPath = path.join(__dirname, 'timing-readers.js');
const readers = fs.existsSync(readerPath) ? require(readerPath) : {};
const gifHeader = Buffer.from('47494638396101000100800000000000ffffff', 'hex');
const gce = delay => Buffer.from([0x21, 0xf9, 4, 0, delay & 255, delay >> 8, 0, 0]);
const gifImage = Buffer.from('2c0000000001000100000202440100', 'hex');
const gifLoop = Buffer.from('21ff0b4e45545343415045322e300301000000', 'hex');
const gif = (delays, loop = true) => Buffer.concat([gifHeader, ...(loop ? [gifLoop] : []), ...delays.flatMap(delay => [gce(delay), gifImage]), Buffer.from([0x3b])]);
const le32 = value => { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; };
const chunk = (kind, body) => Buffer.concat([Buffer.from(kind), le32(body.length), body, ...(body.length % 2 ? [Buffer.from([0])] : [])]);
const riff = (...chunks) => { const body = Buffer.concat([Buffer.from('WEBP'), ...chunks]); return Buffer.concat([Buffer.from('RIFF'), le32(body.length), body]); };
const anmf = delay => { const b = Buffer.alloc(16); b.writeUIntLE(delay, 12, 3); return chunk('ANMF', Buffer.concat([b, chunk('VP8 ', Buffer.from([1, 2, 3]))])); };
const webp = delays => riff(chunk('VP8X', Buffer.from([2, 0, 0, 0, 0, 0, 0, 0, 0, 0])), chunk('ANIM', Buffer.alloc(6)), ...delays.map(anmf));

test('GIF follows structural blocks and associates each GCE with its image', () => {
  assert.equal(typeof readers.readGif, 'function');
  assert.deepEqual(readers.readGif(gif([10, 10, 1])), {width: 1, height: 1, frameCount: 3, delaysCs: [10, 10, 1], totalDurationCs: 21, loopCount: 0});
  assert.equal(readers.readGif(gif([7], false)).loopCount, null);
  const noGce = Buffer.concat([gifHeader, gifImage, Buffer.from([0x3b])]);
  assert.deepEqual(readers.readGif(noGce).delaysCs, [0]);
});

test('GIF skips local palettes and opaque compressed-data bytes', () => {
  const image = Buffer.from(gifImage); image[9] = 0x80;
  const palette = Buffer.from([0x21, 0xf9, 4, 10, 0, 0]);
  const withPalette = Buffer.concat([image.subarray(0, 10), palette, image.subarray(10)]);
  const output = Buffer.concat([gifHeader, gce(13), withPalette, Buffer.from([0x3b])]);
  assert.deepEqual(readers.readGif(output).delaysCs, [13]);
});

test('GIF rejects missing trailer, truncated subblocks, malformed GCEs and unpaired controls', () => {
  const input = gif([10]);
  for (const n of [0, 6, 12, input.length - 1, input.length - 3]) assert.throws(() => readers.readGif(input.subarray(0, n)), /GIF/);
  assert.throws(() => readers.readGif(Buffer.concat([input, Buffer.from([0])])), /GIF/);
  assert.throws(() => readers.readGif(Buffer.concat([gifHeader, gce(1), Buffer.from([0x3b])])), /GIF/);
  const bad = Buffer.from(gif([10], false)); bad[21] = 3;
  assert.throws(() => readers.readGif(bad), /GIF/);
});

test('WebP reads little-endian ANMF durations, including odd padded chunks', () => {
  assert.equal(typeof readers.readWebp, 'function');
  assert.deepEqual(readers.readWebp(webp([100, 100, 100])), {frameCount: 3, durationsMs: [100, 100, 100], totalDurationMs: 300, loopCount: 0});
  const staticImage = riff(chunk('VP8 ', Buffer.from([1, 2, 3])));
  assert.deepEqual(readers.readWebp(staticImage), {frameCount: 1, durationsMs: [], totalDurationMs: null, loopCount: null});
});

test('WebP rejects truncation, invalid chunk size, missing ANIM and incomplete frames', () => {
  const input = webp([100]);
  for (const n of [0, 11, input.length - 1, input.length - 3]) assert.throws(() => readers.readWebp(input.subarray(0, n)), /WebP/);
  assert.throws(() => readers.readWebp(Buffer.concat([input, Buffer.from([0])])), /WebP/);
  assert.throws(() => readers.readWebp(riff(anmf(100))), /WebP/);
  assert.throws(() => readers.readWebp(riff(chunk('ANIM', Buffer.alloc(6)), chunk('ANMF', Buffer.alloc(15)))), /WebP/);
  const bad = Buffer.from(input); bad.writeUInt32LE(0xffffffff, 16);
  assert.throws(() => readers.readWebp(bad), /WebP/);
});

test('readers expose the same browser global API without Node dependencies', () => {
  assert.ok(fs.existsSync(readerPath), 'Reader implementation must exist');
  const context = {Uint8Array, ArrayBuffer, DataView};
  vm.createContext(context); vm.runInContext(fs.readFileSync(readerPath, 'utf8'), context);
  assert.equal(context.TimingReaders.readGif(gif([10])).totalDurationCs, 10);
  assert.equal(context.TimingReaders.readWebp(webp([100])).totalDurationMs, 100);
});

test('all structural readers reject every truncated prefix of their synthetic fixture', () => {
  for (const [read, input, prefix] of [[readers.readGif, gif([7, 6, 7]), /GIF/], [readers.readWebp, webp([33, 34, 33]), /WebP/]]) {
    for (let size = 0; size < input.length; size++) assert.throws(() => read(input.subarray(0, size)), prefix, 'prefix length ' + size);
  }
});

test('byte-array views honor offsets and ArrayBuffer inputs work', () => {
  for (const [read, input, key] of [[readers.readGif, gif([10]), 'totalDurationCs'], [readers.readWebp, webp([100]), 'totalDurationMs']]) {
    const padded = Buffer.concat([Buffer.alloc(17), input, Buffer.alloc(13)]);
    assert.equal(read(padded.subarray(17, -13))[key], read(input)[key]);
    assert.equal(read(Uint8Array.from(input).buffer)[key], read(input)[key]);
  }
});

test('GIF plain-text graphics consume the preceding GCE without leaking delay to next image', () => {
  const text = Buffer.concat([Buffer.from([0x21, 0x01, 12]), Buffer.alloc(12), Buffer.from([0])]);
  const output = Buffer.concat([gifHeader, gce(10), text, gifImage, Buffer.from([0x3b])]);
  assert.deepEqual(readers.readGif(output).delaysCs, [0]);
});

test('WebP rejects a chunk that overlaps its parent ANMF boundary', () => {
  const body = Buffer.concat([Buffer.alloc(16), Buffer.from('VP8 '), le32(20), Buffer.from([1, 2])]);
  assert.throws(() => readers.readWebp(riff(chunk('ANIM', Buffer.alloc(6)), chunk('ANMF', body))), /WebP/);
});
