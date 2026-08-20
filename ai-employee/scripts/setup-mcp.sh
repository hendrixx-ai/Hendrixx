#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  🤖 AI EMPLOYEE — Google MCP Connector Setup
#
#  Connects Gmail + Google Calendar to Claude Code using the OFFICIAL
#  Google Workspace MCP servers (remote, OAuth 2.0).
#
#  Before running this script you need (see README → "Connect Google"):
#    1. A Google Cloud project
#    2. Gmail API + Gmail MCP API  and  Calendar API + Calendar MCP API enabled
#    3. An OAuth consent screen with scopes:
#         gmail.readonly, gmail.compose,
#         calendar.calendarlist.readonly, calendar.events.freebusy,
#         calendar.events.readonly
#    4. An OAuth 2.0 "Web application" client with authorized redirect URIs:
#         http://localhost:8080/callback   (Gmail)
#         http://localhost:8081/callback   (Calendar)
#
#  Then:  bash scripts/setup-mcp.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."   # → ai-employee/

GMAIL_URL="https://gmailmcp.googleapis.com/mcp/v1"
CALENDAR_URL="https://calendarmcp.googleapis.com/mcp/v1"
PORT_GMAIL=8080
PORT_CALENDAR=8081

echo "🤖 AI EMPLOYEE — Google MCP setup"
echo "==================================="

# 1. Claude Code must be installed
if ! command -v claude >/dev/null 2>&1; then
  echo "❌ Claude Code CLI not found."
  echo "   Install it first:"
  echo "     npm install -g @anthropic-ai/claude-code"
  echo "   Then re-run:  bash scripts/setup-mcp.sh"
  exit 1
fi
echo "✅ Claude Code found: $(claude --version 2>/dev/null || echo 'installed')"

# 2. Collect Google OAuth credentials
echo ""
echo "Paste your Google OAuth 2.0 credentials (Web application client)."
read -r -p "  Client ID:     " CLIENT_ID
[ -n "$CLIENT_ID" ] || { echo "❌ Client ID required."; exit 1; }
read -r -s -p "  Client Secret (hidden): " CLIENT_SECRET
echo ""
[ -n "$CLIENT_SECRET" ] || { echo "❌ Client Secret required."; exit 1; }

# 3. Register both servers at PROJECT scope → writes ai-employee/.mcp.json
#    (--client-secret reads from MCP_CLIENT_SECRET env var per CLI spec)
echo ""
echo "🔐 Registering Gmail MCP server…"
MCP_CLIENT_SECRET="$CLIENT_SECRET" claude mcp add --transport http \
  --scope project \
  --client-id "$CLIENT_ID" \
  --client-secret \
  --callback-port "$PORT_GMAIL" \
  gmail "$GMAIL_URL"

echo "🔐 Registering Calendar MCP server…"
MCP_CLIENT_SECRET="$CLIENT_SECRET" claude mcp add --transport http \
  --scope project \
  --client-id "$CLIENT_ID" \
  --client-secret \
  --callback-port "$PORT_CALENDAR" \
  calendar "$CALENDAR_URL"

# 4. Verify
echo ""
echo "📋 Registered servers:"
claude mcp list || true

cat <<'EOF'

✅  Done! One last step — authenticate:

  1. Start Claude Code inside ai-employee/:        claude
  2. Run:                                          /mcp
  3. For each server (gmail, calendar): select it, choose Authenticate,
     and complete the Google sign-in in your browser.

  After that, say:
    "Inbox step. Go through my recent emails, sort them, draft replies."
  and
    "Calendar step. Prep my meetings for today."

  Everything is DRAFT-ONLY and READ-ONLY from here:
  no email is ever sent and no event is ever created without you.
EOF
