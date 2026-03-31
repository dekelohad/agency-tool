# Database Schema (Supabase / PostgreSQL)

All tables have Row Level Security (RLS) enabled. Users only access rows they own.

---

## Auth & Tenancy

```sql
-- Handled by Supabase Auth (auth.users)

-- Client accounts (buyers / PPC clients)
create table clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  email       text,
  payout_per_call numeric(10,2),     -- $ per billable call
  created_at  timestamptz default now()
);
```

---

## Module C — Ads Intelligence

```sql
create table market_keywords (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  niche           text not null,
  city            text,
  keyword         text not null,
  cpc_estimate    text,                 -- 'low' | 'medium' | 'high'
  cpc_value       numeric(6,2),        -- estimated $ CPC
  competition     text,                 -- 'low' | 'medium' | 'high'
  intent          text,                 -- 'informational' | 'transactional' | 'emergency'
  created_at      timestamptz default now()
);

create table competitor_ads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  niche       text,
  city        text,
  source      text,                     -- 'facebook' | 'google'
  hook        text,
  primary_text text,
  headline    text,
  offer       text,
  cta         text,
  angles      text[],                   -- urgency, pricing, guarantee etc.
  raw_data    jsonb,
  created_at  timestamptz default now()
);
```

---

## Module D — Creative Factory

```sql
create table creative_briefs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  niche           text,
  target_audience text,
  created_at      timestamptz default now()
);

create table ads (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid references creative_briefs not null,
  user_id         uuid references auth.users not null,
  format          text,                 -- 'image' | 'video' | 'ugc'
  hook            text,
  primary_text    text,
  headline        text,
  cta             text,
  image_concept   text,
  video_concept   text,
  storyboard      text,
  shot_list       text[],
  landing_copy    jsonb,                -- { headline, subhead, bullets, cta }
  ab_variant      text,                 -- 'A' | 'B' | 'C'
  created_at      timestamptz default now()
);
```

---

## Module E — Pay-Per-Call CRM

```sql
create table twilio_numbers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  client_id   uuid references clients,  -- buyer this number belongs to
  number      text not null unique,      -- e.g. +13055551234
  label       text,                      -- "Miami HVAC Campaign 1"
  campaign    text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

create table calls (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  client_id       uuid references clients,
  twilio_number_id uuid references twilio_numbers,
  twilio_call_sid text unique,
  caller_number   text,
  direction       text default 'inbound',
  duration_sec    int,
  recording_url   text,
  recording_path  text,                  -- Supabase Storage path
  started_at      timestamptz,
  created_at      timestamptz default now()
);

create table call_transcripts (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid references calls not null unique,
  transcript  text,
  provider    text,                      -- 'deepgram'
  created_at  timestamptz default now()
);

create table call_classifications (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid references calls not null unique,
  is_billable     boolean,
  category        text,                  -- 'service_request' | 'spam' | 'agency' | 'lead_vendor' | 'job_seeker' | 'wrong_number' | 'irrelevant_service'
  service_type    text,                  -- 'HVAC' | 'water_damage' | etc.
  location        text,
  intent          text,                  -- 'quote' | 'booking' | 'emergency'
  duration_valid  boolean,
  reason          text not null,         -- plain English explanation
  disputed        boolean default false,
  dispute_note    text,
  classified_at   timestamptz default now()
);
```

---

## Indexes

```sql
create index on calls (user_id, started_at desc);
create index on call_classifications (is_billable, call_id);
create index on twilio_numbers (user_id, client_id);
```

---

## Row Level Security (RLS)

Pattern applied to every table:

```sql
alter table calls enable row level security;

create policy "users see own calls"
  on calls for all
  using (auth.uid() = user_id);
```

Same pattern for: `clients`, `twilio_numbers`, `call_transcripts`, `call_classifications`, `market_keywords`, `competitor_ads`, `creative_briefs`, `ads`.
