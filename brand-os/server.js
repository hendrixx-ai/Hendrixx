// ─────────────────────────────────────────────────────────────────────────────
// Buyable Brand OS — zero-dependency Node server.
//
//   node brand-os/server.js          → http://localhost:3200
//   PORT=8080 node brand-os/server.js
//
// Serves the console + a JSON API over brand-os/data/state.json.
// Nothing here posts, sends, or spends. Every write is to your own state file.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const engine = require('./lib/engine');
const store = require('./lib/store');
const agents = require('./lib/agents');
const orchestrator = require('./lib/orchestrator');
const jobs = require('./lib/jobs');
const kit = require('./lib/kit');
const actions = require('./lib/actions');

const PORT = Number(process.env.PORT || 3200);
const PUBLIC = path.join(__dirname, 'public');

// ── helpers ─────────────────────────────────────────────────────────────────
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => {
      data += c;
      if (data.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

const str = (v, max = 400) => String(v == null ? '' : v).trim().slice(0, max);
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const isoDate = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const slug = v => str(v, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `offer-${Date.now()}`;

function view(res, state) {
  const today = engine.todayStr();
  return json(res, 200, { ok: true, state: engine.compute(state, today) });
}

function fail(res, message, code = 400) {
  return json(res, code, { ok: false, error: message });
}

// ── agents, flows, runs ─────────────────────────────────────────────────────
function runAndPersist(run) {
  const meta = jobs.saveRun(run);
  return meta;
}

function buildKit(runId, today) {
  const run = jobs.getRun(runId);
  if (!run) throw new Error('Unknown run');
  const files = jobs.artifactFiles(runId);
  const state = store.load(today);
  const payload = [
    { name: 'README.md', content: kit.readme({ run, settings: state.settings, today }) },
    ...files.map(f => ({ name: `${String(f.name).replace(/\.md$/, '')}.md`, content: f.content })),
  ];
  return { buffer: kit.zip(payload), name: `buyable-kit-${run.flowId}-${today}.zip` };
}

// ── router ──────────────────────────────────────────────────────────────────
async function handleApi(req, res, url) {
  const route = url.pathname.replace(/\/+$/, '') || '/';
  const today = engine.todayStr();

  if (req.method === 'GET' && (route === '/api/state' || route === '/api')) {
    return view(res, store.load(today));
  }

  if (req.method === 'GET' && route === '/api/export') {
    const state = store.load(today);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="buyable-brand-state-${today}.json"`,
      'Cache-Control': 'no-store',
    });
    return res.end(JSON.stringify(state, null, 2));
  }

  if (req.method === 'GET' && route === '/api/agents') {
    return json(res, 200, { ok: true, agents: agents.listAgents(), flows: orchestrator.listFlows() });
  }

  if (req.method === 'GET' && route === '/api/runs') {
    return json(res, 200, { ok: true, runs: jobs.listRuns() });
  }

  const runMatch = route.match(/^\/api\/runs\/([\w-]+)$/);
  if (req.method === 'GET' && runMatch) {
    const run = jobs.getRun(runMatch[1]);
    if (!run) return fail(res, 'Unknown run', 404);
    return json(res, 200, { ok: true, run });
  }

  if (req.method === 'GET' && /^\/api\/runs\/[\w-]+\/file$/.test(route)) {
    const runId = route.split('/')[3];
    const name = url.searchParams.get('name') || '';
    try {
      const content = jobs.readArtifact(runId, name);
      return json(res, 200, { ok: true, name, content });
    } catch (err) {
      return fail(res, err.message, 404);
    }
  }

  const kitMatch = route.match(/^\/api\/kit\/([\w-]+)\.zip$/);
  if (req.method === 'GET' && kitMatch) {
    try {
      const built = buildKit(kitMatch[1], today);
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${built.name}"`,
        'Content-Length': built.buffer.length,
        'Cache-Control': 'no-store',
      });
      return res.end(built.buffer);
    } catch (err) {
      return fail(res, err.message, 404);
    }
  }

  if (req.method === 'GET' && route === '/api/health') {
    return json(res, 200, { ok: true, today, dataFile: store.STATE_FILE });
  }

  if (req.method === 'POST') {
    let body;
    try { body = await readBody(req); } catch (err) { return fail(res, err.message); }

    const agentMatch = route.match(/^\/api\/agents\/([\w-]+)\/run$/);
    if (agentMatch) {
      const agent = agents.BY_ID[agentMatch[1]];
      if (!agent) return fail(res, `Unknown agent: ${agentMatch[1]}`, 404);
      const state = store.load(today);
      let result;
      try {
        result = agent.run(state, today, body.input || {}, { artifacts: {}, shared: {} });
      } catch (err) {
        return fail(res, `${agent.name} failed: ${err.message}`, 500);
      }
      const run = {
        id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        flowId: `agent:${agent.id}`,
        flowName: agent.name,
        status: result.status,
        startedAt: new Date().toISOString(),
        today,
        input: body.input || {},
        steps: [{
          agentId: agent.id, agentName: agent.name, status: result.status, ms: 0,
          summary: result.summary, detail: result.steps || [],
          blockers: result.blockers || [], artifacts: (result.artifacts || []).map(a => a.name),
        }],
        artifacts: (result.artifacts || []).map(a => ({ ...a, agentId: agent.id, agentName: agent.name })),
        blockers: result.blockers || [],
        notes: result.notes || [],
        adopt: result.adopt || { offers: [], content: [] },
        summary: result.summary,
        durationMs: 0,
      };
      const meta = runAndPersist(run);
      return json(res, 200, { ok: true, run: meta, state: engine.compute(store.load(today), today) });
    }

    const flowMatch = route.match(/^\/api\/flows\/([\w-]+)\/run$/);
    if (flowMatch) {
      try {
        const state = store.load(today);
        const run = orchestrator.runFlow(flowMatch[1], { state, today, input: body.input || {} });
        const meta = runAndPersist(run);
        return json(res, 200, { ok: true, run: meta, state: engine.compute(store.load(today), today) });
      } catch (err) {
        return fail(res, err.message);
      }
    }

    if (route === '/api/apply') {
      let applied = null;
      const result = store.update(today, s => {
        const out = actions.applyRun(s, jobs.getRun(str(body.runId, 80)), today);
        if (out.error) return false;
        applied = out;
        return true;
      });
      if (!result.changed) return fail(res, 'Unknown run');
      return json(res, 200, {
        ok: true,
        applied,
        state: engine.compute(store.load(today), today),
      });
    }

    if (route === '/api/reset') {
      if (body.confirm !== 'reset') return fail(res, 'Send { "confirm": "reset" } to wipe the state file.');
      store.save(store.freshState(today));
      return view(res, store.load(today));
    }

    const handlers = {
      '/api/sale': s => actions.addSale(s, body, today),
      '/api/sale/delete': s => actions.deleteItem(s, { kind: 'sale', id: body.id }),
      '/api/offer': s => actions.addOffer(s, body),
      '/api/offer/delete': s => actions.deleteItem(s, { kind: 'offer', id: body.id }),
      '/api/content': s => actions.updateContent(s, body, today),
      '/api/checkin': s => actions.checkin(s, body, today),
      '/api/lead': s => actions.upsertLead(s, body, today),
      '/api/lead/stage': s => actions.moveLead(s, body, today),
      '/api/lead/delete': s => actions.deleteItem(s, { kind: 'lead', id: body.id }),
      '/api/funnel': s => actions.saveFunnel(s, body, today),
      '/api/plan': s => actions.togglePlanTask(s, body, today),
      '/api/settings': s => actions.saveSettings(s, body, today),
    };

    const handler = handlers[route];
    if (!handler) return fail(res, `No such API route: ${req.method} ${route}`, 404);

    const result = store.update(today, s => {
      const out = handler(s);
      if (out.error) return false;
      s.__result = out;
      return true;
    });
    if (!result.changed) {
      // re-run once just to get the error message without saving
      const probe = store.load(today);
      const out = handler(probe);
      return fail(res, out.error || 'That did not save.');
    }
    delete result.state.__result;
    return view(res, result.state);
  }

  return fail(res, `No such API route: ${req.method} ${route}`, 404);
}

// ── static ──────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

// ── server-rendered shell ───────────────────────────────────────────────────
// The console is client-rendered. If the client script dies (sandboxed iframe,
// blocked localStorage, JS disabled) an empty <main> looks like a broken app.
// So "/" ships a real, data-backed summary that the client replaces on boot.
function escHtml(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function renderShell() {
  try {
    const today = engine.todayStr();
    const state = store.load(today);
    const v = engine.compute(state, today);
    const moneyFmt = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');
    const check = v.checklist.items.map(i =>
      `<div class="row"><span class="check ${i.done ? 'on' : ''}" aria-hidden="true">${i.done ? '✓' : ''}</span>
        <div class="grow"><div class="r-title">${escHtml(i.label)}</div><div class="r-sub">${escHtml(i.hint)}</div></div>
      </div>`).join('');
    const moves = v.runbook.actions.slice(0, 5).map((a, i) =>
      `<div class="action-row ${i === 0 ? 'first' : ''}">
        <span class="priority">${i + 1}</span>
        <div class="grow"><div class="r-title">${escHtml(a.title)}</div>
          <div class="r-sub">${escHtml(a.detail)}</div>
          <div class="r-sub" style="color:var(--dim2)">${escHtml(a.why)}</div></div>
        <div class="r-meta">${a.minutes} min</div>
      </div>`).join('');

    return `<div id="shell" class="shell">
      <section class="hero card">
        <div class="hero-main">
          <p class="eyebrow">Day ${v.dayNumber} of 90 · ${escHtml(v.prettyToday)} · ${escHtml(v.phaseLabel)}</p>
          <h2 class="hero-title">${escHtml(v.runbook.headline)}</h2>
          <p class="hero-sub">${escHtml(v.runbook.summary)}</p>
          ${v.runbook.focus ? `<div class="hero-focus"><span class="tag">First move · ${v.runbook.focus.minutes} min</span>
            <p>${escHtml(v.runbook.focus.detail)}</p>
            <p class="why">${escHtml(v.runbook.focus.why)}</p></div>` : ''}
          <p class="tiny dim" style="margin:0">Loading the interactive console…</p>
        </div>
        <div class="hero-side">
          <div class="ring" style="background:conic-gradient(var(--gold) ${Math.round(v.checklist.progress * 3.6)}deg,#23232b 0)">
            <div class="ring-in"><b>${v.checklist.done}/${v.checklist.total}</b><span>done today</span></div>
          </div>
          <div class="mini-stats">
            <div><b>${moneyFmt(v.money.mtd)}</b><span>this month</span></div>
            <div><b>${v.money.units30}</b><span>units / 30d</span></div>
            <div><b>${v.streak}</b><span>day streak</span></div>
          </div>
        </div>
      </section>
      <div class="grid-2">
        <section class="card">
          <div class="card-head"><div><p class="eyebrow plain">The daily six</p>
            <h2 style="font-size:17px">Today’s checklist</h2></div>
            <span class="pill gold">${v.checklist.done}/${v.checklist.total}</span></div>
          <div class="list">${check}</div>
        </section>
        <section class="card">
          <div class="card-head"><div><p class="eyebrow plain">Runbook</p>
            <h2 style="font-size:17px">Everything, in order</h2></div>
            <span class="pill dim">${v.runbook.actions.length} moves</span></div>
          ${moves}
        </section>
      </div>
      <p class="note">This summary is rendered by the server on every load, so it is live data — not a placeholder. The interactive tabs are enhanced by <code>app.js</code>.</p>
    </div>`;
  } catch (err) {
    return `<div id="shell" class="card"><h2>Buyable Brand OS</h2>
      <p class="muted small">The server is running but could not read its state file: ${escHtml(err.message)}</p>
      <p class="small dim">Check that <code>brand-os/data/</code> is writable, then reload.</p></div>`;
  }
}

function serveStatic(req, res, url) {
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { p = '/'; }
  if (p === '/') p = '/index.html';
  const target = path.normalize(path.join(PUBLIC, p));
  if (!target.startsWith(PUBLIC + path.sep) && target !== path.join(PUBLIC, 'index.html')) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  const sendIndex = () => {
    fs.readFile(path.join(PUBLIC, 'index.html'), 'utf8', (e2, idx) => {
      if (e2) { res.writeHead(404); return res.end('Not found'); }
      const html = String(idx).replace('<!--SHELL-->', renderShell());
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      res.end(html);
    });
  };

  fs.readFile(target, (err, buf) => {
    if (err) { sendIndex(); return; }
    const ext = path.extname(target).toLowerCase();
    if (ext === '.html') { sendIndex(); return; }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); } catch {
    res.writeHead(400);
    return res.end('Bad request');
  }
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch(err => {
      console.error('API error:', err);
      try { json(res, 500, { ok: false, error: err.message }); } catch { /* socket gone */ }
    });
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`◆ Buyable Brand OS → http://0.0.0.0:${PORT}`);
  console.log(`  state: ${store.STATE_FILE}`);
});
