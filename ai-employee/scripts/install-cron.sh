#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  🤖 AI EMPLOYEE — Daily Automation Installer
#
#  Installs cron jobs for your AI Employee:
#    • Daily morning routine   — 07:00 East Africa Time (UTC+3)
#    • Weekly review (Fridays) — 16:30 East Africa Time
#    • Monthly review (1st)    — 08:00 East Africa Time
#
#  Usage:
#    bash scripts/install-cron.sh               # install ALL jobs
#    bash scripts/install-cron.sh --daily-only  # just the morning routine
#    bash scripts/install-cron.sh --weekly-only # just the Friday review
#    bash scripts/install-cron.sh --monthly-only # just the monthly review
#    bash scripts/install-cron.sh --remove      # remove all AI Employee jobs
#
#  Timezone: Africa/Dar_es_Salaam (EAT). Linux cron supports CRON_TZ;
#  macOS does not → falls back to fixed UTC times.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."   # → ai-employee/
ROOT="$(pwd)"

ROUTINE="$ROOT/scripts/morning-routine.sh"
WEEKLY="$ROOT/scripts/weekly-review.sh"
MONTHLY="$ROOT/scripts/monthly-review.sh"
CLAUDE_BIN="$(command -v claude || true)"
[ -n "$CLAUDE_BIN" ] || { echo "❌ claude CLI not found — install it first (npm i -g @anthropic-ai/claude-code)."; exit 1; }

TIMEZONE="Africa/Dar_es_Salaam"
DAILY_MIN=0; DAILY_HOUR=7           # 07:00 EAT
WEEKLY_MIN=30; WEEKLY_HOUR=16       # 16:30 EAT, Friday (dow=5)
MONTHLY_MIN=0; MONTHLY_HOUR=8       # 08:00 EAT, 1st of month

# macOS: CRON_TZ unsupported → use UTC equivalents (EAT = UTC+3)
if uname -s | grep -qi "darwin"; then
  DAILY_LINE="0 4 * * * cd $ROOT && $ROUTINE"
  WEEKLY_LINE="30 13 * * 5 cd $ROOT && $WEEKLY"
  MONTHLY_LINE="0 5 1 * * cd $ROOT && $MONTHLY"
else
  DAILY_LINE="CRON_TZ=$TIMEZONE
0 $DAILY_MIN $DAILY_HOUR * * * cd $ROOT && $ROUTINE"
  WEEKLY_LINE="CRON_TZ=$TIMEZONE
30 $WEEKLY_MIN $WEEKLY_HOUR * * 5 cd $ROOT && $WEEKLY"
  MONTHLY_LINE="CRON_TZ=$TIMEZONE
0 $MONTHLY_MIN $MONTHLY_HOUR 1 * * cd $ROOT && $MONTHLY"
fi

MODE="${1:-all}"

case "$MODE" in
  --remove)
    crontab -l 2>/dev/null | grep -v "morning-routine.sh" | grep -v "weekly-review.sh" | grep -v "monthly-review.sh" | crontab - || true
    echo "🗑️  Removed AI Employee cron jobs (if any)."
    exit 0
    ;;
  --daily-only) JOBS=( "$DAILY_LINE" ) ;;
  --weekly-only) JOBS=( "$WEEKLY_LINE" ) ;;
  --monthly-only) JOBS=( "$MONTHLY_LINE" ) ;;
  all|"") JOBS=( "$DAILY_LINE" "$WEEKLY_LINE" "$MONTHLY_LINE" ) ;;
  *) echo "❌ Unknown option: $MODE"; exit 1 ;;
esac

NEW_CRONTAB="$(crontab -l 2>/dev/null | grep -v "morning-routine.sh" | grep -v "weekly-review.sh" | grep -v "monthly-review.sh" || true)"
for LINE in "${JOBS[@]}"; do
  NEW_CRONTAB+="
$LINE"
done
printf '%s\n' "$NEW_CRONTAB" | crontab -

echo "✅ Installed:"
crontab -l | grep -E "morning-routine|weekly-review|monthly-review" || true
echo ""
echo "   • Daily:   07:00 EAT     → daily/report.md (morning-routine.sh)"
echo "   • Weekly:  Fri 16:30 EAT → weekly/weekly-review.md (weekly-review.sh)"
echo "   • Monthly: 1st, 08:00 EAT → monthly/monthly-review.md (monthly-review.sh)"
echo "   • Logs:    ai-employee/logs/"
echo "   • Nothing is ever sent — you review + approve.  Test:"
echo "       bash scripts/morning-routine.sh"
echo "       bash scripts/weekly-review.sh"
echo "       bash scripts/monthly-review.sh"

