// ─────────────────────────────────────────────────────────────────────────────
// workflow.js — the 6-step morning routine as a deterministic rules engine.
//
// INBOX → RESEARCH → CALENDAR → TASKS → FOLLOW-UP → REPORT → (DIGEST)
//
// Faithful to the AI Employee contract (ai-employee/CLAUDE.md):
//   Rule 1 — safe work happens automatically; every external action is
//            written to approvals.md as a checkbox for the boss's yes.
//   Rule 2 — nothing is invented. Drafts slot-fill from the real input and
//            mark unknowns as [bracketed placeholders], never guesses.
//   Rule 3 — honest about capabilities: no Gmail/Calendar/web-search is
//            connected here, so inputs are pasted in and every output says so.
//
// Modes:
//   demo — reads demo/input/*, writes demo/output/* (safe sandbox)
//   live — reads pasted input, writes daily/* (the real workflow files)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const store = require('./store');
const parse = require('./parse');

const OUT = {
  demo: {
    dir: 'demo/output',
    emails: 'demo/input/emails.md', meetings: 'demo/input/meetings.md',
    threads: 'demo/input/threads.md', queue: 'demo/input/research-queue.md',
    inbox: 'demo/output/inbox.md', research: 'demo/output/research.md',
    calendar: 'demo/output/calendar.md', tasks: 'demo/output/tasks.md',
    approvals: 'demo/output/approvals.md', followUp: 'demo/output/follow-up.md',
    report: 'demo/output/report.md', digest: 'demo/output/morning-digest.md',
  },
  live: {
    dir: 'daily',
    emails: null, meetings: null, threads: null, queue: 'research-queue.md',
    inbox: 'daily/inbox.md', research: 'daily/research.md',
    calendar: 'daily/calendar.md', tasks: 'daily/tasks.md',
    approvals: 'daily/approvals.md', followUp: 'daily/follow-up.md',
    report: 'daily/report.md', digest: 'daily/morning-digest.md',
  },
};

const DAY = 86400000;

// ─────────────────────────────────────────────────────────────────────────────
// Shared: load default input for a step (demo mode pre-fills from demo/input)
// ─────────────────────────────────────────────────────────────────────────────
function defaultInput(mode, kind) {
  if (mode === 'demo') return store.read(OUT.demo[kind]) || '';
  return '';
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 1 — INBOX: sort emails into 🔴 Urgent / 🟡 Reply / 🟢 Task / ⚪ Ignore
//           and draft replies in the boss's voice. Drafts only — never sends.
// ═════════════════════════════════════════════════════════════════════════════

function parseEmails(text) {
  if (!text || !text.trim()) return [];
  const emails = [];
  const lines = text.split('\n');
  let cur = null;
  let inBody = false;
  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(?:📧\s*)?(?:Email\s*\d+\s*[—:-]\s*)?(.+)$/i);
    if (h && /email|^to:/i.test(line)) {
      if (cur) emails.push(cur);
      let sender = h[1].trim();
      sender = sender.replace(/\s*·\s*[^·]*$/, '');            // strip "· 08:02"
      cur = { sender: sender.trim() || 'Unknown sender', meta: h[1].trim(), subject: '', body: [] };
      inBody = false;
      continue;
    }
    if (!cur) continue;
    const s = line.match(/\*\*Subject:\*\*\s*(.+)$/);
    if (s) { cur.subject = s[1].trim(); continue; }
    if (/^\s*>/.test(line)) { inBody = true; cur.body.push(line.replace(/^\s*>\s?/, '')); continue; }
    if (inBody && line.trim() === '' ) { cur.body.push(''); continue; }
    if (inBody && !/^[-*|#]/.test(line) && line.trim()) { cur.body.push(line.trim()); }
  }
  if (cur) emails.push(cur);
  for (const e of emails) {
    e.bodyText = e.body.join(' ').replace(/\s+/g, ' ').trim();
    // If the header only carried a sort hint (test-emails.md format), take the
    // sender from the signature line in the body ("— Sarah") instead.
    if (/should sort|optional bonus|bonus/i.test(e.sender)) {
      const sig = e.bodyText.match(/—\s*([A-Z][\w .'-]{1,40})\s*$/) ||
                  e.body.map(l => (l.match(/^—\s*(.+)$/) || [])[1]).filter(Boolean).pop();
      if (sig) e.sender = (Array.isArray(sig) ? sig[1] : sig).trim();
    }
    e.firstName = (e.sender.match(/([A-Z][a-zà-ü]+)/) || [])[1] || 'there';
  }
  return emails.filter(e => e.subject || e.bodyText);
}

const MINERAL_RX = /\b(rfq|offtake|off-take|investor|buyer|copper|cobalt|lithium|gold|ore|concentrate|cathode|mineral|commodity|mine|mining|spec|grade|volume|assay|shipment|shipping)\b/i;
const URGENT_MONEY_RX = /\b(invoice|account)\b[^.]*\b(overdue|hold|suspend|late|final notice)\b|\b(overdue|final notice)\b[^.]*\b(invoice|payment)\b/i;
const TASK_RX = /\b(deposit|proceed|book|booking|venue|renew|availability|hold the date|reservation|subscription)\b/i;
const DEADLINE_RX = /\b(deadline|commit|by (mon|tues|wednes|thurs|fri|satur|sun)\w*|before (mon|tues|wednes|thurs|fri|satur|sun)\w*)\b/i;
const QUESTION_RX = /\?|\b(can you|could you|are we|do we|want us|shall we|thoughts)\b/i;
const REPLY_RX = /\b(quote|quotation|proposal|go\/no-go|your (call|decision)|awaiting|wait(ing)? for|recap|partnership|pricing|terms)\b/i;
const IGNORE_RX = /\b(newsletter|unsubscribe|no-?reply|promotion|promo|digest of|weekly digest|sale|webinar RSVP)\b/i;

function classify(email) {
  const t = `${email.subject} ${email.bodyText}`;
  if (IGNORE_RX.test(t)) return { cat: 'ignore', reason: 'Newsletter / promotional — no action needed' };
  if (MINERAL_RX.test(t)) return { cat: 'urgent', reason: 'Mineral-business email (buyer/RFQ/spec/quote terms) — elevated priority' };
  if (URGENT_MONEY_RX.test(t)) return { cat: 'urgent', reason: 'Overdue invoice / account at risk — money on the line' };
  if (TASK_RX.test(t)) return { cat: 'task', reason: 'Needs an action or decision from me (booking/payment) — not a written reply' };
  if (DEADLINE_RX.test(t) && QUESTION_RX.test(t)) return { cat: 'urgent', reason: 'Time-boxed commitment asked of me before a stated date' };
  if (REPLY_RX.test(t) || QUESTION_RX.test(t)) return { cat: 'reply', reason: 'Waiting on my answer — reply expected' };
  return { cat: 'task', reason: 'Action item — no reply expected' };
}

// Draft a reply in the boss's voice (voice-samples.md: short, direct, one ask,
// "Best, Hendrixx"). Facts come only from the email; unknowns stay bracketed.
function draftReply(email, cls) {
  const name = email.firstName;
  const subj = email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`;
  const t = `${email.subject} ${email.bodyText}`;
  let body;

  if (DEADLINE_RX.test(t) && QUESTION_RX.test(t)) {
    const day = store.fmtDate();
    body = [
      `Thanks for the nudge — straight answer below.`,
      ``,
      `Before I commit to a date, I need to confirm [the open item(s) on my side — fill in]. I'll have a firm yes/no by [day — suggest within 48h].`,
      ``,
      `If we can't hit the date, you'll hear it from me first — with options, not excuses.`,
    ];
  } else if (/\b(quote|quotation|pricing|terms)\b/i.test(t)) {
    body = [
      `Received — thanks for putting it together.`,
      ``,
      `Two questions before I decide:`,
      `1. How long do these terms hold?`,
      `2. What's the payment schedule and what happens if delivery slips?`,
      ``,
      `I'll come back with a decision by [date].`,
    ];
  } else if (/\b(go\/no-go|partnership|recap|propose)\b/i.test(t)) {
    body = [
      `Thanks for the recap — appreciated.`,
      ``,
      `My answer: [your go/no-go — one line].`,
      ``,
      `If it's a go, I suggest a 15-min call [Tue/Thu, EAT] to lock next steps. Does that work?`,
    ];
  } else {
    body = [
      `Thanks for the note.`,
      ``,
      `[One-line response to their specific point — fill in.]`,
      ``,
      `Quick question so I can move: [the one thing you need from them]?`,
    ];
  }

  return {
    to: email.sender,
    subject: subj,
    body: body.join('\n'),
  };
}

function stepInbox(mode, input) {
  const emails = parseEmails(input);
  if (!emails.length) {
    return { ok: false, log: ['INBOX — no emails parsed from input. Paste emails (format: demo/input/emails.md) and re-run. Nothing invented (Rule 2).'] };
  }
  const buckets = { urgent: [], reply: [], task: [], ignore: [] };
  const drafts = [];
  for (const e of emails) {
    const cls = classify(e);
    e.cls = cls;
    buckets[cls.cat].push(e);
    if (cls.cat === 'urgent' || cls.cat === 'reply') drafts.push(draftReply(e, cls));
  }

  const stamp = store.fmtStamp();
  const demoTag = mode === 'demo' ? ' · ⚠️ Demo run' : '';
  const md = [];
  md.push(`# 📥 INBOX — Email Sort & Drafts`);
  md.push('');
  md.push(`*Generated: ${stamp}${demoTag} — rules engine, no Gmail connected (Rule 3). Drafts only — nothing sent.*`);
  md.push('');
  md.push(`## Sorted Emails`);
  md.push('');
  md.push(`### 🔴 Urgent`);
  md.push(`| From | Subject | Reason | Status |`);
  md.push(`|------|---------|--------|--------|`);
  if (buckets.urgent.length) {
    for (const e of buckets.urgent) md.push(`| ${e.sender} | ${e.subject} | ${e.cls.reason} | **Draft ready** |`);
  } else md.push(`| — | — | — | — |`);
  md.push('');
  md.push(`### 🟡 Reply`);
  md.push(`| From | Subject | Reason | Status |`);
  md.push(`|------|---------|-------|--------|`);
  if (buckets.reply.length) {
    for (const e of buckets.reply) md.push(`| ${e.sender} | ${e.subject} | ${e.cls.reason} | **Draft ready** |`);
  } else md.push(`| — | — | — | — |`);
  md.push('');
  md.push(`### 🟢 Task`);
  md.push(`| From | Subject | Action Needed |`);
  md.push(`|------|---------|---------------|`);
  if (buckets.task.length) {
    for (const e of buckets.task) {
      const act = URGENT_MONEY_RX.test(`${e.subject} ${e.bodyText}`)
        ? 'Arrange payment / resolve account risk'
        : 'Decide + authorize (goes to approvals — needs my yes)';
      md.push(`| ${e.sender} | ${e.subject} | ${act} |`);
    }
  } else md.push(`| — | — | — |`);
  md.push('');
  md.push(`### ⚪ Ignore`);
  md.push(`| From | Subject | Reason |`);
  md.push(`|------|---------|--------|`);
  if (buckets.ignore.length) {
    for (const e of buckets.ignore) md.push(`| ${e.sender} | ${e.subject} | ${e.cls.reason} |`);
  } else md.push(`| — | — | — |`);
  md.push('');
  md.push(`---`);
  md.push('');
  md.push(`## Drafted Replies *(drafts only — nothing sent)*`);
  md.push('');
  drafts.forEach((d, i) => {
    md.push(`### ➡️ Draft ${i + 1} — To ${d.to}`);
    md.push('');
    md.push(`> **Subject:** ${d.subject}`);
    md.push(`>`);
    for (const line of d.body.split('\n')) { md.push(`> ${line}`); }
    md.push('');
  });
  md.push(`---`);
  md.push('');
  md.push(`*Bracketed [items] need your input before sending — Rule 2: no invented facts. Approvals queued in \`approvals.md\`.*`);

  store.write(OUT[mode].inbox, md.join('\n'));
  const counts = {
    total: emails.length, urgent: buckets.urgent.length, reply: buckets.reply.length,
    task: buckets.task.length, ignore: buckets.ignore.length, drafts: drafts.length,
  };
  return {
    ok: true, file: OUT[mode].inbox, counts, drafts, emails: emails.map(e => ({
      sender: e.sender, subject: e.subject, cat: e.cls.cat, reason: e.cls.reason,
    })),
    log: [`INBOX — ${emails.length} emails sorted: 🔴${counts.urgent} · 🟡${counts.reply} · 🟢${counts.task} · ⚪${counts.ignore} → ${counts.drafts} replies drafted → ${OUT[mode].inbox}`],
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 2 — RESEARCH: take the next pending topic from the queue (or an
// explicit topic) and lay out the brief. No web search connected → the brief
// is a structured skeleton + pasted notes; empty sections are flagged as
// NEEDS SOURCE, never filled with guesses (Rule 2).
// ═════════════════════════════════════════════════════════════════════════════

function stepResearch(mode, input) {
  const queueFile = OUT[mode].queue;
  let topic = (input || '').split('\n').map(l => l.trim()).filter(Boolean)[0] || '';
  let pastedNotes = (input || '').split('\n').slice(1).join('\n').trim();

  const q = parse.parseResearchQueue(store.read(queueFile));
  let fromQueue = false;
  if (!topic) {
    if (!q.pending.length) {
      return { ok: false, log: ['RESEARCH — queue is empty and no topic given. Skipping (never invents a topic — Rule 2).'] };
    }
    topic = q.pending[0].topic;
    fromQueue = true;
  }

  const stamp = store.fmtStamp();
  const demoTag = mode === 'demo' ? ' · ⚠️ Demo run' : '';
  const sections = [
    ['Who they are', 'company / fund type, size, ownership'],
    ['What minerals they source or invest in', 'commodities, volumes, geographies'],
    ['Recent deals or contracts', 'last 12–24 months, with dates'],
    ['Decision-makers to contact', 'names + titles, with source for each'],
    ['3 things worth knowing before I engage', 'hooks that tie to what we supply'],
  ];
  const md = [];
  md.push(`# 🔬 RESEARCH — Brief`);
  md.push('');
  md.push(`*Topic: **${topic}** · Generated: ${stamp}${demoTag} — no web search connected (Rule 3): sections below are the brief structure. Fill from real sources — SEC/JSE/ASX filings, USGS, trade press, company site. Nothing here is invented.*`);
  md.push('');
  for (const [title, hint] of sections) {
    md.push(`## ${title}`);
    md.push('');
    md.push(`> [NEEDS SOURCE — paste verified findings here. ${hint}.]`);
    md.push('');
  }
  if (pastedNotes) {
    md.push(`## Pasted notes (attributed verbatim — verify before relying on)`);
    md.push('');
    for (const line of pastedNotes.split('\n')) md.push(`> ${line}`);
    md.push('');
  }
  md.push(`---`);
  md.push('');
  md.push(`*Facts vs guesses: everything above is flagged until a real source is pasted. Cite the source next to each claim.*`);

  store.write(OUT[mode].research, md.join('\n'));

  const logs = [`RESEARCH — brief skeleton for "${topic}" → ${OUT[mode].research} (no web search connected — sections flagged NEEDS SOURCE)`];
  if (fromQueue) {
    moveQueueItemToDone(queueFile, q.pending[0], OUT[mode].research);
    logs.push(`RESEARCH — queue item moved to Done: "${topic}"`);
  }
  return { ok: true, file: OUT[mode].research, topic, log: logs };
}

function moveQueueItemToDone(queueFile, item, briefPath) {
  const raw = store.read(queueFile);
  if (raw == null) return;
  const lines = raw.split('\n');
  lines[item.lineNo] = null;
  // Append row into the Done table (after its header + separator)
  let out = [];
  let inserted = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === null) continue;
    out.push(line);
    if (!inserted && /^\|\s*Date\s*\|/.test(line)) {
      if (/^\|[\s:|-]+\|?\s*$/.test(lines[i + 1] || '')) { out.push(lines[i + 1]); i++; }
      out.push(`| ${store.fmtDate()} | ${item.topic} | \`${briefPath}\` |`);
      inserted = true;
    }
  }
  if (!inserted) {
    out.push('');
    out.push(`## Done`);
    out.push(`| Date | Topic | Brief saved to |`);
    out.push(`|------|-------|----------------|`);
    out.push(`| ${store.fmtDate()} | ${item.topic} | \`${briefPath}\` |`);
  }
  store.write(queueFile, out.join('\n'));
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 3 — CALENDAR: meeting prep notes with context pulled from real repo
// data (research brief + PROSPECTS.md). No calendar connected → meetings are
// pasted in (Rule 3).
// ═════════════════════════════════════════════════════════════════════════════

function parseMeetings(text) {
  if (!text || !text.trim()) return [];
  const meetings = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\|\s*(\d{1,2}:\d{2})\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]*)\|/);
    if (m && !/time/i.test(m[1])) {
      meetings.push({ time: m[1].trim(), name: m[2].trim(), with: m[3].trim(), note: m[4].trim() });
    }
  }
  return meetings;
}

function findContext(meeting, mode) {
  const research = store.read(OUT[mode].research) || '';
  const { prospects } = parse.parseProspects();
  const bits = [];
  const words = `${meeting.name} ${meeting.with}`.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  for (const p of prospects) {
    const ptxt = `${p.name} ${p.needs} ${p.notes}`.toLowerCase();
    if (words.some(w => ptxt.includes(w))) {
      bits.push(`Prospect match — **${p.name}** (${p.stageLabel}): ${p.needs}. Next step on file: ${p.nextStep || '(none set)'}.`);
    }
  }
  if (research) {
    const topicM = research.match(/Topic: \*\*(.+?)\*\*/);
    if (topicM && words.some(w => topicM[1].toLowerCase().includes(w))) {
      bits.push(`Research brief on file: "${topicM[1].trim()}" — see ${OUT[mode].research}.`);
    }
  }
  if (meeting.note) bits.push(`From the calendar note: ${meeting.note}`);
  return bits;
}

function stepCalendar(mode, input) {
  const meetings = parseMeetings(input);
  if (!meetings.length) {
    return { ok: false, log: ['CALENDAR — no meetings parsed from input. Paste the meeting table (format: demo/input/meetings.md). No calendar connected — nothing invented (Rules 2–3).'] };
  }
  const stamp = store.fmtStamp();
  const demoTag = mode === 'demo' ? ' · ⚠️ Demo run — fictional meetings' : ' — no calendar connected, meetings pasted in';
  const md = [];
  md.push(`# 📅 CALENDAR — Meeting Prep Notes`);
  md.push('');
  md.push(`*Generated: ${stamp}${demoTag}*`);
  meetings.forEach((m, i) => {
    const ctx = findContext(m, mode);
    md.push('');
    md.push(`## Meeting ${i + 1}: ${m.name} — ${m.with}`);
    md.push(`- **Time:** ${m.time} EAT`);
    md.push(`- **With:** ${m.with}`);
    md.push('');
    md.push(`### Context`);
    md.push(ctx.length ? ctx.join(' ') : 'No prior context found in research briefs or PROSPECTS.md — pull context from the thread/email before the call.');
    md.push('');
    md.push(`### 3 Talking Points`);
    md.push(`1. ${m.note || 'Their priority — confirm it first'}`);
    md.push(`2. Our spec / terms — what we can actually offer (numbers ready)`);
    md.push(`3. Next step — one concrete action with a date`);
    md.push('');
    md.push(`### Desired Outcome`);
    md.push(`Agree one concrete next step with a date before the call ends.`);
    md.push('');
    md.push('---');
  });
  store.write(OUT[mode].calendar, md.join('\n'));
  return { ok: true, file: OUT[mode].calendar, count: meetings.length,
    log: [`CALENDAR — ${meetings.length} meetings prepped → ${OUT[mode].calendar}`] };
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 4 — TASKS: read the generated inbox + calendar files, do the safe work
// (mark done), and queue every external action in approvals.md (Rule 1).
// ═════════════════════════════════════════════════════════════════════════════

function stepTasks(mode) {
  const inboxMd = store.read(OUT[mode].inbox);
  const calMd = store.read(OUT[mode].calendar);
  if (inboxMd == null && calMd == null) {
    return { ok: false, log: ['TASKS — no inbox.md / calendar.md found for this mode. Run INBOX (and CALENDAR) first.'] };
  }

  // Re-read what the earlier steps actually produced (honest accounting).
  const urgent = parse.parseTable(inboxMd, /^### 🔴/);
  const reply = parse.parseTable(inboxMd, /^### 🟡/);
  const task = parse.parseTable(inboxMd, /^### 🟢/);
  const ignore = parse.parseTable(inboxMd, /^### ⚪/);
  const drafts = (inboxMd.match(/### ➡️ Draft \d+ — To (.+)$/gm) || []).map(s => s.replace(/### ➡️ Draft \d+ — To /, ''));
  const meetings = (calMd.match(/^## Meeting \d+: (.+)$/gm) || []).map(s => s.replace(/^## Meeting \d+: /, ''));

  const approvalItems = [];
  for (const d of drafts) approvalItems.push({
    title: `Send reply to ${d}`,
    detail: `draft ready in ${OUT[mode].inbox} — review the 7-point checklist before sending`,
  });
  for (const row of task) {
    if (row.length >= 2) approvalItems.push({
      title: `Act on: ${row[1]} (from ${row[0]})`,
      detail: row[2] || 'external action — needs my yes',
    });
  }
  for (const m of meetings) approvalItems.push({
    title: `Send follow-up after: ${m}`,
    detail: 'meeting recap + next step (voice-sample §16)',
  });

  const stamp = store.fmtStamp();
  const demoTag = mode === 'demo' ? ' · ⚠️ Demo run' : '';
  const md = [];
  md.push(`# ✅ TASKS — Action List`);
  md.push('');
  md.push(`*Generated: ${stamp}${demoTag}*`);
  md.push('');
  md.push(`## ✅ Done (Safe — Completed Automatically)`);
  md.push(`| Task | Notes |`);
  md.push(`|-----|-------|`);
  const sortedNote = `🔴${urgent.length} · 🟡${reply.length} · 🟢${task.length} · ⚪${ignore.length}`;
  md.push(`| Sorted inbox | ${sortedNote} |`);
  for (const d of drafts) md.push(`| Drafted reply to ${d} | in \`${OUT[mode].inbox}\` — awaiting approval |`);
  for (const m of meetings) md.push(`| Prepped: ${m} | \`${OUT[mode].calendar}\` — context + talking points |`);
  md.push('');
  md.push(`## ⏸️ Needs My Approval`);
  md.push(`| Task | Action Required | Source |`);
  md.push(`|------|----------------|--------|`);
  if (approvalItems.length) {
    for (const a of approvalItems) md.push(`| ${a.title} | ${a.detail} | workflow |`);
  } else md.push(`| — | — | — |`);
  md.push('');
  md.push('---');
  md.push('');
  md.push(`*${approvalItems.length} external action(s) queued — nothing happens without your yes.*`);

  store.write(OUT[mode].tasks, md.join('\n'));

  // Merge new approval items into approvals.md (dedupe by title).
  // Demo mode regenerates the awaiting list from scratch (reproducible runs);
  // live mode preserves what's already queued for the boss.
  const merged = mergeApprovals(mode, approvalItems, mode !== 'demo');

  return { ok: true, file: OUT[mode].tasks, approvalsFile: OUT[mode].approvals,
    approvalsQueued: merged.added,
    log: [`TASKS — ${drafts.length} drafts + ${meetings.length} preps marked done; ${merged.added} external action(s) queued → ${OUT[mode].approvals}`] };
}

// Rewrite the Awaiting section of approvals.md. When `preserve` is true
// (live mode), items already queued are kept and new ones merged in (dedupe
// by normalized title). When false (demo mode), the awaiting list is
// regenerated so every demo run is reproducible. The done log is always kept.
function mergeApprovals(mode, items, preserve) {
  const file = OUT[mode].approvals;
  const existing = parse.parseApprovals(store.read(file));
  const keep = preserve ? existing.awaiting : [];
  const stamp = store.fmtStamp();
  const demoTag = mode === 'demo' ? ' *(DEMO OUTPUT)*' : '';
  const have = new Set(keep.map(a => normTitle(a.title)));
  const added = [];

  const lines = [];
  lines.push(`# ⏸️ NEEDS MY APPROVAL — External Actions Checklist${demoTag}`);
  lines.push('');
  lines.push(`*Generated: ${stamp}${mode === 'demo' ? ' · ⚠️ Demo run' : ''}*`);
  lines.push('');
  lines.push(`> Every item here requires **your explicit yes** before anything happens.`);
  lines.push('');
  lines.push(`## ⏸️ Awaiting Approval`);
  for (const a of keep) {
    const ctx = a.context ? ` (${a.context})` : '';
    const det = a.detail ? ` — ${a.detail}` : '';
    lines.push(`- [ ] **${a.title}**${ctx}${det}`);
  }
  for (const it of items) {
    if (have.has(normTitle(it.title))) continue;
    added.push(it);
    lines.push(`- [ ] **${it.title}** — ${it.detail}`);
  }
  if (!keep.length && !items.length) lines.push(`- (none)`);
  lines.push('');
  lines.push(`## ✅ Approved & Done (log)`);
  lines.push(`| Date | Item | How It Was Done |`);
  lines.push(`|------|------|-----------------|`);
  const realDone = existing.done.filter(d => d.date !== '—');
  if (realDone.length) {
    for (const d of realDone) lines.push(`| ${d.date} | ${d.rest[0] || ''} | ${(d.rest.slice(1).join(' | ') || '').replace(/\s*\|\s*$/, '')} |`);
  } else {
    lines.push(`| — | — | — |`);
  }
  store.write(file, lines.join('\n') + '\n');
  return { added: added.length };
}

function normTitle(t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }

// ═════════════════════════════════════════════════════════════════════════════
// STEP 5 — FOLLOW-UP: parse past threads, compute who's due, draft nudges
// using the bump scripts from crm/SEQUENCES.md. Drafts only.
// ═════════════════════════════════════════════════════════════════════════════

function parseThreads(text) {
  if (!text || !text.trim()) return [];
  const threads = [];
  let cur = null;
  for (const line of text.split('\n')) {
    const h = line.match(/^### Thread:\s*(.+)$/);
    if (h) {
      if (cur) threads.push(cur);
      const tm = h[1].match(/^(.+?)\s*[—-]{1,2}\s*(.*)$/);
      cur = { person: (tm ? tm[1] : h[1]).trim(), topic: (tm ? tm[2] : '').trim(), touches: [], owesMe: null, iOwe: null };
      continue;
    }
    if (!cur) continue;
    const t = line.match(/^-\s+((?:\d{4}-\d{2}-\d{2})|(?:[A-Za-z]{3,9}\.?\s+\d{1,2}))\s+\(([^)]+)\):\s*"?(.+?)"?\s*$/);
    if (t) {
      const date = store.parseLooseDate(t[1]);
      cur.touches.push({ date, who: t[2].trim().toLowerCase() === 'you' ? 'you' : t[2].trim(), text: t[3].trim() });
      continue;
    }
    const owe = line.match(/\*\*→\s*(.+?)\*\*/);
    if (owe) {
      const s = owe[1];
      if (/you owe/i.test(s)) cur.iOwe = s;
      else if (/waiting on|needs your|awaiting/i.test(s)) cur.owesMe = s;
    }
  }
  if (cur) threads.push(cur);
  for (const th of threads) {
    th.lastTouch = th.touches.length ? th.touches[th.touches.length - 1] : null;
    th.lastDate = th.lastTouch ? th.lastTouch.date : null;
    th.days = store.daysSince(th.lastDate);
  }
  return threads.filter(t => t.touches.length || t.iOwe || t.owesMe);
}

function nudgeDraft(thread) {
  const first = (thread.person.match(/([A-Z][a-zà-ü]+)/) || [])[1] || 'there';
  const last = thread.lastTouch ? thread.lastTouch.text.slice(0, 80) : '';
  const d = thread.days == null ? null : thread.days;
  if (thread.iOwe) {
    return {
      subject: thread.topic ? `Re: ${thread.topic}` : 'Following up',
      body: `Hi ${first},\n\nCircling back on this — I owe you an answer on [the go/no-go / decision].\n\n[Your one-line answer.] If it's a go, I suggest a 15-min call this week — Tue or Thu, EAT.\n\nBest,\nHendrixx`,
      kind: `you owe a reply (${d == null ? '?' : d} days since last touch)`,
    };
  }
  if (d != null && d >= 21) {
    return {
      subject: 'Closing the loop',
      body: `Hi ${first},\n\nDon't want to keep pinging. Closing the loop on this one — if timing's not right, no worries; we can revisit when it is.\n\nBest,\nHendrixx`,
      kind: `Bump 3 — last-touch close-out (${d} days of silence)`,
    };
  }
  if (d != null && d >= 14) {
    return {
      subject: 'Quick question',
      body: `Hi ${first},\n\nSaw [relevant news / change on your side] — made me think of where we left this.\n\n[One-line question tied to your stated need.]\n\nBest,\nHendrixx`,
      kind: `Bump 2 — different angle (${d} days of silence)`,
    };
  }
  return {
    subject: thread.topic ? `Re: ${thread.topic}` : 'Following up',
    body: `Hi ${first},\n\nWanted to make sure this didn't get buried — any thoughts on [the proposal / quote / ask]?\n\nHappy to jump on a 5-min call if useful.\n\nBest,\nHendrixx`,
    kind: `Bump 1 — gentle nudge (${d == null ? '?' : d} days since last touch)`,
  };
}

function stepFollowUp(mode, input) {
  const threads = parseThreads(input);
  if (!threads.length) {
    return { ok: false, log: ['FOLLOW-UP — no threads parsed from input. Paste threads (format: demo/input/threads.md). Never invents a conversation (Rule 2).'] };
  }
  const iOwe = [], waiting = [];
  for (const th of threads) {
    if (th.iOwe) iOwe.push(th);
    else waiting.push(th);
  }
  const due = [...iOwe, ...waiting.filter(t => t.days != null && t.days >= 5)];

  const stamp = store.fmtStamp();
  const demoTag = mode === 'demo' ? ' · ⚠️ Demo run' : '';
  const md = [];
  md.push(`# 🔔 FOLLOW-UP — Nudge Drafts`);
  md.push('');
  md.push(`*Generated: ${stamp}${demoTag} — threads pasted in, no Gmail connected. Drafts only.*`);
  md.push('');
  md.push(`## Waiting to Hear From (I sent, waiting on reply)`);
  md.push(`| Person | Last Contact | Days Since | Draft Nudge |`);
  md.push(`|--------|-------------|-----------|-------------|`);
  if (waiting.length) {
    for (const th of waiting) md.push(`| ${th.person} | ${th.lastDate || '—'} | ${th.days == null ? '—' : th.days} | ${th.days != null && th.days >= 5 ? '**Draft ready**' : 'not due yet'} |`);
  } else md.push(`| — | — | — | — |`);
  md.push('');
  md.push(`## I Owe a Reply (They sent, I need to respond)`);
  md.push(`| Person | Last Contact | Days Since | Draft Reply |`);
  md.push(`|--------|-------------|-----------|-------------|`);
  if (iOwe.length) {
    for (const th of iOwe) md.push(`| ${th.person} | ${th.lastDate || '—'} | ${th.days == null ? '—' : th.days} | **Draft ready** |`);
  } else md.push(`| — | — | — | — |`);
  md.push('');
  md.push('---');
  md.push('');
  md.push(`## Drafted Nudges *(drafts only — nothing sent)*`);
  for (const th of due) {
    const d = nudgeDraft(th);
    md.push('');
    md.push(`### ➡️ To ${th.person} — ${d.kind}`);
    md.push('');
    md.push(`> **Subject:** ${d.subject}`);
    md.push(`>`);
    for (const line of d.body.split('\n')) md.push(`> ${line}`);
  }
  md.push('');
  md.push('---');
  md.push('');
  md.push(`*${due.length} follow-up(s) due of ${threads.length} tracked. Bump cadence per crm/SEQUENCES.md (+7 / +14 / +21 / archive at +30).*`);

  store.write(OUT[mode].followUp, md.join('\n'));
  return { ok: true, file: OUT[mode].followUp, due: due.length, total: threads.length,
    log: [`FOLLOW-UP — ${threads.length} threads tracked, ${due.length} due → nudges drafted in ${OUT[mode].followUp}`] };
}

// ═════════════════════════════════════════════════════════════════════════════
// STEP 6 — REPORT: read everything the routine produced and write the honest
// end-of-day briefing. Only counts what actually happened.
// ═════════════════════════════════════════════════════════════════════════════

function stepReport(mode) {
  const inboxMd = store.read(OUT[mode].inbox);
  const calMd = store.read(OUT[mode].calendar);
  const tasksMd = store.read(OUT[mode].tasks);
  const apprMd = store.read(OUT[mode].approvals);
  const fuMd = store.read(OUT[mode].followUp);
  if (!inboxMd && !calMd && !tasksMd) {
    return { ok: false, log: ['REPORT — no workflow outputs found for this mode. Run the earlier steps first.'] };
  }

  const urgent = parse.parseTable(inboxMd, /^### 🔴/).length;
  const reply = parse.parseTable(inboxMd, /^### 🟡/).length;
  const task = parse.parseTable(inboxMd, /^### 🟢/).length;
  const ignore = parse.parseTable(inboxMd, /^### ⚪/).length;
  const total = urgent + reply + task + ignore;
  const drafts = inboxMd ? (inboxMd.match(/### ➡️ Draft \d+/g) || []).length : 0;
  const meetings = calMd ? (calMd.match(/^## Meeting \d+:/gm) || []).length : 0;
  const doneCount = tasksMd ? parse.parseTable(tasksMd, /^## ✅ Done/).length : 0;
  const appr = parse.parseApprovals(apprMd);
  const fu = parse.parseFollowUps(fuMd);
  const followDue = fu.iOwe.length + fu.waitingOnThem.filter(w => /draft/i.test(w.draft)).length;

  const stamp = store.fmtStamp();
  const demoTag = mode === 'demo' ? ' · ⚠️ Demo run' : '';
  const md = [];
  md.push(`# 📊 DAILY REPORT — End-of-Day Briefing${mode === 'demo' ? ' *(DEMO OUTPUT)*' : ''}`);
  md.push('');
  md.push(`*Date: ${stamp}${demoTag}*`);
  md.push('');
  md.push(`## At a Glance`);
  md.push(`| 📥 Inbox | ✍️ Replies | 📅 Meetings | ✅ Tasks Done | 🔔 Follow-Ups Due | ⚠️ Needs Me |`);
  md.push(`|----------|-----------|------------|--------------|------------------|------------|`);
  md.push(`| ${total} sorted | ${drafts} drafted | ${meetings} prepped | ${doneCount} done | ${followDue} | **${appr.awaiting.length}** |`);
  md.push('');
  md.push(`## What Got Done`);
  md.push(`- ${total} emails sorted → 🔴${urgent} urgent · 🟡${reply} reply · 🟢${task} task · ⚪${ignore} ignore`);
  md.push(`- ${drafts} replies drafted in your voice — **nothing sent**`);
  if (meetings) md.push(`- ${meetings} meetings prepped — context + talking points + outcomes`);
  md.push(`- ${doneCount} safe tasks completed automatically`);
  if (fuMd) md.push(`- ${followDue} follow-up(s) due — nudges drafted`);
  md.push('');
  md.push(`## What Needs My Attention`);
  if (appr.awaiting.length) {
    appr.awaiting.slice(0, 8).forEach(a => md.push(`- **${a.title}**${a.context ? ` (${a.context})` : ''} — ${a.note || a.status || 'awaiting your yes'}`));
  } else md.push(`- (nothing queued)`);
  md.push('');
  md.push(`## Decisions Needed`);
  md.push(appr.awaiting.length
    ? `- [ ] Approve or decline the ${appr.awaiting.length} item(s) in \`${OUT[mode].approvals}\` (7-point checklist first)`
    : '- *(none)*');
  md.push('');
  md.push('---');
  md.push('');
  md.push(`*Honest report — only what actually happened. Rules engine run: no Gmail/Calendar/web connected; inputs were pasted in (Rule 3).*`);

  store.write(OUT[mode].report, md.join('\n'));
  return { ok: true, file: OUT[mode].report,
    log: [`REPORT — briefing written → ${OUT[mode].report} (📥${total} · ✍️${drafts} · 📅${meetings} · ⚠️${appr.awaiting.length} need you)`] };
}

// ═════════════════════════════════════════════════════════════════════════════
// DIGEST — format the report as the morning email (templates/morning-digest.md)
// ═════════════════════════════════════════════════════════════════════════════

function stepDigest(mode) {
  const reportMd = store.read(OUT[mode].report);
  if (reportMd == null) {
    return { ok: false, log: ['DIGEST — no report found. Run REPORT first.'] };
  }
  const appr = parse.parseApprovals(store.read(OUT[mode].approvals));
  const calMd = store.read(OUT[mode].calendar) || '';
  const fu = parse.parseFollowUps(store.read(OUT[mode].followUp));
  const glance = reportMd.split('\n').find(l => /^\|\s*\d/.test(l)) || '';

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const now = store.nowEAT();
  const stamp = store.fmtStamp();

  const meetings = calMd ? (calMd.match(/^## Meeting \d+: (.+)$/gm) || []).map(s => s.replace(/^## Meeting \d+: /, '')) : [];
  const glanceCells = glance.split('|').map(c => c.trim()).filter(Boolean);
  const glanceLabels = ['sorted', 'drafted', 'prepped', 'done', 'follow-ups', 'need me'];
  const glanceLine = glanceCells.map((v, i) =>
    /\d\s+\D/.test(v) ? v : `${v} ${glanceLabels[i] || ''}`).join(' · ');
  const md = [];
  md.push(`**To:** Hendrixx`);
  md.push(`**Subject:** ☀️ Morning Digest — ${days[now.getDay()]}, ${store.fmtDate()}`);
  md.push('');
  md.push(`Morning Hendrixx,`);
  md.push('');
  md.push(`Here's where things stand today.`);
  md.push('');
  md.push(`## 📥 Inbox`);
  md.push(`- ${glanceLine || '—'}`);
  md.push('');
  md.push(`## 📅 Meetings Today`);
  if (meetings.length) meetings.forEach(m => md.push(`- ${m} → prep notes in \`${OUT[mode].calendar}\``));
  else md.push(`- (none on file)`);
  md.push('');
  md.push(`## ⏸️ Needs Your Approval`);
  if (appr.awaiting.length) appr.awaiting.forEach(a => md.push(`- [ ] **${a.title}** — ${a.note || a.status || 'details in approvals.md'}`));
  else md.push(`- (nothing awaiting)`);
  md.push('');
  md.push(`## 🔔 Follow-Ups Due`);
  const dueList = [...fu.iOwe, ...fu.waitingOnThem.filter(w => /draft/i.test(w.draft))];
  if (dueList.length) dueList.forEach(f => md.push(`- ${f.person} — ${f.days && f.days !== '—' ? `${f.days} days since last touch` : 'check thread'}`));
  else md.push(`- (none due)`);
  md.push('');
  md.push(`## ⚠️ Decisions Needed Today`);
  md.push(appr.awaiting.length ? `- [ ] The ${appr.awaiting.length} approval(s) above` : `- (none)`);
  md.push('');
  md.push(`Best,`);
  md.push(`Hendrixx`);
  md.push('');
  md.push('---');
  md.push(`*Generated: ${stamp} · Draft only — review before sending. Nothing external happens without your yes.*`);

  store.write(OUT[mode].digest, md.join('\n'));
  return { ok: true, file: OUT[mode].digest, log: [`DIGEST — morning email drafted → ${OUT[mode].digest}`] };
}

// ═════════════════════════════════════════════════════════════════════════════
// The routine: all steps in order
// ═════════════════════════════════════════════════════════════════════════════

const STEPS = {
  inbox:    { title: '1️⃣ INBOX',     fn: (mode, inputs) => stepInbox(mode, inputs.emails) },
  research: { title: '2️⃣ RESEARCH',  fn: (mode, inputs) => stepResearch(mode, inputs.research) },
  calendar: { title: '3️⃣ CALENDAR',  fn: (mode, inputs) => stepCalendar(mode, inputs.meetings) },
  tasks:    { title: '4️⃣ TASKS',     fn: (mode) => stepTasks(mode) },
  followup: { title: '5️⃣ FOLLOW-UP', fn: (mode, inputs) => stepFollowUp(mode, inputs.threads) },
  report:   { title: '6️⃣ REPORT',    fn: (mode) => stepReport(mode) },
  digest:   { title: '📧 DIGEST',     fn: (mode) => stepDigest(mode) },
};

function runStep(step, mode, inputs = {}) {
  const def = STEPS[step];
  if (!def) return { ok: false, log: [`Unknown step: ${step}`] };
  try {
    // Demo mode with no pasted input → fall back to demo/input files, so a
    // bare "run the routine" reproduces the demo end-to-end.
    if (mode === 'demo' && inputs) {
      const filled = { ...inputs };
      for (const k of ['emails', 'meetings', 'threads']) {
        if (!filled[k] || !String(filled[k]).trim()) filled[k] = defaultInput('demo', k);
      }
      return def.fn(mode, filled);
    }
    return def.fn(mode, inputs || {});
  } catch (err) {
    return { ok: false, log: [`${def.title} — failed: ${err.message}`] };
  }
}

function runRoutine(mode, inputs = {}) {
  const log = [];
  const files = [];
  for (const key of ['inbox', 'research', 'calendar', 'tasks', 'followup', 'report', 'digest']) {
    const res = runStep(key, mode, inputs);
    log.push(...res.log);
    if (res.file) files.push(res.file);
  }
  log.push(`— Routine complete (${mode} mode). Review outputs, then approve what should go out.`);
  return { ok: true, log, files };
}

module.exports = {
  OUT, STEPS, runStep, runRoutine,
  defaultInput, parseEmails, classify, draftReply, parseThreads, nudgeDraft,
};
