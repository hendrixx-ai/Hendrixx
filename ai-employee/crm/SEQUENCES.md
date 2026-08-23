# 📬 FOLLOW-UP SEQUENCES — The Bump Scripts

*Pre-written templates the AI Employee uses for every "bump" email. It matches the voice + context of the original outreach; you just review and approve.*

---

## Universal rules

1. **Always reference the last touch.** The AI reads `PROSPECTS.md` history and pulls the previous subject line + date.
2. **One question per email.** Never stack asks.
3. **Different angle each bump** (not just "bumping again").
4. **Match voice:** uses `voice-samples.md` — for mineral business, samples 18–25.
5. **Short.** Bumps are ≤ 4 sentences. Bloat kills reply rates.
6. **Honest about silence.** Never "I hope this finds you well" / "just circling back" filler.

---

## Sequence by stage

### 🔍 LEAD → ✉️ CONTACTED

**Bump 0 (initial outreach)** — see `voice-samples.md`:
- #18 Cold outreach — mining company owner
- #19 Cold outreach — mining investor
- The AI picks the right one based on `PROSPECTS.md` `type` field.

### ✉️ CONTACTED → 💬 ENGAGED

| Day | Trigger | Template |
|-----|---------|-----------|
| **+7** | silence | **Bump 1 — Gentle nudge** |
| **+14** | silence | **Bump 2 — Value-add / different angle** |
| **+21** | silence | **Bump 3 — Last-touch close-out** |
| **+30** | silence | **Archive** (LOST — "no response × 30 days") |

#### Bump 1 — Gentle nudge *(+7 days silence)*

> **Subject:** Re: [original subject]
>
> Hi [Name],
>
> Wanted to make sure this didn't get buried — any thoughts on the [project / spec / quote]?
>
> Happy to jump on a 5-min call if useful.
>
> Best,
> Hendrixx

#### Bump 2 — Value-add / different angle *(+14 days silence)*

> **Subject:** [different angle — e.g., a question, a resource, a market data point]
>
> Hi [Name],
>
> Saw [X in the news / a spec change / a pricing move] — made me think of your [project].
>
> [One-line question tied to their stated need.]
>
> Best,
> Hendrixx

#### Bump 3 — Last-touch close-out *(+21 days silence)*

> **Subject:** Closing the loop
>
> Hi [Name],
>
> Don't want to keep pinging. Closing the loop on this one — if timing's not right, no worries; we can revisit when it is.
>
> Best,
> Hendrixx

#### Archive entry (auto-drafted at +30 days)
```
archived/lost/[name]-YYYY-MM-DD.md
Reason: No response after 3 touches (initial + 7d + 14d + 21d) over 30 days.
Lesson: [One sentence — what to learn for next prospect like this.]
```

---

### 💬 ENGAGED → 🤝 MEETING

| Trigger | Template |
|---------|-----------|
| After back-and-forth, conversation stalls 7d | **Re-engage** (different value-add) |
| After a concrete ask is unanswered for 7d | **Confirm the next step** |

#### Re-engage
> Hi [Name],
>
> Picking this back up — what's the best next move from your side? [Open call / Send sample / Schedule call.]
>
> Best,
> Hendrixx

#### Confirm the next step
> Hi [Name],
>
> Quick confirm: are we still good to [do the thing they said yes to] this week?
>
> Best,
> Hendrixx

---

### 🤝 MEETING → 📄 QUOTING

| Trigger | Template |
|---------|-----------|
| Day after meeting, no thank-you/quote request from them | **Send meeting recap + next step** |
| 7d after sending recap, no quote request | **Bump: ask what they need to decide** |

#### Meeting recap (use `voice-samples.md` § 16)

> **Subject:** Great call — next step
>
> Hi [Name],
>
> Good chat today. Here's what I heard as your priority: [one line].
>
> **Next:** I'll send over [docs / proposal / timeline] by [date].
> **You:** review + let me know if [specific question].
>
> Best,
> Hendrixx

#### Quote ask bump
> Hi [Name],
>
> Following up — anything else you need from my side before I send the quote? Want to make sure the spec is right.
>
> Best,
> Hendrixx

---

### 📄 QUOTING → ✅ WON or ❌ LOST

| Trigger | Template |
|---------|-----------|
| 14d after quote, no response | **Bump: still reviewing?** |
| 21d after quote, no response | **Bump: closing the file or moving forward?** |
| Reply received | Branch → WON or LOST flow |

#### Still reviewing?
> Hi [Name],
>
> Quick check — still reviewing the [proposal]? Anything to adjust on spec, volume, or terms?
>
> Best,
> Hendrixx

#### Closing the file
> Hi [Name],
>
> Sounds like timing isn't right — I'll close this out for now.
>
> Door's always open if this comes back. No hard feelings.
>
> Best,
> Hendrixx

---

## Override rules

Add to any prospect block in `PROSPECTS.md` to override defaults:

```yaml
prospect: Barrick Mining
cadence_days: [7, 21, 45]      # skip the +14 bump
skip_bump_if_status: HOT       # never bump while HOT
pause_until: 2026-09-01       # don't touch until this date
```

---

*Sequences defined: 2026-08-19 · Review cadence: revisit quarterly based on reply rates*
