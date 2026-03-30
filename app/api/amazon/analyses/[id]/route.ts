import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/db/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: analysis, error: analysisError } = await supabase
    .from('amazon_analyses')
    .select(`
      *,
      amazon_products (
        id, asin, name, price, rating, review_count, bsr, review_velocity, url
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (analysisError || !analysis) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: clusters } = await supabase
    .from('problem_clusters')
    .select('*')
    .eq('source_id', id)
    .order('frequency_pct', { ascending: false })

  return Response.json({ analysis, clusters: clusters ?? [] })
}
