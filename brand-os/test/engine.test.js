// ─────────────────────────────────────────────────────────────────────────────
// engine.test.js — the orchestrator's rules, pinned.
//   node --test brand-os/test
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../lib/engine');
const store = require('../lib/store');

const TODAY = '2026-10-22';

function fresh(start = TODAY) {
  const s = store.freshState(start);
  return s;
}
function withSale(state, id, offerId, price, units, date) {
  const offer = state.offers.find(o => o.id === offerId);
  state.sales.push({
    id, offerId, offerName: offer.name, price, units, total: price * units,
    source: 'DM', date, note: '',
  });
  return state;
}

test('dates are EAT calendar days, not UTC instants', () => {
  assert.equal(engine.addDays('2026-10-22', 1), '2026-10-23');
  assert.equal(engine.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(engine.diffDays('2026-10-01', '2026-10-22'), 21);
  assert.equal(engine.dayNumber('2026-10-22', TODAY), 1);
  assert.equal(engine.dayNumber('2026-09-23', TODAY), 30);
  assert.match(engine.prettyDate(TODAY), /Thu 22 Oct/);
});

test('phase is derived from the day, and day 45 is the raise phase', () => {
  assert.equal(engine.phaseFor(1).id, 'foundation');
  assert.equal(engine.phaseFor(9).id, 'tripwire');
  assert.equal(engine.phaseFor(22).id, 'core');
  assert.equal(engine.phaseFor(45).id, 'raise');
  assert.equal(engine.phaseFor(90).id, 'launch');
  assert.equal(engine.phaseFor(180).id, 'launch'); // beyond the plan: stay on the last phase
});

test('day 1 calendar maps to today’s piece, and cycles after 30 days', () => {
  const state = fresh();
  const c1 = engine.contentView(state, TODAY);
  assert.equal(c1.dayNumber, 1);
  assert.equal(c1.today.dayOfCycle, 1);
  assert.equal(c1.today.date, TODAY);
  assert.equal(c1.items.length, 30);
  assert.equal(c1.stats.posted, 0);

  const later = engine.contentView(state, engine.addDays(TODAY, 30));
  assert.equal(later.cycle, 2);
  assert.equal(later.today.dayOfCycle, 1);
  assert.equal(later.today.date, engine.addDays(TODAY, 30));
});

test('marking posted is per date, so a new cycle starts clean', () => {
  const state = fresh();
  state.content[0].history = [TODAY];
  const c1 = engine.contentView(state, TODAY);
  assert.equal(c1.today.posted, true);
  assert.equal(c1.stats.posted, 1);

  const c2 = engine.contentView(state, engine.addDays(TODAY, 30));
  assert.equal(c2.today.posted, false, 'the same hook in cycle 2 is not posted yet');
});

test('revenue: MTD, units and the path maths', () => {
  const state = fresh('2026-10-01');
  withSale(state, 's1', 'weekend', 27, 2, '2026-10-05');   // 54
  withSale(state, 's2', 'brand', 97, 1, '2026-10-20');     // 97
  withSale(state, 's3', 'review', 297, 1, '2026-09-15');   // prior month
  const m = engine.revenue(state, TODAY);
  assert.equal(m.mtd, 151);
  assert.equal(m.allTime, 448);
  assert.equal(m.units, 4);
  assert.equal(m.units30, 3);
  assert.equal(m.byOffer[0].offerId, 'review');
  assert.equal(m.byOffer[0].revenue, 297);

  const p = engine.paths(10000, state.offers);
  assert.equal(p[0].sales, '69 sales / month');
  assert.match(p[1].sales, /core \+ \d+ tripwire \+ \d+ upsells/);
});

test('ranking rewards revenue, units and momentum, and names one best seller', () => {
  const state = fresh('2026-10-01');
  withSale(state, 's1', 'weekend', 27, 4, '2026-10-20');
  withSale(state, 's2', 'brand', 147, 3, '2026-10-21');
  const r = engine.rankOffers(state, TODAY);
  assert.equal(r.bestSellerId, 'brand');
  assert.equal(r.offers[0].revenue, 441);
  assert.equal(r.offers[0].units, 3);
  assert.ok(r.offers[0].score > r.offers[1].score);
  assert.equal(r.offers.filter(o => o.isBest).length, 1);

  const empty = engine.rankOffers(fresh(), TODAY);
  assert.equal(empty.bestSellerId, null, 'no sales means no invented best seller');
});

test('funnel diagnosis follows the plan’s benchmarks', () => {
  const bad = engine.funnelView({ views: 2000, comments: 8, dmReplies: 6, clicks: 2, purchases: 1 });
  assert.equal(bad.rates.commentRate, 0.4);
  assert.ok(bad.diagnosis.some(d => /keyword is unclear|buried/i.test(d)));

  const good = engine.funnelView({ views: 2000, comments: 40, dmReplies: 30, clicks: 9, purchases: 1 });
  assert.ok(good.checks.every(c => c.status === 'ok' || c.status === 'high'));
  assert.ok(good.diagnosis.some(d => /benchmark range/i.test(d)));

  const none = engine.funnelView({});
  assert.equal(none.hasData, false);
  assert.match(none.diagnosis[0], /No funnel numbers yet/);
});

test('orchestrator: due leads outrank posting, and a missing post is always on the board', () => {
  const state = fresh();
  state.leads.push({
    id: 'l1', name: 'Maya', handle: '@maya', stage: 'deciding',
    nextActionAt: engine.addDays(TODAY, -1), createdAt: TODAY, note: '',
  });
  const view = engine.compute(state, TODAY);
  assert.equal(view.runbook.actions[0].id, 'dms');
  assert.equal(view.leads.due, 1);
  assert.ok(view.runbook.actions.some(a => a.id === 'post'));
  assert.equal(view.runbook.focus.id, 'dms');
  assert.ok(view.checklist.items.some(i => i.id === 'post' && !i.done));
});

test('orchestrator: the offer move walks the ladder in the plan’s order', () => {
  const state = fresh();
  let move = engine.compute(state, TODAY).offerMove;
  assert.equal(move.id, 'map');

  state.offers.find(o => o.id === 'map').status = 'live';
  move = engine.compute(state, TODAY).offerMove;
  assert.equal(move.id, 'weekend');

  state.offers.find(o => o.id === 'weekend').status = 'live';
  for (let i = 0; i < 10; i++) withSale(state, `w${i}`, 'weekend', 27, 1, TODAY);
  move = engine.compute(state, TODAY).offerMove;
  assert.equal(move.id, 'core');

  state.offers.find(o => o.id === 'brand').status = 'live';
  for (let i = 0; i < 10; i++) withSale(state, `b${i}`, 'brand', 97, 1, TODAY);
  const later = engine.compute(state, engine.addDays(TODAY, 40));
  assert.ok(['review', 'proof', 'raise'].includes(later.offerMove.id));
});

test('checklist completion is stored per day and drives the streak', () => {
  const state = fresh();
  const before = engine.compute(state, TODAY).checklist;
  assert.equal(before.done, 0);
  assert.equal(before.total, 6);

  state.checkins[TODAY] = { done: { post: true, stories: true, dms: true }, note: 'first day' };
  const after = engine.compute(state, TODAY).checklist;
  assert.equal(after.done, 3);
  assert.equal(after.complete, false);
  assert.equal(engine.compute(state, TODAY).streak, 1);

  state.checkins[engine.addDays(TODAY, -1)] = { done: { post: true, stories: true, engage: true } };
  assert.equal(engine.compute(state, TODAY).streak, 2);
});

test('plan view tracks the active phase and its next task', () => {
  const state = fresh('2026-09-08'); // day 45
  const view = engine.planView(state, TODAY);
  assert.equal(view.active.id, 'raise');
  assert.equal(view.nextTask.id, 'raise-1');
  state.plan.find(p => p.id === 'raise').tasks[0].done = true;
  assert.equal(engine.planView(state, TODAY).nextTask.id, 'raise-2');
});

test('scripts never invent a specific — proof stays bracketed', () => {
  const state = fresh();
  const view = engine.compute(state, TODAY);
  assert.match(view.contentScript.text, /\[your number\]/);
  assert.match(view.contentScript.caption, /\{\{handle\}\}/);
  assert.equal(view.settings.handle, '@yourname');
  assert.match(view.contentScript.text, /PROOF/);
  assert.ok(!/testimonial from/i.test(view.contentScript.text), 'no testimonial is invented');
});

test('state normalisation keeps checked tasks and adds new calendar days', () => {
  const state = fresh();
  const raw = JSON.parse(JSON.stringify(state));
  raw.plan.find(p => p.id === 'foundation').tasks[0].done = true;
  raw.content = raw.content.slice(0, 5);
  raw.settings.goal = 4000;

  const next = store.normalize(raw, TODAY);
  assert.equal(next.settings.goal, 4000);
  assert.equal(next.content.length, 30, 'missing calendar days are restored');
  assert.equal(next.plan.find(p => p.id === 'foundation').tasks[0].done, true, 'progress survives a schema change');
  assert.equal(next.offers.length, 5);
});

test('a full compute is serialisable and safe with no data', () => {
  const view = engine.compute(fresh(), TODAY);
  assert.doesNotThrow(() => JSON.stringify(view));
  assert.equal(view.money.mtd, 0);
  assert.equal(view.money.status, 'starting', 'a fresh start is not shamed as cold');
  assert.equal(view.money.goal, 3226, 'first month target is prorated from Day 1');
  assert.equal(view.money.goalFull, 10000);
  assert.equal(view.ranking.bestSellerId, null);
  assert.equal(view.runbook.actions.length, 5);
  assert.equal(view.funnel.hasData, false);
  assert.equal(view.settings.goal, 10000);
});
