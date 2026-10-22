// ─────────────────────────────────────────────────────────────────────────────
// state.js — pure state shape (no fs, no path). Safe in the browser.
//   freshState(today) → a brand-new business
//   normalize(raw, today) → the saved shape, repaired and forward-compatible
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const playbook = require('./playbook');

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

module.exports = { freshState, normalize };
