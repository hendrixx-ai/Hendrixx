# AFRIVet Care

A mobile-first web app for keeping animal health records: pets (and livestock), health
records, vet visits, vaccinations and medications, and uploaded files and photos.

Built with Next.js (App Router) and TypeScript. Lives in the `afrivet-care/` folder of this repository.

## Run it

```bash
cd afrivet-care
npm install
npm run dev        # http://localhost:3000
```

With no environment variables the app starts in **demo mode**: no sign-in, sample data held
in server memory, and nothing is saved permanently. Each service below switches on by itself
once its variables are present.

## Services and environment variables

Variable names are listed in [`.env.example`](.env.example). **Never commit real values.**
Locally, copy the file to `.env.local` (git-ignored). On Vercel, add them under
*Project → Settings → Environment Variables*, then redeploy.

| Service | Variables | What it enables |
| --- | --- | --- |
| Clerk | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Sign-in / sign-up; each user sees only their own data |
| Clerk webhook | `CLERK_WEBHOOK_SIGNING_SECRET` | Lets Clerk tell the app when someone signs up |
| Neon | `DATABASE_URL` | Permanent storage in Postgres |
| Vercel Blob | `BLOB_READ_WRITE_TOKEN` | File and photo uploads (private store) |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Welcome email on sign-up |
| App | `NEXT_PUBLIC_APP_URL`, `APP_TIMEZONE` | Link used in emails; clinic timezone (default `Africa/Dar_es_Salaam`) |

Setup order:

1. **Clerk** – create an application, copy the two keys.
2. **Neon** – create a database, copy the pooled connection string into `DATABASE_URL`, then
   create the tables once: `DATABASE_URL=... npm run db:migrate` (runs `db/schema.sql`, safe to repeat).
3. **Vercel Blob** – in Vercel: *Storage → Create → Blob*, choose **private** access, and connect it
   to the project (this adds `BLOB_READ_WRITE_TOKEN`).
4. **Resend** – verify a sending domain, create an API key, set `EMAIL_FROM` (e.g. `AFRIVet Care <hello@yourdomain>`).
5. **Welcome email** – in Clerk: *Configure → Webhooks → Add endpoint*
   `https://<your-domain>/api/webhooks/clerk`, subscribe to `user.created`, and copy the signing
   secret into `CLERK_WEBHOOK_SIGNING_SECRET`.

Check what is switched on at `/api/health` (it reports true/false only, never values).

Safety rule: if `DATABASE_URL` is set but the Clerk keys are not, the deployed app refuses to
show data, because without sign-in every visitor would share the same records.

## How it is organised

```
db/schema.sql              Postgres tables (users, pets, health_records, appointments, treatments, attachments)
scripts/migrate.mjs        Applies the schema to Neon
src/proxy.ts               Clerk route protection (everything private except sign-in, webhook, health)
src/app/                   Screens: dashboard, pets, records, treatments, appointments, sign-in/up
src/app/actions.ts         Server actions for saving and deleting
src/app/api/upload         Upload endpoint          src/app/api/files/[id]   Private file delivery
src/app/api/webhooks/clerk Sign-up webhook → welcome email
src/lib/schema.ts          The data model; forms and validation are generated from it
src/lib/repo.ts            Data access: Postgres driver + in-memory demo driver (same interface)
src/lib/service.ts         Rules: validation, ownership checks, cascading deletes
src/lib/storage.ts         Upload checks + Vercel Blob / in-memory file stores
src/lib/email.ts           Resend welcome email
src/lib/config.ts          Decides which services are on
```

Design notes:

- **Privacy** – every query is scoped to the signed-in user's id; records can only be attached to
  a pet that user owns; files are stored privately and served only through `/api/files/[id]`
  after an ownership check.
- **Uploads** – JPG, PNG, WebP or PDF up to 4 MB (the request limit of a Vercel function). File
  contents are checked, not just the extension.
- **Dates** – visit times are stored as clinic wall-clock time, so "09:30" stays "09:30";
  "today" is worked out in `APP_TIMEZONE`.
- **Reminders** – a vaccination or medication shows as due when its *latest* entry is overdue or
  due within 30 days; logging a booster clears the reminder.
- **Welcome email** – sent once per user; if sending fails Clerk retries the webhook.

## Tests

```bash
npm test           # unit + data-layer tests
npm run typecheck
npm run build
```

The data-layer tests run the same suite against the in-memory driver and against real Postgres
(PGlite, in-process) using `db/schema.sql`, so the schema and every generated query are exercised.

## Deploying on Vercel

Import the GitHub repository, set **Root Directory** to `afrivet-care`, framework **Next.js**.
Add the environment variables above, then deploy.

## Not built yet

Editing of records, visits and treatments after saving (delete and re-add for now; pets can be
edited, visits can be marked done or cancelled), reminders by email/SMS, sharing a pet between users.
