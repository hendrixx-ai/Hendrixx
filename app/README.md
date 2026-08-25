# 🖥️ Hendrixx Console — the AI Employee as working software

A zero-dependency Node.js web app that turns the `ai-employee/` markdown system
into a live console: **dashboard + workflow runner + approvals queue**.

```
cd Hendrixx
node app/server.js          # → http://localhost:3000
```

No `npm install`, no build step, no database — **the repo is the database.**
Every screen reads (and where you allow it, writes) the same markdown files
Claude Code works with, so the console and the CLI never fight over state.

---

## What it does

| Tab | What you get |
|-----|--------------|
| **📊 Dashboard** | Pipeline kanban, aging alerts vs `crm/PIPELINE.md` timeboxes, research queue, last report at a glance |
| **🎯 Pipeline** | Every prospect from `PROSPECTS.md` — move stages (rewrites the file + rolls up the summary), add prospects |
| **⏸️ Approvals** | The external-action checklist from `daily/approvals.md` with the 7-point gate — approve/decline writes to the audit log |
| **🔄 Workflow** | Runs the 6-step morning routine (`INBOX → RESEARCH → CALENDAR → TASKS → FOLLOW-UP → REPORT → DIGEST`) as a transparent rules engine |
| **📁 Files** | Browse every workflow file rendered as markdown |

## The two run modes

- **🧪 Demo** — inputs come from `demo/input/`, outputs go to `demo/output/`.
  Your real `daily/` files are never touched. Reproducible end-to-end demo.
- **⚡ Live** — you paste real emails/threads (until Gmail/Calendar MCP are
  connected), outputs go to the real `daily/` workflow files, exactly like
  `scripts/morning-routine.sh`.

## The honest-capabilities contract

The workflow runner is a **deterministic rules engine**, not an LLM:

- **INBOX** sorts with the priority rules from `CLAUDE.md` (mineral-business
  elevation, money-at-risk, commitment deadlines) and drafts replies in the
  boss's voice with `[bracketed placeholders]` for anything it must not invent.
- **RESEARCH** takes the next topic from `research-queue.md` and lays out the
  brief skeleton — every empty section is flagged `NEEDS SOURCE`, never filled
  with guesses. Connect web search / Claude Code for real briefs.
- Nothing is ever sent. Approving an item records your yes in the log; the
  actual send still happens from your Gmail.

Rules 1–4 from `ai-employee/CLAUDE.md` apply to this console, too.

## API (for scripting)

```
GET  /api/state                  # everything, parsed from markdown
GET  /api/file?path=daily/report.md
GET  /api/input                  # demo inputs for the workflow tab
POST /api/run/step     {step, mode, inputs}     # one step
POST /api/run/routine  {mode, inputs}           # the full morning routine
POST /api/approvals/decision {index, decision, note}
POST /api/prospects    {name, type, contact, ...}
POST /api/prospects/stage {name, stage}
POST /api/queue        {topic, why}
```

Writes are allow-listed (`app/lib/store.js`) — path traversal is blocked and
only the workflow files can be modified.

## Layout

```
app/
├── server.js          # HTTP server + API routes
├── lib/
│   ├── store.js       # file access layer (allowlist, EAT dates)
│   ├── parse.js       # markdown → JSON parsers (prospects, approvals, queue…)
│   └── workflow.js    # the 6-step routine as a rules engine
└── public/            # single-page console (no framework, no build)
    ├── index.html
    ├── app.js
    └── style.css
```
