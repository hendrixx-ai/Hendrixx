# ◆ Buyable Brand OS

**The business plan, as working software.** Not a course shell, not a moodboard —
the offer ladder, the 30-day content engine, the DM pipeline, the funnel maths and
the 90-day plan, orchestrated into the few moves that actually matter today.

```bash
node brand-os/server.js        # → http://localhost:3200
```

Zero dependencies. No build step. No database. Your state lives in
`brand-os/data/state.json`, which is gitignored — the app is the product, the file
is yours.

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

## The seven screens

| Tab | What it holds | The plan section it comes from |
|---|---|---|
| **Today** | First-run setup, the runbook, today's piece, the daily six, today's script, month pace | Daily schedule + 90-day execution |
| **Offers** | Free → $27 → $147 → $297 → $497, best-seller leaderboard, pricing, guarantee | 1️⃣ Product Discovery + 2️⃣ Offer Creation |
| **Content** | 30-day calendar, per-piece scripts, pillars, cadence, keywords, bios, 20 hooks | 3️⃣ Content System |
| **DMs & leads** | Reply → deciding → selling → link → bought, 6 DM scripts, 7 emails | 4️⃣ Sales Funnel |
| **Money & funnel** | MTD / pace / projection, path-to-$10k maths, calculator, funnel diagnosis, ledger | Honest math + conversion targets |
| **90-day plan** | Phase tasks, milestone outcomes, the eight things that kill it, setup | 90-day execution + "What not to do" |
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
│   └── store.js          # atomic JSON persistence + schema normalisation
├── public/               # single-page console (no framework, no build)
│   ├── index.html
│   ├── app.js
│   └── style.css
└── test/engine.test.js   # 14 tests over the rules (node --test)
```

Run the tests:

```bash
node --test brand-os/test/engine.test.js
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
