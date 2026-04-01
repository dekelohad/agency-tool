import { z } from 'zod'
import { type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/db/server'
import { analyzeKeywords, analyzeAd } from '@/lib/ai/ad-analyzer'

export const dynamic = 'force-dynamic'

const ResearchSchema = z.object({
  niche: z.string().min(1).max(200),
  city: z.string().min(1).max(200),
})

async function fetchSerpResults(query: string): Promise<unknown> {
  const apiKey = process.env.SERPAPI_KEY
  if (!apiKey) return { organic_results: [], ads: [] }

  const url = new URL('https://serpapi.com/search')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('num', '10')

  const res = await fetch(url.toString())
  if (!res.ok) return { organic_results: [], ads: [] }
  return res.json()
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = ResearchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues }, { status: 422 })
  }

  const { niche, city } = parsed.data
  const query = `${niche} ${city}`

  const serpData = await fetchSerpResults(query)

  // Analyse keywords via Claude
  const keywordResult = await analyzeKeywords(niche, city, serpData)

  // Store keywords in DB
  const keywordRows = keywordResult.keywords.map((kw) => ({
    user_id: user.id,
    niche,
    city,
    ...kw,
    seasonal: undefined, // not in DB schema
  }))

  const { data: savedKeywords } = await supabase
    .from('market_keywords')
    .insert(keywordRows)
    .select()

  // Analyse Google Ads from SERP
  type SerpAd = { title?: string; description?: string; link?: string }
  const serpAds = ((serpData as { ads?: SerpAd[] }).ads ?? []).slice(0, 5)
  const analysedAds = await Promise.all(
    serpAds.map(async (ad) => {
      const adText = [ad.title, ad.description].filter(Boolean).join('\n')
      const analysis = await analyzeAd(adText)
      return {
        user_id: user.id,
        niche,
        city,
        source: 'google',
        ...analysis,
        raw_data: ad,
      }
    })
  )

  const { data: savedAds } = await supabase
    .from('competitor_ads')
    .insert(analysedAds)
    .select()

  return Response.json({
    keywords: savedKeywords ?? keywordResult.keywords,
    competitor_ads: savedAds ?? analysedAds,
  })
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const niche = searchParams.get('niche')
  const city = searchParams.get('city')

  let kwQuery = supabase
    .from('market_keywords')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  let adsQuery = supabase
    .from('competitor_ads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (niche) {
    kwQuery = kwQuery.ilike('niche', `%${niche}%`)
    adsQuery = adsQuery.ilike('niche', `%${niche}%`)
  }
  if (city) {
    kwQuery = kwQuery.ilike('city', `%${city}%`)
    adsQuery = adsQuery.ilike('city', `%${city}%`)
  }

  const [{ data: keywords }, { data: ads }] = await Promise.all([kwQuery, adsQuery])

  return Response.json({ keywords: keywords ?? [], competitor_ads: ads ?? [] })
}
