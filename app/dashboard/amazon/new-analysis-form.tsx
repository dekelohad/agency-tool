'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const FormSchema = z.object({
  keyword: z.string().min(1, 'Required').max(200),
  category: z.string().min(1, 'Required'),
  asin: z.string().optional(),
})

type FormValues = z.infer<typeof FormSchema>

export function NewAnalysisForm() {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { keyword: '', category: 'All', asin: '' },
  })

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const res = await fetch('/api/amazon/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keyword: values.keyword,
        category: values.category,
        asin: values.asin || undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setServerError(data.error ? JSON.stringify(data.error) : 'Failed to start analysis')
      return
    }

    reset()
    queryClient.invalidateQueries({ queryKey: ['amazon-analyses'] })
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold">New Analysis</h2>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-40 space-y-1">
          <Label htmlFor="keyword" className="text-xs">Keyword</Label>
          <Input
            id="keyword"
            placeholder="e.g. posture corrector"
            {...register('keyword')}
          />
          {errors.keyword && (
            <p className="text-xs text-red-500">{errors.keyword.message}</p>
          )}
        </div>

        <div className="w-40 space-y-1">
          <Label htmlFor="category" className="text-xs">Category</Label>
          <Input
            id="category"
            placeholder="e.g. Health"
            {...register('category')}
          />
          {errors.category && (
            <p className="text-xs text-red-500">{errors.category.message}</p>
          )}
        </div>

        <div className="w-44 space-y-1">
          <Label htmlFor="asin" className="text-xs">ASIN (optional)</Label>
          <Input
            id="asin"
            placeholder="B08XYZ..."
            {...register('asin')}
          />
        </div>

        <div className="flex items-end">
          <Button type="submit" disabled={isSubmitting} size="sm">
            {isSubmitting ? 'Starting…' : 'Analyze'}
          </Button>
        </div>
      </form>

      {serverError && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950 dark:text-red-400">
          {serverError}
        </p>
      )}
    </div>
  )
}
