# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Module A │  │ Module B │  │ Module C │  │ Module D │   │
│  │ Amazon   │  │ Reddit   │  │ Ads Intel│  │ Creative │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └──────────────┴──────────────┴──────────────┘        │
│                           │                                  │
│                    ┌──────▼──────┐                          │
│                    │  Module E   │                          │
│                    │  PPC CRM    │                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
   ┌─────▼─────┐       ┌──────▼─────┐      ┌──────▼─────┐
   │ Supabase  │       │  BullMQ /  │      │  External  │
   │ Postgres  │       │  Redis     │      │  APIs      │
   │ Auth      │       │  Job Queue │      │  Twilio    │
   │ Storage   │       └────────────┘      │  Rainforest│
   │ Realtime  │                           │  Reddit    │
   └───────────┘                           │  SerpAPI   │
                                           └────────────┘
```

---

## Data Flow

### Research → Ads Pipeline
```
[Module A] Amazon keyword
    → Rainforest API → top products + 1-3★ reviews
    → Claude: cluster problems, extract themes, score sentiment
    → Store: problem_clusters table

[Module B] Reddit subreddit/keyword
    → Reddit API → posts + comments
    → Claude: extract complaints, emotional signals, "I wish" signals
    → Store: problem_clusters table (same schema, source = reddit)

[Module D] Creative Factory
    → Reads problem_clusters
    → Claude: generate hooks, ad copy, UGC scripts, image concepts
    → Store: ads table
    → Output: ready-to-run creatives + A/B test plan
```

### Call Tracking Pipeline
```
[Twilio] Inbound call hits number
    → Webhook POST → /api/webhooks/twilio
    → Record call metadata → calls table
    → Download recording → Supabase Storage

[Transcription Worker] (BullMQ job)
    → Pull recording URL
    → Deepgram API → transcript
    → Store: call_transcripts table

[AI Classification Worker] (BullMQ job)
    → Read transcript
    → Claude: classify call, extract service_type, location, intent
    → Determine: is_billable + reason
    → Store: call_classifications table
    → Trigger: Realtime update → CRM dashboard
```

---

## Module Boundaries

| Module | Owns | Reads From |
|---|---|---|
| A — Amazon | products, amazon_reviews, problem_clusters (source=amazon) | — |
| B — Reddit | reddit_posts, problem_clusters (source=reddit) | — |
| C — Ads Intel | market_keywords, competitor_ads | — |
| D — Creative | ads, creative_briefs | problem_clusters (A+B) |
| E — CRM | calls, transcripts, classifications, clients | ads (campaign attribution) |

---

## Job Queue Architecture

All long-running tasks go through BullMQ so API routes return immediately.

```
API Route → enqueue job → return { jobId }
              │
         BullMQ Queue
              │
         Worker Process
              │
         ┌────┴────────────────────┐
         │                         │
    AI Analysis              Data Fetch
    (Claude API)          (Rainforest/Reddit)
         │                         │
         └────────┬────────────────┘
                  │
           Supabase Insert
                  │
           Supabase Realtime
                  │
            UI updates live
```

Job types:
- `amazon.analyze` — fetch + AI analysis for a keyword
- `reddit.mine` — pull + AI analysis for a subreddit/topic
- `call.transcribe` — download recording + Deepgram
- `call.classify` — run Claude classification on transcript
- `creative.generate` — generate ads from problem clusters

---

## Multi-Tenant / Client Isolation

For the CRM (Module E), calls can be attributed to specific clients (buyers).

```
users (Supabase Auth)
  └── clients (accounts they manage)
        └── twilio_numbers
              └── calls
                    └── call_classifications
```

Row Level Security (RLS) on all tables — users only see their own data.

---

## Realtime Updates

CRM dashboard uses Supabase Realtime subscriptions:
- `calls` table → new call appears instantly
- `call_classifications` table → billable status updates live

No polling needed.

---

## File Structure

```
agency-tool/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Login / signup
│   ├── dashboard/              # Main layout
│   │   ├── amazon/             # Module A UI
│   │   ├── reddit/             # Module B UI
│   │   ├── ads-intel/          # Module C UI
│   │   ├── creative/           # Module D UI
│   │   └── crm/                # Module E UI
│   └── api/
│       ├── amazon/
│       ├── reddit/
│       ├── creative/
│       ├── crm/
│       └── webhooks/
│           └── twilio/         # Twilio call webhook
├── lib/
│   ├── ai/                     # Claude prompts + parsers
│   ├── db/                     # Supabase client + queries
│   ├── queue/                  # BullMQ job definitions + workers
│   ├── twilio/                 # Twilio helpers
│   ├── rainforest/             # Amazon API client
│   └── reddit/                 # Reddit API client
├── components/                 # Shared UI components
├── docs/                       # This folder
└── supabase/
    └── migrations/             # DB schema migrations
```
