import { z } from 'zod'
import { Queue } from 'bullmq'
import { createSupabaseServerClient } from '@/lib/db/server'
import { redisConnection } from '@/lib/queue'
import type { CreativeGenerateJobData } from '@/lib/queue/types'

export const dynamic = 'force-dynamic'

const GenerateSchema = z.object({
  niche: z.string().min(1).max(200),
  target_audience: z.string().min(1).max(500),
  problem_clusters: z.array(z.string().min(1)).min(1).max(10),
  competitor_hooks: z.array(z.string()).optional(),
})

const creativeQueue = new Queue<CreativeGenerateJobData>('creative.generate', {
  connection: redisConnection,
})

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = GenerateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 422 })
  }

  const { niche, target_audience, problem_clusters, competitor_hooks } = parsed.data

  // Create brief record
  const { data: brief, error } = await supabase
    .from('creative_briefs')
    .insert({ user_id: user.id, niche, target_audience })
    .select()
    .single<{ id: string }>()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const job = await creativeQueue.add('generate', {
    briefId: brief.id,
    userId: user.id,
    niche,
    targetAudience: target_audience,
    problemClusters: problem_clusters,
    competitorHooks: competitor_hooks,
  })

  return Response.json({ jobId: job.id, briefId: brief.id }, { status: 202 })
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const briefId = searchParams.get('brief_id')

  let query = supabase
    .from('ads')
    .select('*, creative_briefs(niche, target_audience)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (briefId) query = query.eq('brief_id', briefId)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
