// ─────────────────────────────────────────────────────────────────────────────
// web/browser-api.js — the whole server, in the browser.
//
// The app talks to `/api/*`. In the static build there is no Node process, so
// this file installs a fetch() shim that answers those same routes from
// localStorage using the *same* engine, agents, orchestrator and actions the
// Node server uses. One behaviour, two deployments.
//
// Exposed as window.BB.api = { router } and window.BB.store for the boot script.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

(function () {
  const BB = window.BB;
  const { engine, agents, orchestrator, actions, state: stateLib, kit, playbook } = BB;

  const STATE_KEY = 'bb.static.state.v1';
  const RUNS_KEY = 'bb.static.runs.v1';
  const MAX_RUNS = 8;

  // ── storage (never throws) ────────────────────────────────────────────────
  const mem = {};
  function read(key) {
    try { const v = window.localStorage.getItem(key); return v == null ? (mem[key] ?? null) : v; }
    catch { return mem[key] ?? null; }
  }
  function write(key, value) {
    mem[key] = value;
    try { window.localStorage.setItem(key, value); } catch { /* memory only */ }
  }

  // ── state ─────────────────────────────────────────────────────────────────
  function today() { return engine.todayStr(); }

  function loadState() {
    const raw = read(STATE_KEY);
    let parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = null; }
    return stateLib.normalize(parsed, today());
  }
  function saveState(s) { write(STATE_KEY, JSON.stringify(s)); return s; }

  // ── runs ──────────────────────────────────────────────────────────────────
  function loadRuns() {
    try { const p = JSON.parse(read(RUNS_KEY) || '{"runs":[]}'); return Array.isArray(p.runs) ? p : { runs: [] }; }
    catch { return { runs: [] }; }
  }
  function saveRuns(store) {
    // keep the newest MAX_RUNS, artifacts included (they are plain markdown)
    store.runs = store.runs.slice(0, MAX_RUNS);
    try { write(RUNS_KEY, JSON.stringify(store)); } catch { /* quota: keep in memory */ }
  }

  function persistRun(run) {
    const files = (run.artifacts || []).map(a => ({
      name: a.name, title: a.title, agentId: a.agentId, agentName: a.agentName,
      bytes: a.content.length,
    }));
    const meta = {
      id: run.id, flowId: run.flowId, flowName: run.flowName, status: run.status,
      startedAt: run.startedAt, today: run.today, summary: run.summary,
      durationMs: run.durationMs, steps: run.steps, files,
      blockers: run.blockers, notes: run.notes, input: run.input,
      adopt: run.adopt || { offers: [], content: [] },
      _artifacts: (run.artifacts || []).reduce((acc, a) => { acc[a.name] = a.content; return acc; }, {}),
    };
    const store = loadRuns();
    store.runs = [meta, ...store.runs.filter(r => r.id !== run.id)];
    saveRuns(store);
    return publicRun(meta);
  }

  // never ship artifact bodies in the runs list
  function publicRun(meta) {
    if (!meta) return null;
    const { _artifacts, ...rest } = meta;
    return rest;
  }
  function findRun(id) {
    return loadRuns().runs.find(r => r.id === id) || null;
  }

  // ── agent/flow execution ──────────────────────────────────────────────────
  function runAgent(agentId, input) {
    const agent = agents.BY_ID[agentId];
    if (!agent) return { error: `Unknown agent: ${agentId}` };
    const s = loadState();
    const t = today();
    const result = agent.run(s, t, input || {}, { artifacts: {}, shared: {} });
    const run = {
      id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      flowId: `agent:${agent.id}`,
      flowName: agent.name,
      status: result.status,
      startedAt: new Date().toISOString(),
      today: t,
      input: input || {},
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
    return { ok: true, run: persistRun(run), state: engine.compute(loadState(), t) };
  }

  function runFlow(flowId, input) {
    const s = loadState();
    const t = today();
    let run;
    try {
      run = orchestrator.runFlow(flowId, { state: s, today: t, input: input || {} });
    } catch (err) {
      return { error: err.message };
    }
    return { ok: true, run: persistRun(run), state: engine.compute(loadState(), t) };
  }

  // ── kit zip ───────────────────────────────────────────────────────────────
  function kitBlob(runId) {
    const run = findRun(runId);
    if (!run) throw new Error('Unknown run');
    const s = loadState();
    const files = [
      { name: 'README.md', content: kit.readme({ run, settings: s.settings, today: today() }) },
      ...Object.entries(run._artifacts || {}).map(([name, content]) => ({ name, content })),
    ];
    const buf = kit.zip(files);
    return new Blob([buf], { type: 'application/zip' });
  }

  // ── router ────────────────────────────────────────────────────────────────
  // returns { status, body } or { status, blob }
  function router(method, path, body) {
    const t = today();
    const url = new URL(path, 'http://local');
    const route = url.pathname.replace(/\/+$/, '') || '/';
    const b = body || {};

    if (method === 'GET' && (route === '/api/state' || route === '/api')) {
      return { status: 200, body: { ok: true, state: engine.compute(loadState(), t) } };
    }
    if (method === 'GET' && route === '/api/agents') {
      return { status: 200, body: { ok: true, agents: agents.listAgents(), flows: orchestrator.listFlows() } };
    }
    if (method === 'GET' && route === '/api/runs') {
      return { status: 200, body: { ok: true, runs: loadRuns().runs.map(publicRun) } };
    }
    if (method === 'GET' && /^\/api\/runs\/[\w-]+$/.test(route)) {
      const run = publicRun(findRun(route.split('/')[3]));
      return run ? { status: 200, body: { ok: true, run } } : { status: 404, body: { ok: false, error: 'Unknown run' } };
    }
    if (method === 'GET' && /^\/api\/runs\/[\w-]+\/file$/.test(route)) {
      const run = findRun(route.split('/')[3]);
      const name = url.searchParams.get('name') || '';
      const content = run && (run._artifacts || {})[name];
      return content != null
        ? { status: 200, body: { ok: true, name, content } }
        : { status: 404, body: { ok: false, error: 'That artifact is not part of this run' } };
    }
    if (method === 'GET' && /^\/api\/kit\/[\w-]+\.zip$/.test(route)) {
      const id = route.slice('/api/kit/'.length, -4);
      try { return { status: 200, blob: kitBlob(id), filename: `buyable-kit-${id}.zip` }; }
      catch (err) { return { status: 404, body: { ok: false, error: err.message } }; }
    }
    if (method === 'GET' && route === '/api/export') {
      return { status: 200, blob: new Blob([JSON.stringify(loadState(), null, 2)], { type: 'application/json' }), filename: `buyable-brand-state-${t}.json` };
    }

    if (method === 'POST') {
      const flowMatch = route.match(/^\/api\/flows\/([\w-]+)\/run$/);
      if (flowMatch) return { status: 200, body: runFlow(flowMatch[1], b.input) };

      const agentMatch = route.match(/^\/api\/agents\/([\w-]+)\/run$/);
      if (agentMatch) return { status: 200, body: runAgent(agentMatch[1], b.input) };

      if (route === '/api/apply') {
        const run = findRun(b.runId);
        if (!run) return { status: 400, body: { ok: false, error: 'Unknown run' } };
        const s = loadState();
        const out = actions.applyRun(s, run, t);
        if (out.error) return { status: 400, body: { ok: false, error: out.error } };
        saveState(s);
        return { status: 200, body: { ok: true, applied: out, state: engine.compute(loadState(), t) } };
      }

      if (route === '/api/reset') {
        if (b.confirm !== 'reset') return { status: 400, body: { ok: false, error: 'Send { "confirm": "reset" } to wipe the state.' } };
        saveState(stateLib.freshState(t));
        saveRuns({ runs: [] });
        return { status: 200, body: { ok: true, state: engine.compute(loadState(), t) } };
      }

      const handlers = {
        '/api/sale': s => actions.addSale(s, b, t),
        '/api/sale/delete': s => actions.deleteItem(s, { kind: 'sale', id: b.id }),
        '/api/offer': s => actions.addOffer(s, b),
        '/api/offer/delete': s => actions.deleteItem(s, { kind: 'offer', id: b.id }),
        '/api/content': s => actions.updateContent(s, b, t),
        '/api/checkin': s => actions.checkin(s, b, t),
        '/api/lead': s => actions.upsertLead(s, b, t),
        '/api/lead/stage': s => actions.moveLead(s, b, t),
        '/api/lead/delete': s => actions.deleteItem(s, { kind: 'lead', id: b.id }),
        '/api/funnel': s => actions.saveFunnel(s, b, t),
        '/api/plan': s => actions.togglePlanTask(s, b, t),
        '/api/settings': s => actions.saveSettings(s, b, t),
      };
      const handler = handlers[route];
      if (!handler) return { status: 404, body: { ok: false, error: `No such API route: ${route}` } };

      const s = loadState();
      const out = handler(s);
      if (out.error) return { status: 400, body: { ok: false, error: out.error } };
      saveState(s);
      return { status: 200, body: { ok: true, state: engine.compute(loadState(), t) } };
    }

    return { status: 404, body: { ok: false, error: 'Not found' } };
  }

  // ── fetch shim ────────────────────────────────────────────────────────────
  const realFetch = window.fetch ? window.fetch.bind(window) : null;

  window.fetch = function (input, init) {
    const raw = typeof input === 'string' ? input : (input && input.url) || '';
    const path = raw.split('#')[0];
    if (!path.includes('/api/')) {
      return realFetch ? realFetch(input, init) : Promise.reject(new Error('No fetch available'));
    }
    const method = ((init && init.method) || 'GET').toUpperCase();
    let body = null;
    if (init && init.body) {
      try { body = JSON.parse(init.body); } catch { body = null; }
    }
    return new Promise(resolve => {
      let out;
      try { out = router(method, path, body); }
      catch (err) { out = { status: 500, body: { ok: false, error: err.message } }; }
      resolve({
        ok: out.status >= 200 && out.status < 300,
        status: out.status,
        headers: { get: () => 'application/json' },
        json: async () => out.body || { ok: false, error: 'empty' },
        text: async () => JSON.stringify(out.body || {}),
      });
    });
  };

  // ── downloads (no server to serve /api/kit/...zip) ────────────────────────
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="/api/"]');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href');
    try {
      const out = router('GET', href, null);
      if (out.blob) downloadBlob(out.blob, out.filename || 'download');
      else if (raw => raw) window.dispatchEvent(new CustomEvent('bb:error', { detail: (out.body || {}).error || 'Download failed' }));
    } catch (err) {
      window.dispatchEvent(new CustomEvent('bb:error', { detail: err.message }));
    }
  }, true);

  BB.api = { router, loadState, saveState, loadRuns, findRun, kitBlob, downloadBlob };
  BB.limits = { maxRuns: MAX_RUNS };
})();
