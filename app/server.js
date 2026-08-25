// ─────────────────────────────────────────────────────────────────────────────
// Hendrixx Console — zero-dependency Node server.
//
//   node app/server.js            → http://localhost:3000
//   PORT=8080 node app/server.js  → custom port
//
// Serves the single-page console + a JSON API over the ai-employee/ markdown
// files. The repo is the database; the API is the only writer besides you.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const store = require('./lib/store');
const parse = require('./lib/parse');
const workflow = require('./lib/workflow');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');

// ── helpers ──────────────────────────────────────────────────────────────────
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 2e6) req.destroy(); });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

// ── GET /api/state — everything the dashboard needs, parsed from markdown ────
function getState() {
  const { prospects, sections } = parse.parseProspects();
  const approvals = parse.parseApprovals();
  const queue = parse.parseResearchQueue();
  const report = parse.parseReportGlance();
  const followUps = parse.parseFollowUps();

  const byStage = {};
  for (const s of parse.STAGES) byStage[s.key] = 0;
  for (const p of prospects) if (byStage[p.stage] != null) byStage[p.stage]++;

  const overdueProspects = prospects
    .filter(p => p.overdue)
    .map(p => ({ name: p.name, stage: p.stage, stageLabel: p.stageLabel, ageDays: p.ageDays, timeboxDays: p.timeboxDays, nextStep: p.nextStep }));

  const followUpsDue = followUps.iOwe.length +
    followUps.waitingOnThem.filter(w => /draft/i.test(w.draft)).length;

  return {
    now: store.fmtStamp(),
    stages: parse.STAGES,
    byStage,
    prospects,
    prospectSections: sections,
    approvals,
    queue,
    report,
    followUps,
    followUpsDue,
    overdueProspects,
    files: store.READABLE.reduce((acc, f) => { acc[f] = store.exists(f); return acc; }, {}),
    productsReady: (() => {
      const md = store.read('PRODUCTS.md') || '';
      return !/\[Name\]/.test(md.split('## Mineral 1')[1] || '[Name]');
    })(),
  };
}

// ── POST /api/approvals/decision — the boss's yes (or no) ────────────────────
// Moves an awaiting item into the Approved & Done log. This console never
// sends anything — the log entry records how it was done (you send from Gmail).
function approvalDecision(body) {
  const { index, decision, note } = body;
  const md = store.read('daily/approvals.md');
  if (md == null) return { ok: false, error: 'daily/approvals.md not found' };
  const { awaiting, done } = parse.parseApprovals(md);
  const idx = Number(index);
  if (!(idx >= 0 && idx < awaiting.length)) return { ok: false, error: 'No such approval item' };

  const item = awaiting[idx];
  const date = store.fmtDate();
  const how = decision === 'approve'
    ? (note ? `Approved via Console — ${note}. Next: send from Gmail, then log the sent time.` : 'Approved via Console — send from Gmail, then log the sent time.')
    : `Declined via Console${note ? ` — ${note}` : ''} — draft stays on file, do not send.`;

  const lines = md.split('\n');
  lines[item.lineNo] = null;                       // remove from awaiting
  // Rebuild: keep everything, re-add log row inside the log table
  const out = [];
  let logged = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === null) continue;
    out.push(line);
    if (!logged && /^\|\s*Date\s*\|/.test(line) && /Approved/i.test(lines.slice(Math.max(0, i - 6), i).join('\n'))) {
      // insert after the separator row that follows the header
      if (/^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) { out.push(lines[i + 1]); i++; }
      out.push(`| ${date} | ${item.title}${item.context ? ` (${item.context})` : ''} | ${how} |`);
      logged = true;
    }
  }
  if (!logged) {
    // no log table at all — append one before trailing whitespace
    while (out.length && out[out.length - 1].trim() === '') out.pop();
    out.push('');
    out.push('## ✅ Approved & Done (log)');
    out.push('| Date | Item | How It Was Done |');
    out.push('|------|------|-----------------|');
    out.push(`| ${date} | ${item.title}${item.context ? ` (${item.context})` : ''} | ${how} |`);
  }
  store.write('daily/approvals.md', out.join('\n') + '\n');

  return { ok: true, decision, item: item.title, how };
}

// ── POST /api/prospects — add a prospect block to PROSPECTS.md ───────────────
function addProspect(body) {
  const { name, type, contact, needs, stage, nextStep, source, notes } = body;
  if (!name || !name.trim()) return { ok: false, error: 'Name is required' };
  const md = store.read('PROSPECTS.md');
  if (md == null) return { ok: false, error: 'PROSPECTS.md not found' };
  if (new RegExp(`^### ${escapeRx(name.trim())}$`, 'm').test(md)) {
    return { ok: false, error: 'A prospect with that exact name already exists' };
  }

  const stageLabel = parse.STAGE_LABELS[stage || 'LEAD'];
  const block = [
    `### ${name.trim()}`,
    `- **Type:** ${type || '—'}`,
    `- **Contact:** ${contact || '[Find: name + channel]'}`,
    `- **What they need:** ${needs || '[Confirm: spec / volume / timing]'}`,
    `- **Stage:** ${stageLabel}`,
    `- **Last action:** ${store.fmtDate()} — Added via Console`,
    `- **Next step:** ${nextStep || '✉️ First outreach'}`,
    `- **Source:** ${source || '—'}`,
    `- **Notes:** ${notes || '—'}`,
    '',
  ].join('\n');

  const lines = md.split('\n');
  let insertAt = lines.length;
  const sumIdx = lines.findIndex(l => /^## Pipeline summary/.test(l));
  if (sumIdx !== -1) insertAt = sumIdx;
  else {
    // append before the trailing footer rule/italic lines
    while (insertAt > 0 && !lines[insertAt - 1].trim()) insertAt--;
  }
  lines.splice(insertAt, 0, ...block.split('\n'));
  store.write('PROSPECTS.md', lines.join('\n'));
  rollUpSummary();
  return { ok: true, name: name.trim() };
}

function escapeRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// ── POST /api/prospects/stage — move a prospect, log it, roll up summary ─────
function setProspectStage(body) {
  const { name, stage, note } = body;
  if (!name) return { ok: false, error: 'name required' };
  const { prospects } = parse.parseProspects();
  const p = prospects.find(x => x.name === name);
  if (!p) return { ok: false, error: `Prospect not found: ${name}` };
  const stageDef = parse.STAGES.find(s => s.key === stage);
  if (!stageDef) return { ok: false, error: `Unknown stage: ${stage}` };

  const md = store.read('PROSPECTS.md');
  const lines = md.split('\n');
  lines[p.fieldLines['Stage']] = `- **Stage:** ${parse.STAGE_LABELS[stage]}`;
  if (p.fieldLines['Last action'] != null) {
    lines[p.fieldLines['Last action']] =
      `- **Last action:** ${store.fmtDate()} — Stage moved to ${parse.STAGE_LABELS[stage]} via Console${note ? ` (${note})` : ''}`;
  }
  store.write('PROSPECTS.md', lines.join('\n'));
  rollUpSummary();
  return { ok: true, name, stage };
}

// Regenerate the "Pipeline summary" table at the bottom of PROSPECTS.md.
function rollUpSummary() {
  const md = store.read('PROSPECTS.md');
  if (md == null) return;
  const { prospects } = parse.parseProspects();
  const counts = {};
  for (const s of parse.STAGES) counts[s.key] = 0;
  for (const p of prospects) if (counts[p.stage] != null) counts[p.stage]++;
  const rows = parse.STAGES.filter(s => counts[s.key] > 0 || ['WON', 'LOST'].includes(s.key))
    .map(s => `| ${s.label} | ${counts[s.key]} |`);
  const table = [
    '## Pipeline summary *(auto-rolled-up by the Console — keep this honest)*',
    '',
    '| Stage | Count |',
    '|-------|------:|',
    ...rows,
    '',
    `*(Updated ${store.fmtDate()} — Hendrixx Console roll-up. Rule 2 stands: never invent a company, contact, or deal.)*`,
  ].join('\n');

  const lines = md.split('\n');
  const start = lines.findIndex(l => /^## Pipeline summary/.test(l));
  if (start === -1) {
    lines.push('', '---', '', table);
  } else {
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\*\*?Rule 2|^\*\(Updated/.test(lines[i])) { end = i + 1; break; }
      if (/^---$/.test(lines[i]) && i > start + 2) { end = i; break; }
      end = i + 1;
    }
    lines.splice(start, end - start, ...table.split('\n'));
  }
  store.write('PROSPECTS.md', lines.join('\n'));
}

// ── POST /api/queue — add a research topic to the queue ──────────────────────
function addQueueTopic(body) {
  const { topic, why } = body;
  if (!topic || !topic.trim()) return { ok: false, error: 'topic required' };
  const md = store.read('research-queue.md');
  if (md == null) return { ok: false, error: 'research-queue.md not found' };
  const lines = md.split('\n');
  let at = lines.length;
  // insert at the end of the Pending section (before the next ## or end)
  let inPending = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^## Pending/.test(lines[i])) { inPending = true; continue; }
    if (inPending && /^## /.test(lines[i])) { at = i; inPending = false; break; }
    if (inPending && !lines[i].startsWith('<!--') && !lines[i].startsWith('-->') && lines[i].startsWith('- ')) at = i + 1;
  }
  if (inPending) {
    // trailing blank lines after pending list — find last bullet
    at = lines.length;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith('- ')) { at = i + 1; break; }
      if (/^## /.test(lines[i])) break;
    }
  }
  const entry = `- Research: ${topic.trim()}${why ? ` — why it matters: ${why.trim()}` : ''}`;
  lines.splice(at, 0, entry);
  store.write('research-queue.md', lines.join('\n'));
  return { ok: true, topic: topic.trim() };
}

// ── Router ───────────────────────────────────────────────────────────────────
async function handleApi(req, res, url) {
  const route = url.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && route === '/api/state') {
    return json(res, 200, getState());
  }

  if (req.method === 'GET' && route === '/api/file') {
    const rel = url.searchParams.get('path');
    const content = rel ? store.read(rel) : null;
    if (content == null) return json(res, 404, { error: 'Not found' });
    return json(res, 200, { path: rel, content });
  }

  if (req.method === 'GET' && route === '/api/input') {
    // default inputs for the workflow tab (demo pre-fills)
    return json(res, 200, {
      emails: workflow.defaultInput('demo', 'emails'),
      meetings: workflow.defaultInput('demo', 'meetings'),
      threads: workflow.defaultInput('demo', 'threads'),
    });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);

    if (route === '/api/approvals/decision') return json(res, 200, approvalDecision(body));
    if (route === '/api/prospects') return json(res, 200, addProspect(body));
    if (route === '/api/prospects/stage') return json(res, 200, setProspectStage(body));
    if (route === '/api/queue') return json(res, 200, addQueueTopic(body));

    if (route === '/api/run/step') {
      const { step, mode, inputs } = body;
      if (!['demo', 'live'].includes(mode)) return json(res, 400, { error: 'mode must be demo|live' });
      const result = workflow.runStep(step, mode, inputs || {});
      return json(res, 200, result);
    }

    if (route === '/api/run/routine') {
      const { mode, inputs } = body;
      if (!['demo', 'live'].includes(mode)) return json(res, 400, { error: 'mode must be demo|live' });
      return json(res, 200, workflow.runRoutine(mode, inputs || {}));
    }
  }

  return json(res, 404, { error: `No such API route: ${req.method} ${route}` });
}

// ── Static files ─────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const target = path.normalize(path.join(PUBLIC, p));
  if (!target.startsWith(PUBLIC)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(target, (err, buf) => {
    if (err) {
      // SPA fallback → index.html
      fs.readFile(path.join(PUBLIC, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(idx);
      });
      return;
    }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch(err => {
      console.error('API error:', err);
      try { json(res, 500, { error: err.message }); } catch {}
    });
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🤖 Hendrixx Console running → http://0.0.0.0:${PORT}`);
  console.log(`   Repo data: ${store.AI}`);
});
