import { type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const numberId = searchParams.get('number_id')
  const billable = searchParams.get('billable')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)

  let query = supabase
    .from('calls')
    .select(
      `
      id, twilio_call_sid, caller_number, direction, duration_sec,
      recording_url, started_at, created_at,
      twilio_numbers(id, label, number, campaign),
      clients(id, name),
      call_classifications(
        is_billable, category, service_type, location, intent,
        duration_valid, reason, disputed, dispute_note, classified_at
      ),
      call_transcripts(transcript)
    `,
      { count: 'exact' }
    )
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (clientId) query = query.eq('client_id', clientId)
  if (numberId) query = query.eq('twilio_number_id', numberId)
  if (dateFrom) query = query.gte('started_at', dateFrom)
  if (dateTo) query = query.lte('started_at', dateTo)
  if (billable === 'true') {
    query = query.eq('call_classifications.is_billable', true)
  } else if (billable === 'false') {
    query = query.eq('call_classifications.is_billable', false)
  }

  const { data, count, error } = await query

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ calls: data, total: count })
}
