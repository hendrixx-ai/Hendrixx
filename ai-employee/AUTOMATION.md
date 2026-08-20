# AI Employee Automation

The automation scripts are ready and safe by default:

- `scripts/morning-routine.sh` — inbox, research, calendar, tasks, follow-ups, report, and digest
- `scripts/weekly-review.sh` — Friday review
- `scripts/monthly-review.sh` — first-of-month review
- `scripts/install-cron.sh` — installs all three schedules

## Prerequisites

1. Claude Code is installed (`claude --version`).
2. Gmail and Calendar MCP servers are configured and authenticated if live inbox/calendar data is required.
3. The host has `crontab` available.

## Install

```bash
cd ai-employee
bash scripts/install-cron.sh
```

Schedules use `Africa/Dar_es_Salaam`:

- Daily: 07:00 EAT
- Weekly: Friday at 16:30 EAT
- Monthly: day 1 at 08:00 EAT

## Test manually

```bash
bash scripts/morning-routine.sh
bash scripts/weekly-review.sh
bash scripts/monthly-review.sh
```

## Safety

The morning routine only receives read and draft tools. It cannot send email, create calendar events, spend money, or make other external commitments. Review `daily/approvals.md` before taking external action.

Logs are written to `ai-employee/logs/`.

If `crontab` is missing, install a scheduler first. On Debian or Ubuntu:

```bash
sudo apt-get update && sudo apt-get install -y cron
```
