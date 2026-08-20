# 🧪 AI EMPLOYEE — Test Plan (Secondary Gmail Account)

**Test account:** evanceahadi@gmail.com
**Goal:** prove the pipeline works against a REAL inbox — with zero risk to your primary email.

> ⚠️ **Safety rule for the whole test:** the AI Employee only ever gets
> **read + draft** tools. It physically cannot send from `evanceahadi@gmail.com`
> during automated runs. Drafts you approve are sent by YOU, manually.

---

## Phase 0 — Prepare (10 min)

> 🖱️ **Full click-by-click walkthrough:** [GOOGLE-CONSOLE-GUIDE.md](GOOGLE-CONSOLE-GUIDE.md)
> — exact screens, buttons, names to use, and expected results for every step.

- [ ] Create the Google Cloud project with **evanceahadi@gmail.com** (or any account you own)
- [ ] Enable **Gmail API** + **Gmail MCP API** for the project
- [ ] OAuth consent screen:
  - Audience: **External**
  - Add **evanceahadi@gmail.com** as a **test user**
- [ ] Create OAuth client (**Web application**) with redirect URI:
  - `http://localhost:8080/callback`
- [ ] Copy Client ID + Client Secret

## Phase 1 — Connect (5 min)

- [ ] `bash scripts/check-setup.sh` → only ❌ should be ".mcp.json missing"
- [ ] `bash scripts/setup-mcp.sh` → paste Client ID + Secret
- [ ] `claude` → `/mcp` → select **gmail** → Authenticate
  - ⚠️ **Sign in with evanceahadi@gmail.com** (use incognito or a separate browser
    profile so your primary Google session doesn't get picked instead)
- [ ] `bash scripts/check-setup.sh` → gmail + calendar now **configured** ✅

## Phase 2 — Feed the test inbox (5 min)

> 📮 **Pre-written emails:** [test-emails.md](test-emails.md) — 5 copy-paste
> subject/body pairs (+1 optional bonus) that mirror the demo for recognizable results.

Send these 5 test emails **to** evanceahadi@gmail.com (from your primary account,
or any second account). They mirror the demo so results are recognizable:

| # | From | Subject | Expect to be sorted as |
|---|------|---------|------------------------|
| 1 | You (primary) | "Q3 deadline — can we commit?" | 🔴 Urgent |
| 2 | You (primary) | "Updated quote — office supplies" | 🟡 Reply |
| 3 | You (primary) | "Partnership recap — waiting on your go/no-go" | 🟡 Reply (follow-up) |
| 4 | You (primary) | "Venue availability — Q4 offsite" | 🟢 Task |
| 5 | You (primary) | "Weekly AI digest" | ⚪ Ignore |

*(If you'd rather not send real mail, just mark any 5 existing emails in that
inbox as unread — the INBOX step reads unread email.)*

## Phase 3 — First real run (10 min)

- [ ] `bash scripts/morning-routine.sh`
- [ ] Open `daily/inbox.md` → **all 5 emails present**, sorted correctly, 2–3 drafts in your voice
- [ ] Open `daily/approvals.md` → external actions as checkboxes, **nothing pre-checked**
- [ ] Open `daily/report.md` → totals match what you saw in the inbox
- [ ] Open `daily/morning-digest.md` → email draft looks right

### ✅ Verify the "nothing sent" guarantee
- [ ] In Gmail (evanceahadi@gmail.com) → **Sent** folder: still empty
- [ ] **Drafts** folder: contains the drafts the employee made (only)
- [ ] `claude mcp list` → gmail shows approved/connected, not ⏸ pending

### 🔍 Sanity-check the drafts
- [ ] Voice matches `voice-samples.md` (short, direct, "Best, Hendrixx")
- [ ] No invented names, dates, or facts (Rule 2 — compare against the test emails)
- [ ] Anything uncertain is **flagged**, not guessed

## Phase 4 — Approve & send one (optional, 2 min)

Pick ONE draft (e.g., the "Updated quote" reply):
- [ ] Open Gmail drafts → review the draft → send it manually (YOU hit send)
- [ ] Confirm it appears in Sent, and `daily/approvals.md` item is ticked off by you

## Phase 5 — Automate (2 min)

- [ ] `bash scripts/install-cron.sh --daily-only`
- [ ] `crontab -l` → entry present
- [ ] Tomorrow 07:00 EAT: check `logs/morning-routine-<date>.log` ran + `daily/report.md` updated

## Phase 6 — Go live with your primary account (10 min)

The switch is **re-auth only — no code changes**:

- [ ] `claude` → `/mcp` → gmail → **Sign out / logout**
- [ ] Authenticate again → **sign in with your primary Google account**
- [ ] `bash scripts/check-setup.sh` → connected ✅
- [ ] Optional: add **Google Calendar** the same way (`/mcp` → calendar → Authenticate)
- [ ] Send 2–3 real "test" emails to your primary inbox → run `bash scripts/morning-routine.sh` → review
- [ ] `bash scripts/install-cron.sh` → full automation (daily + weekly + monthly)

## Rollback (if anything feels off)

- [ ] `claude mcp remove gmail` (and `claude mcp remove calendar`) — disconnects instantly
- [ ] Or revoke access at **myaccount.google.com → Security → Third-party access**
- [ ] Or `bash scripts/install-cron.sh --remove` — stops automation
- [ ] The repo stays intact — nothing external was ever changed

---

*Test complete when: Phase 3 checklist is all ✅ and you've manually sent exactly one draft in Phase 4.*
