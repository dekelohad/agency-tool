import { describe, it, expect, vi } from 'vitest'

// ─── Shared Supabase mock ─────────────────────────────────────────────────────

const mockUser = { id: 'user-1', email: 'test@example.com' }

const mockCallsData = [
  {
    id: 'call-1',
    twilio_call_sid: 'CA001',
    caller_number: '+13055551111',
    duration_sec: 180,
    started_at: '2026-04-01T10:00:00Z',
    twilio_numbers: { label: 'Miami HVAC', number: '+13055559999', campaign: null },
    clients: { id: 'client-1', name: 'HVAC Corp', payout_per_call: 25 },
    call_classifications: {
      is_billable: true,
      category: 'service_request',
      service_type: 'HVAC repair',
      location: 'Miami',
      intent: 'emergency',
      reason: 'Valid service request',
      disputed: false,
      dispute_note: null,
      classified_at: '2026-04-01T10:05:00Z',
    },
    call_transcripts: { transcript: 'My AC is broken, can you help?' },
  },
  {
    id: 'call-2',
    twilio_call_sid: 'CA002',
    caller_number: '+13055552222',
    duration_sec: 10,
    started_at: '2026-04-01T11:00:00Z',
    twilio_numbers: null,
    clients: null,
    call_classifications: {
      is_billable: false,
      category: 'spam',
      service_type: null,
      location: null,
      intent: null,
      reason: 'Automated spam call',
      disputed: false,
      dispute_note: null,
      classified_at: '2026-04-01T11:01:00Z',
    },
    call_transcripts: null,
  },
]

vi.mock('@/lib/db/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({ data: mockCallsData, count: 2, error: null }),
          limit: vi.fn().mockResolvedValue({ data: mockCallsData, error: null }),
        }),
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockCallsData[0], error: null }),
        }),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  }),
  createSupabaseAdminClient: vi.fn(),
}))

// ─── GET /api/crm/calls ───────────────────────────────────────────────────────

describe('GET /api/crm/calls', () => {
  it('returns calls list and total count', async () => {
    const { GET } = await import('@/app/api/crm/calls/route')

    const req = new Request('https://example.com/api/crm/calls?limit=50')
    const response = await GET(req as Parameters<typeof GET>[0])

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toHaveProperty('calls')
    expect(json).toHaveProperty('total', 2)
    expect(Array.isArray(json.calls)).toBe(true)
  })
})

// ─── GET /api/crm/calls/:id ───────────────────────────────────────────────────

describe('GET /api/crm/calls/:id', () => {
  it('returns a single call with all related data', async () => {
    const { GET } = await import('@/app/api/crm/calls/[id]/route')

    const req = new Request('https://example.com/api/crm/calls/call-1')
    const ctx = { params: Promise.resolve({ id: 'call-1' }) }
    const response = await GET(req, ctx)

    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.id).toBe('call-1')
    expect(json.call_classifications?.is_billable).toBe(true)
  })
})

// ─── POST /api/crm/calls/:id/dispute ─────────────────────────────────────────

describe('POST /api/crm/calls/:id/dispute', () => {
  it('returns 422 when dispute_note is empty', async () => {
    const { POST } = await import('@/app/api/crm/calls/[id]/dispute/route')

    const req = new Request('https://example.com/api/crm/calls/call-1/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispute_note: '' }),
    })
    const ctx = { params: Promise.resolve({ id: 'call-1' }) }
    const response = await POST(req, ctx)

    expect(response.status).toBe(422)
  })

  it('returns 422 when dispute_note is missing', async () => {
    const { POST } = await import('@/app/api/crm/calls/[id]/dispute/route')

    const req = new Request('https://example.com/api/crm/calls/call-1/dispute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const ctx = { params: Promise.resolve({ id: 'call-1' }) }
    const response = await POST(req, ctx)

    expect(response.status).toBe(422)
  })
})

// ─── GET /api/crm/export ─────────────────────────────────────────────────────

describe('GET /api/crm/export', () => {
  it('returns CSV content-type', async () => {
    const { GET } = await import('@/app/api/crm/export/route')

    const req = new Request('https://example.com/api/crm/export')
    const response = await GET(req as Parameters<typeof GET>[0])

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
  })

  it('sets content-disposition as an attachment with .csv filename', async () => {
    const { GET } = await import('@/app/api/crm/export/route')

    const req = new Request('https://example.com/api/crm/export')
    const response = await GET(req as Parameters<typeof GET>[0])

    const disposition = response.headers.get('Content-Disposition') ?? ''
    expect(disposition).toMatch(/attachment/)
    expect(disposition).toMatch(/\.csv/)
  })

  it('CSV body contains a header row', async () => {
    const { GET } = await import('@/app/api/crm/export/route')

    const req = new Request('https://example.com/api/crm/export')
    const response = await GET(req as Parameters<typeof GET>[0])

    const text = await response.text()
    const firstLine = text.split('\n')[0]
    expect(firstLine).toContain('is_billable')
    expect(firstLine).toContain('category')
  })
})
