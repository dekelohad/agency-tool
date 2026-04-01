import { Worker, Queue, type Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { redisConnection } from '@/lib/queue'
import type { TranscribeJobData, ClassifyJobData } from '@/lib/queue/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const classifyQueue = new Queue<ClassifyJobData>('call.classify', {
  connection: redisConnection,
})

async function transcribeWithDeepgram(audioUrl: string): Promise<string> {
  const res = await fetch(
    'https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true&diarize=false',
    {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: audioUrl }),
    }
  )

  if (!res.ok) {
    throw new Error(`Deepgram error ${res.status}: ${await res.text()}`)
  }

  const data = (await res.json()) as {
    results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string }> }> }
  }

  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
}

export const transcribeWorker = new Worker<TranscribeJobData>(
  'call.transcribe',
  async (job: Job<TranscribeJobData>) => {
    const { callId, recordingUrl, userId } = job.data

    const transcript = await transcribeWithDeepgram(recordingUrl)

    await supabase.from('call_transcripts').insert({
      call_id: callId,
      transcript,
      provider: 'deepgram',
    })

    // Fetch call metadata needed for classification
    const { data: call } = await supabase
      .from('calls')
      .select('duration_sec, twilio_numbers(label)')
      .eq('id', callId)
      .single<{ duration_sec: number | null; twilio_numbers: { label: string | null } | null }>()

    await classifyQueue.add('classify', {
      callId,
      transcript,
      durationSec: call?.duration_sec ?? 0,
      numberLabel: call?.twilio_numbers?.label ?? null,
      userId,
    })
  },
  { connection: redisConnection }
)
