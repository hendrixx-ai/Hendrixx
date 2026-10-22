// ─────────────────────────────────────────────────────────────────────────────
// jobs.js — run history and artifact storage.
//
// Every run is persisted twice:
//   data/runs/<runId>/<name>.md   → the artifact you actually read/download
//   data/runs/index.json          → the run log (steps, timings, status)
//
// Artifacts are content-addressed by name inside the run, and every read goes
// through a name allowlist so a run cannot be used to read arbitrary files.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.BRAND_OS_DATA_DIR
  ? path.resolve(process.env.BRAND_OS_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const RUNS_DIR = path.join(DATA_DIR, 'runs');
const INDEX = path.join(RUNS_DIR, 'index.json');
const MAX_RUNS = 40;

function ensure() {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
}

function safeName(name) {
  const base = path.basename(String(name || ''));
  if (!/^[\w.-]+\.md$/.test(base)) throw new Error(`Unsafe artifact name: ${name}`);
  return base;
}

function saveRun(run) {
  ensure();
  const dir = path.join(RUNS_DIR, run.id);
  fs.mkdirSync(dir, { recursive: true });

  const files = [];
  for (const a of run.artifacts) {
    const name = safeName(a.name);
    fs.writeFileSync(path.join(dir, name), a.content, 'utf8');
    files.push({ name, title: a.title, agentId: a.agentId, agentName: a.agentName, bytes: Buffer.byteLength(a.content) });
  }

  const meta = {
    id: run.id, flowId: run.flowId, flowName: run.flowName, status: run.status,
    startedAt: run.startedAt, today: run.today, summary: run.summary,
    durationMs: run.durationMs, steps: run.steps, files,
    blockers: run.blockers, notes: run.notes, input: run.input,
    adopt: run.adopt || { offers: [], content: [] },
  };

  const index = readIndex();
  index.runs = [meta, ...index.runs.filter(r => r.id !== run.id)].slice(0, MAX_RUNS);
  writeIndex(index);

  // prune run folders that fell out of the index
  const keep = new Set(index.runs.map(r => r.id));
  for (const entry of fs.readdirSync(RUNS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !keep.has(entry.name)) {
      fs.rmSync(path.join(RUNS_DIR, entry.name), { recursive: true, force: true });
    }
  }
  return meta;
}

function readIndex() {
  ensure();
  try {
    const parsed = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
    if (parsed && Array.isArray(parsed.runs)) return parsed;
  } catch { /* first run */ }
  return { runs: [] };
}

function writeIndex(index) {
  ensure();
  const tmp = `${INDEX}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, INDEX);
}

function listRuns() {
  return readIndex().runs;
}

function getRun(id) {
  return readIndex().runs.find(r => r.id === id) || null;
}

function readArtifact(runId, name) {
  const run = getRun(runId);
  if (!run) throw new Error('Unknown run');
  const safe = safeName(name);
  if (!run.files.some(f => f.name === safe)) throw new Error('That artifact is not part of this run');
  return fs.readFileSync(path.join(RUNS_DIR, runId, safe), 'utf8');
}

function artifactFiles(runId) {
  const run = getRun(runId);
  if (!run) throw new Error('Unknown run');
  return run.files.map(f => ({
    ...f,
    content: fs.readFileSync(path.join(RUNS_DIR, runId, f.name), 'utf8'),
  }));
}

module.exports = { RUNS_DIR, saveRun, listRuns, getRun, readArtifact, artifactFiles, safeName };
