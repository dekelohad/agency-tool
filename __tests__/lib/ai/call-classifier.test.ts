import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

import { extractJson, CallClassificationSchema, classifyCall } from '@/lib/ai/call-classifier'

// ─── Helper ───────────────────────────────────────────────────────────────────

function mockDeepSeekResponse(content: string) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  })
}

// ─── extractJson ─────────────────────────────────────────────────────────────

describe('extractJson', () => {
  it('extracts JSON object from plain response', () => {
    const text = '{"is_billable": true, "category": "service_request"}'
    expect(extractJson(text)).toEqual({ is_billable: true, category: 'service_request' })
  })

  it('extracts JSON when surrounded by prose', () => {
    const text =
      'Here is the classification:\n{"is_billable": false, "category": "spam"}\nEnd of response.'
    expect(extractJson(text)).toEqual({ is_billable: false, category: 'spam' })
  })

  it('throws when no JSON object found', () => {
    expect(() => extractJson('No JSON here')).toThrow('No JSON object found')
  })
})

// ─── CallClassificationSchema ─────────────────────────────────────────────────

describe('CallClassificationSchema', () => {
  const valid = {
    is_billable: true,
    category: 'service_request',
    service_type: 'HVAC repair',
    location: 'Miami',
    intent: 'emergency',
    duration_valid: true,
    reason: 'Homeowner called requesting emergency AC repair.',
  }

  it('parses a valid classification', () => {
    expect(() => CallClassificationSchema.parse(valid)).not.toThrow()
  })

  it('rejects unknown category', () => {
    expect(() =>
      CallClassificationSchema.parse({ ...valid, category: 'unknown_category' })
    ).toThrow()
  })

  it('rejects unknown intent', () => {
    expect(() =>
      CallClassificationSchema.parse({ ...valid, intent: 'purchase' })
    ).toThrow()
  })

  it('accepts null for nullable fields', () => {
    const result = CallClassificationSchema.parse({
      ...valid,
      service_type: null,
      location: null,
      intent: null,
    })
    expect(result.service_type).toBeNull()
    expect(result.location).toBeNull()
    expect(result.intent).toBeNull()
  })
})

// ─── classifyCall ─────────────────────────────────────────────────────────────

describe('classifyCall', () => {
  beforeEach(() => mockFetch.mockReset())

  it('parses a billable service request', async () => {
    mockDeepSeekResponse(
      JSON.stringify({
        is_billable: true,
        category: 'service_request',
        service_type: 'HVAC repair',
        location: 'Miami',
        intent: 'emergency',
        duration_valid: true,
        reason: 'Customer called requesting emergency HVAC repair.',
      })
    )

    const result = await classifyCall({
      transcript: 'My AC stopped working, can you send someone today?',
      durationSec: 120,
      numberLabel: 'Miami HVAC',
    })

    expect(result.is_billable).toBe(true)
    expect(result.category).toBe('service_request')
    expect(result.service_type).toBe('HVAC repair')
    expect(result.intent).toBe('emergency')
  })

  it('parses a non-billable spam call', async () => {
    mockDeepSeekResponse(
      JSON.stringify({
        is_billable: false,
        category: 'spam',
        service_type: null,
        location: null,
        intent: null,
        duration_valid: false,
        reason: 'Automated spam call.',
      })
    )

    const result = await classifyCall({
      transcript: 'Congratulations! You have won a free vacation...',
      durationSec: 15,
      numberLabel: null,
    })

    expect(result.is_billable).toBe(false)
    expect(result.category).toBe('spam')
    expect(result.duration_valid).toBe(false)
  })

  it('throws when DeepSeek returns no JSON', async () => {
    mockDeepSeekResponse('I cannot classify this call.')

    await expect(
      classifyCall({ transcript: 'test', durationSec: 60, numberLabel: null })
    ).rejects.toThrow('No JSON object found')
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'Server Error' })

    await expect(
      classifyCall({ transcript: 'test', durationSec: 60, numberLabel: null })
    ).rejects.toThrow('DeepSeek API error 500')
  })
})
