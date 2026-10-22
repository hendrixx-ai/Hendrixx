// ─────────────────────────────────────────────────────────────────────────────
// kit.js — pack a run into a .zip you can actually carry.
//
// Zero dependencies: a minimal ZIP writer (deflate via node's zlib, CRC-32 by
// hand). The kit is the deliverable — open it, and every file is a normal .md
// you can paste into Notion, Drive or Stan Store.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const zlib = require('zlib');

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

/**
 * files: [{ name, content: string|Buffer }]
 * → Buffer (a valid .zip, deflate-compressed)
 */
function zip(files, date = new Date()) {
  const { time, day } = dosTime(date);
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf8');
    const data = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf8');
    const deflated = zlib.deflateRawSync(data, { level: 9 });
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0x0800, 6);      // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);        // made by
    central.writeUInt16LE(20, 6);        // needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);        // extra
    central.writeUInt16LE(0, 32);        // comment
    central.writeUInt16LE(0, 34);        // disk
    central.writeUInt16LE(0, 36);        // internal attrs
    central.writeUInt32LE(0, 38);        // external attrs
    central.writeUInt32LE(offset, 42);

    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuf, end]);
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
