import { z } from 'zod'
import * as cheerio from 'cheerio'
import { createSupabaseServerClient } from '@/lib/db/server'
import { analyzeLandingPage } from '@/lib/ai/ad-analyzer'

export const dynamic = 'force-dynamic'

const LPSchema = z.object({
  url: z.string().url(),
})

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = LPSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 422 })
  }

  const { url } = parsed.data

  // Fetch the landing page
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; agency-tool/1.0)' },
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    return Response.json({ error: `Failed to fetch URL: ${res.status}` }, { status: 422 })
  }

  const html = await res.text()

  // Extract visible text with cheerio to reduce noise
  const $ = cheerio.load(html)
  $('script, style, nav, footer, head').remove()
  const cleanText = $('body').text().replace(/\s+/g, ' ').trim()

  const analysis = await analyzeLandingPage(cleanText, url)

  return Response.json({ url, analysis })
}
