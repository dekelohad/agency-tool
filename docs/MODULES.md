# Module Specs

Build order: C → D → E

---

## Module C — Market & Ads Intelligence

### Inputs
- Niche (HVAC, locksmith, water damage, etc.)
- City

### Keyword Research
- SerpAPI: pull Google SERP for high-intent queries
- Estimate CPC tier (low / medium / high) + competition
- Tag intent: informational / transactional / emergency
- Flag seasonal keywords

### Competitor Ads
Sources:
- Facebook Ads Library (scrape or manual import)
- Google SERP ads (SerpAPI)
- TikTok Ads Library (scrape)

For each ad, extract via Claude:
- Hook
- Offer structure
- CTA
- Angles: urgency / pricing / guarantee / social proof / fear

### Landing Page Analysis
- Fetch competitor landing page HTML
- Claude: extract headline, offer, guarantee, CTA, structure
- Output: landing page teardown + gap analysis

### Output
- Keyword list with CPC + competition
- Ad swipe file (filterable by angle, source, niche)
- Winning hook patterns
- Landing page benchmarks

---

## Module D — Creative Factory

### Inputs
- Niche OR product
- Target audience description
- Problem clusters (selected from Module C output or manual input)

### Ad Generation (Claude)
For each problem cluster, generate:
- 3–5 hook variations (pain, curiosity, social proof, transformation, fear)
- Primary text (long + short versions)
- Headline
- CTA options
- UGC-style first-person script (for TikTok/Reels)

### Creative Concepts
- Image concept description (for designer or AI image gen)
- Video concept + storyboard (scene-by-scene)
- Shot list

### Landing Page Copy
- Headline + subheadline
- 3–5 bullet points (problem-agitate-solution)
- CTA
- Guarantee / risk reversal line

### A/B Testing Plan
- Variant A vs B vs C (hook angle variations)
- What to test first: hook > offer > visual > CTA
- Success metrics per variant

### Output
- Ready-to-run ad set (copy + creative direction)
- Landing page copy block
- Testing roadmap

---

## Module E — Pay-Per-Call CRM

### Twilio Setup
- Connect Twilio account via API keys
- Assign numbers to clients
- Each number = one campaign (label + client attribution)
- Webhook: `POST /api/webhooks/twilio` receives call events

### Call Ingestion
On each inbound call:
1. Store call metadata (SID, number, duration, timestamp)
2. Download recording → Supabase Storage
3. Enqueue: `call.transcribe` job

On transcription complete:
4. Store transcript
5. Enqueue: `call.classify` job

### AI Classification (Claude)
Input: transcript + call duration + Twilio number label

Output (structured JSON):
```
{
  is_billable: boolean,
  category: "service_request" | "spam" | "agency" | "lead_vendor" | "job_seeker" | "wrong_number" | "irrelevant_service",
  service_type: string | null,
  location: string | null,
  intent: "quote" | "booking" | "emergency" | null,
  duration_valid: boolean,
  reason: string              // plain English — shown in dispute view
}
```

Billable = `category === 'service_request'` AND `duration_valid === true`

### Dashboard

**Revenue View**
- Total calls / Billable calls / Non-billable calls
- Estimated revenue (billable × payout_per_call)
- Breakdown: spam % / job seekers % / agencies % / real leads %

**Per-Number / Per-Client View**
- Same metrics filtered by Twilio number or client

**Live Updates**
- Supabase Realtime subscription on `calls` + `call_classifications`
- New calls appear instantly, classification updates in real time

### Dispute System
For each call:
- View: transcript + classification + reason + recording player
- One-click: copy dispute evidence package (formatted text block)
- Evidence package includes: call date/time, duration, transcript excerpt, classification, AI reason
- Mark as disputed → dispute_note field

### Call Source Attribution
- Each Twilio number maps to a campaign label
- CRM shows revenue breakdown per campaign
- Track: which ad creative → which number → how many billable calls

### Real-time Alerts
- Supabase Realtime or webhook → Slack notification on billable call
- Daily digest: new calls, billable count, revenue delta

### Exports
- CSV / Excel filtered by: date range, client, number, category, billable status
- Includes: call time, duration, category, reason, billable flag, revenue

### ROI Tracker
- Per number: billable calls × payout = revenue
- Per campaign: compare across numbers
- Cost input (ad spend) → profit calculation (optional)
