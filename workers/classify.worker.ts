import { Worker, type Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { redisConnection } from '@/lib/queue'
import { classifyCall } from '@/lib/ai/call-classifier'
import type { ClassifyJobData } from '@/lib/queue/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export const classifyWorker = new Worker<ClassifyJobData>(
  'call.classify',
  async (job: Job<ClassifyJobData>) => {
    const { callId, transcript, durationSec, numberLabel } = job.data

    const classification = await classifyCall({ transcript, durationSec, numberLabel })

    await supabase.from('call_classifications').upsert(
      {
        call_id: callId,
        ...classification,
      },
      { onConflict: 'call_id' }
    )
  },
  { connection: redisConnection }
)
