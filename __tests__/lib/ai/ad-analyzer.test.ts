import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

import {
  AdAnalysisSchema,
  KeywordResearchSchema,
  LandingPageAnalysisSchema,
  analyzeAd,
  analyzeKeywords,
  analyzeLandingPage,
} from '@/lib/ai/ad-analyzer'

function mockDeepSeekResponse(content: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content } }] }),
  })
}

// ─── Schema validation ────────────────────────────────────────────────────────

describe('AdAnalysisSchema', () => {
  it('parses a valid ad analysis', () => {
    const valid = {
      hook: 'Is your AC failing you?',
      offer: '$49 AC tune-up + free diagnosis',
      cta: 'Book now',
      angles: ['urgency', 'pricing'],
      primary_text: "Don't suffer in the heat. Our technicians...",
      headline: 'Same-day HVAC service',
    }
    expect(() => AdAnalysisSchema.parse(valid)).not.toThrow()
  })

  it('requires all fields', () => {
    expect(() => AdAnalysisSchema.parse({ hook: 'test' })).toThrow()
  })

  it('accepts empty angles array', () => {
    const valid = {
      hook: 'Hook',
      offer: 'Offer',
      cta: 'CTA',
      angles: [],
      primary_text: 'Body',
      headline: 'Headline',
    }
    expect(() => AdAnalysisSchema.parse(valid)).not.toThrow()
  })
})

describe('KeywordResearchSchema', () => {
  it('parses valid keyword results', () => {
    const valid = {
      keywords: [
        {
          keyword: 'emergency HVAC Miami',
          cpc_estimate: 'high',
          cpc_value: 25.5,
          competition: 'high',
          intent: 'emergency',
          seasonal: false,
        },
      ],
    }
    expect(() => KeywordResearchSchema.parse(valid)).not.toThrow()
  })

  it('rejects invalid cpc_estimate', () => {
    expect(() =>
      KeywordResearchSchema.parse({
        keywords: [
          {
            keyword: 'test',
            cpc_estimate: 'very_high',
            cpc_value: 10,
            competition: 'medium',
            intent: 'transactional',
            seasonal: false,
          },
        ],
      })
    ).toThrow()
  })

  it('accepts empty keywords array', () => {
    expect(() => KeywordResearchSchema.parse({ keywords: [] })).not.toThrow()
  })
})

describe('LandingPageAnalysisSchema', () => {
  it('parses a valid LP analysis', () => {
    const valid = {
      headline: 'Same-Day HVAC Service in Miami',
      subheadline: 'Licensed and insured technicians available now',
      offer: '$49 tune-up with any repair',
      guarantee: '100% satisfaction or your money back',
      cta: 'Call Now',
      structure: ['Hero', 'Features', 'Testimonials', 'CTA'],
      gaps: ['No live chat'],
      strengths: ['Strong guarantee'],
    }
    expect(() => LandingPageAnalysisSchema.parse(valid)).not.toThrow()
  })

  it('accepts null guarantee', () => {
    expect(() =>
      LandingPageAnalysisSchema.parse({
        headline: 'Test',
        subheadline: 'Sub',
        offer: 'Offer',
        guarantee: null,
        cta: 'CTA',
        structure: [],
        gaps: [],
        strengths: [],
      })
    ).not.toThrow()
  })
})

// ─── analyzeAd ────────────────────────────────────────────────────────────────

describe('analyzeAd', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns parsed ad analysis', async () => {
    const mockResult = {
      hook: 'AC broken? We fix it today.',
      offer: 'Free diagnostic with any repair',
      cta: 'Call now',
      angles: ['urgency', 'guarantee'],
      primary_text: 'Our licensed HVAC technicians...',
      headline: 'Same-Day HVAC Repair',
    }
    mockDeepSeekResponse(JSON.stringify(mockResult))

    const result = await analyzeAd('AC broken? We fix it today. Call now!')
    expect(result.hook).toBe(mockResult.hook)
    expect(result.angles).toContain('urgency')
  })

  it('throws when response has no JSON', async () => {
    mockDeepSeekResponse('Sorry, I cannot analyze this.')
    await expect(analyzeAd('some ad')).rejects.toThrow('No JSON object found')
  })
})

// ─── analyzeKeywords ─────────────────────────────────────────────────────────

describe('analyzeKeywords', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns parsed keyword list', async () => {
    mockDeepSeekResponse(
      JSON.stringify({
        keywords: [
          {
            keyword: 'emergency HVAC Miami',
            cpc_estimate: 'high',
            cpc_value: 28,
            competition: 'high',
            intent: 'emergency',
            seasonal: false,
          },
        ],
      })
    )

    const result = await analyzeKeywords('HVAC', 'Miami', { organic_results: [] })
    expect(result.keywords).toHaveLength(1)
    expect(result.keywords[0].keyword).toBe('emergency HVAC Miami')
  })
})

// ─── analyzeLandingPage ───────────────────────────────────────────────────────

describe('analyzeLandingPage', () => {
  beforeEach(() => mockFetch.mockReset())

  it('returns landing page analysis', async () => {
    mockDeepSeekResponse(
      JSON.stringify({
        headline: 'Miami HVAC Experts',
        subheadline: 'Same day service',
        offer: '$49 tune-up',
        guarantee: '100% satisfaction',
        cta: 'Call Now',
        structure: ['Hero', 'Services', 'Reviews'],
        gaps: ['No chat'],
        strengths: ['Strong guarantee'],
      })
    )

    const result = await analyzeLandingPage(
      '<html><body>HVAC Miami</body></html>',
      'https://test.com'
    )
    expect(result.headline).toBe('Miami HVAC Experts')
    expect(result.guarantee).toBe('100% satisfaction')
  })
})
