// ─────────────────────────────────────────────────────────────────────────────
// engine.js — the orchestrator.
//
// Pure functions: state + today in → the whole client view out. No I/O, no
// clock reads inside (today is passed in), so every rule is testable.
//
// The orchestrator is deterministic on purpose. It decides *what matters
// today* from your real state: leads going cold, the piece you have not
// posted, the next offer that unlocks money, the phase task you skipped.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const playbook = require('./playbook');

const TZ = 'Africa/Dar_es_Salaam';
const CYCLE_DAYS = playbook.CONTENT.length; // 30

// ── dates (EAT, no external deps) ───────────────────────────────────────────
function todayStr(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function iso(d) { return d.toISOString().slice(0, 10); }
function addDays(s, n) {
  const d = parseDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
function monthKey(s) { return String(s || '').slice(0, 7); }
function daysInMonth(s) {
  const [y, m] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function prettyDate(s) {
  const d = parseDate(s);
  d.setUTCHours(12);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam', weekday: 'short', day: 'numeric', month: 'short',
  }).format(d);
}
function round(n, dp = 0) {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
}
function pct(n, d) {
  if (!d) return null;
  return round((n / d) * 100, 1);
}
function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

// ── sales maths ─────────────────────────────────────────────────────────────
function saleTotal(s) {
  const units = Number(s.units) > 0 ? Number(s.units) : 1;
  const price = Number(s.price) || 0;
  return price * units;
}
function sumSales(list) { return list.reduce((t, s) => t + saleTotal(s), 0); }
function unitsSold(list) {
  return list.reduce((t, s) => t + (Number(s.units) > 0 ? Number(s.units) : 1), 0);
}
function inRange(sales, from, to) {
  return sales.filter(s => s.date >= from && s.date <= to);
}

// ── revenue ─────────────────────────────────────────────────────────────────
function revenue(state, today) {
  const sales = (state.sales || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const goalFull = Number(state.settings.goal) || 10000;
  const mk = monthKey(today);
  const mtd = sales.filter(s => monthKey(s.date) === mk);
  const last30 = inRange(sales, addDays(today, -29), today);
  const prev30 = inRange(sales, addDays(today, -59), addDays(today, -30));
  const last7 = inRange(sales, addDays(today, -6), today);

  const mtdTotal = sumSales(mtd);
  const last30Total = sumSales(last30);
  const prev30Total = sumSales(prev30);
  const last7Total = sumSales(last7);
  const allTime = sumSales(sales);

  const dim = daysInMonth(today);
  const dayOfMonth = Number(today.slice(8, 10));
  const daysLeft = Math.max(0, dim - dayOfMonth);

  // First month honesty: if Day 1 is inside this month, the month target is
  // prorated instead of pretending you should already be at $7k on day 22.
  const monthStart = `${mk}-01`;
  const startDate = state.settings.startDate || monthStart;
  const effectiveStart = startDate > monthStart ? startDate : monthStart;
  const startDay = Number(effectiveStart.slice(8, 10));
  const activeSpan = Math.max(1, dim - startDay + 1);
  const daysActive = Math.max(1, dayOfMonth - startDay + 1);
  const goal = Math.round((goalFull * activeSpan) / dim);
  const prorated = activeSpan < dim;

  const dailyAvg = mtdTotal / daysActive;
  const projected = mtdTotal + dailyAvg * daysLeft;
  const paceTarget = (goal * daysActive) / activeSpan;
  const remaining = Math.max(0, goal - mtdTotal);

  let status = 'behind';
  if (daysActive <= 7 && mtdTotal === 0) status = 'starting';
  else if (mtdTotal >= paceTarget && mtdTotal > 0) status = 'ahead';
  else if (paceTarget > 0 && mtdTotal >= paceTarget * 0.85) status = 'on-pace';
  if (last30Total === 0 && daysActive > 7) status = 'cold';

  const byOffer = {};
  for (const s of sales) {
    const k = s.offerId || 'other';
    byOffer[k] = byOffer[k] || { offerId: k, name: s.offerName || k, units: 0, revenue: 0 };
    byOffer[k].units += Number(s.units) > 0 ? Number(s.units) : 1;
    byOffer[k].revenue += saleTotal(s);
  }

  return {
    goal,
    goalFull,
    prorated,
    daysActive,
    activeSpan,
    mtd: mtdTotal,
    last30: last30Total,
    prev30: prev30Total,
    last7: last7Total,
    allTime,
    units: unitsSold(sales),
    units30: unitsSold(last30),
    sales: sales.slice(0, 60),
    byOffer: Object.values(byOffer).sort((a, b) => b.revenue - a.revenue),
    dayOfMonth,
    daysLeft,
    daysInMonth: dim,
    dailyAvg: round(dailyAvg, 2),
    projected: round(projected),
    paceTarget: round(paceTarget),
    paceGap: round(mtdTotal - paceTarget),
    remaining: round(remaining),
    progress: goal ? clamp(round((mtdTotal / goal) * 100, 1), 0, 100) : 0,
    requiredPerDay: daysLeft > 0 ? round(remaining / daysLeft, 2) : round(remaining, 2),
    trend: prev30Total > 0 ? round(((last30Total - prev30Total) / prev30Total) * 100, 1) : null,
    status,
  };
}

// ── best-seller ranking ─────────────────────────────────────────────────────
// Score is deliberately readable: 50 points revenue share, 20 units,
// 20 momentum (last 14 days), 10 for being live/proven.
function rankOffers(state, today) {
  const sales = state.sales || [];
  const offers = (state.offers || []).filter(o => !o.archived);
  const totalRev = sumSales(sales);
  const totalUnits = unitsSold(sales);
  const last14 = inRange(sales, addDays(today, -13), today);
  const prev14 = inRange(sales, addDays(today, -27), addDays(today, -14));

  const rows = offers.map(o => {
    const mine = sales.filter(s => s.offerId === o.id);
    const rev = sumSales(mine);
    const units = unitsSold(mine);
    const u14 = unitsSold(last14.filter(s => s.offerId === o.id));
    const uPrev14 = unitsSold(prev14.filter(s => s.offerId === o.id));
    const rev14 = sumSales(last14.filter(s => s.offerId === o.id));
    const share = totalRev > 0 ? rev / totalRev : 0;

    const statusPts = { proven: 10, live: 8, building: 3, idea: 0 }[o.status] ?? 0;
    const score = clamp(
      share * 50 +
      Math.min(units / 25, 1) * 20 +
      Math.min(u14 / 10, 1) * 20 +
      statusPts,
      0, 100,
    );

    let trend = 'flat';
    if (u14 > uPrev14) trend = 'up';
    else if (u14 < uPrev14) trend = 'down';

    return {
      ...o,
      units,
      revenue: rev,
      share: round(share * 100, 1),
      units14: u14,
      revenue14: rev14,
      trend,
      score: round(score),
      isBest: false,
    };
  }).sort((a, b) => b.score - a.score || b.revenue - a.revenue);

  if (rows.length && (totalRev > 0 || totalUnits > 0)) rows[0].isBest = true;
  return {
    offers: rows,
    totalRev,
    totalUnits,
    bestSellerId: rows.length && (totalRev > 0 || totalUnits > 0) ? rows[0].id : null,
    bestSellerName: rows.length && (totalRev > 0 || totalUnits > 0) ? rows[0].name : null,
    priced: rows.filter(o => Number(o.price) > 0).length,
    live: rows.filter(o => ['live', 'proven'].includes(o.status)).length,
  };
}

// ── "path to $10k" maths (from the plan, computed for any goal) ─────────────
function paths(goal, offerRows) {
  const price = id => {
    const o = offerRows.find(x => x.id === id);
    return Number(o && o.price) > 0 ? Number(o.price) : 0;
  };
  const core = price('brand') || 147;
  const trip = price('weekend') || 27;
  const up = price('review') || 297;
  const circle = price('circle') || 497;

  const coreOnly = Math.ceil(goal / core);
  const ladder = {
    core: Math.ceil((goal * 0.55) / core),
    tripwire: Math.ceil((goal * 0.12) / trip),
    upsell: Math.ceil((goal * 0.33) / up),
  };
  const high = Math.ceil(goal / circle);

  return [
    {
      id: 'core',
      label: `Core offer only at $${core}`,
      sales: `${coreOnly} sales / month`,
      detail: 'Simplest path. One product, one promise, one checkout.',
    },
    {
      id: 'ladder',
      label: 'The ladder',
      sales: `${ladder.core} core + ${ladder.tripwire} tripwire + ${ladder.upsell} upsells`,
      detail: 'Same money with fewer core sales. This is the system in the plan.',
    },
    {
      id: 'high',
      label: `Group / high-ticket at $${circle}`,
      sales: `${high} seats / month`,
      detail: 'Later. Only after the core proves itself.',
    },
  ];
}

// ── content ─────────────────────────────────────────────────────────────────
function dayNumber(startDate, today) {
  return Math.max(1, diffDays(startDate, today) + 1);
}

function contentView(state, today) {
  const start = state.settings.startDate;
  const dn = dayNumber(start, today);
  const cycle = Math.floor((dn - 1) / CYCLE_DAYS) + 1;
  const cycleStart = addDays(start, (cycle - 1) * CYCLE_DAYS);
  const byId = {};
  for (const c of state.content || []) byId[c.id] = c;

  const items = playbook.CONTENT.map(seed => {
    const id = `c${String(seed.day).padStart(2, '0')}`;
    const stored = byId[id] || {};
    const date = addDays(cycleStart, seed.day - 1);
    const posted = Array.isArray(stored.history) && stored.history.includes(date);
    return {
      ...seed,
      id,
      date,
      dayOfCycle: seed.day,
      hook: stored.hook || seed.hook,
      cta: stored.cta || seed.cta,
      filmed: stored.status === 'filmed',
      posted,
      status: posted ? 'posted' : stored.status === 'filmed' ? 'filmed' : 'planned',
      formatLabel: playbook.FORMAT_LABELS[seed.format] || seed.format,
      isToday: date === today,
      isPast: date < today,
      pillarLabel: playbook.PILLARS[seed.pillar].label,
      pillarColor: playbook.PILLARS[seed.pillar].color,
    };
  });

  const stats = {
    posted: items.filter(i => i.posted).length,
    filmed: items.filter(i => !i.posted && i.filmed).length,
    due: items.filter(i => !i.posted && i.date <= today).length,
    total: items.length,
    byPillar: Object.keys(playbook.PILLARS).map(k => ({
      key: k,
      label: playbook.PILLARS[k].label,
      color: playbook.PILLARS[k].color,
      planned: items.filter(i => i.pillar === k).length,
      posted: items.filter(i => i.pillar === k && i.posted).length,
      share: playbook.PILLARS[k].share,
    })),
  };

  const todays = items.find(i => i.date === today) || null;
  return { items, today: todays, stats, dayNumber: dn, cycle, cycleStart, startDate: start };
}

function scriptFor(item) {
  if (!item) return null;
  const frames = playbook.SCRIPT_FRAMES[item.format] || playbook.SCRIPT_FRAMES.R;
  const teach = playbook.TEACHING[item.pillar] || [];
  const lines = [];
  lines.push(`HOOK — ${item.hook}`);
  if (item.format === 'C') {
    lines.push('');
    lines.push('SLIDE 1: the hook above, big and plain.');
    teach.forEach((t, i) => lines.push(`SLIDE ${i + 2}: ${t}`));
    lines.push('SLIDE 5: one example or teardown — [screenshot with permission, never invented].');
    lines.push(`SLIDE 6: ${item.cta}.`);
  } else {
    lines.push('');
    lines.push('PROBLEM (3–20s): name it plainly. They are posting and nobody is paying.');
    teach.forEach((t, i) => lines.push(`MECHANISM ${i + 1} (20–40s): ${t}`));
    lines.push('PROOF (40–55s): show a real screen or say the real number. [your number].');
    lines.push(`COMMAND (55–60s): ${item.cta}. Say the keyword twice — on camera and on screen.`);
  }
  if (item.format.includes('F')) {
    lines.push('');
    lines.push('FACEBOOK TWIN: cross-post the Reel the same day. 3x/week turn it into a native text post, value first, link in the comments.');
  }
  return {
    id: item.id,
    frames,
    text: lines.join('\n'),
    caption:
`${item.hook}

${item.cta}.

Follow @{{handle}} if you are starting from zero and actually want to sell something.

#digitalproducts #personalbrand #creativebusiness`,
  };
}

// ── leads / DMs ─────────────────────────────────────────────────────────────
const LEAD_STAGES = [
  { key: 'new', label: 'New reply', color: 'blue', hint: 'Ask SELLING or DECIDING — one question, not a quiz.' },
  { key: 'deciding', label: 'Deciding', color: 'gold', hint: 'Send the Map. Offer the $27 weekend kit only.' },
  { key: 'selling', label: 'Selling', color: 'violet', hint: 'They have a product. The account is the leak — $147.' },
  { key: 'hot', label: 'Link sent', color: 'green', hint: 'One link. One next step. Then be quiet.' },
  { key: 'bought', label: 'Bought', color: 'green', hint: 'Onboard personally. Ask for the offer screenshot.' },
  { key: 'lost', label: 'Lost / cold', color: 'dim', hint: 'No guilt. Keep posting proof; they may come back.' },
];
const LEAD_STAGE_KEYS = LEAD_STAGES.map(s => s.key);

function leadView(state, today) {
  const leads = (state.leads || []).map(l => {
    const due = l.nextActionAt && l.nextActionAt <= today;
    return {
      ...l,
      due,
      overdueDays: l.nextActionAt ? Math.max(0, diffDays(l.nextActionAt, today)) : 0,
      stageLabel: (LEAD_STAGES.find(s => s.key === l.stage) || LEAD_STAGES[0]).label,
      stageColor: (LEAD_STAGES.find(s => s.key === l.stage) || LEAD_STAGES[0]).color,
      stageHint: (LEAD_STAGES.find(s => s.key === l.stage) || LEAD_STAGES[0]).hint,
      nextScript: suggestScript(l),
    };
  }).sort((a, b) => {
    if (a.stage === 'bought' || a.stage === 'lost') return 1;
    if (b.stage === 'bought' || b.stage === 'lost') return -1;
    return (a.nextActionAt || '9999') < (b.nextActionAt || '9999') ? -1 : 1;
  });

  const active = leads.filter(l => !['bought', 'lost'].includes(l.stage));
  return {
    leads,
    stages: LEAD_STAGES,
    counts: LEAD_STAGE_KEYS.reduce((acc, k) => { acc[k] = leads.filter(l => l.stage === k).length; return acc; }, {}),
    active: active.length,
    due: active.filter(l => l.due).length,
    bought: leads.filter(l => l.stage === 'bought').length,
    scripts: playbook.SCRIPTS,
  };
}

function suggestScript(lead) {
  if (!lead) return 'dm1';
  if (lead.stage === 'deciding') return 'dm2a';
  if (lead.stage === 'selling') return 'dm2b';
  if (lead.stage === 'hot') return 'dm5';
  if (lead.stage === 'bought') return null;
  if (lead.stage === 'new') return 'dm1';
  return 'dm3';
}

// ── funnel ──────────────────────────────────────────────────────────────────
function funnelView(funnel = {}) {
  const v = Number(funnel.views) || 0;
  const c = Number(funnel.comments) || 0;
  const d = Number(funnel.dmReplies) || 0;
  const k = Number(funnel.clicks) || 0;
  const p = Number(funnel.purchases) || 0;

  const rates = {
    commentRate: pct(c, v),
    dmRate: pct(d, c),
    clickRate: pct(k, d),
    closeRate: pct(p, k),
    overall: pct(p, v),
  };

  const checks = playbook.BENCHMARKS.map(b => {
    const value = rates[b.key];
    let status = 'no-data';
    if (value != null) status = value < b.min ? 'low' : value > b.max ? 'high' : 'ok';
    return { ...b, value, status };
  });

  const diagnosis = [];
  if (!v && !d && !k && !p) {
    diagnosis.push('No funnel numbers yet. Log a week of views, comments, DM replies, clicks and purchases — you cannot fix a leak you cannot see.');
  } else {
    if (v > 0 && rates.commentRate < 1) diagnosis.push('Comments are low. The keyword is unclear or the CTA is buried — say it twice and put it on screen.');
    if (c > 0 && rates.dmRate < 40) diagnosis.push('DMs are empty. The auto-DM is not firing or the keyword is not trained — test it from a second account tonight.');
    if (d > 0 && rates.clickRate < 20) diagnosis.push('People reply but do not click. The promise is fuzzy — send one link and one next step, no PDF dumps.');
    if (k > 0 && rates.closeRate < 8) diagnosis.push('Clicks are not converting. The checkout page or the trust is the leak — add proof, the guarantee, and what is inside.');
    if (!diagnosis.length) diagnosis.push('Funnel is inside benchmark range. Keep posting, keep the 18:30 DM shift, and raise the price before the proof gets stale.');
    if (p > 0 && rates.overall != null && rates.overall < 0.1) diagnosis.push('Purchases per view are under 0.1% — that is normal early. Fix comments before touching the offer.');
  }

  return {
    values: { views: v, comments: c, dmReplies: d, clicks: k, purchases: p },
    rates,
    checks,
    diagnosis,
    updated: funnel.updated || null,
    hasData: Boolean(v || c || d || k || p),
    note: funnel.note || '',
  };
}

// ── 90-day plan ─────────────────────────────────────────────────────────────
function phaseFor(dn) {
  return playbook.PLAN.find(p => dn >= p.from && dn <= p.to) || playbook.PLAN[playbook.PLAN.length - 1];
}

function planView(state, today) {
  const dn = dayNumber(state.settings.startDate, today);
  const phases = (state.plan || []).map(p => {
    const tasks = p.tasks || [];
    const done = tasks.filter(t => t.done).length;
    return {
      ...p,
      tasks,
      done,
      total: tasks.length,
      progress: tasks.length ? round((done / tasks.length) * 100) : 0,
      active: dn >= p.from && dn <= p.to,
      past: dn > p.to,
    };
  });
  const all = phases.flatMap(p => p.tasks);
  const doneAll = all.filter(t => t.done).length;
  const active = phases.find(p => p.active) || phases[phases.length - 1];
  const nextTask = active.tasks.find(t => !t.done) || all.find(t => !t.done) || null;
  return {
    phases,
    dayNumber: dn,
    active,
    done: doneAll,
    total: all.length,
    progress: all.length ? round((doneAll / all.length) * 100) : 0,
    nextTask,
    milestone: active && active.outcome ? active.outcome : '',
  };
}

// ── offer orchestration ─────────────────────────────────────────────────────
function nextOfferMove(state, today, offerRows, money) {
  const o = id => offerRows.find(x => x.id === id) || { status: 'idea', price: 0, name: id };
  const sold = id => sumSales((state.sales || []).filter(s => s.offerId === id));
  const units = id => unitsSold((state.sales || []).filter(s => s.offerId === id));
  const dn = dayNumber(state.settings.startDate, today);

  if (o('map').status === 'idea') {
    return {
      id: 'map', offerId: 'map', title: 'Publish the Buyable Offer Map',
      detail: 'The free one-pager is the top of every funnel. Seven lines, one page — not a design project.',
      why: 'Nothing else can be sold until a stranger has a reason to reply.',
      minutes: 45, tab: 'offers',
    };
  }
  if (o('weekend').status !== 'live' && o('weekend').status !== 'proven') {
    return {
      id: 'weekend', offerId: 'weekend', title: 'Ship the $27 weekend kit',
      detail: 'Build your own v1 this week. Templates from your last project are enough.',
      why: 'You cannot teach shipping v1 if you have not shipped v1 — and $27 is the first yes.',
      minutes: 60, tab: 'offers',
    };
  }
  if (units('weekend') < 10) {
    return {
      id: 'first-ten', offerId: 'weekend', title: `Sell the $27 kit to ${10 - units('weekend')} more people`,
      detail: 'DM everyone who replied in the last 14 days. Ask what confused them after they buy.',
      why: 'Ten buyers is the filter that tells you the promise works.',
      minutes: 25, tab: 'dms',
    };
  }
  if (o('brand').status !== 'live' && o('brand').status !== 'proven') {
    return {
      id: 'core', offerId: 'brand', title: 'Open The Buyable Brand at $97',
      detail: 'Record Modules 0–8 as looms — imperfect. Add the guarantee and the 14-day plan.',
      why: 'This is the product that can carry $10k/month.',
      minutes: 90, tab: 'offers',
    };
  }
  if (units('brand') < 10) {
    return {
      id: 'core-ten', offerId: 'brand', title: `Personally onboard core buyers (${units('brand')}/10)`,
      detail: 'Ask each new buyer for their one-sentence offer. That reply is content and proof.',
      why: 'Ten testimonials turn the checkout page from a claim into evidence.',
      minutes: 30, tab: 'dms',
    };
  }
  if (o('review').status === 'idea' && dn > 30) {
    return {
      id: 'review', offerId: 'review', title: 'Add the $297 review — only if DMs outpace you',
      detail: 'Async teardown, one round of notes. Cap it at 10/month.',
      why: 'Margin without a new audience. But it is wasted before the offer is named.',
      minutes: 45, tab: 'offers',
    };
  }
  if (o('brand').status === 'live' && Number(o('brand').price) < 147 && dn > 30) {
    return {
      id: 'raise', offerId: 'brand', title: 'Raise the core offer to $147',
      detail: 'Launch window is over. Raise it in public — the post is the announcement.',
      why: 'Underpricing signals “hobby”. $147 is the plan’s standard.',
      minutes: 20, tab: 'offers',
    };
  }
  if (dn > 60) {
    return {
      id: 'launch', offerId: 'brand', title: 'Run the 7-day mini-launch',
      detail: 'Seven days of content + Stories + emails. One keyword, one deadline, one link.',
      why: 'Authority brands launch on a calendar, not on a mood.',
      minutes: 60, tab: 'content',
    };
  }
  if (money.status === 'cold' && money.dayOfMonth > 14) {
    return {
      id: 'cash', offerId: 'brand', title: 'Run a 72-hour proof push',
      detail: 'Three proof Reels, one objecton-busting carousel, one Stories Q&A. Sell the $27 kit in DMs.',
      why: 'No sales by mid-month is a signal, not a mystery. Give the funnel something to convert.',
      minutes: 40, tab: 'content',
    };
  }
  return {
    id: 'proof', offerId: 'brand', title: 'Ask every buyer for a testimonial',
    detail: 'One screenshot, one sentence. Put it on the checkout page and in the next carousel.',
    why: 'Proof compounds faster than content at this stage.',
    minutes: 20, tab: 'dms',
  };
}

// ── daily checklist ─────────────────────────────────────────────────────────
function checklistFor({ content, leads, offerMove, funnel, state, today }) {
  const done = (state.checkins[today] || {}).done || {};
  const piece = content.today;
  const items = [
    {
      id: 'post',
      label: piece ? `Post today’s ${piece.formatLabel}` : 'Post today’s piece',
      hint: piece ? piece.hook : 'Rest day — repost your best proof.',
      tab: 'content',
      done: Boolean(done.post || (piece && piece.posted)),
    },
    {
      id: 'stories',
      label: 'Stories: 4–8 frames (12:00)',
      hint: 'Behind the scenes, a poll, one piece of proof.',
      tab: 'content',
      done: Boolean(done.stories),
    },
    {
      id: 'dms',
      label: leads.due ? `DM shift (18:30) — ${leads.due} follow-up${leads.due === 1 ? '' : 's'} due` : 'DM shift (18:30)',
      hint: leads.due ? 'Warm leads go cold in 72 hours. This is the highest-revenue 20 minutes.' : 'Reply to every reply. One question, one link.',
      tab: 'dms',
      done: Boolean(done.dms),
    },
    {
      id: 'engage',
      label: 'Reply to every comment + 10 real comments',
      hint: 'First 30 minutes after posting decide reach.',
      tab: 'content',
      done: Boolean(done.engage),
    },
    {
      id: 'offer',
      label: offerMove.title,
      hint: offerMove.detail,
      tab: offerMove.tab,
      done: Boolean(done.offer),
    },
    {
      id: 'numbers',
      label: 'Log today’s numbers',
      hint: 'Views, comments, DM replies, clicks, purchases.',
      tab: 'money',
      done: Boolean(done.numbers || funnel.updated === today),
    },
  ];
  const doneCount = items.filter(i => i.done).length;
  return {
    items,
    done: doneCount,
    total: items.length,
    progress: round((doneCount / items.length) * 100),
    note: (state.checkins[today] || {}).note || '',
    complete: doneCount === items.length,
  };
}

function streak(state, today) {
  let n = 0;
  let cursor = today;
  for (let i = 0; i < 400; i++) {
    const c = state.checkins[cursor];
    const doneCount = c && c.done ? Object.values(c.done).filter(Boolean).length : 0;
    if (doneCount >= 3) { n++; cursor = addDays(cursor, -1); continue; }
    if (i === 0) { cursor = addDays(cursor, -1); continue; } // today still in progress
    break;
  }
  return n;
}

// ── orchestrate ─────────────────────────────────────────────────────────────
// The one function the whole app exists for: what matters today, in order.
function orchestrate({ content, leads, offerMove, money, funnel, plan, today }) {
  const actions = [];
  const piece = content.today;

  if (leads.due > 0) {
    actions.push({
      id: 'dms',
      priority: 1,
      title: `Follow up with ${leads.due} lead${leads.due === 1 ? '' : 's'}`,
      detail: 'They replied and went quiet. One question, one recommendation, one link.',
      why: 'Warm leads are the only revenue you can book today.',
      minutes: 20,
      tab: 'dms',
      cta: 'Open DMs',
    });
  }

  if (piece && !piece.posted) {
    actions.push({
      id: 'post',
      priority: 2,
      title: `Post today’s ${piece.formatLabel.toLowerCase()}`,
      detail: `${piece.hook} — ${piece.pillarLabel} · CTA: ${piece.cta}`,
      why: 'Reach is the top of the funnel. A missed day is a missed top of funnel.',
      minutes: 35,
      tab: 'content',
      cta: 'Open the script',
      mark: 'post',
    });
  }

  actions.push({
    id: 'offer',
    priority: money.status === 'cold' && money.dayOfMonth > 14 ? 2 : 3,
    title: offerMove.title,
    detail: offerMove.detail,
    why: offerMove.why,
    minutes: offerMove.minutes,
    tab: offerMove.tab,
    cta: offerMove.tab === 'offers' ? 'Open offer ladder' : 'Open',
  });

  if (plan.nextTask) {
    actions.push({
      id: 'plan',
      priority: 4,
      title: plan.nextTask.label,
      detail: `${plan.active.label} — the phase you are in.`,
      why: `Skipping this phase is how the plan becomes a PDF. Outcome: ${plan.active.outcome}`,
      minutes: 45,
      tab: 'plan',
      cta: 'Open the plan',
    });
  }

  if (money.remaining > 0 && (funnel.updated == null || diffDays(funnel.updated, today) > 7)) {
    actions.push({
      id: 'numbers',
      priority: 5,
      title: 'Log this week’s funnel numbers',
      detail: 'Views → comments → DM replies → clicks → purchases. Five numbers.',
      why: 'Without them you are guessing which step is leaking.',
      minutes: 5,
      tab: 'money',
      cta: 'Log numbers',
    });
  }

  actions.push({
    id: 'engage',
    priority: 6,
    title: 'The 20-minute engagement shift',
    detail: 'Reply to every comment, then leave 10 real comments on accounts your buyer follows.',
    why: 'Half the algorithm. Also where the next DM comes from.',
    minutes: 20,
    tab: 'content',
    cta: 'Open today',
  });

  const sorted = actions.sort((a, b) => a.priority - b.priority || a.minutes - b.minutes);
  const focus = sorted[0] || null;
  return {
    actions: sorted,
    focus,
    summary: `${sorted.length} priorities · about ${sorted.reduce((t, a) => t + a.minutes, 0)} minutes · ${
      money.mtd > 0 ? `$${money.mtd} booked this month` : 'first sale still ahead'
    }`,
    headline: focus ? focus.title : 'Nothing due. Post proof and go live.',
  };
}

// ── client view ─────────────────────────────────────────────────────────────
function compute(state, today = todayStr()) {
  const moneyBase = revenue(state, today);
  const ranking = rankOffers(state, today);
  const offerRows = ranking.offers.map(o => ({ ...o, path: undefined }));
  const money = { ...moneyBase, paths: paths(moneyBase.goalFull, offerRows) };
  const content = contentView(state, today);
  const leads = leadView(state, today);
  const funnel = funnelView(state.funnel);
  const plan = planView(state, today);
  const offerMove = nextOfferMove(state, today, offerRows, money);
  const checklist = checklistFor({ content, leads, offerMove, funnel, state, today });
  const runbook = orchestrate({ content, leads, offerMove, money, funnel, plan, today });

  return {
    today,
    prettyToday: prettyDate(today),
    dayNumber: content.dayNumber,
    cycle: content.cycle,
    phaseLabel: plan.active.label,
    settings: state.settings,
    money,
    ranking,
    offers: offerRows,
    offerMove,
    content,
    leads,
    funnel,
    plan,
    checklist,
    streak: streak(state, today),
    runbook,
    scripts: playbook.SCRIPTS,
    keywords: playbook.KEYWORDS,
    emails: playbook.EMAILS,
    pillars: Object.values(playbook.PILLARS),
    bioOptions: playbook.BIO_OPTIONS,
    cadence: playbook.CADENCE,
    rules: playbook.RULES,
    hooks: playbook.HOOKS,
    bio: playbook.BIO,
    donts: playbook.DONTS,
    contentScript: scriptFor(content.today),
  };
}

module.exports = {
  TZ, todayStr, addDays, diffDays, dayNumber, prettyDate, compute,
  revenue, rankOffers, contentView, scriptFor, funnelView, planView,
  leadView, checklistFor, orchestrate, paths, streak, phaseFor,
  LEAD_STAGES, LEAD_STAGE_KEYS,
};
