# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Next.js App                          │
│  ┌──────────────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │    Module C      │  │ Module D │  │    Module E      │  │
│  │  Ads Intelligence│  │ Creative │  │  Pay-Per-Call CRM│  │
│  └────────┬─────────┘  └────┬─────┘  └────────┬─────────┘  │
│           └─────────────────┴─────────────────-┘            │
│                              │                               │
│                    ┌─────────▼──────┐                       │
│                    │  Supabase DB   │                       │
│                    └────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
   ┌─────▼─────┐       ┌──────▼─────┐      ┌──────▼─────┐
   │ Supabase  │       │  BullMQ /  │      │  External  │
   │ Postgres  │       │  Redis     │      │  APIs      │
   │ Auth      │       │  Job Queue │      │  Twilio    │
   │ Storage   │       └────────────┘      │  SerpAPI   │
   │ Realtime  │                           │  Deepgram  │
   └───────────┘                           └────────────┘
```

---

## Data Flow

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

### Ads Pipeline
```
[Module C] Ads Intelligence
    → SerpAPI: keyword research + competitor ads
    → Claude: extract hooks, offer structure, angles
    → Store: market_keywords, competitor_ads tables

[Module D] Creative Factory
    → Reads competitor_ads + manual problem input
    → Claude: generate hooks, ad copy, UGC scripts
    → Store: ads table
    → Output: ready-to-run creatives + A/B test plan
```

---

## Module Boundaries

| Module | Owns | Reads From |
|---|---|---|
| C — Ads Intel | market_keywords, competitor_ads | — |
| D — Creative | ads, creative_briefs | competitor_ads (C) |
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
    (Claude API)           (Deepgram/SerpAPI)
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
│   │   ├── ads-intel/          # Module C UI
│   │   ├── creative/           # Module D UI
│   │   └── crm/                # Module E UI
│   └── api/
│       ├── creative/
│       ├── crm/
│       └── webhooks/
│           └── twilio/         # Twilio call webhook
├── lib/
│   ├── ai/                     # Claude prompts + parsers
│   ├── db/                     # Supabase client + queries
│   ├── queue/                  # BullMQ job definitions
│   └── twilio/                 # Twilio helpers
├── workers/                    # BullMQ worker processes
├── components/                 # Shared UI components
├── docs/                       # This folder
└── supabase/
    └── migrations/             # DB schema migrations
```
