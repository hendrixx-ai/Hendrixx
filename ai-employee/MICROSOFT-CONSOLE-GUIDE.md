# 🖥️ MICROSOFT CONSOLE GUIDE — Connect Personal Outlook.com

**Purpose:** Phase 0 (Microsoft variant) of [TESTING.md](TESTING.md) — register an Azure AD app that lets your AI Employee read/write your personal Outlook.com / Hotmail / Live.com mail + calendar via Microsoft Graph API.

**Time:** ~10 minutes · **Cost:** $0

> ⚠️ Microsoft does **not** host an official MCP server the way Google does
> (`gmailmcp.googleapis.com`). You'll run a small open-source MCP server locally
> (`@salah-awad/outlook-personal-mcp` by default). Your OAuth tokens still live
> with Microsoft — the local server only forwards requests.

---

## Step 1 — Sign in

1. Open [https://portal.azure.com](https://portal.azure.com) in your browser (sign in with the **Microsoft account** that owns your Outlook.com address).
2. ✅ **Expected:** Azure home page, your name top-right.

---

## Step 2 — Register the app

1. Top search bar → type **"App registrations"** → click **Microsoft Entra ID → App registrations**.
2. Click **+ New registration** (top bar).
3. Fill in:
   - **Name:** `Hendrixx AI Employee`
   - **Supported account types:** ⚠️ **Select exactly:** **"Personal Microsoft accounts only (e.g. Skype, Xbox, Outlook.com)"**
     - This is critical. The default ("Accounts in this organizational directory only") will reject your personal Outlook.com sign-in.
   - **Redirect URI:** leave blank for now — we'll add it in Step 4.
4. Click **Register**.
5. ✅ **Expected:** you land on the new app's overview page. Copy the **Application (client) ID** — it's a GUID like `12345678-1234-1234-1234-123456789abc`. **Save this.** You'll paste it into `setup-mcp.sh` later.

---

## Step 3 — Create a client secret

1. Left menu → **Certificates & secrets** → **Client secrets** tab.
2. Click **+ New client secret**.
3. **Description:** `Hendrixx AI Employee (local MCP)`
4. **Expires:** 6 months (recommended) or your preference.
5. Click **Add**.
6. ⚠️ **The secret VALUE is shown once.** Copy it now and save it next to the Client ID. You'll paste it into `setup-mcp.sh` later.

---

## Step 4 — Add the redirect URI

1. Left menu → **Authentication**.
2. Click **+ Add a platform** → **Mobile and desktop applications**.
3. **Custom redirect URIs:** add exactly:
   ```
   http://localhost:3000/oauth/callback
   ```
4. Under **Advanced settings** → toggle **"Allow public client flows"** to **Yes**. (Needed for device-code / interactive flows.)
5. Click **Save**.

---

## Step 5 — Grant Microsoft Graph permissions (delegated)

1. Left menu → **API permissions**.
2. You should see **Microsoft Graph** (default). Click **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**.
3. Search for and tick each of these:
   - `Mail.Read`
   - `Mail.ReadWrite`
   - `Mail.Send`
   - `Calendars.Read`
   - `Calendars.ReadWrite`
   - `offline_access` (lets the token refresh so you don't sign in daily)
4. Click **Add permissions**.
5. ✅ **Expected:** the permissions list shows 6 entries under Microsoft Graph.

> ℹ️ You do **not** need admin consent for these on a personal account — they show as "User consent required" and you'll grant them yourself at first sign-in.

---

## Step 6 — Register the MCP server (on your machine)

```bash
cd ai-employee
# Edit .mcp.json.example → save as .mcp.json with your real Client ID

# Option A — quick start with Salah Awad's "Outlook Personal" server:
npm install -g @salah-awad/outlook-personal-mcp  # or use npx -y ...
# Edit the .mcp.json so the outlook block is enabled and gmail block is disabled:
#   "_disable": false  → on the outlook block
#   "_disable": true   → on the gmail block
# Paste MS_CLIENT_ID, MS_TENANT_ID=common
```

Or use the helper script:

```bash
bash scripts/setup-mcp.sh --microsoft
# Paste Client ID + Client Secret when prompted
```

---

## Step 7 — Start Claude Code and authenticate

```bash
claude                          # inside ai-employee/
/mcp                            # select "outlook" → Authenticate
```

You'll see a browser window open. Sign in with your Microsoft account. Consent screen lists the 6 permissions from Step 5 — click **Accept**.

✅ **Expected:** Claude Code shows `outlook: Connected` (or similar).

---

## Step 8 — Verify

```bash
bash scripts/check-setup.sh
```

✅ **Expected:** `outlook` now shows configured, not `gmail`.

---

## Step 9 — First real run

```bash
bash scripts/morning-routine.sh
```

Open `daily/inbox.md` — your live Outlook emails will be sorted into 🔴 / 🟡 / 🟢 / ⚪, with drafts in your voice (using `voice-samples.md`) ready for approval.

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| "Selected account does not exist in tenant" | You picked the wrong **Supported account type** in Step 2. Re-register with **"Personal Microsoft accounts only"**. |
| "AADSTS50011: The redirect URI specified in the request is not registered" | Step 4 redirect URI must be **exactly** `http://localhost:3000/oauth/callback` (http, no trailing slash). |
| "Need admin approval" | You accidentally picked an org/work account permission. Delete and re-add as **Delegated** not **Application**. |
| Token expires every hour | Make sure `offline_access` is in your permissions list (Step 5). |
| "Outlook Personal" package not found | Try `npx -y @salah-awad/outlook-personal-mcp@latest` — npm sometimes caches old versions. |
| Mixed with old Gmail setup | Edit `.mcp.json` so **only one provider is enabled** (`_disable: true` on the other). Restart `claude`. |

---

*Guide version: 2026-08-19 · UI paths verified against current Azure Portal documentation.*
