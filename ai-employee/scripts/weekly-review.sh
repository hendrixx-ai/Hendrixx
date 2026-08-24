#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  🤖 AI EMPLOYEE — Weekly Review (headless, safe-by-default)
#
#  Runs the WEEKLY step: reads the week's daily/ files + me.md and writes
#  a Friday wrap-up briefing to weekly/weekly-review.md.
#
#  Read-only by design — it only reads local files and writes the briefing.
#  Nothing external, nothing sent.
#
#  Run manually:      bash scripts/weekly-review.sh
#  Automate (Fri):    bash scripts/install-cron.sh --weekly
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."   # → ai-employee/

mkdir -p logs weekly
LOG="logs/weekly-review-$(date +%F).log"
exec > >(tee -a "$LOG") 2>&1

echo "──────────────────────────────────────────────"
echo "📅 Weekly review — $(date '+%A %Y-%m-%d %H:%M %Z')"
echo "──────────────────────────────────────────────"

PROMPT='Run my WEEKLY REVIEW step (defined in CLAUDE.md). Read this week'"'"'s files in daily/ (inbox.md, research.md, calendar.md, tasks.md, follow-up.md, report.md) and my profile in me.md. Write a weekly briefing to weekly/weekly-review.md with: Week at a glance (totals across the week), What moved my priorities forward (compared against me.md), Aging follow-ups (5+ days), Decisions still pending, and Next week'"'"'s focus. HARD RULES: only real data from the files — never invent numbers, people, or facts. If this week has no daily reports yet, say so honestly and leave the totals at zero.'

claude -p \
  --allowedTools "Read Write Edit" \
  "$PROMPT"

echo ""
echo "✅ Weekly review finished — see weekly/weekly-review.md"
echo "   Log: $LOG"
