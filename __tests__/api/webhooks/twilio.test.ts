import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Supabase admin mock ──────────────────────────────────────────────────────

const mockMaybeSingle = vi.fn().mockResolvedValue({
  data: { id: 'num-1', user_id: 'user-1', client_id: 'client-1', label: 'Miami HVAC' },
  error: null,
})

const mockCallSingle = vi.fn().mockResolvedValue({ data: { id: 'call-1' }, error: null })
const mockCallUpsert = vi.fn()

vi.mock('@/lib/db/server', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table === 'twilio_numbers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: mockMaybeSingle,
            }),
          }),
        }
      }
      if (table === 'calls') {
        return {
          upsert: mockCallUpsert.mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: mockCallSingle,
            }),
          }),
        }
      }
      return {}
    },
  }),
  createSupabaseServerClient: vi.fn(),
}))

vi.mock('@/lib/twilio/client', () => ({
  validateTwilioWebhook: vi.fn().mockReturnValue(true),
  toE164: vi.fn((n: string) => n),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRequest(params: Record<string, string>) {
  const body = new URLSearchParams(params).toString()
  return new Request('https://example.com/api/webhooks/twilio', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': 'valid-sig',
    },
    body,
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/webhooks/twilio', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-setup mockCallUpsert after clearAllMocks
    mockCallUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'call-1' }, error: null }),
      }),
    })
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'num-1', user_id: 'user-1', client_id: 'client-1', label: 'Miami HVAC' },
      error: null,
    })
  })

  it('returns 200 for a completed call with recording', async () => {
    const { POST } = await import('@/app/api/webhooks/twilio/route')

    const req = buildRequest({
      CallSid: 'CA123',
      CallStatus: 'completed',
      Called: '+13055551234',
      From: '+19545559999',
      CallDuration: '120',
      RecordingUrl: 'https://api.twilio.com/recordings/RE123.mp3',
    })

    const response = await POST(req as Parameters<typeof POST>[0])
    expect(response.status).toBe(200)
  })

  it('returns 200 for a completed call without recording', async () => {
    const { POST } = await import('@/app/api/webhooks/twilio/route')

    const req = buildRequest({
      CallSid: 'CA789',
      CallStatus: 'completed',
      Called: '+13055551234',
      From: '+19545559999',
      CallDuration: '45',
    })

    const response = await POST(req as Parameters<typeof POST>[0])
    expect(response.status).toBe(200)
  })

  it('returns 200 for an initiated call', async () => {
    const { POST } = await import('@/app/api/webhooks/twilio/route')

    const req = buildRequest({
      CallSid: 'CA456',
      CallStatus: 'initiated',
      Called: '+13055551234',
      From: '+19545559999',
    })

    const response = await POST(req as Parameters<typeof POST>[0])
    expect(response.status).toBe(200)
  })

  it('returns 200 for a ringing call', async () => {
    const { POST } = await import('@/app/api/webhooks/twilio/route')

    const req = buildRequest({
      CallSid: 'CA999',
      CallStatus: 'ringing',
      Called: '+13055551234',
      From: '+19545559999',
    })

    const response = await POST(req as Parameters<typeof POST>[0])
    expect(response.status).toBe(200)
  })

  it('returns 400 when CallSid is missing', async () => {
    const { POST } = await import('@/app/api/webhooks/twilio/route')

    const req = buildRequest({
      CallStatus: 'completed',
      Called: '+13055551234',
    })

    const response = await POST(req as Parameters<typeof POST>[0])
    expect(response.status).toBe(400)
  })
})
