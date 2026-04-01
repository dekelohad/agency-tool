import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

import {
  AdCreativeSchema,
  GeneratedCreativesSchema,
  generateCreatives,
} from '@/lib/ai/creative-generator'

function mockDeepSeekResponse(content: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  })
}

// ─── Schema validation ────────────────────────────────────────────────────────

const validAd = {
  format: 'image',
  hook: 'Is your AC failing you on the hottest day?',
  primary_text: 'Our licensed technicians are available 24/7 for emergency repairs.',
  headline: 'Same-Day HVAC Service',
  cta: 'Book Now',
  image_concept: 'Technician fixing AC on a hot summer day',
  video_concept: null,
  storyboard: null,
  shot_list: [],
  landing_copy: {
    headline: 'Emergency HVAC Repair',
    subhead: 'Licensed technicians available now',
    bullets: ['Same-day service', '100% satisfaction', 'Free diagnosis'],
    cta: 'Call Now',
  },
  ab_variant: 'A',
}

describe('AdCreativeSchema', () => {
  it('parses a valid image ad', () => {
    expect(() => AdCreativeSchema.parse(validAd)).not.toThrow()
  })

  it('parses a valid video ad', () => {
    expect(() =>
      AdCreativeSchema.parse({
        ...validAd,
        format: 'video',
        ab_variant: 'B',
        image_concept: null,
        video_concept: 'Show a homeowner in a hot room',
        storyboard: 'Scene 1...',
        shot_list: ['Shot 1', 'Shot 2'],
      })
    ).not.toThrow()
  })

  it('parses a valid ugc ad', () => {
    expect(() =>
      AdCreativeSchema.parse({ ...validAd, format: 'ugc', ab_variant: 'C' })
    ).not.toThrow()
  })

  it('rejects invalid format', () => {
    expect(() => AdCreativeSchema.parse({ ...validAd, format: 'banner' })).toThrow()
  })

  it('rejects invalid ab_variant', () => {
    expect(() => AdCreativeSchema.parse({ ...validAd, ab_variant: 'D' })).toThrow()
  })

  it('requires landing_copy subfields', () => {
    expect(() =>
      AdCreativeSchema.parse({ ...validAd, landing_copy: { headline: 'test' } })
    ).toThrow()
  })
})

describe('GeneratedCreativesSchema', () => {
  it('parses valid 3-variant output', () => {
    const output = {
      ads: [
        { ...validAd, ab_variant: 'A' },
        { ...validAd, ab_variant: 'B', format: 'video' },
        { ...validAd, ab_variant: 'C', format: 'ugc' },
      ],
      testing_plan: {
        priority_order: ['hook', 'offer', 'visual', 'cta'],
        variants: [
          { variant: 'A', angle: 'pain', success_metrics: ['CTR > 2%'] },
          { variant: 'B', angle: 'curiosity', success_metrics: ['CTR > 2%'] },
          { variant: 'C', angle: 'social_proof', success_metrics: ['CTR > 2%'] },
        ],
      },
    }
    expect(() => GeneratedCreativesSchema.parse(output)).not.toThrow()
  })

  it('requires testing_plan', () => {
    expect(() => GeneratedCreativesSchema.parse({ ads: [validAd] })).toThrow()
  })
})

// ─── generateCreatives ────────────────────────────────────────────────────────

const mockResult = {
  ads: [
    { ...validAd, ab_variant: 'A' },
    { ...validAd, format: 'video', ab_variant: 'B', image_concept: null, video_concept: 'Video B', storyboard: 'Scene', shot_list: ['Shot 1'] },
    { ...validAd, format: 'ugc', ab_variant: 'C', image_concept: null },
  ],
  testing_plan: {
    priority_order: ['hook', 'offer', 'visual', 'cta'],
    variants: [
      { variant: 'A', angle: 'pain', success_metrics: ['CTR > 2%'] },
      { variant: 'B', angle: 'curiosity', success_metrics: ['CTR > 2%'] },
      { variant: 'C', angle: 'social_proof', success_metrics: ['CTR > 2%'] },
    ],
  },
}

describe('generateCreatives', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns 3 ad variants with correct ab_variants', async () => {
    mockDeepSeekResponse(JSON.stringify(mockResult))

    const result = await generateCreatives({
      niche: 'HVAC',
      targetAudience: 'Homeowners in Miami',
      problemClusters: ['AC not cooling', 'High energy bills'],
    })

    expect(result.ads).toHaveLength(3)
    expect(result.ads.map((a) => a.ab_variant)).toEqual(['A', 'B', 'C'])
    expect(result.ads[0].landing_copy.bullets.length).toBeGreaterThan(0)
  })

  it('includes testing plan with hook first in priority', async () => {
    mockDeepSeekResponse(JSON.stringify(mockResult))

    const result = await generateCreatives({
      niche: 'Locksmith',
      targetAudience: 'Anyone locked out',
      problemClusters: ['Locked out at night'],
      competitorHooks: ['24/7 Locksmith Available'],
    })

    expect(result.testing_plan.priority_order[0]).toBe('hook')
    expect(result.testing_plan.variants).toHaveLength(3)
  })

  it('sends competitorHooks in the request body', async () => {
    mockDeepSeekResponse(JSON.stringify(mockResult))

    await generateCreatives({
      niche: 'Plumber',
      targetAudience: 'Homeowners',
      problemClusters: ['Burst pipe'],
      competitorHooks: ['#1 Plumber in Miami'],
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.messages[0].content).toContain('#1 Plumber in Miami')
  })

  it('throws when DeepSeek returns no JSON', async () => {
    mockDeepSeekResponse('I am unable to generate creatives at this time.')
    await expect(
      generateCreatives({ niche: 'x', targetAudience: 'y', problemClusters: ['z'] })
    ).rejects.toThrow('No JSON object found')
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'Rate limited' })
    await expect(
      generateCreatives({ niche: 'x', targetAudience: 'y', problemClusters: ['z'] })
    ).rejects.toThrow('DeepSeek API error 429')
  })
})
