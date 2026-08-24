# 🎯 CRM PIPELINE — Stages, Status Codes, Timeouts

*The contract between you (the boss) and your AI Employee for how every prospect moves through the pipeline.*

---

## The 7 Stages

| # | Stage | What it means | Default **max time** in stage | Exit trigger |
|---|-------|---------------|------------------------------|--------------|
| 1 | 🔍 **LEAD** | Identified, not yet contacted | 30 days | First outreach sent |
| 2 | ✉️ **CONTACTED** | Outreach sent, awaiting reply | 14 days | Reply received OR bump 1 |
| 3 | 💬 **ENGAGED** | Two-way conversation | 30 days | Meeting booked OR concrete ask |
| 4 | 🤝 **MEETING** | Call/demo/showing scheduled | 7 days | Meeting happens |
| 5 | 📄 **QUOTING** | Quote or proposal sent | 21 days | Buyer replies OR bump 1 |
| 6 | ✅ **WON** | Signed / closed | — | Move to `closed/` |
| 7 | ❌ **LOST** | No fit / no budget / no response | — | Move to `archived/` with reason |

> **Why timeboxes matter:** a lead sitting in CONTACTED for 30 days is almost always dead. The AI Employee will flag it, draft a bump-up OR an archive note, and put it on `daily/approvals.md` for your yes/no.

---

## Status codes (one per prospect, one per thread)

| Code | Meaning |
|------|---------|
| 🆕 **NEW** | Just added, no action yet |
| ⏳ **WAITING-ME** | You're the bottleneck (draft something, send something) |
| ⏳ **WAITING-THEM** | Ball's in their court (auto-flag overdue) |
| 🔥 **HOT** | Active interest, fast response needed (reply < 24h) |
| ⏸️ **PAUSED** | Awaiting a date/event (revisit YYYY-MM-DD) |
| 🗄️ **ARCHIVED** | Closed/lost — kept for lessons learned |

---

## Follow-up Sequence (the "bump" logic)

Every prospect in stages 2-5 has a **sequence** — a script for what to send next if there's no reply:

| Bump | When | What |
|------|------|------|
| 0 (initial) | Stage 2 entry | Cold outreach in your voice (matched to their deal mandate) |
| 1 | **+7 days** silence | Gentle nudge: *"Wanted to make sure this didn't get buried..."* |
| 2 | **+14 days** silence (total) | Different angle: share a resource, ask a different question |
| 3 | **+21 days** silence (total) | Last-touch: *"Closing the loop — still a fit?"* |
| ✋ | **+30 days** silence | **Auto-archive** with reason "no response × 30 days" |

> **Mineral-business tweak:** mineral deals have longer cycles than SaaS. Override defaults per prospect in `PROSPECTS.md`:
>
> ```yaml
> cadence_days: [7, 14, 30, 60]   # instead of [7, 14, 21, 30]
> ```

---

## "Days in stage" vs "Days since last touch"

Two separate counters, both displayed in the dashboard:

- **`days_in_stage`** — how long the prospect has been at their current stage. Triggers the **timebox**.
- **`days_since_last_touch`** — days since the last email/calendar/meeting. Triggers the **bump sequence**.

A prospect can be in stage 2 for 20 days, but if you bumped them at day 7 and they replied (you just haven't logged it), `days_in_stage` keeps ticking but `days_since_last_touch` resets.

---

## When to mark **WON** vs **LOST** (the human call)

The AI Employee will never mark WON or LOST without your approval. The decision queue for each:

| Decision | What the AI drafts |
|----------|-------------------|
| **WON** → `closed/won/[name].md` | Receipt / contract summary · onboarding email · first-delivery timeline · thank-you note |
| **LOST** → `archived/lost/[name].md` | Polite close-out email (if relationship warrants) · reason + lesson learned |

Both show up in `daily/approvals.md` with the draft + archive note ready.

---

## Contact policy (re-stated)

- **Never send without `daily/approvals.md` tick.** The CRM bumps are still *drafts*, not sends.
- **The two hard rules apply.** No fake data, no invented numbers, no surprises.
- **One CRM action per prospect per day max.** Don't pile on — one nudge a day, queued for approval.

---

## Quick commands

| You say | What happens |
|---------|--------------|
| `"show pipeline"` | Refresh `PROSPECTS-DASHBOARD.md` and show overdue items |
| `"bump [name]"` | Draft a bump email for `[name]` based on their current stage |
| `"archive [name] as lost — reason: …"` | Draft a close-out email + move to `archived/lost/` |
| `"close [name] as won — contract: …"` | Draft a thank-you + onboarding email + move to `closed/won/` |

---

*Pipeline defined: 2026-08-19 · Owner: Hendrixx (AI Employee)*
