// ─────────────────────────────────────────────────────────────────────────────
// Buyable Brand OS — client.
//
// One state object from the server, one render function per view. No framework,
// no build, no client-side business rules — the orchestrator decides, this file
// only shows it and sends your edits back.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

let S = null;
// localStorage can throw in sandboxed iframes (preview panes) and private mode.
// Never let that kill the app: fall back to an in-memory map.
const mem = new Map();
const storage = {
  get(key) {
    try { const v = window.localStorage.getItem(key); return v == null && mem.has(key) ? mem.get(key) : v; }
    catch { return mem.has(key) ? mem.get(key) : null; }
  },
  set(key, value) {
    mem.set(key, value);
    try { window.localStorage.setItem(key, value); } catch { /* memory only */ }
  },
};

let tab = storage.get('bb.tab') || 'today';
let calc = null;
let AGENTS = null;
let RUNS = [];
let modalState = null;
let toastTimer = null;

const TABS = [
  { id: 'today', label: 'Today', icon: 'sun' },
  { id: 'offers', label: 'Offers', icon: 'layers' },
  { id: 'content', label: 'Content', icon: 'pen' },
  { id: 'dms', label: 'DMs & leads', icon: 'chat' },
  { id: 'money', label: 'Money & funnel', icon: 'coin' },
  { id: 'plan', label: '90-day plan', icon: 'calendar' },
  { id: 'agents', label: 'Agents', icon: 'bot' },
];

const TITLES = {
  today: ['Today', 'The runbook — highest revenue first'],
  offers: ['Offers', 'The ladder: free → $27 → $147 → $297'],
  content: ['Content', '30 pieces, one cycle, one keyword each'],
  dms: ['DMs & leads', 'Reel → comment → DM → checkout'],
  money: ['Money & funnel', 'The $10k math and where the funnel leaks'],
  plan: ['90-day plan', 'Phase by phase, or it stays a PDF'],
  agents: ['Agents', 'Six agents, five flows — real artifacts, not chat'],
};

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/><path d="M3 17l9 5 9-5"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l11-11a2.5 2.5 0 00-3.5-3.5L4 16v4z"/><path d="M14 6l4 4"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M21 12a8 8 0 01-8 8H8l-5 3 1.4-4.6A8 8 0 1121 12z"/><path d="M8.5 11h7M8.5 14.5h4"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1.1 1.8 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M8 14h2M14 14h2M8 18h2"/></svg>',
  bot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01M9 17h6"/></svg>',
};

// ── helpers ─────────────────────────────────────────────────────────────────
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function money(n, dp = 0) {
  const v = Number(n) || 0;
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
function compact(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1e6) return '$' + (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (Math.abs(v) >= 1e3) return '$' + (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k';
  return money(v);
}
function niceDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00+03:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function shortDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00+03:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function statusPill(status) {
  const map = {
    idea: ['dim', 'Idea'], building: ['blue', 'Building'], live: ['green', 'Live'], proven: ['gold', 'Proven'],
    planned: ['dim', 'Planned'], filmed: ['blue', 'Filmed'], posted: ['green', 'Posted'],
    new: ['blue', 'New reply'], deciding: ['gold', 'Deciding'], selling: ['violet', 'Selling'],
    hot: ['green', 'Link sent'], bought: ['gold', 'Bought'], lost: ['dim', 'Lost'],
  };
  const [color, label] = map[status] || ['dim', status];
  return `<span class="pill ${color}">${esc(label)}</span>`;
}
function fillLinks(text) {
  const map = {
    handle: S.settings.handle || '@yourname',
    name: S.settings.name || '[Your name]',
    mapLink: S.settings.mapLink || '[your map link]',
    tripwireLink: S.settings.tripwireLink || '[your $27 link]',
    coreLink: S.settings.coreLink || '[your $147 link]',
    reviewLink: S.settings.reviewLink || '[your $297 link]',
  };
  return String(text).replace(/\{\{(\w+)\}\}/g, (m, k) => (map[k] != null ? map[k] : m));
}
function toast(msg, err = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show${err ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}
async function api(path, body) {
  const res = await fetch(path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : { method: 'GET' });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function apply(data) {
  if (data && data.state) {
    S = data.state;
    if (!calc) initCalc();
    render();
  }
}
function nextTickToast(msg) { setTimeout(() => toast(msg), 30); }

// ── calculator (local, persisted) ───────────────────────────────────────────
function offerPrice(id, fallback) {
  const o = S && S.offers.find(x => x.id === id);
  return Number(o && o.price) || fallback;
}
function initCalc() {
  let stored = null;
  try { stored = JSON.parse(storage.get('bb.calc') || 'null'); } catch { stored = null; }
  calc = stored || {
    t20: 20, tP: offerPrice('weekend', 27),
    c40: 40, cP: offerPrice('brand', 147),
    u8: 8, uP: offerPrice('review', 297),
  };
}
function calcSave() { storage.set('bb.calc', JSON.stringify(calc)); }
function calcRevenue() {
  return (Number(calc.t20) || 0) * (Number(calc.tP) || 0) +
    (Number(calc.c40) || 0) * (Number(calc.cP) || 0) +
    (Number(calc.u8) || 0) * (Number(calc.uP) || 0);
}

// ── shell ───────────────────────────────────────────────────────────────────
function render() {
  if (!S) return;
  const [title, sub] = TITLES[tab] || TITLES.today;
  $('#viewTitle').textContent = title;
  $('#viewSub').textContent = sub;
  $('#dayChip').textContent = `Day ${S.dayNumber} · ${S.phaseLabel}`;
  $('#goalChip').textContent = `${money(S.money.mtd)} / ${compact(S.money.goal)} this month`;
  $('#footDay').textContent = `${S.prettyToday} · cycle ${S.cycle}`;

  $('#nav').innerHTML = TABS.map(t => {
    const badge = t.id === 'dms' && S.leads.due > 0
      ? `<span class="badge">${S.leads.due}</span>` : '';
    return `<a href="#${t.id}" class="${t.id === tab ? 'active' : ''}" data-act="tab" data-tab="${t.id}">
      <span class="svg">${ICONS[t.icon]}</span><span>${t.label}</span>${badge}</a>`;
  }).join('');

  const g = S.money;
  $('#railGoal').innerHTML = `
    <div class="rg-top"><b>${money(g.mtd)}</b><span>of ${compact(g.goal)}</span></div>
    <div class="bar"><i style="width:${Math.min(100, g.progress)}%"></i></div>
    <div class="bar-legend"><span>${g.progress}% of month target</span><span>${g.daysLeft}d left</span></div>
    ${g.prorated ? `<p class="rail-note" style="margin:6px 0 0">First month prorated from Day 1. Run-rate target is ${money(g.goalFull)}/mo.</p>` : ''}`;

  const views = { today: viewToday, offers: viewOffers, content: viewContent, dms: viewDms, money: viewMoney, plan: viewPlan, agents: viewAgents };
  const shell = document.getElementById('shell');
  if (shell) shell.remove();
  $('#view').innerHTML = (views[tab] || viewToday)();
}

function setTab(next) {
  tab = next;
  storage.set('bb.tab', tab);
  document.body.classList.remove('rail-open');
  $('#rail').classList.remove('open');
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── view: today ─────────────────────────────────────────────────────────────
function viewToday() {
  const r = S.runbook, m = S.money, cl = S.checklist, c = S.content.today;
  const focus = r.focus;
  const mapOffer = S.offers.find(o => o.id === 'map');
  const setupDone = {
    profile: Boolean(S.settings.handle && S.settings.handle !== '@yourname' && S.settings.name && S.settings.name !== '[Your name]'),
    map: Boolean(mapOffer && mapOffer.status !== 'idea'),
    post: S.content.stats.posted > 0,
  };
  const setupCount = Object.values(setupDone).filter(Boolean).length;
  const ring = `background: conic-gradient(var(--gold) ${Math.max(0, Math.min(100, cl.progress)) * 3.6}deg, #23232b 0)`;

  const pieceCard = c ? `
    <section class="card">
      <div class="card-head">
        <div>
          <p class="eyebrow plain">Today’s piece · ${esc(c.formatLabel)}</p>
          <h2 style="font-size:17px">${esc(c.hook)}</h2>
        </div>
        ${statusPill(c.status)}
      </div>
      <div class="tagline-row" style="margin-bottom:12px">
        <span class="pill ${c.pillarColor}">${esc(c.pillar)} · ${esc(c.pillarLabel)}</span>
        <span class="pill dim">${esc(c.cta)}</span>
      </div>
      <div class="hero-actions">
        <button class="btn btn-sm" data-act="content-open" data-id="${c.id}">Open piece</button>
        <button class="btn btn-sm btn-ghost" data-act="script-open" data-id="today">Script &amp; caption</button>
        ${c.posted
          ? `<button class="btn btn-sm btn-ghost" data-act="content-unpost" data-id="${c.id}">Undo posted</button>`
          : `<button class="btn btn-sm btn-primary" data-act="content-post" data-id="${c.id}">Mark posted</button>`}
      </div>
    </section>` : `
    <section class="card">
      <p class="eyebrow plain">Rest day</p>
      <h2 style="font-size:17px">No piece scheduled today</h2>
      <p class="muted small">Repost your strongest proof, or pull tomorrow’s piece forward.</p>
    </section>`;

  return `
  <section class="hero card">
    <div class="hero-main">
      <p class="eyebrow">Day ${S.dayNumber} of 90 · ${esc(S.prettyToday)} · ${esc(S.phaseLabel)}</p>
      <h2 class="hero-title">${esc(r.headline)}</h2>
      <p class="hero-sub">${esc(r.summary)}</p>
      ${focus ? `
        <div class="hero-focus">
          <span class="tag">First move · ${focus.minutes} min</span>
          <p>${esc(focus.detail)}</p>
          <p class="why">${esc(focus.why)}</p>
        </div>` : ''}
      <div class="hero-actions">
        ${focus ? `<button class="btn btn-primary" data-act="tab" data-tab="${focus.tab}">${esc(focus.cta)} →</button>` : ''}
        ${c && !c.posted ? `<button class="btn" data-act="content-post" data-id="${c.id}">Mark today posted</button>` : ''}
        <button class="btn btn-ghost" data-act="run-flow" data-id="daily">Write the brief</button>
        <button class="btn btn-ghost" data-act="orchestrate">Re-orchestrate</button>
      </div>
    </div>
    <div class="hero-side">
      <div class="ring" style="${ring}"><div class="ring-in"><b>${cl.done}/${cl.total}</b><span>done today</span></div></div>
      <div class="mini-stats">
        <div><b>${m.mtd ? compact(m.mtd) : '$0'}</b><span>this month</span></div>
        <div><b>${m.units30}</b><span>units / 30d</span></div>
        <div><b>${S.streak}</b><span>day streak</span></div>
      </div>
    </div>
  </section>

  ${setupCount < 3 ? `
  <section class="card setup-card">
    <div class="card-head">
      <div><p class="eyebrow">First run</p><h2>${3 - setupCount} ${3 - setupCount === 1 ? 'thing' : 'things'} before the first sale</h2>
        <p class="sub">No money, no audience, no finished course required. Do them in this order.</p></div>
      <span class="pill gold">${setupCount}/3 done</span>
    </div>
    <div class="steps">
      <div class="step ${setupDone.profile ? 'done' : ''}">
        <div class="step-top"><span class="step-n">1</span>${setupDone.profile ? '<span class="pill green">Done</span>' : '<span class="pill dim">2 min</span>'}</div>
        <b>Set your handle &amp; links</b>
        <p>Every script and caption fills these in. Without them a DM ends in “link?”.</p>
        <button class="btn btn-sm ${setupDone.profile ? 'btn-ghost' : 'btn-primary'}" data-act="settings">${setupDone.profile ? 'Review setup' : 'Open setup'}</button>
      </div>
      <div class="step ${setupDone.map ? 'done' : ''}">
        <div class="step-top"><span class="step-n">2</span>${setupDone.map ? '<span class="pill green">Done</span>' : '<span class="pill dim">Weekend</span>'}</div>
        <b>Publish the free Offer Map</b>
        <p>Seven lines on one page. It names a stranger’s offer, which is why they reply.</p>
        <button class="btn btn-sm ${setupDone.map ? 'btn-ghost' : 'btn-primary'}" data-act="tab" data-tab="offers">${setupDone.map ? 'See the ladder' : 'Open the ladder'}</button>
      </div>
      <div class="step ${setupDone.post ? 'done' : ''}">
        <div class="step-top"><span class="step-n">3</span>${setupDone.post ? '<span class="pill green">Done</span>' : '<span class="pill dim">35 min</span>'}</div>
        <b>Post your Day 1 piece</b>
        <p>The build-in-public post, even at $0 revenue. The script is already written.</p>
        <button class="btn btn-sm ${setupDone.post ? 'btn-ghost' : 'btn-primary'}" data-act="tab" data-tab="content">${setupDone.post ? 'See the calendar' : "Open today’s piece"}</button>
      </div>
    </div>
  </section>` : ''}

  <div class="grid-3">
    ${pieceCard}

    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">The month</p><h2 style="font-size:17px">${money(m.mtd)} booked</h2></div>
        <span class="pill ${m.status === 'ahead' ? 'green' : m.status === 'cold' ? 'red' : m.status === 'starting' ? 'dim' : 'gold'}">${esc(m.status)}</span></div>
      <div class="bar-wrap">
        <div class="bar"><i style="width:${Math.min(100, m.progress)}%"></i>
          <span class="pace-mark" style="left:${Math.min(99, (m.paceTarget / m.goal) * 100)}%"></span>
        </div>
        <div class="bar-legend"><span>${m.progress}% of ${compact(m.goal)}</span><span>pace ${compact(m.paceTarget)}</span></div>
        ${m.prorated ? `<p class="tiny dim" style="margin:7px 0 0">Month target is prorated from your Day 1. The run-rate target is ${money(m.goalFull)}/month.</p>` : ''}
      </div>
      <div class="hr"></div>
      <div class="kv"><span>Projected month-end</span><span>${money(m.projected)}</span></div>
      <div class="kv"><span>Needed per day</span><span>${money(m.requiredPerDay, m.requiredPerDay % 1 ? 2 : 0)}</span></div>
      <div class="kv"><span>Run-rate target</span><span>${money(m.goalFull)}/mo</span></div>
      <div class="hero-actions" style="margin-top:12px">
        <button class="btn btn-sm" data-act="sale-open" data-offer="brand">Log a sale</button>
        <button class="btn btn-sm btn-ghost" data-act="tab" data-tab="money">Open the math</button>
      </div>
    </section>

    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Best seller</p>
        <h2 style="font-size:17px">${S.ranking.bestSellerName ? esc(S.ranking.bestSellerName) : 'No sales yet'}</h2></div>
        ${S.ranking.bestSellerName ? '<span class="pill gold">Rank 1</span>' : '<span class="pill dim">Open</span>'}
      </div>
      ${S.ranking.bestSellerName ? `
        <div class="kv"><span>Revenue</span><span>${money(S.ranking.offers[0].revenue)}</span></div>
        <div class="kv"><span>Units</span><span>${S.ranking.offers[0].units}</span></div>
        <div class="kv"><span>Share of revenue</span><span>${S.ranking.offers[0].share}%</span></div>
        <div class="score" style="margin-top:12px"><b>${S.ranking.offers[0].score}/100</b>
          <div class="bar"><i style="width:${S.ranking.offers[0].score}%"></i></div></div>
      ` : `
        <p class="muted small">The leaderboard fills the moment you log the first sale. Until then the job is the $27 yes.</p>
        <div class="hero-actions" style="margin-top:12px">
          <button class="btn btn-sm" data-act="sale-open" data-offer="weekend">Log a sale</button>
          <button class="btn btn-sm btn-ghost" data-act="tab" data-tab="offers">See the ladder</button>
        </div>
      `}
    </section>
  </div>

  <div class="grid-2">
    <section class="card">
      <div class="card-head">
        <div><p class="eyebrow plain">The daily six</p><h2 style="font-size:17px">Today’s checklist</h2></div>
        <span class="pill ${cl.complete ? 'green' : 'gold'}">${cl.done}/${cl.total}</span>
      </div>
      <div class="list">
        ${cl.items.map(item => `
          <div class="row">
            <button class="check ${item.done ? 'on' : ''}" data-act="checkin" data-id="${item.id}" data-done="${item.done ? '0' : '1'}" aria-label="Toggle">✓</button>
            <div class="grow">
              <div class="r-title ${item.done ? 'done-text' : ''}">${esc(item.label)}</div>
              <div class="r-sub">${esc(item.hint)}</div>
            </div>
            <button class="btn btn-sm btn-ghost" data-act="tab" data-tab="${item.tab}">Open</button>
          </div>`).join('')}
      </div>
      <form data-form="checkin-note" style="margin-top:12px">
        <div class="field" style="margin:0">
          <label>Journal — one honest line (optional)</label>
          <input name="note" value="${esc(cl.note)}" placeholder="What worked, what stalled, what you will do differently" maxlength="500" />
        </div>
      </form>
    </section>

    <section class="card">
      <div class="card-head">
        <div><p class="eyebrow plain">Runbook</p><h2 style="font-size:17px">Everything, in order</h2></div>
        <span class="pill dim">${r.actions.length} moves</span>
      </div>
      ${r.actions.map((a, i) => `
        <div class="action-row ${i === 0 ? 'first' : ''}">
          <span class="priority">${i + 1}</span>
          <div class="grow" style="min-width:0">
            <div class="r-title">${esc(a.title)}</div>
            <div class="r-sub">${esc(a.detail)}</div>
            <div class="r-sub" style="color:var(--dim2)">${esc(a.why)}</div>
          </div>
          <div style="text-align:right">
            <div class="r-meta" style="margin-bottom:4px">${a.minutes} min</div>
            <button class="btn btn-sm" data-act="tab" data-tab="${a.tab}">Open</button>
          </div>
        </div>`).join('')}
    </section>
  </div>

  ${c ? `
  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow plain">Ready to film</p><h2 style="font-size:17px">Today’s script</h2>
        <p class="sub">Structure + caption. Bracketed lines are yours to fill with real numbers.</p></div>
      <button class="btn btn-sm" data-act="copy" data-copy-target="today-script">Copy script</button>
    </div>
    <div class="script" id="today-script">${esc(S.contentScript.text)}</div>
    <div class="hr"></div>
    <p class="eyebrow plain">Caption</p>
    <div class="script" id="today-caption" style="max-height:180px">${esc(S.contentScript.caption.replace(/\{\{handle\}\}/g, S.settings.handle || '@yourname'))}</div>
  </section>` : ''}

  <p class="note">${esc(S.rules[0])} ${esc(S.rules[3])}</p>
  `;
}

// ── view: offers ────────────────────────────────────────────────────────────
function viewOffers() {
  const rows = S.ranking.offers;
  return `
  <div class="stat-grid">
    <div class="stat gold"><div class="k">Revenue, all time</div><div class="v">${money(S.ranking.totalRev)}</div><div class="n">${S.ranking.totalUnits} units sold</div></div>
    <div class="stat"><div class="k">Live offers</div><div class="v">${S.ranking.live}<small>/ ${rows.length}</small></div><div class="n">${S.ranking.priced} priced</div></div>
    <div class="stat"><div class="k">Best seller</div><div class="v" style="font-size:18px">${S.ranking.bestSellerName ? esc(S.ranking.bestSellerName) : '—'}</div><div class="n">Ranked by revenue, units and momentum</div></div>
    <div class="stat"><div class="k">Next money move</div><div class="v" style="font-size:15px;line-height:1.35">${esc(S.offerMove.title)}</div><div class="n">${S.offerMove.minutes} min</div></div>
  </div>

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">The ladder</p><h2>Free → $27 → $147 → $297</h2>
        <p class="sub">${esc(S.bio.mechanism)} The order is the strategy — most beginners run it backwards.</p></div>
      <button class="btn btn-sm" data-act="offer-open">+ Add offer</button>
    </div>
    <div class="ladder">
      ${rows.map(o => `
        <article class="offer ${o.isBest ? 'is-best' : ''}">
          <div class="offer-left">
            <div class="offer-price"><small>${esc(o.layer)}</small>${Number(o.price) === 0 ? 'Free' : '$' + Number(o.price).toLocaleString('en-US')}</div>
            ${statusPill(o.status)}
            ${o.isBest ? '<span class="pill gold">★ Best seller</span>' : ''}
          </div>
          <div>
            <div class="offer-name">${esc(o.name)}</div>
            <p class="offer-promise">${esc(o.promise)}</p>
            <div class="offer-meta">
              <span><b>${o.units}</b> units</span>
              <span><b>${money(o.revenue)}</b> revenue</span>
              <span><b>${o.units14}</b> in 14d ${o.trend === 'up' ? '↑' : o.trend === 'down' ? '↓' : ''}</span>
              <span>${esc(o.role)}</span>
            </div>
            <p class="small dim" style="margin:9px 0 0">Next: ${esc(o.next)}</p>
          </div>
          <div class="offer-right">
            <div>
              <div class="score"><b>${o.score}/100</b><div class="bar"><i style="width:${o.score}%"></i></div></div>
              <p class="tiny dim" style="margin:5px 0 0">${esc(o.costNote || '')}</p>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-sm" data-act="sale-open" data-offer="${o.id}">Log sale</button>
              <button class="btn btn-sm btn-ghost" data-act="offer-open" data-id="${o.id}">Edit</button>
            </div>
          </div>
        </article>`).join('')}
    </div>
  </section>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Leaderboard</p><h2 style="font-size:18px">What is actually selling</h2></div></div>
      <table class="rank-table">
        <thead><tr><th>#</th><th>Offer</th><th class="num">Units</th><th class="num hide-sm">Revenue</th><th class="num hide-sm">14d</th><th class="num">Score</th></tr></thead>
        <tbody>
          ${rows.map((o, i) => `
            <tr>
              <td><span class="rank-badge ${i === 0 && o.isBest ? 'first' : ''}">${i + 1}</span></td>
              <td>${esc(o.name)}<div class="tiny dim">${esc(o.layer)}</div></td>
              <td class="num">${o.units}</td>
              <td class="num hide-sm">${money(o.revenue)}</td>
              <td class="num hide-sm">${o.units14} ${o.trend === 'up' ? '↑' : o.trend === 'down' ? '↓' : '·'}</td>
              <td class="num">${o.score}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <p class="note" style="margin-top:12px">Score = 50 pts revenue share + 20 pts units + 20 pts momentum (last 14 days) + 10 pts for being live or proven. It is a reading, not a valuation.</p>
    </section>

    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Pricing</p><h2 style="font-size:18px">The ladder, priced on purpose</h2></div></div>
      <div class="kv"><span>Lead magnet — Buyable Offer Map</span><span>Free</span></div>
      <div class="kv"><span>Tripwire — First Product in a Weekend</span><span>$27</span></div>
      <div class="kv"><span>Core — The Buyable Brand</span><span>$97 → $147</span></div>
      <div class="kv"><span>Upsell — Offer + Bio Review</span><span>$297</span></div>
      <div class="kv"><span>Later — Inner Circle</span><span>$497</span></div>
      <div class="hr"></div>
      <p class="eyebrow plain">The guarantee</p>
      <p class="small" style="margin:0;color:var(--dim)">${esc(S.bio.guarantee)}</p>
      <div class="hr"></div>
      <p class="eyebrow plain">Launch sequence</p>
      <ol class="small" style="margin:0;padding-left:18px;color:var(--dim);line-height:1.7">
        <li>Give the Map away for 7–10 days while you post.</li>
        <li>Open the $27 kit. Sell 10. Ask every buyer what confused them.</li>
        <li>Open the core at $97 for 14 days.</li>
        <li>Raise to $147.</li>
        <li>Add the $297 review only when DMs outpace you.</li>
      </ol>
    </section>
  </div>`;
}

// ── view: content ───────────────────────────────────────────────────────────
function viewContent() {
  const c = S.content, st = c.stats;
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return `
  <div class="stat-grid">
    <div class="stat gold"><div class="k">Posted this cycle</div><div class="v">${st.posted}<small>/ ${st.total}</small></div>
      <div class="bar" style="margin-top:8px"><i style="width:${(st.posted / st.total) * 100}%"></i></div></div>
    <div class="stat"><div class="k">Filmed, not posted</div><div class="v">${st.filmed}</div><div class="n">Batch on Sunday, post all week</div></div>
    <div class="stat ${st.due > 2 ? 'red' : ''}"><div class="k">Due / behind</div><div class="v">${st.due}</div><div class="n">Scheduled on or before today</div></div>
    <div class="stat"><div class="k">Cycle</div><div class="v">${c.cycle}</div><div class="n">Started ${shortDate(c.cycleStart)} · day ${c.dayNumber}</div></div>
  </div>

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">30-day calendar</p><h2>One piece a day, one keyword each</h2>
        <p class="sub">Instagram first; the Reel and the carousel cross-post to Facebook the same day. Click any cell for the script.</p></div>
      <div class="legend">
        <span><i class="dot" style="background:var(--green)"></i> posted</span>
        <span><i class="dot" style="background:var(--blue)"></i> filmed</span>
        <span><i class="dot" style="background:var(--red)"></i> missed</span>
      </div>
    </div>
    <div class="cal-scroll">
      <div class="cal-head">${days.map(d => `<span>${d}</span>`).join('')}</div>
      <div class="cal">
        ${c.items.map(item => {
          const missed = item.isPast && !item.posted ? ' missed' : '';
          return `<button class="cal-cell ${item.isToday ? 'today' : ''} ${item.posted ? 'posted' : item.status === 'filmed' ? 'filmed' : missed}"
                    data-act="content-open" data-id="${item.id}" title="${esc(item.hook)}">
            <div class="cal-top">
              <span class="cal-day">D${item.dayOfCycle}</span>
              <span class="cal-date">${shortDate(item.date)}</span>
            </div>
            <span class="cal-fmt">${esc(item.formatLabel)}</span>
            <span class="cal-hook">${esc(item.hook)}</span>
            <span class="cal-foot">
              <span class="cal-pillar" style="color:var(--${item.pillarColor})">${esc(item.pillar)} · ${esc(item.pillarLabel)}</span>
              ${item.posted ? '<span class="pill green" style="padding:1px 5px;font-size:8.5px">✓</span>' : ''}
            </span>
          </button>`;
        }).join('')}
      </div>
    </div>
  </section>

  ${S.contentScript ? `
  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Today</p><h2 style="font-size:18px">${esc(S.content.today ? S.content.today.formatLabel : '')} script</h2></div>
        <button class="btn btn-sm" data-act="script-open" data-id="today">Copy</button></div>
      <div class="script" style="max-height:340px">${esc(S.contentScript.text)}</div>
    </section>
    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Caption + CTA</p><h2 style="font-size:18px">Post copy</h2></div>
        <button class="btn btn-sm" data-act="copy" data-copy-target="caption-block">Copy caption</button></div>
      <div class="script" id="caption-block" style="max-height:220px">${esc(S.contentScript.caption.replace(/\{\{handle\}\}/g, S.settings.handle || '@yourname'))}</div>
      <p class="eyebrow plain" style="margin-top:14px">The caption rule</p>
      <p class="small muted" style="margin:0">Say the keyword twice — once mid-Reel, once on screen — plus in the caption and your pinned comment. One keyword per Reel, or you drop conversations.</p>
    </section>
  </div>` : ''}

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Pillars</p><h2 style="font-size:18px">The mix that creates buyers</h2></div></div>
      ${st.byPillar.map(p => `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
            <span><b style="color:var(--${p.color})">${p.key}</b> ${esc(p.label)}</span>
            <span class="dim">${p.posted}/${p.planned} posted · target ${p.share}%</span>
          </div>
          <div class="bar"><i style="width:${(p.posted / Math.max(1, p.planned)) * 100}%;background:var(--${p.color})"></i></div>
        </div>`).join('')}
      <p class="note" style="margin-top:14px">Never go a full week without a C (proof) and an E (ask). Authority without an ask is a diary. An ask without proof is an ad.</p>
    </section>

    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Cadence</p><h2 style="font-size:18px">The posting day</h2></div></div>
      ${S.cadence.map(x => `
        <div class="row">
          <span class="r-meta" style="width:58px">${esc(x.time)}</span>
          <div class="grow"><div class="r-title">${esc(x.label)}</div><div class="r-sub">${esc(x.detail)}</div></div>
        </div>`).join('')}
      <div class="hr"></div>
      <p class="eyebrow plain">Sunday batch</p>
      <p class="small muted" style="margin:0">Pick 5 hooks → write 5 eight-line scripts → film in one outfit in one location → edit with captions burned in → write the two carousels last.</p>
    </section>
  </div>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Keywords</p><h2 style="font-size:18px">One word, one job</h2></div></div>
      <table class="rank-table">
        <thead><tr><th>Keyword</th><th>Used on</th><th class="hide-sm">Sends</th><th>Goal</th></tr></thead>
        <tbody>${S.keywords.map(k => `
          <tr><td class="num" style="color:var(--gold2)">${esc(k.keyword)}</td><td>${esc(k.usedOn)}</td>
          <td class="hide-sm dim">${esc(k.sends)}</td><td class="dim">${esc(k.goal)}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="hr"></div>
      <p class="eyebrow plain">Bio — pick one and run it 90 days</p>
      ${S.bioOptions.map(b => `
        <div style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px">
            <span class="small"><b>${esc(b.label)}</b></span>
            <button class="btn btn-sm btn-ghost" data-act="copy-text" data-text="${esc(b.text)}">Copy</button>
          </div>
          <div class="script" style="max-height:110px;font-size:11px">${esc(b.text)}</div>
        </div>`).join('')}
    </section>

    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Hook bank</p><h2 style="font-size:18px">20 hooks, rewrite in your voice</h2></div></div>
      <div style="max-height:520px;overflow:auto;display:flex;flex-direction:column">
        ${S.hooks.map((h, i) => `
          <div class="row" style="align-items:center">
            <span class="r-meta" style="width:22px">${String(i + 1).padStart(2, '0')}</span>
            <div class="grow"><div class="r-title" style="font-weight:400;font-size:12.5px">${esc(h)}</div></div>
            <button class="btn btn-sm btn-ghost" data-act="copy-text" data-text="${esc(h)}">Copy</button>
          </div>`).join('')}
      </div>
    </section>
  </div>`;
}

// ── view: dms ───────────────────────────────────────────────────────────────
function viewDms() {
  const L = S.leads;
  return `
  <div class="stat-grid">
    <div class="stat gold"><div class="k">Active conversations</div><div class="v">${L.active}</div><div class="n">Not bought, not lost</div></div>
    <div class="stat ${L.due ? 'red' : 'green'}"><div class="k">Due now</div><div class="v">${L.due}</div><div class="n">${L.due ? 'Warm leads go cold in 72 hours' : 'Inbox is clear'}</div></div>
    <div class="stat"><div class="k">Bought</div><div class="v">${L.bought}</div><div class="n">Onboard personally, ask for the offer screenshot</div></div>
    <div class="stat"><div class="k">Next DM move</div><div class="v" style="font-size:15px;line-height:1.35">${esc(S.offerMove.title)}</div><div class="n">${esc(S.offerMove.minutes + ' min')}</div></div>
  </div>

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">Pipeline</p><h2>Reply → deciding → selling → link → bought</h2>
        <p class="sub">Automation opens. You close. After message 2, type like a person — voice notes beat paragraphs.</p></div>
      <button class="btn btn-sm btn-primary" data-act="lead-open">+ Add lead</button>
    </div>
    <div class="kanban">
      ${L.stages.map(stage => {
        const cards = L.leads.filter(l => l.stage === stage.key);
        return `<div class="kcol">
          <div class="kcol-head"><h4 style="color:var(--${stage.color})">${esc(stage.label)}</h4><span>${cards.length}</span></div>
          ${cards.length ? cards.map(l => `
            <div class="kcard ${l.due ? 'due' : ''}">
              <div class="kcard-name"><span>${esc(l.name)}</span>${l.due ? '<span class="pill red" style="padding:1px 5px;font-size:8.5px">due</span>' : ''}</div>
              ${l.handle ? `<div class="kcard-handle">${esc(l.handle)}</div>` : ''}
              ${l.skill ? `<div class="kcard-skill">${esc(l.skill)}</div>` : ''}
              <div class="tiny dim">${esc(l.source || '')}${l.nextActionAt ? ' · next ' + shortDate(l.nextActionAt) : ''}</div>
              ${l.note ? `<div class="tiny" style="color:var(--dim);margin-top:5px;line-height:1.45">${esc(l.note)}</div>` : ''}
              <div class="kcard-foot">
                <select class="btn btn-sm" data-act="lead-stage" data-id="${l.id}" style="padding:3px 6px">
                  ${L.stages.map(o => `<option value="${o.key}" ${o.key === l.stage ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
                </select>
                <button class="btn btn-sm btn-ghost" data-act="lead-open" data-id="${l.id}">Edit</button>
                <button class="btn btn-sm btn-primary" data-act="sale-open" data-offer="brand" data-lead="${esc(l.name)}">Sale</button>
              </div>
            </div>`).join('') : `<div class="kempty">${esc(stage.hint)}</div>`}
        </div>`;
      }).join('')}
    </div>
    <p class="note" style="margin-top:14px">Moving a card never sends a message. Open the script, copy it, send it from Instagram yourself — then move the card.</p>
  </section>

  <section class="card">
    <div class="card-head"><div><p class="eyebrow plain">Script library</p><h2 style="font-size:18px">The DM that closes without begging</h2>
      <p class="sub">Links fill from Setup. Nothing sends itself.</p></div></div>
    <div class="grid-2">
      ${S.scripts.map(sc => `
        <div class="script-card">
          <div class="sc-head">
            <div><h4>${esc(sc.title)}</h4><div class="tiny dim">${esc(sc.when)}</div></div>
            <button class="btn btn-sm" data-act="script-copy" data-id="${sc.id}">Copy</button>
          </div>
          <div class="script" style="max-height:260px">${esc(fillLinks(sc.body))}</div>
        </div>`).join('')}
    </div>
  </section>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Email</p><h2 style="font-size:18px">7 emails, 10 days</h2></div></div>
      <table class="rank-table">
        <thead><tr><th>Day</th><th>Subject</th><th class="hide-sm">Job</th></tr></thead>
        <tbody>${S.emails.map(e => `
          <tr><td class="num">${e.day}</td><td>${esc(e.subject)}</td><td class="hide-sm dim">${esc(e.job)}</td></tr>`).join('')}
        </tbody>
      </table>
    </section>
    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Rules of the DM</p><h2 style="font-size:18px">Send one link</h2></div></div>
      <div class="list">
        <div class="row"><span class="priority">1</span><div class="grow"><div class="r-title">One clarifying question, max</div><div class="r-sub">SELLING or DECIDING. Then recommend one product.</div></div></div>
        <div class="row"><span class="priority">2</span><div class="grow"><div class="r-title">Never dump PDFs</div><div class="r-sub">The Map then one checkout link. That is the whole funnel.</div></div></div>
        <div class="row"><span class="priority">3</span><div class="grow"><div class="r-title">Reply within hours, not days</div><div class="r-sub">Warm intent decays faster than reach.</div></div></div>
        <div class="row"><span class="priority">4</span><div class="grow"><div class="r-title">After purchase: Module 0</div><div class="r-sub">Ask for their one-sentence offer — that is content and proof, with permission.</div></div></div>
      </div>
      <div class="callout" style="margin-top:12px">${esc(S.bio.guarantee)}</div>
    </section>
  </div>`;
}

// ── view: money ─────────────────────────────────────────────────────────────
function viewMoney() {
  const m = S.money, f = S.funnel;
  return `
  <div class="stat-grid">
    <div class="stat gold"><div class="k">This month</div><div class="v">${money(m.mtd)}</div>
      <div class="n">${m.progress}% of ${money(m.goal)} · ${m.daysLeft} days left</div></div>
    <div class="stat"><div class="k">Last 30 days</div><div class="v">${money(m.last30)}</div>
      <div class="n">${m.trend == null ? 'No prior 30 days to compare' : (m.trend >= 0 ? '+' : '') + m.trend + '% vs prior 30'}</div></div>
    <div class="stat ${m.projected >= m.goal ? 'green' : ''}"><div class="k">Projected month-end</div><div class="v">${money(m.projected)}</div>
      <div class="n">On this pace, not on hope</div></div>
    <div class="stat ${m.paceGap < 0 ? 'red' : 'green'}"><div class="k">Vs pace</div><div class="v">${m.paceGap >= 0 ? '+' : ''}${money(m.paceGap)}</div>
      <div class="n">Pace target ${money(m.paceTarget)} by day ${m.dayOfMonth}</div></div>
  </div>

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">The month</p><h2>${money(m.mtd)} of ${money(m.goal)}</h2>
        <p class="sub">${m.prorated ? `First month is prorated from your Day 1 — the ${money(m.goalFull)}/month run-rate is the real target. ` : ''}${m.requiredPerDay > 0 ? `${money(m.requiredPerDay, 2)} per day for the rest of the month to hit the month target.` : 'Month target hit. Raise the number or raise the price.'}</p></div>
      <span class="pill ${m.status === 'ahead' ? 'green' : m.status === 'cold' ? 'red' : m.status === 'starting' ? 'dim' : 'gold'}">${esc(m.status)}</span>
    </div>
    <div class="bar-wrap">
      <div class="bar" style="height:10px"><i style="width:${Math.min(100, m.progress)}%"></i>
        <span class="pace-mark" style="left:${Math.min(99, (m.paceTarget / m.goal) * 100)}%"></span>
      </div>
      <div class="bar-legend"><span>${money(m.mtd)} booked</span><span>white tick = where you should be today</span><span>${money(m.goal)} month target</span></div>
    </div>
    ${m.prorated ? `<p class="note" style="margin-top:10px">You started on ${esc(S.settings.startDate)}, so this month’s target is prorated to ${money(m.goal)} instead of the full ${money(m.goalFull)}. The run-rate target is unchanged.</p>` : ''}
    <div class="hr"></div>
    <div class="grid-3">
      <div><p class="eyebrow plain">Revenue by offer</p>
        ${m.byOffer.length ? m.byOffer.map(o => `
          <div class="kv"><span>${esc(o.name)}</span><span>${money(o.revenue)} · ${o.units}u</span></div>`).join('')
        : '<p class="small dim" style="margin:0">No sales logged yet. The first $27 is the whole game this week.</p>'}
      </div>
      <div><p class="eyebrow plain">This week</p>
        <div class="kv"><span>Revenue</span><span>${money(m.last7)}</span></div>
        <div class="kv"><span>Units</span><span>${m.units30} / 30d</span></div>
        <div class="kv"><span>Best seller</span><span>${S.ranking.bestSellerName ? esc(S.ranking.bestSellerName) : '—'}</span></div>
        <div class="kv"><span>Live offers</span><span>${S.ranking.live}</span></div>
      </div>
      <div><p class="eyebrow plain">Do the math out loud</p>
        <p class="small muted" style="margin:0">${money(m.goalFull)} a month is not a vibe. At $147 it is ${Math.ceil(m.goalFull / 147)} sales. At the ladder mix it is fewer. Pick the path, then pick today’s move.</p>
        <div style="margin-top:10px"><button class="btn btn-sm" data-act="tab" data-tab="offers">Open the ladder</button></div>
      </div>
    </div>
  </section>

  <div class="grid-3">
    ${m.paths.map(p => `
      <section class="card">
        <p class="eyebrow plain">${esc(p.id === 'core' ? 'Path 1' : p.id === 'ladder' ? 'Path 2' : 'Path 3')}</p>
        <h2 style="font-size:17px">${esc(p.label)}</h2>
        <p class="serif" style="font-size:20px;color:var(--gold2);margin:10px 0 4px">${esc(p.sales)}</p>
        <p class="small muted" style="margin:0">${esc(p.detail)}</p>
      </section>`).join('')}
  </div>

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><p class="eyebrow">Funnel</p><h2>Where the leak is</h2>
        <p class="sub">One week of numbers. The diagnosis writes itself.</p></div>
        <span class="pill ${f.updated ? 'green' : 'dim'}">${f.updated ? 'logged ' + shortDate(f.updated) : 'not logged'}</span></div>
      <form data-form="funnel">
        <div class="form-row-3">
          <div class="field"><label>Reel views</label><input type="number" min="0" name="views" value="${f.values.views}" /></div>
          <div class="field"><label>Comments</label><input type="number" min="0" name="comments" value="${f.values.comments}" /></div>
          <div class="field"><label>DM replies</label><input type="number" min="0" name="dmReplies" value="${f.values.dmReplies}" /></div>
        </div>
        <div class="form-row-3">
          <div class="field"><label>Checkout clicks</label><input type="number" min="0" name="clicks" value="${f.values.clicks}" /></div>
          <div class="field"><label>Purchases</label><input type="number" min="0" name="purchases" value="${f.values.purchases}" /></div>
          <div class="field"><label>Note</label><input name="note" value="${esc(f.note)}" placeholder="Which Reel / week?" /></div>
        </div>
        <button class="btn btn-primary btn-sm" type="submit">Save this week’s numbers</button>
      </form>
      <div class="hr"></div>
      ${f.checks.map(ch => `
        <div style="margin-bottom:11px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
            <span>${esc(ch.label)}</span>
            <span class="mono" style="color:${ch.status === 'ok' ? 'var(--green)' : ch.status === 'no-data' ? 'var(--dim2)' : 'var(--red)'}">
              ${ch.value == null ? '—' : ch.value + '%'} <span class="dim">vs ${esc(ch.healthy)}</span></span>
          </div>
          <div class="bar ${ch.status === 'ok' ? 'green' : ch.status === 'low' ? 'red' : ''}">
            <i style="width:${ch.value == null ? 0 : Math.min(100, (ch.value / Math.max(ch.max, 1)) * 100)}%"></i>
          </div>
        </div>`).join('')}
      <div class="hr"></div>
      ${f.diagnosis.map(d => `<p class="note gold" style="margin:0 0 8px">${esc(d)}</p>`).join('')}
    </section>

    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Calculator</p><h2 style="font-size:18px">Build a month that hits the goal</h2>
        <p class="sub">Counts, not fantasies. Nothing here is saved to your sales.</p></div></div>
      <div class="form-row">
        <div class="field"><label>$27 kit — units</label><input type="number" min="0" data-calc="t20" value="${calc.t20}" /></div>
        <div class="field"><label>$27 kit — price</label><input type="number" min="0" data-calc="tP" value="${calc.tP}" /></div>
        <div class="field"><label>Core — units</label><input type="number" min="0" data-calc="c40" value="${calc.c40}" /></div>
        <div class="field"><label>Core — price</label><input type="number" min="0" data-calc="cP" value="${calc.cP}" /></div>
        <div class="field"><label>Review — units</label><input type="number" min="0" data-calc="u8" value="${calc.u8}" /></div>
        <div class="field"><label>Review — price</label><input type="number" min="0" data-calc="uP" value="${calc.uP}" /></div>
      </div>
      <div id="calcOut">${calcOut()}</div>
      <p class="note" style="margin-top:12px">A month is 30 days. If the calculator needs 40 core sales, that is 1.3 sales a day — decide now whether the content can carry it, or move the mix toward the review.</p>
    </section>
  </div>

  <section class="card">
    <div class="card-head"><div><p class="eyebrow plain">Ledger</p><h2 style="font-size:18px">Every sale, honestly logged</h2></div>
      <button class="btn btn-sm btn-primary" data-act="sale-open" data-offer="weekend">+ Log a sale</button></div>
    ${m.sales.length ? `
      <table class="ledger">
        <thead><tr><th>Date</th><th>Offer</th><th class="num hide-sm">Price</th><th class="num">Units</th><th class="num">Total</th><th class="hide-sm">Source</th><th></th></tr></thead>
        <tbody>${m.sales.map(s => `
          <tr>
            <td class="num">${shortDate(s.date)}</td>
            <td>${esc(s.offerName)}${s.note ? `<div class="tiny dim">${esc(s.note)}</div>` : ''}</td>
            <td class="num hide-sm">${money(s.price)}</td>
            <td class="num">${s.units || 1}</td>
            <td class="num" style="color:var(--gold2)">${money(s.total != null ? s.total : s.price * (s.units || 1))}</td>
            <td class="hide-sm dim">${esc(s.source || '—')}</td>
            <td style="text-align:right"><button class="btn btn-sm btn-ghost" data-act="delete" data-kind="sale" data-id="${s.id}" aria-label="Delete sale">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>` : `
      <div class="empty"><b>No sales logged yet</b>Log the first one the moment it happens — even $27. The dashboard cannot coach what you do not record.</div>`}
  </section>`;
}

function calcOut() {
  const total = calcRevenue();
  const goal = S.money.goal || 10000;
  const pctOfGoal = goal ? (total / goal) * 100 : 0;
  const units = (Number(calc.t20) || 0) + (Number(calc.c40) || 0) + (Number(calc.u8) || 0);
  return `
    <div class="callout" style="margin-top:4px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap">
        <b class="serif" style="font-size:26px">${money(total)}</b>
        <span class="small">${units} sales · ${pctOfGoal.toFixed(0)}% of the ${money(goal)} goal</span>
      </div>
      <div class="bar" style="margin-top:9px;background:rgba(0,0,0,.3)"><i style="width:${Math.min(100, pctOfGoal)}%"></i></div>
      <div class="small" style="margin-top:7px;color:var(--dim)">${total >= goal
        ? `That clears the goal by ${money(total - goal)}. Now decide which of these are real.`
        : `${money(goal - total)} short. Add ${Math.max(1, Math.ceil((goal - total) / Math.max(1, Number(calc.cP) || 147)))} core sales, or raise the review count.`}</div>
    </div>`;
}

// ── view: plan ──────────────────────────────────────────────────────────────
function viewPlan() {
  const p = S.plan;
  return `
  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">Execution</p><h2>${esc(p.active.label)}</h2>
        <p class="sub">${esc(p.milestone)}</p></div>
      <span class="pill gold">Day ${p.dayNumber} / 90</span>
    </div>
    <div class="bar" style="height:9px"><i style="width:${p.progress}%"></i></div>
    <div class="bar-legend"><span>${p.done} of ${p.total} tasks complete</span><span>${p.progress}% of the 90 days</span></div>
    ${p.nextTask ? `<div class="callout" style="margin-top:14px"><b>Next task:</b> ${esc(p.nextTask.label)}</div>` : '<div class="callout green" style="margin-top:14px">Every phase task is done. Go back through the numbers before adding anything new.</div>'}
  </section>

  ${p.phases.map(ph => `
    <section class="card" style="${ph.active ? 'border-color:rgba(233,185,95,.3)' : ''}">
      <div class="card-head">
        <div><p class="eyebrow plain">${esc(ph.label)}${ph.active ? ' · you are here' : ''}</p>
          <h2 style="font-size:18px">${ph.done}/${ph.total} done</h2></div>
        ${ph.active ? '<span class="pill gold">Active</span>' : ph.past ? '<span class="pill dim">Past</span>' : '<span class="pill dim">Ahead</span>'}
      </div>
      <div class="list">
        ${ph.tasks.map(t => `
          <div class="row">
            <button class="check ${t.done ? 'on' : ''}" data-act="plan-task" data-id="${t.id}" data-done="${t.done ? '0' : '1'}">✓</button>
            <div class="grow"><div class="r-title ${t.done ? 'done-text' : ''}">${esc(t.label)}</div>
              ${t.doneAt ? `<div class="r-sub">done ${shortDate(t.doneAt)}</div>` : ''}</div>
          </div>`).join('')}
      </div>
      <p class="note" style="margin-top:10px">Outcome: ${esc(ph.outcome)}</p>
    </section>`).join('')}

  <div class="grid-2">
    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Setup</p><h2 style="font-size:18px">Your operating details</h2></div>
        <button class="btn btn-sm" data-act="settings">Edit</button></div>
      <div class="kv"><span>Goal</span><span>${money(S.settings.goal)} / month</span></div>
      <div class="kv"><span>Day 1 of the plan</span><span>${esc(S.settings.startDate)}</span></div>
      <div class="kv"><span>Name / handle</span><span>${esc(S.settings.name)} · ${esc(S.settings.handle)}</span></div>
      <div class="kv"><span>Map link</span><span>${esc(S.settings.mapLink || '—')}</span></div>
      <div class="kv"><span>Tripwire link</span><span>${esc(S.settings.tripwireLink || '—')}</span></div>
      <div class="kv"><span>Core link</span><span>${esc(S.settings.coreLink || '—')}</span></div>
      <div class="kv"><span>Review link</span><span>${esc(S.settings.reviewLink || '—')}</span></div>
      <p class="note" style="margin-top:12px">Changing Day 1 re-dates the whole 30-day calendar and the 90-day phase you are in. It does not touch your sales ledger.</p>
    </section>

    <section class="card">
      <div class="card-head"><div><p class="eyebrow plain">Do not do this</p><h2 style="font-size:18px">The eight things that kill it</h2></div></div>
      <div class="list">
        ${S.donts.map(d => `<div class="row" style="padding:8px 0"><span style="color:var(--red);width:16px">✕</span><div class="grow"><div class="r-title" style="font-weight:400;font-size:12.5px">${esc(d)}</div></div></div>`).join('')}
      </div>
      <div class="hr"></div>
      <p class="eyebrow plain">The rules of this system</p>
      <ol class="small" style="margin:0;padding-left:18px;color:var(--dim);line-height:1.65">
        ${S.rules.map(r => `<li>${esc(r)}</li>`).join('')}
      </ol>
    </section>
  </div>

  <section class="card">
    <p class="eyebrow plain">The one sentence</p>
    <p class="quote">${esc(S.bio.oneLine)}</p>
    <div class="hr"></div>
    <div class="grid-3">
      <div><p class="eyebrow plain">Category</p><p class="small muted" style="margin:0">${esc(S.bio.category)}</p></div>
      <div><p class="eyebrow plain">Enemy</p><p class="small muted" style="margin:0">${esc(S.bio.enemy)}</p></div>
      <div><p class="eyebrow plain">Mechanism</p><p class="small muted" style="margin:0">${esc(S.bio.mechanism)}</p></div>
    </div>
  </section>`;
}


// ── markdown (artifacts are markdown; render it properly) ──────────────────
function mdInline(text) {
  return esc(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function md(src) {
  const lines = String(src == null ? '' : src).replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  let para = [];

  const flush = () => {
    if (para.length) { out.push(`<p>${mdInline(para.join(' '))}</p>`); para = []; }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flush();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre class="md-code">${esc(buf.join('\n'))}</pre>`);
      continue;
    }

    if (!line.trim()) { flush(); i++; continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      const level = Math.min(4, h[1].length);
      out.push(`<h${level} class="md-h${level}">${mdInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^---+$/.test(line.trim())) { flush(); out.push('<hr class="md-hr" />'); i++; continue; }

    if (/^\|/.test(line) && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) {
      flush();
      const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
      out.push(`<div class="md-table-wrap"><table class="md-table"><thead><tr>${head.map(c => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      flush();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote class="md-quote">${mdInline(buf.join(' '))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push(`<ul class="md-list">${items.map(t => `<li>${mdInline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      out.push(`<ol class="md-list">${items.map(t => `<li>${mdInline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    if (/^\s*- \[[ x]\]/.test(line)) {
      flush();
      const items = [];
      while (i < lines.length && /^\s*- \[[ x]\]/.test(lines[i])) {
        const done = /\[x\]/i.test(lines[i]);
        items.push({ done, text: lines[i].replace(/^\s*- \[[ x]\]\s*/i, '') });
        i++;
      }
      out.push(`<ul class="md-list md-checks">${items.map(t => `<li>${t.done ? '✓' : '○'} ${mdInline(t.text)}</li>`).join('')}</ul>`);
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flush();
  return out.join('\n');
}

async function loadAgents() {
  try {
    const [a, r] = await Promise.all([api('/api/agents'), api('/api/runs')]);
    AGENTS = a;
    RUNS = r.runs || [];
  } catch {
    AGENTS = AGENTS || { agents: [], flows: [] };
  }
}

function agentInputs(inputs, prefix) {
  if (!inputs || !inputs.length) return '';
  return inputs.map(f => {
    const id = `${prefix}-${f.key}`;
    if (f.type === 'select') {
      return `<div class="field"><label>${esc(f.label)}</label>
        <select name="${f.key}" id="${id}">${(f.options || []).map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></div>`;
    }
    if (f.type === 'lead') {
      const leads = S.leads.leads.filter(l => !['bought', 'lost'].includes(l.stage));
      return `<div class="field"><label>${esc(f.label)}</label>
        <select name="${f.key}" id="${id}">
          ${leads.length ? leads.map(l => `<option value="${esc(l.id)}">${esc(l.name)} — ${esc(l.stageLabel)}</option>`).join('') : '<option value="">No active leads yet</option>'}
        </select></div>`;
    }
    return `<div class="field"><label>${esc(f.label)}${f.required ? ' *' : ''}</label>
      <input name="${f.key}" id="${id}" placeholder="${esc(f.placeholder || '')}" maxlength="200" /></div>`;
  }).join('');
}

function viewAgents() {
  const flows = (AGENTS && AGENTS.flows) || [];
  const agentsList = (AGENTS && AGENTS.agents) || [];
  const last = RUNS[0];

  return `
  <section class="hero card">
    <div class="hero-main">
      <p class="eyebrow">Execution layer</p>
      <h2 class="hero-title">Six agents. Five flows. Real files at the end.</h2>
      <p class="hero-sub">Each agent is a deterministic writer with one job. A flow chains them and hands the output forward — offer → content → launch → memo. Every run is saved, readable and downloadable.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-act="run-flow" data-id="launch-kit">Build the launch kit</button>
        <button class="btn" data-act="run-flow" data-id="daily">Write today’s brief</button>
        <button class="btn btn-ghost" data-act="run-flow" data-id="win-back">Win-back shift</button>
      </div>
    </div>
    <div class="hero-side">
      <div class="mini-stats">
        <div><b>${RUNS.length}</b><span>runs</span></div>
        <div><b>${RUNS.reduce((t, r) => t + (r.files || []).length, 0)}</b><span>artifacts</span></div>
        <div><b>${RUNS.reduce((t, r) => t + (r.durationMs || 0), 0) < 1000 ? '<1s' : Math.round(RUNS.reduce((t, r) => t + (r.durationMs || 0), 0) / 1000) + 's'}</b><span>total compute</span></div>
      </div>
      ${last ? `<button class="btn btn-sm btn-ghost" data-act="open-run" data-id="${last.id}">Last: ${esc(last.flowName)} →</button>` : ''}
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">Flows</p><h2>Jobs, not prompts</h2>
        <p class="sub">A flow runs agents in order and passes their artifacts down the line. Blocked steps stop and say why instead of inventing output.</p></div>
    </div>
    <div class="flow-grid">
      ${flows.map(f => `
        <div class="flow-card">
          <div class="flow-top">
            <h3>${esc(f.name)}</h3>
            <span class="pill dim">${f.minutes} min</span>
          </div>
          <p class="flow-why">${esc(f.why)}</p>
          <div class="flow-chain">${f.agents.map(a => `<span class="chain-chip">${esc(a)}</span>`).join('<i>→</i>')}</div>
          <form data-form="flow" data-id="${f.id}">
            ${agentInputs(f.inputs, 'flow-' + f.id)}
            <button class="btn btn-sm ${f.id === 'launch-kit' ? 'btn-primary' : ''}" type="submit">Run ${esc(f.name.toLowerCase())}</button>
          </form>
        </div>`).join('')}
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow">The crew</p><h2>Single agents</h2>
        <p class="sub">Use one when you only need one thing. Same artifacts, same honesty rules.</p></div>
    </div>
    <div class="agent-grid">
      ${agentsList.map(a => `
        <div class="agent-card">
          <div class="agent-top">
            <span class="agent-dot"></span>
            <div><h4>${esc(a.name)}</h4><div class="tiny dim">${esc(a.tag)}</div></div>
          </div>
          <p class="agent-role">${esc(a.role)}</p>
          <form data-form="agent" data-id="${a.id}">
            ${agentInputs(a.inputs, 'agent-' + a.id)}
            <button class="btn btn-sm" type="submit">Run</button>
          </form>
        </div>`).join('')}
    </div>
  </section>

  <section class="card">
    <div class="card-head">
      <div><p class="eyebrow plain">History</p><h2 style="font-size:18px">Every run, kept</h2>
        <p class="sub">The last ${RUNS.length} runs. Each one holds its own artifacts, so an old kit still downloads.</p></div>
      <button class="btn btn-sm btn-ghost" data-act="refresh-runs">Refresh</button>
    </div>
    ${RUNS.length ? `<div class="list">${RUNS.map(r => `
      <div class="row run-row" data-act="open-run" data-id="${r.id}" role="button" tabindex="0">
        <span class="run-status ${r.status}"></span>
        <div class="grow">
          <div class="r-title">${esc(r.flowName)} <span class="pill ${r.status === 'ok' ? 'green' : r.status === 'partial' ? 'gold' : 'red'}">${esc(r.status)}</span></div>
          <div class="r-sub">${esc(r.summary)}</div>
        </div>
        <div class="r-meta">${(r.files || []).length} files · ${r.durationMs}ms · ${esc((r.startedAt || '').slice(11, 16))}</div>
        <button class="btn btn-sm btn-ghost" data-act="open-run" data-id="${r.id}">Open</button>
      </div>`).join('')}</div>` : '<div class="empty"><b>No runs yet</b>Start with “Write today’s brief” — it takes a second and shows you how the artifacts read.</div>'}
  </section>`;
}

async function runFlow(id, input) {
  toast('Running… agents are writing.');
  try {
    const data = await api(`/api/flows/${id}/run`, { input: input || {} });
    apply(data);
    await loadAgents();
    render();
    openRun(data.run.id);
    toast(`${data.run.summary}`);
  } catch (err) {
    toast(err.message, true);
  }
}

async function runAgent(id, input) {
  toast('Running…');
  try {
    const data = await api(`/api/agents/${id}/run`, { input: input || {} });
    apply(data);
    await loadAgents();
    render();
    if (data.run.status === 'blocked') {
      toast(data.run.blockers[0] || 'Blocked — the agent refused to invent output.', true);
      openRun(data.run.id);
      return;
    }
    openRun(data.run.id);
    toast(data.run.summary);
  } catch (err) {
    toast(err.message, true);
  }
}

async function openRun(runId) {
  let run = RUNS.find(r => r.id === runId) || null;
  if (!run) {
    try {
      const data = await api(`/api/runs/${runId}`);
      run = data.run;
    } catch (err) { toast(err.message, true); return; }
  }
  modalState = { type: 'run', id: runId };

  const files = run.files || [];
  modal(`
    ${modalHead(run.flowName, `${run.summary} · ${run.durationMs}ms · ${run.today}`)}
    <div class="tagline-row" style="margin-bottom:14px">
      <span class="pill ${run.status === 'ok' ? 'green' : run.status === 'partial' ? 'gold' : 'red'}">${esc(run.status)}</span>
      <span class="pill dim">${files.length} file${files.length === 1 ? '' : 's'}</span>
      ${(run.adopt && (run.adopt.offers.length || run.adopt.content.length))
        ? `<button class="btn btn-sm btn-primary" data-act="apply-run" data-id="${run.id}">Adopt into the app</button>` : ''}
      <a class="btn btn-sm" href="/api/kit/${run.id}.zip" download>Download .zip</a>
    </div>

    <p class="eyebrow plain">Agent timeline</p>
    <div class="timeline">
      ${(run.steps || []).map((st, i) => `
        <div class="tl-step ${st.status}">
          <span class="tl-n">${i + 1}</span>
          <div class="grow">
            <div class="r-title">${esc(st.agentName)} <span class="pill ${st.status === 'ok' ? 'green' : st.status === 'partial' ? 'gold' : 'red'}">${esc(st.status)}</span>
              <span class="r-meta">${st.ms}ms</span></div>
            <div class="r-sub">${esc(st.summary || '')}</div>
            ${(st.detail || []).length ? `<ul class="tl-detail">${st.detail.map(d => `<li><b>${esc(d.label)}</b> — ${esc(d.detail)}</li>`).join('')}</ul>` : ''}
            ${(st.blockers || []).map(b => `<div class="callout red" style="margin-top:7px;font-size:11.5px">${esc(b)}</div>`).join('')}
          </div>
        </div>`).join('')}
    </div>

    <div class="hr"></div>
    <p class="eyebrow plain">Artifacts — click to read</p>
    <div class="artifact-grid">
      ${files.map(f => `
        <button class="artifact" data-act="open-artifact" data-run="${run.id}" data-name="${esc(f.name)}">
          <span class="art-name">${esc(f.name)}</span>
          <span class="art-title">${esc(f.title)}</span>
          <span class="art-meta">${esc(f.agentName)} · ${(f.bytes / 1024).toFixed(1)}kB</span>
        </button>`).join('')}
    </div>
    ${(run.notes || []).length ? `<div class="hr"></div>${run.notes.map(n => `<p class="note" style="margin:0 0 6px">${esc(n)}</p>`).join('')}` : ''}
    <div class="modal-foot">
      <button class="btn btn-ghost" data-act="close-modal">Close</button>
    </div>`);
}

async function openArtifact(runId, name) {
  try {
    const data = await api(`/api/runs/${runId}/file?name=${encodeURIComponent(name)}`);
    const run = RUNS.find(r => r.id === runId) || {};
    modalState = { type: 'artifact', id: runId, name };
    modal(`
      <div class="modal-head">
        <div><h2>${esc(name)}</h2><p>${esc(run.flowName || '')} · run ${esc(String(runId).slice(-6))}</p></div>
        <button class="icon-btn" data-act="close-modal" aria-label="Close">✕</button>
      </div>
      <div class="tagline-row" style="margin-bottom:12px">
        <button class="btn btn-sm" data-act="copy-md" data-run="${runId}" data-name="${esc(name)}">Copy markdown</button>
        <button class="btn btn-sm" data-act="download-md" data-run="${runId}" data-name="${esc(name)}">Download .md</button>
        <a class="btn btn-sm" href="/api/kit/${runId}.zip" download>Whole kit .zip</a>
        <button class="btn btn-sm btn-ghost" data-act="open-run" data-id="${runId}">← Back to run</button>
      </div>
      <div class="md">${md(data.content)}</div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-act="close-modal">Close</button>
      </div>`);
    window.__lastArtifact = data.content;
  } catch (err) {
    toast(err.message, true);
  }
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ── modals ──────────────────────────────────────────────────────────────────
function modal(html) {
  $('#modalRoot').innerHTML = `<div class="overlay" data-overlay><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  const first = $('#modalRoot input, #modalRoot select, #modalRoot textarea');
  if (first) setTimeout(() => first.focus(), 40);
}
function closeModal() {
  $('#modalRoot').innerHTML = '';
  modalState = null;
}
function modalHead(title, sub) {
  return `<div class="modal-head"><div><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>
    <button class="icon-btn" data-act="close-modal" aria-label="Close">✕</button></div>`;
}

function openContent(id, keepOpen = false) {
  const item = S.content.items.find(x => x.id === id);
  if (!item) return;
  modalState = { type: 'content', id };
  const script = scriptForItem(item);
  modal(`
    ${modalHead(`Day ${item.dayOfCycle} · ${item.formatLabel}`, `${esc(niceDate(item.date))} · ${item.pillar} ${item.pillarLabel}`)}
    <div class="tagline-row" style="margin-bottom:14px">
      ${statusPill(item.status)} <span class="pill dim">${esc(item.cta)}</span>
      ${item.isToday ? '<span class="pill gold">Today</span>' : ''}
    </div>
    <form data-form="content-edit" data-id="${item.id}">
      <div class="field"><label>Hook</label><textarea name="hook" maxlength="300">${esc(item.hook)}</textarea>
        <span class="hint">Harsh reframe + who it’s for + tiny promise.</span></div>
      <div class="field"><label>Call to action</label><input name="cta" value="${esc(item.cta)}" maxlength="160" /></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" type="submit">Save edits</button>
        <button class="btn btn-sm ${item.posted ? '' : ''}" type="button" data-act="${item.posted ? 'content-unpost' : 'content-post'}" data-id="${item.id}">
          ${item.posted ? 'Undo posted' : 'Mark posted'}</button>
        <button class="btn btn-sm btn-ghost" type="button" data-act="content-film" data-id="${item.id}">${item.filmed ? 'Un-film' : 'Mark filmed'}</button>
      </div>
    </form>
    <div class="hr"></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <p class="eyebrow plain" style="margin:0">Script</p>
      <button class="btn btn-sm btn-ghost" data-act="copy" data-copy-target="modal-script">Copy</button>
    </div>
    <div class="script" id="modal-script">${esc(script.text)}</div>
    <div class="hr"></div>
    <p class="eyebrow plain">Caption</p>
    <div class="script" id="modal-caption" style="max-height:150px">${esc(script.caption.replace(/\{\{handle\}\}/g, S.settings.handle || '@yourname'))}</div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-act="close-modal">Close</button>
    </div>
  `);
  if (keepOpen) modalState = { type: 'content', id };
}

function scriptForItem(item) {
  // mirrors the server's generator for any calendar item (today's comes prebuilt)
  const teach = {
    A: ['Most beginners do it backwards: aesthetic first, offer last.',
      'The formula: I help [who] get [result] without [pain] in [time].',
      'Price before you feel ready. $27 is a decision, not a valuation.'],
    B: ['Taste is only leverage when it is packaged.',
      'A pretty grid with no checkout is a moodboard.',
      'Beautiful and unspecified is unbuyable.'],
    C: ['The honest number this week: [your real number — never inflate it].',
      'What I shipped: [file or screen]. What it cost: [time].',
      'What I would do differently: [one line].'],
    D: ['You do not need followers. You need something to sell them.',
      'Consistency beats virality for the first 90 days.',
      'Pick one skill, one person, one outcome.'],
    E: ['The free Map names your offer. That is the whole lead magnet.',
      'The system installs the profile, the content and the funnel.',
      'One link. One next step. No PDF dumps.'],
  }[item.pillar] || [];
  const lines = [`HOOK — ${item.hook}`, ''];
  if (item.format === 'C') {
    lines.push('SLIDE 1: the hook above, big and plain.');
    teach.forEach((t, i) => lines.push(`SLIDE ${i + 2}: ${t}`));
    lines.push('SLIDE 5: one example or teardown — [screenshot with permission, never invented].');
    lines.push(`SLIDE 6: ${item.cta}.`);
  } else {
    lines.push('PROBLEM (3–20s): name it plainly. They are posting and nobody is paying.');
    teach.forEach((t, i) => lines.push(`MECHANISM ${i + 1} (20–40s): ${t}`));
    lines.push('PROOF (40–55s): show a real screen or say the real number. [your number].');
    lines.push(`COMMAND (55–60s): ${item.cta}. Say the keyword twice — on camera and on screen.`);
  }
  if (item.format.includes('F')) {
    lines.push('', 'FACEBOOK TWIN: cross-post the Reel the same day. 3x/week turn it into a native text post, value first, link in the comments.');
  }
  return {
    text: lines.join('\n'),
    caption: `${item.hook}\n\n${item.cta}.\n\nFollow @{{handle}} if you are starting from zero and actually want to sell something.\n\n#digitalproducts #personalbrand #creativebusiness`,
  };
}

function openOffer(id) {
  const o = id ? S.offers.find(x => x.id === id) : null;
  modalState = { type: 'offer' };
  modal(`
    ${modalHead(o ? 'Edit offer' : 'Add an offer', o ? o.name : 'A new rung on the ladder')}
    <form data-form="offer" data-id="${o ? o.id : ''}">
      <div class="field"><label>Name</label><input name="name" required maxlength="80" value="${esc(o ? o.name : '')}" placeholder="e.g. The Buyable Brand" /></div>
      <div class="form-row">
        <div class="field"><label>Price (USD)</label><input type="number" min="0" step="1" name="price" value="${o ? o.price : 0}" /></div>
        <div class="field"><label>Layer</label>
          <select name="layer">${['lead', 'tripwire', 'core', 'upsell', 'later'].map(l => `<option value="${l}" ${o && o.layer === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Status</label>
          <select name="status">${['idea', 'building', 'live', 'proven'].map(s => `<option value="${s}" ${o && o.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div class="field"><label>Format</label><input name="format" maxlength="300" value="${esc(o ? o.format : '')}" placeholder="What is inside?" /></div>
      </div>
      <div class="field"><label>Promise</label><input name="promise" maxlength="300" value="${esc(o ? o.promise : '')}" placeholder="I help [who] get [result] without [pain]" /></div>
      <div class="field"><label>Next build step</label><input name="next" maxlength="300" value="${esc(o ? o.next : '')}" placeholder="What ships next?" /></div>
      <div class="modal-foot">
        ${o ? `<button class="btn btn-danger btn-sm" type="button" data-act="delete" data-kind="offer" data-id="${o.id}">Delete</button>` : ''}
        <button class="btn btn-ghost" type="button" data-act="close-modal">Cancel</button>
        <button class="btn btn-primary" type="submit">${o ? 'Save offer' : 'Add offer'}</button>
      </div>
    </form>`);
}

function openSale(offerId, leadName) {
  modalState = { type: 'sale' };
  const def = S.offers.find(o => o.id === offerId) || S.offers[2];
  modal(`
    ${modalHead('Log a sale', 'This feeds the best-seller ranking, the month and the ledger.')}
    <form data-form="sale">
      <div class="field"><label>Offer</label>
        <select name="offerId">${S.offers.map(o => `<option value="${o.id}" ${o.id === def.id ? 'selected' : ''}>${esc(o.name)} — ${o.price ? '$' + o.price : 'free'}</option>`).join('')}</select></div>
      <div class="form-row">
        <div class="field"><label>Price per unit</label><input type="number" min="0" step="1" name="price" value="${def.price}" /></div>
        <div class="field"><label>Units</label><input type="number" min="1" step="1" name="units" value="1" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Date</label><input type="date" name="date" value="${S.today}" max="${S.today}" /></div>
        <div class="field"><label>Source</label>
          <select name="source">${['DM', 'Story', 'Email', 'Profile link', 'Referral', 'Other'].map(x => `<option>${x}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Note (optional)</label><input name="note" maxlength="300" placeholder="${leadName ? 'e.g. ' + esc(leadName) + ' — SELLING' : 'What convinced them?'}" /></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" type="button" data-act="close-modal">Cancel</button>
        <button class="btn btn-primary" type="submit">Log the sale</button>
      </div>
    </form>`);
}

function openLead(id, keepOpen = false) {
  const l = id ? S.leads.leads.find(x => x.id === id) : null;
  modalState = { type: 'lead', id: id || null };
  modal(`
    ${modalHead(l ? 'Edit lead' : 'Add a lead', l ? 'No message is sent from here.' : 'A comment keyword, a DM, a story reply — one row each.')}
    <form data-form="lead" data-id="${l ? l.id : ''}">
      <div class="form-row">
        <div class="field"><label>Name</label><input name="name" required maxlength="80" value="${esc(l ? l.name : '')}" placeholder="First name or handle" /></div>
        <div class="field"><label>Handle</label><input name="handle" maxlength="80" value="${esc(l ? l.handle : '')}" placeholder="@handle" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Skill / stuck point</label><input name="skill" maxlength="120" value="${esc(l ? l.skill : '')}" placeholder="e.g. Canva designer, no offer" /></div>
        <div class="field"><label>Source</label><input name="source" maxlength="60" value="${esc(l ? l.source : 'Comment BRAND')}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Stage</label>
          <select name="stage">${S.leads.stages.map(s => `<option value="${s.key}" ${l && l.stage === s.key ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
        <div class="field"><label>Next follow-up</label><input type="date" name="nextActionAt" value="${l && l.nextActionAt ? l.nextActionAt : S.today}" /></div>
      </div>
      <div class="field"><label>Note</label><textarea name="note" maxlength="500" placeholder="What they said. What you recommended. Never invent a detail.">${esc(l ? l.note : '')}</textarea></div>
      ${l ? `<div class="callout" style="margin-bottom:12px">Suggested script: <b>${esc((S.scripts.find(sc => sc.id === l.nextScript) || {}).title || '—')}</b></div>` : ''}
      <div class="modal-foot">
        ${l ? `<button class="btn btn-danger btn-sm" type="button" data-act="delete" data-kind="lead" data-id="${l.id}" aria-label="Delete lead">Delete</button>` : ''}
        <button class="btn btn-ghost" type="button" data-act="close-modal">Cancel</button>
        <button class="btn btn-primary" type="submit">${l ? 'Save lead' : 'Add lead'}</button>
      </div>
    </form>`);
  if (keepOpen) modalState = { type: 'lead', id: id || null };
}

function openScriptModal(id) {
  if (id === 'today') {
    const c = S.content.today;
    if (!c) return;
    const script = scriptForItem(c);
    modalState = { type: 'script' };
    modal(`
      ${modalHead('Today’s script', `${c.formatLabel} · ${c.pillarLabel} · ${niceDate(c.date)}`)}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <p class="eyebrow plain" style="margin:0">Script</p>
        <button class="btn btn-sm" data-act="copy" data-copy-target="script-modal-body">Copy</button>
      </div>
      <div class="script" id="script-modal-body">${esc(script.text)}</div>
      <div class="hr"></div>
      <p class="eyebrow plain">Caption</p>
      <div class="script" id="script-modal-caption" style="max-height:160px">${esc(script.caption.replace(/\{\{handle\}\}/g, S.settings.handle || '@yourname'))}</div>
      <div class="modal-foot"><button class="btn btn-ghost" data-act="close-modal">Close</button>
        <button class="btn btn-primary" data-act="content-post" data-id="${c.id}">Mark posted</button></div>`);
    return;
  }
  const sc = S.scripts.find(x => x.id === id);
  if (!sc) return;
  modalState = { type: 'script' };
  modal(`
    ${modalHead(sc.title, sc.when)}
    <div class="script" id="script-modal-body">${esc(fillLinks(sc.body))}</div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-act="close-modal">Close</button>
      <button class="btn btn-primary" data-act="copy" data-copy-target="script-modal-body">Copy message</button>
    </div>`);
}

function openSettings() {
  const s = S.settings;
  modalState = { type: 'settings' };
  modal(`
    ${modalHead('Setup & links', 'The handles and links your scripts and captions fill in.')}
    <form data-form="settings">
      <div class="form-row">
        <div class="field"><label>Monthly goal (USD)</label><input type="number" min="100" step="100" name="goal" value="${s.goal}" /></div>
        <div class="field"><label>Day 1 of the plan</label><input type="date" name="startDate" value="${s.startDate}" max="${S.today}" /></div>
      </div>
      <div class="form-row">
        <div class="field"><label>Name</label><input name="name" maxlength="300" value="${esc(s.name)}" /></div>
        <div class="field"><label>Instagram handle</label><input name="handle" maxlength="300" value="${esc(s.handle)}" placeholder="@yourname" /></div>
      </div>
      <div class="field"><label>Free Offer Map link</label><input name="mapLink" maxlength="300" value="${esc(s.mapLink)}" placeholder="https://stan.store/…" /></div>
      <div class="form-row">
        <div class="field"><label>$27 kit link</label><input name="tripwireLink" maxlength="300" value="${esc(s.tripwireLink)}" /></div>
        <div class="field"><label>Core $147 link</label><input name="coreLink" maxlength="300" value="${esc(s.coreLink)}" /></div>
      </div>
      <div class="field"><label>$297 review link</label><input name="reviewLink" maxlength="300" value="${esc(s.reviewLink)}" /></div>
      <div class="callout" style="margin:6px 0 14px">Changing Day 1 re-dates the 30-day calendar and moves you to a different phase of the 90-day plan. Sales and leads are untouched.</div>
      <div class="modal-foot">
        <button class="btn btn-danger btn-sm" type="button" data-act="reset">Reset everything…</button>
        <button class="btn btn-ghost" type="button" data-act="close-modal">Cancel</button>
        <button class="btn btn-primary" type="submit">Save setup</button>
      </div>
    </form>`);
}

function confirmReset() {
  modalState = { type: 'reset' };
  modal(`
    ${modalHead('Reset the operating system?', 'This wipes every sale, lead, checklist and edit. Export first if you might want it back.')}
    <div class="callout red">There is no undo. The 30-day calendar, 90-day plan and offer ladder return to their starting state.</div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-act="close-modal">Keep my data</button>
      <button class="btn btn-danger" data-act="reset-confirm">Yes, wipe it</button>
    </div>`);
}

// ── actions ─────────────────────────────────────────────────────────────────
async function refresh(silent = false) {
  try {
    const data = await api('/api/state');
    apply(data);
    if (!silent) toast('Runbook rebuilt — ' + S.runbook.summary);
  } catch (err) { toast(err.message, true); }
}

async function mutate(path, body, okMessage) {
  try {
    const data = await api(path, body);
    apply(data);
    if (okMessage) toast(okMessage);
    return true;
  } catch (err) {
    toast(err.message, true);
    return false;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied. Now send it yourself.');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('Copied. Now send it yourself.'); }
    catch { toast('Copy failed — select the text manually.', true); }
    ta.remove();
  }
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (e.target.matches('[data-overlay]')) { closeModal(); return; }
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;

  try {
    if (act === 'tab') { e.preventDefault(); setTab(el.dataset.tab); return; }
    if (act === 'menu') { $('#rail').classList.toggle('open'); return; }
    if (act === 'close-modal') { closeModal(); return; }
    if (act === 'settings') { openSettings(); return; }
    if (act === 'orchestrate') { await refresh(); return; }

    if (act === 'checkin') {
      await mutate('/api/checkin', { id, done: el.dataset.done === '1' });
      return;
    }
    if (act === 'plan-task') {
      await mutate('/api/plan', { id, done: el.dataset.done === '1' }, el.dataset.done === '1' ? 'Task done.' : 'Task reopened.');
      return;
    }
    if (act === 'content-open') { openContent(id); return; }
    if (act === 'content-post') {
      const item = S.content.items.find(x => x.id === id);
      await mutate('/api/content', { id, status: 'posted', date: item ? item.date : undefined }, 'Posted. Now go reply to every comment.');
      if (modalState.type === 'content') openContent(id, true);
      return;
    }
    if (act === 'content-unpost') {
      const item = S.content.items.find(x => x.id === id);
      await mutate('/api/content', { id, status: 'unpost', date: item ? item.date : undefined }, 'Marked as not posted.');
      if (modalState.type === 'content') openContent(id, true);
      return;
    }
    if (act === 'content-film') {
      const item = S.content.items.find(x => x.id === id);
      await mutate('/api/content', { id, status: item && item.filmed ? 'planned' : 'filmed' }, 'Batch updated.');
      if (modalState.type === 'content') openContent(id, true);
      return;
    }
    if (act === 'script-open') { openScriptModal('today'); return; }
    if (act === 'script-copy') { openScriptModal(id); return; }
    if (act === 'offer-open') { openOffer(id || null); return; }
    if (act === 'sale-open') { openSale(el.dataset.offer, el.dataset.lead); return; }
    if (act === 'lead-open') { openLead(id || null); return; }

    if (act === 'run-flow') {
      const flow = ((AGENTS && AGENTS.flows) || []).find(f => f.id === id);
      if (flow && (flow.inputs || []).some(i => i.required)) {
        setTab('agents');
        toast('This flow needs a few inputs — they are on the Agents tab.');
        return;
      }
      await runFlow(id, {});
      return;
    }
    if (act === 'open-run') { await openRun(id); return; }
    if (act === 'open-artifact') { await openArtifact(el.dataset.run, el.dataset.name); return; }
    if (act === 'refresh-runs') { await loadAgents(); render(); toast('Run history refreshed.'); return; }
    if (act === 'apply-run') {
      const data = await api('/api/apply', { runId: id });
      apply(data);
      toast(`Adopted: ${data.applied.offersChanged} offer(s), ${data.applied.contentChanged} hook(s). Your own words were left alone.`);
      return;
    }
    if (act === 'copy-md') {
      if (window.__lastArtifact) await copyText(window.__lastArtifact);
      return;
    }
    if (act === 'download-md') {
      if (window.__lastArtifact) downloadText(el.dataset.name || 'artifact.md', window.__lastArtifact);
      return;
    }

    if (act === 'copy-text') { await copyText(el.dataset.text || ''); return; }
    if (act === 'copy') {
      const target = document.getElementById(el.dataset.copyTarget);
      if (target) await copyText(target.innerText);
      return;
    }
    if (act === 'delete') {
      const kind = el.dataset.kind;
      const label = kind === 'sale' ? 'this sale' : kind === 'lead' ? 'this lead' : 'this offer';
      if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
      const ok = await mutate(`/api/${kind}/delete`, { id }, 'Deleted.');
      if (ok) closeModal();
      return;
    }
    if (act === 'reset') { confirmReset(); return; }
    if (act === 'reset-confirm') {
      const data = await api('/api/reset', { confirm: 'reset' });
      apply(data);
      closeModal();
      toast('Fresh start. Day 1 is today.');
      return;
    }
  } catch (err) {
    toast(err.message, true);
  }
});

document.addEventListener('change', async (e) => {
  const sel = e.target.closest('[data-act="lead-stage"]');
  if (!sel) return;
  await mutate('/api/lead/stage', { id: sel.dataset.id, stage: sel.value }, 'Stage moved. No message was sent.');
});

document.addEventListener('input', (e) => {
  const input = e.target.closest('[data-calc]');
  if (!input) return;
  calc[input.dataset.calc] = Number(input.value) || 0;
  calcSave();
  const out = document.getElementById('calcOut');
  if (out) out.innerHTML = calcOut();
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const kind = form.dataset.form;
  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());

  try {
    if (kind === 'sale') {
      await mutate('/api/sale', body, 'Sale logged. That is the only number that counts.');
      closeModal();
      return;
    }
    if (kind === 'offer') {
      body.id = form.dataset.id || undefined;
      await mutate('/api/offer', body, 'Offer saved.');
      closeModal();
      return;
    }
    if (kind === 'lead') {
      body.id = form.dataset.id || undefined;
      await mutate('/api/lead', body, 'Lead saved.');
      closeModal();
      return;
    }
    if (kind === 'settings') {
      await mutate('/api/settings', body, 'Setup saved.');
      closeModal();
      return;
    }
    if (kind === 'funnel') {
      await mutate('/api/funnel', body, 'Numbers logged. Read the diagnosis below.');
      return;
    }
    if (kind === 'content-edit') {
      const ok = await mutate('/api/content', { id: form.dataset.id, hook: body.hook, cta: body.cta }, 'Piece saved.');
      if (ok) openContent(form.dataset.id, true);
      return;
    }
    if (kind === 'flow') {
      const id = form.dataset.id;
      const input = Object.fromEntries(fd.entries());
      closeModal();
      await runFlow(id, input);
      return;
    }
    if (kind === 'agent') {
      const id = form.dataset.id;
      const input = Object.fromEntries(fd.entries());
      closeModal();
      await runAgent(id, input);
      return;
    }
    if (kind === 'checkin-note') {
      await mutate('/api/checkin', { id: 'note', done: true, note: body.note }, 'Journal saved.');
      return;
    }
  } catch (err) {
    toast(err.message, true);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('run-row')) {
    e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
});

// ── boot ────────────────────────────────────────────────────────────────────
(async function boot() {
  try {
    const data = await api('/api/state');
    S = data.state;
    initCalc();
    try { await loadAgents(); } catch { /* agents are optional for first paint */ }
    render();
  } catch (err) {
    const shell = document.getElementById('shell');
    if (shell) {
      shell.insertAdjacentHTML('beforebegin',
        `<div class="callout red">The console could not load its data (${esc(err.message)}). The summary above is rendered by the server and is still accurate.</div>`);
    } else {
      $('#view').innerHTML = `<div class="card"><h2>Cannot reach the API</h2>
        <p class="muted small">${esc(err.message)}</p>
        <p class="small dim">Start it with <code>node brand-os/server.js</code> and reload.</p></div>`;
    }
  }
})();
