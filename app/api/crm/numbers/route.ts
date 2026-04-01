import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/db/server'

export const dynamic = 'force-dynamic'

const NumberSchema = z.object({
  number: z.string().min(10),
  label: z.string().min(1).max(200),
  campaign: z.string().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
})

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('twilio_numbers')
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = NumberSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('twilio_numbers')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
