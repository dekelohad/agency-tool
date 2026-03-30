import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/db/server'
import { Badge } from '@/components/ui/badge'
import { StatusPoller } from './status-poller'

interface ProblemCluster {
  id: string
  theme: string
  frequency_pct: number
  intensity: 'high' | 'medium' | 'low'
  sentiment_score: number
  sample_quotes: string[]
  root_cause: string
  expectation_gap: string
  opportunity: string
}

interface Product {
  id: string
  asin: string
  name: string
  price: number | null
  rating: number | null
  review_count: number | null
  bsr: number | null
  review_velocity: number | null
}

const INTENSITY_COLOR: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
  low: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400',
}

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) notFound()

  const { data: analysis } = await supabase
    .from('amazon_analyses')
    .select(`
      *,
      amazon_products (
        id, asin, name, price, rating, review_count, bsr, review_velocity
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!analysis) notFound()

  const { data: clusters } = await supabase
    .from('problem_clusters')
    .select('*')
    .eq('source_id', id)
    .order('frequency_pct', { ascending: false })

  const isActive = analysis.status === 'pending' || analysis.status === 'running'
  const products: Product[] = analysis.amazon_products ?? []

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/dashboard/amazon"
            className="mb-1 block text-xs text-zinc-400 hover:text-zinc-600"
          >
            ← Back
          </Link>
          <h1 className="text-lg font-semibold">{analysis.keyword}</h1>
          <p className="mt-0.5 text-sm text-zinc-500">{analysis.category}</p>
        </div>
        <span
          className={`mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            analysis.status === 'done'
              ? 'bg-emerald-100 text-emerald-700'
              : analysis.status === 'failed'
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {analysis.status}
        </span>
      </div>

      {/* Live poller when running */}
      {isActive && <StatusPoller analysisId={id} />}

      {/* Failed state */}
      {analysis.status === 'failed' && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          Analysis failed. You can start a new one from the{' '}
          <Link href="/dashboard/amazon" className="underline">
            Amazon page
          </Link>
          .
        </div>
      )}

      {/* Products table */}
      {products.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">Products Analyzed</h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-950">
                  <th className="px-4 py-2.5 font-medium text-zinc-500">Product</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">Rating</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">Reviews</th>
                  <th className="px-4 py-2.5 font-medium text-zinc-500">BSR</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800"
                  >
                    <td className="max-w-xs truncate px-4 py-3 font-medium">
                      {p.name ?? p.asin}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {p.rating != null ? `${p.rating}★` : '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {p.review_count?.toLocaleString() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {p.bsr?.toLocaleString() ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Problem clusters */}
      {clusters && clusters.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold">
            Problem Clusters
            <span className="ml-2 font-normal text-zinc-400">({clusters.length})</span>
          </h2>
          <div className="space-y-3">
            {(clusters as ProblemCluster[]).map((cluster) => (
              <div
                key={cluster.id}
                className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{cluster.theme}</h3>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${INTENSITY_COLOR[cluster.intensity]}`}
                    >
                      {cluster.intensity}
                    </span>
                    <span className="text-sm font-semibold tabular-nums">
                      {cluster.frequency_pct?.toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-400 uppercase tracking-wide">Root Cause</p>
                    <p className="text-zinc-700 dark:text-zinc-300">{cluster.root_cause}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-400 uppercase tracking-wide">Expectation Gap</p>
                    <p className="text-zinc-700 dark:text-zinc-300">{cluster.expectation_gap}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-400 uppercase tracking-wide">Opportunity</p>
                    <p className="text-zinc-700 dark:text-zinc-300">{cluster.opportunity}</p>
                  </div>
                </div>

                {cluster.sample_quotes?.length > 0 && (
                  <div className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                    {cluster.sample_quotes.slice(0, 3).map((quote, i) => (
                      <blockquote
                        key={i}
                        className="border-l-2 border-zinc-200 pl-3 text-xs text-zinc-500 italic dark:border-zinc-700"
                      >
                        "{quote}"
                      </blockquote>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done but no clusters */}
      {analysis.status === 'done' && (!clusters || clusters.length === 0) && (
        <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-400">
            No problem clusters were identified for this keyword.
          </p>
        </div>
      )}
    </div>
  )
}
