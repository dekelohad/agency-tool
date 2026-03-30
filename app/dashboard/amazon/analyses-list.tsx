'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'

interface Analysis {
  id: string
  keyword: string
  category: string
  status: 'pending' | 'running' | 'done' | 'failed'
  created_at: string
}

function StatusDot({ status }: { status: Analysis['status'] }) {
  const colors: Record<Analysis['status'], string> = {
    pending: 'bg-zinc-400',
    running: 'bg-blue-500 animate-pulse',
    done: 'bg-emerald-500',
    failed: 'bg-red-500',
  }
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors[status]}`} />
}

export function AnalysesList() {
  const { data, isLoading, isError } = useQuery<{ analyses: Analysis[] }>({
    queryKey: ['amazon-analyses'],
    queryFn: () => fetch('/api/amazon/analyses').then((r) => r.json()),
    refetchInterval: (query) => {
      const analyses = query.state.data?.analyses ?? []
      const hasActive = analyses.some(
        (a) => a.status === 'pending' || a.status === 'running'
      )
      return hasActive ? 3000 : false
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-sm text-red-500">Failed to load analyses.</p>
    )
  }

  const analyses = data?.analyses ?? []

  if (analyses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-400">No analyses yet. Start one above.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50 text-left dark:border-zinc-800 dark:bg-zinc-950">
            <th className="px-4 py-2.5 font-medium text-zinc-500">Keyword</th>
            <th className="px-4 py-2.5 font-medium text-zinc-500">Category</th>
            <th className="px-4 py-2.5 font-medium text-zinc-500">Status</th>
            <th className="px-4 py-2.5 font-medium text-zinc-500">Date</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {analyses.map((a) => (
            <tr
              key={a.id}
              className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <td className="px-4 py-3 font-medium">{a.keyword}</td>
              <td className="px-4 py-3 text-zinc-500">{a.category}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5">
                  <StatusDot status={a.status} />
                  <span className="capitalize">{a.status}</span>
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-400">
                {new Date(a.created_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                {a.status === 'done' && (
                  <Link
                    href={`/dashboard/amazon/${a.id}`}
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    View →
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
