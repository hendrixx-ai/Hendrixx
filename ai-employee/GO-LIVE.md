# 🚀 GO LIVE — Cheat Sheet

**Goal:** AI Employee running live against evanceahadi@gmail.com in ~10 minutes.
**Prereq:** Phase 0 done (see [GOOGLE-CONSOLE-GUIDE.md](GOOGLE-CONSOLE-GUIDE.md)) — you have Client ID + Secret.

---

## 💻 The 5 Commands (terminal)

```bash
# 1. READINESS — what's missing (expect only: .mcp.json missing)
cd ai-employee
bash scripts/check-setup.sh

# 2. CONNECT — paste Client ID, then Secret (hidden). Writes .mcp.json
bash scripts/setup-mcp.sh

# 3. START CLAUDE CODE
claude

# 4. (inside Claude Code) open the MCP menu
/mcp

# 5. (back in your shell, after auth) THE LIVE RUN
bash scripts/morning-routine.sh
```

---

## 🖱️ The 3 Browser Clicks (during /mcp)

```
1. In /mcp → select "gmail" → Authenticate
   → your browser opens a Google sign-in page

2. Sign in with  evanceahadi@gmail.com
   → "Google hasn't verified this app" screen appears — EXPECTED
   → click:  Advanced  →  "Go to Hendrixx AI Employee (unsafe)"  →  Continue

3. Consent screen → check BOTH boxes → Allow
   → browser shows success → return to terminal → server shows "Authenticated"
```

Repeat for **calendar** (same 3 clicks) when ready (Phase 6).

---

## ✅ After the run — verify in 60 seconds

| Check | Where | Expect |
|-------|-------|--------|
| Report | `daily/report.md` | Totals + honest "what happened" |
| Inbox sort | `daily/inbox.md` | Your 5 test emails sorted 🔴🟡🟢⚪ |
| Drafts | `daily/morning-digest.md`, `approvals.md` | Email draft + unchecked approvals |
| NOTHING sent | Gmail (evanceahadi@gmail.com) | **Sent = empty** · Drafts = employee's only |
| Log | `logs/morning-routine-<date>.log` | Ran at 07:00-style timestamp |

---

## 🆘 If something breaks

| Symptom | Fix |
|---------|-----|
| `Access blocked` | Test user missing → Console → OAuth consent screen → Audience → + ADD USERS → evanceahadi@gmail.com |
| `redirect_uri_mismatch` | Console redirect must be exactly `http://localhost:8080/callback` (http, no trailing slash) |
| Port 8080 busy | Change port in console AND `scripts/setup-mcp.sh` (`PORT_GMAIL`) |
| Wrong account signed in | Use incognito; pick evanceahadi@gmail.com at the Google sign-in |
| claude not found | `npm install -g @anthropic-ai/claude-code` |
| Anything else | Full details in [GOOGLE-CONSOLE-GUIDE.md](GOOGLE-CONSOLE-GUIDE.md) + [TESTING.md](TESTING.md) |

---

*Full docs: [README.md](README.md) · [TESTING.md](TESTING.md) · [GOOGLE-CONSOLE-GUIDE.md](GOOGLE-CONSOLE-GUIDE.md) · [test-emails.md](test-emails.md)*
