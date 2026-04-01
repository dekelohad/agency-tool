import { vi } from 'vitest'

// Stub env vars so modules that read them at import time don't throw
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key'
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token'
process.env.DEEPGRAM_API_KEY = 'test-deepgram-key'
process.env.UPSTASH_REDIS_HOST = 'localhost'
process.env.UPSTASH_REDIS_PASSWORD = 'test'

// Mock next/headers — async cookies() used in server components and route handlers
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    get: () => undefined,
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

// Mock BullMQ — uses proper function constructors (arrow functions can't be used with `new`)
vi.mock('bullmq', () => {
  const mockAdd = vi.fn().mockResolvedValue({ id: 'mock-job-id' })

  function Queue(this: { add: typeof mockAdd; close: () => void }) {
    this.add = mockAdd
    this.close = vi.fn()
  }

  function Worker(this: { on: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }) {
    this.on = vi.fn()
    this.close = vi.fn()
  }

  return { Queue, Worker, __mockAdd: mockAdd }
})
