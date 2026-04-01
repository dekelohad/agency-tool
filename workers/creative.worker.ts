import { Worker, type Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { redisConnection } from '@/lib/queue'
import { generateCreatives } from '@/lib/ai/creative-generator'
import type { CreativeGenerateJobData } from '@/lib/queue/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const creativeWorker = new Worker<CreativeGenerateJobData>(
  'creative.generate',
  async (job: Job<CreativeGenerateJobData>) => {
    const { briefId, userId, niche, targetAudience, problemClusters, competitorHooks } = job.data

    const result = await generateCreatives({
      niche,
      targetAudience,
      problemClusters,
      competitorHooks,
    })

    const rows = result.ads.map((ad) => ({
      brief_id: briefId,
      user_id: userId,
      format: ad.format,
      hook: ad.hook,
      primary_text: ad.primary_text,
      headline: ad.headline,
      cta: ad.cta,
      image_concept: ad.image_concept,
      video_concept: ad.video_concept,
      storyboard: ad.storyboard,
      shot_list: ad.shot_list,
      landing_copy: ad.landing_copy,
      ab_variant: ad.ab_variant,
    }))

    await supabase.from('ads').insert(rows)
  },
  { connection: redisConnection }
)
