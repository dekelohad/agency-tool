import { type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const v = row[h]
          if (v === null || v === undefined) return ''
          const s = String(v).replace(/"/g, '""')
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
        })
        .join(',')
    ),
  ]
  return lines.join('\n')
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id')
  const dateFrom = searchParams.get('date_from')
  const dateTo = searchParams.get('date_to')

  let query = supabase
    .from('calls')
    .select(
      `
      started_at, duration_sec, caller_number,
      twilio_numbers(label, number, campaign),
      clients(name, payout_per_call),
      call_classifications(
        is_billable, category, service_type, location, intent,
        reason, disputed
      )
    `
    )
    .order('started_at', { ascending: false })
    .limit(5000)

  if (clientId) query = query.eq('client_id', clientId)
  if (dateFrom) query = query.gte('started_at', dateFrom)
  if (dateTo) query = query.lte('started_at', dateTo)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  type CallRow = {
    started_at: string | null
    duration_sec: number | null
    caller_number: string | null
    twilio_numbers: { label: string | null; number: string | null; campaign: string | null } | null
    clients: { name: string | null; payout_per_call: number | null } | null
    call_classifications: {
      is_billable: boolean | null
      category: string | null
      service_type: string | null
      location: string | null
      intent: string | null
      reason: string | null
      disputed: boolean | null
    } | null
  }

  const rows = (data as unknown as CallRow[]).map((c) => ({
    date: c.started_at ?? '',
    duration_sec: c.duration_sec ?? '',
    caller_number: c.caller_number ?? '',
    campaign_label: c.twilio_numbers?.label ?? '',
    campaign_number: c.twilio_numbers?.number ?? '',
    campaign: c.twilio_numbers?.campaign ?? '',
    client: c.clients?.name ?? '',
    payout_per_call: c.clients?.payout_per_call ?? '',
    is_billable: c.call_classifications?.is_billable ?? '',
    category: c.call_classifications?.category ?? '',
    service_type: c.call_classifications?.service_type ?? '',
    location: c.call_classifications?.location ?? '',
    intent: c.call_classifications?.intent ?? '',
    reason: c.call_classifications?.reason ?? '',
    disputed: c.call_classifications?.disputed ?? '',
    revenue: c.call_classifications?.is_billable && c.clients?.payout_per_call
      ? c.clients.payout_per_call
      : 0,
  }))

  const csv = toCSV(rows)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="calls-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
