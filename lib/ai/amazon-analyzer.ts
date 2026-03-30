import { z } from 'zod'

const DEEPSEEK_API = 'https://api.deepseek.com/chat/completions'
const MODEL = 'deepseek-chat'

// ── Schemas ─────────────────────────────────────────────────

const ClusterSchema = z.object({
  theme: z.string(),
  frequency_pct: z.number().min(0).max(100),
  intensity: z.enum(['high', 'medium', 'low']),
  sentiment_score: z.number().min(-1).max(1),
  sample_quotes: z.array(z.string()).min(1).max(5),
  root_cause: z.string(),
  expectation_gap: z.string(),
  opportunity: z.string(),
})

const ResponseSchema = z.object({
  clusters: z.array(ClusterSchema).min(1).max(10),
})

export type ProblemCluster = z.output<typeof ClusterSchema>

// ── Inputs ───────────────────────────────────────────────────

export interface ReviewInput {
  rating: number
  title?: string
  body: string
  verified?: boolean
}

// ── System prompt ────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a product market research specialist. Your role is to identify and cluster customer pain points from negative Amazon reviews.

Your output must be a raw JSON object. Do not use markdown code fences. Do not add any explanation text before or after the JSON.

Definitions:
- frequency_pct: the percentage of reviews in this batch that mention the problem (estimate from evidence)
- intensity: "high" = emotional language, all-caps, words like "dangerous" or "terrible"; "medium" = clear frustration; "low" = mild disappointment
- sentiment_score: always negative here, range -1.0 (extreme) to -0.1 (mild)
- sample_quotes: copy exact phrases or sentences from the reviews, do not paraphrase
- root_cause: what is structurally wrong with the product
- expectation_gap: "Customers expected [X]. The product delivered [Y]."
- opportunity: a specific product improvement or positioning angle that directly addresses this cluster`

// ── Helpers ──────────────────────────────────────────────────

function formatReviews(reviews: ReviewInput[]): string {
  return reviews
    .map((r, i) => {
      const verified = r.verified ? 'verified' : 'unverified'
      return `---\nReview #${i + 1} [Rating: ${r.rating}★] [${verified}]\nTitle: ${r.title ?? '(no title)'}\nBody: ${r.body}\n---`
    })
    .join('\n')
}

async function callDeepSeek(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const res = await fetch(DEEPSEEK_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'system', content: system }, ...messages],
      max_tokens: 4096,
    }),
  })

  if (!res.ok) throw new Error(`DeepSeek API error: ${res.status}`)
  const data = await res.json()
  return (data.choices?.[0]?.message?.content ?? '').trim()
}

async function callWithRetry(system: string, user: string): Promise<string> {
  const text = await callDeepSeek(system, [{ role: 'user', content: user }])

  try {
    JSON.parse(text)
    return text
  } catch {
    // Retry once with a correction instruction
    const retryText = await callDeepSeek(system, [
      { role: 'user', content: user },
      { role: 'assistant', content: text },
      {
        role: 'user',
        content:
          'Your response was not valid JSON. Return ONLY the JSON object, with no markdown fences, no preamble, and no trailing text.',
      },
    ])
    return retryText
  }
}

function parseClusters(raw: string): ProblemCluster[] {
  const parsed = ResponseSchema.parse(JSON.parse(raw))
  return parsed.clusters
}

// ── Public API ───────────────────────────────────────────────

export async function analyzeReviewBatch(
  reviews: ReviewInput[],
  keyword: string,
  productNames: string[],
  batchNumber: number,
  totalBatches: number
): Promise<ProblemCluster[]> {
  const userPrompt = `Keyword: ${keyword}
Product(s) analyzed: ${productNames.join(', ')}
Batch: ${batchNumber} of ${totalBatches} (${reviews.length} reviews in this batch)

REVIEWS:
${formatReviews(reviews)}

Return a JSON object with this exact structure:
{
  "clusters": [
    {
      "theme": "concise label (5-8 words describing the problem)",
      "frequency_pct": <0-100>,
      "intensity": "high" | "medium" | "low",
      "sentiment_score": <-1.0 to -0.1>,
      "sample_quotes": ["verbatim quote 1", "verbatim quote 2", "verbatim quote 3"],
      "root_cause": "What is structurally wrong. 1-2 sentences.",
      "expectation_gap": "Customers expected [X]. The product delivered [Y].",
      "opportunity": "A better product or positioning approach would [Z]. 1-2 sentences."
    }
  ]
}

Constraints:
- Identify 3-8 clusters (no fewer than 3, no more than 8 per batch)
- Only include a cluster if at least 5% of these reviews mention the problem
- Order clusters by frequency_pct descending
- sample_quotes must be verbatim — exact words from the reviews above
- Return raw JSON only`

  const raw = await callWithRetry(SYSTEM_PROMPT, userPrompt)
  return parseClusters(raw)
}

export async function mergeAndDeduplicate(
  allBatchClusters: ProblemCluster[][],
  batchSizes: number[],
  keyword: string
): Promise<ProblemCluster[]> {
  if (allBatchClusters.length === 1) return allBatchClusters[0]

  const totalReviews = batchSizes.reduce((a, b) => a + b, 0)

  const userPrompt = `You previously analyzed "${keyword}" reviews in ${allBatchClusters.length} batches.
Merge the per-batch cluster results below into a single unified list.

Batch sizes: ${JSON.stringify(batchSizes)} (use these weights when averaging frequency_pct)
Total reviews analyzed: ${totalReviews}

BATCH RESULTS:
${JSON.stringify(allBatchClusters, null, 2)}

Merge instructions:
1. Combine clusters that describe the same underlying problem (even if worded differently)
2. Recalculate frequency_pct as a weighted average using the batch sizes above
3. For intensity, use the highest level present across merged clusters
4. Combine sample_quotes arrays, keeping the 3-5 most representative
5. Write unified root_cause, expectation_gap, and opportunity statements
6. Order final clusters by (frequency_pct × intensity_weight) where high=3, medium=2, low=1
7. Output 3-10 final clusters total

Return the same JSON schema as before — a single object with a "clusters" array.`

  const raw = await callWithRetry(SYSTEM_PROMPT, userPrompt)
  return parseClusters(raw)
}

// Chunk an array into groups of size n
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
