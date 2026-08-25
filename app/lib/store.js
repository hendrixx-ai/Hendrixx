// ─────────────────────────────────────────────────────────────────────────────
// store.js — file access layer for the Hendrixx AI Employee repo.
//
// The repo IS the database. This layer reads/writes the markdown files under
// ai-employee/ (and only there — path-traversal is blocked).
// Zero dependencies: Node built-ins only.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');        // repo root
const AI = path.join(ROOT, 'ai-employee');

// Files the console is allowed to read (relative to ai-employee/).
const READABLE = [
  'CLAUDE.md', 'me.md', 'PRODUCTS.md', 'PROSPECTS.md', 'APPROVALS-CHECKLIST.md',
  'research-queue.md', 'test-emails.md', 'voice-samples.md',
  'crm/PIPELINE.md', 'crm/SEQUENCES.md',
  'daily/inbox.md', 'daily/research.md', 'daily/calendar.md', 'daily/tasks.md',
  'daily/approvals.md', 'daily/follow-up.md', 'daily/report.md',
  'daily/morning-digest.md',
  'weekly/weekly-review.md', 'monthly/monthly-review.md',
  'demo/input/emails.md', 'demo/input/meetings.md', 'demo/input/threads.md',
  'demo/input/research-queue.md',
  'demo/output/inbox.md', 'demo/output/research.md', 'demo/output/calendar.md',
  'demo/output/tasks.md', 'demo/output/approvals.md', 'demo/output/follow-up.md',
  'demo/output/report.md', 'demo/output/morning-digest.md',
  'demo/output/team-digest.md', 'demo/output/weekly-review.md',
  'demo/output/monthly-review.md',
];

// Files the console is allowed to write (relative to ai-employee/).
const WRITABLE = new Set([
  'PROSPECTS.md', 'research-queue.md',
  'daily/inbox.md', 'daily/research.md', 'daily/calendar.md', 'daily/tasks.md',
  'daily/approvals.md', 'daily/follow-up.md', 'daily/report.md',
  'daily/morning-digest.md',
  'demo/input/research-queue.md',
  'demo/output/inbox.md', 'demo/output/research.md', 'demo/output/calendar.md',
  'demo/output/tasks.md', 'demo/output/approvals.md', 'demo/output/follow-up.md',
  'demo/output/report.md', 'demo/output/morning-digest.md',
]);

function abs(rel) { return path.join(AI, rel); }

function exists(rel) {
  try { fs.accessSync(abs(rel)); return true; } catch { return false; }
}

function read(rel) {
  if (!READABLE.includes(rel)) throw new Error(`Not readable: ${rel}`);
  try { return fs.readFileSync(abs(rel), 'utf8'); } catch { return null; }
}

function readAny(rel) {                 // internal use (no allowlist check)
  try { return fs.readFileSync(abs(rel), 'utf8'); } catch { return null; }
}

function write(rel, content) {
  if (!WRITABLE.has(rel)) throw new Error(`Not writable: ${rel}`);
  const target = abs(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
  return target;
}

// ── Date helpers (the boss works in EAT — Africa/Dar_es_Salaam) ──────────────
const TZ = 'Africa/Dar_es_Salaam';

function nowEAT() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }));
}

function fmtDate(d = nowEAT()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtStamp(d = nowEAT()) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${days[d.getDay()]} ${fmtDate(d)}, ${hh}:${mm} EAT`;
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr + 'T00:00:00+03:00');
  if (isNaN(then)) return null;
  return Math.max(0, Math.round((nowEAT() - then) / 86400000));
}

// Parse loose dates like "Aug 14" or "2026-08-14" → 'YYYY-MM-DD' (year defaults
// to the current year, rolling back if that'd be in the future).
function parseLooseDate(s) {
  if (!s) return null;
  s = s.trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})/i);
  if (m) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mo = months.indexOf(m[1].toLowerCase().slice(0, 3)) + 1;
    const now = nowEAT();
    let year = now.getFullYear();
    const cand = new Date(Date.UTC(year, mo - 1, Number(m[2])));
    const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    if (cand > todayUTC) year -= 1;                  // "Aug 25" said in Jan → last Aug
    return `${year}-${String(mo).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  }
  return null;
}

module.exports = {
  ROOT, AI, READABLE, WRITABLE,
  exists, read, readAny, write, abs,
  nowEAT, fmtDate, fmtStamp, daysSince, parseLooseDate,
};
