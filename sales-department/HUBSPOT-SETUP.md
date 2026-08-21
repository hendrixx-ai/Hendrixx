# 🔌 HUBSPOT SETUP — Wiring the CRM

*Status: ❌ **NOT connected.** I can't wire it myself — this needs your HubSpot account,
Super Admin access, and an OAuth sign-in in your browser. This guide is the exact path,
plus the data I've prepped for import so nothing is invented or auto-written.*

---

## Recommended path (simplest — HubSpot's official remote MCP)

HubSpot runs an official remote MCP server, GA since April 2026, works on the **free
tier**, OAuth 2.1 (no API token to copy):

1. Create a free HubSpot account (or log in as **Super Admin**).
2. In Claude Code, add the connector:
   - URL: `https://mcp.hubspot.com/anthropic` (the path HubSpot publishes for Claude)
   - Or use `/mcp` in Claude Code and add the HubSpot connector.
3. Sign in with HubSpot OAuth and **approve the scopes** (contacts, companies, deals).
4. Verify with `/mcp` → it shows **HubSpot** as connected.

**Alternatives (only if you want local control):**
- **HubSpot Connector for Claude** (first-party, in-app) — ~4-min click-through, needs a
  paid Claude plan + Super Admin.
- **Local npm server** `@hubspot/mcp-server` with a Private App token — run on your
  machine (`Settings → Integrations → Private Apps`).

> ⚠️ Note: several guides still describe the older "private-app-token in config" path;
> the current default is the OAuth remote server. Follow HubSpot's current docs.

## ⚖️ The approval gate (unchanged)

Even once connected, the department **drafts and plans only.** The CRM agent will:
- **Read** your HubSpot freely.
- **Prep** create/update entries and show them to you in `pipeline/7-crm.md`.
- **Never write** a contact/deal until you say "yes" — same rule as email.

---

## 📋 What I've prepped for import (ready, NOT written anywhere)

### Contacts (from `pipeline/1-leads.md` — 7 verified companies)

| Company | Email | Lifecycle stage (proposed) |
|---------|-------|---------------------------|
| Mwanza Precious Metals Refinery | info@mpmrcl.com · ceo@mpmrcl.com | Lead |
| Eyes of Africa Ltd (EOA) | info@eyesofafrica.com | Lead |
| African Gold Refinery (AGR) | admin@agr-afr.com | Lead |
| KB Global Refinery | info@kbglobalrefinery.com | Lead |
| Al Etihad Gold FZCO | info@aletihadgold.com | Lead |
| Emirates Gold DMCC | info@emiratesgold.ae | Lead |
| Rand Refinery | gold@gold.co.za | Lead |

### Deals (from `pipeline/7-crm.md` — statuses map cleanly to HubSpot deal stages)

| Our status (`7-crm.md`) | → HubSpot deal stage |
|--------------------------|----------------------|
| New | `Appointment scheduled` / lead |
| Contacted (draft) | `Qualified to buy` (or a custom "Outreach sent") |
| Replied | `Presentation scheduled` |
| Qualified | `Decision maker bought-in` |
| Booked | `Contract sent` / `Closed won` (as appropriate) |
| Won | `Closed won` |
| Lost | `Closed lost` |

### Property mapping (so I prep clean entries)

| Field | Our source | HubSpot property |
|-------|-----------|------------------|
| Company | `1-leads.md` | `Company` (Companies object) |
| Email | `1-leads.md` | `Email` (Contacts) |
| Phone | `1-leads.md` | `Phone` (Contacts) |
| Status | `7-crm.md` | `Deal stage` |
| Last touch | `7-crm.md` | `Last activity` / note |
| Next action + date | `7-crm.md` | `Next activity date` / task |
| Source | `1-leads.md` | `Lead source` (e.g., "Web research — public") |
| Booking link | — | Custom prop: `TidyCal` = https://tidycal.com/kingevance76 |

---

## Your checklist to go live

- [ ] HubSpot free account created (or Super Admin access)
- [ ] HubSpot MCP added via `/mcp` → OAuth sign-in → scopes approved
- [ ] Tell me "HubSpot is connected" → I re-read the pipeline and **prep** the 7 contacts + deals in `7-crm.md` for your approval
- [ ] You approve → I write them (with your explicit yes)

*I will never claim this is connected until you've completed the OAuth flow yourself.
Until then, `pipeline/7-crm.md` remains the source of truth.*
