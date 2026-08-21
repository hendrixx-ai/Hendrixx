# 🤖 AI Sales Department

**One lead → 7 AI agents → a booked call.**

```
LEADS → RESEARCH → OUTREACH → FOLLOW-UP → QUALIFY → CLOSE → CRM
```

A Claude Code pipeline of 7 specialists. Each agent reads the numbered `pipeline/` file
before it and writes its own — one connected workflow, **you approve every send.**

## The two rules that keep you safe

1. **Drafts & plans only** — the department never sends, never adds anyone to a
   sequence, never edits a CRM. You approve and send every message.
2. **Never fakes data** — no invented leads, emails, replies, revenue, specs, or
   "interested!" replies that didn't happen. Facts separated from guesses, always.

Plus: anti-spam compliance (CAN-SPAM / GDPR) — public/consent-friendly sources only,
honest subject lines, easy opt-out on every message, no scraping, no bought lists.

## Setup

```bash
cd sales-department
claude          # start Claude Code here
```

Then either say **"run the pipeline"** (the department works in order, pausing for your
approval after each agent), or run agents one at a time (`run leads`, `run research`, …).

## Files

- `CLAUDE.md` — master orchestrator + your offer pointer
- `offer.md` — what you sell, price, ideal customer, voice *(seeded for gold — update with your real offer)*
- `OFFER-FINALIZATION.md` — 📝 fill-in-the-blanks questionnaire to finalize your real specs
- `.claude/agents/` — the 7 agent definitions
- `pipeline/` — the numbered output files (the pipeline itself) + working templates
  - `SEND-READY-EMAILS.md` — copy/paste outreach drafts (you send)
  - `CALL-OBJECTIONS-ONEPAGER.md` — objection handling for calls
  - `QUOTE-TEMPLATE.md` — post-call quote + one-page proposal
  - `POST-CALL-RECAP.md` — recap + booked-call agenda
- `HUBSPOT-SETUP.md` — CRM wiring guide (not connected until you set it up)
- `COMPLIANCE-AND-FRAUD-GUARD.md` — 🛡️ gold-trade safety rules (read before dealing)

## How to run it end-to-end

1. Fill `offer.md` (and `../ai-employee/PRODUCTS.md` with real specs/prices).
2. `run the pipeline` → approve at each step (leads → research → outreach → follow-up).
3. Copy approved messages into email/LinkedIn — **you send them.**
4. Paste real replies back → Qualify sorts Hot / Warm / Not Now.
5. Send the Close drafts, run your calls, let CRM log everything.
6. Repeat weekly. Approve before you send — always.

## ⚠️ Status

- Seeded with **empty** pipeline files — nothing is invented up front. The agents fill
  them with real, public, consented data when you run them.
- `offer.md` is a mineral-business template. Replace with your actual offer before your
  first real run.
