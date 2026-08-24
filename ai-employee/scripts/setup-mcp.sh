#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  🤖 AI EMPLOYEE — MCP Connector Setup (Google OR Microsoft)
#
#  Registers Gmail + Google Calendar OR Outlook + Microsoft Calendar with
#  Claude Code via OAuth. Detects which provider you want.
#
#  Before running:
#    - Google: see GOOGLE-CONSOLE-GUIDE.md, then run:  bash setup-mcp.sh --google
#    - Microsoft: see MICROSOFT-CONSOLE-GUIDE.md, then run:  bash setup-mcp.sh --microsoft
#    - Or just run without flags and pick interactively.
#
#  Usage:
#    bash setup-mcp.sh              # interactive pick
#    bash setup-mcp.sh --google     # Gmail + Google Calendar
#    bash setup-mcp.sh --microsoft  # Outlook (personal) + Microsoft Calendar
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."   # → ai-employee/

GOOGLE_GMAIL_URL="https://gmailmcp.googleapis.com/mcp/v1"
GOOGLE_CAL_URL="https://calendarmcp.googleapis.com/mcp/v1"
PORT_GMAIL=8080
PORT_CAL=8081

# Detect provider
PROVIDER="${1:-}"
if [ -z "$PROVIDER" ]; then
  echo "Which provider do you want to connect?"
  echo "  1) Google (Gmail + Google Calendar)"
  echo "  2) Microsoft (personal Outlook.com + Calendar)"
  read -r -p "Pick 1 or 2: " CHOICE
  case "$CHOICE" in
    1) PROVIDER="--google" ;;
    2) PROVIDER="--microsoft" ;;
    *) echo "❌ Invalid choice"; exit 1 ;;
  esac
fi

# 1. Claude Code must be installed
if ! command -v claude >/dev/null 2>&1; then
  echo "❌ Claude Code CLI not found."
  echo "   Install it first:"
  echo "     npm install -g @anthropic-ai/claude-code"
  echo "   Then re-run:  bash scripts/setup-mcp.sh"
  exit 1
fi
echo "✅ Claude Code found: $(claude --version 2>/dev/null || echo 'installed')"

# 2. Collect credentials
echo ""
echo "Paste your OAuth 2.0 credentials."

case "$PROVIDER" in
  --google)
    read -r -p "  Google Client ID:     " CLIENT_ID
    [ -n "$CLIENT_ID" ] || { echo "❌ Client ID required."; exit 1; }
    read -r -s -p "  Google Client Secret (hidden): " CLIENT_SECRET
    echo ""
    [ -n "$CLIENT_SECRET" ] || { echo "❌ Client Secret required."; exit 1; }

    # 3. Register both servers at PROJECT scope → writes ai-employee/.mcp.json
    echo ""
    echo "🔐 Registering Gmail MCP server…"
    MCP_CLIENT_SECRET="$CLIENT_SECRET" claude mcp add --transport http \
      --scope project \
      --client-id "$CLIENT_ID" \
      --client-secret \
      --callback-port "$PORT_GMAIL" \
      gmail "$GOOGLE_GMAIL_URL"

    echo "🔐 Registering Calendar MCP server…"
    MCP_CLIENT_SECRET="$CLIENT_SECRET" claude mcp add --transport http \
      --scope project \
      --client-id "$CLIENT_ID" \
      --client-secret \
      --callback-port "$PORT_CAL" \
      calendar "$GOOGLE_CAL_URL"
    ;;

  --microsoft)
    read -r -p "  Azure AD Client ID (GUID):     " CLIENT_ID
    [ -n "$CLIENT_ID" ] || { echo "❌ Client ID required."; exit 1; }
    read -r -s -p "  Azure AD Client Secret (hidden): " CLIENT_SECRET
    echo ""
    [ -n "$CLIENT_SECRET" ] || { echo "❌ Client Secret required."; exit 1; }

    echo ""
    echo "🔐 Registering Outlook MCP server (personal Microsoft account)…"
    echo "   Note: Outlook MCP is self-hosted (no official Microsoft hosted endpoint)."
    echo "   This entry assumes the Salah Awad 'Outlook Personal' server."
    echo ""
    # Write the MS-specific .mcp.json directly (claude mcp add doesn't natively support stdio + env)
    cat > .mcp.json <<EOF
{
  "mcpServers": {
    "outlook": {
      "command": "npx",
      "args": ["-y", "@salah-awad/outlook-personal-mcp@latest"],
      "env": {
        "MS_CLIENT_ID": "$CLIENT_ID",
        "MS_CLIENT_SECRET": "$CLIENT_SECRET",
        "MS_TENANT_ID": "common",
        "MS_REDIRECT_URI": "http://localhost:3000/oauth/callback"
      }
    }
  }
}
EOF
    echo "   → wrote ai-employee/.mcp.json (Outlook only)"
    echo "   → for the Gmail block, see .mcp.json.example (or run --google instead)"
    ;;

  *)
    echo "❌ Unknown provider: $PROVIDER (use --google or --microsoft)"
    exit 1
    ;;
esac

# 4. Verify
echo ""
echo "📋 Registered servers:"
claude mcp list || true

cat <<EOF

✅  Done! Last step — authenticate:

  1. Start Claude Code inside ai-employee/:        claude
  2. Run:                                          /mcp
  3. Select your provider → Authenticate → complete the sign-in flow in your browser.

  After that, say:
    "Inbox step. Go through my recent emails, sort them, draft replies."
  and
    "Calendar step. Prep my meetings for today."

  Nothing external happens without your "yes".
EOF
