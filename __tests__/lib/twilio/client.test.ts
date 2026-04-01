import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { validateTwilioWebhook, toE164 } from '@/lib/twilio/client'

// ─── validateTwilioWebhook ────────────────────────────────────────────────────

describe('validateTwilioWebhook', () => {
  const authToken = 'test-secret-token'
  const url = 'https://example.com/api/webhooks/twilio'

  function makeSignature(token: string, rawUrl: string, params: Record<string, string>) {
    const sorted = Object.keys(params).sort()
    const str = rawUrl + sorted.map((k) => k + params[k]).join('')
    return crypto.createHmac('sha1', token).update(str, 'utf8').digest('base64')
  }

  it('returns true for a valid signature', () => {
    const params = { CallSid: 'CA123', CallStatus: 'completed', From: '+13055551234' }
    const sig = makeSignature(authToken, url, params)
    expect(validateTwilioWebhook(authToken, sig, url, params)).toBe(true)
  })

  it('returns false for a tampered signature', () => {
    const params = { CallSid: 'CA123', CallStatus: 'completed' }
    const sig = makeSignature(authToken, url, params)
    // Tamper with one char
    const tampered = sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A')
    expect(validateTwilioWebhook(authToken, tampered, url, params)).toBe(false)
  })

  it('returns false when params differ from what was signed', () => {
    const signedParams = { CallSid: 'CA123' }
    const sig = makeSignature(authToken, url, signedParams)
    const receivedParams = { CallSid: 'CA999' }
    expect(validateTwilioWebhook(authToken, sig, url, receivedParams)).toBe(false)
  })

  it('returns false when URL differs', () => {
    const params = { CallSid: 'CA123' }
    const sig = makeSignature(authToken, url, params)
    expect(validateTwilioWebhook(authToken, sig, 'https://other.com/webhook', params)).toBe(false)
  })

  it('handles empty params', () => {
    const params = {}
    const sig = makeSignature(authToken, url, params)
    expect(validateTwilioWebhook(authToken, sig, url, params)).toBe(true)
  })
})

// ─── toE164 ──────────────────────────────────────────────────────────────────

describe('toE164', () => {
  it('prefixes 10-digit US number with +1', () => {
    expect(toE164('3055551234')).toBe('+13055551234')
  })

  it('handles 11-digit number starting with 1', () => {
    expect(toE164('13055551234')).toBe('+13055551234')
  })

  it('passes through already-formatted E.164', () => {
    expect(toE164('+13055551234')).toBe('+13055551234')
  })

  it('strips dashes and spaces', () => {
    expect(toE164('(305) 555-1234')).toBe('+13055551234')
  })
})
