import { createSupabaseServerClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  ctx: RouteContext<'/api/crm/calls/[id]'>
) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('calls')
    .select(
      `
      id, twilio_call_sid, caller_number, direction, duration_sec,
      recording_url, started_at, created_at,
      twilio_numbers(id, label, number, campaign),
      clients(id, name, payout_per_call),
      call_classifications(
        is_billable, category, service_type, location, intent,
        duration_valid, reason, disputed, dispute_note, classified_at
      ),
      call_transcripts(transcript, provider)
    `
    )
    .eq('id', id)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 404 })
  return Response.json(data)
}
