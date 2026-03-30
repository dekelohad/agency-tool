import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/db/server'

export async function GET(_request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('amazon_analyses')
    .select('id, keyword, category, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return Response.json({ error: 'Failed to fetch analyses' }, { status: 500 })
  }

  return Response.json({ analyses: data })
}
