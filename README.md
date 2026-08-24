# 🤖 Hendrixx AI Employee

**One assistant that runs your busywork — you stay the boss.**

Inbox → Research → Calendar → Tasks → Follow-Up → Report

---

## What This Is

An AI-powered personal assistant that handles the repetitive parts of your day — sorting email, prepping meetings, tracking tasks and follow-ups — while keeping you in control.

**Currently tuned for:** Mineral business sales, marketing, and consultation — targeting investors and mining-company owners. Configurable to any B2B sales context via [me.md](ai-employee/me.md) and [PRODUCTS.md](ai-employee/PRODUCTS.md).

Built for [Claude Code](https://claude.ai) with a simple folder structure and 6 automated workflow steps.

---

## ⚖️ The Rules

1. **Safe work is automatic** (sorting, drafting, summarizing, organizing). **External actions need your approval** (sending emails, booking meetings, spending money — nothing happens without your explicit "yes").
2. **Never invent information** — no fake emails, meetings, people, or facts. If unsure, it flags it.

---

## 📁 Structure

```
ai-employee/
├── CLAUDE.md             ← Identity, rules, and full workflow definition
├── me.md                 ← About you (fill this in!)
├── voice-samples.md      ← Your writing style (13 samples) — every draft matches it
├── research-queue.md     ← Drop research topics here — the employee picks them up
├── templates/
│   ├── morning-digest.md → Email format for the daily report (to you)
│   └── team-digest.md    → Email format for the team update
├── daily/                ← Output files for each workflow step
│   ├── inbox.md          → Sorted emails + drafted replies
│   ├── research.md       → Company/person/topic briefs
│   ├── calendar.md       → Meeting prep notes
│   ├── tasks.md          → Task list (done + needs approval)
│   ├── approvals.md      → ⏸️ External-action checklist (your yes required)
│   ├── follow-up.md      → Follow-up nudge drafts
│   ├── report.md         → End-of-day briefing
│   └── morning-digest.md → 📧 Report formatted as an email (optional)
├── weekly/               ← Weekly output
│   └── weekly-review.md  → Friday wrap-up (bonus step)
├── monthly/              ← Monthly output
│   └── monthly-review.md → 📆 End-of-month review (1st of each month)
└── scripts/              ← Automation
    ├── setup-mcp.sh        → connects Gmail + Calendar
    ├── morning-routine.sh  → headless daily run (inbox→report→digest)
    ├── weekly-review.sh    → headless Friday review
    ├── monthly-review.sh   → headless monthly review
    └── install-cron.sh     → installs daily + weekly + monthly jobs
```

---

## 🔄 The 6-Step Workflow

| Step | What It Does | Tool |
|------|-------------|------|
| **1. INBOX** | Sorts emails → Urgent / Reply / Task / Ignore + drafts replies | Gmail (or paste in) |
| **2. RESEARCH** | Briefs you on companies, people, topics with real sources — pulls from your **research queue** if you don't name one | Web search |
| **3. CALENDAR** | Builds prep notes for your meetings | Google Calendar (or paste in) |
| **4. TASKS** | Turns everything into a task list, does safe ones, queues approval | Tasks file |
| **5. FOLLOW-UP** | Spots due follow-ups + drafts nudges | Gmail + notes |
| **6. REPORT** | One daily briefing covering everything | Reads daily/ files |
| **7. WEEKLY** *(bonus)* | Friday wrap-up: week totals, priority progress, aging follow-ups, pending decisions, next week's focus | Reads the week's daily/ files |
| **8. MONTHLY** *(bonus)* | End-of-month review: month totals, priority progress w/ evidence, wins, recurring issues, what slipped, next month's focus | Reads daily/ + weekly/ files |
| **📧 DIGEST** *(optional)* | Daily report as an email (to you) or team update (confidential items excluded) — draft only | Templates + daily/ files |

---

## 🎬 Quick Start

### Prerequisites
- [Claude Code](https://claude.ai) installed
- A terminal

### Setup

```bash
# Navigate to the ai-employee folder
cd ai-employee

# Fill in your details
# → Edit me.md with your role, priorities, and voice

# Start Claude Code
claude
```

Then paste the master prompt or just start with:

> "I've filled in me.md. Read it and run my morning routine."

### Your Morning Commands

| Say this | It does |
|----------|---------|
| `run my inbox` | Emails sorted + replies drafted |
| `prep my meetings` | Prep notes ready |
| `turn everything into tasks` | To-dos sorted, safe ones done |
| `any follow-ups due?` | Nudges drafted |
| `give me my daily report` | One clean briefing |
| `research my queue` | Researches the next topic in `research-queue.md` |
| `give me my weekly review` | Friday wrap-up briefing |
| `what needs my approval?` | Shows the `daily/approvals.md` checklist |
| `give me my morning digest` | Formats the report as an email draft |
| `give me my team digest` | Formats a team update (confidential items excluded) |
| `give me my monthly review` | End-of-month briefing |

---

## 🧰 Recommended Tools (MCPs)

- **Gmail** — for Inbox + Follow-Up steps
- **Google Calendar** — for meeting prep
- **Web search** — for Research
- **A tasks file** — for Task tracking (or a task app later)

Start with just email + calendar. Add the rest when you're ready. Until a tool is connected, the employee works from files you paste in.

---

## 🔌 Connect Email + Calendar (10 minutes)

Pick **one** provider — your AI Employee is wired for both.

### Option A — Google (Gmail + Google Calendar) — recommended for most

Uses Google's **official Workspace MCP servers** (remote, OAuth 2.0 — no local server to babysit).

> 🧪 **New to this? Follow the test plan first** — [TESTING.md](ai-employee/TESTING.md)
> walks you through a full pilot on a secondary Gmail account (zero risk to your
> real inbox) before you go live.

> ✅ **Validated** against the real Claude Code CLI (v2.1.235): the setup script and config
> format below were tested end-to-end. The only step that must happen on your machine
> is the Google sign-in in your browser.

### 0. Readiness check (optional but recommended)
```bash
cd ai-employee
bash scripts/check-setup.sh     # shows ✅/⚠️/❌ for everything below
```

### 1. Create a Google Cloud project
1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **Create Project** (name it e.g. `ai-employee`)
2. Enable the APIs (Console → **APIs & Services → Library**, or use these one-click links):
   - [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com) + [Gmail MCP API](https://console.cloud.google.com/apis/library/gmailmcp.googleapis.com)
   - [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) + [Calendar MCP API](https://console.cloud.google.com/apis/library/calendarmcp.googleapis.com)

### 2. Configure the OAuth consent screen
**Google Auth Platform → Branding** (or **APIs & Services → OAuth consent screen**):
- App name: `Workspace MCP Servers` · user support email: your email
- Audience: **Internal** (or External + add your email as a test user)
- **Data Access** → add scopes:
  - `https://www.googleapis.com/auth/gmail.readonly`
  - `https://www.googleapis.com/auth/gmail.compose`
  - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
  - `https://www.googleapis.com/auth/calendar.events.freebusy`
  - `https://www.googleapis.com/auth/calendar.events.readonly`

### 3. Create OAuth client credentials
**Google Auth Platform → Clients → Create Client**:
- Application type: **Web application**
- Authorized redirect URIs:
  - `http://localhost:8080/callback` (Gmail)
  - `http://localhost:8081/callback` (Calendar)
- Copy the **Client ID** and **Client Secret**

### 4. Run the connector setup (one command)
```bash
cd ai-employee
bash scripts/setup-mcp.sh      # paste your Client ID + Secret when prompted
```

### 5. Authenticate once
```bash
claude                          # start Claude Code inside ai-employee/
/mcp                            # select gmail → Authenticate → sign in with Google
/mcp                            # select calendar → Authenticate → sign in with Google
```

### 6. Verify
```bash
bash scripts/check-setup.sh     # re-run → should now show gmail + calendar configured ✅
```
> "Inbox step. Go through my recent emails, sort them, and draft replies — drafts only."
> "Calendar step. Prep my meetings for today."

---

### Option B — Microsoft (Outlook.com / Hotmail / Live.com + Calendar)

Uses Microsoft's **Graph API** via a self-hosted MCP server (Microsoft does **not** host an MCP endpoint like Google does). Works for **personal Microsoft accounts** with no Azure tenant required.

> 📘 Click-by-click guide: [MICROSOFT-CONSOLE-GUIDE.md](ai-employee/MICROSOFT-CONSOLE-GUIDE.md)

```bash
cd ai-employee
bash scripts/setup-mcp.sh --microsoft
# Paste your Azure AD Client ID + Client Secret when prompted

claude                              # start Claude Code
/mcp                                # select "outlook" → Authenticate
                                     # → Microsoft sign-in window opens
                                     # → consent screen with the 6 permissions → Accept

bash scripts/check-setup.sh         # re-run → outlook ✅
```

Then same daily flow:

```bash
bash scripts/morning-routine.sh      # first real run against your Outlook inbox
```

> 💡 **Switching providers?** Edit `.mcp.json` and toggle `_disable` on each block — only one provider at a time.

---

### Switching from one provider to the other

```bash
# Disable Gmail, enable Outlook
# In .mcp.json: set gmail block "_disable": true, outlook block "_disable": false
# Then:
bash scripts/setup-mcp.sh --microsoft
claude    # /mcp → re-authenticate
```

---

## 📥 Research Topic Queue

Drop topics into `ai-employee/research-queue.md` anytime — the next morning routine researches the top item automatically and moves it to **Done**. No topic named? The queue is your always-on request list.

## ⏰ Automate It (Daily 07:00 · Fri 16:30 · 1st of Month 08:00 EAT)

```bash
cd ai-employee
bash scripts/install-cron.sh      # installs ALL jobs (daily + weekly + monthly)
bash scripts/install-cron.sh --daily-only   # just the morning routine
bash scripts/install-cron.sh --weekly-only  # just the Friday review
bash scripts/install-cron.sh --monthly-only # just the monthly review
bash scripts/install-cron.sh --remove       # remove all AI Employee jobs

bash scripts/morning-routine.sh   # test the daily run right now (headless, safe)
bash scripts/weekly-review.sh     # test the Friday review right now
bash scripts/monthly-review.sh    # test the monthly review right now
```

- Daily results land in `ai-employee/daily/report.md` every morning; Friday's wrap in `weekly/weekly-review.md`; the 1st-of-month review in `monthly/monthly-review.md`
- **Safety built in:** the automated runs only get read + draft tools — sending email or creating events is physically impossible for them. You review the "Needs my approval" list and do the external actions.
- Logs: `ai-employee/logs/`

**No cron?** Alternative: run `claude` inside `ai-employee/` and say *"run my morning routine"* (daily), *"run my weekly review"* (Fridays), or *"run my monthly review"* (1st of month).

---

## 🔧 For Developers

This repo contains the full AI Employee system as a structured skill for Claude Code. The `CLAUDE.md` file is the core — it defines the agent's persona, rules, and complete workflow instructions.

To extend:
- Add new steps by creating new files in `daily/` and adding prompts to `CLAUDE.md`
- Connect MCP tools for Gmail, Calendar, task management, etc.
- Create custom slash commands for one-liner workflows

---

*Built with ❤️ by [hendrixx-ai](https://github.com/hendrixx-ai/Hendrixx)*