import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/db/server'
import { amazonQueue } from '@/lib/queue'

const BodySchema = z.object({
  keyword: z.string().min(1).max(200),
  category: z.string().min(1),
  asin: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 400 })
  }

  const { keyword, category, asin } = parsed.data

  const { data: analysis, error } = await supabase
    .from('amazon_analyses')
    .insert({ user_id: user.id, keyword, category, status: 'pending' })
    .select()
    .single()

  if (error || !analysis) {
    return Response.json({ error: 'Failed to create analysis' }, { status: 500 })
  }

  await amazonQueue.add('amazon.analyze', {
    analysisId: analysis.id,
    keyword,
    category,
    asin,
    userId: user.id,
  })

  return Response.json({ analysisId: analysis.id }, { status: 201 })
}
