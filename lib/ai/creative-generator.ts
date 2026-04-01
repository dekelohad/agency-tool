import { z } from 'zod'
import { chat } from './client'
import { extractJson } from './call-classifier'

export const AdCreativeSchema = z.object({
  format: z.enum(['image', 'video', 'ugc']),
  hook: z.string(),
  primary_text: z.string(),
  headline: z.string(),
  cta: z.string(),
  image_concept: z.string().nullable(),
  video_concept: z.string().nullable(),
  storyboard: z.string().nullable(),
  shot_list: z.array(z.string()),
  landing_copy: z.object({
    headline: z.string(),
    subhead: z.string(),
    bullets: z.array(z.string()),
    cta: z.string(),
  }),
  ab_variant: z.enum(['A', 'B', 'C']),
})

export type AdCreative = z.infer<typeof AdCreativeSchema>

export const GeneratedCreativesSchema = z.object({
  ads: z.array(AdCreativeSchema),
  testing_plan: z.object({
    priority_order: z.array(z.string()),
    variants: z.array(
      z.object({
        variant: z.string(),
        angle: z.string(),
        success_metrics: z.array(z.string()),
      })
    ),
  }),
})

export type GeneratedCreatives = z.infer<typeof GeneratedCreativesSchema>

export async function generateCreatives({
  niche,
  targetAudience,
  problemClusters,
  competitorHooks = [],
}: {
  niche: string
  targetAudience: string
  problemClusters: string[]
  competitorHooks?: string[]
}): Promise<GeneratedCreatives> {
  const text = await chat(
    `You are a world-class direct response copywriter specializing in local service businesses. Generate a complete ad creative set.

Niche: ${niche}
Target audience: ${targetAudience}
Problem clusters: ${problemClusters.join(', ')}
${competitorHooks.length > 0 ? `Competitor hooks to differentiate from:\n${competitorHooks.join('\n')}` : ''}

Generate exactly 3 ads — Variant A (pain angle), B (curiosity angle), C (social proof angle).

For each ad, provide:
- hook: attention-grabbing first line (max 10 words)
- primary_text: full ad body copy (2-4 sentences)
- headline: short punchy headline
- cta: call-to-action text
- image_concept: visual description for designer
- shot_list: 3-5 specific shots if video
- landing_copy: matching landing page copy block

Return ONLY valid JSON:
{
  "ads": [
    {
      "format": "image",
      "hook": "...",
      "primary_text": "...",
      "headline": "...",
      "cta": "...",
      "image_concept": "...",
      "video_concept": null,
      "storyboard": null,
      "shot_list": [],
      "landing_copy": {
        "headline": "...",
        "subhead": "...",
        "bullets": ["...", "...", "..."],
        "cta": "..."
      },
      "ab_variant": "A"
    }
  ],
  "testing_plan": {
    "priority_order": ["hook", "offer", "visual", "cta"],
    "variants": [
      {
        "variant": "A",
        "angle": "pain",
        "success_metrics": ["CTR > 2%", "CPC < $8", "Lead form completion > 15%"]
      }
    ]
  }
}`,
    4096
  )

  const parsed = extractJson(text)
  return GeneratedCreativesSchema.parse(parsed)
}
