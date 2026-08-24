# 🛒 AI Ecommerce Team — Claude Code Build

**One Product → 7 AI Agents → A Complete Store Launch**

```
RESEARCH → OFFER → PRODUCT PAGE → CREATIVE → ADS → EMAIL → ANALYTICS
```

Each agent reads what the last one made and builds on it — research shapes the offer, the offer shapes the product page, the page shapes the creative, and so on. One connected team. Give it one product; it hands you a full launch kit: research, offer, product page, creative, ads, emails.

**How this works, honestly:** the team drafts and plans; **YOU approve anything that publishes, sends, or spends.** Two honesty rules: (1) it never invents sales, revenue, ROAS, reviews, or customer data — if it lacks real numbers, it says so. (2) An integration only works if you connect it — see the tool table below. No tool guarantees sales; this helps you launch smarter, faster.

---

## ⚖️ The Rules

1. **Never invent data** — no fake stats, reviews, revenue, ROAS, or customer info. Sourced facts stay separate from assumptions.
2. **Draft & plan only** — nothing publishes, sends, or spends without your explicit approval.
3. **No phantom integrations** — it never claims Shopify/Canva/ads/email tools are connected unless you set them up.

Full rules in [`CLAUDE.md`](CLAUDE.md).

---

## 📁 Structure

```
ecommerce-team/
├── CLAUDE.md              ← master orchestrator (the brain)
├── .claude/agents/        ← the 7 specialists
│   ├── research.md  ├── offer.md  ├── product-page.md
│   ├── creative.md  ├── ads.md    ├── email.md
│   └── analytics.md
├── product.md             ← YOUR product, brand voice, price (fill this in!)
└── launch/                ← the assembly line — numbered files, in order
    ├── 1-research.md  ├── 2-offer.md
    ├── 3-product-page.md  ├── 4-creative.md
    ├── 5-ads.md  ├── 6-email.md
    └── 7-analytics.md
```

The numbered files ARE the assembly line — each agent writes to its file, the next reads the one before.

---

## ⚡ Quick Start

1. Open Claude Code in this folder:
   ```bash
   cd ecommerce-team
   claude
   ```
2. Fill in `product.md` — what you sell, who it's for, the price, your brand voice (or let the team interview you).
3. Say **"launch this product."**
4. Approve at each step — research → offer → page → creative → ads → email.
5. Copy the product page into your store, the emails into your email tool, the ad plan into your ad account — **YOU publish.**
6. After launch, paste real data to the Analytics agent → get your top fix.
7. Loop: improve the offer/ads/page, run again.

---

## 🤖 The 7 Agents

| Agent | Does | Tools | Writes |
|-------|------|-------|--------|
| 1️⃣ Research | Customer, competitors, pain points, angles | Web search | `1-research.md` |
| 2️⃣ Offer | Promise, bonuses, guarantee, price framing | None (files) | `2-offer.md` |
| 3️⃣ Product Page | Headline, benefits, copy, FAQ, CTA | Shopify *(optional — you paste)* | `3-product-page.md` |
| 4️⃣ Creative | Ad concepts + asset briefs | Canva *(optional)* | `4-creative.md` |
| 5️⃣ Ads | Campaign, targeting, test + budget plan | Meta/Google/TikTok *(YOU launch)* | `5-ads.md` |
| 6️⃣ Email | Welcome, cart, post-purchase, promo | Klaviyo/Mailchimp *(YOU send)* | `6-email.md` |
| 7️⃣ Analytics | Reviews YOUR real data, finds the top fix | Shopify/ads exports *(YOU provide)* | `7-analytics.md` |

The team works from files without any of the optional tools — connect when ready.

---

## 🎬 Example Workflow

**Product:** a $34 minimalist ceramic pour-over coffee dripper.

| Agent | Output (example) |
|-------|------------------|
| Research | Buyers = home-cafe hobbyists; competitors look cluttered *(cited)* |
| Offer | "Café-quality pour-over at home" + free filters + 30-day guarantee |
| Product Page | Headline, benefits, FAQ, CTA |
| Creative | 3 ad concepts + visual direction + briefs |
| Ads | Campaign + targeting + test plan *(for YOU to run)* |
| Email | Welcome + cart + post-purchase *(drafts)* |
| Analytics | *(After launch)* reads YOUR data, suggests one fix |

---

## 🚦 Human Approval (Required)

The team drafts and plans. **You approve before:** publishing a product page, launching an ad, sending an email, or spending money. Agents never do these automatically — they prepare, you press go.

---

*Build guide by @seb.ai · adapted for this repo's Claude Code builds alongside [`../ai-employee/`](../ai-employee/)*
