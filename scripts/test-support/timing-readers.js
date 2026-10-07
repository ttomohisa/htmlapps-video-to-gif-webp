/* GIF/WebP structural timing readers adapted from Builder v1.10.1.
 * Copyright (c) 2026 Tomohisa Takagi. MIT; see LICENSE.
 * No decoder guesses: actual encoded frame delays remain visible.
 */
(function (root) {
  'use strict';

  function reader(input, format) {
    const fail = message => { throw new Error(format + ': ' + message); };
    let bytes;
    if (ArrayBuffer.isView(input) && input.BYTES_PER_ELEMENT === 1)
      bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    else if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
    else fail('expected a byte array or ArrayBuffer');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const need = (offset, size, end = bytes.length) => {
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(size) || offset < 0 || size < 0 || offset + size > end)
        fail('truncated or invalid structure at byte ' + offset);
    };
    const safe = value => {
      if (!Number.isSafeInteger(value)) fail('timing value exceeds safe integer range');
      return value;
    };
    const u8 = offset => { need(offset, 1); return view.getUint8(offset); };
    const u16 = (offset, little = false) => { need(offset, 2); return view.getUint16(offset, little); };
    const u32 = (offset, little = false) => { need(offset, 4); return view.getUint32(offset, little); };
    const ascii = (offset, count) => {
      need(offset, count);
      let text = '';
      for (let i = 0; i < count; i++) text += String.fromCharCode(bytes[offset + i]);
      return text;
    };
    return {bytes, fail, need, safe, u8, u16, u32, ascii};
  }

  function readGif(input) {
    const r = reader(input, 'GIF');
    r.need(0, 13);
    if (!['GIF87a', 'GIF89a'].includes(r.ascii(0, 6))) r.fail('invalid signature');
    const width = r.u16(6, true), height = r.u16(8, true);
    if (!width || !height) r.fail('invalid canvas dimensions');
    let offset = 13, pendingDelay = null, loopCount = null, trailer = false;
    const delaysCs = [];
    const take = size => { r.need(offset, size); const start = offset; offset += size; return start; };
    const subblocks = () => {
      const blocks = [];
      for (;;) {
        const size = r.u8(take(1));
        if (!size) return blocks;
        blocks.push({start: take(size), size});
      }
    };
    if (r.u8(10) & 0x80) take(3 * (1 << ((r.u8(10) & 7) + 1)));
    while (offset < r.bytes.length) {
      const kind = r.u8(take(1));
      if (kind === 0x3b) { trailer = true; break; }
      if (kind === 0x21) {
        const label = r.u8(take(1));
        const blocks = subblocks();
        if (label === 0xf9) {
          if (blocks.length !== 1 || blocks[0].size !== 4 || pendingDelay !== null) r.fail('malformed or unpaired GCE');
          pendingDelay = r.u16(blocks[0].start + 1, true);
        } else if (label === 0xff) {
          if (!blocks.length || blocks[0].size !== 11) r.fail('invalid application extension');
          if (['NETSCAPE2.0', 'ANIMEXTS1.0'].includes(r.ascii(blocks[0].start, 11))) {
            if (blocks.length !== 2 || blocks[1].size !== 3 || r.u8(blocks[1].start) !== 1 || loopCount !== null)
              r.fail('invalid or duplicate loop extension');
            loopCount = r.u16(blocks[1].start + 1, true);
          }
        } else if (label === 0x01) {
          if (!blocks.length || blocks[0].size !== 12) r.fail('invalid plain-text extension');
          pendingDelay = null; // A GCE also applies to a following text graphic.
        }
      } else if (kind === 0x2c) {
        const descriptor = take(9);
        if (!r.u16(descriptor + 4, true) || !r.u16(descriptor + 6, true)) r.fail('invalid image dimensions');
        const packed = r.u8(descriptor + 8);
        if (packed & 0x80) take(3 * (1 << ((packed & 7) + 1)));
        const codeSize = r.u8(take(1));
        if (codeSize < 2 || codeSize > 8) r.fail('invalid LZW code size');
        if (!subblocks().length) r.fail('empty image data');
        delaysCs.push(pendingDelay === null ? 0 : pendingDelay);
        pendingDelay = null;
      } else r.fail('unexpected block ' + kind);
    }
    if (!trailer || offset !== r.bytes.length || !delaysCs.length || pendingDelay !== null)
      r.fail('missing trailer, trailing data, or unpaired image control');
    const totalDurationCs = delaysCs.reduce((sum, delay) => r.safe(sum + delay), 0);
    return {width, height, frameCount: delaysCs.length, delaysCs, totalDurationCs, loopCount};
  }

  function readWebp(input) {
    const r = reader(input, 'WebP');
    r.need(0, 12);
    if (r.ascii(0, 4) !== 'RIFF' || r.ascii(8, 4) !== 'WEBP' || r.u32(4, true) + 8 !== r.bytes.length)
      r.fail('invalid RIFF signature or size');
    function chunks(start, end) {
      const result = [];
      while (start < end) {
        r.need(start, 8, end);
        const size = r.u32(start + 4, true), paddedSize = size + (size & 1);
        r.need(start + 8, paddedSize, end);
        if ((size & 1) && r.u8(start + 8 + size) !== 0) r.fail('invalid RIFF padding');
        result.push({type: r.ascii(start, 4), start: start + 8, end: start + 8 + size, size});
        start += 8 + paddedSize;
      }
      return result;
    }
    let loopCount = null, animated = false, staticFrames = 0;
    const durationsMs = [];
    for (const chunk of chunks(12, r.bytes.length)) {
      if (chunk.type === 'ANIM') {
        if (chunk.size !== 6 || animated) r.fail('invalid or duplicate ANIM chunk');
        animated = true; loopCount = r.u16(chunk.start + 4, true);
      } else if (chunk.type === 'ANMF') {
        if (!animated || chunk.size < 16) r.fail('ANMF lacks ANIM or frame header');
        const payload = chunks(chunk.start + 16, chunk.end);
        if (payload.filter(item => item.type === 'VP8 ' || item.type === 'VP8L').length !== 1)
          r.fail('ANMF must contain one image bitstream');
        const offset = chunk.start + 12;
        durationsMs.push(r.u8(offset) + r.u8(offset + 1) * 256 + r.u8(offset + 2) * 65536);
      } else if (chunk.type === 'VP8 ' || chunk.type === 'VP8L') {
        staticFrames++;
      } else if (chunk.type === 'VP8X' && chunk.size !== 10) r.fail('invalid VP8X chunk');
    }
    if (animated ? (!durationsMs.length || staticFrames) : staticFrames !== 1) r.fail('missing or conflicting image frames');
    return {frameCount: animated ? durationsMs.length : 1, durationsMs,
      totalDurationMs: animated ? durationsMs.reduce((sum, delay) => r.safe(sum + delay), 0) : null, loopCount};
  }

  const api = {readGif, readWebp};
  root.TimingReaders = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(globalThis);
