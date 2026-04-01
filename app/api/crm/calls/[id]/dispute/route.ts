import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

const DisputeSchema = z.object({
  dispute_note: z.string().min(1).max(2000),
})

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/crm/calls/[id]/dispute'>
) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = DisputeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 422 })
  }

  // Verify caller owns the call
  const { data: call } = await supabase
    .from('calls')
    .select('id')
    .eq('id', id)
    .single()

  if (!call) return Response.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('call_classifications')
    .update({
      disputed: true,
      dispute_note: parsed.data.dispute_note,
    })
    .eq('call_id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<'/api/crm/calls/[id]/dispute'>
) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('call_classifications')
    .update({ disputed: false, dispute_note: null })
    .eq('call_id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
