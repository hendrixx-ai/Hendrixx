# 📮 TEST EMAILS — Phase 2, Ready to Send

**To:** evanceahadi@gmail.com (the test inbox)
**From:** your primary account (or any second account you own)

Send these **5 emails** (optional 6th bonus) to evanceahadi@gmail.com a few
minutes before your first real run. They arrive as an unread morning inbox —
exactly what `morning-routine.sh` will sort.

> 💡 **Alternative (no emailing):** mark any 5 existing emails in the test inbox
> as **unread** — the INBOX step reads unread email. But sending these gives
> recognizable, verifiable results.

---

## 📧 Email 1 — should sort as 🔴 URGENT

**To:** evanceahadi@gmail.com
**Subject:** Re: Q3 deadline — can we commit?

> Hi,
>
> Our board wants a confirmed delivery date for the Q3 rollout before
> Friday. Can you commit to the original Sep 30 date, or do we need to
> talk about what changes?
>
> — Sarah

---

## 📧 Email 2 — should sort as 🟡 REPLY (draft needed)

**To:** evanceahadi@gmail.com
**Subject:** Updated quote — office supplies

> Hi,
>
> Revised quote attached per our call: 12% off the annual order if we
> sign by end of month. Delivery in 2 weeks.
>
> — Tom

---

## 📧 Email 3 — should sort as 🟡 REPLY + show up in FOLLOW-UP (you owe a reply)

**To:** evanceahadi@gmail.com
**Subject:** Partnership call recap + next step

> Hi,
>
> Great call last week. As agreed, I'll wait for your go/no-go on the
> joint proposal before we loop in their team.
>
> — Maya
>
> *P.S. Send this one first (or mark it 5 days old) so the employee sees
> it as an aging follow-up — if it's too fresh, it may not count as "due".*

---

## 📧 Email 4 — should sort as 🟢 TASK (needs approval to book)

**To:** evanceahadi@gmail.com
**Subject:** Venue availability — Q4 offsite

> The Lakeview venue is available Sep 18–19 for the offsite. To hold it
> we need a 30% deposit by Friday. Want us to proceed?
>
> — Events Team

---

## 📧 Email 5 — should sort as ⚪ IGNORE

**To:** evanceahadi@gmail.com
**Subject:** This week in AI agents — 5 reads

> [Newsletter content — product roundups, tutorials, links.]

---

## 📧 Email 6 — OPTIONAL BONUS, should sort as 🔴 URGENT (money)

**To:** evanceahadi@gmail.com
**Subject:** Invoice #23 overdue — 14 days

> Invoice #23 (vendor platform, $1,240) is now 14 days overdue. Please
> arrange payment this week to avoid a hold on the account.
>
> — Accounts

---

## ✅ How to verify (after `bash scripts/morning-routine.sh`)

| You sent | Expect in `daily/inbox.md` |
|----------|---------------------------|
| Email 1 | 🔴 Urgent — Sarah · draft ready |
| Email 2 | 🟡 Reply — Tom · draft ready |
| Email 3 | 🟡 Reply — Maya · draft ready + 🔔 follow-up "5 days" |
| Email 4 | 🟢 Task — book venue → ⏸️ approval |
| Email 5 | ⚪ Ignore — newsletter |
| Email 6 (bonus) | 🔴 Urgent — invoice → ⏸️ approval (pay $1,240) |

And in **Gmail (evanceahadi@gmail.com)**: Sent folder empty · Drafts folder
contains the employee's drafts only.
