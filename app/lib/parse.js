// ─────────────────────────────────────────────────────────────────────────────
// parse.js — markdown parsers for the Hendrixx AI Employee files.
//
// The repo's data lives in structured markdown. These parsers turn it into
// JSON for the console, keeping line numbers so edits can be written back
// surgically (never rewrite a whole file just to change one line).
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const store = require('./store');

// ── Pipeline stages (mirrors crm/PIPELINE.md) ────────────────────────────────
const STAGES = [
  { key: 'LEAD',      label: '🔍 Lead',       emoji: '🔍', name: 'Lead',       maxDays: 30 },
  { key: 'CONTACTED', label: '✉️ Contacted',  emoji: '✉️', name: 'Contacted',  maxDays: 14 },
  { key: 'ENGAGED',   label: '💬 Engaged',    emoji: '💬', name: 'Engaged',    maxDays: 30 },
  { key: 'MEETING',   label: '🤝 Meeting',    emoji: '🤝', name: 'Meeting',    maxDays: 7 },
  { key: 'QUOTING',   label: '📄 Quoting',    emoji: '📄', name: 'Quoting',    maxDays: 21 },
  { key: 'WON',       label: '✅ Won',        emoji: '✅', name: 'Won',        maxDays: null },
  { key: 'LOST',      label: '❌ Lost',       emoji: '❌', name: 'Lost',       maxDays: null },
];

// Map the free-text "Stage:" value found in PROSPECTS.md → canonical stage key.
function stageKey(value) {
  const v = (value || '').toLowerCase();
  if (/(lost|archived)/.test(v)) return 'LOST';
  if (/(closed|won|signed)/.test(v)) return 'WON';
  if (/(quot|negotiat)/.test(v)) return 'QUOTING';
  if (/(meeting|demo)/.test(v)) return 'MEETING';
  if (/(engaged|two-way|conversation)/.test(v)) return 'ENGAGED';
  if (/(contacted|outreach sent)/.test(v)) return 'CONTACTED';
  return 'LEAD';                                     // researched / lead / new / blank
}

const STAGE_LABELS = {
  LEAD: '🔍 Researched', CONTACTED: '✉️ Contacted', ENGAGED: '💬 Engaged',
  MEETING: '🤝 Meeting', QUOTING: '📄 Negotiating', WON: '✅ Closed', LOST: '❌ Lost',
};

// ── PROSPECTS.md ─────────────────────────────────────────────────────────────
// Parses every "### Name" block (skipping [placeholder] blocks), tracks the
// line number of each "- **Field:**" line so stage moves rewrite in place.
function parseProspects(md) {
  md = md != null ? md : store.read('PROSPECTS.md');
  if (md == null) return { prospects: [], sections: [] };

  const lines = md.split('\n');
  const prospects = [];
  const sections = [];
  let section = 'Active prospects';
  let cur = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = line.match(/^## (.+)$/);
    if (h2) {
      if (cur) { prospects.push(cur); cur = null; }
      const title = h2[1].replace(/\s*\(.*\)$/, '').trim();
      if (/pipeline summary/i.test(title)) break;     // everything after = roll-up
      section = title;
      if (!sections.includes(section)) sections.push(section);
      continue;
    }
    const h3 = line.match(/^### (.+)$/);
    if (h3) {
      if (cur) prospects.push(cur);
      const name = h3[1].trim();
      cur = name.startsWith('[') ? null : {           // skip [placeholder] blocks
        name, section, lineNo: i, fields: {}, fieldLines: {},
      };
      continue;
    }
    if (cur) {
      const f = line.match(/^- \*\*(.+?):\*\*\s+(.*)$/);
      if (f) { cur.fields[f[1].trim()] = f[2].trim(); cur.fieldLines[f[1].trim()] = i; }
    }
  }
  if (cur) prospects.push(cur);

  for (const p of prospects) {
    p.stage = stageKey(p.fields['Stage']);
    p.stageLabel = p.fields['Stage'] || STAGE_LABELS[p.stage];
    p.type = p.fields['Type'] || '';
    p.contact = p.fields['Contact'] || '';
    p.needs = p.fields['What they need'] || '';
    p.lastAction = p.fields['Last action'] || '';
    p.nextStep = p.fields['Next step'] || '';
    p.source = p.fields['Source'] || '';
    p.notes = p.fields['Notes'] || '';
    const dm = p.lastAction.match(/(\d{4}-\d{2}-\d{2})/);
    p.lastActionDate = dm ? dm[1] : null;
    p.ageDays = store.daysSince(p.lastActionDate);
    const stage = STAGES.find(s => s.key === p.stage);
    p.timeboxDays = stage ? stage.maxDays : null;
    p.overdue = !!(p.timeboxDays && p.ageDays != null && p.ageDays > p.timeboxDays);
  }
  return { prospects, sections };
}

// ── daily/approvals.md ───────────────────────────────────────────────────────
function parseApprovals(md) {
  md = md != null ? md : store.read('daily/approvals.md');
  const awaiting = [];
  const done = [];
  if (md == null) return { awaiting, done };

  const lines = md.split('\n');
  let inLog = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^## .*Approved/i.test(line)) { inLog = true; continue; }
    if (inLog) {
      const cells = line.match(/^\|\s*(\d{4}-\d{2}-\d{2}|\d{1,2} \w+ \d{4})\s*\|(.+)\|\s*$/);
      if (cells) {
        done.push({ date: cells[1].trim(), rest: cells[2].split('|').map(c => c.trim()) });
      }
      continue;
    }
    const m = line.match(/^- \[ \] \*\*(.+?)\*\*\s*(.*)$/);
    if (m) {
      let context = '', detail = m[2].trim().replace(/^[—-]+\s*/, '');
      const pm = detail.match(/^\((.+?)\)\s*(.*)$/);
      if (pm) { context = pm[1].trim(); detail = pm[2].trim(); }
      const rm = detail.match(/^(.*?)\s*[—-]{1,2}\s*(.+)$/);
      let status = rm ? rm[1].trim() : detail;
      let note = rm ? rm[2].trim() : '';
      // If the em-dash split cut through a parenthetical (unbalanced "(" in
      // status), keep the whole detail instead of leaking a stray ")".
      const opens = (status.match(/\(/g) || []).length - (status.match(/\)/g) || []).length;
      if (opens > 0) { status = detail; note = ''; }
      awaiting.push({ lineNo: i, title: m[1].trim(), context, detail, status, note });
    }
  }
  return { awaiting, done };
}

// ── research-queue.md ────────────────────────────────────────────────────────
function parseResearchQueue(md) {
  md = md != null ? md : store.read('research-queue.md');
  const pending = [];
  const done = [];
  if (md == null) return { pending, done };

  const lines = md.split('\n');
  let section = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h = line.match(/^## (.+)$/);
    if (h) { section = h[1].toLowerCase(); continue; }
    if (section && /pending/.test(section)) {
      if (line.startsWith('<!--') || line.startsWith('-->')) continue;
      const m = line.match(/^-\s+(?:Research:\s*)?(.+)$/);
      if (m && !m[1].startsWith('[')) {
        const tm = m[1].match(/^(.+?)\s*[—-]{1,2}\s*(?:why it matters:?\s*)?(.*)$/i);
        pending.push({
          lineNo: i, raw: line,
          topic: (tm ? tm[1] : m[1]).trim(),
          why: (tm ? tm[2] : '').trim(),
        });
      }
    } else if (section && /done/.test(section)) {
      const cells = line.match(/^\|\s*(\d{4}-\d{2}-\d{2})\s*\|([^|]+)\|([^|]*)\|/);
      if (cells) done.push({ date: cells[1], topic: cells[2].trim(), where: cells[3].trim() });
    }
  }
  return { pending, done };
}

// ── daily/report.md — headline metrics from the At a Glance table ────────────
function parseReportGlance(md) {
  md = md != null ? md : store.read('daily/report.md');
  if (md == null) return null;
  const dateM = md.match(/\*\*?Date:?\*?\*?\s*([^·\n]+)/);
  const row = md.split('\n').find(l => /^\|\s*\d/.test(l));
  return {
    date: dateM ? dateM[1].trim() : '',
    row: row ? row.split('|').map(c => c.trim()).filter(Boolean) : [],
  };
}

// ── daily/follow-up.md — count real rows in the two tables ───────────────────
function parseFollowUps(md) {
  md = md != null ? md : store.read('daily/follow-up.md');
  if (md == null) return { waitingOnThem: [], iOwe: [] };
  const waitingOnThem = [];
  const iOwe = [];
  let table = null;
  for (const line of md.split('\n')) {
    if (/## .*Waiting to Hear/i.test(line)) { table = 'them'; continue; }
    if (/## .*I Owe/i.test(line)) { table = 'me'; continue; }
    if (/^## /.test(line)) { table = null; continue; }
    if (!table) continue;
    const m = line.match(/^\|\s*(?!\s*—\s*\|)([^|]+)\|([^|]*)\|([^|]*)\|([^|]*)\|/);
    if (m && !/^[-\s:]*$/.test(m[1]) && !/Person/.test(m[1])) {
      const rec = {
        person: m[1].trim(), lastContact: m[2].trim(),
        days: m[3].trim(), draft: m[4].trim(),
      };
      (table === 'them' ? waitingOnThem : iOwe).push(rec);
    }
  }
  return { waitingOnThem, iOwe };
}

// ── Generic markdown table → array of row arrays ─────────────────────────────
// Starts collecting at the heading matching headingRx and stops at the NEXT
// heading of any level. Skips the header row + separator of each table.
function parseTable(md, headingRx) {
  const lines = md ? md.split('\n') : [];
  const rows = [];
  let active = false;
  const isSep = l => /^\|[\s:|-]+\|?\s*$/.test(l);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headingRx && headingRx.test(line)) { active = true; continue; }
    if (active && /^#{1,4}\s/.test(line)) break;
    if (active && line.startsWith('|')) {
      if (isSep(line)) continue;                       // separator row
      if (i + 1 < lines.length && isSep(lines[i + 1])) continue;  // header row
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length) rows.push(cells);
    }
  }
  return rows;
}

module.exports = {
  STAGES, STAGE_LABELS, stageKey,
  parseProspects, parseApprovals, parseResearchQueue,
  parseReportGlance, parseFollowUps, parseTable,
};
