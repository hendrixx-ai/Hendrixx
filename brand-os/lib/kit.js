// ─────────────────────────────────────────────────────────────────────────────
// kit.js — pack a run into a .zip you can actually carry.
//
// Zero dependencies: a minimal ZIP writer (deflate via node's zlib, CRC-32 by
// hand). The kit is the deliverable — open it, and every file is a normal .md
// you can paste into Notion, Drive or Stan Store.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

// zlib exists in Node; in the browser bundle there is no compressor, so the
// writer falls back to STORE (method 0) — still a valid zip, just bigger.
let zlib = null;
try { zlib = require('zlib'); } catch { zlib = null; }

// ── CRC-32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

// ── zip ─────────────────────────────────────────────────────────────────────
function dosTime(date = new Date()) {
  const time = ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const day = (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0x0f) << 5) | (date.getDate() & 0x1f);
  return { time, day };
}

// ── bytes (works in Node and the browser — no Buffer dependency) ────────────
// TextEncoder is standard in browsers and Node 11+. Some sandboxes (and older
// jsdom) lack it, so keep a correct UTF-8 fallback rather than assume.
const TE = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
function utf8(str) {
  if (TE) return TE.encode(str);
  const out = [];
  for (const ch of String(str)) {
    let cp = ch.codePointAt(0);
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f));
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
  }
  return Uint8Array.from(out);
}
const toBytes = v => (typeof v === 'string' ? utf8(v) : new Uint8Array(v));

function u16(n) { const b = new Uint8Array(2); b[0] = n & 0xff; b[1] = (n >>> 8) & 0xff; return b; }
function u32(n) {
  const b = new Uint8Array(4);
  b[0] = n & 0xff; b[1] = (n >>> 8) & 0xff; b[2] = (n >>> 16) & 0xff; b[3] = (n >>> 24) & 0xff;
  return b;
}
function concat(chunks) {
  const total = chunks.reduce((t, c) => t + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

/**
 * files: [{ name, content: string|Uint8Array }]
 * → Uint8Array (a valid .zip; deflate in Node, STORE in the browser)
 */
function zip(files, date = new Date()) {
  const { time, day } = dosTime(date);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = utf8(file.name);
    const data = toBytes(file.content);
    const deflated = zlib ? zlib.deflateRawSync(Buffer.from(data), { level: 9 }) : null;
    const useDeflate = Boolean(deflated) && deflated.length < data.length;
    const body = useDeflate ? new Uint8Array(deflated) : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);

    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(method), u16(time), u16(day),
      u32(crc), u32(body.length), u32(data.length), u16(nameBuf.length), u16(0),
    ]);

    locals.push(local, nameBuf, body);

    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(method), u16(time), u16(day),
      u32(crc), u32(body.length), u32(data.length), u16(nameBuf.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset),
    ]);

    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = concat(centrals);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralBuf.length), u32(offset), u16(0),
  ]);

  return concat([...locals, centralBuf, end]);
}

// ── the kit itself ──────────────────────────────────────────────────────────
function readme({ run, settings, today }) {
  const lines = [
    '# Buyable Brand — launch kit',
    '',
    `Generated ${today} from the ${run.flowName} flow.`,
    '',
    'Everything here is yours: markdown files, no lock-in, no login. Paste into Notion, Drive, Stan Store or a Notes app.',
    '',
    '## What is inside',
    '',
    ...run.files.map(f => `- \`${f.name}\` — ${f.title} _(from ${f.agentName})_`),
    '',
    '## How to use it',
    '',
    '1. Read `offer.md` first. If the offer sentence is wrong, nothing else matters.',
    '2. Put the 30 pieces in your content plan — one per day, same time.',
    '3. Run the launch with the DM shift at 18:30 every day.',
    '4. Log the five funnel numbers nightly so `memo.md` has something true to read next run.',
    '',
    '## The rules that travel with this kit',
    '',
    '- Nothing here sends, posts or charges. You do the external action.',
    '- Bracketed placeholders are yours: real numbers, real screenshots, real permission. Never invent proof.',
    '- The guarantee is installation — a named offer and a live checkout link — never income.',
    '',
    settings && settings.handle ? `**Account:** ${settings.handle}` : '',
    '',
  ];
  return lines.filter(l => l !== null).join('\n');
}

module.exports = { zip, crc32, readme };
