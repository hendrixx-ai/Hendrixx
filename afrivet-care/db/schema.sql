-- AFRIVet Care — Neon (Postgres) schema.
-- Idempotent: safe to run more than once. Apply with `npm run db:migrate`.
-- Keep in sync with src/lib/schema.ts.

create table if not exists users (
  id                    text primary key,            -- Clerk user id
  email                 text,
  name                  text,
  welcome_email_sent_at timestamptz,
  created_at            timestamptz not null default now()
);

create table if not exists pets (
  id         uuid primary key,
  owner_id   text not null,                          -- Clerk user id
  name       text not null,
  species    text not null,
  breed      text,
  sex        text,
  birth_date date,
  weight_kg  numeric(7,2),
  notes      text,
  photo_url  text,
  created_at timestamptz not null default now()
);
create index if not exists pets_owner_idx on pets (owner_id);

create table if not exists health_records (
  id          uuid primary key,
  owner_id    text not null,
  pet_id      uuid not null references pets (id) on delete cascade,
  title       text not null,
  kind        text not null,
  record_date date not null,
  vet_name    text,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists health_records_owner_idx on health_records (owner_id, record_date desc);
create index if not exists health_records_pet_idx on health_records (pet_id);

create table if not exists appointments (
  id           uuid primary key,
  owner_id     text not null,
  pet_id       uuid not null references pets (id) on delete cascade,
  title        text not null,
  scheduled_at timestamp not null,                   -- clinic wall-clock time (APP_TIMEZONE)
  clinic       text,
  notes        text,
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'completed', 'cancelled')),
  created_at   timestamptz not null default now()
);
create index if not exists appointments_owner_idx on appointments (owner_id, scheduled_at);
create index if not exists appointments_pet_idx on appointments (pet_id);

create table if not exists treatments (
  id          uuid primary key,
  owner_id    text not null,
  pet_id      uuid not null references pets (id) on delete cascade,
  type        text not null check (type in ('vaccination', 'medication')),
  name        text not null,
  dose        text,
  given_on    date not null,
  next_due_on date,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists treatments_owner_idx on treatments (owner_id, next_due_on);
create index if not exists treatments_pet_idx on treatments (pet_id);

create table if not exists attachments (
  id           uuid primary key,
  owner_id     text not null,
  pet_id       uuid not null references pets (id) on delete cascade,
  file_name    text not null,
  content_type text not null,
  size_bytes   integer not null,
  storage      text not null,                        -- 'blob' (Vercel Blob)
  storage_key  text not null,
  created_at   timestamptz not null default now()
);
create index if not exists attachments_owner_idx on attachments (owner_id);
create index if not exists attachments_pet_idx on attachments (pet_id);
