#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  🤖 AI EMPLOYEE — Setup Readiness Check
#
#  Verifies everything needed to connect Gmail + Calendar and run the
#  automation. Run it BEFORE setup (to see what's missing) and AFTER
#  (to confirm the connection worked).
#
#  Usage:  bash scripts/check-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.."   # → ai-employee/

PASS=0; WARN=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ✅ $1"; }
warn() { WARN=$((WARN+1)); echo "  ⚠️  $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }

echo "🤖 AI EMPLOYEE — Readiness Check"
echo "================================="

# 1. Core tooling
echo ""
echo "📦 Core tooling"
if command -v node >/dev/null 2>&1; then
  ok "Node.js: $(node --version)"
else
  fail "Node.js not found (needed by Claude Code)"
fi

if command -v claude >/dev/null 2>&1; then
  ok "Claude Code: $(claude --version 2>/dev/null | head -1)"
else
  fail "Claude Code CLI not found — install:  npm install -g @anthropic-ai/claude-code"
fi

# 2. MCP config
echo ""
echo "🔌 MCP config"
if [ -f ".mcp.json" ]; then
  ok ".mcp.json exists (project-scoped config)"
  if grep -q "gmailmcp.googleapis.com" .mcp.json 2>/dev/null; then
    ok "  → Gmail server configured"
  else
    warn "  → Gmail server NOT in .mcp.json"
  fi
  if grep -q "calendarmcp.googleapis.com" .mcp.json 2>/dev/null; then
    ok "  → Calendar server configured"
  else
    warn "  → Calendar server NOT in .mcp.json"
  fi
  if grep -q "REPLACE_WITH" .mcp.json 2>/dev/null; then
    fail "  → clientId is still a placeholder — run  bash scripts/setup-mcp.sh"
  fi
else
  fail ".mcp.json missing — run  bash scripts/setup-mcp.sh  (template: .mcp.json.example)"
fi

# 3. Endpoint reachability (from THIS machine — sandboxes may block Google)
echo ""
echo "🌐 Google MCP endpoints"
for NAME in gmail:gmailmcp.googleapis.com calendar:calendarmcp.googleapis.com; do
  LABEL="${NAME%%:*}"; HOST="${NAME##*:}"
  if curl -s -o /dev/null --max-time 8 "https://$HOST/mcp/v1"; then
    ok "$LABEL endpoint reachable ($HOST)"
  else
    warn "$LABEL endpoint unreachable from here (expected inside restricted sandboxes; must work on your machine)"
  fi
done

# 4. Automation
echo ""
echo "⏰ Automation"
if command -v crontab >/dev/null 2>&1 && crontab -l 2>/dev/null | grep -q "morning-routine.sh"; then
  ok "Daily routine cron job installed"
else
  warn "Daily cron job not installed — run  bash scripts/install-cron.sh"
fi

# 5. Workflow files
echo ""
echo "📁 Workflow files"
for F in CLAUDE.md me.md voice-samples.md research-queue.md templates/morning-digest.md scripts/morning-routine.sh; do
  [ -f "$F" ] && ok "$F" || fail "$F missing"
done
for F in daily/inbox.md daily/tasks.md daily/approvals.md daily/report.md; do
  [ -f "$F" ] && ok "$F" || warn "$F missing (created on first run)"
done

echo ""
echo "─────────────────────────────────────"
echo "  ✅ $PASS passed · ⚠️  $WARN warnings · ❌ $FAIL failed"
echo "─────────────────────────────────────"
if [ "$FAIL" -eq 0 ]; then
  echo "  Ready. Next:  claude  →  /mcp  →  authenticate gmail + calendar"
else
  echo "  Fix the ❌ items above, then re-run this check."
fi
