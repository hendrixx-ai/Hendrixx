// ─────────────────────────────────────────────────────────────────────────────
// store.js — the state file.
//
// One JSON file (brand-os/data/state.json, gitignored). Everything the plan
// says you should own — offers, sales, leads, content status, funnel numbers,
// 90-day plan — lives here. No database, no dependencies.
//
// Writes are atomic (tmp file + rename) and validated by shape before save, so
// a crash mid-write cannot leave you with a corrupt business.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');
const path = require('path');
const playbook = require('./playbook');

const DATA_DIR = process.env.BRAND_OS_DATA_DIR
  ? path.resolve(process.env.BRAND_OS_DATA_DIR)
  : path.join(__dirname, '..', 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

function freshState(today) {
  return {
    version: 1,
    createdAt: today,
    settings: {
      goal: 10000,
      startDate: today,
      name: '[Your name]',
      handle: '@yourname',
      mapLink: '',
      tripwireLink: '',
      coreLink: '',
      reviewLink: '',
    },
    offers: playbook.OFFERS.map(o => ({ ...o })),
    sales: [],
    content: playbook.CONTENT.map(c => ({
      id: `c${String(c.day).padStart(2, '0')}`,
      status: 'planned',
      history: [],
      hook: '',
      cta: '',
    })),
    leads: [],
    funnel: { views: 0, comments: 0, dmReplies: 0, clicks: 0, purchases: 0, updated: null, note: '' },
    checkins: {},
    plan: playbook.PLAN.map(p => ({
      ...p,
      tasks: p.tasks.map((label, i) => ({ id: `${p.id}-${i + 1}`, label, done: false, doneAt: null })),
    })),
  };
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalize(raw, today) {
  const base = freshState(today);
  if (!raw || typeof raw !== 'object') return base;

  const state = { ...base, ...raw };
  state.settings = { ...base.settings, ...(raw.settings || {}) };
  state.offers = Array.isArray(raw.offers) && raw.offers.length ? raw.offers : base.offers;
  state.sales = Array.isArray(raw.sales) ? raw.sales : [];
  state.leads = Array.isArray(raw.leads) ? raw.leads : [];
  state.funnel = { ...base.funnel, ...(raw.funnel || {}) };
  state.checkins = raw.checkins && typeof raw.checkins === 'object' ? raw.checkins : {};

  // content: keep stored edits/history, add any newly added calendar items
  const stored = {};
  for (const c of Array.isArray(raw.content) ? raw.content : []) stored[c.id] = c;
  state.content = base.content.map(defaults => ({
    ...defaults,
    ...(stored[defaults.id] || {}),
    history: Array.isArray((stored[defaults.id] || {}).history) ? stored[defaults.id].history : [],
  }));

  // plan: never lose a checked task, never resurrect a removed one
  const storedPlan = {};
  for (const p of Array.isArray(raw.plan) ? raw.plan : []) storedPlan[p.id] = p;
  state.plan = base.plan.map(p => {
    const old = storedPlan[p.id];
    if (!old || !Array.isArray(old.tasks)) return p;
    const oldTasks = {};
    for (const t of old.tasks) oldTasks[t.id] = t;
    return {
      ...p,
      tasks: p.tasks.map(t => ({
        ...t,
        done: Boolean((oldTasks[t.id] || {}).done),
        doneAt: (oldTasks[t.id] || {}).doneAt || null,
      })),
    };
  });

  return state;
}

function load(today) {
  ensureDir();
  let raw = null;
  try {
    raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    raw = null;
  }
  const state = normalize(raw, today);
  if (!raw) save(state);
  return state;
}

function save(state) {
  ensureDir();
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, STATE_FILE);
  return state;
}

function update(today, mutator) {
  const state = load(today);
  const result = mutator(state);
  if (result === false) return { changed: false, state };
  save(state);
  return { changed: true, state };
}

function reset(today) {
  const state = freshState(today);
  save(state);
  return state;
}

module.exports = { DATA_DIR, STATE_FILE, freshState, load, save, update, reset, normalize };
