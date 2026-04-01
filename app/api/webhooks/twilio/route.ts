import { type NextRequest } from 'next/server'
import { Queue } from 'bullmq'
import { createSupabaseAdminClient } from '@/lib/db/server'
import { validateTwilioWebhook } from '@/lib/twilio/client'
import { redisConnection } from '@/lib/queue'
import type { TranscribeJobData } from '@/lib/queue/types'

export const dynamic = 'force-dynamic'

const transcribeQueue = new Queue<TranscribeJobData>('call.transcribe', {
  connection: redisConnection,
})

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN!

  // Validate Twilio signature
  const signature = request.headers.get('x-twilio-signature') ?? ''
  const url = request.url
  const formData = await request.formData()
  const params: Record<string, string> = {}
  formData.forEach((value, key) => {
    params[key] = value.toString()
  })

  if (authToken && !validateTwilioWebhook(authToken, signature, url, params)) {
    return new Response('Forbidden', { status: 403 })
  }

  const callSid = params['CallSid']
  const callStatus = params['CallStatus']
  const calledNumber = params['Called'] // our Twilio number
  const callerNumber = params['From']
  const duration = params['CallDuration'] ? parseInt(params['CallDuration'], 10) : null
  const recordingUrl = params['RecordingUrl'] ?? null

  if (!callSid) {
    return new Response('Missing CallSid', { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  // Find the twilio_number record to get user_id and client_id
  const { data: twilioNumber } = await supabase
    .from('twilio_numbers')
    .select('id, user_id, client_id, label')
    .eq('number', calledNumber)
    .maybeSingle<{
      id: string
      user_id: string
      client_id: string | null
      label: string | null
    }>()

  if (callStatus === 'initiated' || callStatus === 'ringing') {
    // Upsert call record on first event
    await supabase.from('calls').upsert(
      {
        twilio_call_sid: callSid,
        user_id: twilioNumber?.user_id,
        client_id: twilioNumber?.client_id,
        twilio_number_id: twilioNumber?.id,
        caller_number: callerNumber,
        direction: 'inbound',
        started_at: new Date().toISOString(),
      },
      { onConflict: 'twilio_call_sid' }
    )
    return new Response('OK', { status: 200 })
  }

  if (callStatus === 'completed') {
    // Update call with final duration
    const { data: call } = await supabase
      .from('calls')
      .upsert(
        {
          twilio_call_sid: callSid,
          user_id: twilioNumber?.user_id,
          client_id: twilioNumber?.client_id,
          twilio_number_id: twilioNumber?.id,
          caller_number: callerNumber,
          direction: 'inbound',
          duration_sec: duration,
          recording_url: recordingUrl,
          started_at: new Date().toISOString(),
        },
        { onConflict: 'twilio_call_sid' }
      )
      .select('id')
      .single<{ id: string }>()

    if (call?.id && recordingUrl && twilioNumber?.user_id) {
      await transcribeQueue.add('transcribe', {
        callId: call.id,
        recordingUrl,
        userId: twilioNumber.user_id,
      })
    }
  }

  return new Response('OK', { status: 200 })
}
