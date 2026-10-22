// ─────────────────────────────────────────────────────────────────────────────
// agents.test.js — the crew's contracts.
//   node --test brand-os/test/agents.test.js
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const agents = require('../lib/agents');
const orchestrator = require('../lib/orchestrator');
const store = require('../lib/store');
const kit = require('../lib/kit');

const TODAY = '2026-10-22';
const fresh = () => store.freshState('2026-10-01');

function lead(state, over = {}) {
  state.leads.push({
    id: 'l1', name: 'Maya', handle: '@maya', skill: 'Canva designer, no offer',
    stage: 'deciding', source: 'Comment BRAND', note: '', createdAt: TODAY,
    lastTouch: TODAY, nextActionAt: TODAY, ...over,
  });
  return state;
}

test('every agent declares what it needs and what it does', () => {
  const list = agents.listAgents();
  assert.equal(list.length, 6);
  for (const a of list) {
    assert.ok(a.id && a.name && a.role && a.tag, `${a.id} is missing metadata`);
    assert.ok(Array.isArray(a.inputs));
    assert.equal(typeof agents.BY_ID[a.id].run, 'function');
  }
});

test('offer architect refuses to invent an offer from nothing', () => {
  const out = agents.BY_ID.architect.run(fresh(), TODAY, {});
  assert.equal(out.status, 'blocked');
  assert.equal(out.artifacts.length, 0);
  assert.match(out.blockers[0], /what you can actually do/i);
  assert.equal(out.adopt, undefined, 'a blocked agent must not offer anything to adopt');
});

test('offer architect turns a skill into three priced rungs and an adopt payload', () => {
  const out = agents.BY_ID.architect.run(fresh(), TODAY, {
    skill: 'Canva templates', audience: 'freelance designers', result: 'their first $500 client',
  });
  assert.equal(out.status, 'ok');
  assert.equal(out.artifacts.length, 1);
  const md = out.artifacts[0].content;
  assert.match(md, /I help freelance designers get their first \$500 client/);
  assert.match(md, /\$27/);
  assert.match(md, /\$147/);
  assert.equal(out.adopt.offers.length, 3);
  assert.deepEqual(out.adopt.offers.map(o => o.price), [27, 147, 297]);
  assert.ok(!/guarantee[sd]? \$|you will make/i.test(md), 'no income promise anywhere in the offer');
});

test('content director produces 30 pieces in the plan’s mix with CTA rotation', () => {
  const out = agents.BY_ID.content.run(fresh(), TODAY, {
    offer: 'The Buyable Brand', audience: 'freelance designers', keyword: 'brand',
  });
  assert.equal(out.status, 'ok');
  const calendar = out.artifacts.find(a => a.name === 'calendar.md').content;
  assert.equal((calendar.match(/^\| \d+ \| [ABCDE] —/gm) || []).length, 30);

  const items = out.adopt.content;
  assert.equal(items.length, 30);
  assert.equal(items[0].id, 'c01');
  assert.equal(items[29].id, 'c30');
  assert.ok(items.every(i => i.hook && i.cta), 'every piece has a hook and a CTA');
  assert.ok(!/BRAND\b/.test(calendar) || /Comment BRAND/i.test(calendar), 'keyword is uppercased into CTAs');

  // pillar mix ~ 30/20/20/15/15
  const counts = {};
  for (const row of calendar.match(/^\| \d+ \| ([ABCDE]) —/gm) || []) {
    const k = row.split('|')[2].trim()[0];
    counts[k] = (counts[k] || 0) + 1;
  }
  assert.equal(counts.A, 9);
  assert.equal(counts.C, 6);
  assert.equal(counts.E, 5);

  // no CTA type repeated inside any 7-day window
  const rows = calendar.split('\n').filter(l => /^\| \d+ \| [ABCDE] —/.test(l));
  const typeOf = row => {
    const cta = row.split('|').slice(-2, -1)[0] || '';
    if (/^\s*Comment/i.test(cta)) return 'keyword';
    if (/^\s*Save/i.test(cta)) return 'save';
    if (/^\s*Reply/i.test(cta)) return 'question';
    if (/^\s*Share/i.test(cta)) return 'share';
    return 'link';
  };
  const types = rows.map(typeOf);
  assert.equal(types.length, 30);
  for (let i = 0; i < types.length; i++) {
    const window = types.slice(Math.max(0, i - 2), i);
    assert.ok(!window.includes(types[i]), `CTA "${types[i]}" repeats within 3 days at day ${i + 1}`);
  }
  let maxRun = 0;
  for (let i = 0, run = 1; i < types.length; i++) {
    run = i && types[i] === types[i - 1] ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  assert.equal(maxRun, 1, 'no two consecutive posts use the same ask');
  assert.ok(new Set(types).size >= 4, 'the rotation uses at least four CTA types');
});

test('scripts keep proof bracketed instead of inventing it', () => {
  const out = agents.BY_ID.content.run(fresh(), TODAY, { offer: 'X', audience: 'designers' });
  const scripts = out.artifacts.find(a => a.name === 'scripts.md').content;
  assert.match(scripts, /\[your real screen or number/);
  assert.ok(!/testimonial|screenshot of a buyer/i.test(scripts.replace(/\[your real screen or number[^\]]*\]/g, '')));
});

test('DM closer writes stage-appropriate messages and never invents a lead', () => {
  const state = lead(fresh());
  const one = agents.BY_ID.closer.run(state, TODAY, { leadId: 'l1', mode: 'one' });
  assert.equal(one.status, 'ok');
  assert.match(one.artifacts[0].content, /weekend v1/);
  assert.match(one.artifacts[0].content, /\[your \$27 link\]|tripwire|https?:/);

  const missing = agents.BY_ID.closer.run(fresh(), TODAY, { leadId: 'nope' });
  assert.equal(missing.status, 'blocked');
  assert.match(missing.blockers[0], /Pick a lead/);

  const noneDue = agents.BY_ID.closer.run(fresh(), TODAY, { mode: 'due' });
  assert.equal(noneDue.status, 'partial');
  assert.equal(noneDue.artifacts.length, 0);
  assert.match(noneDue.summary, /post proof/i);
});

test('each lead stage routes to a different message', () => {
  const messages = {};
  for (const stage of ['new', 'deciding', 'selling', 'hot', 'lost']) {
    const s = lead(fresh(), { stage });
    messages[stage] = agents.BY_ID.closer.run(s, TODAY, { leadId: 'l1', mode: 'one' }).artifacts[0].content;
  }
  const unique = new Set(Object.values(messages).map(m => m.slice(0, 120)));
  assert.equal(unique.size, 5, 'every stage must not reuse the same opening');
  assert.match(messages.hot, /Here you go/);
  assert.match(messages.lost, /No pressure/);
});

test('growth analyst refuses to diagnose without data', () => {
  const out = agents.BY_ID.analyst.run(fresh(), TODAY, {});
  assert.equal(out.status, 'partial');
  assert.match(out.artifacts[0].content, /Insufficient data, stated plainly/);
  assert.ok(out.notes.length, 'a partial run explains why');
});

test('growth analyst names the leaking step when numbers exist', () => {
  const state = fresh();
  state.funnel = { views: 2000, comments: 8, dmReplies: 6, clicks: 2, purchases: 1, updated: TODAY, note: '' };
  state.sales.push({ id: 's1', offerId: 'brand', offerName: 'The Buyable Brand', price: 147, units: 1, total: 147, date: '2026-10-20', source: 'DM', note: '' });
  const out = agents.BY_ID.analyst.run(state, TODAY, {});
  assert.equal(out.status, 'ok');
  const md = out.artifacts[0].content;
  assert.match(md, /Leak|leak/);
  assert.match(md, /Three prescriptions/);
  assert.match(md, /What I will not tell you/);
});

test('launch producer builds an arc, not a countdown gimmick', () => {
  const out = agents.BY_ID.launch.run(fresh(), TODAY, { days: '5', price: '97', goal: '8' });
  assert.equal(out.status, 'ok');
  const plan = out.artifacts.find(a => a.name === 'launch.md').content;
  assert.equal((plan.match(/^## Day \d+/gm) || []).length, 5);
  assert.match(plan, /No countdown timers you do not mean/);
  assert.match(plan, /\$97 × 8 = \$776|\$776/);
  assert.equal(out.artifacts.length, 2);
});

test('chief of staff writes a brief from today’s real state', () => {
  const state = lead(fresh());
  const out = agents.BY_ID.operator.run(state, TODAY, {});
  const brief = out.artifacts[0].content;
  assert.match(brief, /The one thing/);
  assert.match(brief, /Maya/);
  assert.match(brief, /\[ \]|- \[x\]/);
});

test('flows are declarative and every referenced agent exists', () => {
  const flows = orchestrator.listFlows();
  assert.ok(flows.length >= 5);
  for (const f of flows) {
    assert.ok(f.agents.length >= 1);
    for (const a of f.agents) assert.ok(agents.BY_ID[a], `${f.id} references unknown agent ${a}`);
  }
});

test('a flow without required inputs is blocked, not guessed', () => {
  const run = orchestrator.runFlow('offer-build', { state: fresh(), today: TODAY, input: {} });
  assert.equal(run.status, 'blocked');
  assert.match(run.blockers[0], /Missing/);
  assert.equal(run.artifacts.length, 0);
});

test('launch kit chains agents and passes artifacts down the line', () => {
  const run = orchestrator.runFlow('launch-kit', {
    state: fresh(), today: TODAY,
    input: { skill: 'Canva templates', audience: 'freelance designers', keyword: 'BRAND', days: '7', price: '97', goal: '10' },
  });
  assert.equal(run.status, 'partial', 'the analyst honestly reports no data yet');
  assert.equal(run.steps.length, 5);
  assert.deepEqual(run.steps.map(s => s.agentId), ['operator', 'architect', 'content', 'launch', 'analyst']);
  const names = run.artifacts.map(a => a.name);
  for (const expected of ['brief.md', 'offer.md', 'calendar.md', 'scripts.md', 'launch.md', 'memo.md']) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
  assert.match(run.artifacts.find(a => a.name === 'calendar.md').content, /freelance designers/);
  assert.equal(run.adopt.offers.length, 3);
  assert.equal(run.adopt.content.length, 30);
});

test('zip writer emits a valid archive (and works without zlib)', () => {
  const buf = kit.zip([
    { name: 'README.md', content: '# kit\n\nhello' },
    { name: 'big.md', content: 'x'.repeat(5000) },
  ]);
  assert.ok(buf instanceof Uint8Array);

  const rd16 = (b, i) => b[i] | (b[i + 1] << 8);
  const rd32 = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;

  assert.equal(String.fromCharCode(buf[0], buf[1]), 'PK');
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (rd32(buf, i) === 0x06054b50) { eocd = i; break; }
  }
  assert.ok(eocd > 0, 'end-of-central-directory record present');
  assert.equal(rd16(buf, eocd + 8), 2, 'two entries');
  assert.equal(rd16(buf, eocd + 10), 2);
  assert.ok(buf.length > 100);
});

test('run history persists artifacts and survives a restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-jobs-'));
  process.env.BRAND_OS_DATA_DIR = dir;
  delete require.cache[require.resolve('../lib/jobs')];
  const jobs = require('../lib/jobs');

  const run = orchestrator.runFlow('daily', { state: fresh(), today: TODAY, input: {} });
  const meta = jobs.saveRun(run);
  assert.equal(meta.status, 'ok');
  assert.equal(meta.files.length, 1);
  assert.equal(jobs.listRuns()[0].id, run.id);
  assert.match(jobs.readArtifact(run.id, 'brief.md'), /Brief/);

  // traversal and unknown names are refused
  assert.throws(() => jobs.readArtifact(run.id, '../state.json'));
  assert.throws(() => jobs.readArtifact(run.id, 'nope.md'));

  delete process.env.BRAND_OS_DATA_DIR;
  fs.rmSync(dir, { recursive: true, force: true });
});
