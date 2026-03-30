import 'dotenv/config'
import { Worker, Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { redisConnection } from '../lib/queue/index'
import type { AmazonAnalyzeJobData } from '../lib/queue/types'
import {
  fetchTopProducts,
  fetchNegativeReviews,
  computeReviewVelocity,
  type RainforestReview,
} from '../lib/rainforest/client'
import {
  analyzeReviewBatch,
  mergeAndDeduplicate,
  chunkArray,
  type ReviewInput,
} from '../lib/ai/amazon-analyzer'

// Worker uses the service role key — runs outside HTTP request cycle
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function updateStatus(analysisId: string, status: string) {
  await supabase
    .from('amazon_analyses')
    .update({ status })
    .eq('id', analysisId)
}

async function processAmazonJob(job: Job<AmazonAnalyzeJobData>) {
  const { analysisId, keyword, category, asin, userId } = job.data

  try {
    await updateStatus(analysisId, 'running')

    // 1. Fetch top products
    const products = await fetchTopProducts(keyword, category, asin)
    if (products.length === 0) {
      await updateStatus(analysisId, 'failed')
      return
    }

    const productNames: string[] = []
    const allReviews: ReviewInput[] = []

    // 2. For each product, store it + fetch reviews
    for (const product of products) {
      const { data: dbProduct, error } = await supabase
        .from('amazon_products')
        .insert({
          analysis_id: analysisId,
          asin: product.asin,
          name: product.title,
          price: product.price?.value ?? null,
          rating: product.rating ?? null,
          review_count: product.ratings_total ?? null,
          bsr: product.bestsellers_rank?.[0]?.rank ?? null,
          review_velocity: null, // computed below after reviews are fetched
          url: product.link ?? null,
        })
        .select()
        .single()

      if (error || !dbProduct) continue

      productNames.push(product.title)

      // 3. Fetch negative reviews for this product
      const rawReviews: RainforestReview[] = await fetchNegativeReviews(product.asin)

      const velocity = computeReviewVelocity(rawReviews)
      await supabase
        .from('amazon_products')
        .update({ review_velocity: velocity })
        .eq('id', dbProduct.id)

      // 4. Bulk insert reviews
      if (rawReviews.length > 0) {
        await supabase.from('amazon_reviews').insert(
          rawReviews.map((r) => ({
            product_id: dbProduct.id,
            rating: r.rating,
            title: r.title ?? null,
            body: r.body,
            date: r.date?.utc ? r.date.utc.split('T')[0] : null,
            verified: r.verified_purchase ?? false,
          }))
        )
      }

      // Collect for AI analysis
      allReviews.push(
        ...rawReviews.map((r) => ({
          rating: r.rating,
          title: r.title,
          body: r.body,
          verified: r.verified_purchase,
        }))
      )
    }

    if (allReviews.length === 0) {
      await updateStatus(analysisId, 'done')
      return
    }

    // 5. Chunk reviews and run batch analysis
    const chunks = chunkArray(allReviews, 50)
    const batchResults = await Promise.all(
      chunks.map((chunk, i) =>
        analyzeReviewBatch(chunk, keyword, productNames, i + 1, chunks.length)
      )
    )

    // 6. Merge clusters across batches
    const finalClusters =
      batchResults.length > 1
        ? await mergeAndDeduplicate(
            batchResults,
            chunks.map((c) => c.length),
            keyword
          )
        : batchResults[0]

    // 7. Store problem clusters
    if (finalClusters.length > 0) {
      await supabase.from('problem_clusters').insert(
        finalClusters.map((c) => ({
          user_id: userId,
          source: 'amazon',
          source_id: analysisId,
          theme: c.theme,
          frequency_pct: c.frequency_pct,
          intensity: c.intensity,
          sentiment_score: c.sentiment_score,
          sample_quotes: c.sample_quotes,
          root_cause: c.root_cause,
          expectation_gap: c.expectation_gap,
          opportunity: c.opportunity,
        }))
      )
    }

    await updateStatus(analysisId, 'done')
  } catch (err) {
    console.error(`[amazon.worker] job ${job.id} failed:`, err)
    await updateStatus(analysisId, 'failed')
    throw err // re-throw so BullMQ marks as failed and retries
  }
}

const worker = new Worker<AmazonAnalyzeJobData>('amazon', processAmazonJob, {
  connection: redisConnection,
  concurrency: 2,
})

worker.on('completed', (job) => {
  console.log(`[amazon.worker] job ${job.id} completed`)
})

worker.on('failed', (job, err) => {
  console.error(`[amazon.worker] job ${job?.id} failed:`, err.message)
})

export default worker
