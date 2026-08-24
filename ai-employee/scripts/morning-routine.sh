#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  🤖 AI EMPLOYEE — Morning Routine (headless, safe-by-default)
#
#  Runs the full 6-step morning routine without interaction:
#     INBOX → CALENDAR → TASKS → FOLLOW-UP → REPORT
#  (RESEARCH only runs if a topic is listed in daily/research.md)
#
#  SAFETY: only read + draft tools are granted. Sending email, creating
#  calendar events, or anything external is IMPOSSIBLE in this run —
#  those tools are simply not in the allowlist. You approve + send.
#
#  Run manually:      bash scripts/morning-routine.sh
#  Automate daily:    bash scripts/install-cron.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."   # → ai-employee/

mkdir -p logs
LOG="logs/morning-routine-$(date +%F).log"
exec > >(tee -a "$LOG") 2>&1

echo "──────────────────────────────────────────────"
echo "🤖 Morning routine — $(date '+%A %Y-%m-%d %H:%M %Z')"
echo "──────────────────────────────────────────────"

PROMPT='Run my AI Employee morning routine (defined in CLAUDE.md). Execute the steps in order:

1. INBOX — fetch my recent unread emails via Gmail. Sort each into Urgent / Reply / Task / Ignore with a one-line reason. For Reply items, draft a response in my voice. DRAFTS ONLY — never send. Save to daily/inbox.md.
2. RESEARCH — take the next pending topic from research-queue.md (if any), research it with real cited sources, write the brief to daily/research.md, and move the topic to Done with today'"'"'s date. If the queue is empty, skip and say so.
3. CALENDAR — fetch today'"'"'s meetings via Calendar. For each: context, 3 talking points, desired outcome. Only real meetings. Save to daily/calendar.md.
4. TASKS — pull every to-do from the inbox + calendar into daily/tasks.md. Do the SAFE ones (drafting, organizing, summarizing) and mark done. Anything that sends, books, or spends goes under "Needs my approval" — and ALSO write each blocked external action as a checkbox in daily/approvals.md with draft-ready notes.
5. FOLLOW-UP — spot who I'"'"'m waiting on or owe a reply, and draft short personalized nudges referencing real past threads (match voice-samples.md). Drafts only. Save to daily/follow-up.md.
6. REPORT — read everything in daily/ and write one short honest briefing to daily/report.md (only what actually happened), including the number of items awaiting approval.
7. DIGEST — format the report as an email using templates/morning-digest.md and save it to daily/morning-digest.md. Draft only — never send.

HARD RULES: never send email, never create calendar events, never invent data (emails, meetings, people, facts). If unsure, flag it. Work only from real connected data.'

# Safety boundary: read + draft tools ONLY (no gmail.send_email,
# no calendar.create_event, no Bash beyond what's needed to save files)
ALLOWED_TOOLS=(
  "Read" "Write" "Edit"
  "mcp__gmail__search_threads" "mcp__gmail__get_thread"
  "mcp__gmail__list_drafts"    "mcp__gmail__get_draft"
  "mcp__gmail__create_draft"   "mcp__gmail__update_draft"
  "mcp__calendar__get_calendar_list" "mcp__calendar__get_events"
)

claude -p \
  --allowedTools "$(IFS=' '; echo "${ALLOWED_TOOLS[*]}")" \
  "$PROMPT"

echo ""
echo "✅ Routine finished at $(date '+%H:%M %Z') — see daily/report.md"
echo "   Log: $LOG"
