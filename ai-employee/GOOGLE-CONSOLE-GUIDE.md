# 🖱️ GOOGLE CLOUD CONSOLE — Click-by-Click Setup Guide

**Purpose:** Phase 0 of [TESTING.md](TESTING.md) — create the Google Cloud project,
enable the APIs, and mint the OAuth client that connects Gmail
(**test account: evanceahadi@gmail.com**).

**Time:** ~10 minutes · **Cost:** $0 (no billing needed — Gmail API is free)

---

## What you'll have at the end

```
Project:          hendrixx-ai-employee
APIs enabled:     Gmail API + Gmail MCP API (+ Calendar later)
OAuth app name:   Hendrixx AI Employee
OAuth client:     Claude Code MCP (gmail-test)
Redirect URI:     http://localhost:8080/callback
Client ID:        123456-xxxxxxxx.apps.googleusercontent.com
Client Secret:    GOCSPX-xxxxxxxx (shown ONCE)
```

---

## Step 1 — Sign in (30 sec)

1. Open a **new incognito window** (or a separate browser profile) — so the
   console session is clearly the test account and doesn't collide with your
   primary Google session.
2. Go to **https://console.cloud.google.com**
3. Sign in with **evanceahadi@gmail.com**
   - If you're not signed in: click **Sign in** (top right), enter the email,
     finish the login.
   - ✅ **Expected:** Google Cloud home page, "Welcome" + your email top-right.

---

## Step 2 — Create the project (1 min)

1. At the top of the page, find the **project selector** — it looks like
   *"Select a project"* or the current project name, next to a search box.
   Click it.
2. In the popup, click **New Project** (top right of the popup).
3. **Project name:** type exactly
   ```
   hendrixx-ai-employee
   ```
   - (The **Project ID** below it auto-generates — leave it as is. It's
     permanent but you'll never need to type it.)
4. **Location/Organization:** leave as **No organization** (default) —
   personal account.
5. Click **Create**.
6. Wait ~10–20 seconds for the notification (bell icon top right): "Project
   'hendrixx-ai-employee' created".
7. Click the project selector again → select **hendrixx-ai-employee**.
   - ✅ **Expected:** project name shows in the top bar selector.

---

## Step 3 — Enable the Gmail APIs (2 min)

**Method A (one click — fastest):** paste this URL into the same browser tab:

```
https://console.cloud.google.com/flows/enableapi?apiid=gmail.googleapis.com,gmailmcp.googleapis.com
```

1. It opens **APIs & Services → Library** with the two APIs pre-selected.
2. If asked, confirm the project is **hendrixx-ai-employee** (dropdown top-left).
3. Click **ENABLE** (top of the page — it enables both, takes ~10–20 sec).
4. ✅ **Expected:** green checkmark / "APIs enabled" toast.

**Method B (manual, same result):**
1. Left menu → **APIs & Services** → **Library** (or search "Library" in the top box).
2. In the search bar type: **Gmail API** → click the **Gmail API** card → **Enable**.
3. Search again: **Gmail MCP API** → click the card → **Enable**.
4. *(Optional, for later: repeat for **Google Calendar API** and **Calendar MCP API**
   — or do it in Phase 6.)*

> 💡 If you ever need to double-check: **APIs & Services → Enabled APIs**
> should list `Gmail API` and `Gmail MCP API`.

---

## Step 4 — Configure the OAuth consent screen (3 min)

This is what the "Sign in with Google" screen will look like later.

1. Left menu → **APIs & Services** → **OAuth consent screen**
   (newer console may label it **Google Auth Platform** — same thing).
2. If you see *"Google Auth Platform not configured yet"* → click **Get Started**.
3. **User type:** select **External** → click **Create**.
   > ⚠️ **External is required.** Internal only exists for Google Workspace
   > organizations. evanceahadi@gmail.com is a personal account → External.
4. **App information** page:
   - **App name:** `Hendrixx AI Employee`
   - **User support email:** `evanceahadi@gmail.com`
   - (App logo, domain, etc.: leave blank)
   - Click **Save and Continue** (or **Next**).
5. **Audience** page:
   - Leave defaults (External). Click **Save and Continue**.
6. **Contact information** page:
   - **Email addresses:** `evanceahadi@gmail.com`
   - Click **Save and Continue**.
7. **Finish/Summary** page:
   - Check *"I agree to the Google API Services: User Data Policy"* (top) if shown.
   - Click **Create / Back to dashboard**.
8. Now add the **test user** (this is the critical bit for a personal Gmail):
   - Still on the **OAuth consent screen** page → find **Audience** (a tab/menu
     item on the left of that page, or scroll) → **Test users** section →
     click **+ ADD USERS**.
   - Enter exactly:
     ```
     evanceahadi@gmail.com
     ```
   - Click **Add** → **Save**.
   - ✅ **Expected:** "Test users" list contains evanceahadi@gmail.com.

> 💡 Publishing status stays **"Testing"** — that's fine forever for a
> single-user setup. "In production" only matters if 100+ users use it.

---

## Step 5 — Add the OAuth scopes (2 min)

1. On the **OAuth consent screen** page → **Data Access** (tab on the left of
   that page; older UI: "Scopes").
2. Click **Add or Remove Scopes**.
3. In the filter box, select **Manually add scopes**, and paste exactly:

```
https://www.googleapis.com/auth/gmail.readonly
https://www.googleapis.com/auth/gmail.compose
```

4. Click **Add to table** (or the + / Add button).
5. Click **Update** (bottom).
   - ✅ **Expected:** the two scopes appear in the Data Access table.
   - (Calendar scopes — add in Phase 6 alongside the Calendar API:
     `calendar.calendarlist.readonly`, `calendar.events.freebusy`,
     `calendar.events.readonly`.)

---

## Step 6 — Create the OAuth client (2 min)

1. Left menu → **APIs & Services** → **Credentials**.
2. Top of the page → **+ CREATE CREDENTIALS** → **OAuth client ID**.
3. **Application type:** **Web application**
   (dropdown — do NOT pick "Desktop app").
4. **Name:** `Claude Code MCP (gmail-test)`
5. **Authorized redirect URIs** section:
   - Click **+ ADD URI**, enter exactly:
     ```
     http://localhost:8080/callback
     ```
   - ⚠️ Must be **http**, not https, and port **8080** exactly — this is the
     port your setup script uses.
6. Click **Create**.
7. **The modal shows your credentials — copy them now:**
   - **Client ID:** `xxxxxxxx.apps.googleusercontent.com`
   - **Client Secret:** `GOCSPX-xxxxxx` — *shown only once!*
   - Copy both into a scratch note (or straight into Step 7).
   - Click **OK** / close the modal.

---

## Step 7 — Hand the credentials to the setup script (1 min)

On your machine, in the terminal:

```bash
cd ai-employee
bash scripts/check-setup.sh      # sanity — only ".mcp.json missing" should be ❌
bash scripts/setup-mcp.sh        # paste Client ID, then Client Secret (hidden)
```

Then:

```bash
claude                          # inside ai-employee/
/mcp                            # gmail → Authenticate → Google sign-in
                                #   (use incognito / pick evanceahadi@gmail.com)
```

### You'll see this screen — it's expected 👇
**"Google hasn't verified this app"** →
click **Advanced** → **Go to Hendrixx AI Employee (unsafe)** →
sign in as **evanceahadi@gmail.com** → **Continue** → **Allow** (both checkboxes).

That's the app you just built — "unsafe" is just Google's wording for
*"you haven't paid for verification,"* which you don't need for one user.

---

## ✅ Done — verify

```bash
bash scripts/check-setup.sh      # gmail + calendar now configured ✅
```
then run the first test per [TESTING.md](TESTING.md) Phase 2–3.

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| "This app is blocked" | You signed in with the wrong account — use **evanceahadi@gmail.com** (it's the test user) |
| OAuth error "redirect_uri_mismatch" | The URI in the console must be **exactly** `http://localhost:8080/callback` — no trailing slash, http not https |
| "Access blocked: authorization error" | Step 4.8 — test user missing. Go back to **OAuth consent screen → Audience → Test users** and add evanceahadi@gmail.com |
| Port 8080 busy | Change to another port, e.g. 8090, and update BOTH the console redirect URI **and** `setup-mcp.sh`'s `PORT_GMAIL` |
| Forgot the Client Secret | Credentials → your client → **Download JSON** (contains `client_secret`), or create a new client |
| Wrong project selected | Top bar project selector → pick **hendrixx-ai-employee** before doing anything else |

---

*Guide version: 2026-08 · UI paths verified against current Google Cloud console documentation.*
