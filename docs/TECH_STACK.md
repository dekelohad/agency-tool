# Tech Stack

## Frontend
| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | SSR + API routes in one repo, easy Vercel deploy |
| Styling | Tailwind CSS | Rapid UI, no style conflicts |
| Components | shadcn/ui | Unstyled accessible components, works with Tailwind |
| Design Quality | impeccable.style | AI design skill package — commands like `/polish`, `/audit`, `/typeset` for high-quality UI output |
| Charts | Recharts | Lightweight, composable — needed for CRM dashboard |
| Data Fetching | TanStack Query | Cache + background refresh for live call data |
| Forms | React Hook Form + Zod | Validation with type safety |

## Backend
| Layer | Choice | Why |
|---|---|---|
| Runtime | Next.js API Routes | Co-located with frontend, no extra server |
| Job Queue | BullMQ + Redis (Upstash) | Long-running jobs (transcription, AI classification) off the request cycle |

## Database & Auth
| Layer | Choice | Why |
|---|---|---|
| Database | Supabase (PostgreSQL) | Auth + DB + Storage + Realtime in one |
| Auth | Supabase Auth | Built-in, supports multi-tenant via RLS |
| Storage | Supabase Storage | Call recordings, CSV exports |
| Realtime | Supabase Realtime | Live call dashboard updates without polling |

## AI & Processing
| Layer | Choice | Why |
|---|---|---|
| LLM | Anthropic Claude (claude-sonnet-4-6) | Best for structured output extraction + classification |
| Transcription | Deepgram | Faster + cheaper at scale; optimized for phone-call audio |

## External Integrations
| Service | Module | Purpose |
|---|---|---|
| Twilio | Module E | Inbound call tracking, recording, webhooks |
| Facebook Ads Library | Module C | Competitor ad research (scrape or manual import) |
| Google Search API (SerpAPI) | Module C | Google ads SERP data, keyword research |

## DevOps
| Layer | Choice |
|---|---|
| Hosting | Vercel (frontend + API routes) |
| Redis | Upstash (serverless Redis, free tier available) |
| Secrets | Vercel env vars + Supabase vault |
| CI/CD | GitHub Actions → Vercel auto-deploy |

---

## Key Decisions

**Why not a separate Express backend?**
Next.js API routes handle everything at this scale. If job processing gets heavy, move to a dedicated worker on Railway/Render — the queue interface stays the same.

**Why Claude for all AI tasks?**
Consistent structured output via tool_use, strong reasoning for billable classification, handles long transcripts well. Single vendor = simpler billing + debugging.

**Why Deepgram over Whisper?**
Real-time streaming transcription, better phone-call audio models, ~10x faster than Whisper for batch.

**Why impeccable.style?**
Adds structured design commands to AI assistants (Claude Code, Cursor, etc.) so UI output is consistently polished. Install once with `npx skills add pbakaus/impeccable`, then use `/polish`, `/audit`, `/typeset`, `/overdrive` etc. during development to enforce design quality across all modules.
