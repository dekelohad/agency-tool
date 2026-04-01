import { z } from 'zod'
import { chat } from './client'
import { extractJson } from './call-classifier'

export const AdAnalysisSchema = z.object({
  hook: z.string(),
  offer: z.string(),
  cta: z.string(),
  angles: z.array(z.string()),
  primary_text: z.string(),
  headline: z.string(),
})

export type AdAnalysis = z.infer<typeof AdAnalysisSchema>

export async function analyzeAd(adText: string): Promise<AdAnalysis> {
  const text = await chat(
    `Analyze this advertisement and extract its key components. Return ONLY valid JSON.

Ad text:
${adText}

Return JSON:
{
  "hook": "opening hook or attention-grabbing first line",
  "offer": "main offer or value proposition",
  "cta": "call to action text",
  "angles": ["array of angles used — from: urgency, pricing, guarantee, social_proof, fear, convenience, authority"],
  "primary_text": "main body copy",
  "headline": "headline text"
}`,
    512
  )

  const parsed = extractJson(text)
  return AdAnalysisSchema.parse(parsed)
}

export const KeywordResearchSchema = z.object({
  keywords: z.array(
    z.object({
      keyword: z.string(),
      cpc_estimate: z.enum(['low', 'medium', 'high']),
      cpc_value: z.number(),
      competition: z.enum(['low', 'medium', 'high']),
      intent: z.enum(['informational', 'transactional', 'emergency']),
      seasonal: z.boolean(),
    })
  ),
})

export type KeywordResearch = z.infer<typeof KeywordResearchSchema>

export async function analyzeKeywords(
  niche: string,
  city: string,
  serpResults: unknown
): Promise<KeywordResearch> {
  const text = await chat(
    `Analyze these Google SERP results for the local service niche "${niche}" in "${city}" and extract high-intent keywords.

SERP data:
${JSON.stringify(serpResults, null, 2).slice(0, 6000)}

For each keyword found, classify:
- cpc_estimate: "low" (<$5) | "medium" ($5-$20) | "high" (>$20)
- cpc_value: estimated dollar CPC
- competition: "low" | "medium" | "high"
- intent: "informational" | "transactional" | "emergency"
- seasonal: true if demand is seasonal

Return ONLY valid JSON:
{
  "keywords": [
    {
      "keyword": "...",
      "cpc_estimate": "medium",
      "cpc_value": 12.50,
      "competition": "high",
      "intent": "emergency",
      "seasonal": false
    }
  ]
}`,
    2048
  )

  const parsed = extractJson(text)
  return KeywordResearchSchema.parse(parsed)
}

export const LandingPageAnalysisSchema = z.object({
  headline: z.string(),
  subheadline: z.string(),
  offer: z.string(),
  guarantee: z.string().nullable(),
  cta: z.string(),
  structure: z.array(z.string()),
  gaps: z.array(z.string()),
  strengths: z.array(z.string()),
})

export type LandingPageAnalysis = z.infer<typeof LandingPageAnalysisSchema>

export async function analyzeLandingPage(
  html: string,
  url: string
): Promise<LandingPageAnalysis> {
  const truncated = html.slice(0, 8000)

  const text = await chat(
    `Analyze this landing page and extract its conversion elements. Return ONLY valid JSON.

URL: ${url}
HTML (truncated):
${truncated}

Return JSON:
{
  "headline": "main headline text",
  "subheadline": "subheadline or supporting value statement",
  "offer": "main offer / value proposition",
  "guarantee": "guarantee or risk reversal text, null if absent",
  "cta": "primary CTA button text",
  "structure": ["ordered list of page sections"],
  "gaps": ["missing conversion elements or weak points"],
  "strengths": ["strong conversion elements or best practices present"]
}`,
    1024
  )

  const parsed = extractJson(text)
  return LandingPageAnalysisSchema.parse(parsed)
}
