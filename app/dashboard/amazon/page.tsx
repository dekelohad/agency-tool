import { Suspense } from 'react'
import { NewAnalysisForm } from './new-analysis-form'
import { AnalysesList } from './analyses-list'
import { Skeleton } from '@/components/ui/skeleton'

export default function AmazonPage() {
  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold">Amazon Product Analyzer</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Enter a keyword to fetch top products, cluster negative reviews, and surface product opportunities.
        </p>
      </div>

      <NewAnalysisForm />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          Recent Analyses
        </h2>
        <Suspense fallback={<Skeleton className="h-32 w-full rounded-lg" />}>
          <AnalysesList />
        </Suspense>
      </div>
    </div>
  )
}
