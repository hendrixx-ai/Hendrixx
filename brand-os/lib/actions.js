// ─────────────────────────────────────────────────────────────────────────────
// actions.js — every mutation, as a pure function over the state object.
//
// No HTTP, no filesystem, no clock. The Node server and the browser build both
// call exactly these, so the two deployments cannot drift apart.
//
// Contract: action(state, body, today) → { ok: true, ... } | { error: string }
// A returned { error } means "do not save".
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const engine = require('./engine');

const str = (v, max = 400) => String(v == null ? '' : v).trim().slice(0, max);
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const isoDate = v => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);
const slug = v => str(v, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `offer-${Date.now()}`;

// ── sales ───────────────────────────────────────────────────────────────────
function addSale(state, body, today) {
  const offer = (state.offers || []).find(o => o.id === body.offerId);
  if (!offer) return { error: 'Pick an offer from your ladder' };
  const price = num(body.price, Number(offer.price) || 0);
  if (price < 0) return { error: 'Price cannot be negative' };
  const units = Math.max(1, Math.min(1000, Math.round(num(body.units, 1))));
  const date = isoDate(body.date) || today;
  if (date > today) return { error: 'You cannot log a sale in the future' };

  state.sales.unshift({
    id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    offerId: offer.id,
    offerName: offer.name,
    price,
    units,
    total: price * units,
    source: str(body.source, 40) || 'DM',
    date,
    note: str(body.note, 300),
    createdAt: new Date().toISOString(),
  });
  return { ok: true };
}

// ── offers ──────────────────────────────────────────────────────────────────
function addOffer(state, body) {
  const name = str(body.name, 80);
  if (!name) return { error: 'Name is required' };
  const existing = (state.offers || []).find(o => o.id === body.id);
  const price = Math.max(0, num(body.price, 0));

  if (existing) {
    existing.name = name;
    existing.price = price;
    if (body.layer) existing.layer = str(body.layer, 20);
    if (body.status) existing.status = str(body.status, 20);
    if (body.promise != null) existing.promise = str(body.promise, 300);
    if (body.format != null) existing.format = str(body.format, 300);
    if (body.next != null) existing.next = str(body.next, 300);
    return { ok: true, id: existing.id };
  }

  let id = body.id ? slug(body.id) : slug(name);
  if (state.offers.some(o => o.id === id)) {
    let n = 2;
    while (state.offers.some(o => o.id === `${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  state.offers.push({
    id,
    name,
    price,
    layer: str(body.layer, 20) || 'core',
    status: str(body.status, 20) || 'idea',
    format: str(body.format, 300) || '—',
    promise: str(body.promise, 300) || '—',
    role: '—',
    next: str(body.next, 300) || 'Define the next build step.',
    costNote: price ? `$${price}` : 'Free',
  });
  return { ok: true, id };
}

// ── content ─────────────────────────────────────────────────────────────────
function updateContent(state, body, today) {
  const id = str(body.id, 10);
  const item = (state.content || []).find(c => c.id === id);
  if (!item) return { error: 'Unknown content item' };
  const date = isoDate(body.date) || today;

  if (body.status === 'posted') {
    item.history = Array.isArray(item.history) ? item.history : [];
    if (!item.history.includes(date)) item.history.push(date);
  } else if (body.status === 'unpost') {
    item.history = (item.history || []).filter(d => d !== date);
  } else if (body.status === 'filmed') {
    item.status = 'filmed';
    if (item.history && item.history.includes(date)) {
      item.history = item.history.filter(d => d !== date);
    }
  } else if (body.status === 'planned') {
    item.status = 'planned';
  }
  if (body.hook != null) item.hook = str(body.hook, 300);
  if (body.cta != null) item.cta = str(body.cta, 160);
  return { ok: true };
}

// ── checklist ───────────────────────────────────────────────────────────────
function checkin(state, body, today) {
  const date = isoDate(body.date) || today;
  const id = str(body.id, 30);
  if (!id) return { error: 'Checklist item required' };
  const entry = state.checkins[date] || { done: {}, note: '' };
  entry.done = entry.done || {};
  entry.done[id] = Boolean(body.done);
  if (body.note != null) entry.note = str(body.note, 500);
  state.checkins[date] = entry;
  return { ok: true };
}

// ── leads ───────────────────────────────────────────────────────────────────
function upsertLead(state, body, today) {
  const name = str(body.name, 80);
  if (!name) return { error: 'A name or handle is required' };
  const stage = engine.LEAD_STAGE_KEYS.includes(body.stage) ? body.stage : 'new';
  const nextActionAt = body.nextActionAt === ''
    ? null
    : isoDate(body.nextActionAt) || engine.addDays(today, 2);

  if (body.id) {
    const lead = (state.leads || []).find(l => l.id === body.id);
    if (!lead) return { error: 'Unknown lead' };
    lead.name = name;
    if (body.handle != null) lead.handle = str(body.handle, 80);
    if (body.skill != null) lead.skill = str(body.skill, 120);
    if (body.source != null) lead.source = str(body.source, 60);
    if (body.note != null) lead.note = str(body.note, 500);
    if (body.stage) lead.stage = stage;
    if (body.nextActionAt !== undefined) lead.nextActionAt = nextActionAt;
    if (['bought', 'lost'].includes(lead.stage)) lead.nextActionAt = null;
    lead.lastTouch = today;
    return { ok: true, id: lead.id };
  }

  const lead = {
    id: `l-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name,
    handle: str(body.handle, 80),
    skill: str(body.skill, 120),
    source: str(body.source, 60) || 'Comment keyword',
    stage,
    note: str(body.note, 500),
    nextActionAt: ['bought', 'lost'].includes(stage) ? null : nextActionAt,
    createdAt: today,
    lastTouch: today,
  };
  state.leads.unshift(lead);
  return { ok: true, id: lead.id };
}

function moveLead(state, body, today) {
  const lead = (state.leads || []).find(l => l.id === body.id);
  if (!lead) return { error: 'Unknown lead' };
  const stage = str(body.stage, 20);
  if (!engine.LEAD_STAGE_KEYS.includes(stage)) return { error: 'Unknown stage' };
  lead.stage = stage;
  lead.lastTouch = today;
  if (stage === 'bought' || stage === 'lost') lead.nextActionAt = null;
  else if (!lead.nextActionAt || lead.nextActionAt <= today) lead.nextActionAt = engine.addDays(today, 2);
  if (body.note) lead.note = str(body.note, 500);
  return { ok: true };
}

// ── funnel ──────────────────────────────────────────────────────────────────
function saveFunnel(state, body, today) {
  const clamp = v => Math.max(0, Math.min(1e9, Math.round(num(v, 0))));
  state.funnel = {
    views: clamp(body.views),
    comments: clamp(body.comments),
    dmReplies: clamp(body.dmReplies),
    clicks: clamp(body.clicks),
    purchases: clamp(body.purchases),
    updated: today,
    note: str(body.note, 300),
  };
  return { ok: true };
}

// ── 90-day plan ─────────────────────────────────────────────────────────────
function togglePlanTask(state, body, today) {
  for (const phase of state.plan || []) {
    for (const task of phase.tasks || []) {
      if (task.id === body.id) {
        task.done = Boolean(body.done);
        task.doneAt = task.done ? today : null;
        return { ok: true };
      }
    }
  }
  return { error: 'Unknown plan task' };
}

// ── settings ────────────────────────────────────────────────────────────────
function saveSettings(state, body, today) {
  const s = state.settings;
  if (body.goal != null) s.goal = Math.max(100, Math.min(1e7, Math.round(num(body.goal, s.goal))));
  if (body.startDate != null) {
    const d = isoDate(body.startDate);
    if (!d) return { error: 'Start date must be YYYY-MM-DD' };
    if (d > today) return { error: 'Start date cannot be in the future' };
    s.startDate = d;
  }
  for (const k of ['name', 'handle', 'mapLink', 'tripwireLink', 'coreLink', 'reviewLink']) {
    if (body[k] != null) s[k] = str(body[k], 300);
  }
  return { ok: true };
}

// ── deletes ─────────────────────────────────────────────────────────────────
function deleteItem(state, body) {
  const { kind, id } = body;
  if (kind === 'sale') {
    const before = state.sales.length;
    state.sales = state.sales.filter(x => x.id !== id);
    return before === state.sales.length ? { error: 'Unknown sale' } : { ok: true };
  }
  if (kind === 'lead') {
    const before = state.leads.length;
    state.leads = state.leads.filter(x => x.id !== id);
    return before === state.leads.length ? { error: 'Unknown lead' } : { ok: true };
  }
  if (kind === 'offer') {
    const sales = (state.sales || []).some(x => x.offerId === id);
    if (sales) return { error: 'That offer has sales logged. Archive it instead of deleting.' };
    const before = state.offers.length;
    state.offers = state.offers.filter(x => x.id !== id);
    return before === state.offers.length ? { error: 'Unknown offer' } : { ok: true };
  }
  return { error: 'Unknown delete kind' };
}

// ── adopting an agent run ───────────────────────────────────────────────────
// Only fills blanks: words the boss wrote are never overwritten.
function applyRun(state, run, today) {
  if (!run) return { error: 'Unknown run' };
  const adopt = run.adopt || { offers: [], content: [] };
  let offersChanged = 0;
  let contentChanged = 0;

  for (const incoming of adopt.offers || []) {
    const offer = (state.offers || []).find(o => o.id === incoming.id);
    if (!offer) continue;
    if (incoming.name) offer.name = str(incoming.name, 80);
    if (Number.isFinite(Number(incoming.price))) offer.price = Math.max(0, Number(incoming.price));
    if (incoming.promise) offer.promise = str(incoming.promise, 300);
    if (incoming.format) offer.format = str(incoming.format, 300);
    offer.status = offer.status === 'idea' ? 'building' : offer.status;
    offersChanged += 1;
  }

  for (const incoming of adopt.content || []) {
    const item = (state.content || []).find(c => c.id === incoming.id);
    if (!item) continue;
    if (!item.hook) { item.hook = str(incoming.hook, 300); contentChanged += 1; }
    if (!item.cta) item.cta = str(incoming.cta, 160);
  }

  return { ok: true, offersChanged, contentChanged, today };
}

module.exports = {
  addSale, addOffer, updateContent, checkin, upsertLead, moveLead, saveFunnel,
  togglePlanTask, saveSettings, deleteItem, applyRun,
  helpers: { str, num, isoDate, slug },
};
