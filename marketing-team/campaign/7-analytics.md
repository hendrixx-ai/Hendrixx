# 7️⃣ ANALYTICS — Real Data In, One Fix Out

**Status:** ✅ Step 1 (no-data setup) complete — ⏸️ waiting for real numbers from the boss
**Written by:** the Analytics Agent (`.claude/agents/analytics.md`)
**Reads:** the boss's pasted data + `5-ads.md` (measurement plan) + order log
**Feeds:** back up the line — Copy / Creative / Ads re-runs with findings
**Mode: 1 — NO DATA YET.** There are zero real numbers as of 2026-08-23. Nothing in this file estimates, predicts, or benchmarks. When you paste data, Mode 2 begins (see §6).

---

## 1. KPIs per Stage — formulas only, no benchmarks

| Stage | KPI | Formula | Where the inputs live |
|---|---|---|---|
| Awareness | MWANGA arrivals | count of keyword auto-reply triggers (daily) | WhatsApp Business |
| Awareness | Meta messages started | straight from Ads Manager | Meta Ads Manager |
| Awareness | Jiji listing views | counter on each listing | jiji.co.tz seller dashboard |
| Engagement | Conversations | distinct people who replied anything | WhatsApp (manual count) |
| Engagement | Quote rate | quotes given ÷ conversations | Order log |
| Conversion | Quote→sale rate | sales ÷ quotes given | Order log |
| Conversion | Units/week | sum of units sold | Order log |
| Conversion | **Gross margin per unit** | sell price − unit cost − direct selling cost (delivery, print share) | Order log |
| Conversion | Cost per message (paid) | Meta spend ÷ messages started | Ads Manager + log dates |
| Conversion | Cost per sale (paid) | Meta spend ÷ sales whose channel = `meta` | Order log "ulitoka wapi" answer |
| Cash | **Stock-turn days** | date sold out − date stock landed | Order log |
| Cash | Capital recovered | Σ(sell price) ÷ Σ(all costs) × 100 | Order log |
| Service | Warranty claim rate | claims ÷ units sold | Order log (`warranty claim?` column) |
| Service | Repeat/referral rate | repeat or referral sales ÷ total sales | Order log |

## 2. Naming & Label Conventions (must match `5-ads.md` — or nothing reconciles)

- **Channel labels (exact strings, lowercase):** `status` · `jiji` · `ig` · `meta` · `referral` · `walk-in`
- **WhatsApp lead labels:** `New lead` → `Quoted` → `Sold` / `Cold` · `Warranty` for claims
- **Meta ad names:** `HP-CTWA-KahamaDar-A/B/C-2609` (channel-audience-variant-month)
- **UTMs:** N/A for WhatsApp/Jiji; if a link-in-bio page goes live later: `?utm_source=ig-bio&utm_campaign=hp-launch`

## 3. Where Each Number Lives & How to Collect It

| Number | Source | How often |
|---|---|---|
| Sales, prices, costs, channels, claims | **Order log** (paper notebook or sheet — the single source of truth) | per sale |
| MWANGA arrivals / conversations | WhatsApp — count + tally mark | daily (2 min) |
| Messages started, spend, cost/msg | Meta Ads Manager (screenshot weekly — paste to this team) | weekly |
| Jiji views | Listing stats page | weekly glance |

## 4. Review Cadence & Too-Early Rules

- **Daily (2 min):** tally arrivals + conversations. No decisions on daily numbers.
- **Weekly (30 min):** fill §5 template → paste to this agent → get Mode 2 analysis.
- **Paid test judging:** only on **7 full days**, all variants running; never judge on a day, a hunch, or a small spend.
- **"Too early to judge"** applies when: fewer than ~10 conversations, or fewer than ~3 sales of a given SKU *(framework thresholds, not statistics — at small samples, say so and wait)*.

## 5. 📋 Paste-Ready Weekly Template (copy → fill → paste back to the team)

```
WEEK OF: ___ (dates)
— AWARENESS —
MWANGA arrivals (total): ___
Meta messages started: ___ · Meta spend: TSh ___
Jiji views per listing: ___
— SALES (from order log) —
Units sold: ___ · by channel: status __ / jiji __ / ig __ / meta __ / referral __ / walk-in __
Quotes given: ___ · quote→sale rate: ___%
Gross margin: TSh ___ (total) · best SKU: ___ · worst SKU: ___
Stock left: ___ units · stock-turn estimate: ___ days
— SERVICE —
Warranty claims: ___ · issues reported (exact words): ___
Top objection heard (exact words): ___
— DECISIONS I'M UNSURE ABOUT —
___
```

## 6. Mode 2 Preview — what you get once data exists

Paste the filled template (or raw log lines) into this campaign and the Analytics Agent returns: **what's actually working / not working / too early to tell, the ONE highest-leverage improvement, ranked secondary fixes, and the next test to run** — every figure tagged `[REAL — provided]` vs `[ASSUMPTION]`. Nothing will ever be invented here.

---

## ⏸️ Gate

Setup is complete. The campaign folder is now the full system: `1-research` → `2-positioning` → `3-copy` → `4-creative` → `5-ads` → `6-email` → `7-analytics`. **The next move is physical: buy stock, shoot photos, press send** — runbook: [`../GO-LIVE.md`](../GO-LIVE.md).
