# ◆ Buyable Brand OS

**The business plan, as working software.** Not a course shell, not a moodboard —
the offer ladder, the 30-day content engine, the DM pipeline, the funnel maths and
the 90-day plan, orchestrated into the few moves that actually matter today.

```bash
node brand-os/server.js        # → http://localhost:3200
```

Zero dependencies. No build step. No database. Your state lives in
`brand-os/data/state.json`, which is gitignored — the app is the product, the file
is yours. Runs and their artifacts live in `brand-os/data/runs/` (also gitignored).

---

## Why this exists

`BUYABLE-BRAND-BUSINESS-PLAN.md` is a strong plan and a dead document. A plan becomes
a business only when it tells you **what to do on a Tuesday at 18:30 when two leads
have gone quiet and you have not posted yet**.

That is the whole job of this app. It is an **orchestrator**, not a dashboard:

1. It reads your real state — offers live, leads due, pieces posted, sales logged,
   funnel numbers, phase progress.
2. It ranks what matters today (warm leads before reach, reach before admin).
3. It gives you the exact artefact: the script, the DM, the next offer move, the
   checklist.
4. It records what happened, so tomorrow's runbook is different from today's.

Nothing is sent, posted or charged from here. You do the external action; the app
does the thinking and the record-keeping.

---

## It cannot show a blank page

Two defences, because a preview pane is a hostile environment (sandboxed iframe,
blocked `localStorage`, JS disabled, proxy flakiness):

1. **Server-rendered shell.** `/` ships a real, data-backed summary — day, phase,
   today's focus, the daily six, the runbook — rendered in Node on every request.
   `app.js` replaces it on boot. With JS off, or broken, you still see live data.
2. **Storage that never throws.** `localStorage` throws a `SecurityError` in
   sandboxed frames and private mode, and one unguarded read at module scope is
   enough to kill the whole script. All reads/writes go through a wrapper that
   falls back to memory.

Verified by running `app.js` against the live server in three modes: normal,
`localStorage` throwing, and `fetch` blocked (which keeps the shell and adds an
explicit error — never a white screen).

## The execution layer — six agents, five flows

The screens tell you what to do. The **Agents** tab does the writing.

| Agent | Job | Refuses to |
|---|---|---|
| **Chief of Staff** | Today's brief: one focus, ordered moves, the script, the money, the conversations | pad a quiet day with busywork |
| **Offer Architect** | Skill + audience → three named, priced offers + the sentence that is the business | generate an offer with no skill given |
| **Content Director** | 30 pieces: hooks, scripts, captions, pillar mix, CTA rotation | invent proof beats (they stay `[bracketed]`) |
| **DM Closer** | The next message for a lead, plus the two moves after it | write to a lead that does not exist |
| **Growth Analyst** | The memo: the leak, three prescriptions, what it will not claim | diagnose without data |
| **Launch Producer** | A 7-day launch: Reels, Stories, DMs, emails, targets | fake scarcity or a deadline you do not mean |

A **flow** chains agents and passes artifacts down the line:

```
daily          Chief of Staff                         → brief.md
offer-build    Offer Architect → Content Director     → offer.md, calendar.md, scripts.md, captions.md
content-sprint Content Director                       → calendar.md, scripts.md, captions.md
launch-kit     CoS → Architect → Content → Launch → Analyst
                                                      → brief, offer, calendar, scripts, captions,
                                                        launch, emails, memo   (8 files, ~30ms)
win-back       DM Closer (everyone due)               → win-back.md
```

Every run is **persisted and downloadable**:

- `data/runs/<runId>/*.md` — the artifacts themselves
- `data/runs/index.json` — the last 40 runs with steps, timings, status and blockers
- `GET /api/kit/<runId>.zip` — the run packed as a real `.zip` (hand-rolled writer,
  deflate via zlib, CRC-32 by hand — no dependencies)

**Adopt into the app** is the only write-back. It fills offer names/prices/promises
and *empty* content hooks, and it never overwrites words you have edited yourself.

### Blocked is a feature

Agents stop instead of guessing:

```json
{ "status": "blocked", "blockers": ["Tell the architect what you can actually do — a skill, not a niche label."] }
```

`partial` means it ran but is telling you the truth about thin data — the Growth
Analyst on a fresh account writes an "insufficient data" memo instead of inventing
a diagnosis. `blocked` and `partial` propagate into the flow status, so a launch kit
built with no funnel numbers says `partial` and explains which agent hedged.

### Where the words come from

The agents are **deterministic writers, not an LLM**. Hooks come from template pools
fanned out across the plan's five pillars; CTAs rotate so no two consecutive posts
ask for the same thing; launch days follow the plan's own arc (name the enemy →
mechanism → proof → open → objections → buyers → close). That is why the same input
gives the same kit, why it runs in milliseconds and offline, and why you can read
every rule that produced a sentence.

If you want an LLM in the loop later, the seam is `lib/agents.js`: each agent is
`run(state, today, input, ctx) → { status, steps, artifacts, summary, blockers }`.
Swap the body, keep the contract, and flows, history, zip and adoption keep working.

---

## The seven screens

| Tab | What it holds | The plan section it comes from |
|---|---|---|
| **Today** | First-run setup, the runbook, today's piece, the daily six, today's script, month pace | Daily schedule + 90-day execution |
| **Offers** | Free → $27 → $147 → $297 → $497, best-seller leaderboard, pricing, guarantee | 1️⃣ Product Discovery + 2️⃣ Offer Creation |
| **Content** | 30-day calendar, per-piece scripts, pillars, cadence, keywords, bios, 20 hooks | 3️⃣ Content System |
| **DMs & leads** | Reply → deciding → selling → link → bought, 6 DM scripts, 7 emails | 4️⃣ Sales Funnel |
| **Money & funnel** | MTD / pace / projection, path-to-$10k maths, calculator, funnel diagnosis, ledger | Honest math + conversion targets |
| **90-day plan** | Phase tasks, milestone outcomes, the eight things that kill it, setup | 90-day execution + "What not to do" |
| **Agents** | Six agents, five flows, run history, artifact reader, zip kits | All of it, as execution |
| **Setup** | Goal, Day 1, handle, checkout links (fills every script and caption) | — |

---

## The orchestrator's rules

Deterministic on purpose — you can read every rule, and test it.

| Priority | Rule | Why |
|---|---|---|
| 1 | **Due leads first.** Any active lead whose `nextActionAt` is today or past. | Warm intent is the only revenue you can book today. It decays in 72 hours. |
| 2 | **Today's piece, if unposted.** | Reach is the top of the funnel. |
| 3 | **The next offer move**, walked in the plan's order: Map → $27 kit → first 10 buyers → core at $97 → first 10 core buyers → $297 review → raise to $147 → mini-launch. | The ladder is the strategy. Selling the $147 before the $27 exists is how beginners stall. |
| 4 | **The next undone phase task.** | Skipping phase 1 is how the plan becomes a PDF. |
| 5 | **Funnel numbers**, if older than 7 days. | You cannot fix a leak you cannot see. |
| 6 | **The 20-minute engagement shift.** | Half the algorithm, and where the next DM comes from. |

The **best-seller score** is readable arithmetic, not a black box:

```
50 pts  revenue share of your total
20 pts  units sold (25 units = full marks)
20 pts  momentum — units in the last 14 days (10 = full marks)
10 pts  the offer is live or proven
```

Every score component is visible on the Offers screen, including the 14-day trend.

**Funnel diagnosis** applies the plan's own benchmarks — comments 1–3% of views,
DM replies 40%+ of comments, clicks 20–40% of replies, purchases 8–20% of clicks —
and names the single step that is leaking.

---

## Honesty contract

This app is built to keep you honest, which means it refuses a few things:

- **No invented proof.** Every script that needs a number, testimonial or screenshot
  leaves a `[bracketed placeholder]`. There is no "generate fake results" button.
- **No income guarantee.** The only guarantee in the product copy is installation:
  a named offer + a live checkout link. The plan's rule, enforced in `playbook.js`.
- **No fake activity.** There is no demo mode that inflates the numbers. Empty really
  means empty: `$0`, "No sales yet", "Not logged". You start at zero and the dashboard
  says so.
- **No sending.** Moving a DM card, copying a script and marking a piece posted are
  local writes. The app has no mail, Instagram or payment credentials, and no code
  path that could spend money.
- **Agents can refuse.** A blocked run writes nothing and returns a reason; there is
  no retry-with-made-up-inputs path.

---

## Data model

`brand-os/data/state.json` (created on first run, gitignored):

```jsonc
{
  "settings": { "goal": 10000, "startDate": "2026-10-22", "handle": "@you", "coreLink": "…" },
  "offers":   [ { "id": "weekend", "layer": "tripwire", "price": 27, "status": "idea" } ],
  "sales":    [ { "offerId": "brand", "price": 97, "units": 1, "date": "2026-10-24" } ],
  "leads":    [ { "name": "Maya", "stage": "deciding", "nextActionAt": "2026-10-25" } ],
  "content":  [ { "id": "c01", "status": "filmed", "history": ["2026-10-22"], "hook": "" } ],
  "checkins": { "2026-10-22": { "done": { "post": true }, "note": "…" } },
  "funnel":   { "views": 2400, "comments": 31, "dmReplies": 18, "clicks": 6, "purchases": 1 },
  "plan":     [ { "id": "foundation", "tasks": [ { "id": "foundation-1", "done": false } ] } ]
}
```

Writes are atomic (temp file + rename), and loading normalises the shape — new
calendar days, new plan tasks and new defaults appear without wiping your progress.

**Back up / move machines:** Export state in the sidebar, or `GET /api/export`.
**Start over:** Setup → *Reset everything*. There is no undo; export first.

---

## API (for scripting)

```
GET  /api/state                        everything, computed for today
GET  /api/health                       today + state file path
GET  /api/export                       download state.json

POST /api/sale             { offerId, price, units, date, source, note }
POST /api/sale/delete      { id }
POST /api/offer            { id?, name, price, layer, status, promise, format, next }
POST /api/offer/delete     { id }          # refuses if the offer has sales
POST /api/content          { id, status: posted|unpost|filmed|planned, date, hook, cta }
POST /api/checkin          { id, done, date?, note? }
POST /api/lead             { id?, name, handle, skill, source, stage, nextActionAt, note }
POST /api/lead/stage       { id, stage }
POST /api/lead/delete      { id }
POST /api/funnel           { views, comments, dmReplies, clicks, purchases, note }
POST /api/plan             { id, done }
POST /api/settings         { goal, startDate, name, handle, mapLink, tripwireLink, coreLink, reviewLink }
POST /api/reset            { "confirm": "reset" }

GET  /api/agents                                  the crew + flows
GET  /api/runs                                    last 40 runs
GET  /api/runs/:id                                one run (steps, files, adopt payload)
GET  /api/runs/:id/file?name=offer.md             one artifact
GET  /api/kit/:id.zip                             the run as a downloadable zip

POST /api/agents/:id/run   { input }              run one agent (persisted)
POST /api/flows/:id/run    { input }              run a flow (persisted)
POST /api/apply            { runId }              adopt offers/hooks into your state
```

All POSTs return `{ ok: true, state }` with the freshly computed view, so a client
never has to guess.

---

## Code layout

```
brand-os/
├── server.js             # HTTP + JSON API (zero deps)
├── lib/
│   ├── playbook.js       # the plan encoded as data: offers, calendar, scripts, plan
│   ├── engine.js         # pure orchestrator: state + today → every view and score
│   ├── agents.js         # six agents: deterministic writers, one artifact contract
│   ├── orchestrator.js   # flows: agents chained, artifacts handed forward
│   ├── jobs.js           # run history + artifact storage (allowlisted reads)
│   ├── kit.js            # zero-dependency zip writer for download kits
│   └── store.js          # atomic JSON persistence + schema normalisation
├── public/               # single-page console (no framework, no build)
│   ├── index.html
│   ├── app.js            # views + a small markdown renderer for artifacts
│   └── style.css
└── test/
    ├── engine.test.js    # 14 tests over the daily rules
    └── agents.test.js    # 16 tests over the crew, flows, zip and job history
```

Run the tests:

```bash
node --test brand-os/test/engine.test.js brand-os/test/agents.test.js
# 30 tests, ~150ms
```

The engine is pure: `today` is always passed in, never read from the clock inside a
rule. That is why the date maths, the content cycle, the ladder progression and the
funnel diagnosis are all testable without a browser or a database.

---

## Where the plan lives in the code

| Plan section | File / screen |
|---|---|
| 1️⃣ Product discovery, three ideas | `lib/playbook.js` → `OFFERS` |
| 2️⃣ Offer creation, modules, bonuses, pricing | Offers screen, `OFFERS` |
| 3️⃣ Content system, 30-day calendar, hooks, pillars | Content screen, `CONTENT`, `PILLARS`, `HOOKS` |
| 4️⃣ Sales funnel, bio, DM scripts, keywords, emails | DMs screen, `SCRIPTS`, `KEYWORDS`, `EMAILS` |
| Conversion targets | `BENCHMARKS` + funnel diagnosis |
| 90-day execution | Plan screen, `PLAN` |
| What not to do | `DONTS` |

If the plan changes, change `playbook.js` — the app and the document stay in sync
because there is only one copy of the words.

---

*Part of [Hendrixx](https://github.com/hendrixx-ai/Hendrixx). Companion to the AI Employee console in `../app`.*
