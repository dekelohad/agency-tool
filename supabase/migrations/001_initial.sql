-- ============================================================
-- 001_initial.sql
-- All tables for all modules
-- ============================================================

-- Auth & Tenancy

create table if not exists clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  name        text not null,
  email       text,
  payout_per_call numeric(10,2),
  created_at  timestamptz default now()
);

alter table clients enable row level security;
create policy "users see own clients"
  on clients for all
  using (auth.uid() = user_id);

-- ============================================================
-- Module A — Amazon
-- ============================================================

create table if not exists amazon_analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  keyword     text not null,
  category    text,
  status      text default 'pending' check (status in ('pending','running','done','failed')),
  created_at  timestamptz default now()
);

alter table amazon_analyses enable row level security;
create policy "users see own amazon_analyses"
  on amazon_analyses for all
  using (auth.uid() = user_id);

create table if not exists amazon_products (
  id              uuid primary key default gen_random_uuid(),
  analysis_id     uuid references amazon_analyses not null,
  asin            text not null,
  name            text,
  price           numeric(10,2),
  rating          numeric(3,2),
  review_count    int,
  bsr             int,
  review_velocity numeric(6,2),
  url             text,
  created_at      timestamptz default now()
);

alter table amazon_products enable row level security;
create policy "users see own amazon_products"
  on amazon_products for all
  using (
    exists (
      select 1 from amazon_analyses a
      where a.id = amazon_products.analysis_id
        and a.user_id = auth.uid()
    )
  );

create table if not exists amazon_reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references amazon_products not null,
  rating      int check (rating between 1 and 3),
  title       text,
  body        text,
  date        date,
  verified    boolean,
  created_at  timestamptz default now()
);

alter table amazon_reviews enable row level security;
create policy "users see own amazon_reviews"
  on amazon_reviews for all
  using (
    exists (
      select 1 from amazon_products p
      join amazon_analyses a on a.id = p.analysis_id
      where p.id = amazon_reviews.product_id
        and a.user_id = auth.uid()
    )
  );

-- ============================================================
-- Shared — Problem Clusters (Modules A, B → D)
-- ============================================================

create table if not exists problem_clusters (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  source          text not null check (source in ('amazon','reddit')),
  source_id       uuid not null,
  theme           text not null,
  frequency_pct   numeric(5,2),
  intensity       text check (intensity in ('high','medium','low')),
  sentiment_score numeric(4,3),
  sample_quotes   text[],
  root_cause      text,
  expectation_gap text,
  opportunity     text,
  created_at      timestamptz default now()
);

alter table problem_clusters enable row level security;
create policy "users see own problem_clusters"
  on problem_clusters for all
  using (auth.uid() = user_id);

-- ============================================================
-- Module B — Reddit
-- ============================================================

create table if not exists reddit_analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  subreddit   text,
  keywords    text[],
  status      text default 'pending' check (status in ('pending','running','done','failed')),
  created_at  timestamptz default now()
);

alter table reddit_analyses enable row level security;
create policy "users see own reddit_analyses"
  on reddit_analyses for all
  using (auth.uid() = user_id);

create table if not exists reddit_posts (
  id              uuid primary key default gen_random_uuid(),
  analysis_id     uuid references reddit_analyses not null,
  post_id         text,
  title           text,
  body            text,
  subreddit       text,
  upvotes         int,
  comment_count   int,
  url             text,
  created_at      timestamptz default now()
);

alter table reddit_posts enable row level security;
create policy "users see own reddit_posts"
  on reddit_posts for all
  using (
    exists (
      select 1 from reddit_analyses a
      where a.id = reddit_posts.analysis_id
        and a.user_id = auth.uid()
    )
  );

-- ============================================================
-- Module C — Ads Intelligence
-- ============================================================

create table if not exists market_keywords (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  niche           text not null,
  city            text,
  keyword         text not null,
  cpc_estimate    text check (cpc_estimate in ('low','medium','high')),
  cpc_value       numeric(6,2),
  competition     text check (competition in ('low','medium','high')),
  intent          text check (intent in ('informational','transactional','emergency')),
  created_at      timestamptz default now()
);

alter table market_keywords enable row level security;
create policy "users see own market_keywords"
  on market_keywords for all
  using (auth.uid() = user_id);

create table if not exists competitor_ads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  niche       text,
  city        text,
  source      text check (source in ('facebook','google')),
  hook        text,
  primary_text text,
  headline    text,
  offer       text,
  cta         text,
  angles      text[],
  raw_data    jsonb,
  created_at  timestamptz default now()
);

alter table competitor_ads enable row level security;
create policy "users see own competitor_ads"
  on competitor_ads for all
  using (auth.uid() = user_id);

-- ============================================================
-- Module D — Creative Factory
-- ============================================================

create table if not exists creative_briefs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  niche           text,
  target_audience text,
  cluster_ids     uuid[],
  created_at      timestamptz default now()
);

alter table creative_briefs enable row level security;
create policy "users see own creative_briefs"
  on creative_briefs for all
  using (auth.uid() = user_id);

create table if not exists ads (
  id              uuid primary key default gen_random_uuid(),
  brief_id        uuid references creative_briefs not null,
  user_id         uuid references auth.users not null,
  format          text check (format in ('image','video','ugc')),
  hook            text,
  primary_text    text,
  headline        text,
  cta             text,
  image_concept   text,
  video_concept   text,
  storyboard      text,
  shot_list       text[],
  landing_copy    jsonb,
  ab_variant      text check (ab_variant in ('A','B','C')),
  created_at      timestamptz default now()
);

alter table ads enable row level security;
create policy "users see own ads"
  on ads for all
  using (auth.uid() = user_id);

-- ============================================================
-- Module E — Pay-Per-Call CRM
-- ============================================================

create table if not exists twilio_numbers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  client_id   uuid references clients,
  number      text not null unique,
  label       text,
  campaign    text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

alter table twilio_numbers enable row level security;
create policy "users see own twilio_numbers"
  on twilio_numbers for all
  using (auth.uid() = user_id);

create table if not exists calls (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users not null,
  client_id       uuid references clients,
  twilio_number_id uuid references twilio_numbers,
  twilio_call_sid text unique,
  caller_number   text,
  direction       text default 'inbound',
  duration_sec    int,
  recording_url   text,
  recording_path  text,
  started_at      timestamptz,
  created_at      timestamptz default now()
);

alter table calls enable row level security;
create policy "users see own calls"
  on calls for all
  using (auth.uid() = user_id);

create table if not exists call_transcripts (
  id          uuid primary key default gen_random_uuid(),
  call_id     uuid references calls not null unique,
  transcript  text,
  provider    text check (provider in ('deepgram','whisper')),
  created_at  timestamptz default now()
);

alter table call_transcripts enable row level security;
create policy "users see own call_transcripts"
  on call_transcripts for all
  using (
    exists (
      select 1 from calls c
      where c.id = call_transcripts.call_id
        and c.user_id = auth.uid()
    )
  );

create table if not exists call_classifications (
  id              uuid primary key default gen_random_uuid(),
  call_id         uuid references calls not null unique,
  is_billable     boolean,
  category        text check (category in ('service_request','spam','agency','lead_vendor','job_seeker','wrong_number','irrelevant_service')),
  service_type    text,
  location        text,
  intent          text check (intent in ('quote','booking','emergency')),
  duration_valid  boolean,
  reason          text not null,
  disputed        boolean default false,
  dispute_note    text,
  classified_at   timestamptz default now()
);

alter table call_classifications enable row level security;
create policy "users see own call_classifications"
  on call_classifications for all
  using (
    exists (
      select 1 from calls c
      where c.id = call_classifications.call_id
        and c.user_id = auth.uid()
    )
  );

-- ============================================================
-- Indexes
-- ============================================================

create index on amazon_reviews (product_id);
create index on amazon_products (analysis_id);
create index on amazon_analyses (user_id, created_at desc);
create index on problem_clusters (source_id);
create index on calls (user_id, started_at desc);
create index on call_classifications (is_billable, call_id);
create index on twilio_numbers (user_id, client_id);
