import * as cheerio from 'cheerio'

// Same public interface as before — worker is unchanged

export interface RainforestProduct {
  asin: string
  title: string
  price?: { value: number }
  rating?: number
  ratings_total?: number
  bestsellers_rank?: Array<{ rank: number; category: string }>
  link?: string
}

export interface RainforestReview {
  id: string
  rating: number
  title?: string
  body: string
  date?: { raw: string; utc?: string }
  verified_purchase?: boolean
}

// Rotate user agents to reduce block rate
const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
]

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

async function amazonFetch(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': randomUA(),
      'Accept-Language': 'en-US,en;q=0.9',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
    },
  })
  if (!res.ok) throw new Error(`Amazon fetch failed: ${res.status} ${url}`)
  return res.text()
}

function parseRating(text: string | undefined): number | undefined {
  if (!text) return undefined
  const m = text.match(/(\d+\.?\d*)/)
  return m ? parseFloat(m[1]) : undefined
}

function parseNumber(text: string | undefined): number | undefined {
  if (!text) return undefined
  const clean = text.replace(/[^0-9]/g, '')
  return clean ? parseInt(clean, 10) : undefined
}

// ── Public API ───────────────────────────────────────────────

export async function fetchTopProducts(
  keyword: string,
  _category: string,
  asin?: string
): Promise<RainforestProduct[]> {
  if (asin) {
    // Single product by ASIN
    const html = await amazonFetch(
      `https://www.amazon.com/dp/${asin}?th=1`
    )
    const $ = cheerio.load(html)

    const title =
      $('#productTitle').text().trim() ||
      $('h1.a-size-large').text().trim() ||
      asin

    const priceText =
      $('.a-price .a-offscreen').first().text().trim() ||
      $('#priceblock_ourprice').text().trim()
    const priceVal = parseFloat(priceText.replace(/[^0-9.]/g, '')) || undefined

    const ratingText = $('#acrPopover').attr('title') || $('[data-hook="rating-out-of-text"]').text()
    const reviewCountText = $('#acrCustomerReviewText').text()

    return [
      {
        asin,
        title,
        price: priceVal ? { value: priceVal } : undefined,
        rating: parseRating(ratingText),
        ratings_total: parseNumber(reviewCountText),
        link: `https://www.amazon.com/dp/${asin}`,
      },
    ]
  }

  // Keyword search
  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}&s=review-rank`
  const html = await amazonFetch(searchUrl)
  const $ = cheerio.load(html)

  const products: RainforestProduct[] = []

  $('[data-component-type="s-search-result"]').each((_, el) => {
    if (products.length >= 5) return false

    const asinVal = $(el).attr('data-asin')
    if (!asinVal) return

    const title =
      $(el).find('h2 a span').text().trim() ||
      $(el).find('[data-cy="title-recipe"] span').text().trim()

    const ratingText = $(el).find('[aria-label*="out of 5"]').first().attr('aria-label')
    const reviewCountText = $(el).find('[aria-label*="ratings"]').first().attr('aria-label') ||
      $(el).find('span.a-size-base').filter((_, e) => /\d,?\d+/.test($(e).text())).first().text()

    const priceText = $(el).find('.a-price .a-offscreen').first().text()
    const priceVal = parseFloat(priceText.replace(/[^0-9.]/g, '')) || undefined

    if (!title) return

    products.push({
      asin: asinVal,
      title,
      price: priceVal ? { value: priceVal } : undefined,
      rating: parseRating(ratingText),
      ratings_total: parseNumber(reviewCountText),
      link: `https://www.amazon.com/dp/${asinVal}`,
    })
  })

  return products
}

export async function fetchNegativeReviews(
  asin: string,
  maxPages = 3
): Promise<RainforestReview[]> {
  const reviews: RainforestReview[] = []

  for (let page = 1; page <= maxPages; page++) {
    const url =
      `https://www.amazon.com/product-reviews/${asin}` +
      `?filterByStar=critical&sortBy=recent&pageNumber=${page}`

    let html: string
    try {
      html = await amazonFetch(url)
    } catch {
      break
    }

    const $ = cheerio.load(html)
    let found = 0

    $('[data-hook="review"]').each((_, el) => {
      const ratingText = $(el).find('[data-hook="review-star-rating"] span').text()
      const rating = parseRating(ratingText)
      if (!rating || rating > 3) return

      const id =
        $(el).attr('id') || `${asin}-${page}-${found}`
      const title = $(el).find('[data-hook="review-title"] span').last().text().trim()
      const body = $(el).find('[data-hook="review-body"] span').text().trim()
      const dateText = $(el).find('[data-hook="review-date"]').text().trim()
      const verified = $(el).find('[data-hook="avp-badge"]').length > 0

      if (!body) return

      reviews.push({
        id,
        rating,
        title: title || undefined,
        body,
        date: dateText ? { raw: dateText } : undefined,
        verified_purchase: verified,
      })
      found++
    })

    if (found === 0) break
    if (page < maxPages) await sleep(500 + Math.random() * 500)
  }

  return reviews
}

export function computeReviewVelocity(reviews: RainforestReview[]): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const recent = reviews.filter((r) => {
    if (!r.date?.utc) return false
    return new Date(r.date.utc).getTime() > cutoff
  })
  return Math.round((recent.length / 30) * 100) / 100
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
