#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  🤖 AI EMPLOYEE — Monthly Review (headless, safe-by-default)
#
#  Runs the MONTHLY step: reads the month's daily/ + weekly/ files and
#  writes an end-of-month briefing to monthly/monthly-review.md.
#
#  Read-only by design — reads local files, writes the briefing. Nothing
#  external, nothing sent.
#
#  Run manually:      bash scripts/monthly-review.sh
#  Automate (1st):    bash scripts/install-cron.sh --monthly-only
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."   # → ai-employee/

mkdir -p logs monthly
LOG="logs/monthly-review-$(date +%F).log"
exec > >(tee -a "$LOG") 2>&1

echo "──────────────────────────────────────────────"
echo "📆 Monthly review — $(date '+%B %Y · %A %Y-%m-%d %H:%M %Z')"
echo "──────────────────────────────────────────────"

PROMPT='Run my MONTHLY REVIEW step (defined in CLAUDE.md). Read this month'"'"'s files in daily/ and weekly/, plus my profile in me.md. Write an end-of-month briefing to monthly/monthly-review.md with: Month at a glance (totals), Progress on priorities (from me.md, with evidence), Wins, Recurring issues or patterns, What kept getting pushed, Decisions still pending, and Next month'"'"'s focus. HARD RULES: only real data from the files — never invent numbers, people, or facts. If a section has no data, say so honestly and leave totals at zero.'

claude -p \
  --allowedTools "Read Write Edit" \
  "$PROMPT"

echo ""
echo "✅ Monthly review finished — see monthly/monthly-review.md"
echo "   Log: $LOG"
