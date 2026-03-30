'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function StatusPoller({ analysisId }: { analysisId: string }) {
  const router = useRouter()

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/amazon/analyses/${analysisId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.analysis?.status === 'done' || data.analysis?.status === 'failed') {
        clearInterval(interval)
        router.refresh()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [analysisId, router])

  return (
    <div className="flex items-center gap-2 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-500" />
      Analysis running — this page will update automatically
    </div>
  )
}
