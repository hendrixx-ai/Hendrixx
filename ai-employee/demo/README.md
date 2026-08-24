# 🎬 AI EMPLOYEE — Demo Run

**Date:** Wednesday 2026-08-19 (simulated 07:00 EAT morning routine)

> ⚠️ **This is a DEMO.** All names, companies, emails, and meetings in `input/` are
> **fictional sample data** used to show how the workflow works. The real `daily/`
> folder is untouched — outputs go to `output/`.
>
> In production, everything comes from your connected Gmail/Calendar or files you
> paste — and nothing is ever invented (Rule 2).

## How it maps to production

| Production | Demo |
|-----------|------|
| Gmail inbox | `input/emails.md` |
| Google Calendar | `input/meetings.md` |
| Research queue | `input/research-queue.md` |
| Past threads (follow-ups) | `input/threads.md` |
| daily/ outputs | `output/` (same file names + formats) |

## The pipeline being demonstrated

```
INBOX → RESEARCH → CALENDAR → TASKS → FOLLOW-UP → REPORT → (DIGEST 📧)
                                                    ↓ (Fridays)      ↓ (1st)
                                                  WEEKLY           MONTHLY
```

All steps below simulate what `scripts/morning-routine.sh`,
`scripts/weekly-review.sh` and `scripts/monthly-review.sh` run automatically.
